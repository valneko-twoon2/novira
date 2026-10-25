//! Prompts the workflow editor builds itself, for every graph it runs. The editor writes
//! ComfyUI's API prompt; what only the backend knows is left as single-key placeholder objects:
//! `{"$model": key}` (a model of the library), `{"$image": name}` (a gallery picture to upload),
//! `{"$sampler_name": s}` / `{"$scheduler": s}` (from an editor scheduler name), `{"$clip_vision": "ViT-H"}` (the installed
//! CLIP vision model of that size), `{"$seed": true}` (the item's seed) and `{"$speech": {text, language, mode,
//! speaker, instruct}}` (text to read aloud: the voice engine makes the sound before the run and it is uploaded like a
//! gallery sound, so the placeholder becomes `{"$image": "speech-1.wav"}`).
use super::graph::sampler_for;
use crate::types::{ClipVisionModel, ComfyGraph, ComfyRef, VoiceMode, VoiceParams};
use serde_json::{Map, Value};
use std::collections::{BTreeSet, HashMap};

/// A prompt with every placeholder but the pictures filled in.
#[derive(Debug, Clone, PartialEq)]
pub struct PreparedGraph {
    pub prompt: Value,
    pub outputs: Vec<String>,
    /// Every model the prompt loads, for the "can ComfyUI see it" check.
    pub models: Vec<ComfyRef>,
    /// The node that gives a video's first frame, when the graph makes one.
    pub thumbnail: Option<String>,
    /// Gallery pictures, videos and sounds still written as `{"$image": name}`; they are uploaded right before the run.
    pub images: Vec<String>,
    /// Speech to make before the run; each is written in the prompt as `{"$image": name}` too, but is not in `images`.
    pub speeches: Vec<Speech>,
}

/// Text a graph has read aloud: the sound is made by the voice engine and uploaded under `name`.
#[derive(Debug, Clone, PartialEq)]
pub struct Speech {
    pub name: String,
    pub voice: VoiceParams,
}

/// Speeches one graph may ask for, and the longest text and voice description of one.
const MAX_SPEECHES: usize = 8;
const MAX_SPEECH_CHARS: usize = 4000;
const MAX_INSTRUCT_CHARS: usize = 500;

/// A `$speech` placeholder as the voice parameters it asks for, checked.
fn speech_voice(class: &str, field: &str, v: &Value) -> Result<VoiceParams, String> {
    let mut voice: VoiceParams = serde_json::from_value(v.clone())
        .map_err(|e| format!("{class}.{field}: the speech is not valid ({e})"))?;
    voice.text = voice.text.trim().to_string();
    voice.instruct = voice.instruct.trim().to_string();
    if voice.text.is_empty() {
        return Err(format!("{class}.{field}: there is no text to read"));
    }
    if voice.text.chars().count() > MAX_SPEECH_CHARS {
        return Err(format!(
            "{class}.{field}: the text to read is longer than {MAX_SPEECH_CHARS} characters"
        ));
    }
    if voice.instruct.chars().count() > MAX_INSTRUCT_CHARS {
        return Err(format!(
            "{class}.{field}: the voice description is longer than {MAX_INSTRUCT_CHARS} characters"
        ));
    }
    if voice.mode == VoiceMode::Design && voice.instruct.is_empty() {
        return Err(format!(
            "{class}.{field}: a voice described in words needs its description"
        ));
    }
    Ok(voice)
}

fn placeholder(v: &Value) -> Option<(&str, &Value)> {
    let obj = v.as_object()?;
    if obj.len() != 1 {
        return None;
    }
    let (k, inner) = obj.iter().next()?;
    k.starts_with('$').then_some((k.as_str(), inner))
}

/// Checks the shape of the prompt and fills the placeholders. `model` maps a library key to where ComfyUI finds it,
/// `clip_vision` a size to the installed CLIP vision model of that size.
pub fn prepare(
    graph: &ComfyGraph,
    seed: u64,
    mut model: impl FnMut(&str) -> Result<ComfyRef, String>,
    mut clip_vision: impl FnMut(ClipVisionModel) -> Result<ComfyRef, String>,
) -> Result<PreparedGraph, String> {
    if graph.outputs.is_empty() {
        return Err("The graph has no output node".into());
    }
    if let Some(missing) = graph
        .outputs
        .iter()
        .chain(graph.thumbnail.iter())
        .find(|o| !graph.prompt.contains_key(*o))
    {
        return Err(format!("The output node {missing} is not in the graph"));
    }
    let mut prompt = Map::new();
    let mut models: Vec<ComfyRef> = Vec::new();
    let mut images: Vec<String> = Vec::new();
    let mut speeches: Vec<Speech> = Vec::new();
    for (id, node) in &graph.prompt {
        let class = node["class_type"].as_str().unwrap_or_default();
        if class.is_empty() {
            return Err(format!("Node {id} has no class_type"));
        }
        let Some(inputs) = node["inputs"].as_object() else {
            return Err(format!("Node {id} ({class}) has no inputs object"));
        };
        let mut filled = Map::new();
        for (name, v) in inputs {
            let value = match placeholder(v) {
                None => {
                    if let Some([Value::String(src), Value::Number(_)]) =
                        v.as_array().map(Vec::as_slice)
                    {
                        if !graph.prompt.contains_key(src) {
                            return Err(format!(
                                "{class}.{name} is linked to a missing node {src}"
                            ));
                        }
                    }
                    v.clone()
                }
                Some(("$model", Value::String(key))) => {
                    let r = model(key)?;
                    let name = Value::String(r.name.clone());
                    if !models.contains(&r) {
                        models.push(r);
                    }
                    name
                }
                Some(("$clip_vision", size)) => {
                    let size: ClipVisionModel = serde_json::from_value(size.clone())
                        .map_err(|_| format!("{class}.{name}: unknown CLIP vision size {size}"))?;
                    let r = clip_vision(size)?;
                    let name = Value::String(r.name.clone());
                    if !models.contains(&r) {
                        models.push(r);
                    }
                    name
                }
                Some(("$image", Value::String(image))) => {
                    if !images.contains(image) {
                        images.push(image.clone());
                    }
                    v.clone()
                }
                Some((kind @ ("$sampler_name" | "$scheduler"), Value::String(s))) => {
                    let (sampler, scheduler) =
                        sampler_for(s).ok_or_else(|| format!("Unknown scheduler {s}"))?;
                    Value::String(
                        if kind == "$sampler_name" {
                            sampler
                        } else {
                            scheduler
                        }
                        .into(),
                    )
                }
                Some(("$seed", _)) => Value::from(seed),
                Some(("$speech", spoken)) => {
                    let voice = speech_voice(class, name, spoken)?;
                    let at = match speeches.iter().position(|s| s.voice == voice) {
                        Some(at) => at,
                        None if speeches.len() >= MAX_SPEECHES => {
                            return Err(format!(
                                "The graph reads aloud in more than {MAX_SPEECHES} different ways"
                            ));
                        }
                        None => {
                            speeches.push(Speech {
                                name: format!("speech-{}.wav", speeches.len() + 1),
                                voice,
                            });
                            speeches.len() - 1
                        }
                    };
                    serde_json::json!({ "$image": speeches[at].name })
                }
                Some((other, _)) => {
                    return Err(format!("{class}.{name}: unknown placeholder {other}"));
                }
            };
            filled.insert(name.clone(), value);
        }
        prompt.insert(
            id.clone(),
            serde_json::json!({ "class_type": class, "inputs": filled }),
        );
    }
    Ok(PreparedGraph {
        prompt: Value::Object(prompt),
        outputs: graph.outputs.clone(),
        thumbnail: graph.thumbnail.clone(),
        models,
        images,
        speeches,
    })
}

/// Puts the names ComfyUI gave the uploaded pictures in place of their `{"$image": name}` placeholders.
pub fn fill_images(prompt: &mut Value, uploaded: &HashMap<String, String>) -> Result<(), String> {
    let Some(nodes) = prompt.as_object_mut() else {
        return Ok(());
    };
    for node in nodes.values_mut() {
        let Some(inputs) = node.get_mut("inputs").and_then(Value::as_object_mut) else {
            continue;
        };
        for v in inputs.values_mut() {
            if let Some(("$image", Value::String(name))) = placeholder(v) {
                let up = uploaded
                    .get(name)
                    .ok_or_else(|| format!("The picture {name} was not uploaded"))?;
                *v = Value::String(up.clone());
            }
        }
    }
    Ok(())
}

/// The node classes the prompt uses.
pub fn classes(prompt: &Value) -> BTreeSet<String> {
    prompt
        .as_object()
        .into_iter()
        .flatten()
        .filter_map(|(_, n)| n["class_type"].as_str().map(str::to_string))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn graph(prompt: Value, outputs: &[&str]) -> ComfyGraph {
        serde_json::from_value(json!({ "prompt": prompt, "outputs": outputs })).unwrap()
    }

    fn lib(key: &str) -> Result<ComfyRef, String> {
        match key {
            "sdxl" => Ok(ComfyRef {
                folder: "checkpoints".into(),
                name: "sdxl\\base.safetensors".into(),
            }),
            _ => Err(format!("Graph model not found: {key}")),
        }
    }

    fn vision(size: ClipVisionModel) -> Result<ComfyRef, String> {
        match size {
            ClipVisionModel::VitH => Ok(ComfyRef {
                folder: "clip_vision".into(),
                name: "vit-h.safetensors".into(),
            }),
            _ => Err("no ViT-G or ViT-L CLIP vision model".into()),
        }
    }

    #[test]
    fn a_video_graph_names_its_thumbnail_and_may_load_a_clip() {
        let mut g = graph(
            json!({
                "src": { "class_type": "LoadVideo", "inputs": { "file": { "$image": "clip.mp4" } } },
                "save": { "class_type": "SaveVideo", "inputs": { "video": ["src", 0] } },
                "first": { "class_type": "PreviewImage", "inputs": { "images": ["src", 0] } }
            }),
            &["save"],
        );
        g.thumbnail = Some("first".into());
        let p = prepare(&g, 1, lib, vision).unwrap();
        assert_eq!(p.thumbnail.as_deref(), Some("first"));
        assert_eq!(p.images, vec!["clip.mp4".to_string()]);
        g.thumbnail = Some("nowhere".into());
        assert!(prepare(&g, 1, lib, vision).unwrap_err().contains("nowhere"));
    }

    #[test]
    fn placeholders_become_what_comfyui_expects() {
        let g = graph(
            json!({
                "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": { "$model": "sdxl" } } },
                "2": { "class_type": "LoadImage", "inputs": { "image": { "$image": "a.png" } } },
                "3": { "class_type": "KSampler", "inputs": {
                    "model": ["1", 0], "seed": { "$seed": true }, "steps": 20,
                    "sampler_name": { "$sampler_name": "dpmpp_2m_k" }, "scheduler": { "$scheduler": "dpmpp_2m_k" }
                } },
                "4": { "class_type": "FaceRig", "inputs": { "image": ["2", 0], "options": { "a": 1, "b": 2 } } },
                "5": { "class_type": "SaveImage", "inputs": { "images": ["4", 0] } }
            }),
            &["5"],
        );
        let p = prepare(&g, 77, lib, vision).unwrap();
        assert_eq!(
            p.prompt["1"]["inputs"]["ckpt_name"],
            "sdxl\\base.safetensors"
        );
        assert_eq!(p.prompt["3"]["inputs"]["seed"], 77);
        assert_eq!(p.prompt["3"]["inputs"]["sampler_name"], "dpmpp_2m");
        assert_eq!(p.prompt["3"]["inputs"]["scheduler"], "karras");
        assert_eq!(
            p.prompt["4"]["inputs"]["options"],
            json!({ "a": 1, "b": 2 })
        );
        assert_eq!(p.models.len(), 1);
        assert_eq!(p.images, vec!["a.png".to_string()]);
        assert_eq!(
            classes(&p.prompt).into_iter().collect::<Vec<_>>(),
            [
                "CheckpointLoaderSimple",
                "FaceRig",
                "KSampler",
                "LoadImage",
                "SaveImage"
            ]
        );

        let mut prompt = p.prompt.clone();
        assert!(fill_images(&mut prompt, &HashMap::new()).is_err());
        let up = HashMap::from([("a.png".to_string(), "novira-1.png".to_string())]);
        fill_images(&mut prompt, &up).unwrap();
        assert_eq!(prompt["2"]["inputs"]["image"], "novira-1.png");
    }

    #[test]
    fn broken_graphs_are_refused_with_the_reason() {
        let save = json!({ "class_type": "SaveImage", "inputs": { "images": ["9", 0] } });
        let err = |prompt: Value, outputs: &[&str]| {
            prepare(&graph(prompt, outputs), 1, lib, vision).unwrap_err()
        };
        assert!(err(json!({ "1": save }), &[]).contains("no output"));
        assert!(err(json!({ "1": save }), &["2"]).contains("not in the graph"));
        assert!(err(json!({ "1": save }), &["1"]).contains("missing node 9"));
        assert!(err(json!({ "1": { "inputs": {} } }), &["1"]).contains("class_type"));
        let unknown =
            json!({ "1": { "class_type": "X", "inputs": { "m": { "$model": "nope" } } } });
        assert!(err(unknown, &["1"]).contains("not found: nope"));
        let sched =
            json!({ "1": { "class_type": "X", "inputs": { "s": { "$scheduler": "warp" } } } });
        assert!(err(sched, &["1"]).contains("Unknown scheduler"));
        let other = json!({ "1": { "class_type": "X", "inputs": { "s": { "$env": "PATH" } } } });
        assert!(err(other, &["1"]).contains("unknown placeholder"));
        let size =
            json!({ "1": { "class_type": "X", "inputs": { "c": { "$clip_vision": "ViT-Z" } } } });
        assert!(err(size, &["1"]).contains("unknown CLIP vision size"));
        let absent =
            json!({ "1": { "class_type": "X", "inputs": { "c": { "$clip_vision": "ViT-G" } } } });
        assert!(err(absent, &["1"]).contains("no ViT-G"));
    }

    fn speech(text: &str) -> Value {
        json!({ "text": text, "language": "Auto", "mode": "preset", "speaker": "Ono_Anna", "instruct": "" })
    }

    fn reads(spoken: Value) -> Value {
        json!({ "class_type": "LoadAudio", "inputs": { "audio": { "$speech": spoken } } })
    }

    #[test]
    fn a_speech_placeholder_becomes_an_upload_and_the_same_speech_is_made_once() {
        let g = graph(
            json!({
                "a": reads(speech(" Hello ")),
                "b": reads(speech("Hello")),
                "c": reads(speech("Goodbye")),
                "s": { "class_type": "SaveAudio", "inputs": { "audio": ["a", 0] } }
            }),
            &["s"],
        );
        let p = prepare(&g, 1, lib, vision).unwrap();
        assert_eq!(
            p.prompt["a"]["inputs"]["audio"],
            json!({ "$image": "speech-1.wav" })
        );
        assert_eq!(
            p.prompt["b"]["inputs"]["audio"],
            json!({ "$image": "speech-1.wav" })
        );
        assert_eq!(
            p.prompt["c"]["inputs"]["audio"],
            json!({ "$image": "speech-2.wav" })
        );
        let texts: Vec<&str> = p.speeches.iter().map(|s| s.voice.text.as_str()).collect();
        assert_eq!(texts, ["Hello", "Goodbye"], "the text is trimmed");
        assert!(p.images.is_empty(), "speech is not read from the gallery");
        let mut prompt = p.prompt.clone();
        let up = HashMap::from([
            ("speech-1.wav".to_string(), "novira-1.wav".to_string()),
            ("speech-2.wav".to_string(), "novira-2.wav".to_string()),
        ]);
        fill_images(&mut prompt, &up).unwrap();
        assert_eq!(prompt["c"]["inputs"]["audio"], "novira-2.wav");
    }

    #[test]
    fn a_speech_that_cannot_be_made_is_refused_with_the_reason() {
        let err = |spoken: Value| {
            let g = graph(json!({ "a": reads(spoken) }), &["a"]);
            prepare(&g, 1, lib, vision).unwrap_err()
        };
        assert!(err(speech("   ")).contains("no text to read"));
        assert!(err(speech(&"a".repeat(MAX_SPEECH_CHARS + 1))).contains("longer than"));
        let mut designed = speech("Hi");
        designed["mode"] = json!("design");
        assert!(err(designed.clone()).contains("needs its description"));
        designed["instruct"] = json!("x".repeat(MAX_INSTRUCT_CHARS + 1));
        assert!(err(designed).contains("voice description is longer"));
        assert!(err(json!({ "text": "Hi" })).contains("not valid"));
        assert!(err(json!("Hi")).contains("not valid"));
        let mut odd = speech("Hi");
        odd["mode"] = json!("shout");
        assert!(err(odd).contains("not valid"));
        let many: serde_json::Map<String, Value> = (0..=MAX_SPEECHES)
            .map(|i| (format!("n{i}"), reads(speech(&format!("line {i}")))))
            .collect();
        let g = graph(Value::Object(many), &["n0"]);
        assert!(prepare(&g, 1, lib, vision)
            .unwrap_err()
            .contains("more than 8"));
    }

    #[test]
    fn a_clip_vision_size_becomes_the_installed_model_and_is_checked_like_a_model() {
        let g = graph(
            json!({
                "1": { "class_type": "CLIPVisionLoader", "inputs": { "clip_name": { "$clip_vision": "ViT-H" } } },
                "2": { "class_type": "CLIPVisionLoader", "inputs": { "clip_name": { "$clip_vision": "ViT-H" } } }
            }),
            &["1"],
        );
        let p = prepare(&g, 1, lib, vision).unwrap();
        assert_eq!(p.prompt["1"]["inputs"]["clip_name"], "vit-h.safetensors");
        assert_eq!(p.prompt["2"]["inputs"]["clip_name"], "vit-h.safetensors");
        assert_eq!(p.models.len(), 1, "one file, listed once for the check");
    }
}
