//! Image models of the newer families (Anima, Flux, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow). ComfyUI loads
//! them in parts: the diffusion model from `diffusion_models` (or a checkpoint that carries some of the parts), the text
//! encoders from `text_encoders`, and a VAE. Each family has a recipe taken from ComfyUI's own templates: which loader
//! reads the encoders, the flow shift, the latent, the sampler, and how the strength is given. The rest of the picture
//! graph (LoRAs, masks, control layers, the high-resolution fix, drafts) is shared with the SD family in `graph.rs`.
use super::graph::{Builder, GraphInput};
use crate::models::classify::Variant;
use crate::types::{BaseModel, ComfyRef, GenerationMode, ModelConfig, ModelType, Sampling};
use serde_json::{json, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Family {
    Anima,
    Flux,
    Chroma,
    QwenImage,
    ZImage,
    Sd3,
    Hidream,
    Auraflow,
    Flux2,
    HunyuanImage,
    // Video families (`video_families.rs`).
    Wan,
    HunyuanVideo,
    HunyuanVideo15,
    Ltx,
    Ltx2,
}

/// What a Wan model is made for, read from the channels of its patch embedding (`classify::wan_in_channels`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WanKind {
    /// Text to video (16 channels): Wan 2.1 T2V and the two models of Wan 2.2 A14B T2V.
    T2v,
    /// Image to video (36 channels): Wan 2.1 I2V and the two models of Wan 2.2 A14B I2V.
    I2v,
    /// The 5B model that does both (48 channels), with Wan 2.2's own VAE.
    Ti2v,
}

impl WanKind {
    /// The kind a file name says, for a file without a header to read (GGUF).
    pub fn from_name(file_name: &str) -> Option<WanKind> {
        let n = file_name.to_ascii_lowercase();
        if n.contains("ti2v") {
            Some(WanKind::Ti2v)
        } else if n.contains("i2v") {
            Some(WanKind::I2v)
        } else if n.contains("t2v") || n.contains("vace") {
            Some(WanKind::T2v)
        } else {
            None
        }
    }

    pub fn from_channels(c: u64) -> Option<WanKind> {
        match c {
            16 => Some(WanKind::T2v),
            36 => Some(WanKind::I2v),
            48 => Some(WanKind::Ti2v),
            _ => None,
        }
    }
}

/// How the diffusion model is loaded: on its own, or from a checkpoint that may carry the text encoders and the VAE.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Loader {
    Unet,
    Checkpoint { clip: bool, vae: bool },
}

/// A job with a model of these families: the family, how it loads, and the text encoders picked for it (none when the
/// checkpoint carries them).
#[derive(Debug, Clone, PartialEq)]
pub struct SplitJob {
    pub family: Family,
    pub loader: Loader,
    pub text_encoders: Vec<ComfyRef>,
    /// A Wan model: what it is made for.
    pub wan: Option<WanKind>,
    /// A Wan 2.2 A14B high-noise model: its low-noise partner, which finishes the picture.
    pub low_noise: Option<ComfyRef>,
    /// What the model is made for beyond plain drawing (Fill, Kontext, an edit model, VACE, or a kind not supported).
    pub variant: Variant,
    /// A Wan 2.1 image-to-video model: the CLIP-vision model that encodes the start picture.
    pub clip_vision: Option<ComfyRef>,
}

impl SplitJob {
    /// The node a video job needs that older ComfyUI versions lack (checked before the job is sent).
    pub fn video_node(&self) -> &'static str {
        if self.variant == Variant::WanVace {
            return "WanVaceToVideo";
        }
        match (self.family, self.wan) {
            (Family::HunyuanVideo, _) if self.variant == Variant::HyI2v => "HunyuanImageToVideo",
            (Family::HunyuanVideo15, _) if self.variant == Variant::Hy15I2v => {
                "HunyuanVideo15ImageToVideo"
            }
            (Family::HunyuanVideo15, _) => "EmptyHunyuanVideo15Latent",
            (Family::Ltx2, _) => "LTXVConcatAVLatent",
            (Family::Wan, Some(WanKind::Ti2v)) | (Family::Wan, None) => "Wan22ImageToVideoLatent",
            (Family::Wan, _) => "WanImageToVideo",
            (Family::HunyuanVideo, _) => "EmptyHunyuanLatentVideo",
            (Family::Ltx, _) => "LTXVScheduler",
            _ => "KSampler",
        }
    }

    /// A job without video details (every image family).
    pub fn new(family: Family, loader: Loader, text_encoders: Vec<ComfyRef>) -> SplitJob {
        SplitJob {
            family,
            loader,
            text_encoders,
            wan: None,
            low_noise: None,
            variant: Variant::Plain,
            clip_vision: None,
        }
    }
}

/// A file a family needs: what to tell the user when it is missing, the words its file name carries, and words that
/// mark a look-alike for another family (HiDream's long CLIP-L is not Flux's CLIP-L).
pub struct Need {
    pub what: &'static str,
    pub words: &'static [&'static str],
    pub avoid: &'static [&'static str],
}

const fn need(what: &'static str, words: &'static [&'static str]) -> Need {
    Need {
        what,
        words,
        avoid: &[],
    }
}

const T5XXL: Need = Need {
    what: "the T5-XXL text encoder (t5xxl_fp8_e4m3fn.safetensors)",
    words: &["t5xxl", "t5-xxl", "t5_xxl", "t5-v1_1-xxl", "t5_v1_1_xxl"],
    // Wan's UMT5-XXL has a different vocabulary and "t5_xxl" is part of its name.
    avoid: &["umt5"],
};
const CLIP_L: Need = Need {
    what: "the CLIP-L text encoder (clip_l.safetensors)",
    words: &["clip_l", "clip-l"],
    avoid: &["hidream"],
};
const CLIP_G: Need = Need {
    what: "the CLIP-G text encoder (clip_g.safetensors)",
    words: &["clip_g", "clip-g"],
    avoid: &["hidream"],
};
const FLUX_AE: Need = need(
    "the Flux VAE (ae.safetensors)",
    &[
        "ae.safetensors",
        "ae.sft",
        "flux_vae",
        "flux-vae",
        "flux1-vae",
    ],
);
const QWEN_VAE: Need = need(
    "the Qwen-Image VAE (qwen_image_vae.safetensors)",
    &["qwen_image_vae", "qwen-image-vae"],
);

const QWEN3_06B: Need = need(
    "the Qwen3 0.6B text encoder (qwen_3_06b_base.safetensors)",
    &[
        "qwen_3_06b",
        "qwen3_06b",
        "qwen3-0.6b",
        "qwen_3_0.6b",
        "qwen3_0.6b",
    ],
);
const QWEN25_VL: Need = need(
    "the Qwen2.5-VL 7B text encoder (qwen_2.5_vl_7b_fp8_scaled.safetensors)",
    &["qwen_2.5_vl", "qwen2.5_vl", "qwen2.5-vl", "qwen_2.5"],
);
const QWEN3_4B: Need = need(
    "the Qwen3 4B text encoder (qwen_3_4b.safetensors)",
    &["qwen_3_4b", "qwen3_4b", "qwen3-4b"],
);
const CLIP_L_HIDREAM: Need = need(
    "HiDream's long CLIP-L text encoder (clip_l_hidream.safetensors)",
    &["clip_l_hidream"],
);
const CLIP_G_HIDREAM: Need = need(
    "HiDream's long CLIP-G text encoder (clip_g_hidream.safetensors)",
    &["clip_g_hidream"],
);
const LLAMA31: Need = need(
    "the Llama 3.1 8B text encoder (llama_3.1_8b_instruct_fp8_scaled.safetensors)",
    &[
        "llama_3.1_8b",
        "llama3.1_8b",
        "llama-3.1-8b",
        "llama_3_1_8b",
    ],
);
const UMT5: Need = need(
    "the UMT5-XXL text encoder (umt5_xxl_fp8_e4m3fn_scaled.safetensors)",
    &["umt5_xxl", "umt5-xxl", "umt5"],
);
const LLAVA: Need = need(
    "the LLaVA-Llama3 text encoder (llava_llama3_fp8_scaled.safetensors)",
    &["llava_llama3", "llava-llama3"],
);
/// The CLIP-vision model of Wan 2.1 image to video.
pub const CLIP_VISION_H: Need = need(
    "the CLIP-vision model of Wan 2.1 (clip_vision_h.safetensors)",
    &["clip_vision_h", "clip-vision-h"],
);
/// The CLIP-vision model of HunyuanVideo 1.5 image to video.
pub const SIGCLIP_VISION: Need = need(
    "the SigCLIP vision model of HunyuanVideo 1.5 (sigclip_vision_patch14_384.safetensors)",
    &["sigclip_vision", "sigclip"],
);
/// The vision model of HunyuanVideo image to video (the LLaVA vision tower).
pub const LLAVA_VISION: Need = need(
    "the LLaVA vision model of HunyuanVideo (llava_llama3_vision.safetensors)",
    &["llava_llama3_vision", "llava-llama3-vision"],
);
const MISTRAL3: Need = need(
    "the Mistral 3 Small text encoder of FLUX.2 (mistral_3_small_flux2_bf16.safetensors)",
    &["mistral_3_small", "mistral3_small", "mistral-3-small"],
);
const QWEN3_8B: Need = need(
    "the Qwen3 8B text encoder (qwen_3_8b.safetensors)",
    &["qwen_3_8b", "qwen3_8b", "qwen3-8b"],
);
const BYT5: Need = need(
    "the ByT5 small text encoder (byt5_small_glyphxl_fp16.safetensors)",
    &["byt5_small", "byt5-small", "byt5"],
);
const GEMMA3_12B: Need = need(
    "the Gemma 3 12B text encoder (gemma_3_12B_it_fp4_mixed.safetensors)",
    &["gemma_3_12b", "gemma3_12b", "gemma-3-12b"],
);
const PILE_T5: Need = need(
    "the Pile-T5 text encoder of AuraFlow",
    &["pile_t5", "pile-t5", "auraflow_t5", "aura_t5"],
);

impl Family {
    pub fn of(base: BaseModel) -> Option<Family> {
        Some(match base {
            BaseModel::Anima => Family::Anima,
            BaseModel::Flux => Family::Flux,
            BaseModel::Chroma => Family::Chroma,
            BaseModel::QwenImage => Family::QwenImage,
            BaseModel::ZImage => Family::ZImage,
            BaseModel::Sd3 => Family::Sd3,
            BaseModel::Hidream => Family::Hidream,
            BaseModel::Auraflow => Family::Auraflow,
            BaseModel::Flux2 => Family::Flux2,
            BaseModel::HunyuanImage => Family::HunyuanImage,
            _ => return None,
        })
    }

    /// The video families (the Video screen runs them, not the Generate tab's picture graph).
    pub fn of_video(base: BaseModel) -> Option<Family> {
        Some(match base {
            BaseModel::Wan => Family::Wan,
            BaseModel::HunyuanVideo => Family::HunyuanVideo,
            BaseModel::HunyuanVideo15 => Family::HunyuanVideo15,
            BaseModel::LtxVideo => Family::Ltx,
            BaseModel::Ltx2 => Family::Ltx2,
            _ => return None,
        })
    }

    pub fn label(self) -> &'static str {
        match self {
            Family::Anima => "Anima",
            Family::Flux => "Flux",
            Family::Chroma => "Chroma",
            Family::QwenImage => "Qwen-Image",
            Family::ZImage => "Z-Image",
            Family::Sd3 => "SD3",
            Family::Hidream => "HiDream",
            Family::Auraflow => "AuraFlow",
            Family::Flux2 => "FLUX.2",
            Family::HunyuanImage => "HunyuanImage 2.1",
            Family::Wan => "Wan",
            Family::HunyuanVideo => "HunyuanVideo",
            Family::HunyuanVideo15 => "HunyuanVideo 1.5",
            Family::Ltx => "LTX-Video",
            Family::Ltx2 => "LTX-2",
        }
    }

    /// The text encoders, in the order the loader takes them.
    pub fn encoders(self) -> &'static [Need] {
        match self {
            Family::Anima => &[QWEN3_06B],
            Family::Flux => &[CLIP_L, T5XXL],
            Family::Chroma => &[T5XXL],
            Family::QwenImage => &[QWEN25_VL],
            Family::ZImage => &[QWEN3_4B],
            Family::Sd3 => &[CLIP_L, CLIP_G, T5XXL],
            Family::Hidream => &[CLIP_L_HIDREAM, CLIP_G_HIDREAM, T5XXL, LLAMA31],
            Family::Auraflow => &[PILE_T5],
            Family::Flux2 => &[MISTRAL3],
            Family::HunyuanImage => &[QWEN25_VL, BYT5],
            Family::Wan => &[UMT5],
            Family::HunyuanVideo => &[CLIP_L, LLAVA],
            Family::HunyuanVideo15 => &[QWEN25_VL, BYT5],
            Family::Ltx => &[T5XXL],
            Family::Ltx2 => &[GEMMA3_12B],
        }
    }

    /// The text encoders of a variant: FLUX.2 klein reads Qwen3 where dev reads Mistral.
    pub fn encoders_for(self, variant: Variant) -> &'static [Need] {
        match (self, variant) {
            (Family::Flux2, Variant::Flux2Klein4b) => &[QWEN3_4B],
            (Family::Flux2, Variant::Flux2Klein9b) => &[QWEN3_8B],
            _ => self.encoders(),
        }
    }

    /// The VAE the family wants.
    pub fn vae(self) -> Need {
        match self {
            Family::Anima | Family::QwenImage => QWEN_VAE,
            Family::Flux | Family::Chroma | Family::ZImage | Family::Hidream => FLUX_AE,
            Family::Sd3 => need(
                "the SD3 VAE (sd3_vae.safetensors)",
                &["sd3_vae", "sd3.5_vae", "sd35_vae", "sd3-vae"],
            ),
            Family::Auraflow => need(
                "the SDXL VAE (sdxl_vae.safetensors)",
                &["sdxl_vae", "sdxl.vae", "sdxl-vae"],
            ),
            Family::Wan => need(
                "the Wan 2.1 VAE (wan_2.1_vae.safetensors)",
                &["wan_2.1_vae", "wan2.1_vae"],
            ),
            Family::HunyuanVideo => need(
                "the HunyuanVideo VAE (hunyuan_video_vae_bf16.safetensors)",
                &["hunyuan_video_vae", "hunyuanvideo_vae"],
            ),
            Family::Ltx => need("the LTX-Video VAE (inside its checkpoint)", &["ltx"]),
            Family::Flux2 => need(
                "the FLUX.2 VAE (flux2-vae.safetensors)",
                &["flux2-vae", "flux2_vae", "flux2.vae"],
            ),
            Family::HunyuanVideo15 => need(
                "the HunyuanVideo 1.5 VAE (hunyuanvideo15_vae_fp16.safetensors)",
                &["hunyuanvideo15_vae", "hunyuan_video_15_vae"],
            ),
            Family::Ltx2 => need("the LTX-2 VAE (inside its checkpoint)", &["ltx"]),
            Family::HunyuanImage => Need {
                what: "the HunyuanImage 2.1 VAE (hunyuan_image_2.1_vae_fp16.safetensors)",
                words: &["hunyuan_image_2.1_vae", "hunyuan_image_vae"],
                // The refiner has a VAE of its own.
                avoid: &["refiner"],
            },
        }
    }

    /// The VAE for a Wan model of the given kind: the 5B model has its own (Wan 2.2's).
    pub fn vae_for(self, wan: Option<WanKind>) -> Need {
        match (self, wan) {
            (Family::Wan, Some(WanKind::Ti2v)) => need(
                "the Wan 2.2 VAE (wan2.2_vae.safetensors)",
                &["wan2.2_vae", "wan_2.2_vae"],
            ),
            _ => self.vae(),
        }
    }

    /// The sampler and scheduler of ComfyUI's template for the family. The user's scheduler choice is for the SD family
    /// (several of its samplers are not meant for flow models), so it is not used here.
    pub fn sampling(self) -> (&'static str, &'static str) {
        match self {
            Family::Anima | Family::Flux | Family::QwenImage => ("euler", "simple"),
            Family::Chroma => ("euler", "beta"),
            Family::ZImage => ("res_multistep", "simple"),
            Family::Sd3 => ("euler", "sgm_uniform"),
            Family::Hidream => ("uni_pc", "simple"),
            Family::Auraflow => ("euler", "normal"),
            Family::Wan => ("uni_pc", "simple"),
            Family::HunyuanVideo => ("euler", "simple"),
            Family::Ltx => ("euler", "normal"),
            Family::Flux2 | Family::HunyuanVideo15 | Family::HunyuanImage => ("euler", "simple"),
            Family::Ltx2 => ("euler_ancestral", "normal"),
        }
    }

    /// Whether a picture of the family runs the user's scheduler setting instead of the template's own sampler and
    /// scheduler. Anima does: the setting starts at its template's, and the user may choose another.
    pub fn follows_scheduler_setting(self) -> bool {
        self == Family::Anima
    }

    /// The sampler and scheduler of the setting `name` for a family that follows it. For Anima, `euler` stays what its
    /// template runs (euler with the `simple` scheduler): pictures made before the choice existed recorded `euler`,
    /// and drawn again they must run the same.
    pub fn sampling_for(self, name: &str) -> Option<(&'static str, &'static str)> {
        if self == Family::Anima && name == "euler" {
            return Some(self.sampling());
        }
        super::graph::sampler_for(name)
    }

    /// The sampler and scheduler a picture of the family is drawn with, as recorded with it: `sampling`, except FLUX.2,
    /// whose graph takes its sigmas from `Flux2Scheduler`. The frontend's copy is checked against this through
    /// `contract/family-sampling.json`.
    pub fn picture_sampling(self) -> (&'static str, &'static str) {
        match self {
            Family::Flux2 => ("euler", "Flux2Scheduler"),
            _ => self.sampling(),
        }
    }

    /// The empty latent node (Anima and AuraFlow take the plain one, the others the SD3 one).
    pub fn latent(self) -> &'static str {
        match self {
            Family::Anima | Family::Auraflow => "EmptyLatentImage",
            Family::HunyuanImage => "EmptyHunyuanImageLatent",
            _ => "EmptySD3LatentImage",
        }
    }

    /// Flux is distilled: the strength is a guidance value on the prompt, the sampler runs at CFG 1 and there is no
    /// negative prompt.
    pub fn distilled(self) -> bool {
        self == Family::Flux
    }
}

/// The sampling a picture job with `model` runs when it is the family's own rather than the `scheduler` setting: a main or
/// diffusion model of a picture family in a mode the picture graph draws (`graph::build` and `variants::build`).
/// `None` for the SD family, whose sampler is the setting, and for the jobs other graphs run.
pub fn fixed_sampling(model: &ModelConfig, mode: GenerationMode) -> Option<Sampling> {
    let drawn = matches!(
        mode,
        GenerationMode::Txt2img
            | GenerationMode::Img2img
            | GenerationMode::Inpaint
            | GenerationMode::Outpaint
            | GenerationMode::Upscale
            | GenerationMode::Workflow
    );
    if !drawn || !matches!(model.kind, ModelType::DiffusionModel | ModelType::Main) {
        return None;
    }
    let family = Family::of(model.base)?;
    if family.follows_scheduler_setting() {
        return None;
    }
    let (sampler, scheduler) = family.picture_sampling();
    Some(Sampling {
        sampler: sampler.into(),
        scheduler: scheduler.into(),
    })
}

/// Whether a lower-case file name carries a word of a [`Need`]. A word that is a whole file name (`ae.safetensors`) must
/// match the whole name, so `bae.safetensors` is not an `ae`.
pub fn name_has(name: &str, word: &str) -> bool {
    let file = name.rsplit(['\\', '/']).next().unwrap_or(name);
    if word.starts_with("ae.") {
        file == word
    } else {
        name.contains(word)
    }
}

/// The installed model of `kind` whose name carries one of the words (earlier words win) and none of the avoided ones.
pub fn pick<'a>(
    models: &'a [ModelConfig],
    kind: ModelType,
    need: &Need,
) -> Option<&'a ModelConfig> {
    let name_of = |m: &ModelConfig| {
        m.comfy
            .as_ref()
            .map(|c| c.name.to_ascii_lowercase())
            .unwrap_or_default()
    };
    let hit = name_has;
    need.words.iter().find_map(|w| {
        models
            .iter()
            .filter(|m| m.kind == kind && m.comfy.is_some())
            .find(|m| {
                let name = name_of(m);
                hit(&name, w) && !need.avoid.iter().any(|a| name.contains(a))
            })
    })
}

pub(super) fn link(node: &str, slot: u32) -> Value {
    json!([node, slot])
}

/// A GGUF file (a quantised model) loads through the nodes of the ComfyUI-GGUF custom node pack.
pub fn is_gguf(name: &str) -> bool {
    name.to_ascii_lowercase().ends_with(".gguf")
}

/// The loader of a diffusion model from `diffusion_models`: ComfyUI's own, or the GGUF pack's for a `.gguf` file.
pub(super) fn unet_loader(g: &mut Builder, name: &str, weight_dtype: &str) -> Value {
    let id = if is_gguf(name) {
        g.add("UnetLoaderGGUF", json!({ "unet_name": name }))
    } else {
        g.add(
            "UNETLoader",
            json!({ "unet_name": name, "weight_dtype": weight_dtype }),
        )
    };
    link(&id, 0)
}

/// The text encoder loader of a family, from the files picked for it. When any is a GGUF file the loaders of the GGUF
/// pack read all of them (they take plain files too).
pub(super) fn text_encoder(g: &mut Builder, f: Family, files: &[ComfyRef]) -> Value {
    let names: Vec<&str> = files.iter().map(|e| e.name.as_str()).collect();
    let gguf = names.iter().any(|n| is_gguf(n));
    let pick = |plain: &str, packed: &str| {
        if gguf {
            packed.to_string()
        } else {
            plain.to_string()
        }
    };
    // The GGUF loaders have no `device` input.
    let with_device = |mut inputs: Value| {
        if !gguf {
            inputs["device"] = json!("default");
        }
        inputs
    };
    let id = match (f, names.as_slice()) {
        (Family::Flux, [a, b]) => g.add(
            &pick("DualCLIPLoader", "DualCLIPLoaderGGUF"),
            with_device(json!({ "clip_name1": a, "clip_name2": b, "type": "flux" })),
        ),
        (Family::HunyuanVideo, [a, b]) => g.add(
            &pick("DualCLIPLoader", "DualCLIPLoaderGGUF"),
            with_device(json!({ "clip_name1": a, "clip_name2": b, "type": "hunyuan_video" })),
        ),
        (Family::HunyuanVideo15, [a, b]) => g.add(
            &pick("DualCLIPLoader", "DualCLIPLoaderGGUF"),
            with_device(json!({ "clip_name1": a, "clip_name2": b, "type": "hunyuan_video_15" })),
        ),
        (Family::HunyuanImage, [a, b]) => g.add(
            &pick("DualCLIPLoader", "DualCLIPLoaderGGUF"),
            with_device(json!({ "clip_name1": a, "clip_name2": b, "type": "hunyuan_image" })),
        ),
        (Family::Sd3, [a, b, c]) => g.add(
            &pick("TripleCLIPLoader", "TripleCLIPLoaderGGUF"),
            json!({ "clip_name1": a, "clip_name2": b, "clip_name3": c }),
        ),
        (Family::Hidream, [a, b, c, d]) => g.add(
            &pick("QuadrupleCLIPLoader", "QuadrupleCLIPLoaderGGUF"),
            json!({ "clip_name1": a, "clip_name2": b, "clip_name3": c, "clip_name4": d }),
        ),
        (_, [a, ..]) => {
            let kind = match f {
                Family::Chroma => "chroma",
                Family::QwenImage => "qwen_image",
                Family::ZImage => "lumina2",
                Family::Wan => "wan",
                Family::Ltx => "ltxv",
                Family::Flux2 => "flux2",
                // Anima's Qwen3 0.6B and AuraFlow's Pile-T5 are told apart by ComfyUI from their weights.
                _ => "stable_diffusion",
            };
            g.add(
                &pick("CLIPLoader", "CLIPLoaderGGUF"),
                with_device(json!({ "clip_name": a, "type": kind })),
            )
        }
        // `check` has refused a job without its encoders.
        (_, []) => unreachable!("no text encoder"),
    };
    link(&id, 0)
}

/// A custom node pack some graphs need, which the user installs from the Extensions screen.
pub struct PackNeeded {
    pub node: String,
    pub what: &'static str,
    pub pack: &'static str,
    pub address: &'static str,
}

/// The pack nodes `prompt` uses (ComfyUI-GGUF's loaders, the seamless tiling nodes, the manga finish), one entry per node.
pub fn packs_needed(prompt: &Value) -> Vec<PackNeeded> {
    let mut found: Vec<PackNeeded> = Vec::new();
    for node in prompt.as_object().into_iter().flat_map(|n| n.values()) {
        let Some(class) = node["class_type"].as_str() else {
            continue;
        };
        let (what, pack, address) = if class.ends_with("GGUF") {
            (
                "GGUF models",
                "ComfyUI-GGUF",
                "https://github.com/city96/ComfyUI-GGUF",
            )
        } else if matches!(class, "SeamlessTile" | "CircularVAEDecode") {
            (
                "Seamless tiling",
                "ComfyUI-seamless-tiling",
                "https://github.com/spinagon/ComfyUI-seamless-tiling",
            )
        } else if class == super::graph::MANGA_NODE {
            (
                "The manga finish",
                "ComfyUI-MangaScreen",
                "https://github.com/ashukae/ComfyUI-MangaScreen",
            )
        } else {
            continue;
        };
        if !found.iter().any(|f| f.node == class) {
            found.push(PackNeeded {
                node: class.to_string(),
                what,
                pack,
                address,
            });
        }
    }
    found.sort_by(|a, b| a.node.cmp(&b.node));
    found
}

/// The nodes of the ComfyUI-GGUF pack that `prompt` uses.
pub fn gguf_nodes(prompt: &Value) -> Vec<String> {
    packs_needed(prompt)
        .into_iter()
        .filter(|p| p.pack == "ComfyUI-GGUF")
        .map(|p| p.node)
        .collect()
}

/// What the picture graph cannot do with these families, refused with a reason.
pub(super) fn check(input: &GraphInput<'_>, split: &SplitJob) -> Result<(), String> {
    let f = split.family;
    if let Variant::Unsupported(reason) = split.variant {
        return Err(format!("{}: {reason}", f.label()));
    }
    if !input.guidance.refs.is_empty() {
        return Err(format!(
            "Reference images (IP-Adapter) work with SD 1.5 and SDXL models only, not with {}",
            f.label()
        ));
    }
    if !input.guidance.references.is_empty() && f != Family::Flux2 {
        return Err(format!(
            "Reference pictures are taken in by FLUX.2 models only, not by {}",
            f.label()
        ));
    }
    let needs_encoders = !matches!(split.loader, Loader::Checkpoint { clip: true, .. });
    if needs_encoders && split.text_encoders.len() != f.encoders().len() {
        return Err(format!(
            "{} needs {} text encoder file(s)",
            f.label(),
            f.encoders().len()
        ));
    }
    let needs_vae = !matches!(split.loader, Loader::Checkpoint { vae: true, .. });
    if needs_vae && input.vae.is_none() {
        return Err(format!("{} needs {}", f.label(), f.vae().what));
    }
    Ok(())
}

/// The model, text encoder and VAE outputs, from the family's loaders.
pub(super) fn load(
    g: &mut Builder,
    input: &GraphInput<'_>,
    split: &SplitJob,
) -> (Value, Value, Value) {
    let f = split.family;
    let (model, bundled_clip, bundled_vae) = match split.loader {
        Loader::Unet => (
            unet_loader(g, &input.checkpoint.name, "default"),
            None,
            None,
        ),
        Loader::Checkpoint { clip, vae } => {
            let id = g.add(
                "CheckpointLoaderSimple",
                json!({ "ckpt_name": input.checkpoint.name }),
            );
            (
                link(&id, 0),
                clip.then(|| link(&id, 1)),
                vae.then(|| link(&id, 2)),
            )
        }
    };
    let clip = bundled_clip.unwrap_or_else(|| text_encoder(g, f, &split.text_encoders));
    // A chosen VAE wins over the one a checkpoint carries.
    let vae = match input.vae {
        Some(v) => link(&g.add("VAELoader", json!({ "vae_name": v.name })), 0),
        None => bundled_vae.expect("`check` refuses a job without a VAE"),
    };
    (model, clip, vae)
}

/// The family's flow shift, after the LoRAs (as in ComfyUI's templates).
pub(super) fn patch_model(g: &mut Builder, f: Family, model: Value) -> Value {
    let (node, shift) = match f {
        Family::Chroma => ("ModelSamplingAuraFlow", 1.0),
        Family::QwenImage => ("ModelSamplingAuraFlow", 3.1),
        Family::ZImage => ("ModelSamplingAuraFlow", 3.0),
        Family::Auraflow => ("ModelSamplingAuraFlow", 1.73),
        Family::Hidream => ("ModelSamplingSD3", 3.0),
        // Anima, Flux and SD3 have none; the video families set their own in `video_families.rs`.
        Family::Anima
        | Family::Flux
        | Family::Flux2
        | Family::HunyuanImage
        | Family::Sd3
        | Family::Wan
        | Family::HunyuanVideo
        | Family::HunyuanVideo15
        | Family::Ltx
        | Family::Ltx2 => return model,
    };
    link(&g.add(node, json!({ "model": model, "shift": shift })), 0)
}

/// ComfyUI's folder of model patches.
pub const MODEL_PATCHES: &str = "model_patches";

/// A control layer whose model is a model patch (`model_patches`): Anima's LLLite, the Qwen-Image block-wise and
/// Z-Image Fun ControlNets. They change the model instead of the prompt. `strength` is the weight and the start and end
/// of the effect; `None` when the family has no such patch.
pub(super) fn apply_patch(
    g: &mut Builder,
    f: Family,
    patch: &ComfyRef,
    model: Value,
    vae: &Value,
    image: Value,
    (strength, start, end): (f64, f64, f64),
) -> Option<Value> {
    let node = match f {
        Family::Anima => "AnimaLLLiteApply",
        Family::QwenImage | Family::ZImage => "QwenImageDiffsynthControlnet",
        _ => return None,
    };
    let loader = g.add("ModelPatchLoader", json!({ "name": patch.name }));
    let mut inputs = json!({ "model": model, "model_patch": link(&loader, 0), "image": image, "strength": strength, "start_percent": start, "end_percent": end });
    if node == "QwenImageDiffsynthControlnet" {
        inputs["vae"] = vae.clone();
    }
    Some(link(&g.add(node, inputs), 0))
}

#[cfg(test)]
mod tests;
