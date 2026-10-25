//! Starter models offered on the install screen. Each source is a single file ComfyUI can load
//! (`owner/repo::path` on Hugging Face or a direct URL), so installs need no conversion.
use crate::types::{BaseModel, ModelType, StarterModel};

fn starter(
    id: &str,
    name: &str,
    base: BaseModel,
    kind: ModelType,
    description: &str,
    source: &str,
    deps: &[&str],
) -> StarterModel {
    StarterModel {
        id: id.into(),
        name: name.into(),
        base,
        kind,
        description: description.into(),
        source: source.into(),
        dependencies: (!deps.is_empty()).then(|| deps.iter().map(|d| d.to_string()).collect()),
        size_bytes: approx_size(id),
    }
}

/// About how large the download of a part is, in bytes. Read off the files at the time of writing; the point is to tell
/// a 300 MB VAE from a 9 GB encoder before the download starts, not to be exact.
fn approx_size(id: &str) -> Option<u64> {
    const MB: u64 = 1_000_000;
    let mb = match id {
        "starter-qwen3-06b" => 1_190,
        "starter-qwen-image-vae" | "starter-wan21-vae" => 254,
        "starter-qwen25-vl" => 9_380,
        "starter-qwen3-4b" => 8_050,
        "starter-flux-ae" | "starter-flux2-vae" => 335,
        "starter-flux-clip-l" => 246,
        "starter-flux-t5xxl" => 4_890,
        "starter-hidream-clip-l" => 248,
        "starter-hidream-clip-g" => 1_390,
        "starter-hidream-t5xxl" => 5_160,
        "starter-hidream-llama" => 8_460,
        "starter-umt5-xxl" => 6_740,
        "starter-clip-vision-vit-h" | "starter-wan21-clip-vision" => 1_260,
        "starter-hunyuan-image-vae" => 790,
        "starter-mistral3-small" => 17_600,
        "starter-hunyuan-llava" => 9_090,
        "starter-hunyuan-vae" => 493,
        "starter-hunyuan-vision" => 620,
        "starter-byt5-small" => 440,
        "starter-hunyuan15-vae" => 1_000,
        "starter-sigclip-vision" => 860,
        "starter-gemma3-12b" => 13_200,
        "starter-sdxl-vae-fp16" | "starter-sd15-vae" => 335,
        _ => return None,
    };
    Some(mb * MB)
}

pub fn starter_models() -> Vec<StarterModel> {
    use BaseModel::*;
    use ModelType::*;
    vec![
        starter(
            "starter-sdxl-base",
            "SDXL Base 1.0",
            Sdxl,
            Main,
            "Stable Diffusion XL base model.",
            "stabilityai/stable-diffusion-xl-base-1.0::sd_xl_base_1.0.safetensors",
            &["starter-sdxl-vae-fp16"],
        ),
        starter(
            "starter-sdxl-vae-fp16",
            "sdxl-vae-fp16-fix",
            Sdxl,
            Vae,
            "SDXL VAE that runs in fp16 without NaNs.",
            "madebyollin/sdxl-vae-fp16-fix::sdxl.vae.safetensors",
            &[],
        ),
        starter(
            "starter-sd15",
            "Stable Diffusion 1.5",
            Sd1,
            Main,
            "Stable Diffusion 1.5 base model.",
            "stable-diffusion-v1-5/stable-diffusion-v1-5::v1-5-pruned-emaonly.safetensors",
            &[],
        ),
        starter(
            "starter-sd15-vae",
            "sd-vae-ft-mse",
            Sd1,
            Vae,
            "Improved SD 1.5 VAE.",
            "stabilityai/sd-vae-ft-mse-original::vae-ft-mse-840000-ema-pruned.safetensors",
            &[],
        ),
        starter(
            "starter-cn-union-sdxl",
            "controlnet-union-promax-sdxl",
            Sdxl,
            Controlnet,
            "Union ControlNet for SDXL.",
            "xinsir/controlnet-union-sdxl-1.0::diffusion_pytorch_model_promax.safetensors",
            &[],
        ),
        starter(
            "starter-cn-canny-sd15",
            "control_v11p_sd15_canny",
            Sd1,
            Controlnet,
            "Canny edge ControlNet for SD 1.5.",
            "comfyanonymous/ControlNet-v1-1_fp16_safetensors::control_v11p_sd15_canny_fp16.safetensors",
            &[],
        ),
        // Reference images: an IP-Adapter per base plus the ViT-H image encoder both of these were trained with.
        // They load through the ComfyUI_IPAdapter_plus node pack from the `ipadapter` and `clip_vision` folders.
        starter(
            "starter-ipadapter-sdxl-vit-h",
            "IP-Adapter SDXL (ViT-H)",
            Sdxl,
            IpAdapter,
            "Reference images for SDXL; uses the ViT-H image encoder.",
            "h94/IP-Adapter::sdxl_models/ip-adapter_sdxl_vit-h.safetensors",
            &["starter-clip-vision-vit-h"],
        ),
        starter(
            "starter-ipadapter-sd15",
            "IP-Adapter SD 1.5",
            Sd1,
            IpAdapter,
            "Reference images for SD 1.5; uses the ViT-H image encoder.",
            "h94/IP-Adapter::models/ip-adapter_sd15.safetensors",
            &["starter-clip-vision-vit-h"],
        ),
        starter(
            "starter-clip-vision-vit-h",
            "CLIP ViT-H image encoder",
            Any,
            ClipVision,
            "Image encoder (CLIP ViT-H/14) that IP-Adapter models read reference images with.",
            "Comfy-Org/CLIP-ViT-H-14-laion2B-s32B-b79K_repackaged::split_files/clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors",
            &[],
        ),
        starter(
            "starter-4x-ultrasharp",
            "4x-UltraSharp",
            Any,
            SpandrelImageToImage,
            "General purpose 4x upscaler.",
            "lokCX/4x-Ultrasharp::4x-UltraSharp.pth",
            &[],
        ),
        starter(
            "starter-realesrgan-x4",
            "RealESRGAN_x4plus",
            Any,
            SpandrelImageToImage,
            "Real-ESRGAN 4x upscaler.",
            "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
            &[],
        ),
        // Models that ComfyUI loads in parts: the diffusion model, its text encoder(s) and a VAE. Each model lists the
        // other files it needs, and the Generate tab picks the encoders and the VAE among the installed ones by name.
        starter(
            "starter-anima",
            "Anima Base 1.0",
            Anima,
            DiffusionModel,
            "Anime and illustration model (Cosmos-Predict2 with a Qwen3 text encoder).",
            "circlestone-labs/Anima::split_files/diffusion_models/anima-base-v1.0.safetensors",
            &["starter-qwen3-06b", "starter-qwen-image-vae"],
        ),
        starter(
            "starter-qwen3-06b",
            "qwen_3_06b_base",
            Any,
            TextEncoder,
            "Qwen3 0.6B text encoder that Anima reads prompts with.",
            "circlestone-labs/Anima::split_files/text_encoders/qwen_3_06b_base.safetensors",
            &[],
        ),
        starter(
            "starter-qwen-image-vae",
            "qwen_image_vae",
            Any,
            Vae,
            "VAE of Qwen-Image, also used by Anima.",
            "circlestone-labs/Anima::split_files/vae/qwen_image_vae.safetensors",
            &[],
        ),
        starter(
            "starter-qwen-image",
            "Qwen-Image (fp8)",
            QwenImage,
            DiffusionModel,
            "20B image model that draws legible text. Large: about 20 GB.",
            "Comfy-Org/Qwen-Image_ComfyUI::split_files/diffusion_models/qwen_image_fp8_e4m3fn.safetensors",
            &["starter-qwen25-vl", "starter-qwen-image-vae"],
        ),
        starter(
            "starter-qwen25-vl",
            "qwen_2.5_vl_7b_fp8_scaled",
            Any,
            TextEncoder,
            "Qwen2.5-VL 7B text encoder of Qwen-Image.",
            "Comfy-Org/Qwen-Image_ComfyUI::split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors",
            &[],
        ),
        starter(
            "starter-z-image-turbo",
            "Z-Image Turbo",
            ZImage,
            DiffusionModel,
            "Fast 8-step image model (use CFG 1).",
            "Comfy-Org/z_image_turbo::split_files/diffusion_models/z_image_turbo_bf16.safetensors",
            &["starter-qwen3-4b", "starter-flux-ae"],
        ),
        starter(
            "starter-qwen3-4b",
            "qwen_3_4b",
            Any,
            TextEncoder,
            "Qwen3 4B text encoder of Z-Image.",
            "Comfy-Org/z_image_turbo::split_files/text_encoders/qwen_3_4b.safetensors",
            &[],
        ),
        starter(
            "starter-flux-ae",
            "ae (Flux VAE)",
            Any,
            Vae,
            "VAE of Flux, Chroma and Z-Image.",
            "Comfy-Org/z_image_turbo::split_files/vae/ae.safetensors",
            &[],
        ),
        starter(
            "starter-flux-dev",
            "FLUX.1 dev",
            Flux,
            DiffusionModel,
            "12B image model. Large: about 24 GB. Non-commercial license.",
            "Comfy-Org/flux1-dev::flux1-dev.safetensors",
            &["starter-flux-clip-l", "starter-flux-t5xxl", "starter-flux-ae"],
        ),
        starter(
            "starter-flux-clip-l",
            "clip_l",
            Any,
            TextEncoder,
            "CLIP-L text encoder of Flux.",
            "comfyanonymous/flux_text_encoders::clip_l.safetensors",
            &[],
        ),
        starter(
            "starter-flux-t5xxl",
            "t5xxl_fp8_e4m3fn",
            Any,
            TextEncoder,
            "T5-XXL text encoder (8-bit) of Flux and Chroma.",
            "comfyanonymous/flux_text_encoders::t5xxl_fp8_e4m3fn.safetensors",
            &[],
        ),
        starter(
            "starter-chroma",
            "Chroma1 HD (fp8)",
            Chroma,
            DiffusionModel,
            "Open model derived from Flux, with a real negative prompt.",
            "silveroxides/Chroma1-HD-fp8-scaled::Chroma1-HD-fp8mixed.safetensors",
            &["starter-flux-t5xxl", "starter-flux-ae"],
        ),
        // Checkpoints that carry their own text encoders and VAE.
        starter(
            "starter-sd35-medium",
            "Stable Diffusion 3.5 Medium",
            Sd3,
            Main,
            "SD 3.5 Medium with its text encoders inside. About 12 GB. Stability AI Community License.",
            "Comfy-Org/stable-diffusion-3.5-fp8::sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors",
            &[],
        ),
        starter(
            "starter-sd35-large",
            "Stable Diffusion 3.5 Large (fp8)",
            Sd3,
            Main,
            "SD 3.5 Large with its text encoders inside. About 15 GB. Stability AI Community License.",
            "Comfy-Org/stable-diffusion-3.5-fp8::sd3.5_large_fp8_scaled.safetensors",
            &[],
        ),
        starter(
            "starter-auraflow",
            "AuraFlow 0.3",
            Auraflow,
            Main,
            "Open flow model with its text encoder and VAE inside. About 16 GB.",
            "fal/AuraFlow-v0.3::aura_flow_0.3.safetensors",
            &[],
        ),
        starter(
            "starter-hidream-full",
            "HiDream-I1 Full (fp8)",
            Hidream,
            DiffusionModel,
            "17B image model; needs four text encoders. About 17 GB, plus 16 GB of encoders.",
            "Comfy-Org/HiDream-I1_ComfyUI::split_files/diffusion_models/hidream_i1_full_fp8.safetensors",
            &[
                "starter-hidream-clip-l",
                "starter-hidream-clip-g",
                "starter-hidream-t5xxl",
                "starter-hidream-llama",
                "starter-flux-ae",
            ],
        ),
        starter(
            "starter-hidream-clip-l",
            "clip_l_hidream",
            Any,
            TextEncoder,
            "HiDream's long CLIP-L text encoder.",
            "Comfy-Org/HiDream-I1_ComfyUI::split_files/text_encoders/clip_l_hidream.safetensors",
            &[],
        ),
        starter(
            "starter-hidream-clip-g",
            "clip_g_hidream",
            Any,
            TextEncoder,
            "HiDream's long CLIP-G text encoder.",
            "Comfy-Org/HiDream-I1_ComfyUI::split_files/text_encoders/clip_g_hidream.safetensors",
            &[],
        ),
        starter(
            "starter-hidream-t5xxl",
            "t5xxl_fp8_e4m3fn_scaled",
            Any,
            TextEncoder,
            "T5-XXL text encoder (8-bit, scaled) of HiDream.",
            "Comfy-Org/HiDream-I1_ComfyUI::split_files/text_encoders/t5xxl_fp8_e4m3fn_scaled.safetensors",
            &[],
        ),
        starter(
            "starter-hidream-llama",
            "llama_3.1_8b_instruct_fp8_scaled",
            Any,
            TextEncoder,
            "Llama 3.1 8B text encoder of HiDream.",
            "Comfy-Org/HiDream-I1_ComfyUI::split_files/text_encoders/llama_3.1_8b_instruct_fp8_scaled.safetensors",
            &[],
        ),
        // Video models for the Video screen's model list: the model, its text encoder and its VAE.
        starter(
            "starter-wan21-t2v-1.3b",
            "Wan 2.1 T2V 1.3B",
            Wan,
            DiffusionModel,
            "Small text-to-video model (480p). About 3 GB, plus its encoder and VAE.",
            "Comfy-Org/Wan_2.1_ComfyUI_repackaged::split_files/diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors",
            &["starter-umt5-xxl", "starter-wan21-vae"],
        ),
        starter(
            "starter-umt5-xxl",
            "umt5_xxl_fp8_e4m3fn_scaled",
            Any,
            TextEncoder,
            "UMT5-XXL text encoder of the Wan models.",
            "Comfy-Org/Wan_2.1_ComfyUI_repackaged::split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
            &[],
        ),
        starter(
            "starter-wan21-vae",
            "wan_2.1_vae",
            Any,
            Vae,
            "VAE of Wan 2.1 and of the Wan 2.2 14B models.",
            "Comfy-Org/Wan_2.1_ComfyUI_repackaged::split_files/vae/wan_2.1_vae.safetensors",
            &[],
        ),
        starter(
            "starter-wan21-vace-1.3b",
            "Wan 2.1 VACE 1.3B",
            Wan,
            DiffusionModel,
            "Text to video, or video from a reference picture (480p). About 4 GB, plus its encoder and VAE.",
            "Comfy-Org/Wan_2.1_ComfyUI_repackaged::split_files/diffusion_models/wan2.1_vace_1.3B_fp16.safetensors",
            &["starter-umt5-xxl", "starter-wan21-vae"],
        ),
        starter(
            "starter-wan21-i2v-14b",
            "Wan 2.1 I2V 14B 480p (fp8)",
            Wan,
            DiffusionModel,
            "Image to video (480p). Large: about 16 GB, plus its encoder, VAE and CLIP-vision model.",
            "Comfy-Org/Wan_2.1_ComfyUI_repackaged::split_files/diffusion_models/wan2.1_i2v_480p_14B_fp8_scaled.safetensors",
            &["starter-umt5-xxl", "starter-wan21-vae", "starter-wan21-clip-vision"],
        ),
        starter(
            "starter-wan21-clip-vision",
            "clip_vision_h",
            Any,
            ClipVision,
            "CLIP-vision model of Wan 2.1 image to video.",
            "Comfy-Org/Wan_2.1_ComfyUI_repackaged::split_files/clip_vision/clip_vision_h.safetensors",
            &[],
        ),
        starter(
            "starter-flux-kontext",
            "FLUX.1 Kontext dev (fp8)",
            Flux,
            DiffusionModel,
            "Edits a picture by a prompt (use image to image). About 12 GB, plus its encoders and VAE.",
            "Comfy-Org/flux1-kontext-dev_ComfyUI::split_files/diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors",
            &["starter-flux-clip-l", "starter-flux-t5xxl", "starter-flux-ae"],
        ),
        starter(
            "starter-qwen-image-edit",
            "Qwen-Image-Edit 2509 (fp8)",
            QwenImage,
            DiffusionModel,
            "Edits up to three pictures by a prompt (use image to image). Large: about 20 GB.",
            "Comfy-Org/Qwen-Image-Edit_ComfyUI::split_files/diffusion_models/qwen_image_edit_2509_fp8_e4m3fn.safetensors",
            &["starter-qwen25-vl", "starter-qwen-image-vae"],
        ),
        starter(
            "starter-z-image-turbo-gguf",
            "Z-Image Turbo (GGUF Q4_K_M)",
            ZImage,
            DiffusionModel,
            "Quantised Z-Image Turbo, about 5 GB. Needs the ComfyUI-GGUF extension.",
            "jayn7/Z-Image-Turbo-GGUF::z_image_turbo-Q4_K_M.gguf",
            &["starter-qwen3-4b", "starter-flux-ae"],
        ),
        starter(
            "starter-hunyuan-image",
            "HunyuanImage 2.1 distilled (fp8)",
            HunyuanImage,
            DiffusionModel,
            "17B image model, distilled for few steps. About 18 GB, plus its encoders and VAE.",
            "Comfy-Org/HunyuanImage_2.1_ComfyUI::split_files/diffusion_models/hunyuanimage2.1_distilled_fp8_e4m3fn.safetensors",
            &["starter-qwen25-vl", "starter-byt5-small", "starter-hunyuan-image-vae"],
        ),
        starter(
            "starter-hunyuan-image-vae",
            "hunyuan_image_2.1_vae_fp16",
            Any,
            Vae,
            "VAE of HunyuanImage 2.1.",
            "Comfy-Org/HunyuanImage_2.1_ComfyUI::split_files/vae/hunyuan_image_2.1_vae_fp16.safetensors",
            &[],
        ),
        starter(
            "starter-hunyuan-dit",
            "Hunyuan-DiT 1.2",
            HunyuanDit,
            Main,
            "Chinese-English text-to-image model; the text encoders and VAE are in the file. About 8 GB.",
            "comfyanonymous/hunyuan_dit_comfyui::hunyuan_dit_1.2.safetensors",
            &[],
        ),
        starter(
            "starter-flux2-klein-4b",
            "FLUX.2 klein 4B",
            Flux2,
            DiffusionModel,
            "Small FLUX.2 model (Apache 2.0): draws from text and edits pictures. About 8 GB, plus its encoder and VAE.",
            "black-forest-labs/FLUX.2-klein-4B::flux-2-klein-4b.safetensors",
            &["starter-qwen3-4b", "starter-flux2-vae"],
        ),
        starter(
            "starter-flux2-dev",
            "FLUX.2 dev (fp8 mixed)",
            Flux2,
            DiffusionModel,
            "Large FLUX.2 model: about 35 GB, plus its Mistral encoder and VAE.",
            "Comfy-Org/flux2-dev::split_files/diffusion_models/flux2_dev_fp8mixed.safetensors",
            &["starter-mistral3-small", "starter-flux2-vae"],
        ),
        starter(
            "starter-mistral3-small",
            "mistral_3_small_flux2_fp8",
            Any,
            TextEncoder,
            "Mistral 3 Small text encoder of FLUX.2 dev.",
            "Comfy-Org/flux2-dev::split_files/text_encoders/mistral_3_small_flux2_fp8.safetensors",
            &[],
        ),
        starter(
            "starter-flux2-vae",
            "flux2-vae",
            Any,
            Vae,
            "VAE of FLUX.2.",
            "Comfy-Org/flux2-dev::split_files/vae/flux2-vae.safetensors",
            &[],
        ),
        starter(
            "starter-hunyuan-i2v",
            "HunyuanVideo I2V 720p",
            HunyuanVideo,
            DiffusionModel,
            "Image to video. Large: about 26 GB, plus its encoders, VAE and vision model.",
            "Comfy-Org/HunyuanVideo_repackaged::split_files/diffusion_models/hunyuan_video_image_to_video_720p_bf16.safetensors",
            &["starter-flux-clip-l", "starter-hunyuan-llava", "starter-hunyuan-vae", "starter-hunyuan-vision"],
        ),
        starter(
            "starter-hunyuan-vision",
            "llava_llama3_vision",
            Any,
            ClipVision,
            "LLaVA vision model of HunyuanVideo image to video.",
            "Comfy-Org/HunyuanVideo_repackaged::split_files/clip_vision/llava_llama3_vision.safetensors",
            &[],
        ),
        starter(
            "starter-hunyuan15-t2v",
            "HunyuanVideo 1.5 T2V 480p (fp8)",
            HunyuanVideo15,
            DiffusionModel,
            "Text to video, CFG-distilled (use CFG 1). About 8 GB, plus its encoders and VAE.",
            "Comfy-Org/HunyuanVideo_1.5_repackaged::split_files/diffusion_models/hunyuanvideo1.5_480p_t2v_cfg_distilled_fp8_scaled.safetensors",
            &["starter-qwen25-vl", "starter-byt5-small", "starter-hunyuan15-vae"],
        ),
        starter(
            "starter-hunyuan15-i2v",
            "HunyuanVideo 1.5 I2V 480p (fp8)",
            HunyuanVideo15,
            DiffusionModel,
            "Image to video, CFG-distilled (use CFG 1). About 8 GB, plus its encoders, VAE and vision model.",
            "Comfy-Org/HunyuanVideo_1.5_repackaged::split_files/diffusion_models/hunyuanvideo1.5_480p_i2v_cfg_distilled_fp8_scaled.safetensors",
            &["starter-qwen25-vl", "starter-byt5-small", "starter-hunyuan15-vae", "starter-sigclip-vision"],
        ),
        starter(
            "starter-byt5-small",
            "byt5_small_glyphxl_fp16",
            Any,
            TextEncoder,
            "ByT5 text encoder of HunyuanVideo 1.5.",
            "Comfy-Org/HunyuanVideo_1.5_repackaged::split_files/text_encoders/byt5_small_glyphxl_fp16.safetensors",
            &[],
        ),
        starter(
            "starter-hunyuan15-vae",
            "hunyuanvideo15_vae_fp16",
            Any,
            Vae,
            "VAE of HunyuanVideo 1.5.",
            "Comfy-Org/HunyuanVideo_1.5_repackaged::split_files/vae/hunyuanvideo15_vae_fp16.safetensors",
            &[],
        ),
        starter(
            "starter-sigclip-vision",
            "sigclip_vision_patch14_384",
            Any,
            ClipVision,
            "Vision model of HunyuanVideo 1.5 image to video.",
            "Comfy-Org/HunyuanVideo_1.5_repackaged::split_files/clip_vision/sigclip_vision_patch14_384.safetensors",
            &[],
        ),
        starter(
            "starter-ltx2",
            "LTX-2 19B dev (fp8)",
            Ltx2,
            Main,
            "Video with sound, text or image to video. Large: about 27 GB, plus the Gemma encoder (13 GB).",
            "Lightricks/LTX-2::ltx-2-19b-dev-fp8.safetensors",
            &["starter-gemma3-12b"],
        ),
        starter(
            "starter-gemma3-12b",
            "gemma_3_12B_it_fp8_scaled",
            Any,
            TextEncoder,
            "Gemma 3 12B text encoder of LTX-2.",
            "Comfy-Org/ltx-2::split_files/text_encoders/gemma_3_12B_it_fp8_scaled.safetensors",
            &[],
        ),
        starter(
            "starter-hunyuan-video",
            "HunyuanVideo T2V 720p",
            HunyuanVideo,
            DiffusionModel,
            "13B text-to-video model. Large: about 26 GB, plus 9 GB of text encoder.",
            "Comfy-Org/HunyuanVideo_repackaged::split_files/diffusion_models/hunyuan_video_t2v_720p_bf16.safetensors",
            &["starter-flux-clip-l", "starter-hunyuan-llava", "starter-hunyuan-vae"],
        ),
        starter(
            "starter-hunyuan-llava",
            "llava_llama3_fp8_scaled",
            Any,
            TextEncoder,
            "LLaVA-Llama3 text encoder of HunyuanVideo.",
            "Comfy-Org/HunyuanVideo_repackaged::split_files/text_encoders/llava_llama3_fp8_scaled.safetensors",
            &[],
        ),
        starter(
            "starter-hunyuan-vae",
            "hunyuan_video_vae_bf16",
            Any,
            Vae,
            "VAE of HunyuanVideo.",
            "Comfy-Org/HunyuanVideo_repackaged::split_files/vae/hunyuan_video_vae_bf16.safetensors",
            &[],
        ),
        starter(
            "starter-ltx-video",
            "LTX-Video 2B 0.9.5",
            LtxVideo,
            Main,
            "Fast text- and image-to-video model with its VAE inside. About 6 GB, plus its text encoder.",
            "Lightricks/LTX-Video::ltx-video-2b-v0.9.5.safetensors",
            &["starter-flux-t5xxl"],
        ),
        // Control models of the newer families: model patches, loaded from `model_patches`.
        starter(
            "starter-anima-lllite-depth",
            "Anima LLLite depth",
            Anima,
            ModelPatch,
            "Depth map control for Anima.",
            "Comfy-Org/Anima-LLLite::model_patches/anima-lllite-depth-1.safetensors",
            &[],
        ),
        starter(
            "starter-anima-lllite-lineart",
            "Anima LLLite lineart",
            Anima,
            ModelPatch,
            "Line art control for Anima.",
            "Comfy-Org/Anima-LLLite::model_patches/anima-lllite-lineart-1.safetensors",
            &[],
        ),
        starter(
            "starter-anima-lllite-pose",
            "Anima LLLite pose",
            Anima,
            ModelPatch,
            "Pose (OpenPose) control for Anima.",
            "Comfy-Org/Anima-LLLite::model_patches/anima-lllite-pose-1.safetensors",
            &[],
        ),
        starter(
            "starter-anima-lllite-scribble",
            "Anima LLLite scribble",
            Anima,
            ModelPatch,
            "Scribble control for Anima.",
            "Comfy-Org/Anima-LLLite::model_patches/anima-lllite-scribble-1.safetensors",
            &[],
        ),
        starter(
            "starter-anima-lllite-inpaint",
            "Anima LLLite inpaint",
            Anima,
            ModelPatch,
            "Inpainting control for Anima.",
            "Comfy-Org/Anima-LLLite::model_patches/anima-lllite-inpainting-v2.safetensors",
            &[],
        ),
        starter(
            "starter-z-image-fun-controlnet",
            "Z-Image Turbo Fun ControlNet Union",
            ZImage,
            ModelPatch,
            "Canny, depth, pose and other controls for Z-Image Turbo.",
            "alibaba-pai/Z-Image-Turbo-Fun-Controlnet-Union::Z-Image-Turbo-Fun-Controlnet-Union.safetensors",
            &[],
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::install::{self, Source};
    use std::collections::HashSet;

    #[test]
    fn ids_are_unique() {
        let list = starter_models();
        let ids: HashSet<&str> = list.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids.len(), list.len());
    }

    #[test]
    fn every_dependency_has_a_download_size() {
        let list = starter_models();
        for dep in list.iter().flat_map(|m| m.dependencies.iter().flatten()) {
            let found = list.iter().find(|s| &s.id == dep).unwrap();
            assert!(found.size_bytes.is_some_and(|b| b > 0), "{dep}");
        }
    }

    #[test]
    fn dependencies_name_listed_models_of_the_same_or_any_base() {
        let list = starter_models();
        for model in &list {
            for dep in model.dependencies.iter().flatten() {
                let found = list
                    .iter()
                    .find(|s| &s.id == dep)
                    .unwrap_or_else(|| panic!("{} depends on unknown {dep}", model.id));
                assert_ne!(found.id, model.id, "{} depends on itself", model.id);
                assert!(
                    found.base == model.base || found.base == BaseModel::Any,
                    "{} -> {dep}",
                    model.id
                );
            }
            // An empty list is sent as an absent field, never as `[]`.
            assert_ne!(model.dependencies.as_deref(), Some(&[][..]));
        }
    }

    #[test]
    fn a_model_loaded_in_parts_lists_every_file_the_generate_tab_looks_for() {
        use crate::comfy::split::Family;
        let list = starter_models();
        let family_of = |b: BaseModel| Family::of(b).or_else(|| Family::of_video(b));
        let in_parts = list
            .iter()
            .filter(|m| m.kind == ModelType::DiffusionModel && family_of(m.base).is_some());
        for model in in_parts {
            let family = family_of(model.base).unwrap();
            let deps: Vec<&StarterModel> = model
                .dependencies
                .iter()
                .flatten()
                .map(|d| list.iter().find(|s| &s.id == d).unwrap())
                .collect();
            // Each dependency is named so that the Generate tab finds it by the words of its family.
            let found = |kind: ModelType, words: &[&str]| {
                deps.iter().any(|d| {
                    let file = d.source.rsplit('/').next().unwrap().to_ascii_lowercase();
                    d.kind == kind && words.iter().any(|w| file.contains(w))
                })
            };
            // The variant (FLUX.2 klein or dev) decides the encoder; a GGUF file has no header, so the name says it.
            let variant = crate::models::classify::detect_variant(model.base, None, &model.source);
            for need in family.encoders_for(variant) {
                assert!(
                    found(ModelType::TextEncoder, need.words),
                    "{}: {}",
                    model.id,
                    need.what
                );
            }
            // LTX-Video's VAE is inside its checkpoint.
            if family != Family::Ltx {
                assert!(
                    found(ModelType::Vae, family.vae().words),
                    "{}: VAE",
                    model.id
                );
            }
        }
        // A checkpoint of these families carries its parts, so it lists none.
        for model in list
            .iter()
            .filter(|m| m.kind == ModelType::Main && Family::of(m.base).is_some())
        {
            assert!(model.dependencies.is_none(), "{}", model.id);
        }
    }

    #[test]
    fn every_source_is_a_single_file_download_into_a_known_folder() {
        let models = std::path::Path::new("models");
        for model in starter_models() {
            match install::parse_source(&model.source) {
                Ok(Source::HuggingFace { .. }) => {}
                Ok(Source::Url(url)) => assert!(url.starts_with("https://"), "{url}"),
                other => panic!("{}: unexpected source {other:?}", model.id),
            }
            assert!(
                install::target_dir(models, model.kind).is_ok(),
                "{} cannot be installed",
                model.id
            );
            assert!(!model.name.trim().is_empty() && !model.description.trim().is_empty());
        }
    }

    #[test]
    fn reference_image_models_land_where_the_ipadapter_pack_looks_and_are_recognised() {
        let models = std::path::Path::new("models");
        let list = starter_models();
        let by_id = |id: &str| list.iter().find(|s| s.id == id).unwrap().clone();
        for (id, folder) in [
            ("starter-ipadapter-sdxl-vit-h", "ipadapter"),
            ("starter-ipadapter-sd15", "ipadapter"),
            ("starter-clip-vision-vit-h", "clip_vision"),
        ] {
            let s = by_id(id);
            assert_eq!(
                install::target_dir(models, s.kind).unwrap(),
                models.join(folder),
                "{id}"
            );
        }
        // The installed encoder's file name tells its size, so a ViT-H reference image finds it.
        let Ok(Source::HuggingFace { file, .. }) =
            install::parse_source(&by_id("starter-clip-vision-vit-h").source)
        else {
            panic!("a Hugging Face file")
        };
        let name = file.rsplit('/').next().unwrap();
        assert_eq!(
            crate::service::guidance::clip_vision_size(name, None),
            Some(crate::types::ClipVisionModel::VitH)
        );
        // The IP-Adapter bases come from their file names (their headers carry no base).
        for (id, base) in [
            ("starter-ipadapter-sdxl-vit-h", BaseModel::Sdxl),
            ("starter-ipadapter-sd15", BaseModel::Sd1),
        ] {
            let s = by_id(id);
            let file = s.source.rsplit('/').next().unwrap();
            assert_eq!(
                crate::models::classify::detect_base(ModelType::IpAdapter, None, file),
                base,
                "{id}"
            );
        }
    }
}
