use super::*;
use crate::types::{HiresFix, MangaScreen};

pub(crate) fn params(mode: GenerationMode) -> GenerationMetadata {
    serde_json::from_value(json!({
        "generationMode": mode, "positivePrompt": "a cat", "negativePrompt": "blurry",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 42, "steps": 20, "cfgScale": 6.5,
        "cfgRescale": 0, "scheduler": "dpmpp_2m_k", "width": 1024, "height": 768, "clipSkip": 0,
        "seamlessX": false, "seamlessY": false, "loras": []
    }))
    .unwrap()
}

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

fn ckpt() -> ComfyRef {
    r("checkpoints", "sdxl\\base.safetensors")
}

/// A plain image job: the given checkpoint and source, nothing else.
fn input<'a>(
    p: &'a GenerationMetadata,
    c: &'a ComfyRef,
    init_image: Option<&'a str>,
) -> GraphInput<'a> {
    GraphInput {
        split: None,
        params: p,
        checkpoint: c,
        vae: None,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image,
        guidance: GuidanceInput::default(),
    }
}

/// Ids and inputs of the nodes of a class, in the order they were added.
fn nodes<'a>(g: &'a BuiltGraph, class: &str) -> Vec<(String, &'a Value)> {
    let mut out: Vec<(String, &Value)> = g
        .prompt
        .as_object()
        .unwrap()
        .iter()
        .filter(|(_, n)| n["class_type"] == class)
        .map(|(id, n)| (id.clone(), &n["inputs"]))
        .collect();
    out.sort_by_key(|(id, _)| id.parse::<u32>().unwrap());
    out
}

fn by_class<'a>(g: &'a BuiltGraph, class: &str) -> Vec<&'a Value> {
    nodes(g, class).into_iter().map(|(_, n)| n).collect()
}

fn id_of(g: &BuiltGraph, class: &str) -> String {
    nodes(g, class)
        .into_iter()
        .next()
        .map(|(id, _)| id)
        .unwrap_or_else(|| panic!("no {class} node"))
}

/// The class of the node a link points at.
fn class_of<'a>(g: &'a BuiltGraph, link: &Value) -> &'a Value {
    &g.prompt[link[0].as_str().unwrap()]["class_type"]
}

#[test]
fn txt2img_uses_an_empty_latent_and_full_denoise() {
    let p = params(GenerationMode::Txt2img);
    let c = ckpt();
    let g = build(&input(&p, &c, None)).unwrap();
    let ks = by_class(&g, "KSampler")[0];
    assert_eq!(ks["sampler_name"], "dpmpp_2m");
    assert_eq!(ks["scheduler"], "karras");
    assert_eq!(ks["seed"], 42);
    assert_eq!(ks["denoise"], 1.0);
    let latent = by_class(&g, "EmptyLatentImage")[0];
    assert_eq!(
        (latent["width"].as_u64(), latent["height"].as_u64()),
        (Some(1024), Some(768))
    );
    assert_eq!(
        by_class(&g, "CheckpointLoaderSimple")[0]["ckpt_name"],
        "sdxl\\base.safetensors"
    );
    assert_eq!(g.prompt[&g.output_node]["class_type"], "PreviewImage");
    assert!(by_class(&g, "LoadImage").is_empty());
    assert!(by_class(&g, "DifferentialDiffusion").is_empty());
}

#[test]
fn a_draft_stops_early_with_the_advanced_sampler() {
    let mut p = params(GenerationMode::Txt2img);
    p.steps = 28;
    p.draft_at = Some(0.35);
    let c = ckpt();
    let g = build(&input(&p, &c, None)).unwrap();
    let ks = by_class(&g, "KSamplerAdvanced")[0];
    assert_eq!(ks["end_at_step"], 10);
    assert_eq!(ks["steps"], 28);
    assert_eq!(ks["return_with_leftover_noise"], "disable");
    assert!(by_class(&g, "KSampler").is_empty());
    assert_eq!(g.total_steps, 10);
    assert_eq!(draft_step(28, 0.1), 6);
    assert_eq!(draft_step(28, 0.99), 26);
    p.generation_mode = GenerationMode::Img2img;
    assert!(build(&input(&p, &c, Some("a.png"))).is_err());
}

fn hires(scale: f64, strength: f64, model: Option<&str>, steps: Option<u32>) -> HiresFix {
    HiresFix {
        scale,
        strength,
        upscale_model_key: model.map(Into::into),
        steps,
    }
}

#[test]
fn hires_fix_redraws_the_enlarged_picture_with_the_same_seed_and_conditioning() {
    let mut p = params(GenerationMode::Txt2img);
    p.hires_fix = Some(hires(1.5, 0.45, None, None));
    let c = ckpt();
    let g = build(&input(&p, &c, None)).unwrap();
    let samplers = nodes(&g, "KSampler");
    assert_eq!(samplers.len(), 2);
    let (first_id, first) = (&samplers[0].0, samplers[0].1);
    let (second_id, second) = (&samplers[1].0, samplers[1].1);
    assert_eq!(first["denoise"], 1.0);
    assert_eq!(second["denoise"], 0.45);
    assert_eq!(second["seed"], first["seed"]);
    assert_eq!(second["steps"], 20);
    for key in [
        "model",
        "positive",
        "negative",
        "cfg",
        "sampler_name",
        "scheduler",
    ] {
        assert_eq!(second[key], first[key], "{key}");
    }
    // 1024 x 768 at 1.5 is 1536 x 1152, resized with Lanczos, without an upscale model.
    let scale = by_class(&g, "ImageScale")[0];
    assert_eq!(
        (scale["width"].as_u64(), scale["height"].as_u64()),
        (Some(1536), Some(1152))
    );
    assert_eq!(scale["upscale_method"], "lanczos");
    assert!(by_class(&g, "UpscaleModelLoader").is_empty());
    assert_eq!(class_of(&g, &scale["image"]), "VAEDecode");
    assert_eq!(class_of(&g, &second["latent_image"]), "VAEEncode");
    // The output is the second pass, and progress counts both passes.
    let out = &g.prompt[&g.output_node]["inputs"]["images"];
    assert_eq!(
        g.prompt[out[0].as_str().unwrap()]["inputs"]["samples"][0],
        second_id.as_str()
    );
    assert_eq!(g.total_steps, 40);
    assert_eq!(
        g.passes,
        vec![(first_id.clone(), 0), (second_id.clone(), 20)]
    );
}

#[test]
fn hires_fix_with_a_model_upscales_then_resizes_and_snaps_to_eight() {
    let mut p = params(GenerationMode::Txt2img);
    p.width = 832;
    p.height = 1216;
    p.hires_fix = Some(hires(1.25, 0.3, Some("up-4x"), Some(12)));
    let (c, up) = (ckpt(), r("upscale_models", "4x.pth"));
    let g = build(&GraphInput {
        upscale_model: Some(&up),
        ..input(&p, &c, None)
    })
    .unwrap();
    assert_eq!(
        by_class(&g, "UpscaleModelLoader")[0]["model_name"],
        "4x.pth"
    );
    let scale = by_class(&g, "ImageScale")[0];
    assert_eq!(class_of(&g, &scale["image"]), "ImageUpscaleWithModel");
    // 832 x 1.25 = 1040, 1216 x 1.25 = 1520: both already multiples of 8.
    assert_eq!(
        (scale["width"].as_u64(), scale["height"].as_u64()),
        (Some(1040), Some(1520))
    );
    assert_eq!(
        hires_size(&params(GenerationMode::Txt2img), 1.33),
        (1360, 1024)
    );
    assert_eq!(by_class(&g, "KSampler")[1]["steps"], 12);
    assert_eq!(g.total_steps, 32);
}

#[test]
fn hires_fix_is_refused_where_it_cannot_run() {
    let c = ckpt();
    let refuse =
        |p: &GenerationMetadata, init: Option<&str>| build(&input(p, &c, init)).unwrap_err();
    let mut p = params(GenerationMode::Img2img);
    p.hires_fix = Some(hires(1.5, 0.45, None, None));
    assert!(refuse(&p, Some("a.png")).contains("text to image"));
    let mut p = params(GenerationMode::Txt2img);
    p.draft_at = Some(0.5);
    p.hires_fix = Some(hires(1.5, 0.45, None, None));
    assert!(refuse(&p, None).contains("draft"));
    p.draft_at = None;
    p.hires_fix = Some(hires(8.0, 0.45, None, None));
    assert!(refuse(&p, None).contains("scale"));
    p.hires_fix = Some(hires(1.5, 0.0, None, None));
    assert!(refuse(&p, None).contains("strength"));
    p.hires_fix = Some(hires(1.5, 0.45, None, Some(0)));
    assert!(refuse(&p, None).contains("step"));
    // A model was asked for but not resolved.
    p.hires_fix = Some(hires(1.5, 0.45, Some("up"), None));
    assert!(refuse(&p, None).contains("upscale model"));
    // Without the fix nothing changes: one pass, no passes listed.
    let p = params(GenerationMode::Txt2img);
    let g = build(&input(&p, &c, None)).unwrap();
    assert!(g.passes.is_empty() && g.total_steps == 20);
}

fn manga(screen_lines: u32, white_point: f64, black_point: f64) -> MangaScreen {
    MangaScreen {
        screen_lines,
        white_point,
        black_point,
        gradation: 1.0,
        white_lines: 0.4,
    }
}

#[test]
fn manga_finish_is_the_last_step_before_the_output_and_holds_each_value_to_its_range() {
    let c = ckpt();
    let mut p = params(GenerationMode::Txt2img);
    p.hires_fix = Some(hires(1.5, 0.45, None, None));
    p.manga_screen = Some(manga(200, 0.8, 0.3));
    let g = build(&input(&p, &c, None)).unwrap();
    let finish = by_class(&g, "MangaFinish");
    assert_eq!(finish.len(), 1);
    // It reads the second pass's picture and feeds the output.
    assert_eq!(class_of(&g, &finish[0]["image"]), "VAEDecode");
    assert_eq!(finish[0]["screen_lines"], 200);
    assert_eq!(finish[0]["white_lines"], 0.4);
    let out = by_class(&g, "PreviewImage");
    assert_eq!(class_of(&g, &out[0]["images"]), "MangaFinish");
    // A value outside the node's range is held to it.
    p.manga_screen = Some(manga(9000, 5.0, -1.0));
    let g = build(&input(&p, &c, None)).unwrap();
    let finish = by_class(&g, "MangaFinish")[0];
    assert_eq!(finish["screen_lines"], 600);
    assert_eq!(finish["white_point"], 1.0);
    assert_eq!(finish["black_point"], 0.0);
    // Without it the graph has no such node.
    p.manga_screen = None;
    assert!(by_class(&build(&input(&p, &c, None)).unwrap(), "MangaFinish").is_empty());
}

#[test]
fn loras_chain_in_order_and_clip_skip_vae_and_rescale_apply() {
    let mut p = params(GenerationMode::Txt2img);
    p.clip_skip = 2;
    p.cfg_rescale = 0.7;
    let (c, l1, l2, vae) = (
        ckpt(),
        r("loras", "a.safetensors"),
        r("loras", "b.safetensors"),
        r("vae", "v.safetensors"),
    );
    let g = build(&GraphInput {
        vae: Some(&vae),
        loras: vec![(&l1, 0.8), (&l2, -0.5)],
        ..input(&p, &c, None)
    })
    .unwrap();
    let loras = by_class(&g, "LoraLoader");
    assert_eq!(loras.len(), 2);
    let first = loras
        .iter()
        .find(|l| l["lora_name"] == "a.safetensors")
        .unwrap();
    let second = loras
        .iter()
        .find(|l| l["lora_name"] == "b.safetensors")
        .unwrap();
    assert_eq!(second["strength_model"], -0.5);
    // The second LoRA takes the first one's outputs.
    let first_id = g
        .prompt
        .as_object()
        .unwrap()
        .iter()
        .find(|(_, n)| &&n["inputs"] == first)
        .unwrap()
        .0;
    assert_eq!(second["model"][0], first_id.as_str());
    assert_eq!(
        by_class(&g, "CLIPSetLastLayer")[0]["stop_at_clip_layer"],
        -3
    );
    assert_eq!(by_class(&g, "RescaleCFG")[0]["multiplier"], 0.7);
    assert_eq!(by_class(&g, "VAELoader")[0]["vae_name"], "v.safetensors");
}

#[test]
fn img2img_encodes_the_source_with_strength() {
    let mut p = params(GenerationMode::Img2img);
    p.strength = Some(0.45);
    let c = ckpt();
    let g = build(&input(&p, &c, Some("src.png"))).unwrap();
    assert_eq!(by_class(&g, "LoadImage")[0]["image"], "src.png");
    assert_eq!(by_class(&g, "KSampler")[0]["denoise"], 0.45);
    assert!(by_class(&g, "EmptyLatentImage").is_empty());
    assert!(by_class(&g, "ImageCompositeMasked").is_empty());
}

#[test]
fn upscale_scales_the_size_and_runs_the_upscale_model() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(2.0);
    let (c, up) = (ckpt(), r("upscale_models", "4x.pth"));
    let g = build(&GraphInput {
        upscale_model: Some(&up),
        ..input(&p, &c, Some("src.png"))
    })
    .unwrap();
    let scale = by_class(&g, "ImageScale")[0];
    assert_eq!(
        (scale["width"].as_u64(), scale["height"].as_u64()),
        (Some(2048), Some(1536))
    );
    assert_eq!(
        by_class(&g, "UpscaleModelLoader")[0]["model_name"],
        "4x.pth"
    );
    assert_eq!(by_class(&g, "KSampler")[0]["denoise"], 0.35);
}

#[test]
fn upscale_creativity_sets_the_denoise_strength() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(2.0);
    let c = ckpt();
    for (creativity, denoise) in [(-10.0, 0.1), (0.0, 0.35), (10.0, 0.6), (99.0, 0.6)] {
        p.creativity = Some(creativity);
        let g = build(&input(&p, &c, Some("src.png"))).unwrap();
        let got = by_class(&g, "KSampler")[0]["denoise"].as_f64().unwrap();
        assert!(
            (got - denoise).abs() < 1e-9,
            "creativity {creativity}: {got}"
        );
    }
}

#[test]
fn upscale_with_a_tile_controlnet_guides_the_redraw_at_the_structure_setting() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(2.0);
    p.structure = Some(10.0);
    let (c, up, tile) = (
        ckpt(),
        r("upscale_models", "4x.pth"),
        r("controlnet", "tile.safetensors"),
    );
    let plain = build(&GraphInput {
        upscale_model: Some(&up),
        ..input(&p, &c, Some("src.png"))
    })
    .unwrap();
    assert!(by_class(&plain, "ControlNetApplyAdvanced").is_empty());

    let g = build(&GraphInput {
        upscale_model: Some(&up),
        tile_controlnet: Some(&tile),
        ..input(&p, &c, Some("src.png"))
    })
    .unwrap();
    assert_eq!(
        by_class(&g, "ControlNetLoader")[0]["control_net_name"],
        "tile.safetensors"
    );
    let apply = by_class(&g, "ControlNetApplyAdvanced");
    assert_eq!(apply.len(), 1);
    assert!((apply[0]["strength"].as_f64().unwrap() - 1.0).abs() < 1e-9);
    assert_eq!(class_of(&g, &apply[0]["image"]), "ImageScale");
    let sampler = by_class(&g, "KSampler")[0];
    assert_eq!(
        class_of(&g, &sampler["positive"]),
        "ControlNetApplyAdvanced"
    );
    assert_eq!(
        class_of(&g, &sampler["negative"]),
        "ControlNetApplyAdvanced"
    );
}

#[test]
fn upscale_with_a_post_processing_model_finishes_the_picture_then_fits_the_output() {
    let mut p = params(GenerationMode::Upscale);
    p.upscale_scale = Some(2.0);
    let (c, post) = (ckpt(), r("upscale_models", "post.pth"));
    let plain = build(&input(&p, &c, Some("src.png"))).unwrap();
    assert_eq!(by_class(&plain, "UpscaleModelLoader").len(), 0);

    let g = build(&GraphInput {
        post_processing_model: Some(&post),
        ..input(&p, &c, Some("src.png"))
    })
    .unwrap();
    let finishing = by_class(&g, "ImageUpscaleWithModel")
        .into_iter()
        .find(|n| class_of(&g, &n["image"]) == "VAEDecode")
        .expect("the finishing model takes the drawn picture");
    let loader_id = finishing["upscale_model"][0].as_str().unwrap();
    assert_eq!(g.prompt[loader_id]["inputs"]["model_name"], "post.pth");

    let fitted = by_class(&g, "ImageScale")
        .into_iter()
        .find(|n| class_of(&g, &n["image"]) == "ImageUpscaleWithModel")
        .expect("the picture is fitted after the finishing model");
    assert_eq!(
        (fitted["width"].as_u64(), fitted["height"].as_u64()),
        (Some(2048), Some(1536))
    );
    assert_eq!(
        class_of(&g, &by_class(&g, "PreviewImage")[0]["images"]),
        "ImageScale"
    );
}

#[test]
fn inpaint_masks_the_noise_and_keeps_the_source_outside_the_mask() {
    let mut p = params(GenerationMode::Inpaint);
    p.strength = Some(0.8);
    let c = ckpt();
    let g = build(&GraphInput {
        guidance: GuidanceInput {
            mask_image: Some("mask.png"),
            ..Default::default()
        },
        ..input(&p, &c, Some("src.png"))
    })
    .unwrap();
    let loads: Vec<&Value> = by_class(&g, "LoadImage")
        .into_iter()
        .map(|l| &l["image"])
        .collect();
    assert_eq!(loads, ["src.png", "mask.png"]);
    let set_mask = by_class(&g, "SetLatentNoiseMask")[0];
    let composite = by_class(&g, "ImageCompositeMasked")[0];
    // The sampler and the final composite use the same softened mask.
    assert_eq!(set_mask["mask"], composite["mask"]);
    assert_eq!(class_of(&g, &set_mask["mask"]), "ImageToMask");
    let soft = &g.prompt[set_mask["mask"][0].as_str().unwrap()]["inputs"];
    assert_eq!(class_of(&g, &soft["image"]), "ImageBlur");
    assert_eq!(class_of(&g, &composite["source"]), "VAEDecode");
    assert_eq!(class_of(&g, &composite["destination"]), "ImageScale");
    assert_eq!(composite["resize_source"], false);
    assert_eq!(by_class(&g, "GrowMask")[0]["expand"], DEFAULT_MASK_BLUR / 2);
    assert_eq!(
        by_class(&g, "ImageBlur")[0]["blur_radius"],
        DEFAULT_MASK_BLUR
    );
    assert_eq!(by_class(&g, "KSampler")[0]["denoise"], 0.8);
    assert_eq!(
        by_class(&g, "KSampler")[0]["model"][0],
        id_of(&g, "DifferentialDiffusion")
    );
    assert_eq!(
        g.prompt[&g.output_node]["inputs"]["images"][0],
        id_of(&g, "ImageCompositeMasked")
    );
}

#[test]
fn mask_blur_is_clamped_and_zero_uses_the_mask_as_painted() {
    let mut p = params(GenerationMode::Outpaint);
    let c = ckpt();
    let build_with = |p: &GenerationMetadata| {
        build(&GraphInput {
            guidance: GuidanceInput {
                mask_image: Some("mask.png"),
                ..Default::default()
            },
            ..input(p, &c, Some("src.png"))
        })
        .unwrap()
    };
    p.mask_blur = Some(500);
    let g = build_with(&p);
    assert_eq!(by_class(&g, "ImageBlur")[0]["blur_radius"], 31);
    assert_eq!(by_class(&g, "ImageBlur")[0]["sigma"], 10.0);
    p.mask_blur = Some(0);
    let g = build_with(&p);
    assert!(by_class(&g, "ImageBlur").is_empty() && by_class(&g, "GrowMask").is_empty());
    assert_eq!(
        by_class(&g, "SetLatentNoiseMask")[0]["mask"][0],
        id_of(&g, "ImageToMask")
    );
}

#[test]
fn control_layers_chain_the_conditioning_and_more_control_skips_the_negative() {
    let p = {
        let mut p = params(GenerationMode::Txt2img);
        p.control_layer_count = Some(2);
        p
    };
    let (c, net) = (ckpt(), r("controlnet", "union-xl.safetensors"));
    let g = build(&GraphInput {
        guidance: GuidanceInput {
            controls: vec![
                ControlInput {
                    model: &net,
                    image: "pose.png",
                    weight: 0.75,
                    begin_end: [0.0, 0.75],
                    mode: ControlMode::Balanced,
                    union_type: None,
                },
                ControlInput {
                    model: &net,
                    image: "edges.png",
                    weight: 1.2,
                    begin_end: [0.9, 0.1],
                    mode: ControlMode::MoreControl,
                    union_type: None,
                },
            ],
            ..Default::default()
        },
        ..input(&p, &c, None)
    })
    .unwrap();
    assert_eq!(
        by_class(&g, "ControlNetLoader").len(),
        1,
        "one loader per model"
    );
    let applies = nodes(&g, "ControlNetApplyAdvanced");
    let (first_id, first) = (&applies[0].0, applies[0].1);
    let (second_id, second) = (&applies[1].0, applies[1].1);
    assert_eq!(first["strength"], 0.75);
    assert_eq!(
        (
            first["start_percent"].as_f64(),
            first["end_percent"].as_f64()
        ),
        (Some(0.0), Some(0.75))
    );
    assert_eq!(second["positive"], json!([first_id, 0]));
    assert_eq!(second["negative"], json!([first_id, 1]));
    // A reversed span is put in order.
    assert_eq!(
        (
            second["start_percent"].as_f64(),
            second["end_percent"].as_f64()
        ),
        (Some(0.1), Some(0.9))
    );
    let ks = by_class(&g, "KSampler")[0];
    assert_eq!(ks["positive"], json!([second_id, 0]));
    // The more-control layer leaves the negative as the first layer made it.
    assert_eq!(ks["negative"], json!([first_id, 1]));
}

#[test]
fn a_union_controlnet_is_told_the_kind_of_each_picture_between_its_loader_and_the_conditioning() {
    let mut p = params(GenerationMode::Txt2img);
    p.control_layer_count = Some(3);
    let (c, net) = (ckpt(), r("controlnet", "union-xl.safetensors"));
    let layer = |image, union_type| ControlInput {
        model: &net,
        image,
        weight: 1.0,
        begin_end: [0.0, 1.0],
        mode: ControlMode::Balanced,
        union_type,
    };
    let g = build(&GraphInput {
        guidance: GuidanceInput {
            controls: vec![
                layer("pose.png", Some("openpose")),
                layer("depth.png", Some("depth")),
                layer("scribble.png", None),
            ],
            ..Default::default()
        },
        ..input(&p, &c, None)
    })
    .unwrap();
    let loader = id_of(&g, "ControlNetLoader");
    let kinds = nodes(&g, "SetUnionControlNetType");
    assert_eq!(kinds.len(), 2, "one per kind the layers say");
    assert!(kinds
        .iter()
        .all(|(_, n)| n["control_net"] == json!([loader, 0])));
    let applies = nodes(&g, "ControlNetApplyAdvanced");
    assert_eq!(applies[0].1["control_net"], json!([kinds[0].0, 0]));
    assert_eq!(kinds[0].1["type"], "openpose");
    assert_eq!(applies[1].1["control_net"], json!([kinds[1].0, 0]));
    assert_eq!(kinds[1].1["type"], "depth");
    // A picture of unknown kind leaves the model to guess, as before.
    assert_eq!(applies[2].1["control_net"], json!([loader, 0]));
}

#[test]
fn union_controlnets_are_known_by_their_name_file_or_source_and_kinds_by_comfyuis_names() {
    assert!(is_union_controlnet(
        "diffusion_pytorch_model",
        "E:/models/controlnet/diffusion_pytorch_model.safetensors",
        "xinsir/controlnet-union-sdxl-1.0::diffusion_pytorch_model.safetensors"
    ));
    assert!(is_union_controlnet("controlnet-union-promax-sdxl", "", ""));
    assert!(is_union_controlnet("x", "D:/m/ProMax.safetensors", ""));
    assert!(!is_union_controlnet(
        "controlnet-openpose-sdxl",
        "D:/m/openpose.safetensors",
        "xinsir/controlnet-openpose-sdxl-1.0::diffusion_pytorch_model.safetensors"
    ));
    assert_eq!(union_type(ControlType::Openpose), "openpose");
    assert_eq!(union_type(ControlType::Depth), "depth");
    assert_eq!(union_type(ControlType::Softedge), "hed/pidi/scribble/ted");
    assert_eq!(
        union_type(ControlType::Lineart),
        "canny/lineart/anime_lineart/mlsd"
    );
    assert_eq!(union_type(ControlType::Normal), "normal");
}

#[test]
fn reference_images_patch_the_model_with_the_packs_weight_types() {
    let mut p = params(GenerationMode::Txt2img);
    p.ref_image_count = Some(2);
    p.cfg_rescale = 0.5;
    let (c, ipa, vit) = (
        ckpt(),
        r("ipadapter", "ip-adapter_sdxl_vit-h.safetensors"),
        r("clip_vision", "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"),
    );
    let refs = [RefImageMethod::Style, RefImageMethod::StylePrecise]
        .into_iter()
        .map(|method| RefInput {
            model: &ipa,
            clip_vision: &vit,
            image: "ref.png",
            weight: 0.6,
            begin_end: [0.0, 1.0],
            method,
            region: None,
        })
        .collect();
    let g = build(&GraphInput {
        guidance: GuidanceInput {
            refs,
            ..Default::default()
        },
        ..input(&p, &c, None)
    })
    .unwrap();
    assert_eq!(by_class(&g, "IPAdapterModelLoader").len(), 1);
    assert_eq!(by_class(&g, "CLIPVisionLoader").len(), 1);
    let applies = nodes(&g, IPADAPTER_NODE);
    assert_eq!(applies[0].1["weight_type"], "style transfer");
    assert_eq!(applies[1].1["weight_type"], "style transfer precise");
    assert_eq!(applies[0].1["combine_embeds"], "concat");
    assert_eq!(applies[0].1["embeds_scaling"], "V only");
    assert_eq!(
        applies[0].1["model"],
        json!([id_of(&g, "CheckpointLoaderSimple"), 0])
    );
    assert_eq!(applies[1].1["model"], json!([applies[0].0, 0]));
    // RescaleCFG wraps the patched model, and the sampler uses that.
    let rescale = nodes(&g, "RescaleCFG");
    assert_eq!(rescale[0].1["model"], json!([applies[1].0, 0]));
    assert_eq!(
        by_class(&g, "KSampler")[0]["model"],
        json!([rescale[0].0, 0])
    );
}

#[test]
fn a_draft_keeps_its_reference_images() {
    let mut p = params(GenerationMode::Txt2img);
    p.ref_image_count = Some(1);
    p.draft_at = Some(0.35);
    let (c, ipa, vit) = (
        ckpt(),
        r("ipadapter", "ip.safetensors"),
        r("clip_vision", "vit-h.safetensors"),
    );
    let g = build(&GraphInput {
        guidance: GuidanceInput {
            refs: vec![RefInput {
                model: &ipa,
                clip_vision: &vit,
                image: "ref.png",
                weight: 1.0,
                begin_end: [0.0, 1.0],
                method: RefImageMethod::Full,
                region: None,
            }],
            ..Default::default()
        },
        ..input(&p, &c, None)
    })
    .unwrap();
    assert_eq!(
        by_class(&g, "KSamplerAdvanced")[0]["model"],
        json!([id_of(&g, IPADAPTER_NODE), 0])
    );
}

#[test]
fn every_method_maps_to_a_weight_type_the_pack_lists() {
    // `WEIGHT_TYPES` in ComfyUI_IPAdapter_plus/IPAdapterPlus.py.
    let pack = [
        "linear",
        "ease in",
        "ease out",
        "ease in-out",
        "reverse in-out",
        "weak input",
        "weak output",
        "weak middle",
        "strong middle",
        "style transfer",
        "composition",
        "strong style transfer",
        "style and composition",
        "style transfer precise",
        "composition precise",
    ];
    for m in [
        RefImageMethod::Full,
        RefImageMethod::Style,
        RefImageMethod::Composition,
        RefImageMethod::StyleStrong,
        RefImageMethod::StylePrecise,
    ] {
        assert!(pack.contains(&ipadapter_weight_type(m)), "{m:?}");
    }
}

#[test]
fn unsupported_requests_are_refused_with_a_reason() {
    let c = ckpt();
    let refuse =
        |p: &GenerationMetadata, init: Option<&str>| build(&input(p, &c, init)).unwrap_err();
    let mut p = params(GenerationMode::Txt2img);
    p.scheduler = "tcd".into();
    assert!(refuse(&p, None).contains("tcd"));
    // Counted guidance that was not sent, a regional layer, and inpaint without a mask.
    let mut p = params(GenerationMode::Txt2img);
    p.control_layer_count = Some(1);
    assert!(refuse(&p, None).contains("control layers"));
    let mut p = params(GenerationMode::Txt2img);
    p.ref_image_count = Some(1);
    assert!(refuse(&p, None).contains("reference images"));
    let mut p = params(GenerationMode::Txt2img);
    p.regional_guidance_count = Some(1);
    assert!(refuse(&p, None).contains("regional guidance"));
    let p = params(GenerationMode::Inpaint);
    assert!(refuse(&p, Some("src.png")).contains("mask"));
    let p = params(GenerationMode::Img2img);
    assert!(refuse(&p, None).contains("source image"));
    // A mask outside inpaint / outpaint, and guidance on an upscale.
    let mut p = params(GenerationMode::Img2img);
    let masked = |p: &GenerationMetadata| {
        build(&GraphInput {
            guidance: GuidanceInput {
                mask_image: Some("m.png"),
                ..Default::default()
            },
            ..input(p, &c, Some("src.png"))
        })
    };
    assert!(masked(&p).unwrap_err().contains("only used"));
    p.generation_mode = GenerationMode::Upscale;
    assert!(masked(&p).unwrap_err().contains("cannot be used"));
}

#[test]
fn regional_layers_confine_their_prompts_to_their_region() {
    let p = {
        let mut p = params(GenerationMode::Txt2img);
        p.regional_guidance_count = Some(2);
        p
    };
    let c = ckpt();
    let g = build(&GraphInput {
        guidance: GuidanceInput {
            regions: vec![
                RegionInput {
                    mask_image: "left.png",
                    positive: Some("a red hat"),
                    negative: None,
                    auto_negative: true,
                },
                RegionInput {
                    mask_image: "right.png",
                    positive: None,
                    negative: Some("blur"),
                    auto_negative: false,
                },
            ],
            ..Default::default()
        },
        ..input(&p, &c, None)
    })
    .unwrap();
    // Left: the prompt inside the region and, as auto negative, outside it. Right: only a negative inside.
    assert_eq!(by_class(&g, "ConditioningSetMask").len(), 3);
    assert_eq!(by_class(&g, "ConditioningCombine").len(), 3);
    assert_eq!(by_class(&g, "InvertMask").len(), 1);
    assert_eq!(by_class(&g, "ImageToMask").len(), 2);
    let sampler = nodes(&g, "KSampler")[0].1;
    // The sampler's positive is the combination, not the plain prompt.
    let positive = sampler["positive"][0].as_str().unwrap();
    assert_eq!(g.prompt[positive]["class_type"], "ConditioningCombine");
    let negative = sampler["negative"][0].as_str().unwrap();
    assert_eq!(g.prompt[negative]["class_type"], "ConditioningCombine");
    // A model of the newer families cannot take them.
    use crate::comfy::split::{Family, Loader, SplitJob};
    let encoders = vec![
        r("text_encoders", "a.safetensors"),
        r("text_encoders", "b.safetensors"),
    ];
    let split = SplitJob::new(Family::Flux, Loader::Unet, encoders);
    let vae = r("vae", "v.safetensors");
    let mut p = p;
    p.regional_guidance_count = Some(1);
    let err = build(&GraphInput {
        split: Some(&split),
        vae: Some(&vae),
        guidance: GuidanceInput {
            regions: vec![RegionInput {
                mask_image: "a.png",
                positive: Some("x"),
                negative: None,
                auto_negative: false,
            }],
            ..Default::default()
        },
        ..input(&p, &c, None)
    });
    assert!(err.unwrap_err().contains("SD 1.5 and SDXL"));
}

#[test]
fn seamless_tiling_circles_the_model_and_the_decode_through_the_tiling_pack() {
    let c = ckpt();
    let tiled = |x: bool, y: bool| {
        let mut p = params(GenerationMode::Txt2img);
        p.seamless_x = x;
        p.seamless_y = y;
        build(&input(&p, &c, None)).unwrap()
    };
    for (x, y, mode) in [
        (true, true, "enable"),
        (true, false, "x_only"),
        (false, true, "y_only"),
    ] {
        let g = tiled(x, y);
        assert_eq!(nodes(&g, "SeamlessTile")[0].1["tiling"], mode);
        assert_eq!(nodes(&g, "CircularVAEDecode")[0].1["tiling"], mode);
        assert!(by_class(&g, "VAEDecode").is_empty());
        // The sampler draws with the circled model.
        let sampler = nodes(&g, "KSampler")[0].1;
        let model = sampler["model"][0].as_str().unwrap();
        assert_eq!(g.prompt[model]["class_type"], "SeamlessTile");
        assert_eq!(nodes(&g, "SeamlessTile")[0].1["copy_model"], "Make a copy");
    }
    // Without it nothing of the pack is used, and both passes of the high-resolution fix decode in a circle.
    let plain = tiled(false, false);
    assert!(
        by_class(&plain, "SeamlessTile").is_empty()
            && by_class(&plain, "CircularVAEDecode").is_empty()
    );
    let mut p = params(GenerationMode::Txt2img);
    p.seamless_x = true;
    p.hires_fix = Some(HiresFix {
        scale: 1.5,
        strength: 0.4,
        steps: None,
        upscale_model_key: None,
    });
    let g = build(&input(&p, &c, None)).unwrap();
    assert_eq!(by_class(&g, "CircularVAEDecode").len(), 2);
    // A model of the newer families is refused with the reason.
    use crate::comfy::split::{Family, Loader, SplitJob};
    let encoders = vec![
        r("text_encoders", "a.safetensors"),
        r("text_encoders", "b.safetensors"),
    ];
    let split = SplitJob::new(Family::Flux, Loader::Unet, encoders);
    let vae = r("vae", "v.safetensors");
    let err = build(&GraphInput {
        split: Some(&split),
        vae: Some(&vae),
        ..input(&p, &c, None)
    });
    assert!(err
        .unwrap_err()
        .contains("Seamless tiling works with SD 1.5 and SDXL"));
}
#[test]
fn an_sd_model_refuses_pictures_given_as_references() {
    let p = params(GenerationMode::Txt2img);
    let c = ckpt();
    let mut i = input(&p, &c, None);
    i.guidance.references = vec!["mina.png"];
    assert!(build(&i).unwrap_err().contains("FLUX.2 models only"));
}
