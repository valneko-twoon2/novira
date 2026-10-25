//! Requests the graph builders refuse (no steps, a bad draft, a graph job without its prompt), the music time
//! signatures, a control layer with a position that is not a number, and editor prompts of the wrong shape. The
//! normal graphs are checked against snapshots inside the library.
use novira_core::comfy::graph::{build, ControlInput, GraphInput, GuidanceInput};
use novira_core::comfy::user_graph::{fill_images, prepare};
use novira_core::types::{ComfyGraph, ComfyRef, ControlMode, GenerationMetadata};
use serde_json::{json, Value};
use std::collections::HashMap;

fn params(mode: &str, patch: Value) -> GenerationMetadata {
    let mut value = json!({
        "generationMode": mode, "positivePrompt": "a cat", "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 42, "steps": 20, "cfgScale": 6.5,
        "cfgRescale": 0, "scheduler": "dpmpp_2m_k", "width": 512, "height": 512, "clipSkip": 0,
        "seamlessX": false, "seamlessY": false, "loras": []
    });
    for (k, v) in patch.as_object().unwrap() {
        value[k] = v.clone();
    }
    serde_json::from_value(value).unwrap()
}

fn model(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

fn input<'a>(p: &'a GenerationMetadata, c: &'a ComfyRef, extra: &'a ComfyRef) -> GraphInput<'a> {
    GraphInput {
        split: None,
        params: p,
        checkpoint: c,
        vae: Some(extra),
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: Some(extra),
        init_image: None,
        guidance: GuidanceInput::default(),
    }
}

fn refusal(mode: &str, patch: Value) -> String {
    let p = params(mode, patch);
    let (c, x) = (
        model("checkpoints", "a.safetensors"),
        model("vae", "v.safetensors"),
    );
    build(&input(&p, &c, &x)).unwrap_err()
}

#[test]
fn every_builder_refuses_a_job_without_steps() {
    for mode in ["txt2img", "video"] {
        assert_eq!(
            refusal(mode, json!({ "steps": 0 })),
            "Steps must be at least 1",
            "{mode}"
        );
    }
    let music = json!({
        "steps": 0,
        "music": { "lyrics": "", "seconds": 30, "bpm": 100, "key": "C major", "timeSignature": 4,
                   "language": "en", "instrumental": true }
    });
    assert_eq!(refusal("music", music), "Steps must be at least 1");
}

#[test]
fn a_draft_needs_text_to_image_a_position_inside_the_steps_and_a_job_that_is_not_a_graph() {
    assert!(
        refusal("img2img", json!({ "draftAt": 0.5 })).contains("only available for text to image")
    );
    for patch in [
        json!({ "draftAt": 1.5 }),
        json!({ "draftAt": 0.5, "steps": 3 }),
    ] {
        assert!(refusal("txt2img", patch).contains("A draft needs a position"));
    }
    assert_eq!(
        refusal("graph", json!({})),
        "A graph job runs the prompt it brings"
    );
}

#[test]
fn music_time_signatures_map_to_the_models_names_and_unknown_ones_to_four() {
    let (c, x) = (
        model("checkpoints", "ace.safetensors"),
        model("vae", "v.safetensors"),
    );
    for (given, written) in [(2, "2"), (3, "3"), (6, "6"), (5, "4"), (4, "4")] {
        let p = params(
            "music",
            json!({ "music": { "lyrics": "", "seconds": 30, "bpm": 100, "key": "C major",
                "timeSignature": given, "language": "en", "instrumental": true } }),
        );
        let built = build(&input(&p, &c, &x)).unwrap();
        let encode = built
            .prompt
            .as_object()
            .unwrap()
            .values()
            .find(|n| n["class_type"] == "TextEncodeAceStepAudio1.5")
            .unwrap();
        assert_eq!(encode["inputs"]["timesignature"], written, "{given}");
    }
}

#[test]
fn a_control_layer_position_that_is_not_a_number_counts_as_the_start() {
    let p = params("txt2img", json!({ "controlLayerCount": 1 }));
    let (c, net) = (
        model("checkpoints", "a.safetensors"),
        model("controlnet", "c.safetensors"),
    );
    let mut graph_input = input(&p, &c, &net);
    graph_input.vae = None;
    graph_input.text_encoder = None;
    graph_input.guidance.controls.push(ControlInput {
        model: &net,
        image: "pose.png",
        weight: 1.0,
        begin_end: [f64::NAN, 0.5],
        mode: ControlMode::Balanced,
        union_type: None,
    });
    let built = build(&graph_input).unwrap();
    let apply = built
        .prompt
        .as_object()
        .unwrap()
        .values()
        .find(|n| n["class_type"] == "ControlNetApplyAdvanced")
        .unwrap();
    assert_eq!(apply["inputs"]["start_percent"], 0.0);
}

#[test]
fn editor_prompts_of_the_wrong_shape_are_refused_or_left_alone() {
    let graph: ComfyGraph = serde_json::from_value(json!({
        "prompt": { "1": { "class_type": "PreviewImage" } },
        "outputs": ["1"]
    }))
    .unwrap();
    let err = prepare(
        &graph,
        1,
        |_| Err("no models".into()),
        |_| Err("no encoders".into()),
    )
    .unwrap_err();
    assert!(err.contains("has no inputs object"), "{err}");

    // A prompt that is not an object, and a node whose inputs are not an object, pass through untouched.
    let uploaded = HashMap::new();
    let mut not_an_object = json!([1, 2]);
    assert_eq!(fill_images(&mut not_an_object, &uploaded), Ok(()));
    let mut odd = json!({ "1": { "class_type": "X", "inputs": 5 } });
    assert_eq!(fill_images(&mut odd, &uploaded), Ok(()));
    assert_eq!(odd["1"]["inputs"], 5);
}
