//! Guessing a model's type and base from its safetensors header (tensor names and `__metadata__`).
//! Only the header is read, never the weights.
use super::header_scan;
use crate::types::{BaseModel, ModelFormat, ModelType};
use serde_json::{Map, Value};
use std::io::Read;
use std::path::Path;

const MAX_HEADER: u64 = 64 * 1024 * 1024;

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Header {
    pub keys: Vec<String>,
    pub metadata: Map<String, Value>,
    /// The shapes of the few tensors that tell variants of a family apart (the patch embedding of a video model).
    pub shapes: std::collections::HashMap<String, Vec<u64>>,
}

/// Tensors whose shape is kept: where a model's input channels show what it is made for.
fn keeps_shape(key: &str) -> bool {
    key.ends_with("patch_embedding.weight")
        || key.ends_with("img_in.proj.weight")
        || bare(key) == "img_in.weight"
        || bare(key) == "txt_in.weight"
}

/// The header of a safetensors file from its JSON bytes. The names are in the order of a `serde_json::Map` of the
/// header with `__metadata__` removed from it (that removal moves the last name into its place).
pub fn parse_header(bytes: &[u8]) -> Option<Header> {
    let entries = header_scan::scan(bytes, keeps_shape)?;
    if entries.has_duplicates() {
        return parse_header_tree(bytes);
    }
    let mut names = entries.names;
    let shapes = entries
        .kept
        .into_iter()
        .filter_map(|(at, v)| Some((names[at].clone(), shape_of(&v)?)))
        .collect();
    let metadata = match entries.metadata {
        Some((at, value)) => {
            names.swap_remove(at);
            match value {
                Value::Object(m) => m,
                _ => Map::new(),
            }
        }
        None => Map::new(),
    };
    Some(Header {
        keys: names,
        metadata,
        shapes,
    })
}

fn shape_of(tensor: &Value) -> Option<Vec<u64>> {
    let dims = tensor["shape"].as_array()?;
    Some(dims.iter().filter_map(Value::as_u64).collect())
}

/// `parse_header` through a whole JSON tree: for a header that names a tensor twice, where the map's rule (the last
/// value, at the first place) decides.
fn parse_header_tree(bytes: &[u8]) -> Option<Header> {
    let mut map: Map<String, Value> = serde_json::from_slice(bytes).ok()?;
    let metadata = match map.remove(header_scan::METADATA) {
        Some(Value::Object(m)) => m,
        _ => Map::new(),
    };
    let shapes = map
        .iter()
        .filter(|(k, _)| keeps_shape(k))
        .filter_map(|(k, v)| Some((k.clone(), shape_of(v)?)))
        .collect();
    Some(Header {
        keys: map.into_iter().map(|(k, _)| k).collect(),
        metadata,
        shapes,
    })
}

pub fn read_header(path: &Path) -> Option<Header> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    if ext != "safetensors" && ext != "sft" {
        return None;
    }
    read_header_unchecked(path)
}

/// Like [`read_header`] but without the extension check (for partial downloads).
pub fn read_header_unchecked(path: &Path) -> Option<Header> {
    let mut f = std::fs::File::open(path).ok()?;
    let mut len = [0u8; 8];
    f.read_exact(&mut len).ok()?;
    let len = u64::from_le_bytes(len);
    if len == 0 || len > MAX_HEADER {
        return None;
    }
    let mut buf = vec![0u8; len as usize];
    f.read_exact(&mut buf).ok()?;
    parse_header(&buf)
}

fn any_key(h: &Header, pred: impl Fn(&str) -> bool) -> bool {
    h.keys.iter().any(|k| pred(k))
}

/// `k` without the wrapper a checkpoint or a trainer puts around a model's own tensor names.
fn bare(k: &str) -> &str {
    for p in ["model.diffusion_model.", "diffusion_model.", "transformer."] {
        if let Some(r) = k.strip_prefix(p) {
            return r;
        }
    }
    k
}

/// Whether a tensor name has `part` as a whole path segment run (`double_blocks.` in `a.double_blocks.0.x`).
fn has_part(k: &str, part: &str) -> bool {
    k.starts_with(part) || k.contains(&format!(".{part}"))
}

fn any_part(h: &Header, part: &str) -> bool {
    any_key(h, |k| has_part(k, part))
}

/// The family of a diffusion transformer, read from the tensor names it is made of. The names are the ones the models
/// carry in ComfyUI's own files; a LoRA made for the model repeats them, so this tells a LoRA's family too.
pub fn detect_architecture(h: &Header) -> Option<BaseModel> {
    // Kohya-style LoRA names join the segments with `_`, so this one is matched without a dot.
    if any_key(h, |k| k.contains("llm_adapter")) {
        return Some(BaseModel::Anima);
    }
    // Hunyuan-DiT: its text projection for the mT5 encoder.
    if any_part(h, "mlp_t5.") {
        return Some(BaseModel::HunyuanDit);
    }
    if any_part(h, "txt_in.individual_token_refiner.") {
        // HunyuanImage 2.1 shares the token refiner but patches a picture, not a video: a 2D patch.
        if h.shapes
            .iter()
            .any(|(k, s)| bare(k).ends_with("img_in.proj.weight") && s.len() == 4)
        {
            return Some(BaseModel::HunyuanImage);
        }
        // Version 1.5 has the vision and byte-T5 inputs that 1.0 lacks.
        let v15 = any_part(h, "vision_in.")
            || any_part(h, "byt5_in.")
            || any_part(h, "cond_type_embedding.");
        return Some(if v15 {
            BaseModel::HunyuanVideo15
        } else {
            BaseModel::HunyuanVideo
        });
    }
    if any_part(h, "double_stream_blocks.") {
        return Some(BaseModel::Hidream);
    }
    // FLUX.2 shares Flux's block names; its modulation tensors are its own.
    if any_part(h, "double_stream_modulation_img.") {
        return Some(BaseModel::Flux2);
    }
    if any_part(h, "distilled_guidance_layer.") {
        return Some(BaseModel::Chroma);
    }
    if any_part(h, "double_blocks.") && any_part(h, "single_blocks.") {
        return Some(BaseModel::Flux);
    }
    if any_part(h, "double_layers.") || any_part(h, "single_layers.") {
        return Some(BaseModel::Auraflow);
    }
    if any_part(h, "joint_blocks.") {
        return Some(BaseModel::Sd3);
    }
    if any_part(h, "noise_refiner.") || any_part(h, "cap_embedder.") {
        return Some(BaseModel::ZImage);
    }
    if any_part(h, "transformer_blocks.")
        && any_key(h, |k| k.contains(".img_mod.") || k.contains(".txt_mlp."))
    {
        return Some(BaseModel::QwenImage);
    }
    // LTX-2 makes sound too: it has the audio streams LTX-Video lacks.
    if any_part(h, "audio_adaln_single.") || any_part(h, "audio_patchify_proj.") {
        return Some(BaseModel::Ltx2);
    }
    if any_part(h, "patchify_proj.")
        || (any_part(h, "transformer_blocks.") && any_part(h, "adaln_single."))
    {
        return Some(BaseModel::LtxVideo);
    }
    if any_key(h, |k| {
        let k = bare(k);
        k.starts_with("blocks.") && k.contains(".self_attn.")
    }) {
        return Some(BaseModel::Wan);
    }
    None
}

/// Cosmos-style blocks without Anima's adapter (Cosmos-Predict2 itself): a diffusion model with no family of its own here.
fn is_cosmos(h: &Header) -> bool {
    any_key(h, |k| {
        k.contains("blocks.") && k.contains("adaln_modulation_self_attn")
    })
}

/// The family of a LoRA from the tensors it changes. An Anima LoRA that leaves the LLM adapter alone carries only the
/// Cosmos blocks (`adaln_modulation_self_attn`); Cosmos-Predict2 itself does not run here, so those are Anima's. They are
/// matched before `detect_architecture`, whose Wan rule (`blocks.N.self_attn.`) they would meet too.
fn lora_architecture(h: &Header) -> Option<BaseModel> {
    if any_key(h, |k| k.contains("adaln_modulation_self_attn")) {
        return Some(BaseModel::Anima);
    }
    detect_architecture(h)
}

/// A text encoder saved on its own: T5 and UMT5, the decoder-only language models (Qwen, Gemma, Llama), CLIP's text tower.
fn is_text_encoder(h: &Header) -> bool {
    any_key(h, |k| {
        k.starts_with("encoder.block.")
            || k.starts_with("text_model.encoder.layers.")
            || k.starts_with("transformer.text_model.")
            || k.starts_with("text_model.embeddings.")
    }) || (any_key(h, |k| {
        k.starts_with("model.layers.") || k.starts_with("layers.")
    }) && any_key(h, |k| {
        k == "model.embed_tokens.weight" || k == "embed_tokens.weight"
    }))
}

fn is_lora(h: &Header) -> bool {
    any_key(h, |k| {
        k.starts_with("lora_")
            || k.contains(".lora_down.")
            || k.contains(".lora_A.")
            || k.contains(".lora_B.")
            || k.contains(".lora_up.")
            || k.contains(".lokr_w")
            || k.contains(".hada_w")
            || k.contains(".lora_magnitude_vector")
            || k.starts_with("lycoris_")
    })
}

/// The input channels of a diffusion transformer's patch embedding (`None` when the file has no such tensor).
fn in_channels(h: &Header, suffix: &str) -> Option<u64> {
    // The whole last segment run must match: VACE has `vace_patch_embedding.weight` beside `patch_embedding.weight`.
    h.shapes
        .iter()
        .find(|(k, _)| *k == suffix || k.ends_with(&format!(".{suffix}")))
        .and_then(|(_, s)| s.get(1).copied())
}

/// The input columns of Flux's image embedding: 64 for the plain models and Kontext, 384 for Fill (the picture's
/// latent and the mask come in beside the noise), 128 times four for the Canny and Depth models.
pub fn flux_in_columns(h: &Header) -> Option<u64> {
    h.shapes
        .iter()
        .find(|(k, _)| bare(k) == "img_in.weight")
        .and_then(|(_, s)| s.get(1).copied())
}

/// A model of a known family that is made for something other than plain drawing or filming. The graph differs per
/// variant, and a plain graph with such a file draws garbage or fails, so they are told apart (from the tensors when
/// the file has a header, else from the name: a GGUF file has none we read).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Variant {
    Plain,
    /// Flux Fill: inpaints and outpaints with a mask; it does not draw from nothing.
    FluxFill,
    /// Flux Kontext: edits a picture by a prompt.
    FluxKontext,
    /// Qwen-Image-Edit: edits one picture by a prompt.
    QwenEdit,
    /// Qwen-Image-Edit 2509 and later: edits up to three pictures by a prompt.
    QwenEditPlus,
    /// Wan VACE: video from text, or from a reference picture, through its own conditioning node.
    WanVace,
    /// FLUX.2 dev (Mistral as the text encoder), and klein with Qwen3 4B or 8B.
    Flux2Dev,
    Flux2Klein4b,
    Flux2Klein9b,
    /// HunyuanVideo 1.5 image to video.
    Hy15I2v,
    /// HunyuanVideo (1.0) image to video: 33 input channels (the picture's latent and a mask beside the noise).
    HyI2v,
    /// Made for an input the graphs here do not give it (a control video, audio, a camera path...): what is missing.
    Unsupported(&'static str),
}

/// The input columns of FLUX.2's text embedding: the text encoder's hidden size times its three tapped layers (Mistral
/// 24B: 15360, Qwen3 4B: 7680, Qwen3 8B: 12288).
pub fn flux2_context(h: &Header) -> Option<u64> {
    h.shapes
        .iter()
        .find(|(k, _)| bare(k) == "txt_in.weight")
        .and_then(|(_, s)| s.get(1).copied())
}

/// The variant of a model of `base`. `header` is `None` for a file without a readable safetensors header (GGUF).
pub fn detect_variant(base: BaseModel, header: Option<&Header>, file_name: &str) -> Variant {
    let name = file_name
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(file_name)
        .to_ascii_lowercase();
    let has = |w: &str| name.contains(w);
    let key = |pred: &dyn Fn(&str) -> bool| header.is_some_and(|h| any_key(h, |k| pred(k)));
    match base {
        BaseModel::Flux => match header.and_then(flux_in_columns) {
            Some(384) => Variant::FluxFill,
            Some(512) => Variant::Unsupported(
                "this is a Flux Canny or Depth control model, which needs its control picture made by a preprocessor and a conditioning node that the picture graph does not have",
            ),
            _ if has("kontext") => Variant::FluxKontext,
            // Without a header (GGUF) the name is all there is.
            None if has("fill") => Variant::FluxFill,
            _ => Variant::Plain,
        },
        BaseModel::Flux2 => match header.and_then(flux2_context) {
            Some(7680) => Variant::Flux2Klein4b,
            Some(12288) => Variant::Flux2Klein9b,
            Some(15360) => Variant::Flux2Dev,
            _ if has("klein") && has("9b") => Variant::Flux2Klein9b,
            _ if has("klein") => Variant::Flux2Klein4b,
            _ => Variant::Flux2Dev,
        },
        BaseModel::HunyuanVideo => match header.and_then(hunyuan_in_channels) {
            Some(16) => Variant::Plain,
            Some(33) => Variant::HyI2v,
            Some(_) => Variant::Unsupported(
                "this is a HunyuanVideo model with an input layout the graphs do not know (SkyReels?)",
            ),
            None if has("i2v") || has("image_to_video") => Variant::HyI2v,
            None => Variant::Plain,
        },
        BaseModel::HunyuanVideo15 => {
            let kind = header
                .and_then(|h| h.metadata.get("model_type"))
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_ascii_lowercase();
            if kind.contains("_sr") || has("_sr_") {
                Variant::Unsupported(
                    "this is the super-resolution model, which enlarges a finished video; it does not make one",
                )
            } else if kind.contains("i2v") || has("i2v") {
                Variant::Hy15I2v
            } else {
                Variant::Plain
            }
        }
        BaseModel::QwenImage => {
            if has("layered") {
                Variant::Unsupported("this is Qwen-Image-Layered, which makes layers and needs its own graph")
            } else if has("edit") {
                if has("2509") || has("2511") || has("plus") {
                    Variant::QwenEditPlus
                } else {
                    Variant::QwenEdit
                }
            } else {
                Variant::Plain
            }
        }
        BaseModel::Wan => {
            let wan = |what: &'static str| Variant::Unsupported(what);
            if key(&|k| bare(k).starts_with("vace_patch_embedding.")) || has("vace") {
                Variant::WanVace
            } else if key(&|k| bare(k).starts_with("control_adapter.")) || has("camera") {
                wan("this is a Wan camera-control model, which needs a camera path")
            } else if key(&|k| bare(k).starts_with("casual_audio_encoder.")) || has("s2v") {
                wan("this is a Wan speech-to-video model, which needs an audio file")
            } else if key(&|k| bare(k).starts_with("audio_proj.")) || has("humo") {
                wan("this is a Wan HuMo model, which needs audio and reference pictures")
            } else if key(&|k| bare(k).starts_with("face_adapter.")) || has("animate") {
                wan("this is a Wan Animate model, which needs a pose video and a face video")
            } else if key(&|k| {
                let k = bare(k);
                k.starts_with("patch_embedding_pose.")
                    || k.starts_with("patch_embedding_mask.")
                    || k.starts_with("patch_embedding_global.")
            }) {
                wan("this is a Wan pose or dance model, which needs a pose video")
            } else if (has("fun") && has("control"))
                // Fun Control has 48 input channels like the 5B model, but it carries the image embedding the 5B lacks;
                // the 2.2 14B one has 52 channels and a `ref_conv`.
                || key(&|k| bare(k).starts_with("ref_conv."))
                || (header.and_then(wan_in_channels) == Some(48)
                    && key(&|k| bare(k).starts_with("img_emb.")))
            {
                wan("this is a Wan Fun Control model, which needs a control video")
            } else {
                Variant::Plain
            }
        }
        _ => Variant::Plain,
    }
}

/// Whether a Wan model carries the CLIP-vision image embedding (Wan 2.1 image to video), which takes a CLIP-vision
/// encoding of the start picture besides its latent.
pub fn wan_has_image_embedding(h: &Header) -> bool {
    any_key(h, |k| bare(k).starts_with("img_emb."))
}

/// What a Wan model is made for, from the channels of its patch embedding: 16 is a text-to-video model, 36 an
/// image-to-video one (the picture's latent and a mask come in beside the noise), 48 the 5B text-and-image model.
pub fn wan_in_channels(h: &Header) -> Option<u64> {
    in_channels(h, "patch_embedding.weight")
}

/// The input channels of HunyuanVideo's image embedding: 16 for text to video, 33 for the image-to-video model.
pub fn hunyuan_in_channels(h: &Header) -> Option<u64> {
    in_channels(h, "img_in.proj.weight")
}

/// Whether a checkpoint carries its own text encoders and its own VAE (SD3.5 and Flux checkpoints are made with and
/// without them).
pub fn bundled_parts(h: &Header) -> (bool, bool) {
    let clip = any_key(h, |k| {
        k.starts_with("text_encoders.")
            || k.starts_with("cond_stage_model.")
            || k.starts_with("conditioner.")
    });
    let vae = any_key(h, |k| {
        k.starts_with("first_stage_model.") || k.starts_with("vae.")
    });
    (clip, vae)
}

/// The family of a model patch, by the tensors ComfyUI's `ModelPatchLoader` recognises it from. `None`: not a patch.
pub fn patch_family(h: &Header) -> Option<BaseModel> {
    if any_key(h, |k| k.starts_with("lllite_")) {
        Some(BaseModel::Anima)
    } else if any_key(h, |k| k == "controlnet_blocks.0.y_rms.weight") {
        Some(BaseModel::QwenImage)
    } else if any_key(h, |k| k.starts_with("control_all_x_embedder.")) {
        Some(BaseModel::ZImage)
    } else {
        None
    }
}

/// The type a file holds, judged by its tensor names. `None` when nothing matches.
pub fn detect_kind(h: &Header) -> Option<ModelType> {
    if patch_family(h).is_some() {
        return Some(ModelType::ModelPatch);
    }
    if is_lora(h) {
        return Some(ModelType::Lora);
    }
    if any_key(h, |k| {
        k.starts_with("control_model.")
            || k.starts_with("controlnet_")
            || k.contains("input_hint_block")
            || k.contains("controlnet_cond_embedding")
    }) {
        return Some(ModelType::Controlnet);
    }
    if any_key(h, |k| {
        k.starts_with("image_proj.") || k.starts_with("ip_adapter.")
    }) {
        return Some(ModelType::IpAdapter);
    }
    // A checkpoint carries its own text encoders and VAE next to the diffusion model.
    if any_key(h, |k| {
        k.starts_with("conditioner.")
            || k.starts_with("first_stage_model.")
            || k.starts_with("cond_stage_model.")
            || k.starts_with("text_encoders.")
    }) {
        return Some(ModelType::Main);
    }
    // A model of the newer families with its VAE inside (LTX-Video's checkpoint) loads with `CheckpointLoaderSimple`,
    // which ComfyUI reads from `checkpoints` only.
    if detect_architecture(h).is_some() && any_key(h, |k| k.starts_with("vae.")) {
        return Some(ModelType::Main);
    }
    // A diffusion transformer on its own (Flux, Wan, Anima, Qwen-Image and the like) loads from `diffusion_models`.
    if detect_architecture(h).is_some() || is_cosmos(h) {
        return Some(ModelType::DiffusionModel);
    }
    if any_key(h, |k| k.starts_with("model.diffusion_model.")) {
        return Some(ModelType::Main);
    }
    if any_key(h, |k| {
        k.starts_with("vision_model.") || k.starts_with("visual.transformer.")
    }) {
        return Some(ModelType::ClipVision);
    }
    if is_text_encoder(h) {
        return Some(ModelType::TextEncoder);
    }
    let vae_pair = |enc: &str, dec: &str| {
        any_key(h, |k| k.starts_with(enc)) && any_key(h, |k| k.starts_with(dec))
    };
    if vae_pair("encoder.down.", "decoder.up.")
        || vae_pair("encoder.down_blocks.", "decoder.up_blocks.")
        || vae_pair("encoder.downsamples.", "decoder.upsamples.")
        || vae_pair("encoder.conv1.", "decoder.conv1.")
    {
        return Some(ModelType::Vae);
    }
    // ESRGAN-family upscalers saved as safetensors.
    if any_key(h, |k| k.contains("RRDB_trunk.") || k.contains(".rdb1."))
        || (any_key(h, |k| k.starts_with("conv_first."))
            && any_key(h, |k| k.starts_with("conv_last.")))
    {
        return Some(ModelType::SpandrelImageToImage);
    }
    None
}

fn base_from_metadata(h: &Header) -> Option<BaseModel> {
    let text = |k: &str| {
        h.metadata
            .get(k)
            .and_then(Value::as_str)
            .map(str::to_ascii_lowercase)
    };
    if let Some(arch) = text("modelspec.architecture") {
        if arch.starts_with("stable-diffusion-xl") {
            return Some(BaseModel::Sdxl);
        }
        if arch.starts_with("stable-diffusion-v1") {
            return Some(BaseModel::Sd1);
        }
        if arch.starts_with("stable-diffusion-v2") {
            return Some(BaseModel::Sd2);
        }
        if arch.starts_with("stable-diffusion-v3") {
            return Some(BaseModel::Sd3);
        }
        if arch.starts_with("flux") {
            return Some(BaseModel::Flux);
        }
        if let Some(b) = base_from_words(&arch) {
            return Some(b);
        }
    }
    let v = text("ss_base_model_version")?;
    if v.starts_with("sdxl") {
        Some(BaseModel::Sdxl)
    } else if v.starts_with("sd_v1") {
        Some(BaseModel::Sd1)
    } else if v.starts_with("sd_v2") {
        Some(BaseModel::Sd2)
    } else if v.starts_with("flux") {
        Some(BaseModel::Flux)
    } else {
        base_from_words(&v)
    }
}

/// The newer families, by the words their files are named with.
fn base_from_words(name: &str) -> Option<BaseModel> {
    let n = name.to_ascii_lowercase();
    let word = |w: &str| n.contains(w);
    // HunyuanImage first: "hunyuanimage" holds "anima". Its VAE says its family only in its name; without it the VAE
    // was offered with every main model.
    Some(
        if word("hunyuanimage") || word("hunyuan_image") || word("hunyuan-image") {
            BaseModel::HunyuanImage
        } else if word("anima") {
            BaseModel::Anima
        } else if word("chroma") {
            BaseModel::Chroma
        } else if word("qwen-image") || word("qwen_image") || word("qwenimage") {
            BaseModel::QwenImage
        } else if word("z-image") || word("z_image") || word("zimage") {
            BaseModel::ZImage
        } else if word("hidream") {
            BaseModel::Hidream
        } else if word("auraflow") || word("aura_flow") || word("aura-flow") {
            BaseModel::Auraflow
        } else if word("hunyuanvideo") || word("hunyuan_video") || word("hunyuan-video") {
            BaseModel::HunyuanVideo
        } else if word("ltx") {
            BaseModel::LtxVideo
        } else if n.starts_with("wan")
            || word("/wan")
            || word("_wan")
            || word("-wan")
            || word("wan2")
        {
            BaseModel::Wan
        } else {
            return None;
        },
    )
}

fn base_from_name(file_name: &str) -> BaseModel {
    let n = file_name.to_ascii_lowercase();
    if n.contains("flux") {
        BaseModel::Flux
    } else if let Some(b) = base_from_words(&n) {
        b
    } else if n.contains("xl")
        || n.contains("illustrious")
        || n.contains("pony")
        || n.contains("noob")
    {
        BaseModel::Sdxl
    } else if n.contains("sd15") || n.contains("sd1.5") || n.contains("v1-5") || n.contains("sd-1")
    {
        BaseModel::Sd1
    } else {
        BaseModel::Any
    }
}

/// The kind of a file whose header says nothing: a `.pth` is an upscaler, a `.gguf` a quantised diffusion model, and
/// otherwise the words of its name (`lora`, `vae`, `umt5`...) decide.
pub fn kind_from_name(file_name: &str) -> Option<ModelType> {
    let name = file_name.rsplit(['\\', '/']).next().unwrap_or(file_name);
    let name = name.to_ascii_lowercase();
    if name.ends_with(".pth") {
        return Some(ModelType::SpandrelImageToImage);
    }
    if name.ends_with(".gguf") {
        // A GGUF text encoder is named so; anything else is a quantised diffusion model.
        return Some(if has_encoder_word(&name) {
            ModelType::TextEncoder
        } else {
            ModelType::DiffusionModel
        });
    }
    // The header said nothing, so the words in the name are the last evidence (the user can still choose the kind).
    let stem = name.rsplit_once('.').map_or(name.as_str(), |(s, _)| s);
    if name.contains("lora") || name.contains("lokr") || name.contains("locon") {
        Some(ModelType::Lora)
    } else if name.contains("controlnet") {
        Some(ModelType::Controlnet)
    } else if name.contains("vae") || stem == "ae" {
        Some(ModelType::Vae)
    } else if has_encoder_word(&name) {
        Some(ModelType::TextEncoder)
    } else if name.contains("upscale") || name.contains("esrgan") {
        Some(ModelType::SpandrelImageToImage)
    } else {
        None
    }
}

fn has_encoder_word(name: &str) -> bool {
    [
        "text_encoder",
        "text-encoder",
        "umt5",
        "t5xxl",
        "t5-xxl",
        "t5_xxl",
        // City96's GGUF build is named `t5-v1_1-xxl-encoder-Q8_0.gguf`.
        "t5-v1",
        "t5_v1",
        "pile-t5",
        "pile_t5",
        "-encoder-",
        "qwen_3",
        "qwen3",
        "qwen_2",
        "qwen2",
        "clip_l",
        "clip_g",
        "clip-l",
        "gemma",
        "llama",
    ]
    .iter()
    .any(|w| name.contains(w))
}

/// The model family. Header evidence first, then `__metadata__`, then the file name.
pub fn detect_base(kind: ModelType, header: Option<&Header>, file_name: &str) -> BaseModel {
    if matches!(
        kind,
        ModelType::SpandrelImageToImage | ModelType::ClipVision | ModelType::TextEncoder
    ) {
        return BaseModel::Any;
    }
    // A standalone diffusion model is of the family its tensors (or, for a GGUF, its name) say, else of none.
    if kind == ModelType::DiffusionModel {
        return header
            .and_then(detect_architecture)
            .or_else(|| base_from_words(file_name))
            .unwrap_or(BaseModel::Any);
    }
    let Some(h) = header else {
        return base_from_name(file_name);
    };
    if kind == ModelType::ModelPatch {
        return patch_family(h).unwrap_or(BaseModel::Any);
    }
    // A LoRA's tensors name the model it was trained on, and a trainer may write the wrong architecture (sd-scripts'
    // Anima trainer writes `stable-diffusion-v1/lora`), so a newer family's tensors win over the metadata.
    if kind == ModelType::Lora {
        if let Some(b) = lora_architecture(h) {
            return b;
        }
    }
    if let Some(b) = base_from_metadata(h) {
        return b;
    }
    let from_keys = match kind {
        ModelType::Main => {
            if any_key(h, |k| k.starts_with("conditioner.embedders.1")) {
                Some(BaseModel::Sdxl)
            } else if any_key(h, |k| k.contains("joint_blocks.")) {
                Some(BaseModel::Sd3)
            } else if any_key(h, |k| k.contains("double_stream_modulation_img.")) {
                Some(BaseModel::Flux2)
            } else if any_key(h, |k| k.contains("double_blocks.")) {
                Some(BaseModel::Flux)
            } else if any_key(h, |k| k.starts_with("cond_stage_model.model.transformer")) {
                Some(BaseModel::Sd2)
            } else if any_key(h, |k| {
                k.starts_with("cond_stage_model.transformer")
                    || k.starts_with("model.diffusion_model.input_blocks")
            }) {
                Some(BaseModel::Sd1)
            } else {
                // A checkpoint of a newer family (AuraFlow's carries `model.double_layers`).
                detect_architecture(h)
            }
        }
        ModelType::Lora => {
            if any_key(h, |k| {
                k.contains("double_blocks")
                    || k.contains("single_blocks")
                    || k.starts_with("transformer.")
            }) {
                Some(BaseModel::Flux)
            } else if any_key(h, |k| {
                k.starts_with("lora_te2_")
                    || k.starts_with("lora_unet_input_blocks")
                    || k.starts_with("lora_unet_output_blocks")
                    || k.starts_with("text_encoder_2.")
            }) {
                Some(BaseModel::Sdxl)
            } else if any_key(h, |k| {
                k.starts_with("lora_unet_down_blocks") || k.starts_with("lora_te_")
            }) {
                Some(BaseModel::Sd1)
            } else {
                None
            }
        }
        ModelType::Controlnet => {
            if any_key(h, |k| {
                k.contains("label_emb") || k.contains("add_embedding")
            }) {
                Some(BaseModel::Sdxl)
            } else {
                None
            }
        }
        _ => None,
    };
    from_keys.unwrap_or_else(|| base_from_name(file_name))
}

pub fn detect_format(kind: ModelType, path: &Path) -> ModelFormat {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match (kind, ext.as_str()) {
        (_, "gguf") => ModelFormat::Gguf,
        (ModelType::Lora, _) => ModelFormat::Lycoris,
        _ => ModelFormat::Checkpoint,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn header(keys: &[&str], meta: Value) -> Header {
        let mut m = Map::new();
        for k in keys {
            m.insert(
                k.to_string(),
                json!({ "dtype": "F16", "shape": [1], "data_offsets": [0, 2] }),
            );
        }
        m.insert("__metadata__".into(), meta);
        parse_header(&serde_json::to_vec(&m).unwrap()).unwrap()
    }

    #[test]
    fn a_header_reads_the_same_in_one_pass_as_through_a_json_tree() {
        let tensor = r#"{"dtype":"F16","shape":[16,3,1,2,2],"data_offsets":[0,2]}"#;
        let cases = [
            // `__metadata__` first, in the middle, last, missing, not an object.
            format!(
                r#"{{"__metadata__":{{"a":"1"}},"x.weight":{tensor},"patch_embedding.weight":{tensor},"y":{tensor}}}"#
            ),
            format!(r#"{{"x":{tensor},"__metadata__":{{}},"y":{tensor},"z":{tensor}}}"#),
            format!(r#"{{"x":{tensor},"y":{tensor},"__metadata__":{{"k":[1,{{"n":null}}]}}}}"#),
            format!(r#"{{"x":{tensor},"img_in.weight":{{"shape":"wide"}}}}"#),
            format!(r#"{{"__metadata__":7,"txt_in.weight":{tensor}}}"#),
            // A name twice (the map keeps the last value at the first place), `__metadata__` twice.
            format!(
                r#"{{"patch_embedding.weight":{tensor},"x":1,"patch_embedding.weight":{{"shape":[2]}}}}"#
            ),
            r#"{"__metadata__":{"a":"1"},"x":1,"__metadata__":3,"y":2}"#.to_string(),
            r#"{}"#.to_string(),
        ];
        for text in &cases {
            let fast = parse_header(text.as_bytes());
            assert!(fast.is_some(), "{text}");
            assert_eq!(fast, parse_header_tree(text.as_bytes()), "{text}");
        }
        let moved = parse_header(cases[1].as_bytes()).unwrap();
        assert_eq!(
            moved.keys,
            ["x", "z", "y"],
            "the last name takes the place of __metadata__"
        );
        let twice = parse_header(cases[5].as_bytes()).unwrap();
        assert_eq!(twice.shapes["patch_embedding.weight"], [2]);
    }

    #[test]
    fn a_header_refused_through_a_json_tree_is_refused_in_one_pass() {
        let mut bad_utf8 = br#"{"x":{"dtype":"F"#.to_vec();
        bad_utf8.extend_from_slice(&[0xff, 0xfe]);
        bad_utf8.extend_from_slice(br#""}}"#);
        let cases: [&[u8]; 9] = [
            &bad_utf8,
            br#"{"x":{"dtype":"\ud800"}}"#,
            br#"{"x":{"dtype":"F16"}} trailing"#,
            br#"{"x":{"offsets":[1e400]}}"#,
            br#"{"x":{"dtype":"F16",}}"#,
            br#"["x"]"#,
            br#""x""#,
            br#"{"x":{"dtype":"F16"}"#,
            b"",
        ];
        for bytes in cases {
            assert_eq!(
                parse_header_tree(bytes),
                None,
                "{:?}",
                String::from_utf8_lossy(bytes)
            );
            assert_eq!(
                parse_header(bytes),
                None,
                "{:?}",
                String::from_utf8_lossy(bytes)
            );
        }
    }

    #[test]
    fn a_gguf_or_a_wan_transformer_is_a_diffusion_model() {
        assert_eq!(
            kind_from_name("Wan2.2-I2V-A14B-HighNoise-Q4_K_M.GGUF"),
            Some(ModelType::DiffusionModel)
        );
        assert_eq!(
            kind_from_name("4x.pth"),
            Some(ModelType::SpandrelImageToImage)
        );
        assert_eq!(kind_from_name("x.safetensors"), None);
        // City96's GGUF text encoders are told from the diffusion models by their names.
        for encoder in [
            "t5-v1_1-xxl-encoder-Q8_0.gguf",
            "umt5-xxl-encoder-Q4_K_M.gguf",
            "Qwen3-4B-Q4_K_M.gguf",
        ] {
            assert_eq!(
                kind_from_name(encoder),
                Some(ModelType::TextEncoder),
                "{encoder}"
            );
        }
        let wan = header(
            &["blocks.0.self_attn.q.weight", "patch_embedding.weight"],
            json!({}),
        );
        assert_eq!(detect_kind(&wan), Some(ModelType::DiffusionModel));
        assert_eq!(
            detect_base(ModelType::DiffusionModel, None, "wan-q4.gguf"),
            BaseModel::Wan
        );
        assert_eq!(
            detect_base(ModelType::DiffusionModel, None, "mystery-q4.gguf"),
            BaseModel::Any
        );
    }

    /// The tensor names of the real Anima files on Hugging Face (read from their headers, 2026-10-12).
    const ANIMA: &[&str] = &[
        "net.blocks.0.adaln_modulation_cross_attn.1.weight",
        "net.blocks.0.self_attn.q_proj.weight",
        "net.final_layer.linear.weight",
        "net.llm_adapter.blocks.0.cross_attn.k_proj.weight",
        "net.llm_adapter.embed.weight",
        "net.t_embedder.1.linear_1.weight",
    ];

    #[test]
    fn an_anima_file_is_a_diffusion_model_of_its_own_family() {
        let h = header(ANIMA, json!({ "format": "pt" }));
        assert_eq!(detect_kind(&h), Some(ModelType::DiffusionModel));
        assert_eq!(
            detect_base(
                ModelType::DiffusionModel,
                Some(&h),
                "Anima-2.9B-preview-v1_int8_convrot.safetensors"
            ),
            BaseModel::Anima
        );
        // The int8 file also holds `weight_scale` tensors; they change nothing.
        let int8 = header(
            &[ANIMA, &["net.blocks.0.self_attn.q_proj.weight_scale"]].concat(),
            json!({}),
        );
        assert_eq!(detect_kind(&int8), Some(ModelType::DiffusionModel));
        // Cosmos-Predict2 has the blocks without the adapter: a diffusion model, no family here.
        let cosmos = header(
            &[
                "net.blocks.0.adaln_modulation_self_attn.1.weight",
                "net.x_embedder.proj.1.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&cosmos), Some(ModelType::DiffusionModel));
        assert_eq!(detect_architecture(&cosmos), None);
    }

    #[test]
    fn newer_diffusion_transformers_are_told_apart_by_tensor_names() {
        let cases: &[(&[&str], BaseModel)] = &[
            (
                &[
                    "double_blocks.0.img_attn.qkv.weight",
                    "single_blocks.0.linear1.weight",
                ],
                BaseModel::Flux,
            ),
            (
                &[
                    "model.diffusion_model.double_blocks.0.img_attn.qkv.weight",
                    "model.diffusion_model.single_blocks.0.linear1.weight",
                ],
                BaseModel::Flux,
            ),
            (
                &[
                    "double_blocks.0.img_attn.qkv.weight",
                    "single_blocks.0.linear1.weight",
                    "distilled_guidance_layer.in_proj.weight",
                ],
                BaseModel::Chroma,
            ),
            (
                &[
                    "double_blocks.0.img_mod.lin.weight",
                    "single_blocks.0.modulation.lin.weight",
                    "txt_in.individual_token_refiner.blocks.0.norm1.weight",
                ],
                BaseModel::HunyuanVideo,
            ),
            (
                &["double_stream_blocks.0.block.attn1.to_q.weight"],
                BaseModel::Hidream,
            ),
            (
                &[
                    "double_layers.0.attn.w1q.weight",
                    "single_layers.0.attn.w1q.weight",
                ],
                BaseModel::Auraflow,
            ),
            (&["joint_blocks.0.x_block.attn.qkv.weight"], BaseModel::Sd3),
            (
                &[
                    "noise_refiner.0.attention.qkv.weight",
                    "cap_embedder.1.weight",
                ],
                BaseModel::ZImage,
            ),
            (
                &[
                    "transformer_blocks.0.img_mod.1.weight",
                    "transformer_blocks.0.txt_mlp.net.0.proj.weight",
                ],
                BaseModel::QwenImage,
            ),
            (
                &[
                    "transformer_blocks.0.attn1.to_q.weight",
                    "adaln_single.linear.weight",
                    "patchify_proj.weight",
                ],
                BaseModel::LtxVideo,
            ),
            (
                &["blocks.0.self_attn.q.weight", "patch_embedding.weight"],
                BaseModel::Wan,
            ),
        ];
        for (keys, base) in cases {
            let h = header(keys, json!({}));
            assert_eq!(detect_kind(&h), Some(ModelType::DiffusionModel), "{keys:?}");
            assert_eq!(detect_architecture(&h), Some(*base), "{keys:?}");
            assert_eq!(
                detect_base(ModelType::DiffusionModel, Some(&h), "x.safetensors"),
                *base
            );
        }
    }

    #[test]
    fn a_checkpoint_with_its_own_vae_and_encoders_stays_a_main_model() {
        let flux = header(
            &[
                "model.diffusion_model.double_blocks.0.img_attn.qkv.weight",
                "model.diffusion_model.single_blocks.0.linear1.weight",
                "vae.decoder.up.0.block.0.conv1.weight",
                "text_encoders.t5xxl.transformer.encoder.block.0.layer.0.SelfAttention.q.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&flux), Some(ModelType::Main));
        assert_eq!(
            detect_base(ModelType::Main, Some(&flux), "x.safetensors"),
            BaseModel::Flux
        );
    }

    #[test]
    fn loras_of_the_newer_families_carry_their_family() {
        let wan = header(
            &["diffusion_model.blocks.0.self_attn.q.lora_A.weight"],
            json!({}),
        );
        assert_eq!(detect_kind(&wan), Some(ModelType::Lora));
        assert_eq!(
            detect_base(ModelType::Lora, Some(&wan), "x"),
            BaseModel::Wan
        );
        let anima = header(
            &["lora_unet_llm_adapter_blocks_0.lora_down.weight"],
            json!({}),
        );
        assert_eq!(
            detect_base(ModelType::Lora, Some(&anima), "x"),
            BaseModel::Anima
        );
        let qwen = header(
            &["transformer.transformer_blocks.0.img_mod.1.lora_B.weight"],
            json!({}),
        );
        assert_eq!(
            detect_base(ModelType::Lora, Some(&qwen), "x"),
            BaseModel::QwenImage
        );
        let lokr = header(&["lycoris_blocks_0.lokr_w1"], json!({}));
        assert_eq!(detect_kind(&lokr), Some(ModelType::Lora));
    }

    /// BuAnime_NSFW_Style_Anima_BuAnimeV3 (Civitai, read from its header 2026-10-20): sd-scripts' Anima trainer wrote
    /// `stable-diffusion-v1/lora` as the architecture, and the LoRA changes only the Cosmos blocks, not the LLM adapter.
    #[test]
    fn an_anima_lora_is_told_by_its_tensors_over_a_wrong_architecture() {
        let kohya = header(
            &[
                "lora_unet_blocks_0_adaln_modulation_self_attn_1.lora_down.weight",
                "lora_unet_blocks_0_self_attn_q_proj.lora_down.weight",
            ],
            json!({ "modelspec.architecture": "stable-diffusion-v1/lora", "ss_base_model_version": "anima" }),
        );
        assert_eq!(detect_kind(&kohya), Some(ModelType::Lora));
        assert_eq!(
            detect_base(ModelType::Lora, Some(&kohya), "x"),
            BaseModel::Anima
        );
        // In the diffusers form the Cosmos blocks would also meet the Wan rule (`blocks.0.self_attn.`).
        let peft = header(
            &[
                "diffusion_model.blocks.0.adaln_modulation_self_attn.1.lora_A.weight",
                "diffusion_model.blocks.0.self_attn.q_proj.lora_A.weight",
            ],
            json!({}),
        );
        assert_eq!(
            detect_base(ModelType::Lora, Some(&peft), "x"),
            BaseModel::Anima
        );
        // The trainer's base version names the family when the tensors do not.
        let named = header(
            &["lora_unet_down_blocks_0.lora_down.weight"],
            json!({ "ss_base_model_version": "anima" }),
        );
        assert_eq!(
            detect_base(ModelType::Lora, Some(&named), "x"),
            BaseModel::Anima
        );
        // A Wan LoRA stays Wan: its attention has no `_proj` and no Cosmos modulation.
        let wan = header(
            &["diffusion_model.blocks.0.self_attn.q.lora_A.weight"],
            json!({ "modelspec.architecture": "stable-diffusion-v1/lora" }),
        );
        assert_eq!(
            detect_base(ModelType::Lora, Some(&wan), "x"),
            BaseModel::Wan
        );
    }

    #[test]
    fn text_encoders_vaes_and_upscalers_of_the_newer_models_are_recognised() {
        let t5 = header(
            &[
                "shared.weight",
                "encoder.block.0.layer.0.SelfAttention.q.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&t5), Some(ModelType::TextEncoder));
        let qwen = header(
            &[
                "model.embed_tokens.weight",
                "model.layers.0.self_attn.q_proj.weight",
                "lm_head.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&qwen), Some(ModelType::TextEncoder));
        assert_eq!(
            detect_base(
                ModelType::TextEncoder,
                Some(&qwen),
                "qwen_3_06b_base.safetensors"
            ),
            BaseModel::Any
        );
        let clip = header(
            &[
                "text_model.encoder.layers.0.self_attn.q_proj.weight",
                "text_projection.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&clip), Some(ModelType::TextEncoder));
        let wan_vae = header(
            &[
                "encoder.downsamples.0.residual.0.gamma",
                "decoder.upsamples.0.residual.0.gamma",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&wan_vae), Some(ModelType::Vae));
        let diffusers_vae = header(
            &[
                "encoder.down_blocks.0.resnets.0.conv1.weight",
                "decoder.up_blocks.0.resnets.0.conv1.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&diffusers_vae), Some(ModelType::Vae));
        let esrgan = header(
            &[
                "conv_first.weight",
                "conv_last.weight",
                "body.0.rdb1.conv1.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&esrgan), Some(ModelType::SpandrelImageToImage));
    }

    #[test]
    fn model_patches_are_told_apart_from_controlnets_by_the_tensors_comfyui_reads() {
        let cases = [
            ("lllite_conditioning1.conv1.weight", BaseModel::Anima),
            ("controlnet_blocks.0.y_rms.weight", BaseModel::QwenImage),
            ("control_all_x_embedder.2-1.weight", BaseModel::ZImage),
        ];
        for (key, base) in cases {
            let h = header(&[key, "img_in.weight"], json!({}));
            assert_eq!(detect_kind(&h), Some(ModelType::ModelPatch), "{key}");
            assert_eq!(
                detect_base(ModelType::ModelPatch, Some(&h), "x"),
                base,
                "{key}"
            );
        }
        // A ControlNet with other block names stays a ControlNet.
        let cn = header(&["controlnet_blocks.0.weight"], json!({}));
        assert_eq!(detect_kind(&cn), Some(ModelType::Controlnet));
    }

    #[test]
    fn all_in_one_checkpoints_of_the_newer_families_keep_their_family() {
        // The tensor names of the real files (read from their headers on Hugging Face, 2026-10-12).
        let aura = header(
            &[
                "model.double_layers.0.attn.w1q.weight",
                "text_encoders.pile_t5xl.x",
                "vae.decoder.x",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&aura), Some(ModelType::Main));
        assert_eq!(
            detect_base(ModelType::Main, Some(&aura), "aura_flow_0.3.safetensors"),
            BaseModel::Auraflow
        );
        assert_eq!(bundled_parts(&aura), (true, true));
        let sd35 = header(
            &[
                "model.diffusion_model.joint_blocks.0.x",
                "text_encoders.clip_g.x",
                "first_stage_model.decoder.x",
            ],
            json!({ "modelspec.architecture": "stable-diffusion-v3.5-large" }),
        );
        assert_eq!(detect_kind(&sd35), Some(ModelType::Main));
        assert_eq!(
            detect_base(ModelType::Main, Some(&sd35), "x"),
            BaseModel::Sd3
        );
        let lllite = header(
            &[
                "lllite_conditioning1.conv1.weight",
                "lllite_dit_blocks_0_self_attn_q_proj.down.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&lllite), Some(ModelType::ModelPatch));
    }

    #[test]
    fn a_checkpoint_says_which_parts_it_carries() {
        let all = header(
            &[
                "model.diffusion_model.x",
                "text_encoders.clip_l.x",
                "first_stage_model.x",
            ],
            json!({}),
        );
        assert_eq!(bundled_parts(&all), (true, true));
        let model_and_vae = header(
            &["model.diffusion_model.x", "first_stage_model.x"],
            json!({}),
        );
        assert_eq!(bundled_parts(&model_and_vae), (false, true));
        let sd = header(
            &["conditioner.embedders.0.x", "first_stage_model.x"],
            json!({}),
        );
        assert_eq!(bundled_parts(&sd), (true, true));
    }

    /// A header with the given tensors and shapes (`name=channels` sets the second dimension).
    fn header_with_shapes(tensors: &[&str]) -> Header {
        let mut m = Map::new();
        for t in tensors {
            let (name, channels) = match t.split_once('=') {
                Some((n, c)) => (n, c.parse::<u64>().unwrap()),
                None => (*t, 1),
            };
            m.insert(
                name.to_string(),
                json!({ "dtype": "BF16", "shape": [1536, channels, 1, 2, 2], "data_offsets": [0, 2] }),
            );
        }
        parse_header(&serde_json::to_vec(&m).unwrap()).unwrap()
    }

    #[test]
    fn the_channels_of_a_wan_patch_embedding_tell_what_the_model_is_made_for() {
        // Read from the real files on Hugging Face (2026-10-12): 16 text to video, 36 image to video, 48 the 5B model.
        for (prefix, channels) in [("model.diffusion_model.", 16), ("", 36), ("", 48)] {
            let name = format!("{prefix}patch_embedding.weight={channels}");
            let h = header_with_shapes(&[&format!("{prefix}blocks.0.self_attn.q.weight"), &name]);
            assert_eq!(detect_kind(&h), Some(ModelType::DiffusionModel));
            assert_eq!(detect_architecture(&h), Some(BaseModel::Wan));
            assert_eq!(wan_in_channels(&h), Some(channels));
        }
        assert_eq!(
            wan_in_channels(&header_with_shapes(&["blocks.0.self_attn.q.weight"])),
            None
        );
        // Only the patch embedding's shape is kept, not every tensor's.
        let h = header_with_shapes(&["blocks.0.self_attn.q.weight=5", "patch_embedding.weight=16"]);
        assert_eq!(h.shapes.len(), 1);
    }

    #[test]
    fn hunyuan_video_and_ltx_video_files_are_recognised_by_their_real_names() {
        let hunyuan = header_with_shapes(&[
            "model.model.double_blocks.0.img_attn.qkv.weight",
            "model.model.single_blocks.0.linear1.weight",
            "model.model.txt_in.individual_token_refiner.blocks.0.norm1.weight",
            "model.model.img_in.proj.weight=16",
        ]);
        assert_eq!(detect_kind(&hunyuan), Some(ModelType::DiffusionModel));
        assert_eq!(detect_architecture(&hunyuan), Some(BaseModel::HunyuanVideo));
        assert_eq!(hunyuan_in_channels(&hunyuan), Some(16));
        // LTX-Video's checkpoint carries its VAE (`vae.`), with the model under `model.diffusion_model.`.
        let ltx = header_with_shapes(&[
            "model.diffusion_model.patchify_proj.weight",
            "model.diffusion_model.adaln_single.linear.weight",
            "model.diffusion_model.transformer_blocks.0.attn1.k_norm.weight",
            "vae.decoder.up_blocks.0.x",
        ]);
        // With its VAE inside it is a checkpoint (ComfyUI loads those from `checkpoints` only).
        assert_eq!(detect_kind(&ltx), Some(ModelType::Main));
        assert_eq!(detect_architecture(&ltx), Some(BaseModel::LtxVideo));
        assert_eq!(bundled_parts(&ltx), (false, true));
        assert_eq!(
            detect_base(
                ModelType::Main,
                Some(&ltx),
                "ltx-video-2b-v0.9.5.safetensors"
            ),
            BaseModel::LtxVideo
        );
    }

    #[test]
    fn a_name_decides_only_when_the_header_cannot() {
        let kind = kind_from_name;
        assert_eq!(
            kind("qwen_3_06b_base.safetensors"),
            Some(ModelType::TextEncoder)
        );
        assert_eq!(
            kind("umt5_xxl_fp8_e4m3fn_scaled.safetensors"),
            Some(ModelType::TextEncoder)
        );
        assert_eq!(kind("qwen_image_vae.safetensors"), Some(ModelType::Vae));
        assert_eq!(kind("ae.safetensors"), Some(ModelType::Vae));
        assert_eq!(kind("my-style-lora.safetensors"), Some(ModelType::Lora));
        assert_eq!(kind("umt5-xxl-Q8_0.gguf"), Some(ModelType::TextEncoder));
        assert_eq!(kind("Anima-2.9B-preview-v1.safetensors"), None);
    }

    #[test]
    fn checkpoints_are_told_apart_by_tensor_names() {
        let xl = header(
            &[
                "model.diffusion_model.input_blocks.0.0.weight",
                "conditioner.embedders.1.model.ln_final.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&xl), Some(ModelType::Main));
        assert_eq!(
            detect_base(ModelType::Main, Some(&xl), "x.safetensors"),
            BaseModel::Sdxl
        );
        let sd1 = header(
            &[
                "model.diffusion_model.input_blocks.0.0.weight",
                "cond_stage_model.transformer.text_model.x",
            ],
            json!({}),
        );
        assert_eq!(
            detect_base(ModelType::Main, Some(&sd1), "x.safetensors"),
            BaseModel::Sd1
        );
    }

    #[test]
    fn lora_base_comes_from_metadata_then_keys() {
        let meta = header(
            &["lora_unet_down_blocks_0.lora_down.weight"],
            json!({ "ss_base_model_version": "sdxl_base_v1-0" }),
        );
        assert_eq!(detect_kind(&meta), Some(ModelType::Lora));
        assert_eq!(
            detect_base(ModelType::Lora, Some(&meta), "a"),
            BaseModel::Sdxl
        );
        let sd1 = header(
            &[
                "lora_unet_down_blocks_0_attentions_0.lora_down.weight",
                "lora_te_text_model.lora_up.weight",
            ],
            json!({}),
        );
        assert_eq!(
            detect_base(ModelType::Lora, Some(&sd1), "a"),
            BaseModel::Sd1
        );
        let xl = header(&["lora_te2_text_model.lora_up.weight"], json!({}));
        assert_eq!(
            detect_base(ModelType::Lora, Some(&xl), "a"),
            BaseModel::Sdxl
        );
    }

    #[test]
    fn vae_and_unknown_fall_back_to_the_file_name() {
        let vae = header(
            &[
                "encoder.down.0.block.0.conv1.weight",
                "decoder.up.0.block.0.conv1.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_kind(&vae), Some(ModelType::Vae));
        assert_eq!(
            detect_base(ModelType::Vae, Some(&vae), "sdxl_vae.safetensors"),
            BaseModel::Sdxl
        );
        assert_eq!(
            detect_base(ModelType::Vae, None, "vae-ft-mse.pt"),
            BaseModel::Any
        );
        assert_eq!(detect_kind(&header(&["foo"], json!({}))), None);
    }

    #[test]
    fn header_is_read_from_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let json =
            br#"{"lora_te2_x.lora_up.weight":{"dtype":"F16","shape":[1],"data_offsets":[0,2]}}"#;
        let mut bytes = (json.len() as u64).to_le_bytes().to_vec();
        bytes.extend_from_slice(json);
        bytes.extend_from_slice(&[0, 0]);
        let path = dir.path().join("x.safetensors");
        std::fs::write(&path, bytes).unwrap();
        let h = read_header(&path).unwrap();
        assert_eq!(detect_kind(&h), Some(ModelType::Lora));
        std::fs::write(dir.path().join("y.safetensors"), [255u8; 8]).unwrap();
        assert!(read_header(&dir.path().join("y.safetensors")).is_none());
    }

    #[test]
    fn the_variants_of_a_family_are_told_from_the_tensors_and_the_name() {
        let flux = |cols: u64| {
            header_with_shapes(&[
                "double_blocks.0.img_attn.qkv.weight",
                "single_blocks.0.linear1.weight",
                &format!("img_in.weight={cols}"),
            ])
        };
        let v = |base, h: Option<&Header>, name: &str| detect_variant(base, h, name);
        // Flux: 64 columns is the plain model (and Kontext, told by its name), 384 is Fill, 512 a control model.
        assert_eq!(
            v(BaseModel::Flux, Some(&flux(64)), "flux1-dev.safetensors"),
            Variant::Plain
        );
        assert_eq!(
            v(
                BaseModel::Flux,
                Some(&flux(64)),
                "flux1-dev-kontext_fp8_scaled.safetensors"
            ),
            Variant::FluxKontext
        );
        assert_eq!(
            v(
                BaseModel::Flux,
                Some(&flux(384)),
                "flux1-fill-dev.safetensors"
            ),
            Variant::FluxFill
        );
        assert!(matches!(
            v(
                BaseModel::Flux,
                Some(&flux(512)),
                "flux1-canny-dev.safetensors"
            ),
            Variant::Unsupported(_)
        ));
        // A GGUF file has no header: the name decides.
        assert_eq!(
            v(BaseModel::Flux, None, "flux1-fill-dev-Q4_K_S.gguf"),
            Variant::FluxFill
        );
        assert_eq!(
            v(BaseModel::Flux, None, "flux1-dev-Q4_K_S.gguf"),
            Variant::Plain
        );
        // Qwen-Image: the edit models by name, the 2509 and later ones take several pictures.
        let q = |name| v(BaseModel::QwenImage, None, name);
        assert_eq!(q("qwen_image_fp8_e4m3fn.safetensors"), Variant::Plain);
        assert_eq!(
            q("qwen_image_edit_fp8_e4m3fn.safetensors"),
            Variant::QwenEdit
        );
        assert_eq!(
            q("qwen_image_edit_2509_fp8_e4m3fn.safetensors"),
            Variant::QwenEditPlus
        );
        assert!(matches!(
            q("qwen_image_layered_bf16.safetensors"),
            Variant::Unsupported(_)
        ));
    }

    #[test]
    fn a_wan_model_made_for_another_input_is_told_from_its_tensors() {
        let wan = |extra: &[&str], channels: u64| {
            let mut keys = vec![
                "blocks.0.self_attn.q.weight".to_string(),
                format!("patch_embedding.weight={channels}"),
            ];
            keys.extend(extra.iter().map(|k| k.to_string()));
            let refs: Vec<&str> = keys.iter().map(String::as_str).collect();
            header_with_shapes(&refs)
        };
        let v = |h: &Header| detect_variant(BaseModel::Wan, Some(h), "wan.safetensors");
        assert_eq!(v(&wan(&[], 16)), Variant::Plain);
        // Wan 2.1 image to video has the image embedding, Wan 2.2's does not; both are plain image to video.
        assert_eq!(v(&wan(&["img_emb.proj.0.bias"], 36)), Variant::Plain);
        assert_eq!(v(&wan(&[], 36)), Variant::Plain);
        assert!(wan_has_image_embedding(&wan(&["img_emb.proj.0.bias"], 36)));
        assert!(!wan_has_image_embedding(&wan(&[], 36)));
        // The 5B model has 48 channels and no image embedding; Fun Control has both of them.
        assert_eq!(v(&wan(&[], 48)), Variant::Plain);
        assert!(matches!(
            v(&wan(&["img_emb.proj.0.bias"], 48)),
            Variant::Unsupported(_)
        ));
        assert_eq!(
            v(&wan(
                &["vace_patch_embedding.weight", "vace_blocks.0.x"],
                16
            )),
            Variant::WanVace
        );
        for extra in [
            "control_adapter.conv.weight",
            "casual_audio_encoder.encoder.final_linear.weight",
            "audio_proj.audio_proj_glob_1.layer.bias",
            "face_adapter.fuser_blocks.0.k_norm.weight",
            "patch_embedding_pose.weight",
            "ref_conv.weight",
        ] {
            assert!(
                matches!(v(&wan(&[extra], 16)), Variant::Unsupported(_)),
                "{extra}"
            );
        }
        // By name (GGUF).
        let by_name = |n: &str| detect_variant(BaseModel::Wan, None, n);
        assert_eq!(by_name("wan2.1_vace_1.3B-Q8_0.gguf"), Variant::WanVace);
        assert_eq!(
            by_name("Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf"),
            Variant::Plain
        );
        assert!(matches!(
            by_name("wan2.1-fun-14b-control-Q4.gguf"),
            Variant::Unsupported(_)
        ));
        assert!(matches!(
            by_name("Wan2.2-Animate-14B-Q4.gguf"),
            Variant::Unsupported(_)
        ));
    }

    #[test]
    fn the_newer_families_are_told_from_the_ones_they_share_blocks_with() {
        // Tensor names and shapes read from the real files on Hugging Face (2026-10-12).
        let flux2 = header_with_shapes(&[
            "double_blocks.0.img_attn.qkv.weight",
            "single_blocks.0.linear1.weight",
            "double_stream_modulation_img.lin.weight",
            "img_in.weight=128",
            "txt_in.weight=7680",
        ]);
        assert_eq!(detect_architecture(&flux2), Some(BaseModel::Flux2));
        assert_eq!(detect_kind(&flux2), Some(ModelType::DiffusionModel));
        assert_eq!(flux2_context(&flux2), Some(7680));
        let v = |ctx: u64, name: &str| {
            let h = header_with_shapes(&[
                "double_stream_modulation_img.lin.weight",
                &format!("txt_in.weight={ctx}"),
            ]);
            detect_variant(BaseModel::Flux2, Some(&h), name)
        };
        assert_eq!(
            v(7680, "flux-2-klein-4b.safetensors"),
            Variant::Flux2Klein4b
        );
        assert_eq!(
            v(12288, "flux-2-klein-9b.safetensors"),
            Variant::Flux2Klein9b
        );
        assert_eq!(
            v(15360, "flux2_dev_fp8mixed.safetensors"),
            Variant::Flux2Dev
        );
        // A GGUF file: the name.
        let by_name = |n: &str| detect_variant(BaseModel::Flux2, None, n);
        assert_eq!(
            by_name("flux-2-klein-9b-Q4_K_M.gguf"),
            Variant::Flux2Klein9b
        );
        assert_eq!(by_name("flux2-klein-4b-Q8_0.gguf"), Variant::Flux2Klein4b);
        assert_eq!(by_name("flux2-dev-Q4_K_M.gguf"), Variant::Flux2Dev);
        // Flux 1 has none of FLUX.2's modulation tensors.
        let flux1 = header_with_shapes(&[
            "double_blocks.0.img_attn.qkv.weight",
            "single_blocks.0.linear1.weight",
        ]);
        assert_eq!(detect_architecture(&flux1), Some(BaseModel::Flux));
        // HunyuanVideo 1.5 adds the vision and byte-T5 inputs to 1.0's token refiner; its t2v and i2v files differ
        // only in their metadata and names.
        let refiner = "txt_in.individual_token_refiner.blocks.0.norm1.weight";
        let hv1 = header(&[refiner], json!({}));
        assert_eq!(detect_architecture(&hv1), Some(BaseModel::HunyuanVideo));
        let t2v = header(
            &[refiner, "vision_in.proj.0.weight", "byt5_in.fc1.weight"],
            json!({"model_type": "hunyuanvideo1.5_720p_t2v"}),
        );
        assert_eq!(detect_architecture(&t2v), Some(BaseModel::HunyuanVideo15));
        let i2v = header(
            &[refiner, "vision_in.proj.0.weight"],
            json!({"model_type": "hunyuanvideo1.5_720p_i2v"}),
        );
        let hv = |h: &Header, name: &str| detect_variant(BaseModel::HunyuanVideo15, Some(h), name);
        assert_eq!(hv(&t2v, "a.safetensors"), Variant::Plain);
        assert_eq!(hv(&i2v, "a.safetensors"), Variant::Hy15I2v);
        let sr = header(
            &[refiner, "vision_in.proj.0.weight"],
            json!({"model_type": "hunyuanvideo1.5_1080p_sr_distilled"}),
        );
        assert!(matches!(hv(&sr, "a.safetensors"), Variant::Unsupported(_)));
        assert_eq!(
            detect_variant(
                BaseModel::HunyuanVideo15,
                None,
                "hunyuanvideo1.5_480p_i2v-Q4.gguf"
            ),
            Variant::Hy15I2v
        );
        // LTX-2 has audio streams beside the video ones LTX-Video has, and its VAEs inside: a checkpoint.
        let ltx1 = header(
            &[
                "model.diffusion_model.patchify_proj.weight",
                "vae.encoder.conv_in.conv.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_architecture(&ltx1), Some(BaseModel::LtxVideo));
        let ltx2 = header(
            &[
                "model.diffusion_model.patchify_proj.weight",
                "model.diffusion_model.audio_adaln_single.linear.weight",
                "audio_vae.encoder.conv_in.conv.weight",
                "vae.encoder.conv_in.conv.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_architecture(&ltx2), Some(BaseModel::Ltx2));
        assert_eq!(detect_kind(&ltx2), Some(ModelType::Main));
    }

    #[test]
    fn a_hunyuan_dit_checkpoint_is_a_main_model_of_its_own_family() {
        // Tensor names read from `hunyuan_dit_1.2.safetensors` on Hugging Face (2026-10-12): the model, both text
        // encoders and the VAE are in one file.
        let h = header(
            &[
                "model.mlp_t5.0.weight",
                "model.blocks.0.attn1.Wqkv.weight",
                "text_encoders.mt5xl.encoder.block.0.layer.0.SelfAttention.q.weight",
                "vae.decoder.conv_in.weight",
            ],
            json!({}),
        );
        assert_eq!(detect_architecture(&h), Some(BaseModel::HunyuanDit));
        assert_eq!(detect_kind(&h), Some(ModelType::Main));
        assert_eq!(
            detect_base(ModelType::Main, Some(&h), "hunyuan_dit_1.2.safetensors"),
            BaseModel::HunyuanDit
        );
        // A FLUX.2 checkpoint is not taken for Flux, whose block names it shares.
        let flux2 = header(
            &[
                "model.diffusion_model.double_blocks.0.img_attn.qkv.weight",
                "model.diffusion_model.double_stream_modulation_img.lin.weight",
                "vae.encoder.conv_in.weight",
            ],
            json!({}),
        );
        assert_eq!(
            detect_base(ModelType::Main, Some(&flux2), "x.safetensors"),
            BaseModel::Flux2
        );
    }

    #[test]
    fn a_hunyuan_image_file_takes_its_family_from_its_name_when_the_header_says_nothing() {
        // `hunyuan_image_2.1_vae_fp16.safetensors` (Comfy-Org's repackage) has no family in its header.
        let empty = parse_header(b"{}").unwrap();
        for name in [
            "hunyuan_image_2.1_vae_fp16.safetensors",
            "HunyuanImage-2.1-vae.safetensors",
            "hunyuan-image_vae.safetensors",
        ] {
            assert_eq!(
                detect_base(ModelType::Vae, Some(&empty), name),
                BaseModel::HunyuanImage,
                "{name}"
            );
        }
        assert_eq!(
            detect_base(
                ModelType::Vae,
                None,
                "hunyuan_image_2.1_vae_fp16.safetensors"
            ),
            BaseModel::HunyuanImage
        );
        // "hunyuanimage" holds "anima": a quantised HunyuanImage file named so is not an Anima model.
        assert_eq!(
            detect_base(
                ModelType::DiffusionModel,
                None,
                "hunyuanimage2.1-Q4_K_M.gguf"
            ),
            BaseModel::HunyuanImage
        );
        // The video family keeps its own name, and an unnamed VAE stays without a family.
        assert_eq!(
            detect_base(
                ModelType::Vae,
                Some(&empty),
                "hunyuan_video_vae_bf16.safetensors"
            ),
            BaseModel::HunyuanVideo
        );
        assert_eq!(
            detect_base(
                ModelType::Vae,
                Some(&empty),
                "vae-ft-mse-840000-ema-pruned.safetensors"
            ),
            BaseModel::Any
        );
    }

    #[test]
    fn hunyuan_image_is_told_from_hunyuan_video_by_its_flat_patch() {
        // `img_in.proj.weight` of the real files (2026-10-12): [3584, 64, 1, 1] for HunyuanImage 2.1, five dimensions
        // for the video models.
        let with_patch = |shape: serde_json::Value| {
            let mut m = Map::new();
            for k in [
                "model.model.txt_in.individual_token_refiner.blocks.0.norm1.weight",
                "model.model.byt5_in.fc1.weight",
            ] {
                m.insert(
                    k.to_string(),
                    json!({ "dtype": "F8_E4M3", "shape": [1], "data_offsets": [0, 1] }),
                );
            }
            m.insert(
                "model.model.img_in.proj.weight".into(),
                json!({ "dtype": "F8_E4M3", "shape": shape, "data_offsets": [0, 1] }),
            );
            parse_header(&serde_json::to_vec(&m).unwrap()).unwrap()
        };
        let image = with_patch(json!([3584, 64, 1, 1]));
        assert_eq!(detect_architecture(&image), Some(BaseModel::HunyuanImage));
        assert_eq!(detect_kind(&image), Some(ModelType::DiffusionModel));
        // HunyuanVideo 1.5 has the byte-T5 input too, but a patch over time as well.
        let video = with_patch(json!([2048, 65, 1, 1, 1]));
        assert_eq!(detect_architecture(&video), Some(BaseModel::HunyuanVideo15));
    }
}
