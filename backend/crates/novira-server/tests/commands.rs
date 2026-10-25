//! The command route: what runs through the shared layer and what is left out.
mod common;
use common::*;
use novira_server::SERVED;
use serde_json::json;

#[tokio::test]
async fn commands_run_through_the_shared_layer() {
    let f = Fixture::start().await;
    let boot = f.post("bootstrap", "").await;
    assert_eq!(boot.status, 200);
    assert_eq!(boot.header("content-type"), Some("application/json"));
    assert_eq!(boot.json()["boards"], json!([]));
    assert_eq!(
        boot.json(),
        serde_json::to_value(f.backend.bootstrap()).unwrap()
    );
    let made = f.post("create_board", r#"{"name":"Trip"}"#).await;
    assert_eq!(
        (made.status, made.json()["name"].clone()),
        (200, json!("Trip"))
    );
    assert_eq!(f.backend.bootstrap().boards.len(), 1);
    assert_eq!(f.post("queue_snapshot", "{}").await.status, 200);
    assert_eq!(f.post("list_comics", "null").await.json(), json!([]));
    // Bad requests: JSON that is not JSON, the wrong shape, a missing or extra argument.
    for body in [
        "{",
        "nope",
        r#"{"name":5}"#,
        "{}",
        r#"{"name":"a","x":1}"#,
        r#"["a"]"#,
        r#""a""#,
    ] {
        let r = f.post("create_board", body).await;
        assert_eq!(
            (r.status, r.json()["code"].clone()),
            (400, json!("bad_arguments")),
            "{body}"
        );
    }
    // A command's own refusal is the message the window shows.
    let refused = f.post("save_comic", r#"{"id":"a/b","document":{}}"#).await;
    assert_eq!(
        (refused.status, refused.json()["code"].clone()),
        (422, json!("failed"))
    );
    assert!(refused.json()["error"]
        .as_str()
        .is_some_and(|m| !m.is_empty()));
    // Unknown names are 404; commands of the app that are not served yet say so clearly and do nothing.
    for name in ["nope", "Bootstrap", "..%2Fbootstrap", "bootstrap%00"] {
        let r = f.post(name, "").await;
        assert_eq!(r.status, 404, "{name:?}");
    }
    for name in [
        "upload_image",
        "scan_folder",
        "export_images",
        "create_backup",
        "discard_restore",
    ] {
        let r = f.post(name, "{}").await;
        assert_eq!(
            (r.status, r.json()["code"].clone()),
            (501, json!("not_available_in_browser")),
            "{name}"
        );
        assert!(r.json()["error"]
            .as_str()
            .unwrap()
            .starts_with("not available in the browser yet"));
    }
    assert!(
        f.backend.queue_snapshot().items.is_empty(),
        "a command that is not served did nothing"
    );
    // GET is not a way to run a command.
    assert_eq!(f.get("/api/bootstrap", &[]).await.status, 405);
    f.stop().await;
}

#[tokio::test]
async fn the_served_list_is_a_subset_of_the_shared_layer_and_leaves_out_dialog_commands() {
    for risky in [
        "upload_image",
        "scan_folder",
        "add_model_root",
        "export_images",
        "create_backup",
        "open_backup",
        "confirm_restore",
        "discard_restore",
    ] {
        assert!(!SERVED.contains(&risky), "{risky} must not be served");
    }
}
