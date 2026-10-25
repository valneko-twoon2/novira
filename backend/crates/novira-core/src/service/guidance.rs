//! Guidance pictures of an image job (inpaint mask, control layers, reference images): the checks made when the job
//! is enqueued, and the worker's resolution of their models and pictures. The pictures themselves are gallery images;
//! their names are checked by the queue (`image_name_from_url`).
use super::*;
use crate::engine::{ControlJob, JobGuidance, RefJob, RegionJob};

/// At most this many control layers in one job (each loads a ControlNet).
pub const MAX_CONTROL_LAYERS: usize = 8;
/// At most this many reference images in one job (each runs the image encoder and patches the model).
pub const MAX_REF_IMAGES: usize = 8;
/// The most pictures a main model takes in itself as references at once (FLUX.2); each one makes the job slower.
pub const MAX_REFERENCE_PICTURES: usize = 4;
/// Regional guidance layers at once.
pub const MAX_REGIONAL_LAYERS: usize = 8;
/// The longest prompt of a regional layer, in characters.
const MAX_REGION_PROMPT: usize = 10_000;
const MAX_KEY_LEN: usize = 300;
const MAX_URL_LEN: usize = 2048;

fn check_span(what: &str, begin_end: [f64; 2]) -> std::result::Result<(), String> {
    let [b, e] = begin_end;
    if !(b.is_finite()
        && e.is_finite()
        && (0.0..=1.0).contains(&b)
        && (0.0..=1.0).contains(&e)
        && b <= e)
    {
        return Err(format!(
            "{what}: begin and end must be fractions of the steps with begin not after end"
        ));
    }
    Ok(())
}

fn check_weight(
    what: &str,
    w: f64,
    range: std::ops::RangeInclusive<f64>,
) -> std::result::Result<(), String> {
    if !(w.is_finite() && range.contains(&w)) {
        return Err(format!(
            "{what}: the weight must be between {} and {}",
            range.start(),
            range.end()
        ));
    }
    Ok(())
}

fn check_ref(what: &str, url: &str, key: &str) -> std::result::Result<(), String> {
    if url.is_empty() || url.len() > MAX_URL_LEN {
        return Err(format!("{what}: the picture is missing"));
    }
    if key.trim().is_empty() || key.len() > MAX_KEY_LEN {
        return Err(format!("{what}: no model is chosen"));
    }
    Ok(())
}

/// Checks the shape of a job's guidance against its mode before it is queued (the frontend is not trusted).
pub fn check(
    g: &Guidance,
    p: &GenerationMetadata,
    has_source: bool,
) -> std::result::Result<(), String> {
    if g.control_layers.len() > MAX_CONTROL_LAYERS {
        return Err(format!(
            "At most {MAX_CONTROL_LAYERS} control layers can be used at once"
        ));
    }
    if g.ref_images.len() > MAX_REF_IMAGES {
        return Err(format!(
            "At most {MAX_REF_IMAGES} reference images can be used at once"
        ));
    }
    if g.reference_pictures.len() > MAX_REFERENCE_PICTURES {
        return Err(format!(
            "At most {MAX_REFERENCE_PICTURES} reference pictures can be given to the model at once"
        ));
    }
    for (i, url) in g.reference_pictures.iter().enumerate() {
        if url.is_empty() || url.len() > MAX_URL_LEN {
            return Err(format!(
                "Reference picture {}: the picture is missing",
                i + 1
            ));
        }
    }
    if g.regional_layers.len() > MAX_REGIONAL_LAYERS {
        return Err(format!(
            "At most {MAX_REGIONAL_LAYERS} regional guidance layers can be used at once"
        ));
    }
    let image_mode = matches!(
        p.generation_mode,
        GenerationMode::Txt2img
            | GenerationMode::Img2img
            | GenerationMode::Inpaint
            | GenerationMode::Outpaint
    );
    if !image_mode && !g.is_empty() {
        return Err(
            "Masks, control layers and reference images are only used for image generation".into(),
        );
    }
    let masked = matches!(
        p.generation_mode,
        GenerationMode::Inpaint | GenerationMode::Outpaint
    );
    match &g.mask_image_url {
        Some(_) if !masked => return Err("A mask is only used for inpaint and outpaint".into()),
        Some(url) if url.is_empty() || url.len() > MAX_URL_LEN => {
            return Err("The mask is missing".into())
        }
        Some(_) if !has_source => return Err("A mask needs a source image".into()),
        None if masked => return Err("Inpaint and outpaint need a mask".into()),
        _ => {}
    }
    if p.control_layer_count.unwrap_or(0) as usize != g.control_layers.len() {
        return Err("The control layer count does not match the control layers sent".into());
    }
    if p.ref_image_count.unwrap_or(0) as usize != g.ref_images.len() {
        return Err("The reference image count does not match the reference images sent".into());
    }
    if p.regional_guidance_count.unwrap_or(0) as usize != g.regional_layers.len() {
        return Err("The regional guidance count does not match the regional layers sent".into());
    }
    for (i, r) in g.regional_layers.iter().enumerate() {
        let what = format!("Regional guidance layer {}", i + 1);
        if r.image_url.is_empty() || r.image_url.len() > MAX_URL_LEN {
            return Err(format!("{what}: the region is missing"));
        }
        let said = |t: &Option<String>| t.as_deref().is_some_and(|t| !t.trim().is_empty());
        if !said(&r.positive_prompt) && !said(&r.negative_prompt) {
            return Err(format!("{what}: it has no prompt"));
        }
        for text in [&r.positive_prompt, &r.negative_prompt]
            .into_iter()
            .flatten()
        {
            if text.chars().count() > MAX_REGION_PROMPT {
                return Err(format!("{what}: the prompt is too long"));
            }
        }
    }
    for (i, c) in g.control_layers.iter().enumerate() {
        let what = format!("Control layer {}", i + 1);
        check_ref(&what, &c.image_url, &c.model_key)?;
        // ComfyUI's ControlNet strength has no negative side.
        check_weight(&what, c.weight, 0.0..=2.0)?;
        check_span(&what, c.begin_end)?;
    }
    for (i, r) in g.ref_images.iter().enumerate() {
        let what = format!("Reference image {}", i + 1);
        check_ref(&what, &r.image_url, &r.model_key)?;
        check_weight(&what, r.weight, -1.0..=2.0)?;
        check_span(&what, r.begin_end)?;
        if let Some(url) = &r.region_image_url {
            if url.is_empty() || url.len() > MAX_URL_LEN {
                return Err(format!("{what}: the region is missing"));
            }
        }
    }
    Ok(())
}

/// Whether a model of `base` can be used with a main model of `main`.
pub fn compatible(main: BaseModel, base: BaseModel) -> bool {
    main == base || main == BaseModel::Any || base == BaseModel::Any
}

fn base_name(b: BaseModel) -> String {
    serde_json::to_value(b)
        .ok()
        .and_then(|v| v.as_str().map(str::to_string))
        .unwrap_or_default()
}

/// The image encoder size a CLIP vision file holds: from its name, else from the number of encoder layers in its
/// safetensors header (24 = ViT-L, 32 = ViT-H, 48 = ViT-bigG).
pub fn clip_vision_size(
    file_name: &str,
    header: Option<&classify::Header>,
) -> Option<ClipVisionModel> {
    let n = file_name.to_ascii_lowercase().replace('_', "-");
    if n.contains("bigg") || n.contains("vit-g") {
        return Some(ClipVisionModel::VitG);
    }
    if n.contains("vit-h") {
        return Some(ClipVisionModel::VitH);
    }
    if n.contains("vit-l") {
        return Some(ClipVisionModel::VitL);
    }
    let layers = header?
        .keys
        .iter()
        .filter_map(|k| k.strip_prefix("vision_model.encoder.layers."))
        .filter_map(|rest| rest.split('.').next()?.parse::<u32>().ok())
        .max()?
        + 1;
    match layers {
        48 => Some(ClipVisionModel::VitG),
        32 => Some(ClipVisionModel::VitH),
        24 => Some(ClipVisionModel::VitL),
        _ => None,
    }
}

fn clip_vision_label(m: ClipVisionModel) -> &'static str {
    match m {
        ClipVisionModel::VitH => "ViT-H",
        ClipVisionModel::VitG => "ViT-G",
        ClipVisionModel::VitL => "ViT-L",
    }
}

impl Backend {
    /// A guidance model by key, checked to be of `kind` and to fit the main model.
    fn guidance_model(
        &self,
        key: &str,
        kind: ModelType,
        main: BaseModel,
        what: &str,
    ) -> std::result::Result<ComfyRef, EngineError> {
        let s = self.state();
        let m = s
            .models
            .iter()
            .find(|m| m.key == key)
            .ok_or_else(|| EngineError::Failed(format!("{what}: model not found: {key}")))?;
        // A model patch is a control model of the newer families (Anima LLLite, the Fun ControlNets).
        let patch_as_control = kind == ModelType::Controlnet && m.kind == ModelType::ModelPatch;
        if m.kind != kind && !patch_as_control {
            return Err(EngineError::Failed(format!(
                "{what}: {} is not a {} model",
                m.name,
                if kind == ModelType::Controlnet {
                    "ControlNet"
                } else {
                    "IP-Adapter"
                }
            )));
        }
        if !compatible(main, m.base) {
            return Err(EngineError::Failed(format!(
                "{what}: {} is for {} models, the main model is {}",
                m.name,
                base_name(m.base),
                base_name(main)
            )));
        }
        m.comfy.clone().ok_or_else(|| {
            EngineError::Failed(format!("{what}: {} cannot be used with ComfyUI", m.name))
        })
    }

    /// What a control layer's union ControlNet is told its picture is: the layer's kind, for a union model of the SD
    /// family. None for another model, a picture of unknown kind or a main model of the newer families, whose
    /// union models number their kinds differently.
    fn union_type(
        &self,
        key: &str,
        kind: Option<ControlType>,
        main: BaseModel,
    ) -> Option<&'static str> {
        let kind = kind?;
        if !matches!(main, BaseModel::Sd1 | BaseModel::Sd2 | BaseModel::Sdxl) {
            return None;
        }
        let s = self.state();
        let m = s.models.iter().find(|m| m.key == key)?;
        crate::comfy::graph::is_union_controlnet(&m.name, &m.path, &m.source)
            .then(|| crate::comfy::graph::union_type(kind))
    }

    /// The installed CLIP vision model of the wanted size.
    pub(super) fn clip_vision_model(
        &self,
        size: ClipVisionModel,
        what: &str,
    ) -> std::result::Result<ComfyRef, EngineError> {
        let candidates: Vec<(PathBuf, Option<ComfyRef>)> = self
            .state()
            .models
            .iter()
            .filter(|m| m.kind == ModelType::ClipVision)
            .map(|m| (PathBuf::from(&m.path), m.comfy.clone()))
            .collect();
        candidates
            .into_iter()
            .find_map(|(path, comfy)| {
                let name = path.file_name()?.to_string_lossy().into_owned();
                let header = classify::read_header(&path);
                (clip_vision_size(&name, header.as_ref()) == Some(size))
                    .then_some(comfy)
                    .flatten()
            })
            .ok_or_else(|| {
                EngineError::Failed(format!(
                    "{what}: no {} CLIP vision model is installed; install one (for example CLIP ViT-H from the starter models)",
                    clip_vision_label(size)
                ))
            })
    }

    fn read_guidance_image(
        &self,
        url: &str,
        what: &str,
    ) -> std::result::Result<Vec<u8>, EngineError> {
        let name = self
            .image_name_from_url(url)
            .filter(|n| !images::is_video(n) && !images::is_audio(n))
            .ok_or_else(|| EngineError::Failed(format!("{what}: not a stored picture")))?;
        self.inner
            .files
            .read_original(&name)
            .ok_or_else(|| EngineError::Failed(format!("{what}: the picture was deleted")))
    }

    /// Resolves the models and reads the pictures of a queued job's guidance. (FLUX and SD3 main models are refused
    /// before this by the worker, so an IP-Adapter or ControlNet only has to fit an SD 1.5 / 2 / SDXL model.)
    pub(super) fn job_guidance(
        &self,
        item: &QueueItem,
    ) -> std::result::Result<JobGuidance, EngineError> {
        let g = &item.guidance;
        if g.is_empty() {
            return Ok(JobGuidance::default());
        }
        let main = self
            .state()
            .models
            .iter()
            .find(|m| m.key == item.params.model_key)
            .map(|m| m.base)
            .unwrap_or(BaseModel::Any);
        // Only FLUX.2 takes pictures in itself as references; the other models take them through an IP-Adapter.
        if !g.reference_pictures.is_empty() && main != BaseModel::Flux2 {
            return Err(EngineError::Failed(
                "Reference pictures are taken in by FLUX.2 models only; the other models use reference images".into(),
            ));
        }
        let mut references = Vec::new();
        for (i, url) in g.reference_pictures.iter().enumerate() {
            references
                .push(self.read_guidance_image(url, &format!("Reference picture {}", i + 1))?);
        }
        let mask = match &g.mask_image_url {
            Some(url) => Some(self.read_guidance_image(url, "The mask")?),
            None => None,
        };
        let mut controls = Vec::new();
        for (i, c) in g.control_layers.iter().enumerate() {
            let what = format!("Control layer {}", i + 1);
            controls.push(ControlJob {
                model: self.guidance_model(&c.model_key, ModelType::Controlnet, main, &what)?,
                image: self.read_guidance_image(&c.image_url, &what)?,
                weight: c.weight,
                begin_end: c.begin_end,
                mode: c.control_mode,
                union_type: self.union_type(&c.model_key, c.control_type, main),
            });
        }
        let mut regions = Vec::new();
        for (i, r) in g.regional_layers.iter().enumerate() {
            let what = format!("Regional guidance layer {}", i + 1);
            regions.push(RegionJob {
                mask: self.read_guidance_image(&r.image_url, &what)?,
                positive: r.positive_prompt.clone().filter(|t| !t.trim().is_empty()),
                negative: r.negative_prompt.clone().filter(|t| !t.trim().is_empty()),
                auto_negative: r.auto_negative,
            });
        }
        let mut refs = Vec::new();
        for (i, r) in g.ref_images.iter().enumerate() {
            let what = format!("Reference image {}", i + 1);
            refs.push(RefJob {
                model: self.guidance_model(&r.model_key, ModelType::IpAdapter, main, &what)?,
                clip_vision: self.clip_vision_model(r.clip_vision_model, &what)?,
                image: self.read_guidance_image(&r.image_url, &what)?,
                weight: r.weight,
                begin_end: r.begin_end,
                method: r.method,
                region: match &r.region_image_url {
                    Some(url) => {
                        Some(self.read_guidance_image(url, &format!("{what}: the region"))?)
                    }
                    None => None,
                },
            });
        }
        Ok(JobGuidance {
            mask,
            controls,
            regions,
            refs,
            references,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn params(mode: &str, controls: u32, refs: u32) -> GenerationMetadata {
        let mut p: GenerationMetadata = serde_json::from_value(json!({
            "generationMode": mode, "positivePrompt": "", "negativePrompt": "", "modelKey": "m", "modelName": "M",
            "vaeKey": null, "seed": 1, "steps": 4, "cfgScale": 7, "cfgRescale": 0, "scheduler": "euler",
            "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": []
        }))
        .unwrap();
        p.control_layer_count = (controls > 0).then_some(controls);
        p.ref_image_count = (refs > 0).then_some(refs);
        p
    }

    fn control() -> ControlLayerInput {
        ControlLayerInput {
            image_url: "http://novira-image.localhost/full/a.png".into(),
            model_key: "cn".into(),
            weight: 0.75,
            begin_end: [0.0, 0.75],
            control_mode: ControlMode::Balanced,
            control_type: None,
        }
    }

    fn reference() -> RefImageInput {
        RefImageInput {
            image_url: "http://novira-image.localhost/full/b.png".into(),
            model_key: "ipa".into(),
            clip_vision_model: ClipVisionModel::VitH,
            weight: 1.0,
            begin_end: [0.0, 1.0],
            method: RefImageMethod::Full,
            region_image_url: None,
        }
    }

    fn region(prompt: Option<&str>) -> RegionalLayerInput {
        RegionalLayerInput {
            image_url: "http://novira-image.localhost/full/r.png".into(),
            positive_prompt: prompt.map(str::to_string),
            negative_prompt: None,
            auto_negative: false,
        }
    }

    #[test]
    fn regional_layers_need_their_count_a_region_and_a_prompt() {
        let with = |layers: Vec<RegionalLayerInput>| Guidance {
            regional_layers: layers,
            ..Guidance::default()
        };
        let mut p = params("txt2img", 0, 0);
        p.regional_guidance_count = Some(1);
        assert_eq!(check(&with(vec![region(Some("a hat"))]), &p, false), Ok(()));
        // The count in the parameters must match the layers sent.
        assert!(check(&with(vec![]), &p, false)
            .unwrap_err()
            .contains("count"));
        let two = with(vec![region(Some("a")), region(Some("b"))]);
        assert!(check(&two, &p, false).unwrap_err().contains("count"));
        // A layer without a prompt does nothing, one without a region has nothing to confine.
        assert!(check(&with(vec![region(None)]), &p, false)
            .unwrap_err()
            .contains("no prompt"));
        assert!(check(&with(vec![region(Some("  "))]), &p, false)
            .unwrap_err()
            .contains("no prompt"));
        let mut bare = region(Some("a"));
        bare.image_url.clear();
        assert!(check(&with(vec![bare]), &p, false)
            .unwrap_err()
            .contains("region is missing"));
        // Too many layers, and a prompt of silly length.
        let mut many = params("txt2img", 0, 0);
        many.regional_guidance_count = Some(MAX_REGIONAL_LAYERS as u32 + 1);
        let layers = vec![region(Some("a")); MAX_REGIONAL_LAYERS + 1];
        assert!(check(&with(layers), &many, false)
            .unwrap_err()
            .contains("At most"));
        let long = region(Some(&"x".repeat(MAX_REGION_PROMPT + 1)));
        assert!(check(&with(vec![long]), &p, false)
            .unwrap_err()
            .contains("too long"));
        // Only image modes take them.
        let mut video = params("video", 0, 0);
        video.regional_guidance_count = Some(1);
        assert!(check(&with(vec![region(Some("a"))]), &video, false).is_err());
    }

    #[test]
    fn reference_pictures_are_counted_named_and_kept_to_image_modes() {
        let url = "http://novira-image.localhost/full/a.png";
        let with = |n: usize, url: &str| Guidance {
            reference_pictures: vec![url.to_string(); n],
            ..Guidance::default()
        };
        let txt = params("txt2img", 0, 0);
        assert_eq!(
            check(&with(MAX_REFERENCE_PICTURES, url), &txt, false),
            Ok(())
        );
        assert!(check(&with(MAX_REFERENCE_PICTURES + 1, url), &txt, false)
            .unwrap_err()
            .contains("At most"));
        assert!(check(&with(1, ""), &txt, false)
            .unwrap_err()
            .contains("Reference picture 1"));
        assert!(check(&with(1, url), &params("upscale", 0, 0), true).is_err());
        assert!(!with(1, url).is_empty());
    }

    #[test]
    fn well_formed_guidance_passes() {
        let g = Guidance {
            mask_image_url: Some("http://novira-image.localhost/full/m.png".into()),
            control_layers: vec![control()],
            regional_layers: vec![],
            ref_images: vec![reference()],
            reference_pictures: vec![],
        };
        assert_eq!(check(&g, &params("inpaint", 1, 1), true), Ok(()));
        assert_eq!(
            check(&Guidance::default(), &params("txt2img", 0, 0), false),
            Ok(())
        );
    }

    #[test]
    fn too_many_layers_or_references_are_refused() {
        let g = Guidance {
            control_layers: vec![control(); MAX_CONTROL_LAYERS + 1],
            ..Default::default()
        };
        assert!(check(&g, &params("txt2img", 9, 0), false)
            .unwrap_err()
            .contains("At most"));
        let g = Guidance {
            ref_images: vec![reference(); MAX_REF_IMAGES + 1],
            ..Default::default()
        };
        assert!(check(&g, &params("txt2img", 0, 9), false)
            .unwrap_err()
            .contains("At most"));
    }

    #[test]
    fn masks_belong_to_inpaint_and_outpaint_with_a_source() {
        let mask = Guidance {
            mask_image_url: Some("http://novira-image.localhost/full/m.png".into()),
            ..Default::default()
        };
        assert!(check(&mask, &params("img2img", 0, 0), true).is_err());
        assert!(check(&mask, &params("outpaint", 0, 0), false).is_err());
        assert!(check(&Guidance::default(), &params("outpaint", 0, 0), true).is_err());
        let huge = Guidance {
            mask_image_url: Some("x".repeat(MAX_URL_LEN + 1)),
            ..Default::default()
        };
        assert!(check(&huge, &params("inpaint", 0, 0), true).is_err());
    }

    #[test]
    fn guidance_is_refused_outside_image_generation_and_counts_must_match() {
        let g = Guidance {
            ref_images: vec![reference()],
            ..Default::default()
        };
        assert!(check(&g, &params("video", 0, 1), false).is_err());
        assert!(check(&g, &params("upscale", 0, 1), true).is_err());
        assert!(check(&g, &params("txt2img", 0, 0), false)
            .unwrap_err()
            .contains("count"));
        assert!(check(&Guidance::default(), &params("txt2img", 2, 0), false)
            .unwrap_err()
            .contains("count"));
    }

    #[test]
    fn weights_spans_and_keys_are_checked() {
        let bad_controls = [
            ControlLayerInput {
                weight: -0.5,
                ..control()
            },
            ControlLayerInput {
                weight: f64::NAN,
                ..control()
            },
            ControlLayerInput {
                begin_end: [0.8, 0.2],
                ..control()
            },
            ControlLayerInput {
                begin_end: [0.0, 1.5],
                ..control()
            },
            ControlLayerInput {
                model_key: " ".into(),
                ..control()
            },
            ControlLayerInput {
                image_url: String::new(),
                ..control()
            },
        ];
        for c in bad_controls {
            let g = Guidance {
                control_layers: vec![c.clone()],
                ..Default::default()
            };
            assert!(check(&g, &params("txt2img", 1, 0), false).is_err(), "{c:?}");
        }
        let g = Guidance {
            ref_images: vec![RefImageInput {
                weight: -1.0,
                // An empty span is allowed (the sliders can meet); it simply has no effect.
                begin_end: [0.5, 0.5],
                ..reference()
            }],
            ..Default::default()
        };
        assert_eq!(check(&g, &params("txt2img", 0, 1), false), Ok(()));
        let g = Guidance {
            ref_images: vec![RefImageInput {
                weight: 2.5,
                ..reference()
            }],
            ..Default::default()
        };
        assert!(check(&g, &params("txt2img", 0, 1), false).is_err());
    }

    #[test]
    fn clip_vision_size_comes_from_the_name_then_the_layer_count() {
        assert_eq!(
            clip_vision_size("CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors", None),
            Some(ClipVisionModel::VitH)
        );
        assert_eq!(
            clip_vision_size("CLIP-ViT-bigG-14-laion2B-39B-b160k.safetensors", None),
            Some(ClipVisionModel::VitG)
        );
        assert_eq!(
            clip_vision_size("clip_vit_l.safetensors", None),
            Some(ClipVisionModel::VitL)
        );
        let header = |layers: u32| classify::Header {
            keys: (0..layers)
                .map(|i| format!("vision_model.encoder.layers.{i}.mlp.fc1.weight"))
                .collect(),
            metadata: Default::default(),
            shapes: Default::default(),
        };
        assert_eq!(
            clip_vision_size("model.safetensors", Some(&header(48))),
            Some(ClipVisionModel::VitG)
        );
        assert_eq!(
            clip_vision_size("model.safetensors", Some(&header(32))),
            Some(ClipVisionModel::VitH)
        );
        assert_eq!(
            clip_vision_size("model.safetensors", Some(&header(12))),
            None
        );
        assert_eq!(clip_vision_size("model.safetensors", None), None);
    }

    #[test]
    fn any_base_fits_everything() {
        assert!(compatible(BaseModel::Sdxl, BaseModel::Sdxl));
        assert!(compatible(BaseModel::Sdxl, BaseModel::Any));
        assert!(compatible(BaseModel::Any, BaseModel::Sd1));
        assert!(!compatible(BaseModel::Sdxl, BaseModel::Sd1));
    }
}
