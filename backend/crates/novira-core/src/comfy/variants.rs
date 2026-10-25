//! Picture models that do not run the shared picture graph: the ones made to edit or to inpaint (Flux Fill, Flux
//! Kontext, Qwen-Image-Edit), which take the source picture through their own conditioning nodes, and FLUX.2, which
//! samples with a guider and its own scheduler. Each recipe is the one of ComfyUI's own template for the model. The
//! Generate tab gives the edit models the source in image to image (or, for Fill, inpaint) and the prompt says what to
//! change.
use super::graph::{draft_step, output_size, soft_mask_nodes, Builder, BuiltGraph, GraphInput};
use super::split::{link, Family, SplitJob};
use crate::models::classify::Variant;
use crate::types::GenerationMode;
use serde_json::{json, Value};

/// Flux Fill is trained for a guidance of 30; the CFG value of the screen is for the plain models.
const FILL_GUIDANCE: f64 = 30.0;

/// The size a picture given to FLUX.2 as a reference is encoded at: enough for a face and clothes, and each reference
/// adds its tokens to every step.
const REFERENCE_MEGAPIXELS: f64 = 1.0;

/// Whether `split` is an image model of these recipes.
pub(super) fn is_edit(split: &SplitJob) -> bool {
    split.family == Family::Flux2
        || matches!(
            split.variant,
            Variant::FluxFill | Variant::FluxKontext | Variant::QwenEdit | Variant::QwenEditPlus
        )
}

/// FLUX.2: text to image, or an edit by a reference picture (image to image). Dev takes the strength as a guidance value
/// (`FluxGuidance` and `BasicGuider`); klein runs `CFGGuider` with a zeroed negative, at CFG 1 when distilled.
fn flux2(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    let p = input.params;
    if p.steps == 0 {
        return Err("Steps must be at least 1".into());
    }
    if p.hires_fix.is_some()
        || !input.guidance.controls.is_empty()
        || input.guidance.mask_image.is_some()
    {
        return Err("FLUX.2 does not take masks, control layers or the high-resolution fix".into());
    }
    let draft_end = match p.draft_at {
        Some(f) => {
            if p.generation_mode != GenerationMode::Txt2img {
                return Err("Drafts are only available for text to image".into());
            }
            if !(f > 0.0 && f < 1.0) || p.steps < 4 {
                return Err("A draft needs a position between 0 and 1 and at least 4 steps".into());
            }
            Some(draft_step(p.steps, f))
        }
        None => None,
    };
    if !matches!(
        p.generation_mode,
        GenerationMode::Txt2img | GenerationMode::Img2img
    ) {
        return Err("FLUX.2 draws from text, or edits a picture in image to image".into());
    }
    let mut g = Builder::default();
    let (mut model, mut clip, vae) = super::split::load(&mut g, input, split);
    for (lora, weight) in &input.loras {
        let id = g.add(
            "LoraLoader",
            json!({ "model": model, "clip": clip, "lora_name": lora.name, "strength_model": weight, "strength_clip": weight }),
        );
        model = link(&id, 0);
        clip = link(&id, 1);
    }
    let (width, height) = output_size(p);
    let prompt = link(
        &g.add(
            "CLIPTextEncode",
            json!({ "text": p.positive_prompt, "clip": clip }),
        ),
        0,
    );
    let zero = link(
        &g.add("ConditioningZeroOut", json!({ "conditioning": prompt })),
        0,
    );
    let (mut positive, mut negative) = (prompt, zero);
    // A reference picture: encoded and given to both sides; the picture is drawn at its own size.
    let (width, height) = match input.init_image {
        Some(name) => {
            let load = g.add("LoadImage", json!({ "image": name }));
            let megapixels = (f64::from(width) * f64::from(height) / 1e6).clamp(0.1, 4.0);
            let scaled = link(
                &g.add(
                    "ImageScaleToTotalPixels",
                    json!({ "image": link(&load, 0), "upscale_method": "nearest-exact", "megapixels": megapixels, "resolution_steps": 16 }),
                ),
                0,
            );
            let encoded = link(
                &g.add("VAEEncode", json!({ "pixels": scaled, "vae": vae })),
                0,
            );
            for side in [&mut positive, &mut negative] {
                let id = g.add(
                    "ReferenceLatent",
                    json!({ "conditioning": side.clone(), "latent": encoded }),
                );
                *side = link(&id, 0);
            }
            let size = g.add("GetImageSize", json!({ "image": scaled }));
            (link(&size, 0), link(&size, 1))
        }
        None => (json!(width / 16 * 16), json!(height / 16 * 16)),
    };
    // Pictures given as references (a character to draw again): each encoded at about a megapixel and chained
    // to both sides after the source, as ComfyUI's FLUX.2 template chains several references.
    for name in &input.guidance.references {
        let load = g.add("LoadImage", json!({ "image": name }));
        let scaled = link(
            &g.add(
                "ImageScaleToTotalPixels",
                json!({ "image": link(&load, 0), "upscale_method": "lanczos", "megapixels": REFERENCE_MEGAPIXELS, "resolution_steps": 16 }),
            ),
            0,
        );
        let encoded = link(
            &g.add("VAEEncode", json!({ "pixels": scaled, "vae": vae })),
            0,
        );
        for side in [&mut positive, &mut negative] {
            let id = g.add(
                "ReferenceLatent",
                json!({ "conditioning": side.clone(), "latent": encoded }),
            );
            *side = link(&id, 0);
        }
    }
    let guider = if split.variant == Variant::Flux2Dev {
        let guided = link(
            &g.add(
                "FluxGuidance",
                json!({ "conditioning": positive, "guidance": p.cfg_scale.clamp(0.0, 100.0) }),
            ),
            0,
        );
        g.add(
            "BasicGuider",
            json!({ "model": model, "conditioning": guided }),
        )
    } else {
        g.add(
            "CFGGuider",
            json!({ "model": model, "positive": positive, "negative": negative, "cfg": p.cfg_scale }),
        )
    };
    let latent = g.add(
        "EmptyFlux2LatentImage",
        json!({ "width": width, "height": height, "batch_size": 1 }),
    );
    let mut sigmas = link(
        &g.add(
            Family::Flux2.picture_sampling().1,
            json!({ "steps": p.steps, "width": width, "height": height }),
        ),
        0,
    );
    // A draft runs the first steps of the same schedule and keeps the model's prediction of the clean picture at the
    // last of them (the sampler's denoised output): what KSamplerAdvanced gives the shared graph when it stops early
    // without leftover noise, so the finished run from step 0 continues the picture the draft showed.
    if let Some(end) = draft_end {
        let split = g.add("SplitSigmas", json!({ "sigmas": sigmas, "step": end }));
        sigmas = link(&split, 0);
    }
    let sampler = g.add(
        "KSamplerSelect",
        json!({ "sampler_name": Family::Flux2.picture_sampling().0 }),
    );
    let noise = g.add("RandomNoise", json!({ "noise_seed": p.seed }));
    let sampled = g.add(
        "SamplerCustomAdvanced",
        json!({
            "noise": link(&noise, 0), "guider": link(&guider, 0), "sampler": link(&sampler, 0),
            "sigmas": sigmas, "latent_image": link(&latent, 0),
        }),
    );
    let decoded = g.add(
        "VAEDecode",
        json!({ "samples": link(&sampled, u32::from(draft_end.is_some())), "vae": vae }),
    );
    let output = g.add("PreviewImage", json!({ "images": link(&decoded, 0) }));
    Ok(BuiltGraph {
        prompt: Value::Object(g.nodes),
        output_node: output,
        total_steps: draft_end.unwrap_or(p.steps),
        thumbnail_node: None,
        audio_ext: None,
        passes: Vec::new(),
    })
}

pub(super) fn build(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    if split.family == Family::Flux2 {
        return flux2(input, split);
    }
    let p = input.params;
    let what = split.family.label();
    if p.steps == 0 {
        return Err("Steps must be at least 1".into());
    }
    if p.hires_fix.is_some() || p.draft_at.is_some() || !input.guidance.controls.is_empty() {
        return Err(format!(
            "{what} edit models do not take the high-resolution fix, drafts or control layers"
        ));
    }
    let source = input.init_image.ok_or_else(|| {
        format!(
            "{what} edit models need a source picture: use image to image (or inpaint for Fill)"
        )
    })?;
    let mut g = Builder::default();
    let (mut model, clip, vae) = super::split::load(&mut g, input, split);
    let mut clip = clip;
    for (lora, weight) in &input.loras {
        let id = g.add(
            "LoraLoader",
            json!({ "model": model, "clip": clip, "lora_name": lora.name, "strength_model": weight, "strength_clip": weight }),
        );
        model = link(&id, 0);
        clip = link(&id, 1);
    }
    let (width, height) = output_size(p);
    let (sampler, scheduler) = split.family.sampling();
    let load = g.add("LoadImage", json!({ "image": source }));
    let text = |g: &mut Builder, t: &str, clip: &Value| {
        link(
            &g.add("CLIPTextEncode", json!({ "text": t, "clip": clip })),
            0,
        )
    };
    let (model, positive, negative, latent, composite) = match split.variant {
        Variant::FluxFill => {
            let masked = matches!(
                p.generation_mode,
                GenerationMode::Inpaint | GenerationMode::Outpaint
            );
            let mask_name =
                input.guidance.mask_image.filter(|_| masked).ok_or(
                    "Flux Fill redraws a masked area: use inpaint or outpaint with a mask",
                )?;
            let scaled = link(
                &g.add(
                    "ImageScale",
                    json!({ "image": link(&load, 0), "upscale_method": "lanczos", "width": width, "height": height, "crop": "disabled" }),
                ),
                0,
            );
            let mask = soft_mask_nodes(&mut g, mask_name, width, height, p.mask_blur);
            let prompt = text(&mut g, &p.positive_prompt, &clip);
            let guided = link(
                &g.add(
                    "FluxGuidance",
                    json!({ "conditioning": prompt, "guidance": FILL_GUIDANCE }),
                ),
                0,
            );
            let zero = link(
                &g.add("ConditioningZeroOut", json!({ "conditioning": prompt })),
                0,
            );
            let model = link(
                &g.add("DifferentialDiffusion", json!({ "model": model })),
                0,
            );
            let cond = g.add(
                "InpaintModelConditioning",
                json!({
                    "positive": guided, "negative": zero, "vae": vae,
                    "pixels": scaled, "mask": mask, "noise_mask": true,
                }),
            );
            (
                model,
                link(&cond, 0),
                link(&cond, 1),
                link(&cond, 2),
                Some((scaled, mask)),
            )
        }
        Variant::FluxKontext => {
            if p.generation_mode != GenerationMode::Img2img {
                return Err(
                    "Flux Kontext edits the whole picture: use image to image, not inpaint".into(),
                );
            }
            let scaled = g.add("FluxKontextImageScale", json!({ "image": link(&load, 0) }));
            let latent = link(
                &g.add(
                    "VAEEncode",
                    json!({ "pixels": link(&scaled, 0), "vae": vae }),
                ),
                0,
            );
            let prompt = text(&mut g, &p.positive_prompt, &clip);
            let referenced = link(
                &g.add(
                    "ReferenceLatent",
                    json!({ "conditioning": prompt, "latent": latent }),
                ),
                0,
            );
            let guided = link(
                &g.add(
                    "FluxGuidance",
                    json!({ "conditioning": referenced, "guidance": p.cfg_scale.clamp(0.0, 100.0) }),
                ),
                0,
            );
            let zero = link(
                &g.add("ConditioningZeroOut", json!({ "conditioning": prompt })),
                0,
            );
            (model, guided, zero, latent, None)
        }
        Variant::QwenEdit | Variant::QwenEditPlus => {
            if p.generation_mode != GenerationMode::Img2img {
                return Err(
                    "Qwen-Image-Edit edits the whole picture: use image to image, not inpaint"
                        .into(),
                );
            }
            let megapixels = (f64::from(width) * f64::from(height) / 1e6).clamp(0.1, 4.0);
            let scaled = link(
                &g.add(
                    "ImageScaleToTotalPixels",
                    json!({ "image": link(&load, 0), "upscale_method": "lanczos", "megapixels": megapixels, "resolution_steps": 16 }),
                ),
                0,
            );
            let latent = link(
                &g.add("VAEEncode", json!({ "pixels": scaled, "vae": vae })),
                0,
            );
            let encode = |g: &mut Builder, t: &str| {
                let (class, image) = if split.variant == Variant::QwenEditPlus {
                    ("TextEncodeQwenImageEditPlus", "image1")
                } else {
                    ("TextEncodeQwenImageEdit", "image")
                };
                link(
                    &g.add(
                        class,
                        json!({ "clip": clip, "prompt": t, "vae": vae, image: scaled }),
                    ),
                    0,
                )
            };
            let positive = encode(&mut g, &p.positive_prompt);
            let negative = encode(&mut g, &p.negative_prompt);
            let shifted = link(
                &g.add(
                    "ModelSamplingAuraFlow",
                    json!({ "model": model, "shift": 3.0 }),
                ),
                0,
            );
            let normed = link(
                &g.add("CFGNorm", json!({ "model": shifted, "strength": 1.0 })),
                0,
            );
            (normed, positive, negative, latent, None)
        }
        _ => unreachable!("`is_edit` chose these recipes"),
    };
    let cfg = if split.variant == Variant::FluxFill || split.variant == Variant::FluxKontext {
        1.0
    } else {
        p.cfg_scale
    };
    let sampled = g.add(
        "KSampler",
        json!({
            "model": model, "seed": p.seed, "steps": p.steps, "cfg": cfg,
            "sampler_name": sampler, "scheduler": scheduler,
            "positive": positive, "negative": negative, "latent_image": latent, "denoise": 1.0,
        }),
    );
    let mut result = link(
        &g.add(
            "VAEDecode",
            json!({ "samples": link(&sampled, 0), "vae": vae }),
        ),
        0,
    );
    // Outside the mask the source pixels are kept as they were (the VAE round trip changes them a little).
    if let Some((source, mask)) = composite {
        let id = g.add(
            "ImageCompositeMasked",
            json!({ "destination": source, "source": result, "x": 0, "y": 0, "resize_source": false, "mask": mask }),
        );
        result = link(&id, 0);
    }
    let output = g.add("PreviewImage", json!({ "images": result }));
    Ok(BuiltGraph {
        prompt: Value::Object(g.nodes),
        output_node: output,
        total_steps: p.steps,
        thumbnail_node: None,
        audio_ext: None,
        passes: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::comfy::graph::{build, tests::params, GuidanceInput};
    use crate::comfy::split::{Family, Loader};
    use crate::types::ComfyRef;

    fn r(folder: &str, name: &str) -> ComfyRef {
        ComfyRef {
            folder: folder.into(),
            name: name.into(),
        }
    }

    fn run(
        family: Family,
        variant: Variant,
        mode: GenerationMode,
        init: Option<&str>,
        mask: Option<&str>,
    ) -> Result<BuiltGraph, String> {
        let mut split = SplitJob::new(
            family,
            Loader::Unet,
            (0..family.encoders().len())
                .map(|i| r("text_encoders", &format!("te{i}.safetensors")))
                .collect(),
        );
        split.variant = variant;
        let p = params(mode);
        let unet = r("diffusion_models", "m.safetensors");
        let vae = r("vae", "v.safetensors");
        build(&GraphInput {
            params: &p,
            checkpoint: &unet,
            vae: Some(&vae),
            loras: vec![],
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: None,
            split: Some(&split),
            init_image: init,
            guidance: GuidanceInput {
                mask_image: mask,
                ..GuidanceInput::default()
            },
        })
    }

    /// A job of `family` (`variant`) given `references` as pictures to take in, from text or from `init`.
    fn with_references(
        family: Family,
        variant: Variant,
        references: Vec<&str>,
        init: Option<&str>,
    ) -> Result<BuiltGraph, String> {
        let mut split = SplitJob::new(
            family,
            Loader::Unet,
            (0..family.encoders().len())
                .map(|i| r("text_encoders", &format!("te{i}.safetensors")))
                .collect(),
        );
        split.variant = variant;
        let mode = if init.is_some() {
            GenerationMode::Img2img
        } else {
            GenerationMode::Txt2img
        };
        let p = params(mode);
        let unet = r("diffusion_models", "m.safetensors");
        let vae = r("vae", "v.safetensors");
        build(&GraphInput {
            params: &p,
            checkpoint: &unet,
            vae: Some(&vae),
            loras: vec![],
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: None,
            split: Some(&split),
            init_image: init,
            guidance: GuidanceInput {
                references,
                ..GuidanceInput::default()
            },
        })
    }

    fn classes(g: &BuiltGraph) -> Vec<String> {
        g.prompt
            .as_object()
            .unwrap()
            .values()
            .map(|n| n["class_type"].as_str().unwrap().to_string())
            .collect()
    }

    #[test]
    fn each_edit_model_uses_its_own_conditioning_nodes() {
        let fill = run(
            Family::Flux,
            Variant::FluxFill,
            GenerationMode::Inpaint,
            Some("a.png"),
            Some("m.png"),
        )
        .unwrap();
        let c = classes(&fill);
        for node in [
            "InpaintModelConditioning",
            "DifferentialDiffusion",
            "ImageCompositeMasked",
        ] {
            assert!(c.contains(&node.to_string()), "{node}");
        }
        assert!(!c.contains(&"SetLatentNoiseMask".to_string()));
        let guidance = fill
            .prompt
            .as_object()
            .unwrap()
            .values()
            .find(|n| n["class_type"] == "FluxGuidance")
            .unwrap();
        assert_eq!(guidance["inputs"]["guidance"], FILL_GUIDANCE);
        let kontext = run(
            Family::Flux,
            Variant::FluxKontext,
            GenerationMode::Img2img,
            Some("a.png"),
            None,
        )
        .unwrap();
        let c = classes(&kontext);
        assert!(
            c.contains(&"ReferenceLatent".to_string())
                && c.contains(&"FluxKontextImageScale".to_string())
        );
        let edit = run(
            Family::QwenImage,
            Variant::QwenEdit,
            GenerationMode::Img2img,
            Some("a.png"),
            None,
        )
        .unwrap();
        assert!(classes(&edit).contains(&"TextEncodeQwenImageEdit".to_string()));
        let plus = run(
            Family::QwenImage,
            Variant::QwenEditPlus,
            GenerationMode::Img2img,
            Some("a.png"),
            None,
        )
        .unwrap();
        let c = classes(&plus);
        assert!(
            c.contains(&"TextEncodeQwenImageEditPlus".to_string())
                && c.contains(&"CFGNorm".to_string())
        );
    }

    #[test]
    fn what_an_edit_model_cannot_do_is_refused_with_the_way_to_use_it() {
        let err =
            |family, variant, mode, init, mask| run(family, variant, mode, init, mask).unwrap_err();
        // Fill needs a mask; the others need a picture and the whole-picture mode.
        assert!(err(
            Family::Flux,
            Variant::FluxFill,
            GenerationMode::Txt2img,
            None,
            None
        )
        .contains("source picture"));
        assert!(err(
            Family::Flux,
            Variant::FluxFill,
            GenerationMode::Img2img,
            Some("a.png"),
            None
        )
        .contains("masked area"));
        assert!(err(
            Family::Flux,
            Variant::FluxKontext,
            GenerationMode::Txt2img,
            None,
            None
        )
        .contains("image to image"));
        assert!(err(
            Family::Flux,
            Variant::FluxKontext,
            GenerationMode::Inpaint,
            Some("a.png"),
            Some("m.png")
        )
        .contains("whole picture"));
        assert!(err(
            Family::QwenImage,
            Variant::QwenEdit,
            GenerationMode::Inpaint,
            Some("a.png"),
            Some("m.png")
        )
        .contains("whole picture"));
        // A model made for an input the graph lacks is named, not drawn wrongly.
        let unsupported =
            Variant::Unsupported("this is a Wan Fun Control model, which needs a control video");
        let e = err(Family::Wan, unsupported, GenerationMode::Video, None, None);
        assert!(e.starts_with("Wan: this is a Wan Fun Control"), "{e}");
    }

    #[test]
    fn flux2_samples_with_a_guider_and_refuses_what_its_graph_lacks() {
        let dev = run(
            Family::Flux2,
            Variant::Flux2Dev,
            GenerationMode::Txt2img,
            None,
            None,
        )
        .unwrap();
        let c = classes(&dev);
        for node in [
            "FluxGuidance",
            "BasicGuider",
            "Flux2Scheduler",
            "EmptyFlux2LatentImage",
            "SamplerCustomAdvanced",
        ] {
            assert!(c.contains(&node.to_string()), "{node}");
        }
        assert!(!c.contains(&"CFGGuider".to_string()));
        let klein = run(
            Family::Flux2,
            Variant::Flux2Klein4b,
            GenerationMode::Txt2img,
            None,
            None,
        )
        .unwrap();
        let c = classes(&klein);
        assert!(c.contains(&"CFGGuider".to_string()) && !c.contains(&"FluxGuidance".to_string()));
        // A reference picture goes to both sides of the conditioning.
        let edit = run(
            Family::Flux2,
            Variant::Flux2Klein4b,
            GenerationMode::Img2img,
            Some("a.png"),
            None,
        )
        .unwrap();
        assert_eq!(
            classes(&edit)
                .iter()
                .filter(|c| *c == "ReferenceLatent")
                .count(),
            2
        );
        let e =
            |mode, init, mask| run(Family::Flux2, Variant::Flux2Dev, mode, init, mask).unwrap_err();
        assert!(e(GenerationMode::Inpaint, Some("a.png"), Some("m.png")).contains("masks"));
        assert!(e(GenerationMode::Upscale, Some("a.png"), None).contains("draws from text"));
    }

    /// A text-to-image job of `variant` drawn as a draft to `at` of `steps`.
    fn draft(family: Family, variant: Variant, steps: u32, at: f64) -> Result<BuiltGraph, String> {
        let mut split = SplitJob::new(
            family,
            Loader::Unet,
            (0..family.encoders().len())
                .map(|i| r("text_encoders", &format!("te{i}.safetensors")))
                .collect(),
        );
        split.variant = variant;
        let mut p = params(GenerationMode::Txt2img);
        p.steps = steps;
        p.draft_at = Some(at);
        let unet = r("diffusion_models", "m.safetensors");
        let vae = r("vae", "v.safetensors");
        build(&GraphInput {
            params: &p,
            checkpoint: &unet,
            vae: Some(&vae),
            loras: vec![],
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: None,
            split: Some(&split),
            init_image: None,
            guidance: GuidanceInput::default(),
        })
    }

    fn inputs<'a>(g: &'a BuiltGraph, class: &str) -> &'a Value {
        g.prompt
            .as_object()
            .unwrap()
            .values()
            .find(|n| n["class_type"] == class)
            .map(|n| &n["inputs"])
            .unwrap_or_else(|| panic!("no {class}"))
    }

    #[test]
    fn a_flux2_draft_runs_the_first_steps_and_keeps_the_denoised_picture() {
        for variant in [Variant::Flux2Dev, Variant::Flux2Klein4b] {
            let g = draft(Family::Flux2, variant, 28, 0.35).unwrap();
            let split = inputs(&g, "SplitSigmas");
            assert_eq!(split["step"], 10, "{variant:?}");
            let scheduler = &g.prompt[split["sigmas"][0].as_str().unwrap()];
            assert_eq!(scheduler["class_type"], "Flux2Scheduler");
            // The full schedule is cut, not a shorter one made: the draft is the start of the finished run.
            assert_eq!(scheduler["inputs"]["steps"], 28);
            let sampler = inputs(&g, "SamplerCustomAdvanced");
            assert_eq!(sampler["sigmas"], json!([split_id(&g), 0]));
            let decode = inputs(&g, "VAEDecode");
            assert_eq!(decode["samples"][1], 1, "the denoised output, {variant:?}");
            assert_eq!(g.total_steps, 10);
        }
        // Without a draft the sampler takes the whole schedule and its plain output.
        let full = run(
            Family::Flux2,
            Variant::Flux2Dev,
            GenerationMode::Txt2img,
            None,
            None,
        )
        .unwrap();
        assert!(!classes(&full).contains(&"SplitSigmas".to_string()));
        assert_eq!(inputs(&full, "VAEDecode")["samples"][1], 0);
        assert_eq!(full.total_steps, params(GenerationMode::Txt2img).steps);
        // The same limits as the shared graph.
        assert!(draft(Family::Flux2, Variant::Flux2Dev, 3, 0.5)
            .unwrap_err()
            .contains("at least 4 steps"));
        assert!(draft(Family::Flux2, Variant::Flux2Dev, 20, 1.0)
            .unwrap_err()
            .contains("between 0 and 1"));
    }

    fn split_id(g: &BuiltGraph) -> String {
        g.prompt
            .as_object()
            .unwrap()
            .iter()
            .find(|(_, n)| n["class_type"] == "SplitSigmas")
            .map(|(id, _)| id.clone())
            .unwrap()
    }

    #[test]
    fn the_edit_models_refuse_drafts() {
        for (family, variant) in [
            (Family::Flux, Variant::FluxFill),
            (Family::Flux, Variant::FluxKontext),
            (Family::QwenImage, Variant::QwenEdit),
            (Family::QwenImage, Variant::QwenEditPlus),
        ] {
            assert!(draft(family, variant, 20, 0.35).is_err(), "{variant:?}");
        }
    }

    #[test]
    fn flux2_chains_each_reference_picture_to_both_sides_and_draws_at_the_size_asked() {
        let count = |g: &BuiltGraph, class: &str| classes(g).iter().filter(|c| *c == class).count();
        let drawn = with_references(
            Family::Flux2,
            Variant::Flux2Dev,
            vec!["mina.png", "jin.png"],
            None,
        )
        .unwrap();
        assert_eq!(count(&drawn, "ReferenceLatent"), 4);
        assert_eq!(count(&drawn, "LoadImage"), 2);
        let nodes = drawn.prompt.as_object().unwrap();
        let latent = nodes
            .values()
            .find(|n| n["class_type"] == "EmptyFlux2LatentImage")
            .unwrap();
        assert_eq!(
            (
                latent["inputs"]["width"].clone(),
                latent["inputs"]["height"].clone()
            ),
            (json!(1024), json!(768))
        );
        let names: Vec<&str> = nodes
            .values()
            .filter(|n| n["class_type"] == "LoadImage")
            .map(|n| n["inputs"]["image"].as_str().unwrap())
            .collect();
        assert_eq!(names, ["mina.png", "jin.png"]);
        // With a source picture, the references follow it, and the picture keeps the source's size.
        let edited = with_references(
            Family::Flux2,
            Variant::Flux2Klein4b,
            vec!["mina.png"],
            Some("src.png"),
        )
        .unwrap();
        assert_eq!(count(&edited, "ReferenceLatent"), 4);
        assert_eq!(count(&edited, "GetImageSize"), 1);
    }

    #[test]
    fn the_other_families_refuse_pictures_given_as_references() {
        for (family, variant) in [
            (Family::QwenImage, Variant::QwenEditPlus),
            (Family::Flux, Variant::FluxKontext),
            (Family::Anima, Variant::Plain),
        ] {
            let e =
                with_references(family, variant, vec!["mina.png"], Some("src.png")).unwrap_err();
            assert!(e.contains("FLUX.2 models only"), "{e}");
        }
    }
}
