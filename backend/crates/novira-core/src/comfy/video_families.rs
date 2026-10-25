//! Video graphs of models the user installed: Wan 2.1 and 2.2 (text to video, image to video, the two-model A14B pair and
//! the 5B model), HunyuanVideo and LTX-Video. Each recipe is the one of ComfyUI's own template for the model, with only
//! core nodes. The graph ends as the pack's video does (`video::finish`): decode, MP4, thumbnail.
use super::graph::{Builder, BuiltGraph, GraphInput};
use super::split::{text_encoder, unet_loader, Family, SplitJob, WanKind};
use super::video::{finish, finish_with_audio, frames_for, link, size32};
use crate::models::classify::Variant;
use crate::types::GenerationMetadata;
use serde_json::{json, Value};

/// The steps the high-noise model of a Wan 2.2 A14B pair runs before the low-noise one takes over (the model's boundary
/// is about half of the schedule).
fn handover(steps: u32) -> u32 {
    (steps / 2).max(1)
}

/// Frames LTX-Video accepts: 8n + 1.
fn ltx_frames(p: &GenerationMetadata) -> u32 {
    let wanted = frames_for(p);
    ((wanted - 1) / 8 * 8 + 1).max(9)
}

/// Sizes of the Wan and Hunyuan models: multiples of 16.
fn size16(v: u32) -> u32 {
    (v.max(64).saturating_add(8) / 16 * 16).max(64)
}

fn text(g: &mut Builder, t: &str, clip: &Value) -> Value {
    link(
        &g.add("CLIPTextEncode", json!({ "text": t, "clip": clip })),
        0,
    )
}

pub fn build(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    let p = input.params;
    if p.steps == 0 {
        return Err("Steps must be at least 1".into());
    }
    let need = split.family.encoders().len();
    let bundled_clip = matches!(
        split.loader,
        super::split::Loader::Checkpoint { clip: true, .. }
    );
    if !bundled_clip && split.text_encoders.len() != need {
        return Err(format!(
            "{} needs {need} text encoder file(s)",
            split.family.label()
        ));
    }
    match split.family {
        Family::Wan => wan(input, split),
        Family::HunyuanVideo => hunyuan(input, split),
        Family::Ltx => ltx(input, split),
        Family::HunyuanVideo15 => hunyuan15(input, split),
        Family::Ltx2 => ltx2(input, split),
        other => Err(format!("{} is not a video model", other.label())),
    }
}

fn weight_dtype(p: &GenerationMetadata) -> &'static str {
    if p.video_fp8 == Some(true) {
        "fp8_e4m3fn"
    } else {
        "default"
    }
}

fn model_and_vae(
    g: &mut Builder,
    input: &GraphInput<'_>,
    split: &SplitJob,
) -> Result<(Value, Value), String> {
    use super::split::Loader;
    let (model, ckpt_vae) = match split.loader {
        Loader::Unet => (
            unet_loader(g, &input.checkpoint.name, weight_dtype(input.params)),
            None,
        ),
        Loader::Checkpoint { .. } => {
            let id = g.add(
                "CheckpointLoaderSimple",
                json!({ "ckpt_name": input.checkpoint.name }),
            );
            (link(&id, 0), Some(link(&id, 2)))
        }
    };
    let vae = match (input.vae, ckpt_vae) {
        (Some(v), _) => link(&g.add("VAELoader", json!({ "vae_name": v.name })), 0),
        (None, Some(v)) => v,
        (None, None) => {
            return Err(format!(
                "{} needs {}",
                split.family.label(),
                split.family.vae_for(split.wan).what
            ))
        }
    };
    Ok((model, vae))
}

fn wan(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    let p = input.params;
    let kind = split.wan.ok_or("This Wan model's kind could not be read")?;
    // The 5B model is the pack's graph with the user's files.
    if kind == WanKind::Ti2v {
        let vae = input
            .vae
            .ok_or_else(|| format!("Wan needs {}", split.family.vae_for(split.wan).what))?;
        return super::video::build_ti2v(input, &split.text_encoders[0], vae);
    }
    if kind == WanKind::I2v && input.init_image.is_none() {
        return Err("This is an image-to-video model: it needs a source picture".into());
    }
    // VACE takes a picture as a reference for the clip; the plain text-to-video model cannot use one.
    let vace = split.variant == Variant::WanVace;
    if kind == WanKind::T2v && !vace && input.init_image.is_some() {
        return Err("This is a text-to-video model: it cannot animate a picture".into());
    }
    let mut g = Builder::default();
    let (model, vae) = model_and_vae(&mut g, input, split)?;
    let shift_node = |g: &mut Builder, model: Value| {
        link(
            &g.add("ModelSamplingSD3", json!({ "model": model, "shift": 8.0 })),
            0,
        )
    };
    let high = shift_node(&mut g, model);
    // A Wan 2.2 A14B pair: the high-noise model starts the picture and the low-noise one finishes it.
    let low = match &split.low_noise {
        Some(l) => {
            let low = unet_loader(&mut g, &l.name, weight_dtype(p));
            Some(shift_node(&mut g, low))
        }
        None => None,
    };
    let clip = text_encoder(&mut g, split.family, &split.text_encoders);
    let positive = text(&mut g, &p.positive_prompt, &clip);
    let negative = text(&mut g, &p.negative_prompt, &clip);
    let (width, height, length) = (size16(p.width), size16(p.height), frames_for(p));
    // VACE trims the frames its reference picture took from the latent after sampling.
    let mut trim = None;
    let (positive, negative, latent) = match kind {
        _ if vace => {
            let mut inputs = json!({
                "positive": positive, "negative": negative, "vae": vae,
                "width": width, "height": height, "length": length, "batch_size": 1, "strength": 1.0,
            });
            if let Some(name) = input.init_image {
                let load = g.add("LoadImage", json!({ "image": name }));
                inputs["reference_image"] = link(&load, 0);
            }
            let id = g.add("WanVaceToVideo", inputs);
            trim = Some(link(&id, 3));
            (link(&id, 0), link(&id, 1), link(&id, 2))
        }
        WanKind::I2v => {
            let load = g.add(
                "LoadImage",
                json!({ "image": input.init_image.unwrap_or_default() }),
            );
            let mut inputs = json!({
                "positive": positive, "negative": negative, "vae": vae,
                "width": width, "height": height, "length": length, "batch_size": 1,
                "start_image": link(&load, 0),
            });
            // Wan 2.1 image to video also takes the CLIP-vision encoding of the start picture.
            if let Some(cv) = &split.clip_vision {
                let loader = g.add("CLIPVisionLoader", json!({ "clip_name": cv.name }));
                let encoded = g.add(
                    "CLIPVisionEncode",
                    json!({ "clip_vision": link(&loader, 0), "image": link(&load, 0), "crop": "none" }),
                );
                inputs["clip_vision_output"] = link(&encoded, 0);
            }
            let id = g.add("WanImageToVideo", inputs);
            (link(&id, 0), link(&id, 1), link(&id, 2))
        }
        _ => {
            let id = g.add(
                "EmptyHunyuanLatentVideo",
                json!({ "width": width, "height": height, "length": length, "batch_size": 1 }),
            );
            (positive, negative, link(&id, 0))
        }
    };
    let (sampler, scheduler) = split.family.sampling();
    let sampled_node;
    let mut passes = Vec::new();
    match low {
        None => {
            sampled_node = g.add(
                "KSampler",
                json!({
                    "model": high, "seed": p.seed, "steps": p.steps, "cfg": p.cfg_scale,
                    "sampler_name": sampler, "scheduler": scheduler,
                    "positive": positive, "negative": negative, "latent_image": latent, "denoise": 1.0,
                }),
            );
        }
        Some(low) => {
            let cut = handover(p.steps);
            let first = g.add(
                "KSamplerAdvanced",
                json!({
                    "model": high, "add_noise": "enable", "noise_seed": p.seed, "steps": p.steps,
                    "cfg": p.cfg_scale, "sampler_name": sampler, "scheduler": scheduler,
                    "positive": positive, "negative": negative, "latent_image": latent,
                    "start_at_step": 0, "end_at_step": cut, "return_with_leftover_noise": "enable",
                }),
            );
            sampled_node = g.add(
                "KSamplerAdvanced",
                json!({
                    "model": low, "add_noise": "disable", "noise_seed": 0, "steps": p.steps,
                    "cfg": p.cfg_scale, "sampler_name": sampler, "scheduler": scheduler,
                    "positive": positive, "negative": negative, "latent_image": link(&first, 0),
                    "start_at_step": cut, "end_at_step": 10000, "return_with_leftover_noise": "disable",
                }),
            );
            passes = vec![(first, 0), (sampled_node.clone(), cut)];
        }
    }
    let mut samples = link(&sampled_node, 0);
    if let Some(amount) = trim {
        let id = g.add(
            "TrimVideoLatent",
            json!({ "samples": samples, "trim_amount": amount }),
        );
        samples = link(&id, 0);
    }
    Ok(finish(g, p, samples, vae, passes))
}

/// HunyuanVideo 1.5: text to video, or image to video (the model of that name), sampled with a CFG guider.
fn hunyuan15(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    let p = input.params;
    let i2v = split.variant == Variant::Hy15I2v;
    if i2v && input.init_image.is_none() {
        return Err("This is an image-to-video model: it needs a source picture".into());
    }
    if !i2v && input.init_image.is_some() {
        return Err("This is a text-to-video model: it cannot animate a picture".into());
    }
    let mut g = Builder::default();
    let (model, vae) = model_and_vae(&mut g, input, split)?;
    let model = link(
        &g.add("ModelSamplingSD3", json!({ "model": model, "shift": 7.0 })),
        0,
    );
    let clip = text_encoder(&mut g, split.family, &split.text_encoders);
    let positive = text(&mut g, &p.positive_prompt, &clip);
    let negative = text(&mut g, &p.negative_prompt, &clip);
    let (width, height, length) = (size16(p.width), size16(p.height), frames_for(p));
    let (positive, negative, latent) = if i2v {
        let load = g.add(
            "LoadImage",
            json!({ "image": input.init_image.unwrap_or_default() }),
        );
        let mut inputs = json!({
            "positive": positive, "negative": negative, "vae": vae,
            "width": width, "height": height, "length": length, "batch_size": 1,
            "start_image": link(&load, 0),
        });
        if let Some(cv) = &split.clip_vision {
            let loader = g.add("CLIPVisionLoader", json!({ "clip_name": cv.name }));
            let encoded = g.add(
                "CLIPVisionEncode",
                json!({ "clip_vision": link(&loader, 0), "image": link(&load, 0), "crop": "center" }),
            );
            inputs["clip_vision_output"] = link(&encoded, 0);
        }
        let id = g.add("HunyuanVideo15ImageToVideo", inputs);
        (link(&id, 0), link(&id, 1), link(&id, 2))
    } else {
        let id = g.add(
            "EmptyHunyuanVideo15Latent",
            json!({ "width": width, "height": height, "length": length, "batch_size": 1 }),
        );
        (positive, negative, link(&id, 0))
    };
    let guider = g.add(
        "CFGGuider",
        json!({ "model": model, "positive": positive, "negative": negative, "cfg": p.cfg_scale }),
    );
    let noise = g.add("RandomNoise", json!({ "noise_seed": p.seed }));
    let sampler = g.add("KSamplerSelect", json!({ "sampler_name": "euler" }));
    let sigmas = g.add(
        "BasicScheduler",
        json!({ "model": model, "scheduler": "simple", "steps": p.steps, "denoise": 1.0 }),
    );
    let sampled = g.add(
        "SamplerCustomAdvanced",
        json!({
            "noise": link(&noise, 0), "guider": link(&guider, 0), "sampler": link(&sampler, 0),
            "sigmas": link(&sigmas, 0), "latent_image": latent,
        }),
    );
    Ok(finish(g, p, link(&sampled, 0), vae, Vec::new()))
}

/// LTX-2: one checkpoint with the video model, the video VAE and the audio VAE; the Gemma encoder loads beside it. The
/// first stage of ComfyUI's template (video and sound latents sampled together); the template's second stage, which
/// enlarges the result with an upscaler model, is not run, so the clip has the size asked for.
fn ltx2(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    let p = input.params;
    let mut g = Builder::default();
    let (model, vae) = model_and_vae(&mut g, input, split)?;
    let ckpt = &input.checkpoint.name;
    let clip = link(
        &g.add(
            "LTXAVTextEncoderLoader",
            json!({ "text_encoder": split.text_encoders[0].name, "ckpt_name": ckpt, "device": "default" }),
        ),
        0,
    );
    let audio_vae = link(
        &g.add("LTXVAudioVAELoader", json!({ "ckpt_name": ckpt })),
        0,
    );
    let positive = text(&mut g, &p.positive_prompt, &clip);
    let negative = text(&mut g, &p.negative_prompt, &clip);
    let fps = p
        .video_fps
        .unwrap_or(super::video::DEFAULT_FPS)
        .clamp(1, 60) as f64;
    let cond = g.add(
        "LTXVConditioning",
        json!({ "positive": positive, "negative": negative, "frame_rate": fps }),
    );
    let (width, height, length) = (size32(p.width), size32(p.height), ltx_frames(p));
    let mut video = link(
        &g.add(
            "EmptyLTXVLatentVideo",
            json!({ "width": width, "height": height, "length": length, "batch_size": 1 }),
        ),
        0,
    );
    if let Some(name) = input.init_image {
        let load = g.add("LoadImage", json!({ "image": name }));
        let fitted = g.add(
            "ImageScale",
            json!({ "image": link(&load, 0), "upscale_method": "lanczos", "width": width, "height": height, "crop": "center" }),
        );
        video = link(
            &g.add(
                "LTXVImgToVideoInplace",
                json!({ "vae": vae, "image": link(&fitted, 0), "latent": video, "strength": 1.0, "bypass": false }),
            ),
            0,
        );
    }
    let audio = link(
        &g.add(
            "LTXVEmptyLatentAudio",
            json!({ "frames_number": length, "frame_rate": fps, "batch_size": 1, "audio_vae": audio_vae }),
        ),
        0,
    );
    let both = link(
        &g.add(
            "LTXVConcatAVLatent",
            json!({ "video_latent": video, "audio_latent": audio }),
        ),
        0,
    );
    let sigmas = g.add(
        "LTXVScheduler",
        json!({
            "steps": p.steps, "max_shift": 2.05, "base_shift": 0.95, "stretch": true, "terminal": 0.1,
            "latent": both,
        }),
    );
    let guider = g.add(
        "CFGGuider",
        json!({ "model": model, "positive": link(&cond, 0), "negative": link(&cond, 1), "cfg": p.cfg_scale }),
    );
    let sampler = g.add(
        "KSamplerSelect",
        json!({ "sampler_name": "euler_ancestral" }),
    );
    let noise = g.add("RandomNoise", json!({ "noise_seed": p.seed }));
    let sampled = g.add(
        "SamplerCustomAdvanced",
        json!({
            "noise": link(&noise, 0), "guider": link(&guider, 0), "sampler": link(&sampler, 0),
            "sigmas": link(&sigmas, 0), "latent_image": both,
        }),
    );
    let parts = g.add(
        "LTXVSeparateAVLatent",
        json!({ "av_latent": link(&sampled, 0) }),
    );
    let sound = g.add(
        "LTXVAudioVAEDecode",
        json!({ "samples": link(&parts, 1), "audio_vae": audio_vae }),
    );
    Ok(finish_with_audio(
        g,
        p,
        link(&parts, 0),
        vae,
        Some(link(&sound, 0)),
        Vec::new(),
    ))
}

fn hunyuan(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    let p = input.params;
    let i2v = split.variant == Variant::HyI2v;
    if i2v && input.init_image.is_none() {
        return Err("This is an image-to-video model: it needs a source picture".into());
    }
    if !i2v && input.init_image.is_some() {
        return Err("This is a text-to-video model: it cannot animate a picture".into());
    }
    let mut g = Builder::default();
    let (model, vae) = model_and_vae(&mut g, input, split)?;
    let model = link(
        &g.add("ModelSamplingSD3", json!({ "model": model, "shift": 7.0 })),
        0,
    );
    let clip = text_encoder(&mut g, split.family, &split.text_encoders);
    let (width, height, length) = (size16(p.width), size16(p.height), frames_for(p));
    // Image to video: the model's LLaVA reads the picture with the prompt. The "v2_replace" file takes the picture's
    // latent in place of the first frames of the noise, the other file as extra channels (ComfyUI's `guidance_type`).
    let replace = {
        let n = input.checkpoint.name.to_ascii_lowercase();
        n.contains("v2_replace") || n.contains("v2-replace")
    };
    let (positive, latent) = if i2v {
        let load = g.add(
            "LoadImage",
            json!({ "image": input.init_image.unwrap_or_default() }),
        );
        let cv = split
            .clip_vision
            .as_ref()
            .ok_or("HunyuanVideo image to video needs its vision model")?;
        let loader = g.add("CLIPVisionLoader", json!({ "clip_name": cv.name }));
        let seen = g.add(
            "CLIPVisionEncode",
            json!({ "clip_vision": link(&loader, 0), "image": link(&load, 0), "crop": "center" }),
        );
        let encoded = g.add(
            "TextEncodeHunyuanVideo_ImageToVideo",
            json!({ "clip": clip, "clip_vision_output": link(&seen, 0), "prompt": p.positive_prompt, "image_interleave": 2 }),
        );
        let id = g.add(
            "HunyuanImageToVideo",
            json!({
                "positive": link(&encoded, 0), "vae": vae, "width": width, "height": height,
                "length": length, "batch_size": 1,
                "guidance_type": if replace { "v2 (replace)" } else { "v1 (concat)" },
                "start_image": link(&load, 0),
            }),
        );
        (link(&id, 0), link(&id, 1))
    } else {
        let latent = g.add(
            "EmptyHunyuanLatentVideo",
            json!({ "width": width, "height": height, "length": length, "batch_size": 1 }),
        );
        (text(&mut g, &p.positive_prompt, &clip), link(&latent, 0))
    };
    // The model is guidance-distilled: the strength is a value on the prompt and there is no negative prompt.
    let guided = g.add(
        "FluxGuidance",
        json!({ "conditioning": positive, "guidance": p.cfg_scale.clamp(0.0, 100.0) }),
    );
    let guider = g.add(
        "BasicGuider",
        json!({ "model": model, "conditioning": link(&guided, 0) }),
    );
    let noise = g.add("RandomNoise", json!({ "noise_seed": p.seed }));
    let (sampler, scheduler) = split.family.sampling();
    let select = g.add("KSamplerSelect", json!({ "sampler_name": sampler }));
    let sigmas = g.add(
        "BasicScheduler",
        json!({ "model": model, "scheduler": scheduler, "steps": p.steps, "denoise": 1.0 }),
    );
    let sampled = g.add(
        "SamplerCustomAdvanced",
        json!({
            "noise": link(&noise, 0), "guider": link(&guider, 0), "sampler": link(&select, 0),
            "sigmas": link(&sigmas, 0), "latent_image": latent,
        }),
    );
    Ok(finish(g, p, link(&sampled, 0), vae, Vec::new()))
}

fn ltx(input: &GraphInput<'_>, split: &SplitJob) -> Result<BuiltGraph, String> {
    let p = input.params;
    let mut g = Builder::default();
    let (model, vae) = model_and_vae(&mut g, input, split)?;
    let clip = text_encoder(&mut g, split.family, &split.text_encoders);
    let positive = text(&mut g, &p.positive_prompt, &clip);
    let negative = text(&mut g, &p.negative_prompt, &clip);
    let (width, height, length) = (size32(p.width), size32(p.height), ltx_frames(p));
    let fps = p
        .video_fps
        .unwrap_or(super::video::DEFAULT_FPS)
        .clamp(1, 60);
    let (positive, negative, latent) = match input.init_image {
        Some(name) => {
            let load = g.add("LoadImage", json!({ "image": name }));
            let id = g.add(
                "LTXVImgToVideo",
                json!({
                    "positive": positive, "negative": negative, "vae": vae,
                    "image": link(&load, 0), "width": width, "height": height, "length": length,
                    "batch_size": 1, "strength": 1.0,
                }),
            );
            (link(&id, 0), link(&id, 1), link(&id, 2))
        }
        None => {
            let id = g.add(
                "EmptyLTXVLatentVideo",
                json!({ "width": width, "height": height, "length": length, "batch_size": 1 }),
            );
            (positive, negative, link(&id, 0))
        }
    };
    let conditioning = g.add(
        "LTXVConditioning",
        json!({ "positive": positive, "negative": negative, "frame_rate": fps as f64 }),
    );
    let sigmas = g.add(
        "LTXVScheduler",
        json!({
            "steps": p.steps, "max_shift": 2.05, "base_shift": 0.95, "stretch": true, "terminal": 0.1,
            "latent": latent,
        }),
    );
    let (sampler, _) = split.family.sampling();
    let select = g.add("KSamplerSelect", json!({ "sampler_name": sampler }));
    let sampled = g.add(
        "SamplerCustom",
        json!({
            "model": model, "add_noise": true, "noise_seed": p.seed, "cfg": p.cfg_scale,
            "positive": link(&conditioning, 0), "negative": link(&conditioning, 1),
            "sampler": link(&select, 0), "sigmas": link(&sigmas, 0), "latent_image": latent,
        }),
    );
    Ok(finish(g, p, link(&sampled, 0), vae, Vec::new()))
}

#[cfg(test)]
mod tests;
