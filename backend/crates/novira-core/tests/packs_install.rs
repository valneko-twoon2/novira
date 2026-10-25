//! Installing a model pack's files: what is skipped, what is refused and how a failed or stopped download is
//! reported. Downloads go through a proxy that hangs up at once, so no real server is ever reached.
use novira_core::packs::{
    disk_status, file_path, files, install_files, is_installed, prepare_dirs, PackKind, PackStatus,
};
use std::path::Path;
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

fn write_all(models: &Path, kind: PackKind) {
    for f in files(kind) {
        let path = file_path(models, kind, f);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"x").unwrap();
    }
}

/// A client whose requests all go to a proxy that closes every connection.
fn hanging_up_client() -> reqwest::Client {
    let proxy = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", proxy.local_addr().unwrap());
    std::thread::spawn(move || {
        for stream in proxy.incoming() {
            drop(stream);
        }
    });
    reqwest::Client::builder()
        .proxy(reqwest::Proxy::all(url).unwrap())
        .build()
        .unwrap()
}

#[tokio::test]
async fn a_complete_pack_downloads_nothing_and_reports_nothing() {
    let dir = tempfile::tempdir().unwrap();
    write_all(dir.path(), PackKind::Music);
    let seen = Mutex::new(Vec::new());
    let sink = |s: PackStatus| seen.lock().unwrap().push(s);
    install_files(
        &reqwest::Client::new(),
        dir.path(),
        PackKind::Music,
        &CancellationToken::new(),
        &sink,
    )
    .await
    .unwrap();
    assert!(seen.lock().unwrap().is_empty());
    assert!(is_installed(dir.path(), PackKind::Music));
    assert_eq!(disk_status(dir.path(), PackKind::Music), PackStatus::Ready);
}

#[tokio::test]
async fn a_missing_file_that_cannot_be_downloaded_fails_with_the_reason() {
    let dir = tempfile::tempdir().unwrap();
    let client = hanging_up_client();
    let err = install_files(
        &client,
        dir.path(),
        PackKind::Music,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
    .unwrap_err();
    assert!(err.starts_with("Download failed"), "{err}");
    assert!(!is_installed(dir.path(), PackKind::Music));
    assert!(matches!(
        disk_status(dir.path(), PackKind::Music),
        PackStatus::Missing { total_bytes } if total_bytes > 0
    ));
}

#[tokio::test]
async fn a_stopped_install_says_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    let cancel = CancellationToken::new();
    cancel.cancel();
    let err = install_files(
        &hanging_up_client(),
        dir.path(),
        PackKind::Video,
        &cancel,
        &|_| {},
    )
    .await
    .unwrap_err();
    assert_eq!(err, "cancelled");
}

#[tokio::test]
async fn an_install_into_a_place_that_is_not_a_folder_is_an_error() {
    let dir = tempfile::tempdir().unwrap();
    let blocked = dir.path().join("models");
    std::fs::write(&blocked, b"a file, not a folder").unwrap();
    assert!(prepare_dirs(&blocked).is_err());
    let err = install_files(
        &reqwest::Client::new(),
        &blocked,
        PackKind::Logo,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
    .unwrap_err();
    assert!(!err.is_empty());
    // The folder for downloads cannot be made either when the pack's own folder is a file.
    let models = dir.path().join("models2");
    prepare_dirs(&models).unwrap();
    let logo = models.join(PackKind::Logo.dir());
    std::fs::remove_dir_all(&logo).unwrap();
    std::fs::write(&logo, b"file").unwrap();
    assert!(install_files(
        &reqwest::Client::new(),
        &models,
        PackKind::Logo,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
    .is_err());
}

#[test]
fn the_voice_engine_has_no_files_and_so_counts_as_installed() {
    let dir = tempfile::tempdir().unwrap();
    assert!(files(PackKind::Voice).is_empty());
    assert!(is_installed(dir.path(), PackKind::Voice));
    assert_eq!(PackKind::Voice.dir(), "voice");
}
