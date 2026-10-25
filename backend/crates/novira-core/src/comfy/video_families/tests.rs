use super::*;
use crate::comfy::graph::{build as build_any, tests::params, GraphInput, GuidanceInput};
use crate::comfy::split::Loader;
use crate::types::{ComfyRef, GenerationMode};

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

fn job(family: Family, wan: Option<WanKind>) -> SplitJob {
    let mut j = SplitJob::new(
        family,
        Loader::Unet,
        (0..family.encoders().len())
            .map(|i| r("text_encoders", &format!("te{i}.safetensors")))
            .collect(),
    );
    j.wan = wan;
    j
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

fn build_with(
    p: &GenerationMetadata,
    unet: &ComfyRef,
    vae: Option<&ComfyRef>,
    split: &SplitJob,
    init: Option<&str>,
) -> Result<BuiltGraph, String> {
    build_any(&GraphInput {
        params: p,
        checkpoint: unet,
        vae,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        split: Some(split),
        init_image: init,
        guidance: GuidanceInput::default(),
    })
}

fn count(g: &BuiltGraph, class: &str) -> usize {
    g.prompt
        .as_object()
        .unwrap()
        .values()
        .filter(|n| n["class_type"] == class)
        .count()
}

fn node<'a>(g: &'a BuiltGraph, class: &str) -> &'a Value {
    g.prompt
        .as_object()
        .unwrap()
        .values()
        .find(|n| n["class_type"] == class)
        .map(|n| &n["inputs"])
        .unwrap_or_else(|| panic!("no {class}"))
}

fn nodes<'a>(g: &'a BuiltGraph, class: &str) -> Vec<&'a Value> {
    g.prompt
        .as_object()
        .unwrap()
        .values()
        .filter(|n| n["class_type"] == class)
        .map(|n| &n["inputs"])
        .collect()
}

fn vae() -> ComfyRef {
    r("vae", "vae.safetensors")
}

fn unet() -> ComfyRef {
    r("diffusion_models", "model.safetensors")
}

#[test]
fn every_video_graph_ends_in_an_mp4_with_a_thumbnail() {
    let p = video_params();
    let cases = [
        job(Family::Wan, Some(WanKind::T2v)),
        job(Family::HunyuanVideo, None),
        {
            let mut j = job(Family::Ltx, None);
            j.loader = Loader::Checkpoint {
                clip: false,
                vae: true,
            };
            j
        },
    ];
    for split in &cases {
        let v = vae();
        let g = build_with(&p, &unet(), Some(&v), split, None).unwrap();
        assert_eq!(count(&g, "SaveVideo"), 1, "{:?}", split.family);
        assert_eq!(node(&g, "SaveVideo")["format"], "mp4");
        assert_eq!(node(&g, "CreateVideo")["fps"], 24.0);
        assert!(g.thumbnail_node.is_some());
        assert_eq!(g.output_node, {
            let (id, _) = g
                .prompt
                .as_object()
                .unwrap()
                .iter()
                .find(|(_, n)| n["class_type"] == "SaveVideo")
                .unwrap();
            id.clone()
        });
    }
}

#[test]
fn wan_text_to_video_uses_the_empty_video_latent_and_the_wan_shift() {
    let p = video_params();
    let v = vae();
    let g = build_with(
        &p,
        &unet(),
        Some(&v),
        &job(Family::Wan, Some(WanKind::T2v)),
        None,
    )
    .unwrap();
    assert_eq!(node(&g, "CLIPLoader")["type"], "wan");
    assert_eq!(node(&g, "ModelSamplingSD3")["shift"], 8.0);
    let latent = node(&g, "EmptyHunyuanLatentVideo");
    // Sizes snap to 16, the frames to 4n + 1.
    assert_eq!(
        (
            latent["width"].as_u64(),
            latent["height"].as_u64(),
            latent["length"].as_u64()
        ),
        (Some(832), Some(480), Some(49))
    );
    let k = node(&g, "KSampler");
    assert_eq!(
        (k["sampler_name"].as_str(), k["scheduler"].as_str()),
        (Some("uni_pc"), Some("simple"))
    );
    assert_eq!(k["cfg"], 5.0);
    assert_eq!(count(&g, "WanImageToVideo"), 0);
    assert_eq!(count(&g, "CLIPTextEncode"), 2);
}

#[test]
fn wan_image_to_video_conditions_on_the_start_picture() {
    let p = video_params();
    let v = vae();
    let split = job(Family::Wan, Some(WanKind::I2v));
    let g = build_with(&p, &unet(), Some(&v), &split, Some("start.png")).unwrap();
    assert_eq!(node(&g, "LoadImage")["image"], "start.png");
    let i2v = node(&g, "WanImageToVideo");
    assert_eq!(i2v["length"], 49);
    assert_eq!(count(&g, "EmptyHunyuanLatentVideo"), 0);
    // The sampler reads the conditioning the node gave back.
    let k = node(&g, "KSampler");
    assert_eq!(k["positive"][1], 0);
    assert_eq!(k["negative"][1], 1);
    assert_eq!(k["latent_image"][1], 2);
    // The two kinds do not mix: the error says what to use.
    let err = build_with(&p, &unet(), Some(&v), &split, None).unwrap_err();
    assert!(err.contains("needs a source picture"), "{err}");
    let t2v = job(Family::Wan, Some(WanKind::T2v));
    let err = build_with(&p, &unet(), Some(&v), &t2v, Some("start.png")).unwrap_err();
    assert!(err.contains("cannot animate a picture"), "{err}");
}

#[test]
fn a_wan_22_pair_hands_over_from_the_high_to_the_low_noise_model() {
    let p = video_params();
    let v = vae();
    let mut split = job(Family::Wan, Some(WanKind::T2v));
    split.low_noise = Some(r("diffusion_models", "low.safetensors"));
    let g = build_with(&p, &unet(), Some(&v), &split, None).unwrap();
    assert_eq!(count(&g, "UNETLoader"), 2);
    assert_eq!(count(&g, "ModelSamplingSD3"), 2);
    let k = nodes(&g, "KSamplerAdvanced");
    assert_eq!(k.len(), 2);
    let high = k.iter().find(|n| n["add_noise"] == "enable").unwrap();
    let low = k.iter().find(|n| n["add_noise"] == "disable").unwrap();
    assert_eq!(
        (high["start_at_step"].as_u64(), high["end_at_step"].as_u64()),
        (Some(0), Some(10))
    );
    assert_eq!(high["return_with_leftover_noise"], "enable");
    assert_eq!(
        (low["start_at_step"].as_u64(), low["end_at_step"].as_u64()),
        (Some(10), Some(10000))
    );
    // Progress counts through both.
    assert_eq!(g.passes.len(), 2);
    assert_eq!(g.passes[1].1, 10);
    assert_eq!(g.total_steps, 20);
}

#[test]
fn the_5b_wan_model_runs_the_pack_graph_with_the_users_files() {
    let p = video_params();
    let vae = r("vae", "wan2.2_vae.safetensors");
    let g = build_with(
        &p,
        &unet(),
        Some(&vae),
        &job(Family::Wan, Some(WanKind::Ti2v)),
        None,
    )
    .unwrap();
    assert_eq!(count(&g, "Wan22ImageToVideoLatent"), 1);
    assert_eq!(node(&g, "VAELoader")["vae_name"], "wan2.2_vae.safetensors");
    assert_eq!(node(&g, "CLIPLoader")["clip_name"], "te0.safetensors");
}

#[test]
fn hunyuan_video_samples_with_a_guider_and_no_negative_prompt() {
    let mut p = video_params();
    p.cfg_scale = 6.0;
    let v = vae();
    let g = build_with(
        &p,
        &unet(),
        Some(&v),
        &job(Family::HunyuanVideo, None),
        None,
    )
    .unwrap();
    let dual = node(&g, "DualCLIPLoader");
    assert_eq!(dual["type"], "hunyuan_video");
    assert_eq!(dual["clip_name2"], "te1.safetensors");
    assert_eq!(node(&g, "ModelSamplingSD3")["shift"], 7.0);
    assert_eq!(node(&g, "FluxGuidance")["guidance"], 6.0);
    assert_eq!(count(&g, "CLIPTextEncode"), 1);
    assert_eq!(count(&g, "SamplerCustomAdvanced"), 1);
    assert_eq!(node(&g, "BasicScheduler")["steps"], 20);
    assert_eq!(node(&g, "RandomNoise")["noise_seed"], 42);
    let err = build_with(
        &p,
        &unet(),
        Some(&v),
        &job(Family::HunyuanVideo, None),
        Some("a.png"),
    )
    .unwrap_err();
    assert!(err.contains("cannot animate"), "{err}");
    // The image-to-video model reads the picture with LLaVA and replaces the first frames of the noise.
    let mut i2v = job(Family::HunyuanVideo, None);
    i2v.variant = crate::models::classify::Variant::HyI2v;
    i2v.clip_vision = Some(r("clip_vision", "llava_llama3_vision.safetensors"));
    let g = build_with(&p, &unet(), Some(&v), &i2v, Some("a.png")).unwrap();
    assert_eq!(
        node(&g, "HunyuanImageToVideo")["guidance_type"],
        "v1 (concat)"
    );
    let replace = r(
        "diffusion_models",
        "hunyuan_video_v2_replace_image_to_video_720p_bf16.safetensors",
    );
    let g = build_with(&p, &replace, Some(&v), &i2v, Some("a.png")).unwrap();
    assert_eq!(
        node(&g, "HunyuanImageToVideo")["guidance_type"],
        "v2 (replace)"
    );
    assert_eq!(count(&g, "TextEncodeHunyuanVideo_ImageToVideo"), 1);
    assert_eq!(count(&g, "EmptyHunyuanLatentVideo"), 0);
    assert!(build_with(&p, &unet(), Some(&v), &i2v, None)
        .unwrap_err()
        .contains("needs a source picture"));
}

#[test]
fn ltx_video_loads_a_checkpoint_and_snaps_frames_to_8n_plus_1() {
    let mut p = video_params();
    p.video_fps = Some(25);
    let ckpt = r("diffusion_models", "ltx-video-2b-v0.9.5.safetensors");
    let mut split = job(Family::Ltx, None);
    split.loader = Loader::Checkpoint {
        clip: false,
        vae: true,
    };
    let g = build_with(&p, &ckpt, None, &split, None).unwrap();
    assert_eq!(
        node(&g, "CheckpointLoaderSimple")["ckpt_name"],
        "ltx-video-2b-v0.9.5.safetensors"
    );
    assert_eq!(count(&g, "VAELoader") + count(&g, "UNETLoader"), 0);
    assert_eq!(node(&g, "CLIPLoader")["type"], "ltxv");
    let latent = node(&g, "EmptyLTXVLatentVideo");
    assert_eq!(
        (
            latent["width"].as_u64(),
            latent["height"].as_u64(),
            latent["length"].as_u64()
        ),
        (Some(832), Some(480), Some(49))
    );
    assert_eq!(node(&g, "LTXVConditioning")["frame_rate"], 25.0);
    assert_eq!(node(&g, "LTXVScheduler")["steps"], 20);
    assert_eq!(node(&g, "SamplerCustom")["cfg"], 5.0);
    // The decoder reads the checkpoint's VAE (output 2).
    assert_eq!(node(&g, "VAEDecode")["vae"][1], 2);
    // With a start picture the latent comes from the image node.
    let i2v = build_with(&p, &ckpt, None, &split, Some("a.png")).unwrap();
    assert_eq!(count(&i2v, "EmptyLTXVLatentVideo"), 0);
    assert_eq!(node(&i2v, "LTXVImgToVideo")["image"][1], 0);
    assert_eq!(node(&i2v, "LTXVConditioning")["positive"][1], 0);
}

#[test]
fn a_missing_vae_or_encoder_is_refused_with_the_file_to_install() {
    let p = video_params();
    let err = build_with(
        &p,
        &unet(),
        None,
        &job(Family::Wan, Some(WanKind::T2v)),
        None,
    )
    .unwrap_err();
    assert!(err.contains("Wan 2.1 VAE"), "{err}");
    let mut split = job(Family::HunyuanVideo, None);
    split.text_encoders.pop();
    let v = vae();
    let err = build_with(&p, &unet(), Some(&v), &split, None).unwrap_err();
    assert!(err.contains("2 text encoder"), "{err}");
    let err = build_with(&p, &unet(), Some(&v), &job(Family::Wan, None), None).unwrap_err();
    assert!(err.contains("could not be read"), "{err}");
}

#[test]
fn hunyuan_video_15_samples_with_a_cfg_guider_and_its_own_latent() {
    use crate::models::classify::Variant;
    let p = video_params();
    let v = vae();
    let t2v = build_with(
        &p,
        &unet(),
        Some(&v),
        &job(Family::HunyuanVideo15, None),
        None,
    )
    .unwrap();
    let dual = node(&t2v, "DualCLIPLoader");
    assert_eq!(dual["type"], "hunyuan_video_15");
    assert_eq!(node(&t2v, "ModelSamplingSD3")["shift"], 7.0);
    assert_eq!(count(&t2v, "EmptyHunyuanVideo15Latent"), 1);
    assert_eq!(node(&t2v, "CFGGuider")["cfg"], 5.0);
    assert_eq!(count(&t2v, "CLIPTextEncode"), 2);
    let mut i2v = job(Family::HunyuanVideo15, None);
    i2v.variant = Variant::Hy15I2v;
    i2v.clip_vision = Some(r("clip_vision", "sigclip.safetensors"));
    let g = build_with(&p, &unet(), Some(&v), &i2v, Some("a.png")).unwrap();
    assert_eq!(count(&g, "HunyuanVideo15ImageToVideo"), 1);
    assert_eq!(node(&g, "CLIPVisionEncode")["crop"], "center");
    // The two kinds do not mix.
    assert!(build_with(&p, &unet(), Some(&v), &i2v, None)
        .unwrap_err()
        .contains("needs a source picture"));
    let t2v_job = job(Family::HunyuanVideo15, None);
    assert!(build_with(&p, &unet(), Some(&v), &t2v_job, Some("a.png"))
        .unwrap_err()
        .contains("cannot animate"));
}

#[test]
fn ltx2_samples_video_and_sound_together_and_puts_the_sound_in_the_clip() {
    let p = video_params();
    let mut split = job(Family::Ltx2, None);
    split.loader = Loader::Checkpoint {
        clip: false,
        vae: true,
    };
    let g = build_with(&p, &unet(), None, &split, None).unwrap();
    assert_eq!(
        node(&g, "LTXAVTextEncoderLoader")["ckpt_name"],
        "model.safetensors"
    );
    assert_eq!(
        node(&g, "LTXVAudioVAELoader")["ckpt_name"],
        "model.safetensors"
    );
    assert_eq!(count(&g, "LTXVConcatAVLatent"), 1);
    assert_eq!(count(&g, "LTXVSeparateAVLatent"), 1);
    // The sound is given to the clip.
    assert!(node(&g, "CreateVideo").get("audio").is_some());
    // 50 frames snap to 8n + 1; sizes to 32.
    assert_eq!(node(&g, "EmptyLTXVLatentVideo")["length"], 49);
    assert_eq!(node(&g, "EmptyLTXVLatentVideo")["width"], 832);
    let i2v = build_with(&p, &unet(), None, &split, Some("a.png")).unwrap();
    assert_eq!(count(&i2v, "LTXVImgToVideoInplace"), 1);
}
