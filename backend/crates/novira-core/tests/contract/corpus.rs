//! The differential corpus (`contract/corpus/<fixture>.jsonl`, written by `contract/corpus/generate.mjs`): seeded
//! valid and damaged variants of the fixtures. Rust is the oracle that produces each case's verdict: it reads the value
//! with serde into the real type (accepted or refused) and writes the accepted value back. The verdict is stored in the
//! case under `rust`; the TypeScript test (`frontend/src/backend/contractCorpus.test.ts`) compares it with what
//! `types.ts` says. Here the stored verdict is re-derived on every run, so a change to a Rust type that changes what is
//! accepted or written fails naming the case. `CONTRACT_CORPUS_UPDATE=1` rewrites the verdicts (run it through the script).
//!
//! `rust` is `{ "accept": bool }`, plus `"same": true` when the value written back equals the case's value or
//! `"out": <value>` when it differs. A type that is only read (no `Serialize`) has no write-back, so only `accept`.
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::path::PathBuf;

use novira_core::agent::AgentEndpointInput;
use novira_core::models::civitai::SearchParams;
use novira_core::types::*;

/// What serde did with one value: refused, or accepted (with the value written back when the type can be written).
struct Verdict {
    accept: bool,
    out: Option<Value>,
    error: Option<String>,
}

fn read_write<T: Serialize + DeserializeOwned>(v: &Value) -> Verdict {
    match novira_core::strict::from_value::<T>(v.clone()) {
        Ok(t) => Verdict {
            accept: true,
            out: Some(serde_json::to_value(&t).unwrap()),
            error: None,
        },
        Err(e) => Verdict {
            accept: false,
            out: None,
            error: Some(e.to_string()),
        },
    }
}

fn read_only<T: DeserializeOwned>(v: &Value) -> Verdict {
    match novira_core::strict::from_value::<T>(v.clone()) {
        Ok(_) => Verdict {
            accept: true,
            out: None,
            error: None,
        },
        Err(e) => Verdict {
            accept: false,
            out: None,
            error: Some(e.to_string()),
        },
    }
}

/// The corpus file name (the fixture) and how Rust reads that type. Every corpus file must be here.
type Reader = (&'static str, fn(&Value) -> Verdict);

const READERS: &[Reader] = &[
    ("generation-metadata", read_write::<GenerationMetadata>),
    ("enqueue-request", read_write::<EnqueueRequest>),
    ("queue-item", read_write::<QueueItem>),
    ("retry-size", read_write::<RetrySize>),
    ("progress-event", read_write::<ProgressEvent>),
    ("image-dto", read_write::<ImageDTO>),
    ("board-dto", read_write::<BoardDTO>),
    ("board-patch", read_write::<BoardPatch>),
    ("image-patch", read_write::<ImagePatch>),
    ("image-options", read_write::<ImageOptions>),
    ("model-config", read_write::<ModelConfig>),
    ("starter-model", read_write::<StarterModel>),
    ("model-parts-report", read_write::<ModelPartsReport>),
    ("model-install-job", read_write::<ModelInstallJob>),
    ("saved-workflow", read_write::<SavedWorkflow>),
    ("comic-record", read_write::<ComicRecord>),
    ("face-rig-preview-request", read_write::<FaceRigPreview>),
    ("engine-settings-patch", read_only::<EngineSettingsPatch>),
    ("agent-endpoint-input", read_only::<AgentEndpointInput>),
    ("civitai-search-params", read_only::<SearchParams>),
];

fn corpus_dir() -> PathBuf {
    match std::env::var("NOVIRA_CONTRACT_CORPUS_DIR") {
        Ok(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => crate::contract_dir().join("corpus"),
    }
}

/// The stored form of a verdict (see the header).
fn stored(verdict: &Verdict, value: &Value) -> Value {
    let mut rust = Map::new();
    rust.insert("accept".into(), json!(verdict.accept));
    if let Some(out) = &verdict.out {
        if out == value {
            rust.insert("same".into(), json!(true));
        } else {
            rust.insert("out".into(), out.clone());
        }
    }
    Value::Object(rust)
}

fn read_cases(name: &str) -> Vec<Value> {
    let path = corpus_dir().join(format!("{name}.jsonl"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    text.lines()
        .enumerate()
        .map(|(i, line)| {
            serde_json::from_str(line)
                .unwrap_or_else(|e| panic!("{name}.jsonl line {}: {e}", i + 1))
        })
        .collect()
}

// tags: decision-table
#[test]
fn every_corpus_file_has_a_reader() {
    let mut files: Vec<String> = std::fs::read_dir(corpus_dir())
        .unwrap()
        .filter_map(|e| {
            e.unwrap()
                .file_name()
                .into_string()
                .unwrap()
                .strip_suffix(".jsonl")
                .map(str::to_string)
        })
        .collect();
    let mut readers: Vec<String> = READERS.iter().map(|(n, _)| n.to_string()).collect();
    files.sort();
    readers.sort();
    assert_eq!(files, readers);
}

// tags: condition
#[test]
fn rust_verdicts_of_the_corpus_are_current() {
    let update = std::env::var("CONTRACT_CORPUS_UPDATE").as_deref() == Ok("1");
    let mut wrong = Vec::new();
    let (mut accepted, mut refused) = (0usize, 0usize);
    for (name, read) in READERS {
        let mut cases = read_cases(name);
        for case in &mut cases {
            let id = case["id"].as_str().unwrap_or("?").to_string();
            let value = case["value"].clone();
            let verdict = read(&value);
            if verdict.accept {
                accepted += 1;
            } else {
                refused += 1;
            }
            let now = stored(&verdict, &value);
            if update {
                case["rust"] = now;
            } else if case.get("rust") != Some(&now) {
                wrong.push(format!(
                    "{id}: stored {} but Rust now says {now} ({}); mutations {}",
                    case.get("rust").map_or("nothing".into(), |r| r.to_string()),
                    verdict.error.as_deref().unwrap_or("accepted"),
                    case["mutations"]
                ));
            }
        }
        if update {
            let text: String = cases.iter().map(|c| format!("{c}\n")).collect();
            std::fs::write(corpus_dir().join(format!("{name}.jsonl")), text).unwrap();
        }
    }
    assert!(
        wrong.is_empty(),
        "the corpus verdicts are stale (rerun contract/corpus/generate.mjs):\n{}",
        wrong.join("\n")
    );
    // Both outcomes must be present, or the corpus tests nothing on one side of the door.
    assert!(
        accepted > 0 && refused > 0,
        "accepted {accepted}, refused {refused}"
    );
    println!("corpus: {accepted} accepted, {refused} refused");
}

/// serde's derived `Deserialize` would read a JSON array as the fields of a struct in order (`[]` an empty patch,
/// `["pkg", 30, true]` a three-field one). Every entry point reads through `novira_core::strict`, which refuses it, at
/// the top and nested; the corpus readers above do the same, so Rust and `types.ts` agree on arrays.
// tags: error-guessing
#[test]
fn a_json_array_is_refused_where_the_type_is_a_struct() {
    for array in [json!([]), json!([1, 2, 3]), json!(["pkg", 30, true])] {
        assert!(!read_only::<EngineSettingsPatch>(&array).accept, "{array}");
        assert!(!read_write::<BoardPatch>(&array).accept, "{array}");
    }
    // Nested: the sample model with its `defaultSettings` struct replaced by an array.
    let mut model = crate::fixture("model-config");
    assert!(read_write::<ModelConfig>(&model).accept);
    assert!(
        model["defaultSettings"].is_object(),
        "the sample must hold the nested struct"
    );
    model["defaultSettings"] = json!([]);
    assert!(!read_write::<ModelConfig>(&model).accept);
    assert!(serde_json::from_value::<ModelConfig>(model).is_ok());
    // What serde alone does with the same values is the defect this guards against.
    assert!(serde_json::from_value::<EngineSettingsPatch>(json!([])).is_ok());
    // An object still reads, and an array is still read where the field is a list.
    assert!(read_only::<EngineSettingsPatch>(&json!({"comfyuiPackage": "pkg"})).accept);
    assert!(read_only::<EngineSettingsPatch>(&json!({})).accept);
}
