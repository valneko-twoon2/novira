//! The voice worker while a request is in progress: the idle timer never stops a worker that is busy (even when the last
//! request ended longer ago than the idle time), and closing the app does not wait for a busy worker. The idle time is
//! shortened for the whole process (`NOVIRA_TEST_VOICE_IDLE_MS`, debug builds only), which is why these two tests share a
//! file of their own. Windows only, like the fake `python`.
#![cfg(windows)]
use novira_core::types::{VoiceMode, VoiceParams};
use novira_core::voice::{model_dir, site_dir, QwenVoice, VoiceEngine, CUSTOM_VOICE, VOICE_DESIGN};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// A worker that needs about a second for every request.
fn slow_voice(data: &Path) -> QwenVoice {
    std::env::set_var("NOVIRA_TEST_VOICE_IDLE_MS", "100");
    let models = data.join("models");
    for m in [&CUSTOM_VOICE, &VOICE_DESIGN] {
        std::fs::create_dir_all(model_dir(&models, m)).unwrap();
        std::fs::write(model_dir(&models, m).join(".complete"), b"ok").unwrap();
    }
    std::fs::create_dir_all(site_dir(data)).unwrap();
    std::fs::write(site_dir(data).join(".ready"), b"x").unwrap();
    let script = [
        "@echo off",
        "setlocal enabledelayedexpansion",
        r#"echo @@NOVIRA@@ {"ready":true}"#,
        "set N=0",
        ":loop",
        "set LINE=",
        "set /p LINE=",
        "if not defined LINE goto end",
        "set /a N+=1",
        "ping -n 2 127.0.0.1 >nul",
        r#"echo @@NOVIRA@@ {"id":!N!,"ok":true,"seconds":1.0}"#,
        "goto loop",
        ":end",
    ];
    let py = data.join("python.cmd");
    std::fs::write(&py, format!("{}\r\n", script.join("\r\n"))).unwrap();
    QwenVoice::new(data.to_path_buf(), models, Some(py), None)
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

#[tokio::test]
async fn a_worker_that_is_busy_is_not_stopped_by_the_idle_timer() {
    let data = tempfile::tempdir().unwrap();
    let voice = slow_voice(data.path());
    let out = data.path().join("out.wav");
    let cancel = CancellationToken::new();
    assert_eq!(voice.speak(&params(), &out, &cancel).await, Ok(1.0));
    // The next request starts at once and takes longer than the idle time: the timer finds the worker idle by the
    // clock and busy by its lock, and leaves it alone.
    assert_eq!(voice.speak(&params(), &out, &cancel).await, Ok(1.0));
    voice.shutdown();
}

#[tokio::test]
async fn closing_the_app_does_not_wait_for_a_worker_that_is_busy() {
    let data = tempfile::tempdir().unwrap();
    let voice = Arc::new(slow_voice(data.path()));
    let out = data.path().join("out.wav");
    let running = {
        let voice = voice.clone();
        tokio::spawn(async move {
            voice
                .speak(&params(), &out, &CancellationToken::new())
                .await
        })
    };
    tokio::time::sleep(Duration::from_millis(500)).await;
    // The request holds the worker: shutdown returns at once and the request still finishes.
    voice.shutdown();
    assert_eq!(running.await.unwrap(), Ok(1.0));
    voice.shutdown();
}
