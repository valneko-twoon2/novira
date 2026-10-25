//! Checks every prompt of the graph snapshots against the node definitions of a real ComfyUI
//! (`__snapshots__/node-defs.json`, saved by `node tools/comfy-node-defs.mjs <URL>`): the node exists, the inputs
//! are the ones the node has, none required is missing, a link points at an output of the right type, and a value is
//! one of the choices and within the limits. This is what ComfyUI would say first when it validates the prompt,
//! without a GPU.
//!
//! It cannot see what ComfyUI decides only when it runs: a file that is not installed, a model that does not fit the
//! node. Those need the real engine (`docs/verification.md`). The definitions are those of the ComfyUI version in the
//! file; save them again to follow a newer one.
use serde_json::{Map, Value};
use std::path::PathBuf;

const DEFS: &str = include_str!("__snapshots__/node-defs.json");

/// What is wrong in `prompt` according to `defs`, one line each.
fn problems(prompt: &Value, defs: &Value) -> Vec<String> {
    let mut out = Vec::new();
    let Some(nodes) = prompt.as_object() else {
        return vec!["the prompt is not an object".into()];
    };
    for (id, node) in nodes {
        let class = node["class_type"].as_str().unwrap_or("");
        let Some(def) = defs["nodes"].get(class) else {
            out.push(format!("node {id}: ComfyUI has no node {class}"));
            continue;
        };
        let at = format!("node {id} ({class})");
        let inputs = node["inputs"].as_object().cloned().unwrap_or_default();
        let required = def["required"].as_object().cloned().unwrap_or_default();
        let optional = def["optional"].as_object().cloned().unwrap_or_default();
        // A node with a dynamic input (a V3 combo) takes more inputs than its definition lists.
        let dynamic = required
            .values()
            .chain(optional.values())
            .any(|s| s["type"] == "DYNAMIC");
        for (name, spec) in &required {
            if spec["type"] != "DYNAMIC" && !inputs.contains_key(name) {
                out.push(format!("{at}: required input {name} is missing"));
            }
        }
        for (name, value) in &inputs {
            let Some(spec) = required.get(name).or_else(|| optional.get(name)) else {
                if !dynamic {
                    out.push(format!("{at}: {class} has no input {name}"));
                }
                continue;
            };
            if let Some(why) = bad_value(value, spec, nodes, defs) {
                out.push(format!("{at}: input {name} {why}"));
            }
        }
    }
    out
}

/// Why `value` does not fit the input `spec`, if it does not.
fn bad_value(
    value: &Value,
    spec: &Value,
    nodes: &Map<String, Value>,
    defs: &Value,
) -> Option<String> {
    let want = spec["type"].as_str().unwrap_or("");
    if want == "DYNAMIC" {
        return None;
    }
    // A link: [node id, output slot].
    if let Some([from, slot]) = value
        .as_array()
        .map(Vec::as_slice)
        .and_then(|a| <&[Value; 2]>::try_from(a).ok())
    {
        let from = from.as_str().unwrap_or("");
        let Some(source) = nodes.get(from) else {
            return Some(format!("links to node {from}, which is not in the prompt"));
        };
        let class = source["class_type"].as_str().unwrap_or("");
        // A source node that is not in the definitions is reported on its own.
        let outputs = defs["nodes"][class]["output"].as_array()?;
        let slot = slot.as_u64().unwrap_or(u64::MAX) as usize;
        let Some(have) = outputs.get(slot).and_then(Value::as_str) else {
            return Some(format!(
                "links to output {slot} of {class}, which has {}",
                outputs.len()
            ));
        };
        return (want != have && want != "*" && have != "*")
            .then(|| format!("wants {want} but {class} output {slot} is {have}"));
    }
    match want {
        "COMBO" => {
            let options = spec["options"].as_array()?;
            (!options.contains(value))
                .then(|| format!("is {value}, not one of {}", Value::Array(options.clone())))
        }
        // A type that takes either (`FLOAT,INT`, a frame rate) is checked as a number.
        "INT" | "FLOAT" | "FLOAT,INT" | "INT,FLOAT" => {
            let Some(n) = value.as_f64() else {
                return Some(format!("is {value}, not a number"));
            };
            if want == "INT" && n.fract() != 0.0 {
                return Some(format!("is {value}, not a whole number"));
            }
            let below = spec["min"].as_f64().is_some_and(|m| n < m);
            let above = spec["max"].as_f64().is_some_and(|m| n > m);
            (below || above)
                .then(|| format!("is {value}, outside {}..{}", spec["min"], spec["max"]))
        }
        "BOOLEAN" => (!value.is_boolean()).then(|| format!("is {value}, not true or false")),
        "STRING" => (!value.is_string()).then(|| format!("is {value}, not text")),
        // A picture, a model or the like must come from a link.
        _ => Some(format!(
            "is the value {value}, but {want} comes from another node"
        )),
    }
}

fn snapshot_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/comfy/__snapshots__/graph")
}

#[test]
fn every_snapshot_prompt_fits_the_node_definitions_of_a_real_comfyui() {
    let defs: Value = serde_json::from_str(DEFS).expect("node-defs.json is JSON");
    let mut bad = Vec::new();
    let mut checked = 0;
    for entry in std::fs::read_dir(snapshot_dir()).unwrap() {
        let path = entry.unwrap().path();
        let snapshot: Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        let name = path.file_stem().unwrap().to_string_lossy().to_string();
        // Built graphs keep the prompt under `prompt`. The editor graph (`prepared`)
        // is the user own, with nodes of any pack, so it is not checked.
        if snapshot.get("prepared").is_some() {
            continue;
        }
        let prompt = snapshot.get("prompt").unwrap_or(&snapshot);
        for line in problems(prompt, &defs) {
            bad.push(format!("{name}: {line}"));
        }
        checked += 1;
    }
    assert!(checked >= 40, "only {checked} snapshots found");
    assert!(
        bad.is_empty(),
        "ComfyUI {} would refuse these:\n{}\n(if a node is new, run `node tools/comfy-node-defs.mjs <URL>`)",
        defs["comfyui"],
        bad.join("\n")
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn defs() -> Value {
        json!({ "nodes": {
            "Load": { "required": { "name": {"type": "COMBO", "options": null} }, "optional": {}, "output": ["MODEL"] },
            "Sample": {
                "required": {
                    "model": {"type": "MODEL"},
                    "steps": {"type": "INT", "min": 1, "max": 100},
                    "sampler": {"type": "COMBO", "options": ["euler", "heun"]},
                },
                "optional": { "mask": {"type": "MASK"} },
                "output": ["LATENT"]
            }
        }})
    }

    fn said(sample: Value) -> String {
        problems(
            &json!({
                "1": {"class_type": "Load", "inputs": {"name": "m.safetensors"}},
                "2": {"class_type": "Sample", "inputs": sample}
            }),
            &defs(),
        )
        .join("\n")
    }

    #[test]
    fn a_correct_prompt_has_no_problems() {
        assert_eq!(
            said(json!({"model": ["1", 0], "steps": 20, "sampler": "euler"})),
            ""
        );
    }

    #[test]
    fn each_kind_of_mistake_is_named() {
        let ok = json!({"model": ["1", 0], "steps": 20, "sampler": "euler"});
        let with = |key: &str, value: Value| {
            let mut v = ok.clone();
            v[key] = value;
            said(v)
        };
        let mut no_model = ok.clone();
        no_model.as_object_mut().unwrap().remove("model");
        assert!(said(no_model).contains("required input model is missing"));
        assert!(with("seed", json!(1)).contains("has no input seed"));
        assert!(with("sampler", json!("ddim")).contains("not one of"));
        assert!(with("steps", json!(500)).contains("outside"));
        assert!(with("steps", json!(2.5)).contains("whole number"));
        assert!(
            with("model", json!(["2", 0])).contains("wants MODEL but Sample output 0 is LATENT")
        );
        assert!(with("model", json!(["1", 3])).contains("output 3"));
        assert!(with("model", json!(["9", 0])).contains("not in the prompt"));
        assert!(with("model", json!("m")).contains("comes from another node"));
        let unknown = problems(&json!({"1": {"class_type": "Nope", "inputs": {}}}), &defs());
        assert!(unknown[0].contains("no node Nope"));
    }

    #[test]
    fn a_node_with_a_dynamic_input_takes_the_inputs_of_its_choice() {
        let defs = json!({ "nodes": { "Save": {
            "required": { "format": {"type": "DYNAMIC"} }, "optional": {}, "output": []
        }}});
        let prompt =
            json!({"1": {"class_type": "Save", "inputs": {"format": "mp4", "codec": "auto"}}});
        assert!(problems(&prompt, &defs).is_empty());
    }
}
