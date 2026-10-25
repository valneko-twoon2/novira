//! Starting, stopping and the data folder lock.
mod common;
use common::*;

#[tokio::test]
async fn it_listens_on_loopback_only_and_stops() {
    let f = Fixture::start().await;
    assert!(f.server.addr.ip().is_loopback());
    assert!(f.server.url().starts_with(&format!(
        "http://127.0.0.1:{}/?token=",
        f.server.addr.port()
    )));
    assert_eq!(f.server.token.len(), 64);
    let addr = f.server.addr;
    f.stop().await;
    assert!(
        tokio::net::TcpStream::connect(addr).await.is_err(),
        "the port is closed after stop"
    );
}

#[tokio::test]
async fn a_folder_without_a_built_frontend_is_refused() {
    let data = tempfile::tempdir().unwrap();
    let empty = tempfile::tempdir().unwrap();
    let backend = novira_server::open_backend(data.path()).unwrap();
    let err = novira_server::start(backend, empty.path().to_path_buf(), 0)
        .await
        .err()
        .expect("refused");
    assert!(err.to_string().contains("index.html"), "{err}");
}

#[test]
fn a_data_folder_held_by_another_process_is_refused() {
    let data = tempfile::tempdir().unwrap();
    let dist = tempfile::tempdir().unwrap();
    std::fs::write(dist.path().join("index.html"), "<head></head>").unwrap();
    let held =
        novira_core::startup::try_claim(&data.path().join(novira_core::startup::LOCK_FILE_NAME))
            .unwrap()
            .expect("free at first");
    // In process.
    assert!(matches!(
        novira_server::open_backend(data.path()),
        Err(novira_core::startup::Refusal::AlreadyRunning)
    ));
    // The program: exit code 3, a message, and no address printed.
    let run = |args: &[&str]| {
        std::process::Command::new(env!("CARGO_BIN_EXE_novira-server"))
            .args(args)
            .env_remove("NOVIRA_DATA_DIR")
            .output()
            .unwrap()
    };
    let out = run(&[
        "--data",
        data.path().to_str().unwrap(),
        "--dist",
        dist.path().to_str().unwrap(),
    ]);
    assert_eq!(
        out.status.code(),
        Some(3),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert!(String::from_utf8_lossy(&out.stderr).contains("already uses the data folder"));
    assert!(
        out.stdout.is_empty(),
        "no address is printed for a refused start"
    );
    // The environment variable names the folder as well.
    let out = std::process::Command::new(env!("CARGO_BIN_EXE_novira-server"))
        .args(["--dist", dist.path().to_str().unwrap()])
        .env("NOVIRA_DATA_DIR", data.path())
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(3));
    // No folder given: a usage error, never a guess.
    let out = run(&["--dist", dist.path().to_str().unwrap()]);
    assert_eq!(out.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&out.stderr).contains("no data folder"));
    drop(held);
    assert!(novira_core::startup::try_claim(
        &data.path().join(novira_core::startup::LOCK_FILE_NAME)
    )
    .unwrap()
    .is_some());
}
