//! The voice engine's rarer paths: a model list that cannot be fetched from Hugging Face (through a proxy that hangs up
//! at once, so nothing real is reached) and a worker that is stopped before it has said it is ready. Windows only, like
//! `voice_fake_python.rs`: the fake Python is a batch file.
#![cfg(windows)]
use novira_core::packs::PackStatus;
use novira_core::types::{VoiceMode, VoiceParams};
use novira_core::voice::{install, model_dir, site_dir, QwenVoice, VoiceEngine, CUSTOM_VOICE};
use std::path::Path;
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

fn fake_python(dir: &Path, body: &[&str]) -> std::path::PathBuf {
    let path = dir.join("python.cmd");
    std::fs::write(&path, format!("@echo off\r\n{}\r\n", body.join("\r\n"))).unwrap();
    path
}

fn libraries_ready(data: &Path) {
    std::fs::create_dir_all(site_dir(data)).unwrap();
    std::fs::write(site_dir(data).join(".ready"), b"x").unwrap();
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
async fn a_model_list_that_cannot_be_fetched_stops_the_install_with_the_reason() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    libraries_ready(data.path());
    let py = fake_python(data.path(), &["exit /b 0"]);
    let seen = Mutex::new(Vec::<PackStatus>::new());
    // Once without and once with a Hugging Face token (it only changes the request, not the failure).
    for token in [None, Some("hf_not_a_real_token")] {
        let result = install(
            &hanging_up_client(),
            data.path(),
            &models,
            Some(&py),
            token,
            &CancellationToken::new(),
            &|s| seen.lock().unwrap().push(s),
        )
        .await;
        let err = result.unwrap_err();
        assert!(err.starts_with("Hugging Face request failed"), "{err}");
        assert!(
            !err.contains("hf_not_a_real_token"),
            "the token stays out of errors"
        );
    }
    assert!(seen.lock().unwrap().is_empty(), "nothing was downloaded");
    assert!(!model_dir(&models, &CUSTOM_VOICE).join(".complete").exists());
}

#[tokio::test]
async fn stopping_before_the_worker_is_ready_cancels_the_request() {
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    for m in [&CUSTOM_VOICE, &novira_core::voice::VOICE_DESIGN] {
        std::fs::create_dir_all(model_dir(&models, m)).unwrap();
        std::fs::write(model_dir(&models, m).join(".complete"), b"ok").unwrap();
    }
    libraries_ready(data.path());
    // A worker that never says it is ready.
    let py = fake_python(data.path(), &["set /p LINE="]);
    let voice = QwenVoice::new(data.path().to_path_buf(), models, Some(py), None);
    let cancel = CancellationToken::new();
    let stopper = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        stopper.cancel();
    });
    let params = VoiceParams {
        text: "hello".into(),
        language: "English".into(),
        mode: VoiceMode::Preset,
        speaker: "Ryan".into(),
        instruct: String::new(),
    };
    let result = voice
        .speak(&params, &data.path().join("out.wav"), &cancel)
        .await;
    assert_eq!(result, Err("cancelled".to_string()));
    voice.shutdown();
}
