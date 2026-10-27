//! Turns `GenerationMetadata` into a ComfyUI API prompt (the "execution" JSON, not the editor workflow).
//! Core ComfyUI nodes only, except reference images, which need the ComfyUI_IPAdapter_plus custom node pack
//! (`IPAdapterModelLoader`, `IPAdapterAdvanced`). Anything this adapter cannot express is refused with a reason
//! instead of being silently dropped or replaced by something "close".
use crate::types::{
    ComfyRef, ControlMode, ControlType, GenerationMetadata, GenerationMode, RefImageMethod,
};
use serde_json::{json, Map, Value};

/// The node class reference images need; it comes from the ComfyUI_IPAdapter_plus pack.
pub const IPADAPTER_NODE: &str = "IPAdapterAdvanced";
/// Default softness of the edge between the redrawn and the kept part (pixels), as InvokeAI's mask blur.
pub const DEFAULT_MASK_BLUR: u32 = 16;
/// `ImageBlur` accepts a radius up to 31.
const MAX_BLUR_RADIUS: u32 = 31;

/// InvokeAI scheduler names -> ComfyUI (sampler_name, scheduler).
pub fn sampler_for(scheduler: &str) -> Option<(&'static str, &'static str)> {
    Some(match scheduler {
        "euler" => ("euler", "normal"),
        "euler_a" => ("euler_ancestral", "normal"),
        "euler_k" => ("euler", "karras"),
        "dpmpp_2m" => ("dpmpp_2m", "normal"),
        "dpmpp_2m_k" => ("dpmpp_2m", "karras"),
        "dpmpp_2m_sde_k" => ("dpmpp_2m_sde", "karras"),
        "dpmpp_sde_k" => ("dpmpp_sde", "karras"),
        "heun" => ("heun", "normal"),
        "lms" => ("lms", "normal"),
        "ddim" => ("ddim", "ddim_uniform"),
        "unipc" => ("uni_pc", "normal"),
        "lcm" => ("lcm", "sgm_uniform"),
        _ => return None,
    })
}

/// The node class the manga finish runs on; it comes from the ComfyUI-MangaScreen pack.
pub const MANGA_NODE: &str = "MangaFinish";

/// The `weight_type` of `IPAdapterAdvanced` for an InvokeAI reference image method (the pack's own names).
pub fn ipadapter_weight_type(method: RefImageMethod) -> &'static str {
    match method {
        RefImageMethod::Full => "linear",
        RefImageMethod::Style => "style transfer",
        RefImageMethod::Composition => "composition",
        RefImageMethod::StyleStrong => "strong style transfer",
        RefImageMethod::StylePrecise => "style transfer precise",
    }
}

/// A control layer whose picture is already in ComfyUI's input folder.
#[derive(Debug, Clone, PartialEq)]
pub struct ControlInput<'a> {
    pub model: &'a ComfyRef,
    pub image: &'a str,
    pub weight: f64,
    pub begin_end: [f64; 2],
    pub mode: ControlMode,
    /// What a union ControlNet is told the picture is (`SetUnionControlNetType`); None leaves it to guess.
    pub union_type: Option<&'a str>,
}

/// Whether a ControlNet reads several kinds of picture and has to be told which one it gets: xinsir's union models
/// for SDXL, which say so in their name, file or the repository they came from (the file itself is often just
/// `diffusion_pytorch_model.safetensors`). Left to guess, such a model read stick figures as lines and drew them as
/// wires and poles.
pub fn is_union_controlnet(name: &str, path: &str, source: &str) -> bool {
    [name, path, source].iter().any(|s| {
        let s = s.to_ascii_lowercase();
        s.contains("union") || s.contains("promax")
    })
}

/// ComfyUI's name of a kind of control picture for a union ControlNet (`UNION_CONTROLNET_TYPES`).
pub fn union_type(kind: ControlType) -> &'static str {
    match kind {
        ControlType::Openpose => "openpose",
        ControlType::Depth => "depth",
        ControlType::Softedge => "hed/pidi/scribble/ted",
        ControlType::Lineart => "canny/lineart/anime_lineart/mlsd",
        ControlType::Normal => "normal",
    }
}

/// A reference image whose picture is already in ComfyUI's input folder.
#[derive(Debug, Clone, PartialEq)]
pub struct RefInput<'a> {
    pub model: &'a ComfyRef,
    pub clip_vision: &'a ComfyRef,
    pub image: &'a str,
    pub weight: f64,
    pub begin_end: [f64; 2],
    pub method: RefImageMethod,
    /// Where it applies, white inside (`attn_mask` of the IP-Adapter); None for the whole picture.
    pub region: Option<&'a str>,
}

/// A regional guidance layer whose region is already in ComfyUI's input folder.
#[derive(Debug, Clone, PartialEq)]
pub struct RegionInput<'a> {
    /// The region, white inside, the size of the generation area.
    pub mask_image: &'a str,
    /// Said inside the region, besides the prompt of the whole picture.
    pub positive: Option<&'a str>,
    /// Kept out of the region.
    pub negative: Option<&'a str>,
    /// Also keep the positive prompt out of the rest of the picture.
    pub auto_negative: bool,
}

/// Mask, control layers, regions and reference images of an image job, by their uploaded names.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct GuidanceInput<'a> {
    /// Name of the uploaded mask (white = redraw).
    pub mask_image: Option<&'a str>,
    pub controls: Vec<ControlInput<'a>>,
    pub regions: Vec<RegionInput<'a>>,
    pub refs: Vec<RefInput<'a>>,
    /// Names of the uploaded pictures the main model takes in itself as references (FLUX.2), in order.
    pub references: Vec<&'a str>,
}

impl GuidanceInput<'_> {
    fn is_empty(&self) -> bool {
        self.mask_image.is_none()
            && self.controls.is_empty()
            && self.regions.is_empty()
            && self.refs.is_empty()
            && self.references.is_empty()
    }
}

pub struct GraphInput<'a> {
    pub params: &'a GenerationMetadata,
    pub checkpoint: &'a ComfyRef,
    pub vae: Option<&'a ComfyRef>,
    pub loras: Vec<(&'a ComfyRef, f64)>,
    pub upscale_model: Option<&'a ComfyRef>,
    /// Upscaling: the tile ControlNet, which guides the redraw of the enlarged picture at the structure setting.
    pub tile_controlnet: Option<&'a ComfyRef>,
    /// Upscaling: the model that finishes the drawn picture, before it is fitted to the output size.
    pub post_processing_model: Option<&'a ComfyRef>,
    /// Video: the text encoder file.
    pub text_encoder: Option<&'a ComfyRef>,
    /// A model loaded in parts (Anima, Flux...): the family and its text encoders.
    pub split: Option<&'a super::split::SplitJob>,
    /// Name of the source image already uploaded to ComfyUI's input folder.
    pub init_image: Option<&'a str>,
    pub guidance: GuidanceInput<'a>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BuiltGraph {
    pub prompt: Value,
    /// Node whose output images are the result.
    pub output_node: String,
    pub total_steps: u32,
    /// Video: a node whose image is the first frame, kept as the thumbnail.
    pub thumbnail_node: Option<String>,
    /// Music: the output is an audio file of this format.
    pub audio_ext: Option<&'static str>,
    /// A job that samples more than once (the high-resolution fix): each sampler node with the steps done before it,
    /// so progress counts on through `total_steps` instead of starting over. Empty for one pass.
    pub passes: Vec<(String, u32)>,
}

#[derive(Default)]
pub(super) struct Builder {
    pub(super) nodes: Map<String, Value>,
}

impl Builder {
    pub(super) fn add(&mut self, class: &str, inputs: Value) -> String {
        let id = (self.nodes.len() + 1).to_string();
        self.nodes
            .insert(id.clone(), json!({ "class_type": class, "inputs": inputs }));
        id
    }

    /// Like `add`, but returns the node already added with the same class and inputs (shared model loaders).
    pub(super) fn add_once(&mut self, class: &str, inputs: Value) -> String {
        let wanted = json!({ "class_type": class, "inputs": inputs });
        match self.nodes.iter().find(|(_, n)| **n == wanted) {
            Some((id, _)) => id.clone(),
            None => self.add(class, inputs),
        }
    }
}

pub(super) fn link(node: &str, slot: u32) -> Value {
    json!([node, slot])
}

fn round8(v: f64) -> u32 {
    (((v / 8.0).round() as u32).saturating_mul(8)).max(64)
}

/// The denoise strength used for image-to-image style modes.
pub fn denoise_for(p: &GenerationMetadata) -> f64 {
    match p.generation_mode {
        GenerationMode::Txt2img | GenerationMode::Workflow => 1.0,
        GenerationMode::Upscale => p
            .strength
            .unwrap_or_else(|| creativity_strength(p.creativity)),
        _ => p.strength.unwrap_or(0.7),
    }
    .clamp(0.0, 1.0)
}

/// The denoise strength of an upscale from its creativity setting (-10 to 10): 0.35 at 0 (the strength an upscale had
/// before the setting existed), 0.1 at -10 and 0.6 at 10. A higher creativity redraws more of the picture.
fn creativity_strength(creativity: Option<f64>) -> f64 {
    0.35 + creativity.unwrap_or(0.0).clamp(-10.0, 10.0) * 0.025
}

/// The strength of the tile ControlNet from its structure setting (-10 to 10): 0 at -10, 0.5 at 0 and 1 at 10. A higher
/// structure keeps the shape of the original picture more closely.
fn structure_weight(structure: Option<f64>) -> f64 {
    0.5 + structure.unwrap_or(0.0).clamp(-10.0, 10.0) * 0.05
}

/// The step a draft stops at: `clamp(round(f × N), ceil(0.2 × N), N − 2)`, so the picture is already readable
/// and at least two steps remain.
pub fn draft_step(steps: u32, fraction: f64) -> u32 {
    let n = steps as f64;
    let k = (fraction * n)
        .round()
        .clamp((0.2 * n).ceil(), (n - 2.0).max(1.0));
    k as u32
}

/// The schedule a draft samples from and the step it starts at: KSampler with a denoise below 1 makes a schedule of
/// `int(steps / denoise)` steps and draws its last `steps`, so a draft of image to image starts that far into it.
pub fn draft_schedule(steps: u32, denoise: f64) -> (u32, u32) {
    if denoise > 0.9999 {
        return (steps, 0);
    }
    let schedule = (f64::from(steps) / denoise) as u32;
    (schedule, schedule - steps)
}

/// The longest side an upscale may have.
pub const MAX_UPSCALE_SIDE: u32 = 8192;

/// Output size: the requested size, scaled for upscaling, snapped to multiples of 8.
pub fn output_size(p: &GenerationMetadata) -> (u32, u32) {
    let scale = if p.generation_mode == GenerationMode::Upscale {
        p.upscale_scale.unwrap_or(2.0)
    } else {
        1.0
    };
    (
        round8(p.width as f64 * scale),
        round8(p.height as f64 * scale),
    )
}

/// Size of the second pass of the high-resolution fix: the first size times the scale, snapped to multiples of 8.
pub fn hires_size(p: &GenerationMetadata, scale: f64) -> (u32, u32) {
    (
        round8(p.width as f64 * scale),
        round8(p.height as f64 * scale),
    )
}

/// Refusals of a high-resolution fix that cannot run as asked.
fn check_hires(input: &GraphInput<'_>) -> Result<(), String> {
    let p = input.params;
    let Some(h) = &p.hires_fix else {
        return Ok(());
    };
    if p.generation_mode != GenerationMode::Txt2img {
        return Err("The high-resolution fix is only available for text to image".into());
    }
    if p.draft_at.is_some() {
        return Err("A draft cannot use the high-resolution fix".into());
    }
    if !(h.scale.is_finite() && (1.0..=4.0).contains(&h.scale)) {
        return Err("The high-resolution fix needs a scale between 1 and 4".into());
    }
    if !(h.strength.is_finite() && h.strength > 0.0 && h.strength <= 1.0) {
        return Err("The high-resolution fix needs a strength above 0 and at most 1".into());
    }
    if h.steps == Some(0) {
        return Err("The second pass needs at least 1 step".into());
    }
    if h.upscale_model_key.is_some() != input.upscale_model.is_some() {
        return Err("The upscale model of the high-resolution fix was not resolved".into());
    }
    Ok(())
}

/// Start and end of an effect as fractions of the steps, kept inside 0..=1 and in order.
fn span(begin_end: [f64; 2]) -> (f64, f64) {
    let clamp = |v: f64| {
        if v.is_finite() {
            v.clamp(0.0, 1.0)
        } else {
            0.0
        }
    };
    let (b, e) = (clamp(begin_end[0]), clamp(begin_end[1]));
    (b.min(e), b.max(e))
}

/// A stored white-on-black picture as a mask the size of the generation area (red channel).
fn mask_of(g: &mut Builder, image: &str, width: u32, height: u32) -> Value {
    let load = g.add("LoadImage", json!({ "image": image }));
    let scaled = g.add(
        "ImageScale",
        json!({ "image": link(&load, 0), "upscale_method": "bilinear", "width": width, "height": height, "crop": "disabled" }),
    );
    link(
        &g.add(
            "ImageToMask",
            json!({ "image": link(&scaled, 0), "channel": "red" }),
        ),
        0,
    )
}

/// Refusals that depend on the guidance and its counts in the metadata.
fn check_guidance(input: &GraphInput<'_>) -> Result<(), String> {
    let p = input.params;
    let g = &input.guidance;
    if p.regional_guidance_count.unwrap_or(0) as usize != g.regions.len() {
        return Err("The regional guidance layers sent do not match their count".into());
    }
    // The regions are conditioning masks: the SD family's text encoders and sampler take them as they are.
    if let (false, Some(split)) = (g.regions.is_empty(), input.split) {
        return Err(format!(
            "Regional guidance layers work with SD 1.5 and SDXL models only, not with {}",
            split.family.label()
        ));
    }
    // Pictures a model takes in itself as references: FLUX.2 only (the SD family takes reference images through an adapter).
    if !g.references.is_empty() && input.split.is_none() {
        return Err(
            "Reference pictures are taken in by FLUX.2 models only; SD models use reference images"
                .into(),
        );
    }
    let image_mode = matches!(
        p.generation_mode,
        GenerationMode::Txt2img
            | GenerationMode::Img2img
            | GenerationMode::Inpaint
            | GenerationMode::Outpaint
    );
    if !image_mode && !g.is_empty() {
        return Err(format!(
            "Masks, control layers and reference images cannot be used with {:?}",
            p.generation_mode
        ));
    }
    if p.ref_image_count.unwrap_or(0) as usize != g.refs.len() {
        return Err("The reference images were counted but not sent with the job".into());
    }
    if p.control_layer_count.unwrap_or(0) as usize != g.controls.len() {
        return Err("The control layers were counted but not sent with the job".into());
    }
    let masked = matches!(
        p.generation_mode,
        GenerationMode::Inpaint | GenerationMode::Outpaint
    );
    if masked && g.mask_image.is_none() {
        return Err(format!(
            "{:?} needs a mask of the area to redraw",
            p.generation_mode
        ));
    }
    if !masked && g.mask_image.is_some() {
        return Err("A mask is only used for inpaint and outpaint".into());
    }
    Ok(())
}

pub fn build(input: &GraphInput<'_>) -> Result<BuiltGraph, String> {
    let p = input.params;
    // A model of the newer families (Anima, Flux...) shares this graph; its loaders, shift, sampler and latent are its own.
    let family = input.split.map(|s| s.family);
    if let Some(split) = input.split {
        super::split::check(input, split)?;
    }
    check_guidance(input)?;
    check_hires(input)?;
    if p.generation_mode == GenerationMode::Video {
        return super::video::build(input);
    }
    if p.generation_mode == GenerationMode::Music {
        return super::music::build(input);
    }
    if p.generation_mode == GenerationMode::Logo {
        return super::logo::build(input);
    }
    // Seamless tiling pads the model's and the VAE's convolutions in a circle (the seamless tiling pack); the SD family's
    // networks are made of them, the newer families' transformers are not.
    if (p.seamless_x || p.seamless_y) && family.is_some() {
        return Err(format!(
            "Seamless tiling works with SD 1.5 and SDXL models only, not with {}",
            input.split.map_or("", |s| s.family.label())
        ));
    }
    let tiling = match (p.seamless_x, p.seamless_y) {
        (true, true) => Some("enable"),
        (true, false) => Some("x_only"),
        (false, true) => Some("y_only"),
        (false, false) => None,
    };
    // A model made to edit or to inpaint takes the picture through its own conditioning (Flux Fill, Kontext, Qwen edit).
    if let Some(split) = input.split.filter(|s| super::variants::is_edit(s)) {
        return super::variants::build(input, split);
    }
    let (sampler, scheduler) = match family {
        Some(f) if !f.follows_scheduler_setting() => f.sampling(),
        _ => family
            .map_or_else(
                || sampler_for(&p.scheduler),
                |f| f.sampling_for(&p.scheduler),
            )
            .ok_or_else(|| format!("Scheduler '{}' is not available in ComfyUI", p.scheduler))?,
    };
    if p.steps == 0 {
        return Err("Steps must be at least 1".into());
    }
    if let Some(f) = p.draft_at {
        if !matches!(
            p.generation_mode,
            GenerationMode::Txt2img | GenerationMode::Img2img
        ) {
            return Err("Drafts are only available for text to image and image to image".into());
        }
        if !(f > 0.0 && f < 1.0) || p.steps < 4 {
            return Err("A draft needs a position between 0 and 1 and at least 4 steps".into());
        }
        if denoise_for(p) <= 0.0 {
            return Err("A draft needs a strength above 0".into());
        }
    }
    if p.generation_mode == GenerationMode::Graph {
        return Err("A graph job runs the prompt it brings".into());
    }
    let needs_image = !matches!(
        p.generation_mode,
        GenerationMode::Txt2img | GenerationMode::Workflow
    );
    if needs_image && input.init_image.is_none() {
        return Err(format!("{:?} needs a source image", p.generation_mode));
    }

    let mut g = Builder::default();
    let (mut model, mut clip, vae) = match input.split {
        Some(split) => super::split::load(&mut g, input, split),
        None => {
            let ckpt = g.add(
                "CheckpointLoaderSimple",
                json!({ "ckpt_name": input.checkpoint.name }),
            );
            let vae = match input.vae {
                Some(v) => link(&g.add("VAELoader", json!({ "vae_name": v.name })), 0),
                None => link(&ckpt, 2),
            };
            (link(&ckpt, 0), link(&ckpt, 1), vae)
        }
    };
    for (lora, weight) in &input.loras {
        let id = g.add(
            "LoraLoader",
            json!({ "model": model, "clip": clip, "lora_name": lora.name, "strength_model": weight, "strength_clip": weight }),
        );
        model = link(&id, 0);
        clip = link(&id, 1);
    }
    if let Some(f) = family {
        model = super::split::patch_model(&mut g, f, model);
    }
    // CLIP skip is a setting of the SD family's CLIP text encoders.
    if p.clip_skip > 0 && family.is_none() {
        let id = g.add(
            "CLIPSetLastLayer",
            json!({ "clip": clip, "stop_at_clip_layer": -(p.clip_skip as i64) - 1 }),
        );
        clip = link(&id, 0);
    }
    // Reference images patch the model's attention, one IP-Adapter after the other; one with a region acts only there.
    let (width, height) = output_size(p);
    // The Upscaling screen's limit (`MAX_SIDE` in `UpscaleSection.tsx`): past it the tiles would be too many to build.
    if p.generation_mode == GenerationMode::Upscale && width.max(height) > MAX_UPSCALE_SIDE {
        return Err(format!(
            "An upscale can be at most {MAX_UPSCALE_SIDE} pixels on a side"
        ));
    }
    for r in &input.guidance.refs {
        let ipadapter = g.add_once(
            "IPAdapterModelLoader",
            json!({ "ipadapter_file": r.model.name }),
        );
        let clip_vision = g.add_once(
            "CLIPVisionLoader",
            json!({ "clip_name": r.clip_vision.name }),
        );
        let image = g.add("LoadImage", json!({ "image": r.image }));
        let (start, end) = span(r.begin_end);
        let mut inputs = json!({
            "model": model,
            "ipadapter": link(&ipadapter, 0),
            "image": link(&image, 0),
            "weight": r.weight,
            "weight_type": ipadapter_weight_type(r.method),
            "combine_embeds": "concat",
            "start_at": start,
            "end_at": end,
            "embeds_scaling": "V only",
            "clip_vision": link(&clip_vision, 0),
        });
        if let Some(region) = r.region {
            inputs["attn_mask"] = mask_of(&mut g, region, width, height);
        }
        let id = g.add(IPADAPTER_NODE, inputs);
        model = link(&id, 0);
    }
    if input.guidance.mask_image.is_some() {
        // Grey mask values become per-pixel denoise strength (inpaint layers with a denoise limit, soft edges).
        let id = g.add("DifferentialDiffusion", json!({ "model": model }));
        model = link(&id, 0);
    }
    if p.cfg_rescale > 0.0 {
        let id = g.add(
            "RescaleCFG",
            json!({ "model": model, "multiplier": p.cfg_rescale }),
        );
        model = link(&id, 0);
    }
    if let Some(tiling) = tiling {
        let id = g.add(
            "SeamlessTile",
            json!({ "model": model, "tiling": tiling, "copy_model": "Make a copy" }),
        );
        model = link(&id, 0);
    }
    let positive_text = g.add(
        "CLIPTextEncode",
        json!({ "text": p.positive_prompt, "clip": clip }),
    );
    let mut positive = link(&positive_text, 0);
    // A distilled model (Flux) takes the strength as a guidance value on the prompt, samples at CFG 1 and has no
    // negative prompt: a zeroed copy of the positive stands in for it.
    let distilled = family.is_some_and(|f| f.distilled());
    let cfg = if distilled { 1.0 } else { p.cfg_scale };
    let mut negative = if distilled {
        let id = g.add(
            "FluxGuidance",
            json!({ "conditioning": positive, "guidance": p.cfg_scale.clamp(0.0, 100.0) }),
        );
        positive = link(&id, 0);
        link(
            &g.add(
                "ConditioningZeroOut",
                json!({ "conditioning": link(&positive_text, 0) }),
            ),
            0,
        )
    } else {
        link(
            &g.add(
                "CLIPTextEncode",
                json!({ "text": p.negative_prompt, "clip": clip }),
            ),
            0,
        )
    };

    // Regional guidance: each layer's prompts apply inside its region, besides the prompts of the whole picture.
    for r in &input.guidance.regions {
        let mask = mask_of(&mut g, r.mask_image, width, height);
        // The prompt as conditioning limited to the region (or to everything outside it).
        let confined = |g: &mut Builder, text: &str, mask: &Value| {
            let encoded = g.add("CLIPTextEncode", json!({ "text": text, "clip": clip }));
            link(
                &g.add(
                    "ConditioningSetMask",
                    json!({ "conditioning": link(&encoded, 0), "mask": mask, "strength": 1.0, "set_cond_area": "default" }),
                ),
                0,
            )
        };
        let combine = |g: &mut Builder, into: &Value, extra: Value| {
            link(
                &g.add(
                    "ConditioningCombine",
                    json!({ "conditioning_1": into, "conditioning_2": extra }),
                ),
                0,
            )
        };
        if let Some(text) = r.positive {
            let inside = confined(&mut g, text, &mask);
            positive = combine(&mut g, &positive, inside);
            if r.auto_negative {
                let outside = link(&g.add("InvertMask", json!({ "mask": mask })), 0);
                let kept_out = confined(&mut g, text, &outside);
                negative = combine(&mut g, &negative, kept_out);
            }
        }
        if let Some(text) = r.negative {
            let inside = confined(&mut g, text, &mask);
            negative = combine(&mut g, &negative, inside);
        }
    }
    for c in &input.guidance.controls {
        let (start, end) = span(c.begin_end);
        // A model patch (Anima LLLite, the Qwen-Image and Z-Image Fun ControlNets) changes the model, not the prompt.
        if c.model.folder == super::split::MODEL_PATCHES {
            let f = family.ok_or(
                "A model patch control works with Anima, Qwen-Image and Z-Image models only",
            )?;
            let load = g.add("LoadImage", json!({ "image": c.image }));
            let scaled = g.add(
                "ImageScale",
                json!({ "image": link(&load, 0), "upscale_method": "bilinear", "width": width, "height": height, "crop": "disabled" }),
            );
            model = super::split::apply_patch(
                &mut g,
                f,
                c.model,
                model,
                &vae,
                link(&scaled, 0),
                (c.weight, start, end),
            )
            .ok_or_else(|| {
                format!(
                    "{} models cannot use the control model {}",
                    f.label(),
                    c.model.name
                )
            })?;
            continue;
        }
        let mut net = g.add_once(
            "ControlNetLoader",
            json!({ "control_net_name": c.model.name }),
        );
        if let Some(kind) = c.union_type {
            net = g.add_once(
                "SetUnionControlNetType",
                json!({ "control_net": link(&net, 0), "type": kind }),
            );
        }
        let load = g.add("LoadImage", json!({ "image": c.image }));
        let scaled = g.add(
            "ImageScale",
            json!({ "image": link(&load, 0), "upscale_method": "bilinear", "width": width, "height": height, "crop": "disabled" }),
        );
        let mut inputs = json!({
            "positive": positive,
            "negative": negative,
            "control_net": link(&net, 0),
            "image": link(&scaled, 0),
            "strength": c.weight,
            "start_percent": start,
            "end_percent": end,
        });
        // The ControlNets of the newer families (Flux, SD3, Qwen-Image) work on the latent and need the VAE.
        if family.is_some() {
            inputs["vae"] = vae.clone();
        }
        let id = g.add("ControlNetApplyAdvanced", inputs);
        positive = link(&id, 0);
        // "More control" leaves the negative side without the control, so CFG pushes towards it (as A1111's
        // "ControlNet is more important"). "More prompt" (soft injection) has no core equivalent: it runs balanced.
        if c.mode != ControlMode::MoreControl {
            negative = link(&id, 1);
        }
    }

    // An upscale larger than a tile is redrawn tile by tile (tiles.rs); seamless tiling needs the whole picture at once.
    let tiles = if p.generation_mode == GenerationMode::Upscale && tiling.is_none() {
        super::tiles::grid(width, height, super::tiles::tile_side(p.width, p.height))
    } else {
        Vec::new()
    };
    let tiled = tiles.len() > 1;
    // The source picture at the output size, and the mask that says where it is redrawn.
    let mut source: Option<Value> = None;
    let mut soft_mask: Option<Value> = None;
    let latent = match input.init_image {
        Some(name) if needs_image => {
            let load = g.add("LoadImage", json!({ "image": name }));
            let mut pixels = link(&load, 0);
            if p.generation_mode == GenerationMode::Upscale {
                if let Some(up) = input.upscale_model {
                    let loader = g.add("UpscaleModelLoader", json!({ "model_name": up.name }));
                    let id = g.add(
                        "ImageUpscaleWithModel",
                        json!({ "upscale_model": link(&loader, 0), "image": pixels }),
                    );
                    pixels = link(&id, 0);
                }
            }
            let scaled = link(
                &g.add(
                    "ImageScale",
                    json!({ "image": pixels, "upscale_method": "lanczos", "width": width, "height": height, "crop": "disabled" }),
                ),
                0,
            );
            // Tiles encode their own cuts.
            let encoded = if tiled {
                Value::Null
            } else {
                link(
                    &g.add("VAEEncode", json!({ "pixels": scaled, "vae": vae })),
                    0,
                )
            };
            source = Some(scaled);
            match input.guidance.mask_image {
                Some(mask_name) => {
                    let mask = soft_mask_nodes(&mut g, mask_name, width, height, p.mask_blur);
                    let id = g.add(
                        "SetLatentNoiseMask",
                        json!({ "samples": encoded, "mask": mask }),
                    );
                    soft_mask = Some(mask);
                    link(&id, 0)
                }
                None => encoded,
            }
        }
        _ => link(
            &g.add(
                family.map_or("EmptyLatentImage", |f| f.latent()),
                json!({ "width": width, "height": height, "batch_size": 1 }),
            ),
            0,
        ),
    };
    let decode = |g: &mut Builder, samples: Value| {
        link(
            &match tiling {
                Some(t) => g.add(
                    "CircularVAEDecode",
                    json!({ "samples": samples, "vae": vae, "tiling": t }),
                ),
                None => g.add("VAEDecode", json!({ "samples": samples, "vae": vae })),
            },
            0,
        )
    };
    let mut total_steps = p.steps;
    let mut passes = Vec::new();
    let mut result;
    if tiled {
        let net = input
            .tile_controlnet
            .map(|tile| g.add_once("ControlNetLoader", json!({ "control_net_name": tile.name })));
        let picture = source.clone().expect("an upscale has its source picture");
        let redraw = super::tiles::Redraw {
            model: &model,
            positive: &positive,
            negative: &negative,
            vae: &vae,
            picture: &picture,
            seed: p.seed,
            steps: p.steps,
            cfg,
            sampler,
            scheduler,
            denoise: denoise_for(p),
            control: net.as_deref().map(|n| (n, structure_weight(p.structure))),
            control_vae: family.is_some(),
        };
        (result, passes) = super::tiles::redraw(&mut g, &redraw, &tiles);
        total_steps = p.steps * tiles.len() as u32;
    } else {
        // Upscaling with a tile ControlNet: the enlarged picture guides the redraw, at the strength of the structure setting.
        if let (GenerationMode::Upscale, Some(tile), Some(scaled)) =
            (p.generation_mode, input.tile_controlnet, source.clone())
        {
            let net = g.add_once("ControlNetLoader", json!({ "control_net_name": tile.name }));
            let mut inputs = json!({
                "positive": positive,
                "negative": negative,
                "control_net": link(&net, 0),
                "image": scaled,
                "strength": structure_weight(p.structure),
                "start_percent": 0.0,
                "end_percent": 1.0,
            });
            if family.is_some() {
                inputs["vae"] = vae.clone();
            }
            let id = g.add("ControlNetApplyAdvanced", inputs);
            positive = link(&id, 0);
            negative = link(&id, 1);
        }
        let sampled = match p.draft_at {
            // Stop early and let the sampler finish that step cleanly, so the draft shows what the image is turning into.
            // Image to image draws only the last steps of a longer schedule, as KSampler does with its denoise; the
            // draft stops at the position of the steps actually drawn.
            Some(f) => {
                let (schedule, start) = draft_schedule(p.steps, denoise_for(p));
                total_steps = draft_step(p.steps, f);
                g.add(
                    "KSamplerAdvanced",
                    json!({
                        "model": model,
                        "add_noise": "enable",
                        "noise_seed": p.seed,
                        "steps": schedule,
                        "cfg": cfg,
                        "sampler_name": sampler,
                        "scheduler": scheduler,
                        "positive": positive,
                        "negative": negative,
                        "latent_image": latent,
                        "start_at_step": start,
                        "end_at_step": start + total_steps,
                        "return_with_leftover_noise": "disable",
                    }),
                )
            }
            None => g.add(
                "KSampler",
                json!({
                    "model": model,
                    "seed": p.seed,
                    "steps": p.steps,
                    "cfg": cfg,
                    "sampler_name": sampler,
                    "scheduler": scheduler,
                    "positive": positive,
                    "negative": negative,
                    "latent_image": latent,
                    "denoise": denoise_for(p),
                }),
            ),
        };
        result = decode(&mut g, link(&sampled, 0));
        if let Some(h) = &p.hires_fix {
            // The second pass: the decoded first picture is enlarged (by the upscale model, then to the exact size, or
            // by a plain Lanczos resize), encoded again and redrawn at the strength with the same seed, model (LoRAs and
            // reference images included) and conditioning (control layers included; ControlNet scales its picture to
            // the latent).
            let (w2, h2) = hires_size(p, h.scale);
            let mut pixels = result;
            if let Some(up) = input.upscale_model {
                let loader = g.add("UpscaleModelLoader", json!({ "model_name": up.name }));
                let id = g.add(
                    "ImageUpscaleWithModel",
                    json!({ "upscale_model": link(&loader, 0), "image": pixels }),
                );
                pixels = link(&id, 0);
            }
            let scaled = g.add(
                "ImageScale",
                json!({ "image": pixels, "upscale_method": "lanczos", "width": w2, "height": h2, "crop": "disabled" }),
            );
            let encoded = g.add(
                "VAEEncode",
                json!({ "pixels": link(&scaled, 0), "vae": vae }),
            );
            let steps2 = h.steps.unwrap_or(p.steps);
            let second = g.add(
                "KSampler",
                json!({
                    "model": model,
                    "seed": p.seed,
                    "steps": steps2,
                    "cfg": cfg,
                    "sampler_name": sampler,
                    "scheduler": scheduler,
                    "positive": positive,
                    "negative": negative,
                    "latent_image": link(&encoded, 0),
                    "denoise": h.strength,
                }),
            );
            passes = vec![(sampled.clone(), 0), (second.clone(), total_steps)];
            total_steps += steps2;
            result = decode(&mut g, link(&second, 0));
        }
    }
    // Upscaling with a post-processing model: it finishes the drawn picture, which is then fitted to the output size.
    if let (GenerationMode::Upscale, Some(post)) = (p.generation_mode, input.post_processing_model)
    {
        let loader = g.add("UpscaleModelLoader", json!({ "model_name": post.name }));
        let enlarged = g.add(
            "ImageUpscaleWithModel",
            json!({ "upscale_model": link(&loader, 0), "image": result }),
        );
        let fitted = g.add(
            "ImageScale",
            json!({ "image": link(&enlarged, 0), "upscale_method": "lanczos", "width": width, "height": height, "crop": "disabled" }),
        );
        result = link(&fitted, 0);
    }
    if let (Some(source), Some(mask)) = (source, soft_mask) {
        // Outside the mask the source pixels are kept as they were (the VAE round trip would change them a little).
        let id = g.add(
            "ImageCompositeMasked",
            json!({ "destination": source, "source": result, "x": 0, "y": 0, "resize_source": false, "mask": mask }),
        );
        result = link(&id, 0);
    }
    // The manga finish is the last step, so the screentone is printed at the size the picture is stored at.
    if let Some(m) = &p.manga_screen {
        let id = g.add(
            MANGA_NODE,
            json!({
                "image": result,
                "screen_lines": m.screen_lines.clamp(40, 600),
                "white_point": m.white_point.clamp(0.3, 1.0),
                "black_point": m.black_point.clamp(0.0, 0.7),
                "light_tone": 0.18,
                "dark_tone": 0.42,
                "gradation": m.gradation.clamp(0.0, 1.0),
                "pen_threshold": 0.30,
                "white_lines": m.white_lines.clamp(0.0, 1.0),
            }),
        );
        result = link(&id, 0);
    }
    let output = g.add("PreviewImage", json!({ "images": result }));
    Ok(BuiltGraph {
        prompt: Value::Object(g.nodes),
        output_node: output,
        total_steps,
        thumbnail_node: None,
        audio_ext: None,
        passes,
    })
}

/// The mask at the output size with a soft edge: grown by half the blur so the edge of the painted area is fully
/// redrawn, then blurred. Without blur it is used as painted.
pub(super) fn soft_mask_nodes(
    g: &mut Builder,
    mask_name: &str,
    width: u32,
    height: u32,
    blur: Option<u32>,
) -> Value {
    let load = g.add("LoadImage", json!({ "image": mask_name }));
    let scaled = g.add(
        "ImageScale",
        json!({ "image": link(&load, 0), "upscale_method": "bilinear", "width": width, "height": height, "crop": "disabled" }),
    );
    let mask = g.add(
        "ImageToMask",
        json!({ "image": link(&scaled, 0), "channel": "red" }),
    );
    let blur = blur.unwrap_or(DEFAULT_MASK_BLUR).min(MAX_BLUR_RADIUS);
    if blur == 0 {
        return link(&mask, 0);
    }
    let grown = g.add(
        "GrowMask",
        json!({ "mask": link(&mask, 0), "expand": blur / 2, "tapered_corners": true }),
    );
    let as_image = g.add("MaskToImage", json!({ "mask": link(&grown, 0) }));
    let blurred = g.add(
        "ImageBlur",
        json!({ "image": link(&as_image, 0), "blur_radius": blur, "sigma": (blur as f64 / 2.0).clamp(0.1, 10.0) }),
    );
    link(
        &g.add(
            "ImageToMask",
            json!({ "image": link(&blurred, 0), "channel": "red" }),
        ),
        0,
    )
}

#[cfg(test)]
pub(crate) mod tests;
