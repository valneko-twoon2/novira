//! `ComfyEngine` against a ComfyUI that answers some routes with errors: refused uploads of a source, mask, control or
//! reference picture, a node list that cannot be read, a history that fails while polling, a failed run that is only
//! noticed after the WebSocket-less polling, a video whose first frame is missing, a graph that cannot be built, and
//! preview frames that are cut short. The other failure modes are in `comfy_client_errors`.
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use novira_core::comfy::client::parse_preview;
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{
    ControlJob, Engine, EngineError, EngineJob, EngineOutput, GraphJob, JobGuidance, RefJob,
};
use novira_core::types::{ComfyRef, ControlMode, GenerationMetadata, RefImageMethod};
use serde_json::{json, Value};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
struct Cfg {
    /// `object_info` (the list of every node) answers HTTP 500.
    node_list_fails: bool,
    /// What `/history/<id>` answers: `None` is HTTP 500.
    history: Option<Value>,
}

fn png() -> Vec<u8> {
    let img = image::RgbImage::from_pixel(8, 8, image::Rgb([1, 2, 3]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

async fn serve(cfg: Cfg) -> String {
    let app = Router::new()
        .route(
            "/system_stats",
            get(|| async { Json(json!({ "system": {} })) }),
        )
        .route(
            "/models/{folder}",
            get(|| async { Json(json!(["base.safetensors"])) }),
        )
        .route(
            "/object_info",
            get(|State(c): State<Cfg>| async move {
                if c.node_list_fails {
                    StatusCode::INTERNAL_SERVER_ERROR.into_response()
                } else {
                    Json(json!({ "LoadImage": {}, "PreviewImage": {}, "VideoOut": {} }))
                        .into_response()
                }
            }),
        )
        .route(
            "/upload/image",
            post(|| async { StatusCode::INTERNAL_SERVER_ERROR }),
        )
        .route(
            "/prompt",
            post(|| async { Json(json!({ "prompt_id": "p1", "node_errors": {} })) }),
        )
        .route(
            "/history/{id}",
            get(|State(c): State<Cfg>, Path(id): Path<String>| async move {
                match &c.history {
                    Some(entry) => Json(json!({ id: entry })).into_response(),
                    None => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
                }
            }),
        )
        .route("/view", get(|| async { png().into_response() }))
        .with_state(cfg);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    url
}

fn healthy() -> Cfg {
    Cfg {
        node_list_fails: false,
        history: Some(
            json!({ "outputs": {}, "status": { "status_str": "success", "completed": true, "messages": [] } }),
        ),
    }
}

fn params(mode: &str) -> GenerationMetadata {
    serde_json::from_value(json!({
        "generationMode": mode, "positivePrompt": "a cat", "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 1, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
        "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false,
        "loras": []
    }))
    .unwrap()
}

fn model() -> ComfyRef {
    ComfyRef {
        folder: "checkpoints".into(),
        name: "base.safetensors".into(),
    }
}

fn job(mode: &str) -> EngineJob {
    EngineJob {
        split: None,
        params: params(mode),
        checkpoint: model(),
        vae: None,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image: None,
        graph: None,
        guidance: JobGuidance::default(),
    }
}

fn graph_job(no_result: bool, thumbnail: Option<&str>) -> EngineJob {
    let mut j = job("txt2img");
    j.graph = Some(GraphJob {
        prompt: json!({
            "1": { "class_type": "LoadImage", "inputs": { "image": "x.png" } },
            "9": { "class_type": "PreviewImage", "inputs": { "images": ["1", 0] } }
        }),
        outputs: vec!["9".into()],
        models: vec![],
        images: vec![],
        thumbnail: thumbnail.map(str::to_string),
        no_result,
    });
    j
}

fn engine(url: &str) -> ComfyEngine {
    ComfyEngine::new(url, None, Duration::from_secs(1)).unwrap()
}

async fn failure(engine: &ComfyEngine, job: &EngineJob) -> String {
    match engine
        .generate(job, &|_| {}, &CancellationToken::new())
        .await
    {
        Err(EngineError::Failed(m)) => m,
        other => panic!("expected a failure, got {other:?}"),
    }
}

// Uploads -------------------------------------------------------------------------------------------------------

#[tokio::test]
async fn a_refused_upload_of_the_source_mask_control_or_reference_picture_fails_the_job() {
    let url = serve(healthy()).await;
    let engine = engine(&url);

    let mut source = job("img2img");
    source.init_image = Some(png());
    assert!(failure(&engine, &source)
        .await
        .contains("upload answered 500"));

    let mut mask = job("inpaint");
    mask.guidance.mask = Some(png());
    assert!(failure(&engine, &mask)
        .await
        .contains("upload answered 500"));

    let mut control = job("txt2img");
    control.guidance.controls = vec![ControlJob {
        model: model(),
        image: png(),
        weight: 1.0,
        begin_end: [0.0, 1.0],
        mode: ControlMode::Balanced,
        union_type: None,
    }];
    assert!(failure(&engine, &control)
        .await
        .contains("upload answered 500"));

    let mut reference = job("txt2img");
    reference.guidance.refs = vec![RefJob {
        model: model(),
        clip_vision: model(),
        image: png(),
        weight: 1.0,
        begin_end: [0.0, 1.0],
        method: RefImageMethod::Style,
        region: None,
    }];
    assert!(failure(&engine, &reference)
        .await
        .contains("upload answered 500"));
}

#[tokio::test]
async fn a_video_job_without_its_text_encoder_cannot_be_built() {
    let url = serve(healthy()).await;
    let message = failure(&engine(&url), &job("video")).await;
    assert!(message.contains("text encoder"), "{message}");
}

// Reading from ComfyUI ------------------------------------------------------------------------------------------

#[tokio::test]
async fn a_node_list_that_cannot_be_read_fails_the_check_of_an_editor_graph() {
    let url = serve(Cfg {
        node_list_fails: true,
        ..healthy()
    })
    .await;
    let err = engine(&url)
        .validate(&graph_job(false, None))
        .await
        .unwrap_err();
    assert!(
        err.to_string().contains("object_info answered 500"),
        "{err}"
    );
}

#[tokio::test]
async fn a_history_that_fails_while_the_job_is_polled_fails_the_job() {
    let url = serve(Cfg {
        history: None,
        ..healthy()
    })
    .await;
    // No WebSocket on this server, so the history is polled about once a second.
    let message = failure(&engine(&url), &graph_job(false, None)).await;
    assert!(message.contains("history/p1 answered 500"), "{message}");
}

#[tokio::test]
async fn a_job_that_ended_with_an_error_without_a_result_to_fetch_reports_it() {
    let url = serve(Cfg {
        history: Some(json!({
            "outputs": {},
            "status": { "status_str": "error", "completed": true, "messages": [
                ["execution_error", { "node_type": "KSampler", "exception_message": "boom" }]
            ] }
        })),
        ..healthy()
    })
    .await;
    let message = failure(&engine(&url), &graph_job(true, None)).await;
    assert_eq!(message, "ComfyUI KSampler: boom");
}

#[tokio::test]
async fn a_video_whose_first_frame_is_missing_is_an_error() {
    let file = json!({ "filename": "v.mp4", "subfolder": "", "type": "temp" });
    let url = serve(Cfg {
        history: Some(json!({
            "outputs": { "9": { "videos": [file] } },
            "status": { "status_str": "success", "completed": true, "messages": [] }
        })),
        ..healthy()
    })
    .await;
    let message = failure(&engine(&url), &graph_job(false, Some("8"))).await;
    assert!(message.contains("without a result file"), "{message}");
}

#[tokio::test]
async fn a_picture_job_whose_run_is_only_polled_still_finishes() {
    let url = serve(Cfg {
        history: Some(json!({
            "outputs": { "9": { "images": [{ "filename": "r.png", "subfolder": "", "type": "temp" }] } },
            "status": { "status_str": "success", "completed": true, "messages": [] }
        })),
        ..healthy()
    })
    .await;
    let out = engine(&url)
        .generate(&graph_job(false, None), &|_| {}, &CancellationToken::new())
        .await
        .unwrap();
    assert!(matches!(out, EngineOutput::Image(_)), "{out:?}");
}

// Preview frames ------------------------------------------------------------------------------------------------

#[test]
fn preview_frames_that_are_cut_short_give_no_picture() {
    // A known event without its kind, with a kind but no picture, with a header length that runs past the end, and
    // with a header that is not JSON.
    assert!(parse_preview(&[0, 0, 0, 1, 0, 0]).is_none());
    assert!(parse_preview(&[0, 0, 0, 1, 0, 0, 0, 2]).is_none());
    assert!(parse_preview(&[0, 0, 0, 4, 0, 0]).is_none());
    let mut long_header = 4u32.to_be_bytes().to_vec();
    long_header.extend(100u32.to_be_bytes());
    long_header.extend(*b"{}");
    assert!(parse_preview(&long_header).is_none());
    let mut not_json = 4u32.to_be_bytes().to_vec();
    not_json.extend(3u32.to_be_bytes());
    not_json.extend(b"abc");
    not_json.extend([1, 2, 3]);
    assert!(parse_preview(&not_json).is_none());
}

// Jobs that cannot be built ----------------------------------------------------------------------------------------

#[tokio::test]
async fn logo_and_video_jobs_with_something_missing_are_refused_before_anything_is_sent() {
    let url = serve(healthy()).await;
    let engine = engine(&url);
    let with_models = |mode: &str, encoder: bool, vae: bool| {
        let mut j = job(mode);
        if encoder {
            j.text_encoder = Some(ComfyRef {
                folder: "text_encoders".into(),
                name: "base.safetensors".into(),
            });
        }
        if vae {
            j.vae = Some(ComfyRef {
                folder: "vae".into(),
                name: "base.safetensors".into(),
            });
        }
        j
    };
    let refused = |r: Result<(), EngineError>| r.unwrap_err().to_string();
    assert!(
        refused(engine.validate(&with_models("logo", false, true)).await)
            .contains("logo text encoder")
    );
    assert!(refused(engine.validate(&with_models("logo", true, false)).await).contains("logo VAE"));
    let mut video = with_models("video", true, true);
    video.params.scheduler = "no-such-scheduler".into();
    assert!(refused(engine.validate(&video).await).contains("is not available in ComfyUI"));
}

#[test]
fn every_scheduler_name_maps_to_a_sampler_and_a_scheduler() {
    use novira_core::comfy::graph::sampler_for;
    for (name, expected) in [
        ("euler", ("euler", "normal")),
        ("euler_a", ("euler_ancestral", "normal")),
        ("euler_k", ("euler", "karras")),
        ("dpmpp_2m", ("dpmpp_2m", "normal")),
        ("dpmpp_2m_k", ("dpmpp_2m", "karras")),
        ("dpmpp_2m_sde_k", ("dpmpp_2m_sde", "karras")),
        ("dpmpp_sde_k", ("dpmpp_sde", "karras")),
        ("heun", ("heun", "normal")),
        ("lms", ("lms", "normal")),
        ("ddim", ("ddim", "ddim_uniform")),
        ("unipc", ("uni_pc", "normal")),
        ("lcm", ("lcm", "sgm_uniform")),
    ] {
        assert_eq!(sampler_for(name), Some(expected), "{name}");
    }
    assert_eq!(sampler_for("nope"), None);
}
