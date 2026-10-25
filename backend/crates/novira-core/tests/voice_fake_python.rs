//! The voice engine's install steps and worker handling against a fake `python` (a batch file in a temporary folder), so
//! pip, the worker protocol and the error paths run without Python, a GPU or the network. The models are marked complete
//! up front, so no download is started. Windows only, like the app: the fake is a batch file.
#![cfg(windows)]
use novira_core::packs::PackStatus;
use novira_core::types::{VoiceMode, VoiceParams};
use novira_core::voice::{
    disk_status, install, is_installed, model_dir, resolve_python, site_dir, QwenVoice,
    VoiceEngine, CUSTOM_VOICE, VOICE_DESIGN,
};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

fn fake_python(dir: &Path, body: &[&str]) -> PathBuf {
    let path = dir.join("python.cmd");
    std::fs::write(&path, format!("@echo off\r\n{}\r\n", body.join("\r\n"))).unwrap();
    path
}

/// Marks both models as downloaded, so `install` goes straight past the Hugging Face step.
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

fn params(mode: VoiceMode) -> VoiceParams {
    VoiceParams {
        text: "hello".into(),
        language: "English".into(),
        mode,
        speaker: "Ryan".into(),
        instruct: String::new(),
    }
}

async fn run_install(
    data: &Path,
    models: &Path,
    python: Option<&Path>,
    cancel: &CancellationToken,
) -> (Result<(), String>, Vec<PackStatus>) {
    let seen = Mutex::new(Vec::new());
    let result = install(
        &reqwest::Client::new(),
        data,
        models,
        python,
        None,
        cancel,
        &|s| seen.lock().unwrap().push(s),
    )
    .await;
    (result, seen.into_inner().unwrap())
}

/// Answers `pip install --dry-run --report <file>` with `report`, and every other pip call with nothing.
fn pip_script(report_json: &str) -> Vec<String> {
    vec![
        ":loop".into(),
        r#"if "%~1"=="" goto done"#.into(),
        r#"if "%~1"=="--report" set OUT=%~2"#.into(),
        "shift".into(),
        "goto loop".into(),
        ":done".into(),
        format!(r#"if defined OUT echo {report_json}> "%OUT%""#),
    ]
}

// Choosing the interpreter ----------------------------------------------------------------------------------------

#[test]
fn the_explicit_python_wins_but_only_when_it_exists() {
    let dir = tempfile::tempdir().unwrap();
    let py = fake_python(dir.path(), &["exit /b 0"]);
    assert_eq!(resolve_python(Some(&py), None), Some(py.clone()));
    assert_eq!(resolve_python(Some(&dir.path().join("nope")), None), None);
    assert_eq!(resolve_python(None, None), None);
}

// Installing the libraries ----------------------------------------------------------------------------------------

#[tokio::test]
async fn install_needs_the_image_engines_python() {
    let data = tempfile::tempdir().unwrap();
    let (result, seen) = run_install(
        data.path(),
        &data.path().join("models"),
        None,
        &CancellationToken::new(),
    )
    .await;
    assert!(result.unwrap_err().contains("image engine's Python"));
    assert!(seen.is_empty());
}

#[tokio::test]
async fn install_pins_the_libraries_from_the_pip_report_and_marks_them_ready() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    models_ready(&models);
    let report = r#"{"install":[{"metadata":{"name":"qwen-tts","version":"0.1.1"}},{"metadata":{"name":"gradio","version":"6"}},{"metadata":{"name":"narwhals","version":"2.0"}}]}"#;
    let lines = pip_script(report);
    let py = fake_python(
        data.path(),
        &lines.iter().map(String::as_str).collect::<Vec<_>>(),
    );
    let (result, seen) =
        run_install(data.path(), &models, Some(&py), &CancellationToken::new()).await;
    assert_eq!(result, Ok(()));
    assert_eq!(
        seen,
        [PackStatus::Installing {
            step: "libraries".into()
        }]
    );
    // The demo-only library is left out; the others are pinned.
    let ready = std::fs::read_to_string(site_dir(data.path()).join(".ready")).unwrap();
    assert_eq!(ready, "qwen-tts==0.1.1\nnarwhals==2.0");
    assert!(!site_dir(data.path()).join("report.json").exists());
    assert!(is_installed(data.path(), &models));
    assert_eq!(disk_status(data.path(), &models), PackStatus::Ready);
}

#[tokio::test]
async fn install_is_a_no_op_when_everything_is_in_place() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    models_ready(&models);
    libraries_ready(data.path());
    // A Python that would fail proves pip is not run again.
    let py = fake_python(data.path(), &["exit /b 1"]);
    let (result, seen) =
        run_install(data.path(), &models, Some(&py), &CancellationToken::new()).await;
    assert_eq!(result, Ok(()));
    assert!(seen.is_empty());
}

#[tokio::test]
async fn install_stops_when_pip_does_not_know_qwen_tts() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    models_ready(&models);
    let lines = pip_script(r#"{"install":[{"metadata":{"name":"narwhals","version":"2.0"}}]}"#);
    let py = fake_python(
        data.path(),
        &lines.iter().map(String::as_str).collect::<Vec<_>>(),
    );
    let (result, _) = run_install(data.path(), &models, Some(&py), &CancellationToken::new()).await;
    assert!(result.unwrap_err().contains("Could not work out"));
    assert!(!site_dir(data.path()).join(".ready").exists());
}

#[tokio::test]
async fn a_failing_pip_reports_the_last_lines_of_its_error() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    models_ready(&models);
    let py = fake_python(
        data.path(),
        &[
            "echo line one 1>&2",
            "echo line two 1>&2",
            "echo no matching distribution 1>&2",
            "exit /b 1",
        ],
    );
    let (result, _) = run_install(data.path(), &models, Some(&py), &CancellationToken::new()).await;
    let err = result.unwrap_err();
    assert!(
        err.starts_with("Installing the voice libraries failed"),
        "{err}"
    );
    assert!(err.contains("no matching distribution"), "{err}");
    assert!(!site_dir(data.path()).join(".ready").exists());
}

#[tokio::test]
async fn install_can_be_cancelled_before_pip_answers() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    models_ready(&models);
    let py = fake_python(data.path(), &["ping -n 30 127.0.0.1 >nul"]);
    let cancel = CancellationToken::new();
    cancel.cancel();
    let (result, _) = run_install(data.path(), &models, Some(&py), &cancel).await;
    assert_eq!(result, Err("cancelled".to_string()));
}

#[tokio::test]
async fn a_python_that_cannot_run_is_reported() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    models_ready(&models);
    // A file that is not a program.
    let not_a_program = data.path().join("python.txt");
    std::fs::write(&not_a_program, "x").unwrap();
    let (result, _) = run_install(
        data.path(),
        &models,
        Some(&not_a_program),
        &CancellationToken::new(),
    )
    .await;
    assert!(result.unwrap_err().contains("Cannot run Python"));
}

// Reading aloud ---------------------------------------------------------------------------------------------------

/// A worker that says "ready" and answers every request with its running number as `id`.
fn worker_script(answer: &str) -> Vec<String> {
    vec![
        "setlocal enabledelayedexpansion".into(),
        r#"echo @@NOVIRA@@ {"ready":true}"#.into(),
        "set N=0".into(),
        ":loop".into(),
        "set LINE=".into(),
        "set /p LINE=".into(),
        "if not defined LINE goto end".into(),
        "set /a N+=1".into(),
        answer.to_string(),
        "goto loop".into(),
        ":end".into(),
    ]
}

fn voice_in(data: &Path, py: &Path) -> (QwenVoice, PathBuf) {
    let models = data.join("models");
    models_ready(&models);
    libraries_ready(data);
    (
        QwenVoice::new(data.to_path_buf(), models, Some(py.to_path_buf()), None),
        data.join("out.wav"),
    )
}

#[tokio::test]
async fn the_worker_answers_each_request_and_the_length_comes_back() {
    let data = tempfile::tempdir().unwrap();
    let lines = worker_script(r#"echo @@NOVIRA@@ {"id":!N!,"ok":true,"seconds":1.5}"#);
    let py = fake_python(
        data.path(),
        &lines.iter().map(String::as_str).collect::<Vec<_>>(),
    );
    let (voice, out) = voice_in(data.path(), &py);
    let cancel = CancellationToken::new();
    // The same worker serves both requests (ids 1 and 2).
    assert_eq!(
        voice.speak(&params(VoiceMode::Preset), &out, &cancel).await,
        Ok(1.5)
    );
    assert_eq!(
        voice.speak(&params(VoiceMode::Design), &out, &cancel).await,
        Ok(1.5)
    );
    // The worker script is written next to the libraries, and its output goes to a log.
    assert!(data.path().join("voice").join("worker.py").is_file());
    assert!(data.path().join("logs").join("voice.log").is_file());
    voice.shutdown();
}

#[tokio::test]
async fn a_failed_synthesis_gives_the_workers_error() {
    let data = tempfile::tempdir().unwrap();
    let lines = worker_script(r#"echo @@NOVIRA@@ {"id":!N!,"ok":false,"error":"out of memory"}"#);
    let py = fake_python(
        data.path(),
        &lines.iter().map(String::as_str).collect::<Vec<_>>(),
    );
    let (voice, out) = voice_in(data.path(), &py);
    let err = voice
        .speak(&params(VoiceMode::Preset), &out, &CancellationToken::new())
        .await
        .unwrap_err();
    assert_eq!(err, "out of memory");
    voice.shutdown();
}

#[tokio::test]
async fn an_error_without_text_gets_a_general_message() {
    let data = tempfile::tempdir().unwrap();
    let lines = worker_script(r#"echo @@NOVIRA@@ {"id":!N!,"ok":false}"#);
    let py = fake_python(
        data.path(),
        &lines.iter().map(String::as_str).collect::<Vec<_>>(),
    );
    let (voice, out) = voice_in(data.path(), &py);
    let err = voice
        .speak(&params(VoiceMode::Preset), &out, &CancellationToken::new())
        .await
        .unwrap_err();
    assert_eq!(err, "The voice engine failed");
    voice.shutdown();
}

#[tokio::test]
async fn lines_without_the_marker_and_answers_to_other_requests_are_skipped() {
    let data = tempfile::tempdir().unwrap();
    // Chatter, then an answer for another id, then the real one.
    let lines = worker_script(
        r#"echo loading weights& echo @@NOVIRA@@ {"id":99,"ok":true,"seconds":9}& echo @@NOVIRA@@ {"id":!N!,"ok":true,"seconds":2.25}"#,
    );
    let py = fake_python(
        data.path(),
        &lines.iter().map(String::as_str).collect::<Vec<_>>(),
    );
    let (voice, out) = voice_in(data.path(), &py);
    let seconds = voice
        .speak(&params(VoiceMode::Preset), &out, &CancellationToken::new())
        .await;
    assert_eq!(seconds, Ok(2.25));
    voice.shutdown();
}

#[tokio::test]
async fn a_worker_that_dies_is_reported_with_the_log_hint() {
    let data = tempfile::tempdir().unwrap();
    let py = fake_python(data.path(), &["exit /b 1"]);
    let (voice, out) = voice_in(data.path(), &py);
    let err = voice
        .speak(&params(VoiceMode::Preset), &out, &CancellationToken::new())
        .await
        .unwrap_err();
    assert!(err.contains("The voice engine stopped"), "{err}");
    assert!(err.contains("voice.log"), "{err}");
}

#[tokio::test]
async fn a_worker_that_starts_with_something_else_is_refused() {
    let data = tempfile::tempdir().unwrap();
    let py = fake_python(
        data.path(),
        &[r#"echo @@NOVIRA@@ {"hello":1}"#, "ping -n 5 127.0.0.1 >nul"],
    );
    let (voice, out) = voice_in(data.path(), &py);
    let err = voice
        .speak(&params(VoiceMode::Preset), &out, &CancellationToken::new())
        .await
        .unwrap_err();
    assert!(err.contains("Unexpected start-up message"), "{err}");
}

#[tokio::test]
async fn cancelling_while_the_worker_is_busy_stops_it_and_the_next_request_starts_a_new_one() {
    let data = tempfile::tempdir().unwrap();
    // The first request is never answered (the worker waits for more input); a second worker would answer. The marker file tells them apart.
    let lines = [
        "setlocal enabledelayedexpansion".to_string(),
        r#"echo @@NOVIRA@@ {"ready":true}"#.to_string(),
        "set LINE=".to_string(),
        "set /p LINE=".to_string(),
        r#"if exist "%~dp0second.flag" ("#.to_string(),
        r#"  echo @@NOVIRA@@ {"id":2,"ok":true,"seconds":3}"#.to_string(),
        ") else (".to_string(),
        r#"  echo x> "%~dp0second.flag""#.to_string(),
        "  set /p LINE=".to_string(),
        ")".to_string(),
    ];
    let py = fake_python(
        data.path(),
        &lines.iter().map(String::as_str).collect::<Vec<_>>(),
    );
    let (voice, out) = voice_in(data.path(), &py);
    let cancel = CancellationToken::new();
    let stopper = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
        stopper.cancel();
    });
    let first = voice.speak(&params(VoiceMode::Preset), &out, &cancel).await;
    assert_eq!(first, Err("cancelled".to_string()));
    let second = voice
        .speak(&params(VoiceMode::Preset), &out, &CancellationToken::new())
        .await;
    assert_eq!(second, Ok(3.0));
    voice.shutdown();
}

#[tokio::test]
async fn speaking_without_python_or_without_the_install_says_what_is_missing() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    let none = QwenVoice::new(data.path().to_path_buf(), models.clone(), None, None);
    let err = none
        .speak(
            &params(VoiceMode::Preset),
            &data.path().join("o.wav"),
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert!(err.contains("image engine's Python"), "{err}");

    let py = fake_python(data.path(), &["exit /b 0"]);
    let not_installed = QwenVoice::new(data.path().to_path_buf(), models, Some(py), None);
    let err = not_installed
        .speak(
            &params(VoiceMode::Preset),
            &data.path().join("o.wav"),
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert!(err.contains("not installed yet"), "{err}");
}
