//! What a pack download reports and what it leaves alone: the first file's progress (its place in the pack and its
//! size), and files that are already in the models folder or in a shared folder, which are not downloaded again. The
//! server is a loopback listener that counts requests; the address override is process-wide, so the tests take turns.
use novira_core::packs::{self, install_files_in, PackKind, PackStatus};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

/// Serves `body` for every request; `length` says whether the answer announces its size. Counts the requests.
fn serve(body: Vec<u8>, length: bool) -> (String, Arc<AtomicUsize>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port());
    let hits = Arc::new(AtomicUsize::new(0));
    let counted = hits.clone();
    std::thread::spawn(move || {
        for mut s in listener.incoming().flatten() {
            counted.fetch_add(1, Ordering::SeqCst);
            let body = body.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                let _ = s.read(&mut buf);
                let head = if length {
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    )
                } else {
                    "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n".to_string()
                };
                let _ = s.write_all(head.as_bytes());
                let _ = s.write_all(&body);
            });
        }
    });
    (base, hits)
}

/// The tests take turns: the server address is one setting of the whole process.
static TURN: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn point_at(base: &str) {
    std::env::set_var("NOVIRA_TEST_HUGGINGFACE_BASE", base);
}

fn client() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap()
}

async fn install(models: &std::path::Path, roots: &[PathBuf], kind: PackKind) -> Vec<PackStatus> {
    let seen = Mutex::new(Vec::new());
    install_files_in(
        &client(),
        models,
        roots,
        kind,
        &CancellationToken::new(),
        &|s| seen.lock().unwrap().push(s),
    )
    .await
    .unwrap();
    seen.into_inner().unwrap()
}

#[tokio::test]
async fn the_first_file_is_reported_as_number_one_with_its_announced_size() {
    let _turn = TURN.lock().await;
    // The server announces the size: that is what is shown.
    let (base, _) = serve(vec![1u8; 4000], true);
    point_at(&base);
    let models = tempfile::tempdir().unwrap();
    let seen = install(models.path(), &[], PackKind::Music).await;
    let first = seen.first().expect("progress is reported");
    assert!(
        matches!(
            first,
            PackStatus::Downloading {
                index: 1,
                count: 1,
                total_bytes: 4000,
                ..
            }
        ),
        "{first:?}"
    );
}

#[tokio::test]
async fn a_file_already_in_the_models_folder_or_in_a_shared_folder_is_not_downloaded() {
    let _turn = TURN.lock().await;
    let (base, hits) = serve(vec![1u8; 10], true);
    point_at(&base);
    let file = &packs::files(PackKind::Music)[0];

    // In the models folder only (no shared folder given).
    let models = tempfile::tempdir().unwrap();
    let own = packs::file_path(models.path(), PackKind::Music, file);
    std::fs::create_dir_all(own.parent().unwrap()).unwrap();
    std::fs::write(&own, b"mine").unwrap();
    install(models.path(), &[], PackKind::Music).await;
    assert_eq!(hits.load(Ordering::SeqCst), 0);
    assert_eq!(std::fs::read(&own).unwrap(), b"mine");

    // In a shared folder only: it is read there, and nothing is written to the models folder.
    let models = tempfile::tempdir().unwrap();
    let shared = tempfile::tempdir().unwrap();
    let theirs = packs::file_path(shared.path(), PackKind::Music, file);
    std::fs::create_dir_all(theirs.parent().unwrap()).unwrap();
    std::fs::write(&theirs, b"theirs").unwrap();
    install(
        models.path(),
        &[shared.path().to_path_buf()],
        PackKind::Music,
    )
    .await;
    assert_eq!(hits.load(Ordering::SeqCst), 0);
    assert!(!packs::file_path(models.path(), PackKind::Music, file).exists());
}
