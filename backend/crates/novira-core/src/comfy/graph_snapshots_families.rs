//! Snapshots of the prompts built for the newer model families (image and video), so a change to what reaches
//! ComfyUI for them shows up as a JSON diff, and `node_defs_check` can test every one against the node definitions of
//! a real ComfyUI. Same files and update command as `graph_snapshots`.
use super::graph::{build, tests::params, BuiltGraph, ControlInput, GraphInput, GuidanceInput};
use super::graph_snapshots::{assert_snapshot, built_json};
use super::split::{Family, Loader, SplitJob, WanKind, MODEL_PATCHES};
use crate::models::classify::Variant;
use crate::types::{ComfyRef, ControlMode, GenerationMetadata, GenerationMode, HiresFix};

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

fn job(f: Family) -> SplitJob {
    SplitJob::new(
        f,
        Loader::Unet,
        (0..f.encoders().len())
            .map(|i| r("text_encoders", &format!("te{i}.safetensors")))
            .collect(),
    )
}

fn make(
    p: &GenerationMetadata,
    split: &SplitJob,
    init: Option<&str>,
    guidance: GuidanceInput<'_>,
) -> BuiltGraph {
    make_with("model.safetensors", p, split, init, guidance)
}

fn make_with(
    model: &str,
    p: &GenerationMetadata,
    split: &SplitJob,
    init: Option<&str>,
    guidance: GuidanceInput<'_>,
) -> BuiltGraph {
    let unet = r("diffusion_models", model);
    let vae = r("vae", "vae.safetensors");
    build(&GraphInput {
        params: p,
        checkpoint: &unet,
        vae: Some(&vae),
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        split: Some(split),
        init_image: init,
        guidance,
    })
    .expect("the snapshot case builds")
}

fn snap(case: &str, p: &GenerationMetadata, split: &SplitJob, init: Option<&str>) {
    assert_snapshot(
        case,
        &built_json(&make(p, split, init, GuidanceInput::default())),
    );
}

fn video_params() -> GenerationMetadata {
    let mut p = params(GenerationMode::Video);
    p.width = 833;
    p.height = 481;
    p.video_frames = Some(50);
    p.video_fps = Some(24);
    p.steps = 20;
    p.cfg_scale = 5.0;
    p
}

#[test]
fn every_image_family_draws_from_text() {
    let mut p = params(GenerationMode::Txt2img);
    // Anima runs the scheduler setting, and plain `euler` is its template's; the other families ignore the setting.
    p.scheduler = "euler".into();
    snap("family-anima", &p, &job(Family::Anima), None);
    snap("family-flux", &p, &job(Family::Flux), None);
    snap("family-chroma", &p, &job(Family::Chroma), None);
    snap("family-qwen-image", &p, &job(Family::QwenImage), None);
    snap("family-z-image", &p, &job(Family::ZImage), None);
    snap("family-sd3", &p, &job(Family::Sd3), None);
    snap("family-hidream", &p, &job(Family::Hidream), None);
    snap("family-hunyuan-image", &p, &job(Family::HunyuanImage), None);
    snap(
        "family-flux2-dev",
        &p,
        &variant_job(Family::Flux2, Variant::Flux2Dev),
        None,
    );
    snap(
        "family-flux2-klein",
        &p,
        &variant_job(Family::Flux2, Variant::Flux2Klein4b),
        None,
    );
    snap("family-auraflow", &p, &job(Family::Auraflow), None);
}

#[test]
fn a_draft_of_a_newer_family_stops_early() {
    let mut p = params(GenerationMode::Txt2img);
    p.scheduler = "euler".into();
    p.draft_at = Some(0.35);
    snap("family-anima-draft", &p, &job(Family::Anima), None);
    snap("family-z-image-draft", &p, &job(Family::ZImage), None);
    snap(
        "family-flux2-dev-draft",
        &p,
        &variant_job(Family::Flux2, Variant::Flux2Dev),
        None,
    );
}

#[test]
fn a_checkpoint_of_a_family_carries_its_parts() {
    let mut split = job(Family::Sd3);
    split.text_encoders.truncate(1);
    split.loader = Loader::Checkpoint {
        clip: true,
        vae: true,
    };
    snap(
        "family-sd3-checkpoint",
        &params(GenerationMode::Txt2img),
        &split,
        None,
    );
}

#[test]
fn flux_redraws_inpaints_and_upscales_through_the_shared_graph() {
    let split = job(Family::Flux);
    let mut p = params(GenerationMode::Img2img);
    p.strength = Some(0.55);
    snap("family-flux-img2img", &p, &split, Some("src.png"));
    let mut p = params(GenerationMode::Inpaint);
    p.strength = Some(1.0);
    let guidance = GuidanceInput {
        mask_image: Some("mask.png"),
        ..GuidanceInput::default()
    };
    assert_snapshot(
        "family-flux-inpaint",
        &built_json(&make(&p, &split, Some("src.png"), guidance)),
    );
    let mut p = params(GenerationMode::Txt2img);
    p.hires_fix = Some(HiresFix {
        scale: 1.5,
        strength: 0.4,
        steps: None,
        upscale_model_key: None,
    });
    snap("family-flux-hires", &p, &split, None);
}

fn controlled(case: &str, f: Family, model: &ComfyRef) {
    let mut p = params(GenerationMode::Txt2img);
    p.scheduler = "euler".into();
    p.control_layer_count = Some(1);
    let guidance = GuidanceInput {
        controls: vec![ControlInput {
            model,
            image: "pose.png",
            weight: 0.7,
            begin_end: [0.0, 0.8],
            mode: ControlMode::Balanced,
            union_type: None,
        }],
        ..GuidanceInput::default()
    };
    assert_snapshot(case, &built_json(&make(&p, &job(f), None, guidance)));
}

#[test]
fn a_controlnet_and_the_model_patches_control_the_newer_families() {
    let cn = r("controlnet", "flux-union.safetensors");
    let patch = r(MODEL_PATCHES, "patch.safetensors");
    controlled("family-flux-controlnet", Family::Flux, &cn);
    controlled("family-anima-lllite", Family::Anima, &patch);
    controlled("family-qwen-image-patch", Family::QwenImage, &patch);
    controlled("family-z-image-patch", Family::ZImage, &patch);
}

#[test]
fn every_video_family_makes_a_clip() {
    let p = video_params();
    let wan = |kind| {
        let mut j = job(Family::Wan);
        j.wan = Some(kind);
        j
    };
    snap("family-wan-t2v", &p, &wan(WanKind::T2v), None);
    snap("family-wan-i2v", &p, &wan(WanKind::I2v), Some("start.png"));
    snap("family-wan-5b", &p, &wan(WanKind::Ti2v), None);
    let mut pair = wan(WanKind::T2v);
    pair.low_noise = Some(r("diffusion_models", "low.safetensors"));
    snap("family-wan-22-pair", &p, &pair, None);
    snap("family-hunyuan-video", &p, &job(Family::HunyuanVideo), None);
    let mut i2v = variant_job(Family::HunyuanVideo, Variant::HyI2v);
    i2v.clip_vision = Some(r("clip_vision", "llava_llama3_vision.safetensors"));
    snap("family-hunyuan-video-i2v", &p, &i2v, Some("start.png"));
    let mut ltx = job(Family::Ltx);
    ltx.loader = Loader::Checkpoint {
        clip: false,
        vae: true,
    };
    snap("family-ltx-t2v", &p, &ltx, None);
    snap("family-ltx-i2v", &p, &ltx, Some("start.png"));
}

/// A job whose model and encoders are GGUF files.
fn gguf_job(f: Family) -> SplitJob {
    SplitJob::new(
        f,
        Loader::Unet,
        (0..f.encoders().len())
            .map(|i| r("text_encoders", &format!("te{i}-Q8_0.gguf")))
            .collect(),
    )
}

fn gguf(case: &str, f: Family) {
    let p = params(GenerationMode::Txt2img);
    let g = make_with(
        "model-Q4_K_M.gguf",
        &p,
        &gguf_job(f),
        None,
        GuidanceInput::default(),
    );
    assert_snapshot(case, &built_json(&g));
}

#[test]
fn quantised_gguf_models_load_through_the_gguf_pack() {
    gguf("family-flux-gguf", Family::Flux);
    gguf("family-sd3-gguf", Family::Sd3);
    gguf("family-z-image-gguf", Family::ZImage);
    let v = video_params();
    let mut pair = gguf_job(Family::Wan);
    pair.wan = Some(WanKind::T2v);
    pair.low_noise = Some(r("diffusion_models", "low-Q4_K_M.gguf"));
    let g = make_with(
        "high-Q4_K_M.gguf",
        &v,
        &pair,
        None,
        GuidanceInput::default(),
    );
    assert_snapshot("family-wan-gguf-pair", &built_json(&g));
}

fn variant_job(f: Family, v: Variant) -> SplitJob {
    let mut j = job(f);
    j.variant = v;
    j
}

#[test]
fn flux_fill_inpaints_through_the_conditioning_node() {
    let mut p = params(GenerationMode::Inpaint);
    p.strength = Some(1.0);
    let guidance = GuidanceInput {
        mask_image: Some("mask.png"),
        ..GuidanceInput::default()
    };
    let split = variant_job(Family::Flux, Variant::FluxFill);
    let g = make(&p, &split, Some("src.png"), guidance);
    assert_snapshot("family-flux-fill", &built_json(&g));
}

#[test]
fn the_edit_models_take_the_source_through_their_conditioning() {
    let p = params(GenerationMode::Img2img);
    let kontext = variant_job(Family::Flux, Variant::FluxKontext);
    snap("family-flux-kontext", &p, &kontext, Some("src.png"));
    let edit = variant_job(Family::QwenImage, Variant::QwenEdit);
    snap("family-qwen-image-edit", &p, &edit, Some("src.png"));
    let plus = variant_job(Family::QwenImage, Variant::QwenEditPlus);
    snap("family-qwen-image-edit-plus", &p, &plus, Some("src.png"));
}

#[test]
fn wan_vace_and_wan_21_image_to_video_have_their_own_nodes() {
    let p = video_params();
    let mut vace = variant_job(Family::Wan, Variant::WanVace);
    vace.wan = Some(WanKind::T2v);
    snap("family-wan-vace-t2v", &p, &vace, None);
    snap("family-wan-vace-reference", &p, &vace, Some("ref.png"));
    let mut i2v = job(Family::Wan);
    i2v.wan = Some(WanKind::I2v);
    i2v.clip_vision = Some(r("clip_vision", "clip_vision_h.safetensors"));
    snap("family-wan-i2v-clip-vision", &p, &i2v, Some("start.png"));
}

#[test]
fn flux2_edits_a_picture_by_reference() {
    let p = params(GenerationMode::Img2img);
    let klein = variant_job(Family::Flux2, Variant::Flux2Klein4b);
    snap("family-flux2-klein-reference", &p, &klein, Some("src.png"));
}

#[test]
fn flux2_draws_from_text_with_pictures_given_as_references() {
    // A comic panel: the characters' pictures go to the model itself.
    let p = params(GenerationMode::Txt2img);
    let dev = variant_job(Family::Flux2, Variant::Flux2Dev);
    let guidance = GuidanceInput {
        references: vec!["mina.png", "jin.png"],
        ..GuidanceInput::default()
    };
    assert_snapshot(
        "family-flux2-dev-references",
        &built_json(&make(&p, &dev, None, guidance)),
    );
}

#[test]
fn hunyuan_video_15_and_ltx2_make_clips() {
    let p = video_params();
    snap(
        "family-hunyuan-video-15-t2v",
        &p,
        &job(Family::HunyuanVideo15),
        None,
    );
    let mut i2v = variant_job(Family::HunyuanVideo15, Variant::Hy15I2v);
    i2v.clip_vision = Some(r("clip_vision", "sigclip_vision_patch14_384.safetensors"));
    snap("family-hunyuan-video-15-i2v", &p, &i2v, Some("start.png"));
    let mut ltx2 = job(Family::Ltx2);
    ltx2.loader = Loader::Checkpoint {
        clip: false,
        vae: true,
    };
    snap("family-ltx2-t2v", &p, &ltx2, None);
    snap("family-ltx2-i2v", &p, &ltx2, Some("start.png"));
}
