//! Property tests for the ComfyUI prompts the backend builds: for any combination of mode, model count, guidance and
//! size, a graph that is built is a well-formed prompt (unique ids, every link points at an existing node, no cycle,
//! no null input), and a request that cannot be built is refused with a reason, never a panic. The editor-prompt
//! preparation gets arbitrary JSON. In process only; no ComfyUI is started.
//! Run: `cargo test -p novira-core --test prop_graph`.
mod prop_common;

use novira_core::comfy::graph::{
    build, BuiltGraph, ControlInput, GraphInput, GuidanceInput, RefInput,
};
use novira_core::comfy::user_graph::{classes, fill_images, prepare};
use novira_core::service::guidance;
use novira_core::types::{
    ComfyGraph, ComfyRef, ControlMode, GenerationMetadata, Guidance, RefImageMethod,
};
use prop_common::{any_text, check, json_object, json_value};
use proptest::prelude::*;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};

fn model(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

/// Every node has a class and an inputs object, every array is a link `[node id, slot]` to a node that exists, and
/// following links never comes back to the same node.
fn assert_well_formed(prompt: &Value) -> Result<(), TestCaseError> {
    let nodes = prompt
        .as_object()
        .ok_or_else(|| TestCaseError::fail("the prompt is not an object"))?;
    prop_assert!(!nodes.is_empty());
    let mut edges: HashMap<&str, Vec<&str>> = HashMap::new();
    for (id, node) in nodes {
        prop_assert!(
            node["class_type"].as_str().is_some_and(|c| !c.is_empty()),
            "node {id} has no class"
        );
        let inputs = node["inputs"].as_object();
        prop_assert!(inputs.is_some(), "node {id} has no inputs");
        for (name, v) in inputs.unwrap() {
            prop_assert!(!v.is_null(), "node {id} input {name} is null");
            let links: Vec<&Vec<Value>> = v.as_array().into_iter().collect();
            for a in links {
                let ok = matches!(a.as_slice(), [Value::String(_), Value::Number(n)] if n.as_u64().is_some());
                prop_assert!(ok, "node {id} input {name} is a malformed link {a:?}");
                let target = a[0].as_str().unwrap();
                prop_assert!(
                    nodes.contains_key(target),
                    "node {id} input {name} links to missing node {target}"
                );
                prop_assert!(target != id, "node {id} links to itself");
                edges.entry(id.as_str()).or_default().push(target);
            }
        }
    }
    // Depth-first search for a cycle.
    let mut done: HashSet<&str> = HashSet::new();
    for start in nodes.keys() {
        let mut path: Vec<(&str, usize)> = vec![(start.as_str(), 0)];
        let mut on_path: HashSet<&str> = HashSet::from([start.as_str()]);
        while let Some((node, next)) = path.pop() {
            if done.contains(node) {
                on_path.remove(node);
                continue;
            }
            match edges.get(node).and_then(|e| e.get(next)) {
                Some(&target) => {
                    path.push((node, next + 1));
                    prop_assert!(!on_path.contains(target), "a link cycle through {target}");
                    if !done.contains(target) {
                        on_path.insert(target);
                        path.push((target, 0));
                    }
                }
                None => {
                    done.insert(node);
                    on_path.remove(node);
                }
            }
        }
    }
    Ok(())
}

fn assert_built(g: &BuiltGraph) -> Result<(), TestCaseError> {
    assert_well_formed(&g.prompt)?;
    let nodes = g.prompt.as_object().unwrap();
    prop_assert!(
        nodes.contains_key(&g.output_node),
        "output node {} is missing",
        g.output_node
    );
    if let Some(t) = &g.thumbnail_node {
        prop_assert!(nodes.contains_key(t), "thumbnail node {t} is missing");
    }
    for (node, _) in &g.passes {
        prop_assert!(nodes.contains_key(node), "pass node {node} is missing");
    }
    prop_assert!(g.total_steps >= 1);
    Ok(())
}

/// One request: the parameters plus what the job brings (models, guidance).
#[derive(Debug, Clone)]
struct Case {
    params: Value,
    loras: Vec<f64>,
    controls: Vec<(f64, [f64; 2], u8)>,
    refs: Vec<(f64, [f64; 2], u8)>,
    mask: bool,
    init: bool,
    vae: bool,
    upscale: bool,
    encoder: bool,
    tidy: bool,
}

const MODES: &[&str] = &[
    "txt2img", "img2img", "inpaint", "outpaint", "upscale", "workflow", "graph", "video", "music",
    "voice", "logo",
];
const SCHEDULERS: &[&str] = &[
    "euler",
    "euler_a",
    "euler_k",
    "dpmpp_2m",
    "dpmpp_2m_k",
    "dpmpp_2m_sde_k",
    "dpmpp_sde_k",
    "heun",
    "lms",
    "ddim",
    "unipc",
    "lcm",
    "nonsense",
];
const SIDES: &[u32] = &[
    0,
    1,
    8,
    63,
    64,
    512,
    1000,
    1024,
    2048,
    4096,
    u32::MAX - 3,
    u32::MAX,
    1 << 24,
];
const WEIGHTS: &[f64] = &[-5.0, -1.0, 0.0, 0.5, 1.0, 2.0, 10.0, 1e308];

fn weight() -> impl Strategy<Value = f64> {
    prop_oneof![prop::sample::select(WEIGHTS), -3.0f64..3.0]
}

fn span() -> impl Strategy<Value = [f64; 2]> {
    (
        prop_oneof![Just(0.0), Just(1.0), -1.0f64..2.0],
        prop_oneof![Just(0.0), Just(1.0), -1.0f64..2.0],
    )
        .prop_map(|(a, b)| [a, b])
}

fn case() -> impl Strategy<Value = Case> {
    let params = (
        (
            prop::sample::select(MODES),
            prop::sample::select(SIDES),
            prop::sample::select(SIDES),
            0u32..60,
            prop_oneof![Just(0.0), Just(1.0), 0.0f64..30.0],
            prop_oneof![Just(0.0), 0.0f64..1.0, Just(2.0)],
            0u32..5,
            any::<u64>(),
            prop::sample::select(SCHEDULERS),
        ),
        (
            prop::option::of(prop_oneof![Just(0.0), Just(0.5), Just(1.0), -0.5f64..1.5]),
            prop::option::of(prop_oneof![Just(0.5), Just(2.0), Just(4.0), 0.0f64..6.0]),
            prop::option::of(prop_oneof![Just(0.0), Just(0.5), Just(1.0), 0.0f64..2.0]),
            prop::option::of((prop_oneof![Just(1.0), 0.5f64..5.0], prop_oneof![Just(0.5), 0.0f64..1.5], prop::option::of(0u32..4))),
            prop::option::of(0u32..64),
            any::<bool>(),
            (any::<bool>(), prop::option::of(any_text())),
        ),
    )
        .prop_map(
            |((mode, w, h, steps, cfg, rescale, clip_skip, seed, scheduler), (strength, scale, draft, hires, blur, seamless, (instrumental, lyrics)))| {
                let mut v = json!({
                    "generationMode": mode, "positivePrompt": "a cat", "negativePrompt": "", "modelKey": "m",
                    "modelName": "M", "vaeKey": null, "seed": seed, "steps": steps, "cfgScale": cfg,
                    "cfgRescale": rescale, "scheduler": scheduler, "width": w, "height": h, "clipSkip": clip_skip,
                    "seamlessX": seamless, "seamlessY": false, "loras": []
                });
                let set = |v: &mut Value, k: &str, x: Value| v[k] = x;
                if let Some(s) = strength { set(&mut v, "strength", json!(s)); }
                if let Some(s) = scale { set(&mut v, "upscaleScale", json!(s)); }
                if let Some(d) = draft { set(&mut v, "draftAt", json!(d)); }
                if let Some((s, st, steps2)) = hires {
                    set(&mut v, "hiresFix", json!({ "scale": s, "strength": st, "steps": steps2 }));
                }
                if let Some(b) = blur { set(&mut v, "maskBlur", json!(b)); }
                if mode == "music" {
                    set(&mut v, "music", json!({ "lyrics": lyrics.unwrap_or_default(), "seconds": steps * 7, "bpm": steps * 5,
                        "key": "E minor", "timeSignature": steps % 7, "language": "ja", "instrumental": instrumental }));
                }
                if mode == "video" {
                    set(&mut v, "videoFrames", json!(steps * 3 + 1));
                    set(&mut v, "videoFps", json!(steps % 40));
                }
                v
            },
        );
    (
        params,
        prop::collection::vec(weight(), 0..4),
        prop::collection::vec((weight(), span(), 0u8..3), 0..3),
        prop::collection::vec((weight(), span(), 0u8..5), 0..3),
        (
            any::<bool>(),
            any::<bool>(),
            any::<bool>(),
            any::<bool>(),
            any::<bool>(),
        ),
        prop::bool::weighted(0.8),
    )
        .prop_map(
            |(params, loras, controls, refs, (mask, init, vae, upscale, encoder), tidy)| Case {
                params,
                loras,
                controls,
                refs,
                mask,
                init,
                vae,
                upscale,
                encoder,
                tidy,
            },
        )
        .prop_map(|c| if c.tidy { c.tidied() } else { c })
}

impl Case {
    /// The same request made consistent (a valid mode, source and mask where the mode needs them, weights in range),
    /// so that a good share of the generated cases actually builds a graph.
    fn tidied(mut self) -> Case {
        let mode = self.params["generationMode"]
            .as_str()
            .unwrap_or("txt2img")
            .to_string();
        let mode = if matches!(mode.as_str(), "graph" | "voice") {
            "txt2img".to_string()
        } else {
            mode
        };
        let image_mode = matches!(
            mode.as_str(),
            "txt2img" | "img2img" | "inpaint" | "outpaint"
        );
        let p = self.params.as_object_mut().unwrap();
        p.insert("generationMode".into(), json!(mode));
        p.insert(
            "steps".into(),
            json!(p["steps"].as_u64().unwrap_or(1).max(4)),
        );
        p.insert("seamlessX".into(), json!(false));
        if p["scheduler"] == "nonsense" {
            p.insert("scheduler".into(), json!("euler"));
        }
        if mode != "txt2img" {
            p.remove("draftAt");
            p.remove("hiresFix");
        }
        if p.get("draftAt").is_some() {
            p.insert("draftAt".into(), json!(0.5));
            p.remove("hiresFix");
        }
        if let Some(h) = p.get_mut("hiresFix") {
            h["scale"] = json!(1.5);
            h["strength"] = json!(0.5);
            h["steps"] = json!(10);
        }
        p.remove("regionalGuidanceCount");
        self.vae = true;
        self.encoder = true;
        self.init = !matches!(mode.as_str(), "txt2img" | "workflow")
            && !matches!(mode.as_str(), "video" | "music" | "logo")
            || self.init && mode == "video";
        self.mask = matches!(mode.as_str(), "inpaint" | "outpaint");
        if !image_mode {
            self.controls.clear();
            self.refs.clear();
        }
        let fix = |w: f64, lo: f64, hi: f64| if w.is_finite() { w.clamp(lo, hi) } else { lo };
        for (w, s, _) in &mut self.controls {
            *w = fix(*w, 0.0, 2.0);
            *s = [0.0, 0.8];
        }
        for (w, s, _) in &mut self.refs {
            *w = fix(*w, -1.0, 2.0);
            *s = [0.1, 0.9];
        }
        self.loras.iter_mut().for_each(|w| *w = fix(*w, -2.0, 2.0));
        self
    }
}

fn try_build(c: &Case, match_counts: bool) -> Result<BuiltGraph, String> {
    let mut params = c.params.clone();
    if match_counts {
        params["refImageCount"] = json!(c.refs.len());
        params["controlLayerCount"] = json!(c.controls.len());
    }
    if params["hiresFix"].is_object() && c.upscale {
        params["hiresFix"]["upscaleModelKey"] = json!("up");
    }
    let params: GenerationMetadata =
        serde_json::from_value(params).map_err(|e| format!("shape: {e}"))?;
    let checkpoint = model("checkpoints", "a.safetensors");
    let vae = model("vae", "v.safetensors");
    let upscale = model("upscale_models", "u.pth");
    let net = model("controlnet", "c.safetensors");
    let adapter = model("ipadapter", "i.safetensors");
    let vision = model("clip_vision", "cv.safetensors");
    let lora_models: Vec<ComfyRef> = (0..c.loras.len())
        .map(|i| model("loras", &format!("l{i}.safetensors")))
        .collect();
    let mode = |m: u8| match m {
        0 => ControlMode::Balanced,
        1 => ControlMode::MoreControl,
        _ => ControlMode::MorePrompt,
    };
    let method = |m: u8| match m {
        0 => RefImageMethod::Full,
        1 => RefImageMethod::Style,
        2 => RefImageMethod::Composition,
        3 => RefImageMethod::StyleStrong,
        _ => RefImageMethod::StylePrecise,
    };
    let input = GraphInput {
        split: None,
        params: &params,
        checkpoint: &checkpoint,
        vae: c.vae.then_some(&vae),
        loras: lora_models
            .iter()
            .zip(&c.loras)
            .map(|(m, w)| (m, *w))
            .collect(),
        upscale_model: c.upscale.then_some(&upscale),
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: c.encoder.then_some(&vae),
        init_image: c.init.then_some("source.png"),
        guidance: GuidanceInput {
            regions: vec![],
            references: vec![],
            mask_image: c.mask.then_some("mask.png"),
            controls: c
                .controls
                .iter()
                .map(|(w, s, m)| ControlInput {
                    model: &net,
                    image: "control.png",
                    weight: *w,
                    begin_end: *s,
                    mode: mode(*m),
                    union_type: None,
                })
                .collect(),
            refs: c
                .refs
                .iter()
                .map(|(w, s, m)| RefInput {
                    model: &adapter,
                    clip_vision: &vision,
                    image: "ref.png",
                    weight: *w,
                    begin_end: *s,
                    method: method(*m),
                    region: None,
                })
                .collect(),
        },
    };
    build(&input)
}

static BUILT: AtomicUsize = AtomicUsize::new(0);
static REFUSED: AtomicUsize = AtomicUsize::new(0);

#[test]
fn a_graph_that_is_built_is_a_well_formed_prompt() {
    check(case(), |c| {
        match try_build(&c, true) {
            Ok(g) => {
                BUILT.fetch_add(1, Ordering::Relaxed);
                assert_built(&g)?;
            }
            Err(reason) => {
                REFUSED.fetch_add(1, Ordering::Relaxed);
                prop_assert!(!reason.is_empty());
            }
        }
        Ok(())
    });
    let (built, refused) = (
        BUILT.load(Ordering::Relaxed),
        REFUSED.load(Ordering::Relaxed),
    );
    assert!(
        built * 20 >= (built + refused),
        "too few cases built a graph to mean anything: {built} of {}",
        built + refused
    );
}

#[test]
fn counts_that_do_not_match_the_guidance_are_refused_not_built() {
    check(case(), |c| {
        // Without matching counts the metadata disagrees with what the job brings, unless there is no guidance.
        if let Ok(g) = try_build(&c, false) {
            prop_assert!(c.refs.is_empty() && c.controls.is_empty());
            assert_built(&g)?;
        }
        Ok(())
    });
}

#[test]
fn every_mode_builds_a_plain_job_with_no_guidance() {
    for mode in ["txt2img", "video", "music", "logo"] {
        let c = Case {
            params: json!({
                "generationMode": mode, "positivePrompt": "a cat", "negativePrompt": "", "modelKey": "m", "modelName": "M",
                "vaeKey": null, "seed": 1, "steps": 20, "cfgScale": 5.0, "cfgRescale": 0, "scheduler": "euler",
                "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": [],
                "music": { "lyrics": "", "seconds": 30, "bpm": 100, "key": "C major", "timeSignature": 4, "language": "en", "instrumental": true }
            }),
            loras: vec![],
            controls: vec![],
            refs: vec![],
            mask: false,
            init: false,
            vae: true,
            upscale: false,
            encoder: true,
            tidy: false,
        };
        let g = try_build(&c, true).unwrap_or_else(|e| panic!("{mode}: {e}"));
        assert_built(&g).unwrap();
    }
}

#[test]
fn guidance_that_the_service_accepts_has_finite_weights_in_range() {
    fn layer() -> impl Strategy<Value = (String, String, f64, [f64; 2])> {
        (any_text(), any_text(), weight(), span())
    }
    check(
        (
            prop::collection::vec(layer(), 0..3),
            prop::collection::vec(layer(), 0..3),
            prop::sample::select(MODES),
            any::<bool>(),
        ),
        |(controls, refs, mode, has_source)| {
            let g: Guidance = serde_json::from_value(json!({
            "controlLayers": controls.iter().map(|(u, k, w, s)| json!({ "imageUrl": u, "modelKey": k, "weight": w, "beginEnd": s, "controlMode": "balanced" })).collect::<Vec<_>>(),
            "refImages": refs.iter().map(|(u, k, w, s)| json!({ "imageUrl": u, "modelKey": k, "weight": w, "beginEnd": s, "method": "full", "clipVisionModel": "ViT-H" })).collect::<Vec<_>>(),
        }))
        .map_err(|e| TestCaseError::reject(e.to_string()))?;
            let params: GenerationMetadata = serde_json::from_value(json!({
            "generationMode": mode, "positivePrompt": "", "negativePrompt": "", "modelKey": "m", "modelName": "M", "vaeKey": null,
            "seed": 0, "steps": 1, "cfgScale": 1, "cfgRescale": 0, "scheduler": "euler", "width": 64, "height": 64, "clipSkip": 0,
            "seamlessX": false, "seamlessY": false, "loras": [],
            "controlLayerCount": controls.len(), "refImageCount": refs.len()
        }))
        .unwrap();
            if guidance::check(&g, &params, has_source).is_ok() {
                for c in &g.control_layers {
                    prop_assert!(c.weight.is_finite() && (0.0..=2.0).contains(&c.weight));
                }
                for r in &g.ref_images {
                    prop_assert!(r.weight.is_finite() && (-1.0..=2.0).contains(&r.weight));
                }
                prop_assert!(
                    g.control_layers.len() <= guidance::MAX_CONTROL_LAYERS
                        && g.ref_images.len() <= guidance::MAX_REF_IMAGES
                );
                for l in g
                    .control_layers
                    .iter()
                    .map(|c| c.begin_end)
                    .chain(g.ref_images.iter().map(|r| r.begin_end))
                {
                    prop_assert!(
                        l[0].is_finite()
                            && l[1].is_finite()
                            && 0.0 <= l[0]
                            && l[0] <= l[1]
                            && l[1] <= 1.0
                    );
                }
            }
            Ok(())
        },
    );
}

/// A prompt shaped like an editor graph: nodes with ids `1..=5`, inputs that are plain JSON, placeholders or links.
fn editor_graph() -> impl Strategy<Value = (Map<String, Value>, Vec<String>, Option<String>)> {
    let id = prop::sample::select(&["1", "2", "3", "4", "5", "9"][..]).prop_map(str::to_string);
    let placeholder = prop_oneof![
        any_text().prop_map(|k| json!({ "$model": k })),
        any_text().prop_map(|k| json!({ "$image": k })),
        any_text().prop_map(|k| json!({ "$sampler_name": k })),
        any_text().prop_map(|k| json!({ "$scheduler": k })),
        prop_oneof![
            Just("ViT-H".to_string()),
            Just("ViT-G".to_string()),
            Just("ViT-L".to_string()),
            any_text()
        ]
        .prop_map(|k| json!({ "$clip_vision": k })),
        Just(json!({ "$seed": true })),
        any_text().prop_map(|k| json!({ "$other": k })),
    ];
    let link = (id.clone(), 0u32..3).prop_map(|(i, s)| json!([i, s]));
    let value = prop_oneof![3 => json_value(), 3 => placeholder, 3 => link];
    let node = (
        prop_oneof![3 => "[A-Za-z]{1,8}".prop_map(Value::String), 1 => json_value()],
        prop::collection::vec(("[a-z]{1,5}", value), 0..5),
        any::<bool>(),
    )
        .prop_map(|(class, inputs, plain)| {
            let inputs: Map<String, Value> = inputs.into_iter().collect();
            if plain {
                json!({ "class_type": class, "inputs": inputs })
            } else {
                json!({ "class_type": class, "inputs": Value::Array(vec![]) })
            }
        });
    (
        prop::collection::vec((id.clone(), node), 0..6)
            .prop_map(|n| n.into_iter().collect::<Map<_, _>>()),
        prop::collection::vec(id.clone(), 0..3),
        prop::option::of(id),
    )
}

#[test]
fn a_prepared_editor_prompt_has_no_placeholder_left_but_pictures_and_no_dangling_link() {
    check(editor_graph(), |(prompt, outputs, thumbnail)| {
        let graph = ComfyGraph {
            prompt,
            outputs,
            thumbnail,
        };
        let asked = std::cell::RefCell::new(Vec::new());
        let result = prepare(
            &graph,
            42,
            |key| {
                asked.borrow_mut().push(key.to_string());
                if key.len() % 3 == 0 {
                    Err("no such model".into())
                } else {
                    Ok(model("checkpoints", key))
                }
            },
            |size| {
                let name = format!("{size:?}");
                asked.borrow_mut().push(name.clone());
                if size == novira_core::types::ClipVisionModel::VitG {
                    Err("no such encoder".into())
                } else {
                    Ok(model("clip_vision", &name))
                }
            },
        );
        let asked = asked.into_inner();
        if let Ok(p) = result {
            assert_well_formed_loose(&p.prompt)?;
            for o in p.outputs.iter().chain(p.thumbnail.iter()) {
                prop_assert!(p.prompt.get(o).is_some(), "output {o} is missing");
            }
            for m in &p.models {
                prop_assert!(asked.contains(&m.name));
            }
            // Pictures wait for their upload; filling them finishes the job.
            let uploads: HashMap<String, String> = p
                .images
                .iter()
                .map(|i| (i.clone(), format!("up_{i}")))
                .collect();
            let mut prompt = p.prompt.clone();
            prop_assert!(fill_images(&mut prompt, &uploads).is_ok());
            prop_assert!(!prompt.to_string().contains("\"$image\""));
            prop_assert!(classes(&prompt).len() <= prompt.as_object().unwrap().len());
        }
        Ok(())
    });
}

/// Like `assert_well_formed`, for prompts whose values come from arbitrary JSON: only links the backend itself
/// recognises (an array of a string and a number) must point at a node.
fn assert_well_formed_loose(prompt: &Value) -> Result<(), TestCaseError> {
    let nodes = prompt
        .as_object()
        .ok_or_else(|| TestCaseError::fail("not an object"))?;
    for (id, node) in nodes {
        prop_assert!(node["class_type"].as_str().is_some_and(|c| !c.is_empty()));
        let inputs = node["inputs"]
            .as_object()
            .ok_or_else(|| TestCaseError::fail(format!("node {id} has no inputs")))?;
        for (name, v) in inputs {
            if let Some([Value::String(src), Value::Number(_)]) = v.as_array().map(Vec::as_slice) {
                prop_assert!(
                    nodes.contains_key(src),
                    "{id}.{name} links to missing {src}"
                );
            }
            if let Some(o) = v.as_object() {
                let placeholder_left = o.len() == 1
                    && o.keys()
                        .next()
                        .is_some_and(|k| k.starts_with('$') && k != "$image");
                prop_assert!(
                    !placeholder_left,
                    "{id}.{name} still holds a placeholder: {v}"
                );
            }
        }
    }
    Ok(())
}

#[test]
fn arbitrary_json_as_an_editor_prompt_never_panics() {
    check(
        (json_object(), prop::collection::vec(any_text(), 0..3)),
        |(prompt, outputs)| {
            let Ok(graph) = serde_json::from_value::<ComfyGraph>(
                json!({ "prompt": prompt, "outputs": outputs, "thumbnail": null }),
            ) else {
                return Ok(());
            };
            if let Ok(prepared) = prepare(
                &graph,
                1,
                |k| Ok(model("checkpoints", k)),
                |size| Ok(model("clip_vision", &format!("{size:?}"))),
            ) {
                let mut p = prepared.prompt;
                let _ = fill_images(&mut p, &HashMap::new());
            }
            let _ = classes(&prompt);
            Ok(())
        },
    );
}

/// Found by the property tests and fixed: `fill_images` indexed each node mutably, and `serde_json` panics when a node is a
/// number, a string or a boolean. It is only called with prompts `prepare` returned (always objects), so nothing
/// outside the backend can reach it today; the pinned input keeps it so.
#[test]
fn filling_pictures_into_a_prompt_with_a_node_that_is_not_an_object_does_not_panic() {
    let mut prompt = json!({ "1": false });
    let result = fill_images(&mut prompt, &HashMap::new());
    assert!(result.is_ok());
}

/// Found by the property tests and fixed: `round8` multiplied `round(side / 8)` by 8 in `u32`, which overflows for a side of
/// 4294967292 or more (a panic in a debug build, a wrapped 0 turned into 64 in a release build). Nothing at enqueue
/// time limits the size, so a job asking for such a width reaches the graph builder.
#[test]
fn an_enormous_width_does_not_overflow_the_size_snapping() {
    let params: GenerationMetadata = serde_json::from_value(json!({
        "generationMode": "txt2img", "positivePrompt": "", "negativePrompt": "", "modelKey": "m", "modelName": "M",
        "vaeKey": null, "seed": 0, "steps": 4, "cfgScale": 1, "cfgRescale": 0, "scheduler": "euler",
        "width": u32::MAX, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": []
    }))
    .unwrap();
    let (w, h) = novira_core::comfy::graph::output_size(&params);
    assert!(w >= 64 && h >= 64);
}

/// Found by the property tests and fixed: the video size snapping added 16 to the width in `u32` (overflow for a
/// width of 4294967280 or more).
#[test]
fn a_video_job_with_an_enormous_width_is_built_or_refused_without_overflow() {
    let c = Case {
        params: json!({
            "generationMode": "video", "positivePrompt": "a cat", "negativePrompt": "", "modelKey": "m", "modelName": "M",
            "vaeKey": null, "seed": 1, "steps": 4, "cfgScale": 1.0, "cfgRescale": 0, "scheduler": "euler",
            "width": u32::MAX, "height": u32::MAX, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": []
        }),
        loras: vec![],
        controls: vec![],
        refs: vec![],
        mask: false,
        init: false,
        vae: true,
        upscale: false,
        encoder: true,
        tidy: false,
    };
    if let Ok(g) = try_build(&c, true) {
        assert_built(&g).unwrap();
    }
}
