use super::*;
use crate::comfy::graph::{
    build as build_any, tests::params, BuiltGraph, ControlInput, GraphInput, GuidanceInput,
    RefInput,
};
use crate::types::{ControlMode, GenerationMetadata, GenerationMode, HiresFix, RefImageMethod};

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

fn job(f: Family) -> SplitJob {
    SplitJob::new(
        f,
        Loader::Unet,
        (0..f.encoders().len())
            .map(|i| r("text_encoders", &format!("te{i}.safetensors")))
            .collect(),
    )
}

fn input<'a>(
    p: &'a GenerationMetadata,
    unet: &'a ComfyRef,
    vae: Option<&'a ComfyRef>,
    split: &'a SplitJob,
) -> GraphInput<'a> {
    GraphInput {
        params: p,
        checkpoint: unet,
        vae,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        split: Some(split),
        init_image: None,
        guidance: GuidanceInput::default(),
    }
}

fn classes(g: &BuiltGraph) -> Vec<String> {
    g.prompt
        .as_object()
        .unwrap()
        .values()
        .map(|n| n["class_type"].as_str().unwrap().to_string())
        .collect()
}

fn count(g: &BuiltGraph, class: &str) -> usize {
    classes(g).iter().filter(|c| *c == class).count()
}

fn node<'a>(g: &'a BuiltGraph, class: &str) -> &'a Value {
    g.prompt
        .as_object()
        .unwrap()
        .values()
        .find(|n| n["class_type"] == class)
        .map(|n| &n["inputs"])
        .unwrap_or_else(|| panic!("no {class}"))
}

/// The node an input links to.
fn source<'a>(g: &'a BuiltGraph, link: &Value) -> &'a Value {
    &g.prompt[link[0].as_str().unwrap()]
}

fn built(f: Family) -> BuiltGraph {
    let mut p = params(GenerationMode::Txt2img);
    // Anima runs the setting, and plain `euler` is its template's.
    p.scheduler = "euler".into();
    let unet = r("diffusion_models", "model.safetensors");
    let vae = r("vae", "vae.safetensors");
    let split = job(f);
    build_any(&input(&p, &unet, Some(&vae), &split)).unwrap()
}

#[test]
fn anima_uses_a_plain_clip_loader_and_a_real_negative_prompt() {
    let g = built(Family::Anima);
    assert_eq!(node(&g, "UNETLoader")["unet_name"], "model.safetensors");
    assert_eq!(node(&g, "CLIPLoader")["type"], "stable_diffusion");
    assert_eq!(node(&g, "CLIPLoader")["clip_name"], "te0.safetensors");
    assert_eq!(count(&g, "CLIPTextEncode"), 2);
    assert_eq!(count(&g, "EmptyLatentImage"), 1);
    assert_eq!(count(&g, "ModelSamplingAuraFlow"), 0);
    assert_eq!(count(&g, "CheckpointLoaderSimple"), 0);
    let k = node(&g, "KSampler");
    assert_eq!(
        (k["sampler_name"].as_str(), k["scheduler"].as_str()),
        (Some("euler"), Some("simple"))
    );
    assert_eq!(k["cfg"], 6.5);
    assert_eq!(k["steps"], 20);
}

#[test]
fn flux_loads_two_encoders_and_gives_the_strength_to_the_guidance_node() {
    let g = built(Family::Flux);
    let dual = node(&g, "DualCLIPLoader");
    assert_eq!(dual["clip_name1"], "te0.safetensors");
    assert_eq!(dual["clip_name2"], "te1.safetensors");
    assert_eq!(dual["type"], "flux");
    assert_eq!(node(&g, "FluxGuidance")["guidance"], 6.5);
    assert_eq!(node(&g, "KSampler")["cfg"], 1.0);
    assert_eq!(count(&g, "CLIPTextEncode"), 1);
    assert_eq!(count(&g, "ConditioningZeroOut"), 1);
    assert_eq!(
        source(&g, &node(&g, "KSampler")["positive"])["class_type"],
        "FluxGuidance"
    );
}

#[test]
fn each_family_has_its_loaders_shift_latent_and_sampler() {
    let cases = [
        (
            Family::Chroma,
            "CLIPLoader",
            Some(("ModelSamplingAuraFlow", 1.0)),
            "EmptySD3LatentImage",
            ("euler", "beta"),
        ),
        (
            Family::QwenImage,
            "CLIPLoader",
            Some(("ModelSamplingAuraFlow", 3.1)),
            "EmptySD3LatentImage",
            ("euler", "simple"),
        ),
        (
            Family::ZImage,
            "CLIPLoader",
            Some(("ModelSamplingAuraFlow", 3.0)),
            "EmptySD3LatentImage",
            ("res_multistep", "simple"),
        ),
        (
            Family::Auraflow,
            "CLIPLoader",
            Some(("ModelSamplingAuraFlow", 1.73)),
            "EmptyLatentImage",
            ("euler", "normal"),
        ),
        (
            Family::Sd3,
            "TripleCLIPLoader",
            None,
            "EmptySD3LatentImage",
            ("euler", "sgm_uniform"),
        ),
        (
            Family::Hidream,
            "QuadrupleCLIPLoader",
            Some(("ModelSamplingSD3", 3.0)),
            "EmptySD3LatentImage",
            ("uni_pc", "simple"),
        ),
    ];
    for (f, loader, shift, latent, (sampler, scheduler)) in cases {
        let g = built(f);
        assert_eq!(count(&g, loader), 1, "{f:?}");
        match shift {
            Some((class, value)) => {
                assert_eq!(node(&g, class)["shift"].as_f64(), Some(value), "{f:?}")
            }
            None => assert_eq!(
                count(&g, "ModelSamplingAuraFlow") + count(&g, "ModelSamplingSD3"),
                0
            ),
        }
        assert_eq!(count(&g, latent), 1, "{f:?}");
        let k = node(&g, "KSampler");
        assert_eq!(k["sampler_name"], sampler, "{f:?}");
        assert_eq!(k["scheduler"], scheduler, "{f:?}");
        assert_eq!(count(&g, "CLIPTextEncode"), 2, "{f:?}");
    }
    assert_eq!(node(&built(Family::Chroma), "CLIPLoader")["type"], "chroma");
    assert_eq!(
        node(&built(Family::QwenImage), "CLIPLoader")["type"],
        "qwen_image"
    );
    assert_eq!(
        node(&built(Family::ZImage), "CLIPLoader")["type"],
        "lumina2"
    );
    let hidream = built(Family::Hidream);
    assert_eq!(
        node(&hidream, "QuadrupleCLIPLoader")["clip_name4"],
        "te3.safetensors"
    );
}

#[test]
fn every_family_of_the_shared_graph_drafts_with_the_advanced_sampler() {
    let unet = r("diffusion_models", "model.safetensors");
    let vae = r("vae", "vae.safetensors");
    for f in [
        Family::Anima,
        Family::Flux,
        Family::Chroma,
        Family::QwenImage,
        Family::ZImage,
        Family::Sd3,
        Family::Hidream,
        Family::Auraflow,
        Family::HunyuanImage,
    ] {
        let split = job(f);
        let mut p = params(GenerationMode::Txt2img);
        p.scheduler = "euler".into();
        p.steps = 30;
        p.draft_at = Some(0.35);
        let g = build_any(&input(&p, &unet, Some(&vae), &split)).unwrap();
        let full = built(f);
        let k = node(&g, "KSamplerAdvanced");
        let (sampler, scheduler) = f.sampling();
        // The same schedule as the finished run, stopped at the draft step and denoised to the end.
        assert_eq!(k["steps"], 30, "{f:?}");
        assert_eq!(k["start_at_step"], 0, "{f:?}");
        assert_eq!(k["end_at_step"], 11, "{f:?}");
        assert_eq!(k["return_with_leftover_noise"], "disable", "{f:?}");
        assert_eq!(k["add_noise"], "enable", "{f:?}");
        assert_eq!(k["sampler_name"], sampler, "{f:?}");
        assert_eq!(k["scheduler"], scheduler, "{f:?}");
        assert_eq!(k["cfg"], node(&full, "KSampler")["cfg"], "{f:?}");
        assert_eq!(
            source(&g, &k["latent_image"])["class_type"],
            f.latent(),
            "{f:?}"
        );
        assert_eq!(count(&g, "KSampler"), 0, "{f:?}");
        assert_eq!(g.total_steps, 11, "{f:?}");
        // Everything before the sampler is the finished run's: loaders, shift, encoders.
        let mut before = classes(&g);
        let mut finished = classes(&full);
        before.retain(|c| c != "KSamplerAdvanced");
        finished.retain(|c| c != "KSampler");
        before.sort();
        finished.sort();
        assert_eq!(before, finished, "{f:?}");
        let mut late = p.clone();
        late.generation_mode = GenerationMode::Img2img;
        let mut i = input(&late, &unet, Some(&vae), &split);
        i.init_image = Some("a.png");
        assert!(
            build_any(&i).unwrap_err().contains("text to image"),
            "{f:?}"
        );
    }
}

#[test]
fn a_checkpoint_gives_the_parts_it_carries_and_the_rest_are_loaded_beside_it() {
    let p = params(GenerationMode::Txt2img);
    let ckpt = r("checkpoints", "sd3.5_large.safetensors");
    // Everything inside: no encoder or VAE loader.
    let all = SplitJob::new(
        Family::Sd3,
        Loader::Checkpoint {
            clip: true,
            vae: true,
        },
        vec![],
    );
    let g = build_any(&input(&p, &ckpt, None, &all)).unwrap();
    assert_eq!(
        node(&g, "CheckpointLoaderSimple")["ckpt_name"],
        "sd3.5_large.safetensors"
    );
    assert_eq!(
        count(&g, "TripleCLIPLoader") + count(&g, "VAELoader") + count(&g, "UNETLoader"),
        0
    );
    assert_eq!(node(&g, "VAEDecode")["vae"][1], 2);
    // Without its encoders: the three are loaded and the checkpoint gives the model and the VAE.
    let bare = SplitJob::new(
        Family::Sd3,
        Loader::Checkpoint {
            clip: false,
            vae: true,
        },
        job(Family::Sd3).text_encoders,
    );
    let g = build_any(&input(&p, &ckpt, None, &bare)).unwrap();
    assert_eq!(count(&g, "TripleCLIPLoader"), 1);
    assert_eq!(
        source(&g, &node(&g, "CLIPTextEncode")["clip"])["class_type"],
        "TripleCLIPLoader"
    );
}

#[test]
fn a_lora_goes_between_the_loaders_and_the_shift() {
    let p = params(GenerationMode::Txt2img);
    let unet = r("diffusion_models", "m.safetensors");
    let vae = r("vae", "v.safetensors");
    let lora = r("loras", "style.safetensors");
    let split = job(Family::QwenImage);
    let mut i = input(&p, &unet, Some(&vae), &split);
    i.loras = vec![(&lora, 0.8)];
    let g = build_any(&i).unwrap();
    assert_eq!(node(&g, "LoraLoader")["strength_model"], 0.8);
    assert_eq!(
        source(&g, &node(&g, "ModelSamplingAuraFlow")["model"])["class_type"],
        "LoraLoader"
    );
    assert_eq!(
        source(&g, &node(&g, "CLIPTextEncode")["clip"])["class_type"],
        "LoraLoader"
    );
}

#[test]
fn image_to_image_inpaint_and_the_high_resolution_fix_use_the_shared_graph() {
    let unet = r("diffusion_models", "m.safetensors");
    let vae = r("vae", "v.safetensors");
    let split = job(Family::Flux);
    // Image to image: the source is encoded and redrawn at the strength.
    let mut p = params(GenerationMode::Img2img);
    p.strength = Some(0.55);
    let mut i = input(&p, &unet, Some(&vae), &split);
    i.init_image = Some("src.png");
    let g = build_any(&i).unwrap();
    assert_eq!(node(&g, "LoadImage")["image"], "src.png");
    assert_eq!(node(&g, "KSampler")["denoise"], 0.55);
    // Inpaint: the mask limits the redraw and the kept part is pasted back.
    let mut p = params(GenerationMode::Inpaint);
    p.strength = Some(1.0);
    let mut i = input(&p, &unet, Some(&vae), &split);
    i.init_image = Some("src.png");
    i.guidance.mask_image = Some("mask.png");
    let g = build_any(&i).unwrap();
    assert_eq!(count(&g, "SetLatentNoiseMask"), 1);
    assert_eq!(count(&g, "DifferentialDiffusion"), 1);
    assert_eq!(count(&g, "ImageCompositeMasked"), 1);
    // The high-resolution fix samples twice, both at the family's CFG (Flux: 1).
    let mut p = params(GenerationMode::Txt2img);
    p.hires_fix = Some(HiresFix {
        scale: 1.5,
        strength: 0.4,
        steps: None,
        upscale_model_key: None,
    });
    let g = build_any(&input(&p, &unet, Some(&vae), &split)).unwrap();
    let samplers: Vec<&Value> = g
        .prompt
        .as_object()
        .unwrap()
        .values()
        .filter(|n| n["class_type"] == "KSampler")
        .collect();
    assert_eq!(samplers.len(), 2);
    assert!(samplers.iter().all(|k| k["inputs"]["cfg"] == 1.0));
    assert!(samplers
        .iter()
        .all(|k| k["inputs"]["sampler_name"] == "euler"));
    assert_eq!(g.total_steps, 40);
}

fn control(model: &ComfyRef) -> ControlInput<'_> {
    ControlInput {
        model,
        image: "pose.png",
        weight: 0.7,
        begin_end: [0.0, 0.8],
        mode: ControlMode::Balanced,
        union_type: None,
    }
}

#[test]
fn a_controlnet_of_the_newer_families_gets_the_vae() {
    let mut p = params(GenerationMode::Txt2img);
    p.control_layer_count = Some(1);
    let unet = r("diffusion_models", "m.safetensors");
    let vae = r("vae", "v.safetensors");
    let cn = r("controlnet", "flux-union.safetensors");
    let split = job(Family::Flux);
    let mut i = input(&p, &unet, Some(&vae), &split);
    i.guidance.controls = vec![control(&cn)];
    let g = build_any(&i).unwrap();
    let apply = node(&g, "ControlNetApplyAdvanced");
    assert_eq!(apply["strength"], 0.7);
    assert_eq!(source(&g, &apply["vae"])["class_type"], "VAELoader");
}

#[test]
fn a_model_patch_control_changes_the_model_with_the_family_node() {
    let mut p = params(GenerationMode::Txt2img);
    p.control_layer_count = Some(1);
    let unet = r("diffusion_models", "m.safetensors");
    let vae = r("vae", "v.safetensors");
    let patch = r(MODEL_PATCHES, "lllite-depth.safetensors");
    let cases = [
        (Family::Anima, "AnimaLLLiteApply", false),
        (Family::ZImage, "QwenImageDiffsynthControlnet", true),
        (Family::QwenImage, "QwenImageDiffsynthControlnet", true),
    ];
    for (f, class, with_vae) in cases {
        let split = job(f);
        let mut i = input(&p, &unet, Some(&vae), &split);
        i.guidance.controls = vec![control(&patch)];
        let g = build_any(&i).unwrap();
        assert_eq!(
            node(&g, "ModelPatchLoader")["name"],
            "lllite-depth.safetensors"
        );
        let apply = node(&g, class);
        assert_eq!(apply["strength"], 0.7, "{f:?}");
        assert_eq!(apply["end_percent"], 0.8, "{f:?}");
        assert_eq!(apply.get("vae").is_some(), with_vae, "{f:?}");
        assert_eq!(count(&g, "ControlNetApplyAdvanced"), 0);
        // The sampler draws with the patched model: follow the model links back from it.
        let mut link = node(&g, "KSampler")["model"].clone();
        let mut seen = false;
        loop {
            let n = source(&g, &link);
            seen |= n["class_type"] == class;
            match n["inputs"].get("model") {
                Some(next) => link = next.clone(),
                None => break,
            }
        }
        assert!(seen, "{f:?}");
    }
    // Flux has no model patch.
    let split = job(Family::Flux);
    let mut i = input(&p, &unet, Some(&vae), &split);
    i.guidance.controls = vec![control(&patch)];
    assert!(build_any(&i)
        .unwrap_err()
        .contains("Flux models cannot use"));
}

#[test]
fn what_a_family_cannot_do_is_refused_with_a_reason() {
    let unet = r("diffusion_models", "m.safetensors");
    let vae = r("vae", "v.safetensors");
    let split = job(Family::Anima);
    let p = params(GenerationMode::Txt2img);
    let err = build_any(&input(&p, &unet, None, &split)).unwrap_err();
    assert!(err.contains("Qwen-Image VAE"), "{err}");
    let mut one = job(Family::Flux);
    one.text_encoders.pop();
    let err = build_any(&input(&p, &unet, Some(&vae), &one)).unwrap_err();
    assert!(err.contains("2 text encoder"), "{err}");
    let mut refs = params(GenerationMode::Txt2img);
    refs.ref_image_count = Some(1);
    let ipa = r("ipadapter", "ip.safetensors");
    let cv = r("clip_vision", "vit-h.safetensors");
    let mut i = input(&refs, &unet, Some(&vae), &split);
    i.guidance.refs = vec![RefInput {
        model: &ipa,
        clip_vision: &cv,
        image: "ref.png",
        weight: 0.5,
        begin_end: [0.0, 1.0],
        method: RefImageMethod::Full,
        region: None,
    }];
    assert!(build_any(&i)
        .unwrap_err()
        .contains("SD 1.5 and SDXL models only"));
}

fn model(kind: ModelType, name: &str) -> ModelConfig {
    let folder = if kind == ModelType::Vae {
        "vae"
    } else {
        "text_encoders"
    };
    serde_json::from_value(serde_json::json!({
        "key": name, "name": name, "base": "any", "type": kind, "format": "checkpoint",
        "description": "", "path": name, "size": 1, "source": "local",
        "comfy": { "folder": folder, "name": name }
    }))
    .unwrap()
}

#[test]
fn the_installed_encoder_and_vae_are_found_by_the_words_in_their_names() {
    let models = vec![
        model(
            ModelType::TextEncoder,
            "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        ),
        model(ModelType::TextEncoder, "qwen_3_4b.safetensors"),
        model(ModelType::TextEncoder, "qwen_3_06b_base.safetensors"),
        model(ModelType::TextEncoder, "clip_l_hidream.safetensors"),
        model(ModelType::TextEncoder, "clip_l.safetensors"),
        model(ModelType::TextEncoder, "t5xxl_fp16.safetensors"),
        model(ModelType::Vae, "qwen_image_vae.safetensors"),
        model(ModelType::Vae, "bae.safetensors"),
        model(ModelType::Vae, "ae.safetensors"),
    ];
    let enc = |f: Family, i: usize| {
        pick(&models, ModelType::TextEncoder, &f.encoders()[i]).map(|m| m.name.clone())
    };
    assert_eq!(
        enc(Family::Anima, 0).as_deref(),
        Some("qwen_3_06b_base.safetensors")
    );
    assert_eq!(
        enc(Family::ZImage, 0).as_deref(),
        Some("qwen_3_4b.safetensors")
    );
    assert_eq!(
        enc(Family::Flux, 1).as_deref(),
        Some("t5xxl_fp16.safetensors")
    );
    // HiDream's long CLIP-L is not Flux's, and the other way round.
    assert_eq!(enc(Family::Flux, 0).as_deref(), Some("clip_l.safetensors"));
    assert_eq!(
        enc(Family::Hidream, 0).as_deref(),
        Some("clip_l_hidream.safetensors")
    );
    assert_eq!(enc(Family::QwenImage, 0), None);
    // Wan's UMT5-XXL is not a T5-XXL, though "t5_xxl" is part of its name.
    let only_umt5 = vec![model(
        ModelType::TextEncoder,
        "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    )];
    assert!(pick(
        &only_umt5,
        ModelType::TextEncoder,
        &Family::Chroma.encoders()[0]
    )
    .is_none());
    assert!(pick(
        &only_umt5,
        ModelType::TextEncoder,
        &Family::Wan.encoders()[0]
    )
    .is_some());
    let vae = |f: Family| pick(&models, ModelType::Vae, &f.vae()).map(|m| m.name.clone());
    assert_eq!(vae(Family::Flux).as_deref(), Some("ae.safetensors"));
    assert_eq!(
        vae(Family::Anima).as_deref(),
        Some("qwen_image_vae.safetensors")
    );
    assert_eq!(vae(Family::Sd3), None);
}

#[test]
fn only_the_families_with_a_recipe_have_one() {
    assert_eq!(Family::of(BaseModel::Anima), Some(Family::Anima));
    assert_eq!(Family::of(BaseModel::Sd3), Some(Family::Sd3));
    assert_eq!(Family::of(BaseModel::Sdxl), None);
    assert_eq!(Family::of(BaseModel::Wan), None);
    assert_eq!(Family::of(BaseModel::HunyuanVideo), None);
}

#[test]
fn a_gguf_file_loads_through_the_gguf_pack_and_a_plain_file_does_not() {
    let p = params(GenerationMode::Txt2img);
    let vae = r("vae", "v.safetensors");
    let gguf = r("diffusion_models", "flux-Q4_K_M.GGUF");
    let split = SplitJob::new(
        Family::Flux,
        Loader::Unet,
        vec![
            r("text_encoders", "clip_l.safetensors"),
            r("text_encoders", "t5-v1_1-xxl-encoder-Q8_0.gguf"),
        ],
    );
    let g = build_any(&input(&p, &gguf, Some(&vae), &split)).unwrap();
    assert_eq!(node(&g, "UnetLoaderGGUF")["unet_name"], "flux-Q4_K_M.GGUF");
    assert_eq!(count(&g, "UNETLoader"), 0);
    // One GGUF encoder moves both to the pack's loader, which has no `device` input.
    let dual = node(&g, "DualCLIPLoaderGGUF");
    assert_eq!(dual["clip_name1"], "clip_l.safetensors");
    assert_eq!(dual["type"], "flux");
    assert!(dual.get("device").is_none());
    assert_eq!(
        super::gguf_nodes(&g.prompt),
        ["DualCLIPLoaderGGUF", "UnetLoaderGGUF"]
    );
    // Plain files keep ComfyUI's own loaders and need no pack.
    let plain = r("diffusion_models", "flux.safetensors");
    let g = build_any(&input(&p, &plain, Some(&vae), &job(Family::Flux))).unwrap();
    assert_eq!(count(&g, "UNETLoader"), 1);
    assert!(super::gguf_nodes(&g.prompt).is_empty());
}

#[test]
fn the_gguf_text_loader_matches_the_number_of_encoders() {
    let p = params(GenerationMode::Txt2img);
    let vae = r("vae", "v.safetensors");
    let unet = r("diffusion_models", "m.safetensors");
    for (family, class) in [
        (Family::Sd3, "TripleCLIPLoaderGGUF"),
        (Family::Hidream, "QuadrupleCLIPLoaderGGUF"),
        (Family::Chroma, "CLIPLoaderGGUF"),
        (Family::QwenImage, "CLIPLoaderGGUF"),
    ] {
        let split = SplitJob::new(
            family,
            Loader::Unet,
            (0..family.encoders().len())
                .map(|i| r("text_encoders", &format!("e{i}.gguf")))
                .collect(),
        );
        let g = build_any(&input(&p, &unet, Some(&vae), &split)).unwrap();
        assert_eq!(count(&g, class), 1, "{family:?}");
    }
}

#[test]
fn flux2_klein_reads_qwen3_where_dev_reads_mistral() {
    use crate::models::classify::Variant;
    let names = |v: Variant| {
        Family::Flux2
            .encoders_for(v)
            .iter()
            .map(|n| n.words[0])
            .collect::<Vec<_>>()
    };
    assert_eq!(names(Variant::Flux2Dev), ["mistral_3_small"]);
    assert_eq!(names(Variant::Flux2Klein4b), ["qwen_3_4b"]);
    assert_eq!(names(Variant::Flux2Klein9b), ["qwen_3_8b"]);
    // Other families do not change with the variant.
    assert_eq!(Family::Flux.encoders_for(Variant::FluxKontext).len(), 2);
    assert_eq!(Family::of(BaseModel::Flux2), Some(Family::Flux2));
    assert_eq!(Family::of_video(BaseModel::Ltx2), Some(Family::Ltx2));
    assert_eq!(
        Family::of_video(BaseModel::HunyuanVideo15),
        Some(Family::HunyuanVideo15)
    );
    assert_eq!(Family::of(BaseModel::Ltx2), None);
}

#[test]
fn the_manga_finish_names_its_pack() {
    let prompt = json!({
        "1": { "class_type": "VAEDecode", "inputs": {} },
        "2": { "class_type": "MangaFinish", "inputs": {} },
    });
    let needs = super::packs_needed(&prompt);
    assert_eq!(needs.len(), 1);
    assert_eq!(needs[0].node, "MangaFinish");
    assert_eq!(needs[0].pack, "ComfyUI-MangaScreen");
    assert_eq!(
        needs[0].address,
        "https://github.com/ashukae/ComfyUI-MangaScreen"
    );
}

#[test]
fn the_recorded_sampling_is_what_each_picture_family_graph_runs() {
    let unet = r("diffusion_models", "model.safetensors");
    let vae = r("vae", "vae.safetensors");
    let mut p = params(GenerationMode::Txt2img);
    // A setting the SD family would run; the families that fix their sampling ignore it.
    p.scheduler = "euler_a".into();
    for f in [
        Family::Flux,
        Family::Chroma,
        Family::QwenImage,
        Family::ZImage,
        Family::Sd3,
        Family::Hidream,
        Family::Auraflow,
        Family::HunyuanImage,
    ] {
        let split = job(f);
        let g = build_any(&input(&p, &unet, Some(&vae), &split)).unwrap();
        let k = node(&g, "KSampler");
        let (sampler, scheduler) = f.picture_sampling();
        assert_eq!((sampler, scheduler), f.sampling(), "{f:?}");
        assert_eq!(k["sampler_name"], sampler, "{f:?}");
        assert_eq!(k["scheduler"], scheduler, "{f:?}");
    }
    let split = job(Family::Flux2);
    let g = build_any(&input(&p, &unet, Some(&vae), &split)).unwrap();
    let (sampler, scheduler) = Family::Flux2.picture_sampling();
    assert_eq!(node(&g, "KSamplerSelect")["sampler_name"], sampler);
    assert_eq!(count(&g, scheduler), 1);
    assert_eq!(count(&g, "KSampler"), 0);
}

#[test]
fn anima_runs_the_scheduler_setting_and_plain_euler_is_its_template() {
    let unet = r("diffusion_models", "model.safetensors");
    let vae = r("vae", "vae.safetensors");
    let split = job(Family::Anima);
    let run = |scheduler: &str| {
        let mut p = params(GenerationMode::Txt2img);
        p.scheduler = scheduler.into();
        build_any(&input(&p, &unet, Some(&vae), &split)).map(|g| {
            let k = node(&g, "KSampler");
            (
                k["sampler_name"].as_str().unwrap().to_string(),
                k["scheduler"].as_str().unwrap().to_string(),
            )
        })
    };
    let pair = |a: &str, b: &str| Ok((a.to_string(), b.to_string()));
    // Pictures made before the choice existed recorded `euler` and ran euler with `simple`.
    assert_eq!(run("euler"), pair("euler", "simple"));
    assert_eq!(run("euler_a"), pair("euler_ancestral", "normal"));
    assert_eq!(run("dpmpp_2m_k"), pair("dpmpp_2m", "karras"));
    assert!(run("not-a-scheduler")
        .unwrap_err()
        .contains("not available"));
}

#[test]
fn the_sampling_is_fixed_for_picture_family_models_in_the_modes_the_picture_graph_draws() {
    let of = |base: &str, kind: &str| -> ModelConfig {
        serde_json::from_value(serde_json::json!({
            "key": "m", "name": "m", "base": base, "type": kind, "format": "checkpoint",
            "description": "", "path": "m", "size": 1, "source": "local"
        }))
        .unwrap()
    };
    let anima = of("anima", "main");
    let euler_simple = Some(Sampling {
        sampler: "euler".into(),
        scheduler: "simple".into(),
    });
    let flux = of("flux", "main");
    for mode in [
        GenerationMode::Txt2img,
        GenerationMode::Img2img,
        GenerationMode::Inpaint,
        GenerationMode::Outpaint,
        GenerationMode::Upscale,
        GenerationMode::Workflow,
    ] {
        assert_eq!(fixed_sampling(&flux, mode), euler_simple, "{mode:?}");
        assert_eq!(
            fixed_sampling(&anima, mode),
            None,
            "Anima follows the setting: {mode:?}"
        );
    }
    for mode in [
        GenerationMode::Graph,
        GenerationMode::Video,
        GenerationMode::Music,
        GenerationMode::Voice,
        GenerationMode::Logo,
    ] {
        assert_eq!(fixed_sampling(&anima, mode), None, "{mode:?}");
    }
    let txt = GenerationMode::Txt2img;
    assert_eq!(
        fixed_sampling(&of("flux", "diffusion_model"), txt),
        euler_simple
    );
    assert_eq!(fixed_sampling(&of("anima", "diffusion_model"), txt), None);
    assert_eq!(fixed_sampling(&of("anima", "lora"), txt), None);
    assert_eq!(fixed_sampling(&of("sdxl", "main"), txt), None);
    assert_eq!(fixed_sampling(&of("sd-1", "main"), txt), None);
    assert_eq!(fixed_sampling(&of("wan", "diffusion_model"), txt), None);
    assert_eq!(
        fixed_sampling(&of("flux2", "diffusion_model"), txt).map(|s| s.scheduler),
        Some("Flux2Scheduler".to_string())
    );
}
