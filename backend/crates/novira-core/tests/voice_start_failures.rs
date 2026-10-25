//! The voice engine when its files or its worker cannot be set up: the libraries step with a report that is missing or
//! not JSON, a folder taken by a file, a worker that cannot be started or that speaks nonsense. The pip report and the
//! Hugging Face listing are also read with entries that lack a field. The usual runs are in `voice_fake_python`.
//! Windows only, like the fake `python` (a batch file).
#![cfg(windows)]
use novira_core::types::{VoiceMode, VoiceParams};
use novira_core::voice::{
    install, libraries_from_report, model_dir, site_dir, wanted_files, QwenVoice, VoiceEngine,
    CUSTOM_VOICE, VOICE_DESIGN,
};
use serde_json::json;
use std::path::{Path, PathBuf};
use tokio_util::sync::CancellationToken;

fn fake_python(dir: &Path, body: &[&str]) -> PathBuf {
    let path = dir.join("python.cmd");
    std::fs::write(&path, format!("@echo off\r\n{}\r\n", body.join("\r\n"))).unwrap();
    path
}

fn models_ready(models: &Path) {
    for m in [&CUSTOM_VOICE, &VOICE_DESIGN] {
        std::fs::create_dir_all(model_dir(models, m)).unwrap();
        std::fs::write(model_dir(models, m).join(".complete"), b"ok").unwrap();
    }
}

fn libraries_ready(data: &Path) {
    std::fs::create_dir_all(site_dir(data)).unwrap();
    std::fs::write(site_dir(data).join(".ready"), b"x").unwrap();
}

fn params() -> VoiceParams {
    VoiceParams {
        text: "hello".into(),
        language: "English".into(),
        mode: VoiceMode::Preset,
        speaker: "Ryan".into(),
        instruct: String::new(),
    }
}

async fn run_install(data: &Path, py: &Path) -> Result<(), String> {
    models_ready(&data.join("models"));
    install(
        &reqwest::Client::new(),
        data,
        &data.join("models"),
        Some(py),
        None,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
}

/// A `python` that answers `pip install --dry-run --report <file>` by writing `report` there (nothing when `None`).
fn pip(data: &Path, report: Option<&str>) -> PathBuf {
    let write = report.map_or(String::new(), |r| {
        format!(r#"if defined OUT echo {r}> "%OUT%""#)
    });
    fake_python(
        data,
        &[
            ":loop",
            r#"if "%~1"=="" goto done"#,
            r#"if "%~1"=="--report" set OUT=%~2"#,
            "shift",
            "goto loop",
            ":done",
            &write,
        ],
    )
}

#[test]
fn entries_without_the_fields_that_are_needed_are_left_out() {
    let report = json!({"install": [
        {"metadata": {"name": "qwen-tts"}},
        {"metadata": {"version": "1"}},
        {"metadata": {"name": "ok", "version": "2"}}
    ]});
    assert_eq!(libraries_from_report(&report), ["ok==2"]);
    let tree = json!([
        {"type": "file", "size": 5},
        {"type": "file", "path": "model.safetensors", "size": 5}
    ]);
    assert_eq!(wanted_files(&tree), [("model.safetensors".to_string(), 5)]);
}

#[tokio::test]
async fn a_pip_report_that_is_missing_or_not_json_stops_the_libraries_step() {
    let data = tempfile::tempdir().unwrap();
    let py = pip(data.path(), None);
    let err = run_install(data.path(), &py).await.unwrap_err();
    assert!(!err.is_empty());

    let data = tempfile::tempdir().unwrap();
    let py = pip(data.path(), Some("this is not json"));
    let err = run_install(data.path(), &py).await.unwrap_err();
    assert!(err.contains("expected") || err.contains("key"), "{err}");
}

#[tokio::test]
async fn a_folder_taken_by_a_file_stops_the_libraries_step() {
    let data = tempfile::tempdir().unwrap();
    // The folder for the libraries cannot be made: its parent is a file.
    std::fs::write(data.path().join("voice"), b"a file").unwrap();
    let py = pip(data.path(), Some("{}"));
    assert!(run_install(data.path(), &py).await.is_err());

    // The marker of a finished install cannot be written: a folder is where the file should go.
    let data = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(site_dir(data.path()).join(".ready")).unwrap();
    let report = r#"{"install":[{"metadata":{"name":"qwen-tts","version":"1"}}]}"#;
    let py = pip(data.path(), Some(report));
    assert!(run_install(data.path(), &py).await.is_err());
}

/// A worker that is installed (models and libraries marked ready) and a voice engine for it.
fn voice(data: &Path, py: &Path) -> QwenVoice {
    models_ready(&data.join("models"));
    libraries_ready(data);
    QwenVoice::new(
        data.to_path_buf(),
        data.join("models"),
        Some(py.to_path_buf()),
        None,
    )
}

async fn speak(voice: &QwenVoice, data: &Path) -> Result<f64, String> {
    voice
        .speak(&params(), &data.join("out.wav"), &CancellationToken::new())
        .await
}

#[tokio::test]
async fn a_worker_that_cannot_be_set_up_is_reported() {
    // Its script path is a folder.
    let data = tempfile::tempdir().unwrap();
    let py = fake_python(data.path(), &["exit /b 0"]);
    let v = voice(data.path(), &py);
    std::fs::create_dir_all(data.path().join("voice").join("worker.py")).unwrap();
    assert!(speak(&v, data.path()).await.is_err());

    // The logs folder is a file.
    let data = tempfile::tempdir().unwrap();
    let py = fake_python(data.path(), &["exit /b 0"]);
    let v = voice(data.path(), &py);
    std::fs::write(data.path().join("logs"), b"a file").unwrap();
    assert!(speak(&v, data.path()).await.is_err());

    // The log file is a folder.
    let data = tempfile::tempdir().unwrap();
    let py = fake_python(data.path(), &["exit /b 0"]);
    let v = voice(data.path(), &py);
    std::fs::create_dir_all(data.path().join("logs").join("voice.log")).unwrap();
    assert!(speak(&v, data.path()).await.is_err());

    // The interpreter is a file that is no program.
    let data = tempfile::tempdir().unwrap();
    let not_a_program = data.path().join("python.exe");
    std::fs::write(&not_a_program, b"this is text").unwrap();
    let v = voice(data.path(), &not_a_program);
    let err = speak(&v, data.path()).await.unwrap_err();
    assert!(err.contains("Cannot start the voice engine"), "{err}");
}

#[tokio::test]
async fn a_worker_that_answers_with_something_that_is_not_json_fails_the_request() {
    let data = tempfile::tempdir().unwrap();
    let py = fake_python(
        data.path(),
        &[
            r#"echo @@NOVIRA@@ this is not json"#,
            "ping -n 5 127.0.0.1 >nul",
        ],
    );
    let v = voice(data.path(), &py);
    let err = speak(&v, data.path()).await.unwrap_err();
    assert!(err.contains("(see logs/voice.log)"), "{err}");
    v.shutdown();
}
