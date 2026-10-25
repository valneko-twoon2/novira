//! The groups of commands the server answers beyond the reads: the queue, installs and model changes, the model sites,
//! engine settings, keys and the assistant. They run against a backend without a worker or an engine, so each test uses
//! a command's own checks (what it refuses before it touches the network or a process) or a state change it can show.
mod common;
use common::*;
use serde_json::json;

async fn failed(f: &Fixture, command: &str, body: &str) -> String {
    let r = f.post(command, body).await;
    assert_eq!(
        (r.status, r.json()["code"].clone()),
        (422, json!("failed")),
        "{command}: {}",
        String::from_utf8_lossy(&r.body)
    );
    r.json()["error"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn a_job_is_queued_and_the_queue_controls_work() {
    let f = Fixture::start().await;
    let made = f.post("enqueue", &enqueue_body()).await;
    assert_eq!(made.status, 200, "{}", String::from_utf8_lossy(&made.body));
    let id = made.json()[0]["id"].as_u64().expect("an item with an id");
    let snapshot = f.post("queue_snapshot", "").await.json();
    assert_eq!(snapshot["items"].as_array().unwrap().len(), 1);
    assert_eq!(snapshot["status"]["pending"], json!(1));

    assert_eq!(f.post("pause_processor", "").await.status, 200);
    assert_eq!(
        f.post("queue_snapshot", "").await.json()["status"]["isPaused"],
        json!(true)
    );
    assert_eq!(f.post("resume_processor", "").await.status, 200);

    let cancel = json!({ "id": id }).to_string();
    assert_eq!(f.post("cancel_queue_item", &cancel).await.status, 200);
    assert_eq!(
        f.post("queue_snapshot", "").await.json()["status"]["canceled"],
        json!(1)
    );
    assert_eq!(f.post("prune_queue", "").await.status, 200);
    assert_eq!(f.post("clear_queue", "").await.status, 200);
    assert_eq!(
        f.post("cancel_batch", r#"{"batchId":"none"}"#).await.status,
        200
    );
    assert_eq!(
        f.post("queue_snapshot", "").await.json()["items"],
        json!([])
    );
    // The same argument checks as the app: a missing request and an extra argument are refused before anything runs.
    assert_eq!(f.post("enqueue", "{}").await.status, 400);
    assert_eq!(
        f.post("cancel_queue_item", r#"{"id":1,"x":1}"#)
            .await
            .status,
        400
    );
    f.stop().await;
}

#[tokio::test]
async fn installs_and_model_changes_keep_the_backends_checks() {
    let f = Fixture::start().await;
    // A local file path is not installed from the browser (the app takes one only from its own folder scan).
    for source in [
        "C:\\models\\a.safetensors",
        "/etc/passwd",
        "..\\a.safetensors",
    ] {
        let body = json!({ "source": source, "name": null }).to_string();
        let message = failed(&f, "install_model", &body).await;
        assert!(!message.is_empty(), "{source}");
    }
    let body = json!({ "source": "C:\\models\\a.safetensors", "name": null }).to_string();
    let local = failed(&f, "install_model", &body).await;
    assert!(local.contains("Scan Folder"), "{local}");
    failed(
        &f,
        "install_model",
        r#"{"source":"civitai:bad","name":null}"#,
    )
    .await;
    failed(
        &f,
        "install_model",
        r#"{"source":"http://example.com/a.safetensors","name":null}"#,
    )
    .await;
    failed(&f, "install_model", r#"{"source":"x"}"#).await;
    assert_eq!(
        f.post("install_model", r#"{"source":"x","name":null,"path":"c"}"#)
            .await
            .status,
        400
    );
    failed(&f, "update_model", r#"{"key":"nope","patch":{}}"#).await;
    assert_eq!(
        f.post("delete_model", r#"{"key":"nope"}"#).await.status,
        200
    );
    assert_eq!(
        f.post("cancel_install", r#"{"jobId":"nope"}"#).await.status,
        200
    );
    assert_eq!(
        f.post("cancel_pack", r#"{"kind":"nope"}"#).await.status,
        400,
        "an unknown pack kind"
    );
    failed(
        &f,
        "install_node_pack",
        r#"{"url":"https://github.com.evil.example/a/b","version":null}"#,
    )
    .await;
    failed(&f, "remove_node_pack", r#"{"folder":"..\\x"}"#).await;
    assert_eq!(
        f.post("cancel_node_pack", r#"{"url":"https://github.com/a/b"}"#)
            .await
            .status,
        200
    );
    failed(&f, "switch_comfy_version", r#"{"version":"..\\..\\x"}"#).await;
    // Only the files the backend lists as unfinished downloads can be deleted, whatever path is sent.
    let victim = tempfile::NamedTempFile::new().unwrap();
    let body = json!({ "paths": [victim.path().to_string_lossy()] }).to_string();
    assert_eq!(
        f.post("delete_unfinished_downloads", &body).await.status,
        200
    );
    assert!(victim.path().exists());
    f.stop().await;
}

#[tokio::test]
async fn the_model_sites_are_asked_only_about_well_formed_names() {
    let f = Fixture::start().await;
    for repo in ["../x", "a", "a/b/c", "a b/c", ""] {
        let body = json!({ "repo": repo }).to_string();
        failed(&f, "list_hugging_face_files", &body).await;
    }
    failed(&f, "node_pack_info", r#"{"url":"http://github.com/a/b"}"#).await;
    failed(
        &f,
        "node_pack_versions",
        r#"{"url":"https://example.com/a/b"}"#,
    )
    .await;
    assert_eq!(f.post("search_civitai", "{}").await.status, 400);
    f.stop().await;
}

#[tokio::test]
async fn pages_outside_the_app_come_back_as_checked_addresses() {
    let f = Fixture::start().await;
    for (command, body, url) in [
        (
            "open_civitai_page",
            json!({ "modelId": "4201" }),
            "https://civitai.com/models/4201",
        ),
        (
            "open_huggingface_page",
            json!({ "repo": "owner/model-1" }),
            "https://huggingface.co/owner/model-1",
        ),
        (
            "open_source_page",
            json!({ "url": "https://civitai.com/models/1?modelVersionId=2" }),
            "https://civitai.com/models/1?modelVersionId=2",
        ),
    ] {
        let r = f.post(command, &body.to_string()).await;
        assert_eq!((r.status, r.json()), (200, json!(url)), "{command}");
    }
    // The same checks as the desktop shell: no address of another site, no id or name that is a URL in disguise.
    for (command, body) in [
        ("open_civitai_page", json!({ "modelId": "1/../../x" })),
        ("open_civitai_page", json!({ "modelId": "" })),
        ("open_civitai_page", json!({ "modelId": "1234567890123" })),
        (
            "open_huggingface_page",
            json!({ "repo": "https://evil.example/x" }),
        ),
        ("open_huggingface_page", json!({ "repo": "owner/../x" })),
        (
            "open_source_page",
            json!({ "url": "https://evil.example/models/1" }),
        ),
        (
            "open_source_page",
            json!({ "url": "http://civitai.com/models/1" }),
        ),
        ("open_source_page", json!({ "url": "javascript:alert(1)" })),
        (
            "open_source_page",
            json!({ "url": "https://user@civitai.com/models/1" }),
        ),
    ] {
        failed(&f, command, &body.to_string()).await;
    }
    let r = f
        .post(
            "open_civitai_page",
            &json!({ "modelId": "1", "url": "x" }).to_string(),
        )
        .await;
    assert_eq!(
        (r.status, r.json()["code"].clone()),
        (400, json!("bad_arguments"))
    );
    f.stop().await;
}

#[tokio::test]
async fn engine_settings_are_checked_before_they_are_written() {
    let f = Fixture::start().await;
    failed(
        &f,
        "set_engine_settings",
        r#"{"patch":{"comfyuiPackage":"nvidia && calc"}}"#,
    )
    .await;
    failed(
        &f,
        "set_engine_settings",
        r#"{"patch":{"comfyuiStartTimeoutSecs":1}}"#,
    )
    .await;
    assert_eq!(
        f.post("set_engine_settings", r#"{"patch":{"x":1}}"#)
            .await
            .status,
        400
    );
    let saved = f
        .post(
            "set_engine_settings",
            r#"{"patch":{"civitaiLookup":false}}"#,
        )
        .await;
    assert_eq!(saved.status, 200);
    assert_eq!(saved.json()["civitaiLookup"], json!(false));
    assert_eq!(
        f.post("engine_settings", "").await.json()["civitaiLookup"],
        json!(false)
    );
    failed(&f, "remove_model_root", r#"{"index":99}"#).await;
    f.stop().await;
}

#[tokio::test]
async fn keys_are_stored_but_never_come_back() {
    let f = Fixture::start().await;
    assert_eq!(f.post("has_hf_token", "").await.json(), json!(false));
    // Put together at run time, so the repository's secret scan does not take the sample for a real token.
    let token = format!("hf_{}", "abcdefghijklmnopqrstuvwxyz0123456789");
    let set = f
        .post("set_hf_token", &json!({ "token": token }).to_string())
        .await;
    assert_eq!((set.status, set.json()), (200, json!(null)));
    assert_eq!(f.post("has_hf_token", "").await.json(), json!(true));
    assert_eq!(
        f.post("set_hf_token", r#"{"token":null}"#).await.status,
        200
    );
    assert_eq!(f.post("has_hf_token", "").await.json(), json!(false));
    let civitai = f
        .post(
            "set_civitai_key",
            r#"{"key":"0123456789abcdef0123456789abcdef"}"#,
        )
        .await;
    assert_eq!(civitai.status, 200);
    assert_eq!(f.post("has_civitai_key", "").await.json(), json!(true));
    // Nothing the server answers carries a key.
    for command in ["bootstrap", "engine_settings", "agent_status"] {
        let body = String::from_utf8_lossy(&f.post(command, "").await.body).to_string();
        assert!(
            !body.contains("0123456789abcdef") && !body.contains("hf_abcdef"),
            "{command}"
        );
    }
    assert_eq!(
        f.post("set_civitai_key", r#"{"key":null}"#).await.status,
        200
    );
    f.stop().await;
}

#[tokio::test]
async fn the_assistant_commands_keep_their_checks() {
    let f = Fixture::start().await;
    failed(&f, "lookup_reference", r#"{"language":"xx","query":"cat"}"#).await;
    assert_eq!(f.post("agent_chat", "{}").await.status, 400);
    assert_eq!(f.post("agent_endpoint_save", "{}").await.status, 400);
    assert_eq!(f.post("agent_cancel", "").await.status, 200);
    f.stop().await;
}

#[tokio::test]
async fn what_needs_a_dialog_or_a_restore_stays_unavailable() {
    let f = Fixture::start().await;
    for name in [
        "add_model_root",
        "scan_folder",
        "export_images",
        "create_backup",
        "open_backup",
        "confirm_restore",
        "discard_restore",
        "check_watermark_file",
        "reveal_export_folder",
        "set_ui_zoom",
    ] {
        let r = f.post(name, "{}").await;
        assert_eq!(
            (r.status, r.json()["code"].clone()),
            (501, json!("not_available_in_browser")),
            "{name}"
        );
    }
    f.stop().await;
}

#[tokio::test]
async fn preparing_the_watermark_takes_no_arguments() {
    // Only the refusals: a call that is accepted starts the download from the real hosts.
    let f = Fixture::start().await;
    for body in [r#"{"x":1}"#, "[]", r#""a""#] {
        let r = f.post("prepare_watermark", body).await;
        assert_eq!(
            (r.status, r.json()["code"].clone()),
            (400, json!("bad_arguments")),
            "{body}"
        );
    }
    f.stop().await;
}
