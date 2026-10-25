//! The wire shape the frontend's `types.ts` relies on: field casing, optional fields, defaults. Enum strings and
//! full samples of every wire type are checked against shared fixtures in `tests/contract/`.
use super::*;
use serde_json::json;

fn metadata() -> Value {
    json!({
        "generationMode": "txt2img", "positivePrompt": "a cat", "negativePrompt": "", "modelKey": "m",
        "modelName": "M", "vaeKey": null, "seed": 1, "steps": 20, "cfgScale": 7.0, "cfgRescale": 0.0,
        "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false,
        "seamlessY": false, "loras": [{"key": "l", "weight": 0.5, "isEnabled": true}]
    })
}

#[test]
fn metadata_round_trips_in_camel_case_and_keeps_unknown_fields() {
    let mut input = metadata();
    input["futureField"] = json!({"nested": [1, 2]});
    input["draftAt"] = json!(0.5);
    let parsed: GenerationMetadata = serde_json::from_value(input.clone()).unwrap();
    assert_eq!(parsed.generation_mode, GenerationMode::Txt2img);
    assert_eq!(parsed.cfg_scale, 7.0);
    assert!(parsed.loras[0].is_enabled);
    assert_eq!(parsed.draft_at, Some(0.5));
    assert_eq!(parsed.extra["futureField"], json!({"nested": [1, 2]}));
    assert_eq!(serde_json::to_value(&parsed).unwrap(), input);
}

#[test]
fn absent_optional_metadata_fields_are_left_out_not_sent_as_null() {
    let parsed: GenerationMetadata = serde_json::from_value(metadata()).unwrap();
    let out = serde_json::to_value(&parsed).unwrap();
    let obj = out.as_object().unwrap();
    for key in [
        "strength",
        "upscaleScale",
        "upscaleModelKey",
        "draftAt",
        "videoFrames",
        "music",
        "voice",
    ] {
        assert!(!obj.contains_key(key), "{key} must be omitted");
    }
    // `vaeKey` is `string | null` on the frontend: it is always present.
    assert_eq!(obj["vaeKey"], Value::Null);
}

#[test]
fn music_and_voice_settings_use_the_frontend_field_names() {
    let mut input = metadata();
    input["music"] = json!({
        "lyrics": "la", "seconds": 30, "bpm": 120, "key": "E minor", "timeSignature": 4,
        "language": "en", "instrumental": false
    });
    input["voice"] = json!({
        "text": "hello", "language": "English", "mode": "design", "speaker": "", "instruct": "calm"
    });
    let parsed: GenerationMetadata = serde_json::from_value(input.clone()).unwrap();
    assert_eq!(parsed.music.as_ref().unwrap().time_signature, 4);
    assert_eq!(parsed.voice.as_ref().unwrap().mode, VoiceMode::Design);
    assert_eq!(serde_json::to_value(&parsed).unwrap(), input);
}

#[test]
fn image_patch_tells_a_null_board_from_an_absent_one() {
    let moved: ImagePatch = serde_json::from_value(json!({"boardId": null})).unwrap();
    assert_eq!(moved.board_id, Some(None), "null moves to uncategorized");
    let kept: ImagePatch = serde_json::from_value(json!({"starred": true})).unwrap();
    assert_eq!(kept.board_id, None, "absent leaves the board alone");
    assert_eq!(kept.starred, Some(true));
    let set: ImagePatch = serde_json::from_value(json!({"boardId": "b1"})).unwrap();
    assert_eq!(set.board_id, Some(Some("b1".into())));
}

#[test]
fn stored_images_without_a_media_type_are_still_images() {
    let img: ImageDTO = serde_json::from_value(json!({
        "name": "a.png", "url": "", "thumbnailUrl": "", "width": 1, "height": 2, "createdAt": 3,
        "boardId": null, "starred": false, "isIntermediate": false, "category": "general",
        "metadata": null, "workflow": null
    }))
    .unwrap();
    assert_eq!(img.media_type, MediaType::Image);
    let out = serde_json::to_value(&img).unwrap();
    assert_eq!(out["mediaType"], "image");
    assert_eq!(out["thumbnailUrl"], "");
    assert_eq!(out["isIntermediate"], false);
}

#[test]
fn an_enqueue_request_may_leave_out_the_optional_fields() {
    let req: EnqueueRequest = serde_json::from_value(json!({
        "origin": "generate", "destination": "gallery", "params": metadata(), "iterations": 2,
        "randomizeSeed": false, "prepend": true, "boardId": null
    }))
    .unwrap();
    assert!(req.prepend && !req.randomize_seed);
    assert_eq!(
        (req.init_image_url, req.workflow, req.comfy_graph),
        (None, None, None)
    );
    assert!(req.guidance.is_empty());
    let graph: ComfyGraph = serde_json::from_value(json!({
        "prompt": {"1": {"class_type": "SaveImage", "inputs": {}}}, "outputs": ["1"]
    }))
    .unwrap();
    assert_eq!(graph.thumbnail, None);
    assert_eq!(graph.outputs, ["1"]);
}

#[test]
fn queue_items_and_status_serialize_in_camel_case() {
    let item = QueueItem {
        id: 7,
        batch_id: "batch-1".into(),
        status: QueueItemStatus::InProgress,
        origin: QueueOrigin::Canvas,
        destination: QueueDestination::Canvas,
        params: serde_json::from_value(metadata()).unwrap(),
        board_id: None,
        init_image_url: None,
        workflow: None,
        comfy_graph: None,
        guidance: Guidance::default(),
        created_at: 1,
        started_at: Some(2),
        completed_at: None,
        image_name: None,
        error: None,
        error_kind: Some(QueueErrorKind::OutOfMemory),
        result_text: None,
    };
    let v = serde_json::to_value(&item).unwrap();
    assert!(
        v.get("resultText").is_none(),
        "results without a value are left out"
    );
    for key in [
        "id",
        "batchId",
        "status",
        "origin",
        "destination",
        "params",
        "boardId",
        "initImageUrl",
        "workflow",
        "createdAt",
        "startedAt",
        "completedAt",
        "imageName",
        "error",
        "errorKind",
        "maskImageUrl",
        "controlLayers",
        "refImages",
    ] {
        assert!(v.get(key).is_some(), "{key} missing");
    }
    assert_eq!(v["status"], "in_progress");
    assert_eq!(v["errorKind"], "out_of_memory");
    assert_eq!(
        serde_json::from_value::<QueueItem>(v.clone()).unwrap(),
        item
    );
    // Items stored before the field existed read as having no kind.
    let mut old = v;
    old.as_object_mut().unwrap().remove("errorKind");
    assert_eq!(
        serde_json::from_value::<QueueItem>(old).unwrap().error_kind,
        None
    );

    let status = serde_json::to_value(QueueStatus {
        in_progress: 1,
        is_paused: true,
        ..QueueStatus::default()
    })
    .unwrap();
    assert_eq!(status["inProgress"], 1);
    assert_eq!(status["isPaused"], true);
}

#[test]
fn events_are_tagged_by_type_in_snake_case() {
    let paused = serde_json::to_value(BackendEvent::ProcessorState { is_paused: true }).unwrap();
    assert_eq!(paused, json!({"type": "processor_state", "isPaused": true}));
    let progress = serde_json::to_value(BackendEvent::InvocationProgress {
        progress: ProgressEvent {
            item_id: 3,
            step: 1,
            total_steps: 4,
            progress_image_url: None,
            message: "denoise".into(),
        },
    })
    .unwrap();
    assert_eq!(progress["type"], "invocation_progress");
    assert_eq!(progress["progress"]["itemId"], 3);
    assert_eq!(progress["progress"]["totalSteps"], 4);
    assert_eq!(progress["progress"]["progressImageUrl"], Value::Null);
    let cleared = serde_json::to_value(BackendEvent::QueueCleared { items: vec![] }).unwrap();
    assert_eq!(cleared["type"], "queue_cleared");
    let install = serde_json::to_value(BackendEvent::ModelInstall {
        job: ModelInstallJob {
            id: "i".into(),
            source: "s".into(),
            name: "n".into(),
            status: ModelInstallStatus::Downloading,
            bytes: 1,
            total_bytes: 2,
            error: None,
        },
    })
    .unwrap();
    assert_eq!(install["type"], "model_install");
    assert_eq!(install["job"]["totalBytes"], 2);
    assert!(install["job"].get("error").is_none());
    let node_pack = serde_json::to_value(BackendEvent::NodePack {
        url: "https://github.com/a/b".into(),
        status: crate::packs::PackStatus::Ready,
    })
    .unwrap();
    assert_eq!(
        node_pack,
        json!({"type": "node_pack", "url": "https://github.com/a/b", "status": {"state": "ready"}})
    );
}

#[test]
fn model_config_uses_type_for_the_kind_and_hides_empty_options() {
    let model = ModelConfig {
        key: "k".into(),
        name: "N".into(),
        base: BaseModel::Sdxl,
        kind: ModelType::Lora,
        format: ModelFormat::Checkpoint,
        description: String::new(),
        path: "p".into(),
        size: 5,
        source: "s".into(),
        default_settings: None,
        trigger_phrases: Some(vec!["t".into()]),
        cover_image_url: None,
        cover_mature: None,
        cover_image_urls: None,
        page_url: None,
        license: None,
        comfy: None,
    };
    let v = serde_json::to_value(&model).unwrap();
    assert_eq!(v["type"], "lora");
    assert!(v.get("kind").is_none());
    assert_eq!(v["triggerPhrases"], json!(["t"]));
    for key in [
        "defaultSettings",
        "coverImageUrl",
        "coverMature",
        "coverImageUrls",
        "pageUrl",
        "license",
        "comfy",
    ] {
        assert!(v.get(key).is_none(), "{key} must be omitted");
    }
    assert_eq!(serde_json::from_value::<ModelConfig>(v).unwrap(), model);
}

#[test]
fn workflow_input_and_face_rig_preview_fill_their_defaults() {
    let wf: WorkflowInput = serde_json::from_value(json!({"name": "W", "graph": {}})).unwrap();
    assert_eq!(wf.id, None);
    assert!(wf.description.is_empty() && wf.author.is_empty() && wf.tags.is_empty());
    let rig: FaceRigPreview =
        serde_json::from_value(json!({"nodeKey": "n", "rig": "{}", "quality": "drag"})).unwrap();
    assert_eq!(rig.crop_factor, 2.0);
    assert_eq!(rig.src_ratio, 1.0);
    assert_eq!(rig.face_index, 0);
    assert_eq!(rig.image, None);
}
