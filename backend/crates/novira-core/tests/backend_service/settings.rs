//! Keys, node packs and engine restarts.
use super::common::*;
use novira_core::packs::PackKind;
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::sync::Arc;

/// Keys are sealed with DPAPI (the user's own key, in a temporary folder); there is no fallback elsewhere.
#[cfg(windows)]
#[tokio::test]
async fn keys_are_saved_across_restarts_and_a_blank_one_removes_it() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(!backend.has_civitai_key() && !backend.has_hf_token());
    backend.set_civitai_key(Some("  civ-key  ".into())).unwrap();
    backend.set_hf_token(Some("hf_token".into())).unwrap();
    assert!(backend.has_civitai_key() && backend.has_hf_token());
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(backend.has_civitai_key() && backend.has_hf_token());
    assert_eq!(
        novira_core::secret::load_civitai_key(dir.path())
            .unwrap()
            .as_deref(),
        Some("civ-key"),
        "the key is trimmed"
    );
    backend.set_civitai_key(Some("   ".into())).unwrap();
    backend.set_hf_token(None).unwrap();
    assert!(!backend.has_civitai_key() && !backend.has_hf_token());
    drop(backend);
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(!backend.has_civitai_key() && !backend.has_hf_token());
}

#[tokio::test]
async fn the_civitai_key_of_the_settings_is_used_when_none_is_saved() {
    let dir = tempfile::tempdir().unwrap();
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: Settings {
                civitai_api_key: Some("from-settings".into()),
                ..settings()
            },
        },
        Arc::new(FakeEngine::default()),
    )
    .unwrap();
    assert!(backend.has_civitai_key());
}

#[tokio::test]
async fn node_packs_need_a_known_comfyui_folder() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let packs = backend.node_packs();
    assert!(!packs.available && packs.installed.is_empty() && !packs.restart_needed);
    assert!(matches!(
        backend
            .install_node_pack("https://github.com/owner/pack", None)
            .await,
        Err(novira_core::BackendError::Invalid(_))
    ));
    assert!(backend
        .install_node_pack("https://example.com/not-github", None)
        .await
        .is_err());
    assert!(backend.remove_node_pack("pack").is_err());
    // Nothing runs, so cancelling is a no-op.
    backend.cancel_node_pack("https://github.com/owner/pack");
    backend.cancel_pack(PackKind::Video);
}

#[tokio::test]
async fn the_comfyui_version_is_only_changed_to_a_plain_release_on_an_engine_novira_installed() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    for bad in ["../x", "a b", "", "-v"] {
        assert!(matches!(
            backend.switch_comfy_version(bad).await,
            Err(novira_core::BackendError::Invalid(_))
        ));
    }
    // An engine that novira did not install cannot be switched.
    assert!(matches!(
        backend.switch_comfy_version("v0.3.50").await,
        Err(novira_core::BackendError::Internal(m)) if m.contains("not installed by novira")
    ));
}

#[tokio::test]
async fn the_comfyui_version_does_not_change_while_a_job_runs() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine {
        block: true,
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine);
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    let running = backend.enqueue(request(&key, "long", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::InProgress]).await;
    assert!(matches!(
        backend.switch_comfy_version("v0.3.50").await,
        Err(novira_core::BackendError::Invalid(_))
    ));
    backend.cancel_queue_item(running[0].id);
}

#[tokio::test]
async fn the_engine_does_not_restart_while_a_job_runs() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine {
        block: true,
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine.clone());
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    let running = backend.enqueue(request(&key, "long", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::InProgress]).await;
    assert!(matches!(
        backend.restart_engine().await,
        Err(novira_core::BackendError::Invalid(_))
    ));
    assert_eq!(*engine.restarts.lock().unwrap(), 0);
    backend.cancel_queue_item(running[0].id);
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
    let packs = backend.restart_engine().await.unwrap();
    assert!(!packs.restart_needed);
    assert_eq!(*engine.restarts.lock().unwrap(), 1);
    backend.shutdown();
}

#[tokio::test]
async fn the_canvas_document_survives_a_restart_and_bad_ones_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(backend.load_canvas().unwrap(), None);
    backend
        .save_canvas(r#"{"version":1,"entities":[]}"#)
        .unwrap();
    assert!(backend.save_canvas("[1]").is_err(), "only an object");
    assert!(backend.save_canvas("not json").is_err());
    let huge = format!(
        r#"{{"x":"{}"}}"#,
        "a".repeat(novira_core::service::canvas::MAX_CANVAS_BYTES)
    );
    assert!(backend.save_canvas(&huge).is_err(), "over the size limit");
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(
        backend.load_canvas().unwrap().as_deref(),
        Some(r#"{"version":1,"entities":[]}"#),
        "refused saves leave the last good one"
    );
}

#[tokio::test]
async fn the_screen_state_is_shared_through_the_database_and_the_backends_wins() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // Nothing anywhere: nothing comes back, nothing is kept.
    assert_eq!(backend.adopt_ui_state(None).unwrap(), None);
    assert_eq!(backend.adopt_ui_state(Some("{}")).unwrap(), None);
    // The first page to start gives its own state, which the backend keeps; the page keeps it too.
    let first = r#"{"novira.settings":"a"}"#;
    assert_eq!(backend.adopt_ui_state(Some(first)).unwrap(), None);
    assert_eq!(
        backend.adopt_ui_state(None).unwrap().as_deref(),
        Some(first)
    );
    // A page that never synced, with a state of its own: the backend's state comes back, and the page's is kept aside.
    let other = r#"{"novira.settings":"b"}"#;
    assert_eq!(
        backend.adopt_ui_state(Some(other)).unwrap().as_deref(),
        Some(first)
    );
    // Saving replaces the state.
    let saved = r#"{"novira.settings":"c","novira.drafts":"d"}"#;
    backend.save_ui_state(saved, None).unwrap();
    drop(backend);
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(
        backend.adopt_ui_state(None).unwrap().as_deref(),
        Some(saved)
    );

    // Only an object of `novira.*` keys with text values, and not too large, is taken.
    for bad in [
        "[1]",
        "not json",
        r#"{"other":"x"}"#,
        r#"{"novira.a":1}"#,
        r#"{"novira.a":null}"#,
    ] {
        assert!(backend.save_ui_state(bad, None).is_err(), "{bad}");
        assert!(backend.adopt_ui_state(Some(bad)).is_err(), "{bad}");
    }
    let long_key = format!(r#"{{"novira.{}":"x"}}"#, "k".repeat(300));
    assert!(
        backend.save_ui_state(&long_key, None).is_err(),
        "a long key"
    );
    let huge = format!(
        r#"{{"novira.x":"{}"}}"#,
        "a".repeat(novira_core::service::ui_state::MAX_UI_STATE_BYTES)
    );
    assert!(
        backend.save_ui_state(&huge, None).is_err(),
        "over the size limit"
    );
    assert_eq!(
        backend.adopt_ui_state(None).unwrap().as_deref(),
        Some(saved),
        "refused saves leave the last good one"
    );
}

#[tokio::test]
async fn the_saved_theme_is_read_for_the_window_frame() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // No state yet: the screens' default, dark.
    assert!(!backend.saved_theme_is_light());
    let settings = |text: &str| {
        serde_json::json!({ "novira.settings": text, "novira.drafts": "{}" }).to_string()
    };
    backend
        .save_ui_state(
            &settings(r#"{"state":{"theme":"light","language":"en"},"version":0}"#),
            None,
        )
        .unwrap();
    assert!(backend.saved_theme_is_light());
    for not_light in [
        r#"{"state":{"theme":"dark"},"version":0}"#,
        r#"{"state":{"language":"en"},"version":0}"#,
        r#"{"theme":"light"}"#,
        "not json",
    ] {
        backend.save_ui_state(&settings(not_light), None).unwrap();
        assert!(!backend.saved_theme_is_light(), "{not_light}");
    }
    backend
        .save_ui_state(r#"{"novira.drafts":"{}"}"#, None)
        .unwrap();
    assert!(!backend.saved_theme_is_light(), "no settings");
}

#[tokio::test]
async fn a_saved_screen_state_is_announced_with_the_savers_id_and_a_growing_revision() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let changes = |events: &Arc<std::sync::Mutex<Vec<BackendEvent>>>| -> Vec<(String, u64)> {
        events
            .lock()
            .unwrap()
            .iter()
            .filter_map(|e| match e {
                BackendEvent::UiStateChanged { origin, revision } => {
                    Some((origin.clone(), *revision))
                }
                _ => None,
            })
            .collect()
    };
    backend
        .save_ui_state(r#"{"novira.a":"1"}"#, Some("page-A_1"))
        .unwrap();
    backend.save_ui_state(r#"{"novira.a":"2"}"#, None).unwrap();
    // An id that is too long or holds other characters is dropped; the event is still sent.
    backend
        .save_ui_state(r#"{"novira.a":"3"}"#, Some(&"x".repeat(65)))
        .unwrap();
    backend
        .save_ui_state(r#"{"novira.a":"4"}"#, Some("a b<script>"))
        .unwrap();
    let seen = changes(&events);
    let origins: Vec<&str> = seen.iter().map(|(o, _)| o.as_str()).collect();
    assert_eq!(origins, ["page-A_1", "", "", ""]);
    assert!(
        seen.windows(2).all(|w| w[0].1 < w[1].1),
        "the revision only grows: {seen:?}"
    );
    // A refused state is not announced, and adopting (a read) announces nothing.
    assert!(backend.save_ui_state("[1]", Some("page-B")).is_err());
    backend.adopt_ui_state(None).unwrap();
    assert_eq!(changes(&events).len(), 4);
}
