//! The words in a file name or in the metadata that tell a model's family and kind when its tensors say nothing:
//! one test per family word, and the metadata architectures of the SD and Flux families.
use novira_core::models::classify::{detect_base, kind_from_name, parse_header};
use novira_core::types::{BaseModel, ModelType};
use serde_json::json;

#[test]
fn a_family_word_in_the_file_name_decides_the_family_without_a_header() {
    let main = |name: &str| detect_base(ModelType::Main, None, name);
    assert_eq!(main("Qwen-Image-fp8.safetensors"), BaseModel::QwenImage);
    assert_eq!(main("qwen_image_edit.safetensors"), BaseModel::QwenImage);
    assert_eq!(main("z-image-turbo.safetensors"), BaseModel::ZImage);
    assert_eq!(main("zimage_bf16.safetensors"), BaseModel::ZImage);
    assert_eq!(main("hidream-i1-fast.safetensors"), BaseModel::Hidream);
    assert_eq!(main("auraflow_v03.safetensors"), BaseModel::Auraflow);
    assert_eq!(
        main("hunyuan_video_t2v.safetensors"),
        BaseModel::HunyuanVideo
    );
    assert_eq!(main("ltx-video-2b.safetensors"), BaseModel::LtxVideo);
    assert_eq!(main("wan2.1_t2v.safetensors"), BaseModel::Wan);
    assert_eq!(main("chroma-v40.safetensors"), BaseModel::Chroma);
    assert_eq!(main("plain.safetensors"), BaseModel::Any);
}

#[test]
fn the_words_of_a_name_give_the_kind_when_the_header_is_silent() {
    assert_eq!(
        kind_from_name("my-controlnet-canny.safetensors"),
        Some(ModelType::Controlnet)
    );
    assert_eq!(kind_from_name("sdxl_vae.safetensors"), Some(ModelType::Vae));
    assert_eq!(kind_from_name("ae.safetensors"), Some(ModelType::Vae));
    assert_eq!(
        kind_from_name("umt5_xxl_fp8.safetensors"),
        Some(ModelType::TextEncoder)
    );
    assert_eq!(
        kind_from_name("4x-UltraSharp-upscale.safetensors"),
        Some(ModelType::SpandrelImageToImage)
    );
    assert_eq!(
        kind_from_name("RealESRGAN_x4.safetensors"),
        Some(ModelType::SpandrelImageToImage)
    );
    assert_eq!(
        kind_from_name("C:\\models\\flux-lora.safetensors"),
        Some(ModelType::Lora)
    );
    assert_eq!(kind_from_name("unknown.safetensors"), None);
}

#[test]
fn the_architecture_in_the_metadata_names_the_family() {
    let base_of = |arch: &str| {
        let bytes = serde_json::to_vec(&json!({
            "__metadata__": {"modelspec.architecture": arch},
            "a.weight": { "dtype": "F16", "shape": [1], "data_offsets": [0, 2] }
        }))
        .unwrap();
        let header = parse_header(&bytes).unwrap();
        detect_base(ModelType::Main, Some(&header), "model.safetensors")
    };
    assert_eq!(base_of("stable-diffusion-xl-v1-base"), BaseModel::Sdxl);
    assert_eq!(base_of("stable-diffusion-v1"), BaseModel::Sd1);
    assert_eq!(base_of("stable-diffusion-v2-512"), BaseModel::Sd2);
    assert_eq!(base_of("stable-diffusion-v3-medium"), BaseModel::Sd3);
    assert_eq!(base_of("flux-1-dev"), BaseModel::Flux);
    assert_eq!(base_of("qwen-image"), BaseModel::QwenImage);
}
