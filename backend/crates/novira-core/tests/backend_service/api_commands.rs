//! The synchronous commands of the shared command layer, called by name with JSON arguments: every one answers with a
//! result or the window's message, never with "unknown command" or "bad arguments" for correct arguments.
use super::common::*;
use novira_core::api::{self, CallError};
use serde_json::{json, Value};
use std::sync::Arc;

#[test]
fn a_call_error_reads_as_the_message_the_window_shows() {
    assert_eq!(CallError::UnknownCommand.to_string(), "unknown command");
    assert_eq!(
        CallError::BadArguments("x: bad".into()).to_string(),
        "x: bad"
    );
    assert_eq!(CallError::Failed("no".into()).to_string(), "no");
}

#[test]
fn a_panic_in_a_command_becomes_an_error_with_its_text() {
    assert_eq!(api::guard(|| Ok(5)), Ok(5));
    let literal: api::Res<()> = api::guard(|| panic!("boom"));
    assert_eq!(literal, Err("Internal error: boom".into()));
    let formatted: api::Res<()> = api::guard(|| panic!("boom {}", 7));
    assert_eq!(formatted, Err("Internal error: boom 7".into()));
    let other: api::Res<()> = api::guard(|| std::panic::panic_any(5u8));
    assert_eq!(other, Err("Internal error: unknown error".into()));
}

async fn call(backend: &novira_core::Backend, name: &str, args: Value) -> Result<Value, CallError> {
    api::dispatch(backend, name, args)
        .await
        .map(|text| serde_json::from_str(&text).expect("a result is JSON"))
}

#[tokio::test]
async fn the_board_image_and_queue_commands_work_by_name() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = call(&backend, "create_board", json!({"name": "A"}))
        .await
        .unwrap();
    let id = board["id"].as_str().unwrap().to_string();
    let renamed = call(
        &backend,
        "update_board",
        json!({"id": id, "patch": {"name": "B"}}),
    )
    .await
    .unwrap();
    assert_eq!(renamed["name"], "B");
    let image = backend
        .upload_image(png(16, 16), Default::default())
        .await
        .unwrap();
    let names = json!([image.name]);
    let updated = call(
        &backend,
        "update_images",
        json!({"names": names, "patch": {"starred": true}}),
    )
    .await
    .unwrap();
    assert_eq!(updated[0]["starred"], true);
    call(&backend, "delete_images", json!({"names": names}))
        .await
        .unwrap();
    let restored = call(&backend, "restore_images", json!({"names": names}))
        .await
        .unwrap();
    assert_eq!(restored.as_array().unwrap().len(), 1);
    let removed = call(
        &backend,
        "delete_board",
        json!({"id": id, "deleteImages": false}),
    )
    .await
    .unwrap();
    assert!(removed.is_array());

    // The queue: pause, add, look, cancel, retry, clear, resume.
    call(&backend, "pause_processor", Value::Null)
        .await
        .unwrap();
    let key = main_key(&backend);
    let items = call(
        &backend,
        "enqueue",
        json!({"request": serde_json::to_value(request(&key, "a cat", 1)).unwrap()}),
    )
    .await
    .unwrap();
    let item = items[0]["id"].as_u64().unwrap();
    let snapshot = call(&backend, "queue_snapshot", Value::Null).await.unwrap();
    assert_eq!(snapshot["items"].as_array().unwrap().len(), 1);
    call(&backend, "cancel_queue_item", json!({"id": item}))
        .await
        .unwrap();
    call(&backend, "cancel_batch", json!({"batchId": "none"}))
        .await
        .unwrap();
    let retried = call(
        &backend,
        "retry_queue_item",
        json!({"id": item, "size": {"width": 64, "height": 64}}),
    )
    .await;
    assert!(retried.is_ok() || matches!(retried, Err(CallError::Failed(_))));
    assert_eq!(
        call(&backend, "retry_queue_item", json!({"id": 99999}))
            .await
            .unwrap(),
        Value::Null
    );
    call(&backend, "clear_queue", Value::Null).await.unwrap();
    call(&backend, "prune_queue", Value::Null).await.unwrap();
    call(&backend, "resume_processor", Value::Null)
        .await
        .unwrap();
}

#[tokio::test]
async fn the_model_pack_and_setting_commands_work_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let starters = call(&backend, "list_starter_models", Value::Null)
        .await
        .unwrap();
    assert!(!starters.as_array().unwrap().is_empty());
    for (name, args) in [
        ("model_parts", json!({"modelKey": "nope"})),
        ("update_model", json!({"key": "nope", "patch": {}})),
        ("delete_model", json!({"key": "nope"})),
        ("remove_node_pack", json!({"folder": "../x"})),
        ("remove_model_root", json!({"index": 99})),
        (
            "set_engine_settings",
            json!({"patch": {"comfyuiPackage": "other"}}),
        ),
        (
            "agent_tool_result",
            json!({"answer": {"callId": "none", "ok": true, "content": "x"}}),
        ),
        ("save_canvas", json!({"document": "not json"})),
        ("save_ui_state", json!({"state": "[]", "origin": null})),
        ("delete_workflow", json!({"id": "none"})),
        ("delete_comic", json!({"id": "a/b"})),
        ("set_hf_token", json!({"token": "x\ny"})),
        ("set_civitai_key", json!({"key": "x\ny"})),
        ("delete_unfinished_downloads", json!({"paths": ["/none"]})),
    ] {
        // Correct arguments: the command answers, either with its value or with the message the window shows.
        let answer = call(&backend, name, args.clone()).await;
        assert!(
            !matches!(
                answer,
                Err(CallError::UnknownCommand | CallError::BadArguments(_))
            ),
            "{name} {args}: {answer:?}"
        );
    }
    for name in [
        "node_packs",
        "low_memory_mode",
        "engine_settings",
        "has_hf_token",
        "has_civitai_key",
        "watermark_status",
        "list_comics",
        "load_canvas",
        "discard_restore",
        "take_restored_ui_state",
        "agent_cancel",
        "hardware_info",
        "list_fonts",
        "list_unfinished_downloads",
    ] {
        let answer = call(&backend, name, Value::Null).await;
        assert!(
            !matches!(
                answer,
                Err(CallError::UnknownCommand | CallError::BadArguments(_))
            ),
            "{name}: {answer:?}"
        );
    }
    call(&backend, "cancel_install", json!({"jobId": "none"}))
        .await
        .unwrap();
    call(
        &backend,
        "cancel_node_pack",
        json!({"url": "https://github.com/a/b"}),
    )
    .await
    .unwrap();
    for kind in ["video", "turbo", "music", "voice", "inpaint", "logo"] {
        call(&backend, "pack_status", json!({"kind": kind}))
            .await
            .unwrap();
        call(&backend, "cancel_pack", json!({"kind": kind}))
            .await
            .unwrap();
    }
    let set = call(
        &backend,
        "set_engine_settings",
        json!({"patch": {"civitaiLookup": false}}),
    )
    .await
    .unwrap();
    assert_eq!(set["civitaiLookup"], false);
    call(&backend, "set_hf_token", json!({"token": null}))
        .await
        .unwrap();
    assert_eq!(
        call(&backend, "has_hf_token", Value::Null).await.unwrap(),
        json!(false)
    );
    call(&backend, "set_civitai_key", json!({"key": null}))
        .await
        .unwrap();
    call(&backend, "save_canvas", json!({"document": "{}"}))
        .await
        .unwrap();
    assert_eq!(
        call(&backend, "load_canvas", Value::Null).await.unwrap(),
        json!("{}")
    );
    let adopted = call(&backend, "adopt_ui_state", json!({"local": null}))
        .await
        .unwrap();
    assert!(adopted.is_null());
    call(
        &backend,
        "save_ui_state",
        json!({"state": "{\"novira.x\":\"1\"}", "origin": "page"}),
    )
    .await
    .unwrap();
    let saved = call(
        &backend,
        "save_workflow",
        json!({"workflow": {"name": "W", "graph": {}}}),
    )
    .await;
    assert!(saved.is_ok() || matches!(saved, Err(CallError::Failed(_))));
}

#[tokio::test]
async fn a_model_install_without_a_folder_dialog_takes_references_and_refuses_local_files() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let local =
        api::install_model_remote(&backend, json!({"source": "C:\\models\\a.safetensors"})).await;
    assert!(
        matches!(&local, Err(CallError::Failed(m)) if m.contains("Scan Folder")),
        "{local:?}"
    );
    // The backend's own parsing judges anything else.
    let nonsense = api::install_model_remote(&backend, json!({"source": "", "name": null})).await;
    assert!(
        matches!(nonsense, Err(CallError::Failed(_))),
        "{nonsense:?}"
    );
    assert!(matches!(
        api::install_model_remote(&backend, json!({})).await,
        Err(CallError::BadArguments(_))
    ));
    assert!(matches!(
        api::install_model_remote(&backend, json!({"source": "x", "extra": 1})).await,
        Err(CallError::BadArguments(_))
    ));
    assert!(matches!(
        api::install_model_remote(&backend, json!(3)).await,
        Err(CallError::BadArguments(_))
    ));
}
