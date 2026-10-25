//! The error and cancel paths of installing a custom node pack, without the network: every request goes through a proxy
//! that refuses all connections, or the token is cancelled before the download starts. The successful path needs
//! GitHub and is covered by `node_packs_live`.
use novira_core::comfy::node_packs::{custom_nodes_dir, install, parse_github};
use novira_core::packs::PackStatus;
use std::path::Path;
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

fn offline_client() -> reqwest::Client {
    reqwest::Client::builder()
        .proxy(reqwest::Proxy::all("http://127.0.0.1:1").unwrap())
        .build()
        .unwrap()
}

async fn run(
    comfy: &Path,
    cancel: &CancellationToken,
) -> (Result<String, String>, Vec<PackStatus>) {
    let repo = parse_github("https://github.com/owner/some-pack").unwrap();
    let seen = Mutex::new(Vec::new());
    let result = install(
        &offline_client(),
        &repo,
        comfy,
        Path::new("python-that-is-never-run"),
        &comfy.join("data"),
        cancel,
        &|s| seen.lock().unwrap().push(s),
    )
    .await;
    (result, seen.into_inner().unwrap())
}

fn leftovers(comfy: &Path) -> Vec<String> {
    std::fs::read_dir(custom_nodes_dir(comfy))
        .map(|d| {
            d.flatten()
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default()
}

#[tokio::test]
async fn a_failed_download_is_an_error_and_leaves_nothing_behind() {
    let comfy = tempfile::tempdir().unwrap();
    let (result, seen) = run(comfy.path(), &CancellationToken::new()).await;
    assert!(result.unwrap_err().contains("Download failed"));
    assert!(seen.is_empty());
    assert!(
        leftovers(comfy.path()).is_empty(),
        "the work folder is removed"
    );
}

#[tokio::test]
async fn a_cancelled_install_says_so() {
    let comfy = tempfile::tempdir().unwrap();
    let cancel = CancellationToken::new();
    cancel.cancel();
    let (result, _) = run(comfy.path(), &cancel).await;
    assert_eq!(result, Err("cancelled".to_string()));
    assert!(leftovers(comfy.path()).is_empty());
}

#[tokio::test]
async fn an_unwritable_custom_nodes_folder_is_an_error() {
    let comfy = tempfile::tempdir().unwrap();
    // A file where the folder should be.
    std::fs::write(custom_nodes_dir(comfy.path()), "not a folder").unwrap();
    let (result, _) = run(comfy.path(), &CancellationToken::new()).await;
    assert!(result.is_err());
}
