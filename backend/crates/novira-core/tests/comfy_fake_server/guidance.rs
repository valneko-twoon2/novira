//! Masks, control layers and reference images: what is uploaded, where each picture is used, and the checks that
//! run before anything is uploaded.
use super::{engine, job, serve_with};
use novira_core::engine::{ControlJob, Engine, EngineJob, JobGuidance, RefJob};
use novira_core::types::{ComfyRef, ControlMode, GenerationMode, RefImageMethod};
use serde_json::Value;
use tokio_util::sync::CancellationToken;

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

/// A plain PNG `w` pixels wide.
fn sized(w: u32) -> Vec<u8> {
    let img = image::RgbImage::from_pixel(w, 4, image::Rgb([9, 9, 9]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

/// An inpaint job with a mask, one control layer and one reference image.
fn guided_job() -> EngineJob {
    let mut j = job("a cat", "sdxl\\base.safetensors", true);
    j.params.generation_mode = GenerationMode::Inpaint;
    j.params.control_layer_count = Some(1);
    j.params.ref_image_count = Some(1);
    j.guidance = JobGuidance {
        regions: vec![],
        references: vec![],
        mask: Some(sized(100)),
        controls: vec![ControlJob {
            model: r("controlnet", "union-xl.safetensors"),
            image: sized(200),
            weight: 0.7,
            begin_end: [0.0, 0.8],
            mode: ControlMode::Balanced,
            union_type: None,
        }],
        refs: vec![RefJob {
            model: r("ipadapter", "ip-adapter_sdxl_vit-h.safetensors"),
            clip_vision: r("clip_vision", "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"),
            image: sized(300),
            weight: 0.5,
            begin_end: [0.0, 1.0],
            method: RefImageMethod::Style,
            region: None,
        }],
    };
    j
}

/// The node a link points at.
fn target<'a>(prompt: &'a Value, link: &Value) -> &'a Value {
    &prompt[link[0].as_str().unwrap()]
}

fn node<'a>(prompt: &'a Value, class: &str) -> &'a Value {
    prompt
        .as_object()
        .unwrap()
        .values()
        .find(|n| n["class_type"] == class)
        .unwrap_or_else(|| panic!("no {class}"))
}

/// Follows image / mask inputs back to the `LoadImage` they start from and returns its file name.
fn loaded_from(prompt: &Value, link: &Value) -> Value {
    let mut at = link;
    loop {
        let n = target(prompt, at);
        if n["class_type"] == "LoadImage" {
            return n["inputs"]["image"].clone();
        }
        let inputs = n["inputs"].as_object().unwrap();
        at = inputs
            .get("mask")
            .or(inputs.get("image"))
            .expect("a mask or image input");
    }
}

#[tokio::test]
async fn guided_jobs_upload_the_mask_control_and_reference_pictures_and_use_each_where_it_belongs()
{
    let (url, seen) = serve_with(true, true).await;
    let e = engine(&url);
    let j = guided_job();
    e.validate(&j).await.unwrap();
    assert!(
        seen.lock().unwrap().uploads.is_empty(),
        "validation uploads nothing"
    );
    e.generate(&j, &|_| {}, &CancellationToken::new())
        .await
        .unwrap();
    let seen = seen.lock().unwrap();
    // Source, mask, control picture, reference picture, in that order.
    assert_eq!(seen.uploads.len(), 4);
    let prompt = &seen.prompts[0];
    let noise_mask = &node(prompt, "SetLatentNoiseMask")["inputs"];
    assert_eq!(loaded_from(prompt, &noise_mask["mask"]), "up2.png");
    assert_eq!(
        loaded_from(
            prompt,
            &node(prompt, "ImageCompositeMasked")["inputs"]["destination"]
        ),
        "up1.png"
    );
    let control = &node(prompt, "ControlNetApplyAdvanced")["inputs"];
    assert_eq!(loaded_from(prompt, &control["image"]), "up3.png");
    assert_eq!(
        target(prompt, &control["control_net"])["inputs"]["control_net_name"],
        "union-xl.safetensors"
    );
    let ipa = &node(prompt, "IPAdapterAdvanced")["inputs"];
    assert_eq!(loaded_from(prompt, &ipa["image"]), "up4.png");
    assert_eq!(ipa["weight_type"], "style transfer");
    assert_eq!(
        target(prompt, &ipa["clip_vision"])["inputs"]["clip_name"],
        "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"
    );
}

#[tokio::test]
async fn reference_images_without_the_ipadapter_pack_are_refused_before_anything_is_uploaded() {
    let (url, seen) = serve_with(true, false).await;
    let err = engine(&url)
        .validate(&guided_job())
        .await
        .unwrap_err()
        .to_string();
    assert!(err.contains("ComfyUI_IPAdapter_plus"), "{err}");
    assert!(seen.lock().unwrap().uploads.is_empty());
    // Control layers alone use core nodes only and do not need the pack.
    let mut j = guided_job();
    j.guidance.refs.clear();
    j.params.ref_image_count = None;
    engine(&url).validate(&j).await.unwrap();
}

#[tokio::test]
async fn guidance_models_comfyui_cannot_see_are_named() {
    let (url, _) = serve_with(true, true).await;
    let mut j = guided_job();
    j.guidance.controls[0].model = r("controlnet", "missing-cn.safetensors");
    let err = engine(&url).validate(&j).await.unwrap_err().to_string();
    assert!(err.contains("missing-cn.safetensors"), "{err}");
}

#[tokio::test]
async fn a_graph_that_needs_a_pack_the_engine_lacks_names_the_pack() {
    // The fake ComfyUI has none of the pack nodes.
    let (url, _) = serve_with(true, true).await;
    // Seamless tiling: its nodes come from the seamless tiling pack.
    let mut j = job("a cat", "sdxl\\base.safetensors", false);
    j.params.seamless_x = true;
    let err = engine(&url).validate(&j).await.unwrap_err().to_string();
    assert!(
        err.contains("Seamless tiling")
            && err.contains("ComfyUI-seamless-tiling")
            && err.contains("Extensions"),
        "{err}"
    );
    // A GGUF model: the loaders come from the GGUF pack.
    let mut j = job("a cat", "sdxl\\base.safetensors", false);
    j.checkpoint = r("diffusion_models", "model-Q4_K_M.gguf");
    j.split = Some(novira_core::comfy::split::SplitJob::new(
        novira_core::comfy::split::Family::ZImage,
        novira_core::comfy::split::Loader::Unet,
        vec![r("text_encoders", "qwen.safetensors")],
    ));
    j.vae = Some(r("vae", "ae.safetensors"));
    let err = engine(&url).validate(&j).await.unwrap_err().to_string();
    assert!(
        err.contains("GGUF models") && err.contains("ComfyUI-GGUF"),
        "{err}"
    );
    // Without either, the job validates as before.
    let plain = job("a cat", "sdxl\\base.safetensors", false);
    engine(&url).validate(&plain).await.unwrap();
}
