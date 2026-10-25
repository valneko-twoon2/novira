//! Tests added after mutation testing (cargo-mutants, `scripts\mutation.bat`) showed that the size limits of a job's guidance
//! could move by one without any test failing: each limit must accept exactly its maximum and refuse one more.
use novira_core::service::guidance::{check, MAX_CONTROL_LAYERS, MAX_REF_IMAGES};
use novira_core::types::{
    ClipVisionModel, ControlLayerInput, ControlMode, GenerationMetadata, Guidance, RefImageInput,
    RefImageMethod,
};
use serde_json::json;

fn params(controls: u32, refs: u32) -> GenerationMetadata {
    let mut p: GenerationMetadata = serde_json::from_value(json!({
        "generationMode": "txt2img", "positivePrompt": "", "negativePrompt": "", "modelKey": "m", "modelName": "M",
        "vaeKey": null, "seed": 1, "steps": 4, "cfgScale": 7, "cfgRescale": 0, "scheduler": "euler",
        "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": []
    }))
    .unwrap();
    p.control_layer_count = (controls > 0).then_some(controls);
    p.ref_image_count = (refs > 0).then_some(refs);
    p
}

fn control() -> ControlLayerInput {
    ControlLayerInput {
        image_url: "http://novira-image.localhost/full/a.png".into(),
        model_key: "cn".into(),
        weight: 0.75,
        begin_end: [0.0, 0.75],
        control_mode: ControlMode::Balanced,
        control_type: None,
    }
}

fn reference() -> RefImageInput {
    RefImageInput {
        image_url: "http://novira-image.localhost/full/b.png".into(),
        model_key: "ipa".into(),
        clip_vision_model: ClipVisionModel::VitH,
        weight: 1.0,
        begin_end: [0.0, 1.0],
        method: RefImageMethod::Full,
        region_image_url: None,
    }
}

fn with_controls(layers: Vec<ControlLayerInput>) -> Result<(), String> {
    let count = layers.len() as u32;
    let g = Guidance {
        control_layers: layers,
        ..Default::default()
    };
    check(&g, &params(count, 0), false)
}

fn with_refs(refs: Vec<RefImageInput>) -> Result<(), String> {
    let count = refs.len() as u32;
    let g = Guidance {
        ref_images: refs,
        ..Default::default()
    };
    check(&g, &params(0, count), false)
}

#[test]
fn the_maximum_number_of_control_layers_and_references_is_accepted() {
    assert_eq!(with_controls(vec![control(); MAX_CONTROL_LAYERS]), Ok(()));
    assert_eq!(with_refs(vec![reference(); MAX_REF_IMAGES]), Ok(()));
}

#[test]
fn a_picture_url_of_the_maximum_length_is_accepted_and_one_more_is_refused() {
    let url = |len: usize| "h".repeat(len);
    for (len, ok) in [(2048, true), (2049, false)] {
        let layer = ControlLayerInput {
            image_url: url(len),
            ..control()
        };
        assert_eq!(with_controls(vec![layer]).is_ok(), ok, "control {len}");
        let layer = RefImageInput {
            image_url: url(len),
            ..reference()
        };
        assert_eq!(with_refs(vec![layer]).is_ok(), ok, "reference {len}");
    }
}

#[test]
fn a_model_key_of_the_maximum_length_is_accepted_and_one_more_is_refused() {
    for (len, ok) in [(300, true), (301, false)] {
        let layer = ControlLayerInput {
            model_key: "k".repeat(len),
            ..control()
        };
        assert_eq!(with_controls(vec![layer]).is_ok(), ok, "control {len}");
        let layer = RefImageInput {
            model_key: "k".repeat(len),
            ..reference()
        };
        assert_eq!(with_refs(vec![layer]).is_ok(), ok, "reference {len}");
    }
}
