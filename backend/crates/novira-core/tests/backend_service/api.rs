//! The shared command layer: a command name and JSON arguments in, JSON out, the same checks as the typed calls.
use super::common::*;
use novira_core::api::{self, CallError};
use serde_json::{json, Value};
use std::sync::Arc;

#[test]
fn the_command_names_are_unique_and_none_is_also_shell_only() {
    let mut names = api::NAMES.to_vec();
    names.sort();
    let before = names.len();
    names.dedup();
    assert_eq!(names.len(), before, "a command is listed twice");
    for shell in api::SHELL_ONLY {
        assert!(!api::NAMES.contains(shell), "{shell} is in both lists");
    }
    assert_eq!(api::PARAMETERS.len(), api::NAMES.len());
}

#[test]
fn argument_names_are_spelled_in_camel_case() {
    assert_eq!(api::camel("delete_images"), "deleteImages");
    assert_eq!(api::camel("id"), "id");
    assert_eq!(api::camel("a_b_c"), "aBC");
}

/// `api::dispatch` with the JSON text of the result read back.
async fn dispatch(
    backend: &novira_core::Backend,
    name: &str,
    args: Value,
) -> Result<Value, CallError> {
    api::dispatch(backend, name, args)
        .await
        .map(|text| serde_json::from_str(&text).expect("a result is JSON"))
}

#[tokio::test]
async fn a_read_and_a_write_go_through_the_json_form() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let boot = api::dispatch(&backend, "bootstrap", Value::Null)
        .await
        .unwrap();
    // The text the desktop shell sends for the typed call (Tauri writes the value with `serde_json::to_string`).
    assert_eq!(boot, serde_json::to_string(&backend.bootstrap()).unwrap());
    // Named arguments in camelCase; an `Option` may be left out.
    let board = dispatch(&backend, "create_board", json!({"name": "Trip"}))
        .await
        .unwrap();
    assert_eq!(board["name"], "Trip");
    let after = dispatch(&backend, "bootstrap", json!({})).await.unwrap();
    assert!(after["boards"]
        .as_array()
        .unwrap()
        .iter()
        .any(|b| b["name"] == "Trip"));
    let none = dispatch(&backend, "delete_images", json!({"names": []}))
        .await
        .unwrap();
    assert_eq!(none, Value::Null);
}

#[tokio::test]
async fn unknown_commands_and_bad_arguments_are_refused_before_any_work() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let call = |name: &'static str, args: Value| {
        let backend = backend.clone();
        async move { dispatch(&backend, name, args).await }
    };
    for name in [
        "",
        "nope",
        "Bootstrap",
        "bootstrap ",
        "../bootstrap",
        "upload_image",
    ] {
        assert_eq!(
            call(name, Value::Null).await,
            Err(CallError::UnknownCommand),
            "{name:?}"
        );
    }
    for (name, args) in [
        ("create_board", json!({})),
        ("create_board", json!({"name": 5})),
        ("create_board", json!({"name": "a", "extra": 1})),
        ("create_board", json!({"Name": "a"})),
        ("create_board", json!("a")),
        ("create_board", json!(["a"])),
        ("bootstrap", json!({"x": 1})),
        ("cancel_queue_item", json!({"id": -1})),
        ("delete_images", json!({"names": "a.png"})),
    ] {
        assert!(
            matches!(
                call(name, args.clone()).await,
                Err(CallError::BadArguments(_))
            ),
            "{name} {args}"
        );
    }
    // A snake_case spelling is not accepted: the wire spelling is the frontend's.
    assert!(matches!(
        call("cancel_batch", json!({"batch_id": "b"})).await,
        Err(CallError::BadArguments(_))
    ));
    // The checks of the command itself come back as the message the window shows.
    assert_eq!(
        call("comfy_ui_locale", json!({"locale": "xx"})).await,
        Err(CallError::Failed("unknown language".into()))
    );
    assert!(matches!(
        call("save_comic", json!({"id": "a/b", "document": {}})).await,
        Err(CallError::Failed(_))
    ));
}

#[test]
fn page_commands_are_shell_only_and_give_checked_addresses() {
    for name in api::PAGE_COMMANDS {
        assert!(api::SHELL_ONLY.contains(name), "{name} is not shell-only");
    }
    assert_eq!(
        api::page_url("open_civitai_page", json!({ "modelId": "12" })),
        Ok("\"https://civitai.com/models/12\"".into())
    );
    assert_eq!(
        api::page_url("open_huggingface_page", json!({ "repo": "a/b" })),
        Ok("\"https://huggingface.co/a/b\"".into())
    );
    assert_eq!(
        api::page_url(
            "open_source_page",
            json!({ "url": "https://github.com/a/b" })
        ),
        Ok("\"https://github.com/a/b\"".into())
    );
    // Boundaries of the Civitai id: 12 digits pass, 13 and a non-digit do not.
    assert!(api::civitai_page_url("123456789012").is_ok());
    assert!(api::civitai_page_url("1234567890123").is_err());
    assert!(api::civitai_page_url("12a").is_err());
    assert!(api::huggingface_page_url("a/b/c").is_err());
    assert!(api::source_page_url("https://example.com/x").is_err());
    assert_eq!(
        api::page_url("open_backup", json!({})),
        Err(CallError::UnknownCommand)
    );
    assert!(matches!(
        api::page_url("open_civitai_page", json!({ "modelId": 12 })),
        Err(CallError::BadArguments(_))
    ));
}

#[test]
fn an_address_with_a_query_goes_to_the_browser_whole_and_never_to_explorer() {
    let url = "http://127.0.0.1:8080/?token=abc&x=1";
    let command = api::browser_command(url);
    let args: Vec<_> = command.get_args().collect();
    assert_ne!(command.get_program(), "explorer.exe");
    assert_eq!(args.last().copied(), Some(std::ffi::OsStr::new(url)));
    if cfg!(windows) {
        assert_eq!(command.get_program(), "rundll32.exe");
        assert_eq!(args.len(), 2);
    }
}
