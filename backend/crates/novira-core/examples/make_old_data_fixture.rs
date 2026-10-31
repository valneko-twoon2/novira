//! Writes the old-data fixture of this version (checked by `tests/backend_service/old_data.rs`) with this version's own
//! code, into `novira-data/work/fixture-out/`. Run it at a release, on the release's commit, and copy the folder to
//! `tests/fixtures/data-<version>/` without `extra_model_paths.yaml` (docs/verification.md, "Kinds of tests").
//!
//! `cargo run -p novira-core --example make_old_data_fixture`
#[allow(dead_code)]
#[path = "../tests/backend_service/common.rs"]
mod common;

use common::*;
use novira_core::types::*;
use serde_json::json;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../novira-data/work/fixture-out");
    assert!(
        !dir.exists(),
        "{} exists: remove it first, a fixture is written into an empty folder",
        dir.display()
    );
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(
        dir.join("settings.json"),
        serde_json::to_string_pretty(&json!({
            "civitaiLookup": false,
            "lowMemoryMode": true,
            "comfyuiArgs": ["--fast"],
            "comfyuiStartTimeoutSecs": 300,
            "gpuLock": ""
        }))
        .unwrap(),
    )
    .unwrap();
    write_lora_and_checkpoint(&dir.join("models"));
    let (backend, _) = open(&dir, Arc::new(FakeEngine::default()));
    let key = main_key(&backend);

    let portraits = backend.create_board("Portraits").unwrap();
    let scenery = backend.create_board("Scenery").unwrap();

    backend
        .enqueue(request(&key, "a cute girl, smile", 2))
        .unwrap();
    backend.enqueue(request(&key, "[fail] broken", 1)).unwrap();
    tokio::spawn(backend.clone().run_worker());
    wait_until(|| {
        statuses(&backend)
            .iter()
            .all(|s| !matches!(s, QueueItemStatus::Pending | QueueItemStatus::InProgress))
    })
    .await;
    let made: Vec<String> = backend
        .bootstrap()
        .images
        .iter()
        .map(|i| i.name.clone())
        .collect();
    assert_eq!(made.len(), 2);
    backend
        .update_images(
            &made[..1],
            ImagePatch {
                board_id: Some(Some(portraits.id.clone())),
                starred: Some(true),
                is_intermediate: None,
            },
        )
        .unwrap();

    let uploaded = backend
        .upload_image(
            png(16, 12),
            ImageOptions {
                board_id: Some(scenery.id.clone()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
    let trashed = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    backend
        .delete_images(std::slice::from_ref(&trashed.name))
        .unwrap();

    backend
        .save_workflow(
            serde_json::from_value(
                json!({ "name": "Old workflow", "tags": ["kept"], "graph": { "nodes": [1, 2] } }),
            )
            .unwrap(),
        )
        .unwrap();
    backend
        .save_comic(
            "comic-1",
            json!({"title": "First comic", "pages": [{"panels": []}]}),
        )
        .unwrap();
    backend
        .save_canvas(r#"{"version":1,"entities":[]}"#)
        .unwrap();
    backend
        .save_ui_state(r#"{"novira.theme":"light","novira.tab":"generate"}"#, None)
        .unwrap();

    println!("uploaded {} trashed {}", uploaded.name, trashed.name);
    backend.shutdown();
}
