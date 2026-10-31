//! Searching, resolving, downloading and looking up models against a fake Civitai and Hugging Face. The addresses point
//! at a loopback server (debug-only override), so the lookups by hash, the covers, the licences and the keys
//! sent with a download run without the network.
mod fake_site;

use fake_site::{site, Route};
#[path = "key_cleanup/mod.rs"]
mod key_cleanup;
use key_cleanup::KeyCleanup;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::models::civitai::SearchParams;
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

struct NoEngine;

#[async_trait::async_trait]
impl Engine for NoEngine {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Err(EngineError::Failed("no engine in this test".into()))
    }
}

type Events = Arc<Mutex<Vec<BackendEvent>>>;

fn open(dir: &Path) -> (Backend, Events) {
    // Makes sure the fake site is up and every service points at it before the first request.
    site();
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        Arc::new(NoEngine),
    )
    .unwrap();
    let events: Events = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    (backend, events)
}

/// A LoRA safetensors file; `tag` makes its bytes (and so its hash) unique to the test.
fn lora(tag: &str) -> Vec<u8> {
    let header = serde_json::to_vec(&json!({
        "__metadata__": {"tag": tag},
        "lora_te2_a.lora_up.weight": {"dtype": "F16", "shape": [1], "data_offsets": [0, 2]},
    }))
    .unwrap();
    let mut out = (header.len() as u64).to_le_bytes().to_vec();
    out.extend_from_slice(&header);
    out.extend_from_slice(&[0, 0]);
    out
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

async fn finish(events: &Events, id: &str) -> ModelInstallJob {
    for _ in 0..250 {
        let last = events.lock().unwrap().iter().rev().find_map(|e| match e {
            BackendEvent::ModelInstall { job } if job.id == id => Some(job.clone()),
            _ => None,
        });
        if let Some(j) = last {
            if matches!(
                j.status,
                ModelInstallStatus::Completed
                    | ModelInstallStatus::Error
                    | ModelInstallStatus::Cancelled
            ) {
                return j;
            }
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("install {id} did not finish");
}

fn model_named(backend: &Backend, file: &str) -> ModelConfig {
    backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.ends_with(file))
        .unwrap_or_else(|| panic!("{file} is not in the registry"))
}

fn search_params(source: &str) -> SearchParams {
    SearchParams {
        query: "style".into(),
        kind: "LoRA".into(),
        base_model: "sdxl-compat".into(),
        sort: "rating".into(),
        period: "all".into(),
        include_nsfw: false,
        cursor: None,
        source: source.into(),
        licenses: Vec::new(),
        checkpoint_type: String::new(),
        safetensors_only: false,
        price: String::new(),
        creator: String::new(),
    }
}

#[tokio::test]
async fn a_civitai_search_is_mapped_and_sent_with_the_key() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path());
    let _keys = KeyCleanup::new(dir.path());
    backend
        .set_civitai_key(Some("civ-search-key".into()))
        .unwrap();
    site().put_json(
        "/api/v1/models",
        &json!({
            "items": [{
                "id": 501, "name": "Fake Style", "type": "LORA", "nsfw": false,
                "creator": {"username": "me"},
                "modelVersions": [{
                    "id": 5011, "name": "v1", "baseModel": "SDXL 1.0",
                    "files": [{"id": 1, "name": "fake.safetensors", "sizeKB": 2.0}]
                }]
            }],
            "metadata": {"nextCursor": "page2"}
        }),
    );
    let found = backend
        .search_civitai(search_params("civitai"))
        .await
        .unwrap();
    // "SDXL compatible" in a rating sort is asked for one base model at a time (Civitai is slow with several at once); the fake
    // answers every request alike, so the same model comes back four times and is shown once.
    assert_eq!(found.items.len(), 1);
    assert_eq!(found.items[0].name, "Fake Style");
    let asked = site().requests("/api/v1/models");
    assert_eq!(asked.len(), 4);
    for base in ["SDXL+1.0", "Illustrious", "NoobAI", "Pony"] {
        let own = asked
            .iter()
            .filter(|r| {
                r.target
                    .contains(&format!("baseModels={}", base.replace('+', "%20")))
                    || r.target.contains(&format!("baseModels={base}"))
            })
            .count();
        assert_eq!(own, 1, "{base}");
    }
    assert!(asked
        .iter()
        .all(|r| r.target.matches("baseModels=").count() == 1));
    assert!(asked
        .iter()
        .all(|r| r.authorization.as_deref() == Some("Bearer civ-search-key")));
    assert!(asked.iter().all(|r| r.target.contains("query=style")));
    // The next page continues each base model from its own cursor.
    let next = found.next_cursor.expect("a next page");
    assert!(next.starts_with("multi:"));
    assert_eq!(next.matches("page2").count(), 4);
    let again = backend
        .search_civitai(SearchParams {
            cursor: Some(next),
            ..search_params("civitai")
        })
        .await
        .unwrap();
    assert_eq!(again.items.len(), 1);
    let second = site().requests("/api/v1/models");
    assert_eq!(second.len(), 8);
    assert!(second[4..]
        .iter()
        .all(|r| r.target.contains("cursor=page2")));
}

#[tokio::test]
async fn a_hugging_face_search_follows_the_next_links_and_sends_the_token() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path());
    let _keys = KeyCleanup::new(dir.path());
    backend
        .set_hf_token(Some("hf_search_token".into()))
        .unwrap();
    site().put(
        "/api/models",
        Route::json(&json!([
            {
                "id": "owner/hf-search", "downloads": 5, "likes": 1,
                "createdAt": "2025-10-28T22:07:46.000Z",
                "tags": ["lora", "text-to-image", "stable-diffusion-xl", "license:mit"],
                "siblings": [{"rfilename": "a.safetensors"}, {"rfilename": "images/1.png"}]
            },
            {"id": "owner/pipeline-only", "siblings": [{"rfilename": "unet/a.safetensors"}]}
        ]))
        .with_header(
            "Link",
            "<https://huggingface.co/api/models?cursor=zzz>; rel=\"next\"",
        ),
    );
    let found = backend
        .search_civitai(search_params("huggingface"))
        .await
        .unwrap();
    // The repository without a single model file is left out; the list keeps asking while pages are short.
    assert!(found.items.len() >= 2);
    assert_eq!(found.items[0].name, "hf-search");
    assert!(found.next_cursor.is_some());
    let asked = site().requests("/api/models");
    assert!(asked.len() >= 2);
    assert!(asked
        .iter()
        .all(|r| r.authorization.as_deref() == Some("Bearer hf_search_token")));
}

#[tokio::test]
async fn a_civitai_file_is_resolved_downloaded_and_given_its_cover_words_and_licence() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let _keys = KeyCleanup::new(dir.path());
    backend.set_civitai_key(Some("civ-dl-key".into())).unwrap();
    let base = &site().base;
    site().put_json(
        "/api/v1/model-versions/7001",
        &json!({
            "id": 7001, "modelId": 701, "baseModel": "SDXL 1.0",
            "model": {"type": "LORA"},
            "trainedWords": ["catstyle"],
            "images": [{"url": "https://image.civitai.com/k/u/original=true/1.jpeg", "type": "image", "nsfwLevel": 1},
                       {"url": "https://image.civitai.com/k/u/original=true/3.jpeg", "type": "image", "nsfwLevel": 1}],
            "files": [
                {"id": 8, "name": "other.safetensors", "sizeKB": 1.0, "downloadUrl": format!("{base}/dl/civ-other.safetensors")},
                {"id": 9, "name": "civ-style.safetensors", "primary": true, "sizeKB": 1.0,
                 "downloadUrl": format!("{base}/dl/civ-style.safetensors")}
            ]
        }),
    );
    site().put("/dl/civ-style.safetensors", Route::bytes(lora("civ-style")));
    site().put_json(
        "/api/v1/models/701",
        &json!({"allowCommercialUse": ["Image", "Rent"], "allowDerivatives": true}),
    );
    let job = backend.install_model("civitai:701/7001-9", None).unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    let model = model_named(&backend, "civ-style.safetensors");
    assert_eq!(model.kind, ModelType::Lora);
    assert_eq!(model.trigger_phrases, Some(vec!["catstyle".to_string()]));
    assert!(model
        .cover_image_url
        .as_deref()
        .unwrap()
        .contains("width=512"));
    assert_eq!(model.cover_image_urls.as_ref().map(Vec::len), Some(2));
    assert_eq!(
        model.page_url.as_deref(),
        Some("https://civitai.com/models/701?modelVersionId=7001")
    );
    assert_eq!(model.license.as_ref().unwrap().site, "civitai");
    let download = site().requests("/dl/civ-style.safetensors");
    assert_eq!(
        download[0].authorization.as_deref(),
        Some("Bearer civ-dl-key")
    );
}

#[tokio::test]
async fn a_civitai_model_with_one_mature_picture_keeps_it_as_a_marked_cover_and_no_set() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let base = &site().base;
    site().put_json(
        "/api/v1/model-versions/7101",
        &json!({
            "id": 7101, "modelId": 711, "baseModel": "SDXL 1.0",
            "model": {"type": "LORA"},
            "images": [{"url": "https://image.civitai.com/k/u/original=true/m.jpeg", "type": "image", "nsfwLevel": 4}],
            "files": [{"id": 9, "name": "civ-mature.safetensors", "primary": true, "sizeKB": 1.0,
                       "downloadUrl": format!("{base}/dl/civ-mature.safetensors")}]
        }),
    );
    site().put(
        "/dl/civ-mature.safetensors",
        Route::bytes(lora("civ-mature")),
    );
    let job = backend.install_model("civitai:711/7101-9", None).unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    let model = model_named(&backend, "civ-mature.safetensors");
    assert!(model.cover_image_url.is_some());
    assert_eq!(model.cover_mature, Some(true));
    // One picture is the cover itself: there is nothing to page through.
    assert_eq!(model.cover_image_urls, None);

    // A model with no picture at all has no cover and so no mature mark.
    site().put_json(
        "/api/v1/model-versions/7102",
        &json!({
            "id": 7102, "modelId": 712, "baseModel": "SDXL 1.0",
            "model": {"type": "LORA"},
            "files": [{"id": 9, "name": "civ-bare.safetensors", "primary": true, "sizeKB": 1.0,
                       "downloadUrl": format!("{base}/dl/civ-bare.safetensors")}]
        }),
    );
    site().put("/dl/civ-bare.safetensors", Route::bytes(lora("civ-bare")));
    let job = backend.install_model("civitai:712/7102-9", None).unwrap();
    assert_eq!(
        finish(&events, &job.id).await.status,
        ModelInstallStatus::Completed
    );
    let bare = model_named(&backend, "civ-bare.safetensors");
    assert_eq!((bare.cover_image_url, bare.cover_mature), (None, None));
}

#[tokio::test]
async fn a_civitai_model_page_resolves_to_the_named_version() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let base = &site().base;
    let checkpoint = {
        let header = serde_json::to_vec(&json!({
            "__metadata__": {"tag": "civ-page"},
            "model.diffusion_model.input_blocks.0.weight": {"dtype": "F16", "shape": [1], "data_offsets": [0, 2]},
        }))
        .unwrap();
        let mut out = (header.len() as u64).to_le_bytes().to_vec();
        out.extend_from_slice(&header);
        out.extend_from_slice(&[0, 0]);
        out
    };
    site().put_json(
        "/api/v1/models/702",
        &json!({
            "type": "Checkpoint",
            "modelVersions": [
                {"id": 7021, "baseModel": "SDXL 1.0", "files": [
                    {"id": 1, "name": "civ-first.safetensors", "downloadUrl": format!("{base}/dl/civ-first.safetensors")}]},
                {"id": 7022, "baseModel": "SDXL 1.0", "files": [
                    {"id": 2, "name": "civ-page.safetensors", "primary": true, "sizeKB": 1.0,
                     "downloadUrl": format!("{base}/dl/civ-page.safetensors")}]}
            ]
        }),
    );
    site().put("/dl/civ-page.safetensors", Route::bytes(checkpoint));
    let job = backend
        .install_model("https://civitai.com/models/702?modelVersionId=7022", None)
        .unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    assert_eq!(
        model_named(&backend, "civ-page.safetensors").kind,
        ModelType::Main
    );
    // An unknown version and an unknown file are told apart.
    let unknown_version = backend
        .install_model("https://civitai.com/models/702?modelVersionId=9999", None)
        .unwrap();
    let done = finish(&events, &unknown_version.id).await;
    assert!(done
        .error
        .unwrap()
        .contains("The Civitai version was not found"));
    site().put_json(
        "/api/v1/model-versions/7022",
        &json!({"files": [{"id": 2, "name": "x.safetensors", "downloadUrl": format!("{base}/dl/x")}]}),
    );
    let unknown_file = backend.install_model("civitai:702/7022-999", None).unwrap();
    let done = finish(&events, &unknown_file.id).await;
    assert!(done
        .error
        .unwrap()
        .contains("The Civitai file was not found"));
}

#[tokio::test]
async fn a_civitai_answer_that_is_not_ok_fails_the_install() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    site().put("/api/v1/model-versions/7031", Route::status(500));
    let job = backend.install_model("civitai:703/7031-1", None).unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Error);
    assert!(done.error.unwrap().contains("answered 500"));
}

#[tokio::test]
async fn a_hugging_face_file_is_downloaded_with_the_token_and_gets_cover_and_licence() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let _keys = KeyCleanup::new(dir.path());
    backend.set_hf_token(Some("hf_dl_token".into())).unwrap();
    site().put(
        "/owner/hf-lora/resolve/main/hf-lora.safetensors",
        Route::bytes(lora("hf-lora")),
    );
    site().put_json(
        "/api/models/owner/hf-lora",
        &json!({
            "tags": ["lora", "license:apache-2.0"],
            "siblings": [{"rfilename": "hf-lora.safetensors"}, {"rfilename": "images/1.png"}]
        }),
    );
    let job = backend
        .install_model("owner/hf-lora::hf-lora.safetensors", None)
        .unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    let model = model_named(&backend, "hf-lora.safetensors");
    assert_eq!(model.kind, ModelType::Lora);
    assert_eq!(
        model.cover_image_url.as_deref(),
        Some(format!("{}/owner/hf-lora/resolve/main/images/1.png", site().base).as_str())
    );
    assert_eq!(model.license.as_ref().unwrap().site, "huggingface");
    let download = site().requests("/owner/hf-lora/resolve/main/hf-lora.safetensors");
    assert_eq!(
        download[0].authorization.as_deref(),
        Some("Bearer hf_dl_token")
    );
}

#[tokio::test]
async fn a_repository_the_hub_does_not_know_still_installs_without_cover_or_licence() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    site().put(
        "/owner/hf-bare/resolve/main/hf-bare.safetensors",
        Route::bytes(lora("hf-bare")),
    );
    let job = backend
        .install_model("owner/hf-bare::hf-bare.safetensors", None)
        .unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    let model = model_named(&backend, "hf-bare.safetensors");
    assert!(model.cover_image_url.is_none() && model.license.is_none());
    // A repository whose API answer is not JSON gives no cover either.
    site().put("/api/models/owner/hf-junk", Route::bytes("not json"));
    site().put(
        "/owner/hf-junk/resolve/main/hf-junk.safetensors",
        Route::bytes(lora("hf-junk")),
    );
    let job = backend
        .install_model("owner/hf-junk::hf-junk.safetensors", None)
        .unwrap();
    finish(&events, &job.id).await;
    assert!(model_named(&backend, "hf-junk.safetensors")
        .cover_image_url
        .is_none());
}

/// Installs `bytes` as a model from a plain loopback address, so the registry holds a file Civitai is not told about.
async fn install_plain(
    backend: &Backend,
    events: &Events,
    file: &str,
    bytes: Vec<u8>,
) -> ModelConfig {
    site().put(&format!("/dl/{file}"), Route::bytes(bytes));
    let job = backend
        .install_model(&format!("{}/dl/{file}", site().base), None)
        .unwrap();
    let done = finish(events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    model_named(backend, file)
}

#[tokio::test]
async fn covers_and_licences_of_models_found_by_hash_are_filled_in() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let bytes = lora("by-hash");
    let hash = sha256_hex(&bytes);
    install_plain(&backend, &events, "by-hash.safetensors", bytes).await;
    site().put_json(
        &format!("/api/v1/model-versions/by-hash/{hash}"),
        &json!({
            "id": 802, "modelId": 801, "trainedWords": ["hashword"],
            "images": [{"url": "https://image.civitai.com/k/u/original=true/2.jpeg", "type": "image", "nsfwLevel": 1}]
        }),
    );
    site().put_json(
        "/api/v1/models/801",
        &json!({"allowCommercialUse": ["Image"]}),
    );
    backend.clone().fill_model_covers().await;
    backend.clone().fill_model_licenses().await;
    let model = model_named(&backend, "by-hash.safetensors");
    assert!(model.cover_image_url.is_some());
    // One picture only: nothing to page through, but the page is kept.
    assert!(model.cover_image_urls.is_none());
    assert_eq!(
        model.page_url.as_deref(),
        Some("https://civitai.com/models/801?modelVersionId=802")
    );
    assert_eq!(model.trigger_phrases, Some(vec!["hashword".to_string()]));
    assert_eq!(model.license.as_ref().unwrap().site, "civitai");
    assert!(events
        .lock()
        .unwrap()
        .iter()
        .any(|e| matches!(e, BackendEvent::ModelAdded { model } if model.path.ends_with("by-hash.safetensors") && model.license.is_some())));
}

#[tokio::test]
async fn a_file_civitai_does_not_know_is_asked_about_only_once() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let bytes = lora("unknown-hash");
    let hash = sha256_hex(&bytes);
    install_plain(&backend, &events, "unknown-hash.safetensors", bytes).await;
    let path = format!("/api/v1/model-versions/by-hash/{hash}");
    backend.clone().fill_model_covers().await;
    backend.clone().fill_model_covers().await;
    backend.clone().fill_model_licenses().await;
    backend.clone().fill_model_licenses().await;
    // 404 is an answer ("not on Civitai"), remembered per question: once for covers, once for licences.
    assert_eq!(site().requests(&path).len(), 2);
    let model = model_named(&backend, "unknown-hash.safetensors");
    assert!(model.cover_image_url.is_none() && model.license.is_none());
}

#[tokio::test]
async fn a_failing_lookup_stops_the_fill_and_is_retried_later() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let bytes = lora("failing-hash");
    let hash = sha256_hex(&bytes);
    install_plain(&backend, &events, "failing-hash.safetensors", bytes).await;
    let path = format!("/api/v1/model-versions/by-hash/{hash}");
    site().put(&path, Route::status(500));
    backend.clone().fill_model_covers().await;
    backend.clone().fill_model_licenses().await;
    assert!(model_named(&backend, "failing-hash.safetensors")
        .cover_image_url
        .is_none());
    // Not remembered as checked, so the next start asks again.
    backend.clone().fill_model_covers().await;
    assert_eq!(site().requests(&path).len(), 3);
}

#[tokio::test]
async fn a_hugging_face_model_with_a_page_address_gets_its_licence_from_the_hub() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    // Put the file in place from a loopback address, then record a Hugging Face address as its source.
    let model = install_plain(
        &backend,
        &events,
        "hf-source.safetensors",
        lora("hf-source"),
    )
    .await;
    backend
        .update_model(
            &model.key,
            json!({"source": "https://huggingface.co/owner/hf-source/resolve/main/hf-source.safetensors", "license": null}),
        )
        .unwrap();
    site().put_json(
        "/api/models/owner/hf-source",
        &json!({"tags": ["license:cc-by-nc-4.0"]}),
    );
    backend.clone().fill_model_licenses().await;
    let model = model_named(&backend, "hf-source.safetensors");
    assert_eq!(model.license.as_ref().unwrap().site, "huggingface");
}

#[tokio::test]
async fn an_install_started_again_continues_the_part_of_the_stopped_one() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let file = "continued.safetensors";
    let bytes = lora("continued");
    let cut = bytes.len() / 2;
    let source = format!("{}/dl/{file}", site().base);
    // The first answer announces the whole file and ends after half of it, so the part and its record are kept.
    site().put(
        &format!("/dl/{file}"),
        Route::bytes(bytes[..cut].to_vec())
            .announcing(bytes.len())
            .with_header("ETag", "\"continued-1\""),
    );
    let first = backend.install_model(&source, None).unwrap();
    let stopped = finish(&events, &first.id).await;
    assert_eq!(stopped.status, ModelInstallStatus::Error, "{stopped:?}");

    site().put(
        &format!("/dl/{file}"),
        Route::bytes(bytes.clone()).with_header("ETag", "\"continued-1\""),
    );
    let second = backend.install_model(&source, None).unwrap();
    let done = finish(&events, &second.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");

    let asked = site().requests(&format!("/dl/{file}"));
    assert_eq!(
        asked.last().and_then(|s| s.range.clone()),
        Some(format!("bytes={cut}-")),
        "the second install asks for the rest only"
    );
    let model = model_named(&backend, file);
    assert_eq!(std::fs::read(&model.path).unwrap(), bytes);
}

#[tokio::test]
async fn a_second_install_of_a_source_that_is_running_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let file = "twice.safetensors";
    site().put(&format!("/dl/{file}"), Route::bytes(lora("twice")));
    let source = format!("{}/dl/{file}", site().base);
    let first = backend.install_model(&source, None).unwrap();
    // The first job is only queued until the runtime runs it, so the same source is still running here.
    assert!(backend.install_model(&source, None).is_err());
    let done = finish(&events, &first.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    // Once the first has finished, the same source is no longer running: it is refused as an existing file instead.
    let again = backend.install_model(&source, None).unwrap();
    let done = finish(&events, &again.id).await;
    assert_eq!(done.status, ModelInstallStatus::Error, "{done:?}");
    assert!(done.error.unwrap().contains("already in the models folder"));
}
