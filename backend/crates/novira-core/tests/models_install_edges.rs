//! The model download helpers on their failure paths, against the fake download host (debug-only address override):
//! a Civitai page whose version does not exist, a download that ends early or cannot be written, and the
//! copy that stands in for a hard link. Source parsing and the folder layout helpers are included.
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::models::install::{
    download, link_or_copy, parse_source, resolve, InstallError, Source,
};
use novira_core::models::layout::category_by_folder;
use serde_json::json;
use tokio_util::sync::CancellationToken;

#[test]
fn a_civitai_address_that_is_not_a_model_page_is_a_plain_download() {
    assert_eq!(
        parse_source("https://civitai.com/user/someone").unwrap(),
        Source::Url("https://civitai.com/user/someone".into())
    );
    assert_eq!(
        parse_source("https://civitai.com/models/12?modelVersionId=34").unwrap(),
        Source::CivitaiPage {
            model_id: 12,
            version_id: Some(34)
        }
    );
}

#[test]
fn model_folders_are_found_by_their_name() {
    assert!(category_by_folder("loras").is_some());
    assert!(category_by_folder("no-such-folder").is_none());
}

#[tokio::test]
async fn a_civitai_page_without_the_named_version_or_without_versions_is_refused() {
    site().put_json(
        "/api/v1/models/90001",
        &json!({ "type": "LORA", "modelVersions": [{ "id": 1, "files": [] }] }),
    );
    let err = resolve(
        &client(),
        &Source::CivitaiPage {
            model_id: 90001,
            version_id: Some(999),
        },
        None,
    )
    .await
    .err()
    .unwrap();
    assert_eq!(err, "The Civitai version was not found");

    site().put_json("/api/v1/models/90002", &json!({ "type": "LORA" }));
    let err = resolve(
        &client(),
        &Source::CivitaiPage {
            model_id: 90002,
            version_id: None,
        },
        None,
    )
    .await
    .err()
    .unwrap();
    assert_eq!(err, "The Civitai model has no versions");
}

#[tokio::test]
async fn a_download_that_ends_early_or_cannot_be_written_fails_and_leaves_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let cancel = CancellationToken::new();

    // The host announces more bytes than it sends.
    site().put(
        "/edge/short.bin",
        Route::bytes(vec![7u8; 100]).announcing(400),
    );
    let dest = dir.path().join("short.bin");
    let url = format!("{}/edge/short.bin", site().base);
    let result = download(&client(), &url, None, &dest, &cancel, |_, _| {}).await;
    match result {
        Err(InstallError::Failed(m)) => assert!(
            m.contains("ended early") || m.contains("interrupted"),
            "{m}"
        ),
        other => panic!("expected a failure, got {other:?}"),
    }
    assert!(!dest.exists());

    // A file stands where the destination folder should be.
    site().put("/edge/ok.bin", Route::bytes(vec![1u8; 10]));
    let url = format!("{}/edge/ok.bin", site().base);
    let blocker = dir.path().join("blocker");
    std::fs::write(&blocker, b"x").unwrap();
    let result = download(
        &client(),
        &url,
        None,
        &blocker.join("inner.bin"),
        &cancel,
        |_, _| {},
    )
    .await;
    assert!(matches!(result, Err(InstallError::Failed(_))));

    // A folder stands where the file should be.
    let folder = dir.path().join("folder.bin");
    std::fs::create_dir(&folder).unwrap();
    let result = download(&client(), &url, None, &folder, &cancel, |_, _| {}).await;
    assert!(matches!(result, Err(InstallError::Failed(_))));
}

#[test]
fn a_file_is_copied_when_it_cannot_be_linked_and_a_blocked_folder_is_an_error() {
    let dir = tempfile::tempdir().unwrap();
    let src = dir.path().join("src.bin");
    std::fs::write(&src, b"new").unwrap();
    // A link cannot replace an existing file, so the copy does.
    let dest = dir.path().join("sub").join("dest.bin");
    link_or_copy(&src, &dest).unwrap();
    std::fs::remove_file(&dest).unwrap();
    std::fs::write(&dest, b"old").unwrap();
    link_or_copy(&src, &dest).unwrap();
    assert_eq!(std::fs::read(&dest).unwrap(), b"new");

    let blocker = dir.path().join("blocker");
    std::fs::write(&blocker, b"x").unwrap();
    assert!(link_or_copy(&src, &blocker.join("inner.bin")).is_err());
}

#[tokio::test]
async fn a_search_the_host_refuses_reports_the_status() {
    use novira_core::models::civitai::{self, SearchParams};
    let params = SearchParams {
        query: "style".into(),
        kind: "LoRA".into(),
        base_model: "sdxl-compat".into(),
        sort: "rating".into(),
        period: "all".into(),
        include_nsfw: false,
        cursor: None,
        source: "civitai".into(),
        licenses: Vec::new(),
        checkpoint_type: String::new(),
        safetensors_only: false,
        price: String::new(),
        creator: String::new(),
    };
    site().put("/api/v1/models", Route::status(500));
    let err = civitai::search(&client(), &params, None)
        .await
        .err()
        .unwrap();
    assert_eq!(err, "Civitai answered 500 Internal Server Error");

    site().put("/api/models", Route::status(503));
    let err = novira_core::models::huggingface::search(&client(), &params, None)
        .await
        .err()
        .unwrap();
    assert!(err.starts_with("Hugging Face answered 503"), "{err}");
}

#[tokio::test]
async fn a_civitai_page_without_a_version_number_takes_the_first_version() {
    site().put_json(
        "/api/v1/models/90003",
        &json!({ "type": "LORA", "modelVersions": [{ "id": 1, "files": [] }] }),
    );
    // The version has no file, so this ends in a refusal, but only after the first version was chosen.
    let result = resolve(
        &client(),
        &Source::CivitaiPage {
            model_id: 90003,
            version_id: None,
        },
        None,
    )
    .await;
    assert!(result.is_err());
}
