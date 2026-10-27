//! Snapshots of the ComfyUI prompts the backend builds (image, video and music graphs, and editor prompts after
//! their placeholders are filled), so any change to what reaches ComfyUI shows up in review as a JSON diff.
//! The files live in `__snapshots__/graph/<case>.json` next to this module (LF, like every text file of the
//! repository). Update them on purpose with
//! `UPDATE_SNAPSHOTS=1 cargo test -p novira-core --lib comfy::graph_snapshots` and review the diff.
use super::graph::{
    build, tests::params, BuiltGraph, ControlInput, GraphInput, GuidanceInput, RefInput,
    RegionInput,
};
use super::user_graph::{fill_images, prepare};
use crate::types::{
    ComfyGraph, ComfyRef, ControlMode, GenerationMetadata, GenerationMode, HiresFix, MusicParams,
    RefImageMethod,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;

const UPDATE_ENV: &str = "UPDATE_SNAPSHOTS";

fn snapshot_path(case: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("comfy")
        .join("__snapshots__")
        .join("graph")
        .join(format!("{case}.json"))
}

/// Pretty JSON with LF line ends and a final line end, the form the snapshot files are kept in.
fn render(value: &Value) -> String {
    let pretty =
        serde_json::to_string_pretty(&sorted(value)).expect("a JSON value always serializes");
    format!("{pretty}\n")
}

/// `value` with every object's keys in sorted order. serde_json keeps insertion order in this build (`c2pa` turns on
/// its `preserve_order` feature), and the order keys were added in is not part of a graph.
fn sorted(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            Value::Object(
                keys.into_iter()
                    .map(|k| (k.clone(), sorted(&map[k])))
                    .collect(),
            )
        }
        Value::Array(items) => Value::Array(items.iter().map(sorted).collect()),
        other => other.clone(),
    }
}

/// A short, readable hint at where two texts first differ.
fn diff_hint(expected: &str, actual: &str) -> String {
    let (e, a): (Vec<&str>, Vec<&str>) = (expected.lines().collect(), actual.lines().collect());
    let first = e
        .iter()
        .zip(&a)
        .position(|(x, y)| x != y)
        .unwrap_or(e.len().min(a.len()));
    let from = first.saturating_sub(3);
    let mut out = format!(
        "first difference at line {} (snapshot has {} lines, built graph has {})\n",
        first + 1,
        e.len(),
        a.len()
    );
    for (sign, lines) in [("-", &e), ("+", &a)] {
        for (i, line) in lines.iter().enumerate().skip(from).take(first - from + 4) {
            let mark = if i == first { sign } else { " " };
            out.push_str(&format!("{mark} {:>4} | {line}\n", i + 1));
        }
        out.push_str("  ...\n");
    }
    out
}

/// Compares `value` with the committed snapshot `case`, or writes it when `UPDATE_SNAPSHOTS=1`.
/// A missing snapshot fails unless updating. Line ends of the stored file are not significant when comparing.
pub(super) fn assert_snapshot(case: &str, value: &Value) {
    let path = snapshot_path(case);
    let actual = render(value);
    let stored = std::fs::read_to_string(&path).ok();
    let expected = stored.as_deref().map(|s| s.replace("\r\n", "\n"));
    if expected.as_deref() == Some(actual.replace("\r\n", "\n").as_str()) {
        return;
    }
    if std::env::var(UPDATE_ENV).as_deref() == Ok("1") {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, &actual).unwrap();
        return;
    }
    let how = format!(
        "If the change is intended, run `{UPDATE_ENV}=1 cargo test -p novira-core --lib comfy::graph_snapshots` \
         (PowerShell: `$env:{UPDATE_ENV}='1'; cargo test ...`) and review the diff of the snapshot file."
    );
    match expected {
        None => panic!("Snapshot {} is missing.\n{how}", path.display()),
        Some(expected) => panic!(
            "Snapshot {} does not match the built graph.\n{}{how}",
            path.display(),
            diff_hint(&expected, &actual.replace("\r\n", "\n"))
        ),
    }
}

/// Everything the engine reads from a built graph: the prompt and which nodes give the outputs.
pub(super) fn built_json(g: &BuiltGraph) -> Value {
    let mut out = json!({
        "prompt": g.prompt,
        "output_node": g.output_node,
        "total_steps": g.total_steps,
        "thumbnail_node": g.thumbnail_node,
        "audio_ext": g.audio_ext,
    });
    // Only graphs with more than one sampling pass list them (the older snapshots stay as they were).
    if !g.passes.is_empty() {
        out["passes"] = json!(g.passes);
    }
    out
}

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

/// The models a case loads; fixed names so the snapshots never depend on the machine.
struct Models {
    checkpoint: ComfyRef,
    vae: Option<ComfyRef>,
    loras: Vec<(ComfyRef, f64)>,
    upscale: Option<ComfyRef>,
    tile: Option<ComfyRef>,
    post: Option<ComfyRef>,
    text_encoder: Option<ComfyRef>,
}

impl Models {
    fn image() -> Self {
        Models {
            checkpoint: r("checkpoints", "sdxl\\base.safetensors"),
            vae: None,
            loras: vec![],
            upscale: None,
            tile: None,
            post: None,
            text_encoder: None,
        }
    }

    fn video() -> Self {
        Models {
            checkpoint: r("diffusion_models", "wan2.2_ti2v_5B_fp16.safetensors"),
            vae: Some(r("vae", "wan2.2_vae.safetensors")),
            loras: vec![],
            upscale: None,
            tile: None,
            post: None,
            text_encoder: Some(r("text_encoders", "umt5_xxl_fp8_e4m3fn_scaled.safetensors")),
        }
    }

    fn music() -> Self {
        Models {
            checkpoint: r("checkpoints", "ace_step_1.5_turbo_aio.safetensors"),
            ..Self::image()
        }
    }

    fn build(
        &self,
        p: &GenerationMetadata,
        init_image: Option<&str>,
        guidance: GuidanceInput<'_>,
    ) -> BuiltGraph {
        build(&GraphInput {
            split: None,
            params: p,
            checkpoint: &self.checkpoint,
            vae: self.vae.as_ref(),
            loras: self.loras.iter().map(|(l, w)| (l, *w)).collect(),
            upscale_model: self.upscale.as_ref(),
            tile_controlnet: self.tile.as_ref(),
            post_processing_model: self.post.as_ref(),
            text_encoder: self.text_encoder.as_ref(),
            init_image,
            guidance,
        })
        .expect("the snapshot case builds")
    }
}

fn snapshot_built(case: &str, models: &Models, p: &GenerationMetadata, init: Option<&str>) {
    snapshot_guided(case, models, p, init, GuidanceInput::default());
}

fn snapshot_guided(
    case: &str,
    models: &Models,
    p: &GenerationMetadata,
    init: Option<&str>,
    guidance: GuidanceInput<'_>,
) {
    assert_snapshot(case, &built_json(&models.build(p, init, guidance)));
}

/// The guidance models of the cases.
fn union_controlnet() -> ComfyRef {
    r("controlnet", "controlnet-union-sdxl-promax.safetensors")
}

fn ipadapter() -> ComfyRef {
    r("ipadapter", "ip-adapter_sdxl_vit-h.safetensors")
}

fn vit_h() -> ComfyRef {
    r("clip_vision", "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors")
}

#[test]
fn txt2img() {
    snapshot_built(
        "txt2img",
        &Models::image(),
        &params(GenerationMode::Txt2img),
        None,
    );
}

#[test]
fn txt2img_draft() {
    let mut p = params(GenerationMode::Txt2img);
    p.steps = 28;
    p.draft_at = Some(0.35);
    snapshot_built("txt2img-draft", &Models::image(), &p, None);
}

#[test]
fn txt2img_loras_vae_clip_skip_rescale() {
    let mut p = params(GenerationMode::Txt2img);
    p.clip_skip = 2;
    p.cfg_rescale = 0.7;
    p.scheduler = "euler_a".into();
    let models = Models {
        vae: Some(r("vae", "sdxl_vae.safetensors")),
        loras: vec![
            (r("loras", "style\\ink.safetensors"), 0.8),
            (r("loras", "detail.safetensors"), -0.5),
        ],
        ..Models::image()
    };
    snapshot_built("txt2img-loras-vae-clip-skip-rescale", &models, &p, None);
}

fn hires(scale: f64, strength: f64, model: Option<&str>, steps: Option<u32>) -> HiresFix {
    HiresFix {
        scale,
        strength,
        upscale_model_key: model.map(Into::into),
        steps,
    }
}

#[test]
fn txt2img_hires_smooth() {
    // Decode, Lanczos to 1.5x, encode, a second sampler at 0.45 with the same seed.
    let mut p = params(GenerationMode::Txt2img);
    p.hires_fix = Some(hires(1.5, 0.45, None, None));
    snapshot_built("txt2img-hires-smooth", &Models::image(), &p, None);
}

#[test]
fn txt2img_hires_with_model() {
    // An ESRGAN-type model enlarges first (4x), then the picture is resized to exactly 1.25x; 12 second-pass steps.
    let mut p = params(GenerationMode::Txt2img);
    p.width = 832;
    p.height = 1216;
    p.hires_fix = Some(hires(1.25, 0.35, Some("upscale-4x"), Some(12)));
    let models = Models {
        upscale: Some(r("upscale_models", "4x-UltraSharp.pth")),
        ..Models::image()
    };
    snapshot_built("txt2img-hires-with-model", &models, &p, None);
}

#[test]
fn txt2img_hires_with_lora_and_guidance() {
    // The second pass samples with the same patched model (LoRA, reference image) and the control conditioning.
    let mut p = params(GenerationMode::Txt2img);
    p.ref_image_count = Some(1);
    p.control_layer_count = Some(1);
    p.hires_fix = Some(hires(2.0, 0.5, None, Some(15)));
    let (net, ipa, vit) = (union_controlnet(), ipadapter(), vit_h());
    let guidance = GuidanceInput {
        controls: vec![ControlInput {
            model: &net,
            image: "control-pose.png",
            weight: 0.75,
            begin_end: [0.0, 0.75],
            mode: ControlMode::Balanced,
            union_type: None,
        }],
        refs: vec![RefInput {
            model: &ipa,
            clip_vision: &vit,
            image: "ref-face.png",
            weight: 0.6,
            begin_end: [0.0, 1.0],
            method: RefImageMethod::Full,
            region: None,
        }],
        ..Default::default()
    };
    let models = Models {
        loras: vec![(r("loras", "detail.safetensors"), 0.6)],
        ..Models::image()
    };
    snapshot_guided("txt2img-hires-lora-guidance", &models, &p, None, guidance);
}

#[test]
fn img2img() {
    let mut p = params(GenerationMode::Img2img);
    p.strength = Some(0.45);
    snapshot_built("img2img", &Models::image(), &p, Some("source.png"));
}

#[test]
fn img2img_draft() {
    let mut p = params(GenerationMode::Img2img);
    p.steps = 28;
    p.strength = Some(0.45);
    p.draft_at = Some(0.35);
    snapshot_built("img2img-draft", &Models::image(), &p, Some("source.png"));
}

fn masked(mask: &str) -> GuidanceInput<'_> {
    GuidanceInput {
        mask_image: Some(mask),
        ..Default::default()
    }
}

#[test]
fn inpaint() {
    // Noise only inside the (softened) mask, the source kept outside it.
    let p = params(GenerationMode::Inpaint);
    snapshot_guided(
        "inpaint",
        &Models::image(),
        &p,
        Some("source.png"),
        masked("mask.png"),
    );
}

#[test]
fn outpaint() {
    // The frontend has filled the transparent part of the source; the mask covers it. No blur: the mask as painted.
    let mut p = params(GenerationMode::Outpaint);
    p.width = 1280;
    p.height = 1000;
    p.strength = Some(0.9);
    p.mask_blur = Some(0);
    snapshot_guided(
        "outpaint",
        &Models::image(),
        &p,
        Some("source.png"),
        masked("mask.png"),
    );
}

#[test]
fn txt2img_control_layers() {
    let mut p = params(GenerationMode::Txt2img);
    p.control_layer_count = Some(2);
    let net = union_controlnet();
    let guidance = GuidanceInput {
        controls: vec![
            ControlInput {
                model: &net,
                image: "control-pose.png",
                weight: 0.75,
                begin_end: [0.0, 0.75],
                mode: ControlMode::Balanced,
                union_type: None,
            },
            ControlInput {
                model: &net,
                image: "control-edges.png",
                weight: 1.25,
                begin_end: [0.25, 1.0],
                mode: ControlMode::MoreControl,
                union_type: None,
            },
        ],
        ..Default::default()
    };
    snapshot_guided(
        "txt2img-control-layers",
        &Models::image(),
        &p,
        None,
        guidance,
    );
}

#[test]
fn txt2img_union_control_types() {
    // A union ControlNet told what each picture is: a pose and edges.
    let mut p = params(GenerationMode::Txt2img);
    p.control_layer_count = Some(2);
    let net = union_controlnet();
    let guidance = GuidanceInput {
        controls: vec![
            ControlInput {
                model: &net,
                image: "control-pose.png",
                weight: 1.0,
                begin_end: [0.0, 1.0],
                mode: ControlMode::Balanced,
                union_type: Some("openpose"),
            },
            ControlInput {
                model: &net,
                image: "control-edges.png",
                weight: 0.6,
                begin_end: [0.0, 0.8],
                mode: ControlMode::Balanced,
                union_type: Some("canny/lineart/anime_lineart/mlsd"),
            },
        ],
        ..Default::default()
    };
    snapshot_guided(
        "txt2img-union-control-types",
        &Models::image(),
        &p,
        None,
        guidance,
    );
}

#[test]
fn txt2img_reference_images() {
    let mut p = params(GenerationMode::Txt2img);
    p.ref_image_count = Some(2);
    p.cfg_rescale = 0.7;
    let (ipa, vit) = (ipadapter(), vit_h());
    let guidance = GuidanceInput {
        refs: vec![
            RefInput {
                model: &ipa,
                clip_vision: &vit,
                image: "ref-style.png",
                weight: 0.8,
                begin_end: [0.0, 1.0],
                method: RefImageMethod::Style,
                region: None,
            },
            RefInput {
                model: &ipa,
                clip_vision: &vit,
                image: "ref-face.png",
                weight: 0.55,
                begin_end: [0.1, 0.9],
                method: RefImageMethod::Full,
                region: None,
            },
        ],
        ..Default::default()
    };
    let models = Models {
        loras: vec![(r("loras", "detail.safetensors"), 0.6)],
        ..Models::image()
    };
    snapshot_guided("txt2img-reference-images", &models, &p, None, guidance);
}

#[test]
fn txt2img_characters_in_their_regions() {
    // A comic panel with two characters: each one's words and reference picture act inside its own region.
    let mut p = params(GenerationMode::Txt2img);
    p.ref_image_count = Some(2);
    p.regional_guidance_count = Some(2);
    let (ipa, vit) = (ipadapter(), vit_h());
    let guidance = GuidanceInput {
        regions: vec![
            RegionInput {
                mask_image: "region-left.png",
                positive: Some("1boy, short black hair, black gakuran"),
                negative: None,
                auto_negative: true,
            },
            RegionInput {
                mask_image: "region-right.png",
                positive: Some("1girl, red ponytail, white haori"),
                negative: None,
                auto_negative: true,
            },
        ],
        refs: vec![
            RefInput {
                model: &ipa,
                clip_vision: &vit,
                image: "ref-boy.png",
                weight: 0.42,
                begin_end: [0.0, 1.0],
                method: RefImageMethod::Full,
                region: Some("region-left.png"),
            },
            RefInput {
                model: &ipa,
                clip_vision: &vit,
                image: "ref-girl.png",
                weight: 0.42,
                begin_end: [0.0, 1.0],
                method: RefImageMethod::Full,
                region: Some("region-right.png"),
            },
        ],
        ..Default::default()
    };
    snapshot_guided(
        "txt2img-characters-in-regions",
        &Models::image(),
        &p,
        None,
        guidance,
    );
}

#[test]
fn inpaint_with_control_and_reference() {
    // Everything at once: reference image, control layer and mask on one source.
    let mut p = params(GenerationMode::Inpaint);
    p.strength = Some(0.85);
    p.mask_blur = Some(8);
    p.control_layer_count = Some(1);
    p.ref_image_count = Some(1);
    let (net, ipa, vit) = (union_controlnet(), ipadapter(), vit_h());
    let guidance = GuidanceInput {
        mask_image: Some("mask.png"),
        regions: vec![],
        references: vec![],
        controls: vec![ControlInput {
            model: &net,
            image: "control-depth.png",
            weight: 0.6,
            begin_end: [0.0, 0.5],
            mode: ControlMode::MorePrompt,
            union_type: None,
        }],
        refs: vec![RefInput {
            model: &ipa,
            clip_vision: &vit,
            image: "ref-composition.png",
            weight: 1.0,
            begin_end: [0.0, 1.0],
            method: RefImageMethod::Composition,
            region: None,
        }],
    };
    snapshot_guided(
        "inpaint-control-reference",
        &Models::image(),
        &p,
        Some("source.png"),
        guidance,
    );
}

#[test]
fn upscale_with_model() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(2.0);
    let models = Models {
        upscale: Some(r("upscale_models", "4x-UltraSharp.pth")),
        ..Models::image()
    };
    snapshot_built("upscale-with-model", &models, &p, Some("source.png"));
}

#[test]
fn upscale_with_tile_controlnet() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(2.0);
    p.creativity = Some(-4.0);
    p.structure = Some(6.0);
    let models = Models {
        upscale: Some(r("upscale_models", "4x-UltraSharp.pth")),
        tile: Some(r("controlnet", "tile.safetensors")),
        ..Models::image()
    };
    snapshot_built(
        "upscale-with-tile-controlnet",
        &models,
        &p,
        Some("source.png"),
    );
}

#[test]
fn upscale_with_post_processing() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(2.0);
    let models = Models {
        upscale: Some(r("upscale_models", "4x-UltraSharp.pth")),
        post: Some(r("upscale_models", "2x-sharpen.pth")),
        ..Models::image()
    };
    snapshot_built(
        "upscale-with-post-processing",
        &models,
        &p,
        Some("source.png"),
    );
}

#[test]
fn upscale_without_model() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(1.5);
    p.strength = Some(0.2);
    snapshot_built(
        "upscale-without-model",
        &Models::image(),
        &p,
        Some("source.png"),
    );
}

fn video_params() -> GenerationMetadata {
    let mut p = params(GenerationMode::Video);
    p.model_key = "video".into();
    p.positive_prompt = "a cat walking on a beach".into();
    p.width = 1280;
    p.height = 704;
    p.video_frames = Some(49);
    p.steps = 20;
    p.cfg_scale = 5.0;
    p.scheduler = "unipc".into();
    p
}

#[test]
fn video_from_text() {
    snapshot_built("video-text", &Models::video(), &video_params(), None);
}

#[test]
fn video_from_image_turbo_fp8_tiled() {
    let mut p = video_params();
    p.model_key = crate::packs::TURBO_KEY.into();
    p.steps = 4;
    p.cfg_scale = 1.0;
    p.video_frames = Some(121);
    p.video_fps = Some(16);
    p.video_fp8 = Some(true);
    p.video_tiled_decode = Some(true);
    snapshot_built(
        "video-image-turbo-fp8-tiled",
        &Models::video(),
        &p,
        Some("start.png"),
    );
}

#[test]
fn logo() {
    let mut p = params(GenerationMode::Logo);
    p.positive_prompt =
        "A minimal logo with the text \"NOVIRA\", flat vector, centered, white background".into();
    p.steps = 8;
    p.cfg_scale = 1.0;
    let models = Models {
        checkpoint: r("diffusion_models", "z-image-turbo-fp8-e4m3fn.safetensors"),
        vae: Some(r("vae", "ae.safetensors")),
        text_encoder: Some(r("text_encoders", "qwen_3_4b_fp8_mixed.safetensors")),
        ..Models::image()
    };
    snapshot_built("logo", &models, &p, None);
}

fn music_params(music: MusicParams) -> GenerationMetadata {
    let mut p = params(GenerationMode::Music);
    p.positive_prompt = "city pop, warm, female vocals".into();
    p.steps = 8;
    p.cfg_scale = 1.0;
    p.music = Some(music);
    p
}

#[test]
fn music_with_lyrics() {
    let p = music_params(MusicParams {
        lyrics: "[Verse]\nla la".into(),
        seconds: 90,
        bpm: 128,
        key: "E minor".into(),
        time_signature: 4,
        language: "ja".into(),
        instrumental: false,
    });
    snapshot_built("music-lyrics", &Models::music(), &p, None);
}

#[test]
fn music_instrumental_with_fallbacks() {
    // Out-of-range length and tempo, an unknown key, signature and language fall back to what the node accepts.
    let p = music_params(MusicParams {
        lyrics: "ignored".into(),
        seconds: 600,
        bpm: 5,
        key: "H dorian".into(),
        time_signature: 5,
        language: "xx".into(),
        instrumental: true,
    });
    snapshot_built("music-instrumental-fallbacks", &Models::music(), &p, None);
}

#[test]
fn editor_prompt_with_placeholders_filled() {
    let graph: ComfyGraph = serde_json::from_value(json!({
        "prompt": {
            "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": { "$model": "sdxl" } } },
            "2": { "class_type": "LoadImage", "inputs": { "image": { "$image": "photo.png" } } },
            "3": { "class_type": "CLIPTextEncode", "inputs": { "text": "a cat", "clip": ["1", 1] } },
            "4": { "class_type": "VAEEncode", "inputs": { "pixels": ["2", 0], "vae": ["1", 2] } },
            "5": { "class_type": "KSampler", "inputs": {
                "model": ["1", 0], "seed": { "$seed": true }, "steps": 20, "cfg": 6.5,
                "sampler_name": { "$sampler_name": "dpmpp_2m_k" }, "scheduler": { "$scheduler": "dpmpp_2m_k" },
                "positive": ["3", 0], "negative": ["3", 0], "latent_image": ["4", 0], "denoise": 0.6
            } },
            "6": { "class_type": "VAEDecode", "inputs": { "samples": ["5", 0], "vae": ["1", 2] } },
            "7": { "class_type": "FaceRig", "inputs": { "image": ["6", 0], "options": { "yaw": 10, "pitch": 0 } } },
            "8": { "class_type": "SaveImage", "inputs": { "images": ["7", 0], "filename_prefix": "novira" } }
        },
        "outputs": ["8"]
    }))
    .unwrap();
    let mut prepared = prepare(
        &graph,
        1234,
        |key| match key {
            "sdxl" => Ok(r("checkpoints", "sdxl\\base.safetensors")),
            _ => Err(format!("Graph model not found: {key}")),
        },
        |_| Err("no CLIP vision model".into()),
    )
    .expect("the editor prompt prepares");
    let before_upload = prepared.prompt.clone();
    let uploaded = HashMap::from([("photo.png".to_string(), "novira_photo.png".to_string())]);
    fill_images(&mut prepared.prompt, &uploaded).expect("the picture was uploaded");
    assert_snapshot(
        "editor-prompt-placeholders",
        &json!({
            "prepared": before_upload,
            "uploaded": prepared.prompt,
            "outputs": prepared.outputs,
            "thumbnail": prepared.thumbnail,
            "models": prepared.models,
            "images": prepared.images,
        }),
    );
}

#[test]
fn txt2img_regional_guidance() {
    let mut p = params(GenerationMode::Txt2img);
    p.regional_guidance_count = Some(2);
    let guidance = GuidanceInput {
        regions: vec![
            RegionInput {
                mask_image: "region-left.png",
                positive: Some("a red hat"),
                negative: None,
                auto_negative: true,
            },
            RegionInput {
                mask_image: "region-right.png",
                positive: Some("a blue scarf"),
                negative: Some("blur"),
                auto_negative: false,
            },
        ],
        ..GuidanceInput::default()
    };
    snapshot_guided(
        "txt2img-regional-guidance",
        &Models::image(),
        &p,
        None,
        guidance,
    );
}

#[test]
fn txt2img_seamless_tiling() {
    let mut p = params(GenerationMode::Txt2img);
    p.seamless_x = true;
    snapshot_built("txt2img-seamless-x", &Models::image(), &p, None);
}
