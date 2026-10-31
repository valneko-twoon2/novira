//! Small cases for the corners of the graph recipes that the family tests do not reach: refusals, helper tables that a
//! family does not use in its normal path, and graph options that only some families can combine.
use super::graph::{build, tests::params, BuiltGraph, ControlInput, GraphInput, GuidanceInput};
use super::split::{self, Family, Loader, SplitJob, WanKind};
use crate::models::classify::Variant;
use crate::types::{ComfyRef, ControlMode, GenerationMetadata, GenerationMode};
use serde_json::{json, Value};

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

fn job(family: Family) -> SplitJob {
    SplitJob::new(
        family,
        Loader::Unet,
        (0..family.encoders().len())
            .map(|i| r("text_encoders", &format!("te{i}.safetensors")))
            .collect(),
    )
}

fn classes(g: &BuiltGraph, class: &str) -> usize {
    g.prompt
        .as_object()
        .unwrap()
        .values()
        .filter(|n| n["class_type"] == class)
        .count()
}

const ALL_FAMILIES: [Family; 15] = [
    Family::Anima,
    Family::Flux,
    Family::Chroma,
    Family::QwenImage,
    Family::ZImage,
    Family::Sd3,
    Family::Hidream,
    Family::Auraflow,
    Family::Flux2,
    Family::HunyuanImage,
    Family::Wan,
    Family::HunyuanVideo,
    Family::HunyuanVideo15,
    Family::Ltx,
    Family::Ltx2,
];

// split.rs -----------------------------------------------------------------------------------------------------------

#[test]
fn a_wan_file_name_tells_what_the_model_is_made_for() {
    assert_eq!(
        WanKind::from_name("wan2.2_ti2v_5B_fp16.safetensors"),
        Some(WanKind::Ti2v)
    );
    assert_eq!(
        WanKind::from_name("Wan2.1-I2V-14B-Q4.gguf"),
        Some(WanKind::I2v)
    );
    assert_eq!(WanKind::from_name("wan_t2v.gguf"), Some(WanKind::T2v));
    assert_eq!(WanKind::from_name("wan-vace-14b.gguf"), Some(WanKind::T2v));
    assert_eq!(WanKind::from_name("some-model.gguf"), None);
}

#[test]
fn each_video_job_names_the_node_that_older_comfyui_versions_lack() {
    let with = |family: Family, wan: Option<WanKind>, variant: Variant| {
        let mut j = job(family);
        j.wan = wan;
        j.variant = variant;
        j.video_node()
    };
    assert_eq!(
        with(Family::Wan, Some(WanKind::T2v), Variant::WanVace),
        "WanVaceToVideo"
    );
    assert_eq!(
        with(Family::HunyuanVideo, None, Variant::HyI2v),
        "HunyuanImageToVideo"
    );
    assert_eq!(
        with(Family::HunyuanVideo, None, Variant::Plain),
        "EmptyHunyuanLatentVideo"
    );
    assert_eq!(
        with(Family::HunyuanVideo15, None, Variant::Hy15I2v),
        "HunyuanVideo15ImageToVideo"
    );
    assert_eq!(
        with(Family::HunyuanVideo15, None, Variant::Plain),
        "EmptyHunyuanVideo15Latent"
    );
    assert_eq!(
        with(Family::Ltx2, None, Variant::Plain),
        "LTXVConcatAVLatent"
    );
    assert_eq!(with(Family::Ltx, None, Variant::Plain), "LTXVScheduler");
    assert_eq!(
        with(Family::Wan, Some(WanKind::Ti2v), Variant::Plain),
        "Wan22ImageToVideoLatent"
    );
    assert_eq!(
        with(Family::Wan, None, Variant::Plain),
        "Wan22ImageToVideoLatent"
    );
    assert_eq!(
        with(Family::Wan, Some(WanKind::I2v), Variant::Plain),
        "WanImageToVideo"
    );
    // A picture family never asks for a video node; the sampler is the safe answer.
    assert_eq!(with(Family::Flux, None, Variant::Plain), "KSampler");
}

#[test]
fn every_family_has_a_name_a_vae_a_sampler_and_a_latent() {
    let mut labels = std::collections::HashSet::new();
    for f in ALL_FAMILIES {
        assert!(labels.insert(f.label()), "{f:?} repeats a name");
        assert!(!f.vae().what.is_empty(), "{f:?}");
        assert!(!f.vae().words.is_empty(), "{f:?}");
        let (sampler, scheduler) = f.sampling();
        assert!(!sampler.is_empty() && !scheduler.is_empty(), "{f:?}");
        assert!(!f.encoders().is_empty(), "{f:?}");
    }
    assert_eq!(Family::Ltx2.sampling(), ("euler_ancestral", "normal"));
    assert_eq!(Family::Ltx.vae().words, ["ltx"]);
    // Wan 2.2's 5B model has a VAE of its own; the other kinds use Wan 2.1's.
    assert!(Family::Wan
        .vae_for(Some(WanKind::Ti2v))
        .what
        .contains("Wan 2.2"));
    assert!(Family::Wan.vae_for(None).what.contains("Wan 2.1"));
}

#[test]
fn a_prompt_node_without_a_class_needs_no_pack() {
    let prompt = json!({
        "1": { "inputs": {} },
        "2": { "class_type": "KSampler", "inputs": {} },
        "3": { "class_type": "UnetLoaderGGUF", "inputs": {} },
    });
    let found = split::packs_needed(&prompt);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].node, "UnetLoaderGGUF");
}

// graph.rs -----------------------------------------------------------------------------------------------------------

fn input<'a>(
    p: &'a GenerationMetadata,
    checkpoint: &'a ComfyRef,
    split: Option<&'a SplitJob>,
) -> GraphInput<'a> {
    GraphInput {
        params: p,
        checkpoint,
        vae: None,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        split,
        init_image: None,
        guidance: GuidanceInput::default(),
    }
}

#[test]
fn a_model_patch_control_needs_a_family_that_takes_one() {
    let mut p = params(GenerationMode::Txt2img);
    p.control_layer_count = Some(1);
    let ckpt = r("checkpoints", "sdxl.safetensors");
    let patch = r("model_patches", "fun-control.safetensors");
    let mut i = input(&p, &ckpt, None);
    i.guidance.controls = vec![ControlInput {
        model: &patch,
        image: "c.png",
        weight: 1.0,
        begin_end: [0.0, 1.0],
        mode: ControlMode::Balanced,
        union_type: None,
    }];
    let err = build(&i).unwrap_err();
    assert!(err.contains("Anima, Qwen-Image and Z-Image"), "{err}");
}

#[test]
fn a_small_upscale_with_a_tile_controlnet_is_guided_in_one_piece() {
    for family in [None, Some(Family::Flux)] {
        let mut p = params(GenerationMode::Upscale);
        p.width = 512;
        p.height = 512;
        p.upscale_scale = Some(1.0);
        p.structure = Some(10.0);
        let ckpt = r("checkpoints", "sdxl.safetensors");
        let unet = r("diffusion_models", "flux.safetensors");
        let vae = r("vae", "ae.safetensors");
        let tile = r("controlnet", "tile.safetensors");
        let split = family.map(job);
        let mut i = input(
            &p,
            if family.is_some() { &unet } else { &ckpt },
            split.as_ref(),
        );
        i.vae = family.map(|_| &vae);
        i.init_image = Some("src.png");
        i.tile_controlnet = Some(&tile);
        let g = build(&i).unwrap();
        assert_eq!(classes(&g, "ControlNetApplyAdvanced"), 1, "{family:?}");
        assert_eq!(classes(&g, "ControlNetLoader"), 1, "{family:?}");
        let apply = g
            .prompt
            .as_object()
            .unwrap()
            .values()
            .find(|n| n["class_type"] == "ControlNetApplyAdvanced")
            .unwrap();
        // Only the newer families hand their VAE to the ControlNet.
        assert_eq!(apply["inputs"].get("vae").is_some(), family.is_some());
    }
}

// variants.rs --------------------------------------------------------------------------------------------------------

fn flux2(p: &GenerationMetadata, loras: Vec<(&ComfyRef, f64)>) -> Result<BuiltGraph, String> {
    let unet = r("diffusion_models", "flux2.safetensors");
    let vae = r("vae", "flux2-vae.safetensors");
    let split = job(Family::Flux2);
    let mut i = input(p, &unet, Some(&split));
    i.vae = Some(&vae);
    i.loras = loras;
    build(&i)
}

#[test]
fn flux2_refuses_zero_steps_and_drafts_outside_text_and_image_to_image() {
    let mut p = params(GenerationMode::Txt2img);
    p.steps = 0;
    assert!(flux2(&p, vec![]).unwrap_err().contains("at least 1"));
    let mut p = params(GenerationMode::Txt2img);
    p.draft_at = Some(0.5);
    assert!(flux2(&p, vec![]).is_ok());
    p.generation_mode = GenerationMode::Upscale;
    let err = flux2(&p, vec![]).unwrap_err();
    assert!(err.contains("Drafts are only available"), "{err}");
    let mut p = params(GenerationMode::Txt2img);
    p.draft_at = Some(1.5);
    assert!(flux2(&p, vec![]).unwrap_err().contains("between 0 and 1"));
}

#[test]
fn flux2_applies_each_lora_to_the_model_and_the_encoder() {
    let p = params(GenerationMode::Txt2img);
    let a = r("loras", "a.safetensors");
    let b = r("loras", "b.safetensors");
    let g = flux2(&p, vec![(&a, 0.5), (&b, 0.25)]).unwrap();
    assert_eq!(classes(&g, "LoraLoader"), 2);
}

fn edit(
    p: &GenerationMetadata,
    variant: Variant,
    init: Option<&str>,
    loras: Vec<(&ComfyRef, f64)>,
) -> Result<BuiltGraph, String> {
    let unet = r("diffusion_models", "qwen-edit.safetensors");
    let vae = r("vae", "qwen_image_vae.safetensors");
    let mut split = job(Family::QwenImage);
    split.variant = variant;
    let mut i = input(p, &unet, Some(&split));
    i.vae = Some(&vae);
    i.init_image = init;
    i.loras = loras;
    build(&i)
}

#[test]
fn an_edit_model_refuses_zero_steps_and_runs_its_loras() {
    let mut p = params(GenerationMode::Img2img);
    p.steps = 0;
    let err = edit(&p, Variant::QwenEdit, Some("src.png"), vec![]).unwrap_err();
    assert!(err.contains("at least 1"), "{err}");
    let p = params(GenerationMode::Img2img);
    let lora = r("loras", "style.safetensors");
    let g = edit(&p, Variant::QwenEdit, Some("src.png"), vec![(&lora, 0.7)]).unwrap();
    assert_eq!(classes(&g, "LoraLoader"), 1);
}

// video_families.rs --------------------------------------------------------------------------------------------------

fn video_params() -> GenerationMetadata {
    let mut p = params(GenerationMode::Video);
    p.width = 832;
    p.height = 480;
    p.video_frames = Some(25);
    p.video_fps = Some(24);
    p
}

fn video(
    p: &GenerationMetadata,
    split: &SplitJob,
    vae: Option<&ComfyRef>,
) -> Result<BuiltGraph, String> {
    let unet = r("diffusion_models", "video.safetensors");
    let mut i = input(p, &unet, Some(split));
    i.vae = vae;
    super::video_families::build(&i, split)
}

#[test]
fn a_video_job_is_refused_for_zero_steps_missing_encoders_and_a_picture_family() {
    let vae = r("vae", "v.safetensors");
    let mut p = video_params();
    p.steps = 0;
    let mut j = job(Family::HunyuanVideo);
    assert!(video(&p, &j, Some(&vae))
        .unwrap_err()
        .contains("at least 1"));
    let p = video_params();
    j.text_encoders.pop();
    let err = video(&p, &j, Some(&vae)).unwrap_err();
    assert!(err.contains("needs 2 text encoder"), "{err}");
    let err = video(&p, &job(Family::Flux), Some(&vae)).unwrap_err();
    assert!(err.contains("is not a video model"), "{err}");
}

#[test]
fn a_video_model_without_a_vae_says_which_one_it_needs() {
    let p = video_params();
    let err = video(&p, &job(Family::HunyuanVideo), None).unwrap_err();
    assert!(err.contains("HunyuanVideo VAE"), "{err}");
}

#[test]
fn the_fp8_setting_changes_the_weight_type_of_the_video_model() {
    let vae = r("vae", "v.safetensors");
    let mut p = video_params();
    p.video_fp8 = Some(true);
    let g = video(&p, &job(Family::HunyuanVideo), Some(&vae)).unwrap();
    let loader = g
        .prompt
        .as_object()
        .unwrap()
        .values()
        .find(|n| n["class_type"] == "UNETLoader")
        .unwrap();
    assert_eq!(loader["inputs"]["weight_dtype"], Value::from("fp8_e4m3fn"));
}
