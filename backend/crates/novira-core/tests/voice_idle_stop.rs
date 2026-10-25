//! The voice worker stopping by itself after it has been idle. A debug build of the library lets the test shorten the
//! idle time (`NOVIRA_TEST_VOICE_IDLE_MS`); the fake `python` notes every start of the worker in a file, so a second
//! start shows that the first worker was stopped. This test sets the variable for its whole process, so it is the only
//! test in this file. Windows only, like the fake `python`.
#![cfg(windows)]
use novira_core::types::{VoiceMode, VoiceParams};
use novira_core::voice::{model_dir, site_dir, QwenVoice, VoiceEngine, CUSTOM_VOICE, VOICE_DESIGN};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn an_idle_worker_is_stopped_and_the_next_request_starts_a_new_one() {
    std::env::set_var("NOVIRA_TEST_VOICE_IDLE_MS", "300");
    let data = tempfile::tempdir().unwrap();
    let models = data.path().join("models");
    for m in [&CUSTOM_VOICE, &VOICE_DESIGN] {
        std::fs::create_dir_all(model_dir(&models, m)).unwrap();
        std::fs::write(model_dir(&models, m).join(".complete"), b"ok").unwrap();
    }
    std::fs::create_dir_all(site_dir(data.path())).unwrap();
    std::fs::write(site_dir(data.path()).join(".ready"), b"x").unwrap();
    let script = [
        "@echo off",
        "setlocal enabledelayedexpansion",
        r#"echo x>>"%~dp0starts.txt""#,
        r#"echo @@NOVIRA@@ {"ready":true}"#,
        // The request numbers go on across workers, so the answers keep matching the requests.
        "set N=0",
        r#"if exist "%~dp0n.txt" set /p N=<"%~dp0n.txt""#,
        ":loop",
        "set LINE=",
        "set /p LINE=",
        "if not defined LINE goto end",
        "set /a N+=1",
        r#"echo !N!>"%~dp0n.txt""#,
        r#"echo @@NOVIRA@@ {"id":!N!,"ok":true,"seconds":1.0}"#,
        "goto loop",
        ":end",
    ];
    let py = data.path().join("python.cmd");
    std::fs::write(&py, format!("{}\r\n", script.join("\r\n"))).unwrap();
    let voice = QwenVoice::new(data.path().to_path_buf(), models, Some(py), None);
    let params = VoiceParams {
        text: "hello".into(),
        language: "English".into(),
        mode: VoiceMode::Preset,
        speaker: "Ryan".into(),
        instruct: String::new(),
    };
    let out = data.path().join("out.wav");
    let cancel = CancellationToken::new();
    assert_eq!(voice.speak(&params, &out, &cancel).await, Ok(1.0));
    // Longer than the idle time plus a check.
    tokio::time::sleep(Duration::from_millis(1200)).await;
    assert_eq!(voice.speak(&params, &out, &cancel).await, Ok(1.0));
    let starts = std::fs::read_to_string(data.path().join("starts.txt")).unwrap();
    assert_eq!(
        starts.lines().count(),
        2,
        "the idle worker was stopped: {starts:?}"
    );
    voice.shutdown();
}
