//! Lists and pages that outside sites (GitHub, the ComfyUI registry) or ComfyUI itself can answer wrongly: a failed
//! status, an answer announced as too large, and an answer that grows past its cap only after it is decompressed (no
//! length is known up front). Also the registry list over several pages, its disk copy, and a ComfyUI process whose log
//! folder cannot be made.
mod fake_site;

use fake_site::{client, site, Route};
use flate2::write::GzEncoder;
use flate2::Compression;
use novira_core::comfy::install::release_tags;
use novira_core::comfy::node_packs::{parse_github, repo_info, tags};
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use novira_core::comfy::registry::{fetch_all, load_cache, parse_page};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineError};
use serde_json::json;
use std::io::Write;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// `bytes` zeros, gzip-compressed: small on the wire, large once read.
fn gzip_zeros(bytes: usize) -> Route {
    let mut z = GzEncoder::new(Vec::new(), Compression::fast());
    z.write_all(&vec![0u8; bytes]).unwrap();
    Route::bytes(z.finish().unwrap()).with_header("Content-Encoding", "gzip")
}

#[tokio::test]
async fn the_list_of_comfyui_releases_refuses_a_failed_or_oversized_answer() {
    let path = "/repos/comfyanonymous/ComfyUI/releases";
    site().put(path, Route::status(500));
    let err = release_tags(&client()).await.unwrap_err();
    assert!(err.contains("HTTP 500"), "{err}");
    site().put(path, gzip_zeros(1_000_001));
    let err = release_tags(&client()).await.unwrap_err();
    assert!(err.contains("unexpectedly large"), "{err}");
    site().put(path, Route::json(&json!([{ "tag_name": "v0.3.1" }])));
    assert_eq!(release_tags(&client()).await.unwrap(), ["v0.3.1"]);
}

#[tokio::test]
async fn the_tags_and_the_description_of_a_pack_repository_have_a_size_cap() {
    let repo = parse_github("https://github.com/capowner/caprepo").unwrap();
    site().put(
        "/repos/capowner/caprepo/tags",
        Route::status(200).announcing(1_000_001),
    );
    let err = tags(&client(), &repo).await.unwrap_err();
    assert!(err.contains("unexpectedly large"), "{err}");
    site().put("/repos/capowner/caprepo/tags", gzip_zeros(1_000_001));
    let err = tags(&client(), &repo).await.unwrap_err();
    assert!(err.contains("unexpectedly large"), "{err}");
    site().put("/repos/capowner/caprepo", gzip_zeros(1_000_001));
    let err = repo_info(&client(), &repo).await.unwrap_err();
    assert!(err.contains("unexpectedly large"), "{err}");
}

fn page_node(id: &str, name: &str, downloads: u64) -> serde_json::Value {
    json!({
        "id": id, "name": name, "status": "NodeStatusActive", "downloads": downloads,
        "repository": format!("https://github.com/ow/{}", if name.is_empty() { "Unnamed" } else { name }),
    })
}

#[tokio::test]
async fn the_registry_list_is_read_over_every_page_sorted_and_without_repeats() {
    let path = "/nodes";
    // Announced as larger than a page may be.
    site().put(path, Route::status(200).announcing(5_000_001));
    let err = fetch_all(&client()).await.unwrap_err();
    assert!(err.contains("unexpectedly large"), "{err}");
    // Larger than a page may be only after decompression.
    site().put(path, gzip_zeros(5_000_001));
    let err = fetch_all(&client()).await.unwrap_err();
    assert!(err.contains("unexpectedly large"), "{err}");
    // Three pages that all answer the same list: ties are broken by name, then by id, and repeats drop out. A pack
    // without an id is left out, and one without a name takes its repository's.
    site().put(
        path,
        Route::json(&json!({ "totalPages": 3, "nodes": [
            page_node("a", "Alpha", 5), page_node("d", "Alpha", 5), page_node("b", "Beta", 5),
            page_node("c", "Gamma", 9), page_node("e", "", 1), page_node("", "NoId", 100)
        ] })),
    );
    let all = fetch_all(&client()).await.unwrap();
    let ids: Vec<&str> = all.iter().map(|n| n.id.as_str()).collect();
    assert_eq!(ids, ["c", "a", "d", "b", "e"]);
    assert_eq!(all[4].name, "Unnamed");
    assert_eq!(parse_page(b"{\"nodes\":[]}").unwrap().1, 1);
}

#[test]
fn a_disk_copy_larger_than_any_real_list_is_not_read() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("registry.json");
    let file = std::fs::File::create(&path).unwrap();
    file.set_len(41_000_000).unwrap();
    drop(file);
    assert!(load_cache(&path).is_none());
}

#[tokio::test]
async fn a_frontend_page_sent_in_chunks_past_the_script_cap_is_an_error() {
    // No length is announced, so only the bytes read can show that the page is too large.
    let chunks = futures_util::stream::iter(
        (0..9).map(|_| Ok::<_, std::io::Error>(vec![b'a'; 1024 * 1024])),
    );
    let app = axum::Router::new()
        .route(
            "/system_stats",
            axum::routing::get(|| async { axum::Json(json!({ "system": {} })) }),
        )
        .route(
            "/",
            axum::routing::get(move || async move { axum::body::Body::from_stream(chunks) }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let engine = ComfyEngine::new(&url, None, Duration::from_secs(2)).unwrap();
    let err = engine
        .ui_locale(&CancellationToken::new(), "fr")
        .await
        .unwrap_err();
    assert!(
        matches!(&err, EngineError::Failed(m) if m.contains("too large")),
        "{err:?}"
    );
}

#[test]
fn a_comfyui_process_reports_its_folder_and_a_log_folder_it_cannot_make() {
    let root = tempfile::tempdir().unwrap();
    let comfy = root.path().join("comfy");
    std::fs::create_dir_all(&comfy).unwrap();
    std::fs::write(comfy.join("main.py"), "").unwrap();
    // A file stands where the log folder should be.
    std::fs::write(root.path().join("logs"), "x").unwrap();
    let process = ComfyProcess::new(OwnedProcessConfig {
        comfyui_dir: comfy.clone(),
        python: None,
        host: "127.0.0.1".into(),
        port: 8199,
        extra_model_paths: root.path().join("extra.yaml"),
        extra_args: vec![],
        log_file: root.path().join("logs").join("comfyui.log"),
    });
    assert_eq!(process.comfyui_dir(), comfy.as_path());
    assert!(process.start().is_err());
    assert!(!process.is_running());
}
