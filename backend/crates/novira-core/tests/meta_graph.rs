//! Metamorphic tests of the ComfyUI graph builder (`comfy::graph::build`): there is no oracle for the whole prompt, but
//! a relation between two builds is easy to state. Changing one setting changes only the inputs that read it and leaves
//! every node, class and link where it was; switching an optional part on adds nodes and removes none; building the
//! same request again, or the base request after the part was on, gives the base graph back.
//! In process only; no ComfyUI is started. Run: `cargo test -p novira-core --test meta_graph`.
mod prop_common;

use novira_core::comfy::graph::{
    build, BuiltGraph, ControlInput, GraphInput, GuidanceInput, RefInput,
};
use novira_core::types::{ComfyRef, ControlMode, GenerationMetadata, RefImageMethod};
use prop_common::check;
use proptest::prelude::*;
use serde_json::{json, Value};
use std::collections::BTreeMap;

fn model(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

/// One request the builder accepts: image modes only, every part switchable.
#[derive(Debug, Clone)]
struct Req {
    mode: &'static str,
    seed: u64,
    steps: u32,
    cfg: f64,
    scheduler: &'static str,
    width: u32,
    height: u32,
    positive: String,
    negative: String,
    loras: Vec<f64>,
    hires: bool,
    controls: Vec<f64>,
    refs: Vec<f64>,
    strength: f64,
}

const SCHEDULERS: &[&str] = &[
    "euler",
    "euler_a",
    "euler_k",
    "dpmpp_2m",
    "dpmpp_2m_k",
    "dpmpp_2m_sde_k",
    "heun",
    "ddim",
    "unipc",
    "lcm",
];

fn req() -> impl Strategy<Value = Req> {
    (
        (
            prop::sample::select(&["txt2img", "img2img", "inpaint"][..]),
            any::<u64>(),
            4u32..60,
            prop_oneof![Just(1.0), 1.0f64..30.0],
            prop::sample::select(SCHEDULERS),
            (32u32..192).prop_map(|n| n * 8),
            (32u32..192).prop_map(|n| n * 8),
        ),
        ("[a-z ]{1,24}", "[a-z ]{0,24}"),
        (
            prop::collection::vec(-2.0f64..2.0, 0..3),
            any::<bool>(),
            prop::collection::vec(0.0f64..2.0, 0..2),
            prop::collection::vec(-1.0f64..2.0, 0..2),
            0.1f64..1.0,
        ),
    )
        .prop_map(
            |(
                (mode, seed, steps, cfg, scheduler, width, height),
                (positive, negative),
                (loras, hires, controls, refs, strength),
            )| Req {
                mode,
                seed,
                steps,
                cfg,
                scheduler,
                width,
                height,
                // The prefixes keep the two prompts different, so the builder never shares their encoder nodes.
                positive: format!("p {positive}"),
                negative: format!("n {negative}"),
                loras,
                hires: hires && mode == "txt2img",
                controls,
                refs,
                strength,
            },
        )
}

fn build_req(r: &Req) -> Result<BuiltGraph, String> {
    let mut params = json!({
        "generationMode": r.mode, "positivePrompt": r.positive, "negativePrompt": r.negative, "modelKey": "m",
        "modelName": "M", "vaeKey": null, "seed": r.seed, "steps": r.steps, "cfgScale": r.cfg,
        "cfgRescale": 0.0, "scheduler": r.scheduler, "width": r.width, "height": r.height, "clipSkip": 0,
        "seamlessX": false, "seamlessY": false, "loras": [], "strength": r.strength,
        "refImageCount": r.refs.len(), "controlLayerCount": r.controls.len(),
    });
    if r.hires {
        params["hiresFix"] = json!({ "scale": 1.5, "strength": 0.5, "steps": 10 });
    }
    let params: GenerationMetadata = serde_json::from_value(params).map_err(|e| e.to_string())?;
    let checkpoint = model("checkpoints", "a.safetensors");
    let vae = model("vae", "v.safetensors");
    let net = model("controlnet", "c.safetensors");
    let adapter = model("ipadapter", "i.safetensors");
    let vision = model("clip_vision", "cv.safetensors");
    let lora_models: Vec<ComfyRef> = (0..r.loras.len())
        .map(|i| model("loras", &format!("l{i}.safetensors")))
        .collect();
    build(&GraphInput {
        split: None,
        params: &params,
        checkpoint: &checkpoint,
        vae: Some(&vae),
        loras: lora_models
            .iter()
            .zip(&r.loras)
            .map(|(m, w)| (m, *w))
            .collect(),
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: Some(&vae),
        init_image: (r.mode != "txt2img").then_some("source.png"),
        guidance: GuidanceInput {
            regions: vec![],
            references: vec![],
            mask_image: (r.mode == "inpaint").then_some("mask.png"),
            controls: r
                .controls
                .iter()
                .map(|w| ControlInput {
                    model: &net,
                    image: "control.png",
                    weight: *w,
                    begin_end: [0.0, 0.8],
                    mode: ControlMode::Balanced,
                    union_type: None,
                })
                .collect(),
            refs: r
                .refs
                .iter()
                .map(|w| RefInput {
                    model: &adapter,
                    clip_vision: &vision,
                    image: "ref.png",
                    weight: *w,
                    begin_end: [0.1, 0.9],
                    method: RefImageMethod::Full,
                    region: None,
                })
                .collect(),
        },
    })
}

/// A request that must build; one that is refused is a bug of this file's generator.
fn built(r: &Req) -> Result<BuiltGraph, TestCaseError> {
    build_req(r).map_err(|e| TestCaseError::fail(format!("the request was refused: {e}: {r:?}")))
}

/// Where two prompts differ: `(node id, input name)` to the class of the node. Panics-free: nodes only in one
/// side are reported by `same_shape`, not here.
fn differing_inputs(a: &Value, b: &Value) -> BTreeMap<(String, String), String> {
    let mut out = BTreeMap::new();
    for (id, node) in a.as_object().unwrap() {
        let Some(other) = b.get(id) else { continue };
        let class = node["class_type"].as_str().unwrap_or("").to_string();
        let (x, y) = (
            node["inputs"].as_object().unwrap(),
            other["inputs"].as_object().unwrap(),
        );
        for name in x.keys().chain(y.keys()) {
            if x.get(name) != y.get(name) {
                out.insert((id.clone(), name.clone()), class.clone());
            }
        }
    }
    out
}

/// The same nodes with the same classes, and every link (an input that is `[node, slot]`) unchanged.
fn same_shape(a: &BuiltGraph, b: &BuiltGraph) -> Result<(), TestCaseError> {
    let (x, y) = (a.prompt.as_object().unwrap(), b.prompt.as_object().unwrap());
    prop_assert_eq!(x.keys().collect::<Vec<_>>(), y.keys().collect::<Vec<_>>());
    for (id, node) in x {
        prop_assert_eq!(
            &node["class_type"],
            &y[id]["class_type"],
            "class of node {}",
            id
        );
        let (ix, iy) = (
            node["inputs"].as_object().unwrap(),
            y[id]["inputs"].as_object().unwrap(),
        );
        prop_assert_eq!(
            ix.keys().collect::<Vec<_>>(),
            iy.keys().collect::<Vec<_>>(),
            "inputs of node {}",
            id
        );
        for (name, v) in ix {
            if v.is_array() || iy[name].is_array() {
                prop_assert_eq!(v, &iy[name], "link {}.{} moved", id, name);
            }
        }
    }
    prop_assert_eq!(&a.output_node, &b.output_node);
    prop_assert_eq!(a.passes.len(), b.passes.len());
    Ok(())
}

/// Every differing input is one the changed setting can reach, and there is at least one.
fn only_inputs(
    base: &BuiltGraph,
    changed: &BuiltGraph,
    allowed: impl Fn(&str, &str) -> bool,
    what: &str,
) -> Result<(), TestCaseError> {
    same_shape(base, changed)?;
    let diff = differing_inputs(&base.prompt, &changed.prompt);
    prop_assert!(!diff.is_empty(), "changing {} changed nothing", what);
    for ((node, input), class) in &diff {
        prop_assert!(
            allowed(class, input),
            "changing {} also changed node {} ({}) input {}",
            what,
            node,
            class,
            input
        );
    }
    Ok(())
}

fn class_counts(g: &BuiltGraph) -> BTreeMap<String, usize> {
    let mut out = BTreeMap::new();
    for node in g.prompt.as_object().unwrap().values() {
        *out.entry(node["class_type"].as_str().unwrap().to_string())
            .or_insert(0) += 1;
    }
    out
}

#[test]
fn changing_the_seed_changes_only_seed_inputs() {
    check(req(), |r| {
        let base = built(&r)?;
        let other = built(&Req {
            seed: r.seed ^ 0x5bd1_e995,
            ..r.clone()
        })?;
        only_inputs(
            &base,
            &other,
            |class, input| class.contains("Sampler") && input.contains("seed"),
            "the seed",
        )?;
        prop_assert_eq!(base.total_steps, other.total_steps);
        Ok(())
    });
}

#[test]
fn changing_the_steps_changes_only_step_inputs() {
    check(req(), |r| {
        let base = built(&r)?;
        let other = built(&Req {
            steps: r.steps + 7,
            ..r.clone()
        })?;
        only_inputs(
            &base,
            &other,
            |class, input| {
                (class.contains("Sampler") || class.contains("Scheduler")) && input.contains("step")
            },
            "the steps",
        )?;
        prop_assert!(other.total_steps > base.total_steps);
        Ok(())
    });
}

#[test]
fn changing_the_guidance_scale_changes_only_cfg_inputs() {
    check(req(), |r| {
        let base = built(&r)?;
        let other = built(&Req {
            cfg: r.cfg + 0.5,
            ..r.clone()
        })?;
        only_inputs(
            &base,
            &other,
            |class, input| {
                (class.contains("Sampler") || class.contains("Guid"))
                    && (input == "cfg" || input == "guidance")
            },
            "cfg",
        )?;
        prop_assert_eq!(base.total_steps, other.total_steps);
        Ok(())
    });
}

#[test]
fn changing_a_prompt_changes_only_the_text_of_text_encoders() {
    check(req(), |r| {
        let base = built(&r)?;
        for positive in [true, false] {
            let mut next = r.clone();
            if positive {
                next.positive.push_str(" extra");
            } else {
                next.negative.push_str(" extra");
            }
            let other = built(&next)?;
            only_inputs(
                &base,
                &other,
                |class, input| class.contains("TextEncode") && input == "text",
                if positive {
                    "the prompt"
                } else {
                    "the negative prompt"
                },
            )?;
            // One encoder reads the prompt and one the negative prompt, so exactly one node changes.
            prop_assert_eq!(differing_inputs(&base.prompt, &other.prompt).len(), 1);
        }
        Ok(())
    });
}

#[test]
fn changing_the_picture_size_changes_only_size_inputs() {
    check(req(), |r| {
        let base = built(&r)?;
        let other = built(&Req {
            width: r.width + 64,
            height: r.height + 64,
            ..r.clone()
        })?;
        // Image modes read the size where the latent is made or the source is fitted, never in a link.
        only_inputs(
            &base,
            &other,
            |_, input| matches!(input, "width" | "height"),
            "the size",
        )?;
        Ok(())
    });
}

#[test]
fn changing_a_lora_weight_changes_only_that_loras_strength_inputs() {
    check(
        (req(), prop::collection::vec(-2.0f64..2.0, 1..3), 0usize..3),
        |(r, loras, which)| {
            let r = Req { loras, ..r };
            let which = which % r.loras.len();
            let base = built(&r)?;
            let mut next = r.clone();
            next.loras[which] += 0.25;
            let other = built(&next)?;
            only_inputs(
                &base,
                &other,
                |class, input| class.contains("Lora") && input.starts_with("strength"),
                "a lora weight",
            )?;
            let nodes: std::collections::BTreeSet<_> =
                differing_inputs(&base.prompt, &other.prompt)
                    .into_keys()
                    .map(|(n, _)| n)
                    .collect();
            prop_assert_eq!(nodes.len(), 1, "one lora node changes");
            Ok(())
        },
    );
}

/// What the builder is expected to add when one part is switched on.
#[derive(Debug, Clone, Copy)]
enum Part {
    Lora,
    Hires,
    Control,
    Reference,
}

fn with_part(r: &Req, part: Part) -> Req {
    let mut next = Req {
        loras: vec![],
        hires: false,
        controls: vec![],
        refs: vec![],
        ..r.clone()
    };
    match part {
        Part::Lora => next.loras = vec![0.7],
        Part::Hires => next.hires = r.mode == "txt2img",
        Part::Control => next.controls = vec![0.9],
        Part::Reference => next.refs = vec![0.6],
    }
    next
}

#[test]
fn switching_a_part_on_adds_nodes_and_removes_none_and_off_again_gives_the_base_back() {
    check(
        (
            req(),
            prop::sample::select(&[Part::Lora, Part::Hires, Part::Control, Part::Reference][..]),
        ),
        |(r, part)| {
            if matches!(part, Part::Hires) && r.mode != "txt2img" {
                return Ok(());
            }
            let base_req = Req {
                loras: vec![],
                hires: false,
                controls: vec![],
                refs: vec![],
                ..r.clone()
            };
            let base = built(&base_req)?;
            let on_req = with_part(&base_req, part);
            let on = built(&on_req)?;
            let (before, after) = (class_counts(&base), class_counts(&on));
            for (class, n) in &before {
                prop_assert!(
                    after.get(class).copied().unwrap_or(0) >= *n,
                    "{:?} on removed a {} node",
                    part,
                    class
                );
            }
            prop_assert!(
                on.prompt.as_object().unwrap().len() > base.prompt.as_object().unwrap().len(),
                "{:?} on added no node",
                part
            );
            // The same request again, and the base request after the part was built, give the same graph.
            prop_assert_eq!(&built(&on_req)?, &on);
            prop_assert_eq!(&built(&base_req)?, &base);
            // The base graph is still the base graph when asked from a request that was switched on and off.
            let off_req = Req {
                loras: vec![],
                hires: false,
                controls: vec![],
                refs: vec![],
                ..on_req.clone()
            };
            prop_assert_eq!(&built(&off_req)?, &base);
            Ok(())
        },
    );
}

#[test]
fn a_hires_pass_adds_a_sampler_and_steps_and_leaves_the_first_pass_as_it_was() {
    check(req(), |r| {
        let off = built(&Req {
            hires: false,
            loras: vec![],
            controls: vec![],
            refs: vec![],
            mode: "txt2img",
            ..r.clone()
        })?;
        let on = built(&Req {
            hires: true,
            loras: vec![],
            controls: vec![],
            refs: vec![],
            mode: "txt2img",
            ..r.clone()
        })?;
        prop_assert!(on.total_steps > off.total_steps);
        prop_assert!(
            on.passes.len() > off.passes.len(),
            "{:?} {:?}",
            on.passes,
            off.passes
        );
        // Every node of the one-pass graph is in the two-pass graph with the same class at the same id.
        for (id, node) in off.prompt.as_object().unwrap() {
            if id != &off.output_node {
                prop_assert_eq!(
                    &node["class_type"],
                    &on.prompt[id]["class_type"],
                    "node {}",
                    id
                );
            }
        }
        Ok(())
    });
}
