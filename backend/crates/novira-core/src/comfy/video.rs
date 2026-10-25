//! The video graph: Wan 2.2 "TI2V 5B", one model that makes a video from text or, when a start image is given,
//! animates that image. Only core ComfyUI nodes are used (UNETLoader, CLIPLoader type `wan`, Wan22ImageToVideoLatent,
//! CreateVideo, SaveVideo). The three model files come from novira's video pack (`crate::packs`).
use super::graph::{sampler_for, Builder, BuiltGraph, GraphInput};
use crate::types::{ComfyRef, GenerationMetadata};
use serde_json::json;

pub const DEFAULT_FRAMES: u32 = 49;
pub const DEFAULT_FPS: u32 = 24;
pub const MAX_FRAMES: u32 = 241;

pub(super) fn link(node: &str, slot: u32) -> serde_json::Value {
    json!([node, slot])
}

/// Frames the model accepts: 4n + 1, within 5..=MAX_FRAMES.
pub fn frames_for(p: &GenerationMetadata) -> u32 {
    let wanted = p
        .video_frames
        .unwrap_or(DEFAULT_FRAMES)
        .clamp(5, MAX_FRAMES);
    (wanted - 1) / 4 * 4 + 1
}

/// Sizes the model accepts: multiples of 32.
pub(super) fn size32(v: u32) -> u32 {
    (v.max(64).saturating_add(16) / 32 * 32).max(64)
}

pub fn build(input: &GraphInput<'_>) -> Result<BuiltGraph, String> {
    // A video model the user installed (Wan 2.1, HunyuanVideo, LTX-Video...) has its own graph.
    if let Some(split) = input.split {
        return super::video_families::build(input, split);
    }
    let text_encoder = input
        .text_encoder
        .ok_or("The video text encoder is not installed")?;
    let vae = input.vae.ok_or("The video VAE is not installed")?;
    build_ti2v(input, text_encoder, vae)
}

/// The Wan 2.2 TI2V 5B graph with the given text encoder and VAE files (the pack's, or the user's own).
pub(super) fn build_ti2v(
    input: &GraphInput<'_>,
    text_encoder: &ComfyRef,
    vae: &ComfyRef,
) -> Result<BuiltGraph, String> {
    let p = input.params;
    let (sampler, scheduler) = sampler_for(&p.scheduler)
        .ok_or_else(|| format!("Scheduler '{}' is not available in ComfyUI", p.scheduler))?;
    if p.steps == 0 {
        return Err("Steps must be at least 1".into());
    }
    let mut g = Builder::default();
    let weight_dtype = if p.video_fp8 == Some(true) {
        "fp8_e4m3fn"
    } else {
        "default"
    };
    let unet = super::split::unet_loader(&mut g, &input.checkpoint.name, weight_dtype);
    // The distilled model was trained with a lower flow shift.
    let shift = if p.model_key == crate::packs::TURBO_KEY {
        5.0
    } else {
        8.0
    };
    let model = g.add("ModelSamplingSD3", json!({ "model": unet, "shift": shift }));
    let clip = super::split::text_encoder(
        &mut g,
        super::split::Family::Wan,
        std::slice::from_ref(text_encoder),
    );
    let vae_node = g.add("VAELoader", json!({ "vae_name": vae.name }));
    let positive = g.add(
        "CLIPTextEncode",
        json!({ "text": p.positive_prompt, "clip": clip }),
    );
    let negative = g.add(
        "CLIPTextEncode",
        json!({ "text": p.negative_prompt, "clip": clip }),
    );
    let mut latent_inputs = json!({
        "vae": link(&vae_node, 0),
        "width": size32(p.width),
        "height": size32(p.height),
        "length": frames_for(p),
        "batch_size": 1,
    });
    if let Some(name) = input.init_image {
        let load = g.add("LoadImage", json!({ "image": name }));
        latent_inputs["start_image"] = link(&load, 0);
    }
    let latent = g.add("Wan22ImageToVideoLatent", latent_inputs);
    let sampled = g.add(
        "KSampler",
        json!({
            "model": link(&model, 0),
            "seed": p.seed,
            "steps": p.steps,
            "cfg": p.cfg_scale,
            "sampler_name": sampler,
            "scheduler": scheduler,
            "positive": link(&positive, 0),
            "negative": link(&negative, 0),
            "latent_image": link(&latent, 0),
            "denoise": 1.0,
        }),
    );
    Ok(finish(
        g,
        p,
        link(&sampled, 0),
        link(&vae_node, 0),
        Vec::new(),
    ))
}

/// The end every video graph shares: decode the latent (in tiles when asked), make the clip, save it as MP4 and keep
/// the first frame as the thumbnail.
pub(super) fn finish(
    g: Builder,
    p: &GenerationMetadata,
    latent: serde_json::Value,
    vae: serde_json::Value,
    passes: Vec<(String, u32)>,
) -> BuiltGraph {
    finish_with_audio(g, p, latent, vae, None, passes)
}

/// [`finish`] for a model that makes sound too (LTX-2): the decoded audio goes into the clip.
pub(super) fn finish_with_audio(
    mut g: Builder,
    p: &GenerationMetadata,
    latent: serde_json::Value,
    vae: serde_json::Value,
    audio: Option<serde_json::Value>,
    passes: Vec<(String, u32)>,
) -> BuiltGraph {
    let decoded = if p.video_tiled_decode == Some(true) {
        g.add(
            "VAEDecodeTiled",
            json!({
                "samples": latent,
                "vae": vae,
                "tile_size": 512,
                "overlap": 64,
                "temporal_size": 64,
                "temporal_overlap": 8,
            }),
        )
    } else {
        g.add("VAEDecode", json!({ "samples": latent, "vae": vae }))
    };
    let fps = p.video_fps.unwrap_or(DEFAULT_FPS).clamp(1, 60);
    let mut clip = json!({ "images": link(&decoded, 0), "fps": fps as f64 });
    if let Some(audio) = audio {
        clip["audio"] = audio;
    }
    let video = g.add("CreateVideo", clip);
    let saved = g.add(
        "SaveVideo",
        json!({
            "video": link(&video, 0),
            "filename_prefix": "video/novira",
            "format": "mp4",
            "codec": "auto",
        }),
    );
    // First frame, kept as the thumbnail.
    let first = g.add(
        "ImageFromBatch",
        json!({ "image": link(&decoded, 0), "batch_index": 0, "length": 1 }),
    );
    let thumbnail = g.add("PreviewImage", json!({ "images": link(&first, 0) }));
    BuiltGraph {
        prompt: serde_json::Value::Object(g.nodes),
        output_node: saved,
        total_steps: p.steps,
        thumbnail_node: Some(thumbnail),
        audio_ext: None,
        passes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::comfy::graph::{build as build_any, tests::params};
    use crate::types::{ComfyRef, GenerationMode};

    fn refs() -> (ComfyRef, ComfyRef, ComfyRef) {
        let r = |folder: &str, name: &str| ComfyRef {
            folder: folder.into(),
            name: name.into(),
        };
        (
            r("diffusion_models", "wan.safetensors"),
            r("text_encoders", "umt5.safetensors"),
            r("vae", "wan_vae.safetensors"),
        )
    }

    fn video_params() -> GenerationMetadata {
        let mut p = params(GenerationMode::Video);
        p.width = 833;
        p.height = 481;
        p.video_frames = Some(50);
        p.steps = 20;
        p.cfg_scale = 5.0;
        p
    }

    fn graph(init: Option<&str>) -> BuiltGraph {
        let (unet, te, vae) = refs();
        let p = video_params();
        build_any(&GraphInput {
            split: None,
            params: &p,
            checkpoint: &unet,
            vae: Some(&vae),
            loras: vec![],
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: Some(&te),
            init_image: init,
            guidance: Default::default(),
        })
        .unwrap()
    }

    fn nodes<'a>(g: &'a BuiltGraph, class: &str) -> Vec<&'a serde_json::Value> {
        g.prompt
            .as_object()
            .unwrap()
            .values()
            .filter(|n| n["class_type"] == class)
            .collect()
    }

    #[test]
    fn text_to_video_uses_the_wan_nodes_and_snaps_size_and_frames() {
        let g = graph(None);
        let latent = nodes(&g, "Wan22ImageToVideoLatent")[0];
        assert_eq!(latent["inputs"]["width"], 832);
        assert_eq!(latent["inputs"]["height"], 480);
        assert_eq!(latent["inputs"]["length"], 49);
        assert!(latent["inputs"].get("start_image").is_none());
        assert_eq!(nodes(&g, "CLIPLoader")[0]["inputs"]["type"], "wan");
        assert_eq!(nodes(&g, "ModelSamplingSD3")[0]["inputs"]["shift"], 8.0);
        assert_eq!(nodes(&g, "CreateVideo")[0]["inputs"]["fps"], 24.0);
        assert_eq!(g.prompt[&g.output_node]["class_type"], "SaveVideo");
        assert_eq!(
            g.prompt[g.thumbnail_node.as_ref().unwrap()]["class_type"],
            "PreviewImage"
        );
        assert!(nodes(&g, "LoadImage").is_empty());
        assert_eq!(g.total_steps, 20);
    }

    #[test]
    fn the_small_gpu_switches_load_fp8_weights_and_decode_in_tiles() {
        let (unet, te, vae) = refs();
        let mut p = video_params();
        let make = |p: &GenerationMetadata| {
            build_any(&GraphInput {
                split: None,
                params: p,
                checkpoint: &unet,
                vae: Some(&vae),
                loras: vec![],
                upscale_model: None,
                tile_controlnet: None,
                post_processing_model: None,
                text_encoder: Some(&te),
                init_image: None,
                guidance: Default::default(),
            })
            .unwrap()
        };
        let plain = make(&p);
        assert_eq!(
            nodes(&plain, "UNETLoader")[0]["inputs"]["weight_dtype"],
            "default"
        );
        assert!(nodes(&plain, "VAEDecodeTiled").is_empty());
        p.video_fp8 = Some(true);
        p.video_tiled_decode = Some(true);
        let light = make(&p);
        assert_eq!(
            nodes(&light, "UNETLoader")[0]["inputs"]["weight_dtype"],
            "fp8_e4m3fn"
        );
        assert!(nodes(&light, "VAEDecode").is_empty());
        let tiled = nodes(&light, "VAEDecodeTiled")[0];
        // The first frame (the thumbnail) and the video both come from the tiled decode.
        let id = light
            .prompt
            .as_object()
            .unwrap()
            .iter()
            .find(|(_, n)| n["class_type"] == "VAEDecodeTiled")
            .map(|(k, _)| k.clone())
            .unwrap();
        assert_eq!(nodes(&light, "CreateVideo")[0]["inputs"]["images"][0], id);
        assert_eq!(tiled["inputs"]["tile_size"], 512);
    }

    #[test]
    fn the_turbo_model_lowers_the_flow_shift() {
        let (unet, te, vae) = refs();
        let mut p = video_params();
        p.model_key = crate::packs::TURBO_KEY.into();
        let g = build_any(&GraphInput {
            split: None,
            params: &p,
            checkpoint: &unet,
            vae: Some(&vae),
            loras: vec![],
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: Some(&te),
            init_image: None,
            guidance: Default::default(),
        })
        .unwrap();
        assert_eq!(nodes(&g, "ModelSamplingSD3")[0]["inputs"]["shift"], 5.0);
    }

    #[test]
    fn a_source_image_becomes_the_start_image() {
        let g = graph(Some("start.png"));
        let load = nodes(&g, "LoadImage")[0];
        assert_eq!(load["inputs"]["image"], "start.png");
        let latent = nodes(&g, "Wan22ImageToVideoLatent")[0];
        assert!(latent["inputs"]["start_image"].is_array());
    }

    #[test]
    fn missing_pack_files_are_refused_with_a_reason() {
        let (unet, _, vae) = refs();
        let p = video_params();
        let err = build_any(&GraphInput {
            split: None,
            params: &p,
            checkpoint: &unet,
            vae: Some(&vae),
            loras: vec![],
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: None,
            init_image: None,
            guidance: Default::default(),
        })
        .unwrap_err();
        assert!(err.contains("text encoder"));
    }

    #[test]
    fn frame_counts_are_four_n_plus_one() {
        let mut p = video_params();
        for (wanted, expected) in [(1, 5), (5, 5), (6, 5), (49, 49), (50, 49), (1000, 241)] {
            p.video_frames = Some(wanted);
            assert_eq!(frames_for(&p), expected, "{wanted}");
        }
    }
}
