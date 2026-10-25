//! The logo graph: Z-Image-Turbo, an 8-step distilled image model that draws legible text. Only core ComfyUI nodes
//! are used (UNETLoader, CLIPLoader type `lumina2` for the Qwen3-4B encoder, ModelSamplingAuraFlow,
//! EmptySD3LatentImage). The three model files come from novira's logo pack (`crate::packs::LOGO_FILES`).
use super::graph::{Builder, BuiltGraph, GraphInput};
use serde_json::json;

/// The model is distilled for few steps without guidance; more steps add little.
pub const MAX_STEPS: u32 = 30;
/// Flow shift of ComfyUI's reference workflow for the model.
const SHIFT: f64 = 3.0;

fn link(node: &str, slot: u32) -> serde_json::Value {
    json!([node, slot])
}

/// Sizes the model accepts: multiples of 16, within 256..=2048.
fn size16(v: u32) -> u32 {
    (v.clamp(256, 2048) + 8) / 16 * 16
}

pub fn build(input: &GraphInput<'_>) -> Result<BuiltGraph, String> {
    let p = input.params;
    let text_encoder = input
        .text_encoder
        .ok_or("The logo text encoder is not installed")?;
    let vae = input.vae.ok_or("The logo VAE is not installed")?;
    if p.positive_prompt.trim().is_empty() {
        return Err("The logo needs a prompt".into());
    }
    let steps = p.steps.clamp(1, MAX_STEPS);
    let mut g = Builder::default();
    let unet = g.add(
        "UNETLoader",
        json!({ "unet_name": input.checkpoint.name, "weight_dtype": "default" }),
    );
    let model = g.add(
        "ModelSamplingAuraFlow",
        json!({ "model": link(&unet, 0), "shift": SHIFT }),
    );
    let clip = g.add(
        "CLIPLoader",
        json!({ "clip_name": text_encoder.name, "type": "lumina2", "device": "default" }),
    );
    let vae_node = g.add("VAELoader", json!({ "vae_name": vae.name }));
    let positive = g.add(
        "CLIPTextEncode",
        json!({ "text": p.positive_prompt, "clip": link(&clip, 0) }),
    );
    // Without guidance (cfg 1) the negative side is ignored; a zeroed copy of the positive is what the model expects.
    let negative = g.add(
        "ConditioningZeroOut",
        json!({ "conditioning": link(&positive, 0) }),
    );
    let latent = g.add(
        "EmptySD3LatentImage",
        json!({ "width": size16(p.width), "height": size16(p.height), "batch_size": 1 }),
    );
    let sampled = g.add(
        "KSampler",
        json!({
            "model": link(&model, 0),
            "seed": p.seed,
            "steps": steps,
            "cfg": p.cfg_scale.clamp(1.0, 5.0),
            "sampler_name": "res_multistep",
            "scheduler": "simple",
            "positive": link(&positive, 0),
            "negative": link(&negative, 0),
            "latent_image": link(&latent, 0),
            "denoise": 1.0,
        }),
    );
    let decoded = g.add(
        "VAEDecode",
        json!({ "samples": link(&sampled, 0), "vae": link(&vae_node, 0) }),
    );
    let saved = g.add(
        "SaveImage",
        json!({ "images": link(&decoded, 0), "filename_prefix": "logo/novira" }),
    );
    Ok(BuiltGraph {
        prompt: serde_json::Value::Object(g.nodes),
        output_node: saved,
        total_steps: steps,
        thumbnail_node: None,
        audio_ext: None,
        passes: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::comfy::graph::{build as build_any, tests::params};
    use crate::types::{ComfyRef, GenerationMode};

    fn r(folder: &str, name: &str) -> ComfyRef {
        ComfyRef {
            folder: folder.into(),
            name: name.into(),
        }
    }

    fn built(p: &crate::types::GenerationMetadata) -> Result<BuiltGraph, String> {
        let (unet, te, vae) = (
            r("diffusion_models", "z.safetensors"),
            r("text_encoders", "qwen.safetensors"),
            r("vae", "ae.safetensors"),
        );
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
    }

    fn class_inputs(g: &BuiltGraph, class: &str) -> serde_json::Value {
        g.prompt
            .as_object()
            .unwrap()
            .values()
            .find(|n| n["class_type"] == class)
            .unwrap_or_else(|| panic!("no {class} node"))["inputs"]
            .clone()
    }

    #[test]
    fn the_dispatcher_builds_the_logo_graph() {
        let mut p = params(GenerationMode::Logo);
        p.positive_prompt = "A logo with the text \"NOVA\"".into();
        p.steps = 8;
        p.width = 1000;
        p.height = 3000;
        let g = built(&p).unwrap();
        assert_eq!(class_inputs(&g, "CLIPLoader")["type"], "lumina2");
        let latent = class_inputs(&g, "EmptySD3LatentImage");
        assert_eq!(
            (latent["width"].as_u64(), latent["height"].as_u64()),
            (Some(1008), Some(2048))
        );
        assert_eq!(class_inputs(&g, "KSampler")["steps"], 8);
        assert_eq!(g.total_steps, 8);
    }

    #[test]
    fn steps_are_capped_and_an_empty_prompt_is_refused() {
        let mut p = params(GenerationMode::Logo);
        p.positive_prompt = "logo".into();
        p.steps = 500;
        assert_eq!(built(&p).unwrap().total_steps, MAX_STEPS);
        p.positive_prompt = "  ".into();
        assert!(built(&p).is_err());
    }
}
