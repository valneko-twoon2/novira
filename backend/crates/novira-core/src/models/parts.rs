//! The parts a model loaded in pieces needs (text encoders, VAE, vision model) and which of them the library lacks.
//!
//! The family-to-parts table is `comfy::split` (`Family::encoders_for`, `vae_for` and the vision `Need`s); this module
//! only asks it what a model wants, checks the installed models with the same name matching the worker uses
//! (`split::pick`), and finds the starter entry that installs each missing file.
use super::classify::{self, Header, Variant};
use super::starter;
use crate::comfy::split::{
    name_has, pick, Family, Loader, Need, WanKind, CLIP_VISION_H, LLAVA_VISION, SIGCLIP_VISION,
};
use crate::types::{BaseModel, ModelConfig, ModelPartsReport, ModelType, StarterModel};

/// How a diffusion model or checkpoint of the split families loads: on its own, or from a file that carries parts.
pub fn loader_of(kind: ModelType, base: BaseModel, header: Option<&Header>) -> Loader {
    match (kind, header.map(|h| classify::bundled_parts_for(base, h))) {
        // An unreadable header is taken as a checkpoint with every part, as the SD family's are.
        (ModelType::Main, None) => Loader::Checkpoint {
            clip: true,
            vae: true,
        },
        (_, Some((clip, vae))) if clip || vae || kind == ModelType::Main => {
            Loader::Checkpoint { clip, vae }
        }
        _ => Loader::Unet,
    }
}

/// The starter entry that installs a file of this kind with the words of `need` in its name.
fn starter_for(list: &[StarterModel], kind: ModelType, need: &Need) -> Option<StarterModel> {
    need.words.iter().find_map(|w| {
        list.iter()
            .find(|s| {
                let file = s
                    .source
                    .rsplit('/')
                    .next()
                    .unwrap_or(&s.source)
                    .to_ascii_lowercase();
                s.kind == kind && name_has(&file, w) && !need.avoid.iter().any(|a| file.contains(a))
            })
            .cloned()
    })
}

/// What `model` needs beyond itself that is not among `models`: the starter entries that install it, and the wording
/// of what has no entry. Nothing for a model that is not of a split family or that carries its parts.
pub fn missing_parts(models: &[ModelConfig], model: &ModelConfig) -> ModelPartsReport {
    let mut report = ModelPartsReport {
        model_key: model.key.clone(),
        model_name: model.name.clone(),
        missing: Vec::new(),
        unavailable: Vec::new(),
    };
    if !matches!(model.kind, ModelType::DiffusionModel | ModelType::Main) {
        return report;
    }
    let Some(family) = Family::of(model.base).or_else(|| Family::of_video(model.base)) else {
        return report;
    };
    let header = classify::read_header(std::path::Path::new(&model.path));
    let loader = loader_of(model.kind, model.base, header.as_ref());
    let name = model
        .comfy
        .as_ref()
        .map(|c| c.name.clone())
        .unwrap_or_default();
    let variant = classify::detect_variant(model.base, header.as_ref(), &name);
    let wan = (family == Family::Wan)
        .then(|| match &header {
            Some(h) => classify::wan_in_channels(h).and_then(WanKind::from_channels),
            None => WanKind::from_name(&name),
        })
        .flatten();

    let mut wanted: Vec<(ModelType, &Need)> = Vec::new();
    if !matches!(loader, Loader::Checkpoint { clip: true, .. }) {
        for need in family.encoders_for(variant) {
            wanted.push((ModelType::TextEncoder, need));
        }
    }
    // The LTX VAEs are inside the checkpoints.
    let vae = family.vae_for(wan);
    if !matches!(loader, Loader::Checkpoint { vae: true, .. })
        && !matches!(family, Family::Ltx | Family::Ltx2)
    {
        wanted.push((ModelType::Vae, &vae));
    }
    let lower = name.to_ascii_lowercase();
    let wan_embeds = match &header {
        Some(h) => classify::wan_has_image_embedding(h),
        None => !(lower.contains("2.2") || lower.contains("2_2")),
    };
    match (variant, wan) {
        (Variant::HyI2v, _) => wanted.push((ModelType::ClipVision, &LLAVA_VISION)),
        (Variant::Hy15I2v, _) => wanted.push((ModelType::ClipVision, &SIGCLIP_VISION)),
        (_, Some(WanKind::I2v)) if wan_embeds => {
            wanted.push((ModelType::ClipVision, &CLIP_VISION_H))
        }
        _ => {}
    }

    let list = starter::starter_models();
    for (kind, need) in wanted {
        if pick(models, kind, need).is_some() {
            continue;
        }
        match starter_for(&list, kind, need) {
            Some(s) if !report.missing.iter().any(|m| m.id == s.id) => report.missing.push(s),
            Some(_) => {}
            None => report.unavailable.push(need.what.to_string()),
        }
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{BaseModel, ComfyRef, ModelFormat};

    fn model(key: &str, name: &str, kind: ModelType, base: BaseModel) -> ModelConfig {
        ModelConfig {
            key: key.into(),
            name: name.into(),
            base,
            kind,
            format: ModelFormat::Checkpoint,
            description: String::new(),
            path: format!("missing/{name}"),
            size: 0,
            source: String::new(),
            default_settings: None,
            trigger_phrases: None,
            cover_image_url: None,
            cover_mature: None,
            cover_image_urls: None,
            page_url: None,
            license: None,
            comfy: Some(ComfyRef {
                folder: match kind {
                    ModelType::TextEncoder => "text_encoders",
                    ModelType::Vae => "vae",
                    _ => "diffusion_models",
                }
                .into(),
                name: name.into(),
            }),
        }
    }

    fn ids(r: &ModelPartsReport) -> Vec<&str> {
        r.missing.iter().map(|m| m.id.as_str()).collect()
    }

    #[test]
    fn a_main_model_with_an_unreadable_header_is_a_checkpoint_with_every_part() {
        assert!(matches!(
            loader_of(ModelType::Main, BaseModel::Sdxl, None),
            Loader::Checkpoint {
                clip: true,
                vae: true
            }
        ));
    }

    #[test]
    fn a_wan_image_to_video_model_by_name_wants_the_vision_model_only_before_2_2() {
        let wan = |name: &str| model("w", name, ModelType::DiffusionModel, BaseModel::Wan);
        let old = wan("wan2.1_i2v_480p.safetensors");
        let new = wan("wan2.2_i2v_high_noise.safetensors");
        let wants_vision = |m: &ModelConfig| {
            missing_parts(std::slice::from_ref(m), m)
                .missing
                .iter()
                .any(|s| s.id.contains("clip-vision"))
        };
        assert!(wants_vision(&old));
        assert!(!wants_vision(&new));
        // A text-to-video one never does.
        assert!(!wants_vision(&wan("wan2.1_t2v_1.3B.safetensors")));
    }

    #[test]
    fn anima_alone_misses_its_encoder_and_vae() {
        let anima = model(
            "a",
            "anima.safetensors",
            ModelType::DiffusionModel,
            BaseModel::Anima,
        );
        let r = missing_parts(std::slice::from_ref(&anima), &anima);
        assert_eq!(ids(&r), ["starter-qwen3-06b", "starter-qwen-image-vae"]);
        assert!(r.unavailable.is_empty());
        assert!(r.missing.iter().all(|m| m.size_bytes.is_some()));
    }

    #[test]
    fn an_installed_part_is_not_missing() {
        let anima = model(
            "a",
            "anima.safetensors",
            ModelType::DiffusionModel,
            BaseModel::Anima,
        );
        let vae = model(
            "v",
            "qwen_image_vae.safetensors",
            ModelType::Vae,
            BaseModel::Any,
        );
        let r = missing_parts(&[anima.clone(), vae], &anima);
        assert_eq!(ids(&r), ["starter-qwen3-06b"]);
    }

    #[test]
    fn nothing_is_missing_when_every_part_is_installed() {
        let anima = model(
            "a",
            "anima.safetensors",
            ModelType::DiffusionModel,
            BaseModel::Anima,
        );
        let te = model(
            "t",
            "qwen_3_06b_base.safetensors",
            ModelType::TextEncoder,
            BaseModel::Any,
        );
        let vae = model(
            "v",
            "qwen_image_vae.safetensors",
            ModelType::Vae,
            BaseModel::Any,
        );
        assert!(missing_parts(&[anima.clone(), te, vae], &anima)
            .missing
            .is_empty());
    }

    #[test]
    fn a_file_of_another_kind_does_not_count_as_the_part() {
        let anima = model(
            "a",
            "anima.safetensors",
            ModelType::DiffusionModel,
            BaseModel::Anima,
        );
        let wrong_kind = model(
            "t",
            "qwen_3_06b_base.safetensors",
            ModelType::Vae,
            BaseModel::Any,
        );
        let r = missing_parts(&[anima.clone(), wrong_kind], &anima);
        assert!(ids(&r).contains(&"starter-qwen3-06b"));
    }

    #[test]
    fn models_of_the_sd_family_and_other_kinds_miss_nothing() {
        let sdxl = model("s", "sdxl.safetensors", ModelType::Main, BaseModel::Sdxl);
        assert!(missing_parts(std::slice::from_ref(&sdxl), &sdxl)
            .missing
            .is_empty());
        let lora = model(
            "l",
            "anima_lora.safetensors",
            ModelType::Lora,
            BaseModel::Anima,
        );
        assert!(missing_parts(std::slice::from_ref(&lora), &lora)
            .missing
            .is_empty());
    }

    #[test]
    fn flux_lists_its_three_parts_and_keeps_the_whole_name_rule_of_its_vae() {
        let flux = model(
            "f",
            "flux1-dev.safetensors",
            ModelType::DiffusionModel,
            BaseModel::Flux,
        );
        // `bae.safetensors` is not Flux's `ae.safetensors`.
        let fake = model("v", "bae.safetensors", ModelType::Vae, BaseModel::Any);
        let r = missing_parts(&[flux.clone(), fake], &flux);
        assert_eq!(
            ids(&r),
            [
                "starter-flux-clip-l",
                "starter-flux-t5xxl",
                "starter-flux-ae"
            ]
        );
    }

    #[test]
    fn a_part_without_a_starter_entry_is_reported_as_unavailable() {
        let sd3 = model(
            "s",
            "sd3_medium.safetensors",
            ModelType::DiffusionModel,
            BaseModel::Sd3,
        );
        let r = missing_parts(std::slice::from_ref(&sd3), &sd3);
        assert!(
            r.unavailable.iter().any(|w| w.contains("SD3 VAE")),
            "{:?}",
            r.unavailable
        );
    }

    #[test]
    fn installing_what_is_reported_for_a_starter_model_leaves_nothing_missing() {
        for s in starter::starter_models()
            .into_iter()
            .filter(|s| s.kind == ModelType::DiffusionModel && s.dependencies.is_some())
        {
            let m = model("k", s.source.rsplit('/').next().unwrap(), s.kind, s.base);
            let r = missing_parts(std::slice::from_ref(&m), &m);
            assert!(!r.missing.is_empty(), "{}", s.id);
            assert!(r.unavailable.is_empty(), "{}: {:?}", s.id, r.unavailable);
            // The files of the reported entries, named as their sources name them, satisfy the Generate tab's matching.
            let mut library = vec![m.clone()];
            for part in &r.missing {
                let file = part.source.rsplit('/').next().unwrap();
                library.push(model(&part.id, file, part.kind, part.base));
            }
            let again = missing_parts(&library, &m);
            assert!(again.missing.is_empty(), "{}: {:?}", s.id, ids(&again));
        }
    }
}
