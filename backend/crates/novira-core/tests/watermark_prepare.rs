//! `Tools::prepare` of the export watermark: nothing to fetch, a second call while one runs, progress that ends in a
//! hash failure, and a cancel. The files themselves are covered in `watermark_download_fake.rs`.
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::provenance::{files, Tools};
use novira_core::types::WatermarkStatus;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn nothing_is_fetched_when_every_file_is_on_the_pc() {
    let _ = site();
    let dir = tempfile::tempdir().unwrap();
    let folder = files::download_dir(dir.path());
    std::fs::create_dir_all(&folder).unwrap();
    // The check is by size, so empty files of the pinned sizes stand for the real ones.
    for f in files::pinned() {
        let file = std::fs::File::create(folder.join(&f.name)).unwrap();
        file.set_len(f.bytes).unwrap();
    }
    let tools = Tools::new(None, dir.path());
    assert_eq!(tools.status(), WatermarkStatus::Ready);
    // Even a stale status is corrected.
    tools.prepare(&client(), &CancellationToken::new()).await;
    assert_eq!(tools.status(), WatermarkStatus::Ready);
}

#[tokio::test]
async fn a_second_prepare_while_one_runs_does_nothing_and_a_bad_download_is_a_failure() {
    let site = site();
    let dir = tempfile::tempdir().unwrap();
    let first = &files::pinned()[0];
    // Wrong bytes for the first file: they arrive (progress is reported) and then fail the hash.
    site.put(&first.path, Route::bytes(vec![7u8; 4096]));
    let tools = Tools::new(None, dir.path());
    assert_eq!(tools.status(), WatermarkStatus::Missing);
    let http = client();
    let cancel = CancellationToken::new();
    tokio::join!(tools.prepare(&http, &cancel), tools.prepare(&http, &cancel));
    match tools.status() {
        WatermarkStatus::Failed { message } => assert!(!message.is_empty()),
        other => panic!("{other:?}"),
    }
    assert!(!site.requests(&first.path).is_empty());
}

#[tokio::test]
async fn a_cancelled_download_goes_back_to_missing() {
    let site = site();
    let dir = tempfile::tempdir().unwrap();
    let first = &files::pinned()[0];
    site.put(&first.path, Route::bytes(vec![7u8; 4096]));
    let tools = Tools::new(None, dir.path());
    let cancel = CancellationToken::new();
    cancel.cancel();
    tools.prepare(&client(), &cancel).await;
    assert_eq!(tools.status(), WatermarkStatus::Missing);
}
