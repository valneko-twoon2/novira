//! Model packs and custom node packs through the backend: status, installing in the background, cancelling and
//! removing. The voice pack runs against a fake `python` (a batch file); the file packs have every file in place or are
//! cancelled before the first download, so nothing touches the network. Windows only, like the fake interpreter.
#![cfg(windows)]
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::packs::{self, PackKind, PackStatus};
use novira_core::types::BackendEvent;
use novira_core::voice::{model_dir, site_dir, QwenVoice, CUSTOM_VOICE, VOICE_DESIGN};
use novira_core::{Backend, BackendConfig, Settings};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[derive(Default)]
struct Engine0 {
    restarts: Mutex<u32>,
}

#[async_trait::async_trait]
impl Engine for Engine0 {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Ok(EngineOutput::Nothing)
    }

    async fn restart(&self, _cancel: &CancellationToken) -> Result<(), EngineError> {
        *self.restarts.lock().unwrap() += 1;
        Ok(())
    }
}

type Events = Arc<Mutex<Vec<BackendEvent>>>;

fn fake_python(dir: &Path, body: &[&str]) -> PathBuf {
    let path = dir.join("python.cmd");
    std::fs::write(&path, format!("@echo off\r\n{}\r\n", body.join("\r\n"))).unwrap();
    path
}

/// A backend in `dir` whose ComfyUI folder is `dir/comfy` and whose Python is `python`, if any.
fn open(dir: &Path, python: Option<PathBuf>) -> (Backend, Events, Arc<Engine0>) {
    let engine = Arc::new(Engine0::default());
    let voice = Arc::new(QwenVoice::new(
        dir.to_path_buf(),
        dir.join("models"),
        None,
        None,
    ));
    let backend = Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        engine.clone(),
        voice,
        (python, Some(dir.join("comfy"))),
    )
    .unwrap();
    let events: Events = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    (backend, events, engine)
}

async fn wait_until(mut f: impl FnMut() -> bool) {
    for _ in 0..400 {
        if f() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
    panic!("timed out");
}

fn pack_events(events: &Events, kind: PackKind) -> Vec<PackStatus> {
    events
        .lock()
        .unwrap()
        .iter()
        .filter_map(|e| match e {
            BackendEvent::Pack { kind: k, status } if *k == kind => Some(status.clone()),
            _ => None,
        })
        .collect()
}

fn node_pack_events(events: &Events) -> Vec<(String, PackStatus)> {
    events
        .lock()
        .unwrap()
        .iter()
        .filter_map(|e| match e {
            BackendEvent::NodePack { url, status } => Some((url.clone(), status.clone())),
            _ => None,
        })
        .collect()
}

fn write_all(models: &Path, kind: PackKind) {
    for f in packs::files(kind) {
        let p = packs::file_path(models, kind, f);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(&p, b"x").unwrap();
    }
}

fn models_ready(models: &Path) {
    for m in [&CUSTOM_VOICE, &VOICE_DESIGN] {
        std::fs::create_dir_all(model_dir(models, m)).unwrap();
        std::fs::write(model_dir(models, m).join(".complete"), b"ok").unwrap();
    }
}

// Model packs ------------------------------------------------------------------------------------------------------

#[tokio::test]
async fn packs_start_as_missing_and_follow_the_files_on_disk() {
    let dir = tempfile::tempdir().unwrap();
    write_all(&dir.path().join("models"), PackKind::Music);
    let (backend, _, _) = open(dir.path(), None);
    let all = backend.packs();
    assert_eq!(all.music, PackStatus::Ready);
    assert!(matches!(all.video, PackStatus::Missing { .. }));
    assert!(matches!(
        backend.pack_status(PackKind::Voice),
        PackStatus::Missing { .. }
    ));
}

#[tokio::test]
async fn a_pack_with_every_file_in_place_becomes_ready_without_downloading() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events, _) = open(dir.path(), None);
    write_all(&dir.path().join("models"), PackKind::Logo);
    backend.install_pack(PackKind::Logo).await.unwrap();
    // A second request while it runs is ignored.
    backend.install_pack(PackKind::Logo).await.unwrap();
    wait_until(|| backend.pack_status(PackKind::Logo) == PackStatus::Ready).await;
    assert_eq!(
        pack_events(&events, PackKind::Logo).last(),
        Some(&PackStatus::Ready)
    );
}

#[tokio::test]
async fn cancelling_a_file_pack_returns_it_to_what_the_disk_shows() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events, _) = open(dir.path(), None);
    backend.install_pack(PackKind::Inpaint).await.unwrap();
    // The task has not run yet, so the token is cancelled before the first download starts.
    backend.cancel_pack(PackKind::Inpaint);
    wait_until(|| !pack_events(&events, PackKind::Inpaint).is_empty()).await;
    assert!(matches!(
        pack_events(&events, PackKind::Inpaint).last(),
        Some(PackStatus::Missing { .. })
    ));
}

#[tokio::test]
async fn the_voice_pack_needs_a_python() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events, _) = open(dir.path(), None);
    backend.install_pack(PackKind::Voice).await.unwrap();
    wait_until(|| !pack_events(&events, PackKind::Voice).is_empty()).await;
    assert!(matches!(
        backend.pack_status(PackKind::Voice),
        PackStatus::Error { message } if message.contains("Python")
    ));
}

#[tokio::test]
async fn the_voice_pack_installs_its_libraries_with_the_python_it_is_given() {
    let dir = tempfile::tempdir().unwrap();
    models_ready(&dir.path().join("models"));
    let report = r#"{"install":[{"metadata":{"name":"qwen-tts","version":"0.1.1"}}]}"#;
    let python = fake_python(
        dir.path(),
        &[
            ":loop",
            r#"if "%~1"=="" goto done"#,
            r#"if "%~1"=="--report" set OUT=%~2"#,
            "shift",
            "goto loop",
            ":done",
            &format!(r#"if defined OUT echo {report}> "%OUT%""#),
        ],
    );
    let (backend, _, _) = open(dir.path(), Some(python));
    backend.install_pack(PackKind::Voice).await.unwrap();
    wait_until(|| backend.pack_status(PackKind::Voice) == PackStatus::Ready).await;
    assert!(site_dir(dir.path()).join(".ready").is_file());
}

#[tokio::test]
async fn cancelling_the_voice_pack_stops_pip_and_returns_to_the_disk_state() {
    let dir = tempfile::tempdir().unwrap();
    let python = fake_python(dir.path(), &["ping -n 30 127.0.0.1 >nul"]);
    let (backend, events, _) = open(dir.path(), Some(python));
    backend.install_pack(PackKind::Voice).await.unwrap();
    wait_until(|| {
        pack_events(&events, PackKind::Voice)
            .iter()
            .any(|s| matches!(s, PackStatus::Installing { .. }))
    })
    .await;
    backend.cancel_pack(PackKind::Voice);
    wait_until(|| {
        matches!(
            pack_events(&events, PackKind::Voice).last(),
            Some(PackStatus::Missing { .. })
        )
    })
    .await;
}

// Custom node packs ------------------------------------------------------------------------------------------------

#[tokio::test]
async fn node_packs_are_listed_removed_and_flag_a_restart() {
    let dir = tempfile::tempdir().unwrap();
    let python = fake_python(dir.path(), &["exit /b 0"]);
    let nodes = dir.path().join("comfy").join("custom_nodes");
    std::fs::create_dir_all(nodes.join("a-pack")).unwrap();
    std::fs::create_dir_all(nodes.join("b-pack")).unwrap();
    let (backend, _, engine) = open(dir.path(), Some(python));
    let packs = backend.node_packs();
    assert!(packs.available && !packs.restart_needed);
    assert_eq!(packs.installed.len(), 2);

    assert!(backend.remove_node_pack("../a-pack").is_err());
    let packs = backend.remove_node_pack("a-pack").unwrap();
    assert_eq!(packs.installed.len(), 1);
    assert!(packs.restart_needed);

    let packs = backend.restart_engine().await.unwrap();
    assert!(!packs.restart_needed);
    assert_eq!(*engine.restarts.lock().unwrap(), 1);
}

#[tokio::test]
async fn cancelling_a_node_pack_install_reports_it_as_missing() {
    let dir = tempfile::tempdir().unwrap();
    let python = fake_python(dir.path(), &["exit /b 0"]);
    let (backend, events, _) = open(dir.path(), Some(python));
    let url = "https://github.com/owner/some-pack";
    backend.install_node_pack(url, None).await.unwrap();
    // The same pack again, with another spelling, is already running.
    backend
        .install_node_pack("https://github.com/owner/some-pack.git", None)
        .await
        .unwrap();
    backend.cancel_node_pack("https://github.com/owner/some-pack/");
    // Something that is not an address cannot match a job and is ignored.
    backend.cancel_node_pack("not an address");
    wait_until(|| !node_pack_events(&events).is_empty()).await;
    assert_eq!(
        node_pack_events(&events),
        vec![(url.to_string(), PackStatus::Missing { total_bytes: 0 })]
    );
    assert!(!backend.node_packs().restart_needed);
}

#[tokio::test]
async fn a_node_pack_install_that_fails_reports_the_error() {
    let dir = tempfile::tempdir().unwrap();
    let python = fake_python(dir.path(), &["exit /b 0"]);
    // A file where custom_nodes should be makes the first step fail without any download.
    std::fs::create_dir_all(dir.path().join("comfy")).unwrap();
    std::fs::write(dir.path().join("comfy").join("custom_nodes"), "x").unwrap();
    let (backend, events, _) = open(dir.path(), Some(python));
    backend
        .install_node_pack("https://github.com/owner/some-pack", None)
        .await
        .unwrap();
    wait_until(|| !node_pack_events(&events).is_empty()).await;
    assert!(matches!(
        &node_pack_events(&events)[0].1,
        PackStatus::Error { .. }
    ));
    assert!(!backend.node_packs().restart_needed);
}
