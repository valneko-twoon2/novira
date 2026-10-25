//! `ComfyEngine` against a fake ComfyUI server (HTTP + WebSocket) that follows the real routes and messages.
//! This file holds the server and the basic runs; `guidance` covers masks, control layers and reference images.
mod guidance;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Multipart, Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{
    Engine, EngineError, EngineJob, EngineOutput, EngineProgress, GraphJob, JobGuidance,
};
use novira_core::types::{ComfyRef, GenerationMetadata};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::broadcast;
use tokio_util::sync::CancellationToken;

#[derive(Default)]
struct Seen {
    prompts: Vec<Value>,
    uploads: Vec<usize>,
    interrupts: Vec<Value>,
    deletes: Vec<Value>,
    /// Bodies of `POST /free`.
    frees: Vec<Value>,
    done: Vec<(String, String)>,
}

#[derive(Clone)]
struct Fake {
    seen: Arc<Mutex<Seen>>,
    ws: broadcast::Sender<Message>,
    send_ws: bool,
    /// The ComfyUI_IPAdapter_plus pack is loaded.
    ipadapter: bool,
}

fn png() -> Vec<u8> {
    let img = image::RgbImage::from_pixel(16, 8, image::Rgb([1, 2, 3]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

async fn models(Path(folder): Path<String>) -> Json<Value> {
    Json(match folder.as_str() {
        "checkpoints" => json!(["sdxl\\base.safetensors"]),
        "loras" => json!(["detail.safetensors"]),
        "controlnet" => json!(["union-xl.safetensors"]),
        "ipadapter" => json!(["ip-adapter_sdxl_vit-h.safetensors"]),
        "clip_vision" => json!(["CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"]),
        _ => json!([]),
    })
}

async fn object_info() -> Json<Value> {
    Json(json!({ "KSampler": { "input": { "required": {
        "sampler_name": [["euler", "euler_ancestral", "dpmpp_2m"]],
        "scheduler": [["normal", "karras"]]
    } } },
    "CheckpointLoaderSimple": {}, "CLIPTextEncode": {}, "LoadImage": {}, "PreviewImage": {}, "FilmGrain": {} }))
}

async fn upload(State(f): State<Fake>, mut form: Multipart) -> Json<Value> {
    let mut size = 0;
    while let Some(field) = form.next_field().await.unwrap() {
        if field.name() == Some("image") {
            size = field.bytes().await.unwrap().len();
        }
    }
    let mut seen = f.seen.lock().unwrap();
    seen.uploads.push(size);
    let name = format!("up{}.png", seen.uploads.len());
    Json(json!({ "name": name, "subfolder": "", "type": "input" }))
}

async fn prompt(State(f): State<Fake>, Json(body): Json<Value>) -> Response {
    let graph = body["prompt"].clone();
    let nodes = graph.as_object().unwrap();
    let ckpt = nodes
        .values()
        .find(|n| n["class_type"] == "CheckpointLoaderSimple");
    if ckpt.is_some_and(|c| c["inputs"]["ckpt_name"] == "bad.safetensors") {
        let err = json!({ "error": { "message": "Prompt outputs failed validation" }, "node_errors": { "1": {
            "class_type": "CheckpointLoaderSimple", "errors": [{ "message": "Value not in list", "details": "ckpt_name" }] } } });
        return (StatusCode::BAD_REQUEST, Json(err)).into_response();
    }
    // The output node, marked by what it reports: a picture, text (`PreviewAny`) or nothing (`SaveLoRA`).
    let output = nodes
        .iter()
        .find_map(|(id, n)| match n["class_type"].as_str() {
            Some("PreviewImage" | "LossGraphNode") => Some(id.clone()),
            Some("PreviewAny") => Some(format!("text:{id}")),
            Some("SaveLoRA") => Some(format!("none:{id}")),
            _ => None,
        })
        .unwrap();
    let text = nodes
        .values()
        .find(|n| n["class_type"] == "CLIPTextEncode")
        .and_then(|n| n["inputs"]["text"].as_str())
        .unwrap_or_default()
        .to_string();
    let id = format!("p{}", f.seen.lock().unwrap().prompts.len() + 1);
    f.seen.lock().unwrap().prompts.push(graph);
    let pid = id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        if text.contains("[hang]") {
            return;
        }
        if f.send_ws {
            // Another client's progress must be ignored.
            let _ = f.ws.send(Message::Text(json!({ "type": "progress", "data": { "value": 9, "max": 9, "prompt_id": "other" } }).to_string().into()));
            for v in 1..=3 {
                let _ = f.ws.send(Message::Text(json!({ "type": "progress", "data": { "value": v, "max": 3, "prompt_id": pid } }).to_string().into()));
            }
            let mut frame = 1u32.to_be_bytes().to_vec();
            frame.extend(1u32.to_be_bytes());
            frame.extend([0xFF, 0xD8, 0xFF, 0xE0]);
            let _ = f.ws.send(Message::Binary(frame.into()));
        }
        if text.contains("[error]") || text.contains("[broken]") {
            let kind = if text.contains("[broken]") {
                "broken"
            } else {
                "error"
            };
            f.seen.lock().unwrap().done.push((pid.clone(), kind.into()));
            let _ = f.ws.send(Message::Text(json!({ "type": "execution_error", "data": { "prompt_id": pid, "node_type": "KSampler", "exception_message": exception(kind) } }).to_string().into()));
            return;
        }
        f.seen.lock().unwrap().done.push((pid.clone(), output));
        if f.send_ws {
            let _ = f.ws.send(Message::Text(
                json!({ "type": "executing", "data": { "node": null, "prompt_id": pid } })
                    .to_string()
                    .into(),
            ));
        }
    });
    Json(json!({ "prompt_id": id, "number": 1, "node_errors": {} })).into_response()
}

/// The exception text of a failing prompt: `[error]` runs out of memory, `[broken]` fails otherwise.
fn exception(kind: &str) -> &'static str {
    if kind == "broken" {
        "mat1 and mat2 shapes cannot be multiplied"
    } else {
        "CUDA out of memory"
    }
}

async fn history(State(f): State<Fake>, Path(id): Path<String>) -> Json<Value> {
    let seen = f.seen.lock().unwrap();
    let Some((_, node)) = seen.done.iter().find(|(p, _)| *p == id) else {
        return Json(json!({}));
    };
    if node == "error" || node == "broken" {
        return Json(
            json!({ id.clone(): { "outputs": {}, "status": { "status_str": "error", "completed": false,
            "messages": [["execution_error", { "node_type": "KSampler", "exception_message": exception(node) }]] } } }),
        );
    }
    let outputs = if let Some(node) = node.strip_prefix("text:") {
        json!({ node: { "text": ["1girl, solo, blue hair, smile"] } })
    } else if node.starts_with("none:") {
        json!({})
    } else {
        json!({ node.clone(): { "images": [{ "filename": "r.png", "subfolder": "", "type": "temp" }] } })
    };
    Json(
        json!({ id.clone(): { "outputs": outputs, "status": { "status_str": "success", "completed": true, "messages": [] } } }),
    )
}

async fn ws(State(f): State<Fake>, upgrade: WebSocketUpgrade) -> Response {
    upgrade.on_upgrade(move |mut socket: WebSocket| async move {
        let mut rx = f.ws.subscribe();
        let _ = socket
            .send(Message::Text(
                json!({ "type": "status", "data": { "status": {} } })
                    .to_string()
                    .into(),
            ))
            .await;
        while let Ok(msg) = rx.recv().await {
            if socket.send(msg).await.is_err() {
                break;
            }
        }
    })
}

async fn serve(send_ws: bool) -> (String, Arc<Mutex<Seen>>) {
    serve_with(send_ws, false).await
}

async fn serve_with(send_ws: bool, ipadapter: bool) -> (String, Arc<Mutex<Seen>>) {
    let fake = Fake {
        seen: Arc::default(),
        ws: broadcast::channel(64).0,
        send_ws,
        ipadapter,
    };
    let seen = fake.seen.clone();
    let mut app = Router::new()
        .route(
            "/system_stats",
            get(|| async { Json(json!({ "system": {} })) }),
        )
        .route("/models/{folder}", get(models))
        .route("/object_info/KSampler", get(object_info))
        .route(
            "/object_info/IPAdapterAdvanced",
            get(|State(f): State<Fake>| async move {
                if f.ipadapter {
                    Json(json!({ "IPAdapterAdvanced": {} })).into_response()
                } else {
                    StatusCode::NOT_FOUND.into_response()
                }
            }),
        )
        .route("/object_info", get(object_info))
        .route("/upload/image", post(upload))
        .route("/prompt", post(prompt))
        .route("/history/{id}", get(history))
        .route("/view", get(|| async { png() }));
    let s1 = fake.seen.clone();
    let s2 = fake.seen.clone();
    let s3 = fake.seen.clone();
    app = app
        .route(
            "/interrupt",
            post(move |Json(b): Json<Value>| async move {
                s1.lock().unwrap().interrupts.push(b);
            }),
        )
        .route(
            "/queue",
            post(move |Json(b): Json<Value>| async move {
                s2.lock().unwrap().deletes.push(b);
            }),
        )
        .route(
            "/free",
            post(move |Json(b): Json<Value>| async move {
                s3.lock().unwrap().frees.push(b);
            }),
        );
    if send_ws {
        app = app.route("/ws", get(ws));
    }
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app.with_state(fake)).await.unwrap() });
    (format!("http://{addr}"), seen)
}

fn job(prompt: &str, ckpt: &str, with_image: bool) -> EngineJob {
    let params: GenerationMetadata = serde_json::from_value(json!({
        "generationMode": if with_image { "img2img" } else { "txt2img" }, "positivePrompt": prompt, "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 1, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
        "scheduler": "euler_a", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": []
    }))
    .unwrap();
    EngineJob {
        split: None,
        params,
        checkpoint: ComfyRef {
            folder: "checkpoints".into(),
            name: ckpt.into(),
        },
        vae: None,
        loras: vec![(
            ComfyRef {
                folder: "loras".into(),
                name: "detail.safetensors".into(),
            },
            0.5,
        )],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image: with_image.then(png),
        graph: None,
        guidance: JobGuidance::default(),
    }
}

fn engine(url: &str) -> ComfyEngine {
    ComfyEngine::new(url, None, Duration::from_secs(1)).unwrap()
}

#[tokio::test]
async fn generates_with_progress_previews_and_an_uploaded_source() {
    let (url, seen) = serve(true).await;
    let e = engine(&url);
    let j = job("a cat", "sdxl\\base.safetensors", true);
    e.validate(&j).await.unwrap();
    let events: Arc<Mutex<Vec<EngineProgress>>> = Arc::default();
    let sink = events.clone();
    let progress = move |p: EngineProgress| sink.lock().unwrap().push(p);
    let out = e
        .generate(&j, &progress, &CancellationToken::new())
        .await
        .unwrap();
    let EngineOutput::Image(out) = out else {
        panic!("an image job gives an image")
    };
    assert_eq!(image::load_from_memory(&out).unwrap().width(), 16);

    let seen = seen.lock().unwrap();
    assert_eq!(seen.uploads.len(), 1);
    let graph = &seen.prompts[0];
    assert!(graph
        .as_object()
        .unwrap()
        .values()
        .any(|n| n["class_type"] == "LoadImage" && n["inputs"]["image"] == "up1.png"));
    let ev = events.lock().unwrap();
    let steps: Vec<u32> = ev
        .iter()
        .filter(|p| p.message == "denoise" && p.preview.is_none())
        .map(|p| p.step)
        .collect();
    assert_eq!(steps, vec![1, 2, 3], "progress of other prompts is ignored");
    assert!(ev.iter().any(|p| p
        .preview
        .as_deref()
        .is_some_and(|u| u.starts_with("data:image/jpeg;base64,"))));
}

#[tokio::test]
async fn works_by_polling_when_there_is_no_websocket() {
    let (url, _) = serve(false).await;
    let out = engine(&url)
        .generate(
            &job("a dog", "sdxl\\base.safetensors", false),
            &|_| {},
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert!(matches!(out, EngineOutput::Image(b) if !b.is_empty()));
}

#[tokio::test]
async fn rejected_prompts_and_execution_errors_carry_the_reason() {
    let (url, seen) = serve(true).await;
    let e = engine(&url);
    let err = e
        .generate(
            &job("x", "bad.safetensors", false),
            &|_| {},
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert_eq!(
        err,
        EngineError::Failed(
            "Prompt outputs failed validation / CheckpointLoaderSimple: ckpt_name".into()
        )
    );
    let err = e
        .generate(
            &job("[error]", "sdxl\\base.safetensors", false),
            &|_| {},
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert_eq!(
        err,
        EngineError::Failed("ComfyUI KSampler: CUDA out of memory".into())
    );
    assert_eq!(
        seen.lock().unwrap().frees,
        vec![json!({ "unload_models": true, "free_memory": true })],
        "running out of memory asks ComfyUI to free it for the next job"
    );
}

#[tokio::test]
async fn memory_is_freed_after_running_out_of_it_and_not_after_other_errors() {
    for send_ws in [true, false] {
        let (url, seen) = serve(send_ws).await;
        let e = engine(&url);
        let err = e
            .generate(
                &job("[broken]", "sdxl\\base.safetensors", false),
                &|_| {},
                &CancellationToken::new(),
            )
            .await
            .unwrap_err();
        assert!(err.to_string().contains("mat1 and mat2"), "{err}");
        assert!(seen.lock().unwrap().frees.is_empty(), "ws {send_ws}");
        // Without the WebSocket the error comes from the history entry; memory is freed all the same.
        e.generate(
            &job("[error]", "sdxl\\base.safetensors", false),
            &|_| {},
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
        assert_eq!(seen.lock().unwrap().frees.len(), 1, "ws {send_ws}");
    }
}

#[tokio::test]
async fn validation_names_models_comfyui_cannot_see_and_unknown_samplers() {
    let (url, _) = serve(true).await;
    let e = engine(&url);
    let err = e
        .validate(&job("x", "other.safetensors", false))
        .await
        .unwrap_err()
        .to_string();
    assert!(err.contains("other.safetensors"), "{err}");
    // Separator differences do not matter.
    e.validate(&job("x", "sdxl/base.safetensors", false))
        .await
        .unwrap();
    let mut j = job("x", "sdxl\\base.safetensors", false);
    j.params.scheduler = "dpmpp_sde_k".into();
    assert!(e
        .validate(&j)
        .await
        .unwrap_err()
        .to_string()
        .contains("dpmpp_sde"));
}

#[tokio::test]
async fn cancel_interrupts_only_our_prompt() {
    let (url, seen) = serve(true).await;
    let e = engine(&url);
    let cancel = CancellationToken::new();
    let c2 = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(200)).await;
        c2.cancel();
    });
    let err = e
        .generate(
            &job("[hang]", "sdxl\\base.safetensors", false),
            &|_| {},
            &cancel,
        )
        .await
        .unwrap_err();
    assert_eq!(err, EngineError::Cancelled);
    let seen = seen.lock().unwrap();
    assert_eq!(seen.interrupts, vec![json!({ "prompt_id": "p1" })]);
    assert_eq!(seen.deletes, vec![json!({ "delete": ["p1"] })]);
}

#[tokio::test]
async fn an_unreachable_server_is_reported() {
    let e = engine("http://127.0.0.1:9");
    let err = e
        .generate(&job("x", "a", false), &|_| {}, &CancellationToken::new())
        .await
        .unwrap_err();
    assert!(err.to_string().contains("not reachable"), "{err}");
}

#[tokio::test]
async fn node_defs_are_the_object_info_of_the_server() {
    let (url, _) = serve(true).await;
    let defs = engine(&url)
        .node_defs(&CancellationToken::new())
        .await
        .unwrap();
    assert!(defs["KSampler"]["input"]["required"]["sampler_name"].is_array());
}

/// An editor-built prompt: the pack node FilmGrain sits between the loaded picture and the preview.
fn graph_job(pack_class: &str) -> EngineJob {
    let mut j = job("a cat", "sdxl\\base.safetensors", false);
    j.params.generation_mode = novira_core::types::GenerationMode::Graph;
    j.graph = Some(GraphJob {
        prompt: json!({
            "ckpt": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "sdxl\\base.safetensors" } },
            "text": { "class_type": "CLIPTextEncode", "inputs": { "text": "a cat", "clip": ["ckpt", 1] } },
            "src": { "class_type": "LoadImage", "inputs": { "image": { "$image": "photo.png" } } },
            "fx": { "class_type": pack_class, "inputs": { "image": ["src", 0], "intensity": 0.4 } },
            "out": { "class_type": "PreviewImage", "inputs": { "images": ["fx", 0] } }
        }),
        outputs: vec!["out".into()],
        models: vec![ComfyRef {
            folder: "checkpoints".into(),
            name: "sdxl\\base.safetensors".into(),
        }],
        images: vec![("photo.png".into(), png())],
        thumbnail: None,
        no_result: false,
    });
    j
}

#[tokio::test]
async fn graph_jobs_upload_their_pictures_and_run_the_editor_prompt() {
    let (url, seen) = serve(true).await;
    let e = engine(&url);
    let j = graph_job("FilmGrain");
    e.validate(&j).await.unwrap();
    let out = e
        .generate(&j, &|_| {}, &CancellationToken::new())
        .await
        .unwrap();
    assert!(matches!(out, EngineOutput::Image(_)));
    let seen = seen.lock().unwrap();
    assert_eq!(seen.uploads.len(), 1);
    let prompt = &seen.prompts[0];
    assert_eq!(prompt["src"]["inputs"]["image"], "up1.png");
    assert_eq!(
        prompt["fx"],
        json!({ "class_type": "FilmGrain", "inputs": { "image": ["src", 0], "intensity": 0.4 } })
    );
}

#[tokio::test]
async fn graph_jobs_name_the_nodes_comfyui_does_not_have() {
    let (url, seen) = serve(true).await;
    let err = engine(&url)
        .validate(&graph_job("FaceRig"))
        .await
        .unwrap_err();
    assert!(err.to_string().contains("no FaceRig node"), "{err}");
    assert!(err.to_string().contains("install"), "{err}");
    assert!(seen.lock().unwrap().prompts.is_empty());
}

/// A job whose output node is `class`, fed by a loaded picture.
fn output_job(class: &str, no_result: bool) -> EngineJob {
    let mut j = job("", "sdxl\\base.safetensors", false);
    j.params.generation_mode = novira_core::types::GenerationMode::Graph;
    j.graph = Some(GraphJob {
        prompt: json!({
            "src": { "class_type": "LoadImage", "inputs": { "image": { "$image": "photo.png" } } },
            "out": { "class_type": class, "inputs": { "source": ["src", 0] } }
        }),
        outputs: vec!["out".into()],
        models: vec![],
        images: vec![("photo.png".into(), png())],
        thumbnail: None,
        no_result,
    });
    j
}

#[tokio::test]
async fn a_text_output_comes_back_as_text() {
    for ws in [true, false] {
        let (url, _) = serve(ws).await;
        let out = engine(&url)
            .generate(
                &output_job("PreviewAny", false),
                &|_| {},
                &CancellationToken::new(),
            )
            .await
            .unwrap();
        assert_eq!(
            out,
            EngineOutput::Text("1girl, solo, blue hair, smile".into())
        );
    }
}

#[tokio::test]
async fn a_job_that_keeps_its_file_in_comfyui_finishes_with_nothing_to_fetch() {
    let (url, _) = serve(true).await;
    let e = engine(&url);
    let out = e
        .generate(
            &output_job("SaveLoRA", true),
            &|_| {},
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(out, EngineOutput::Nothing);
    let err = e
        .generate(
            &output_job("SaveLoRA", false),
            &|_| {},
            &CancellationToken::new(),
        )
        .await
        .unwrap_err();
    assert!(err.to_string().contains("without a result file"), "{err}");
}

#[tokio::test]
async fn a_job_that_keeps_its_file_in_comfyui_brings_back_the_picture_its_first_output_showed() {
    let (url, _) = serve(true).await;
    let out = engine(&url)
        .generate(
            &output_job("LossGraphNode", true),
            &|_| {},
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert!(matches!(out, EngineOutput::Image(_)), "{out:?}");
}
