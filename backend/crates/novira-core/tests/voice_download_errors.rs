//! The voice models' download going wrong, against the fake download host (debug-only address override): a file
//! the host does not have, a stop requested during the download, and a place on disk that cannot take a file. One test
//! runs the cases one after another because the fake host's routes are shared by the whole test binary. Windows only,
//! like the fake `python` it needs.
#![cfg(windows)]
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::voice::{
    install, model_dir, site_dir, QwenVoice, VoiceEngine, CUSTOM_VOICE, VOICE_DESIGN,
};
use std::path::Path;
use tokio_util::sync::CancellationToken;

fn serve(files: &[(&str, &str)]) {
    let mut tree = Vec::new();
    for (path, body) in files {
        tree.push(serde_json::json!({"type": "file", "path": path, "size": body.len()}));
        site().put(
            &format!("/{}/resolve/main/{path}", CUSTOM_VOICE.repo),
            Route::bytes(*body),
        );
    }
    site().put_json(
        &format!("/api/models/{}/tree/main", CUSTOM_VOICE.repo),
        &serde_json::Value::Array(tree),
    );
    site().put_json(
        &format!("/api/models/{}/tree/main", VOICE_DESIGN.repo),
        &serde_json::json!([]),
    );
}

async fn run(data: &Path, models: &Path, cancel: &CancellationToken) -> Result<(), String> {
    let python = data.join("python.cmd");
    std::fs::write(&python, "@echo off\r\nexit /b 0\r\n").unwrap();
    std::fs::create_dir_all(site_dir(data)).unwrap();
    std::fs::write(site_dir(data).join(".ready"), b"x").unwrap();
    install(
        &client(),
        data,
        models,
        Some(&python),
        None,
        cancel,
        &|_| {},
    )
    .await
}

#[tokio::test]
async fn a_voice_model_download_that_goes_wrong_says_why_and_leaves_no_complete_mark() {
    // A file the host lists but does not serve.
    let data = tempfile::tempdir().unwrap();
    let models = tempfile::tempdir().unwrap();
    serve(&[("config.json", "{}")]);
    site().put(
        &format!("/{}/resolve/main/config.json", CUSTOM_VOICE.repo),
        Route::status(404),
    );
    let err = run(data.path(), models.path(), &CancellationToken::new())
        .await
        .unwrap_err();
    assert_ne!(err, "cancelled");
    assert!(!model_dir(models.path(), &CUSTOM_VOICE)
        .join(".complete")
        .exists());

    // A stop requested before the file starts.
    let data = tempfile::tempdir().unwrap();
    let models = tempfile::tempdir().unwrap();
    serve(&[("config.json", "{}")]);
    let cancel = CancellationToken::new();
    cancel.cancel();
    let err = run(data.path(), models.path(), &cancel).await.unwrap_err();
    assert_eq!(err, "cancelled");

    // A folder cannot be made for a file in a sub-folder because a file has the folder's name.
    let data = tempfile::tempdir().unwrap();
    let models = tempfile::tempdir().unwrap();
    serve(&[("sub/weights.bin", "weights")]);
    let root = model_dir(models.path(), &CUSTOM_VOICE);
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("sub"), b"in the way").unwrap();
    assert!(run(data.path(), models.path(), &CancellationToken::new())
        .await
        .is_err());

    // The finished file cannot be moved into place because a non-empty folder has its name.
    let data = tempfile::tempdir().unwrap();
    let models = tempfile::tempdir().unwrap();
    serve(&[("weights.bin", "weights")]);
    let root = model_dir(models.path(), &CUSTOM_VOICE);
    std::fs::create_dir_all(root.join("weights.bin")).unwrap();
    std::fs::write(root.join("weights.bin").join("inner"), b"x").unwrap();
    assert!(run(data.path(), models.path(), &CancellationToken::new())
        .await
        .is_err());

    // The default `shutdown` of an engine does nothing, and the real one is safe without a worker.
    QwenVoice::new(
        data.path().to_path_buf(),
        models.path().to_path_buf(),
        None,
        None,
    )
    .shutdown();
    struct Silent;
    #[async_trait::async_trait]
    impl VoiceEngine for Silent {
        async fn speak(
            &self,
            _params: &novira_core::types::VoiceParams,
            _out: &Path,
            _cancel: &CancellationToken,
        ) -> Result<f64, String> {
            Ok(0.0)
        }
    }
    Silent.shutdown();
}
