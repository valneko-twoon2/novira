//! Property tests for the wire types in `types.rs`: starting from each committed contract fixture (a value the
//! frontend really sends or receives), random edits (a field replaced by any JSON, removed, an unknown field added)
//! must either be refused or give a value that survives serialize -> deserialize unchanged. Fixtures stay the
//! reference for the exact shape (`tests/contract`); this finds values the fixtures do not show.
//! In process only. Run: `cargo test -p novira-core --test prop_roundtrip`.
mod prop_common;

use novira_core::types::*;
use prop_common::{any_text, check, json_value};
use proptest::prelude::*;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

static ACCEPTED: AtomicUsize = AtomicUsize::new(0);

fn fixture(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../contract")
        .join(format!("{name}.json"));
    serde_json::from_str(
        &std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display())),
    )
    .unwrap()
}

/// The value as the type writes it (`None` when the type refuses it).
fn normalised<T: Serialize + DeserializeOwned>(v: &Value) -> Option<Value> {
    serde_json::from_value::<T>(v.clone())
        .ok()
        .map(|t| serde_json::to_value(t).unwrap())
}

type Normalise = fn(&Value) -> Option<Value>;

/// Fixture name and the type it is a value of (types that cross in both directions).
const TYPES: &[(&str, Normalise)] = &[
    ("generation-metadata", normalised::<GenerationMetadata>),
    ("enqueue-request", normalised::<EnqueueRequest>),
    ("queue-item", normalised::<QueueItem>),
    ("progress-event", normalised::<ProgressEvent>),
    ("image-dto", normalised::<ImageDTO>),
    ("board-dto", normalised::<BoardDTO>),
    ("board-patch", normalised::<BoardPatch>),
    ("image-patch", normalised::<ImagePatch>),
    ("image-options", normalised::<ImageOptions>),
    ("model-config", normalised::<ModelConfig>),
    ("model-install-job", normalised::<ModelInstallJob>),
    ("saved-workflow", normalised::<SavedWorkflow>),
    ("workflow-input", normalised::<WorkflowInput>),
    ("retry-size", normalised::<RetrySize>),
];

#[derive(Debug, Clone)]
enum Edit {
    Replace(prop::sample::Index, Value),
    Remove(prop::sample::Index),
    AddField(prop::sample::Index, String, Value),
}

fn edits() -> impl Strategy<Value = Vec<Edit>> {
    prop::collection::vec(
        prop_oneof![
            (any::<prop::sample::Index>(), json_value()).prop_map(|(i, v)| Edit::Replace(i, v)),
            any::<prop::sample::Index>().prop_map(Edit::Remove),
            (any::<prop::sample::Index>(), "[a-zA-Z]{1,8}", json_value())
                .prop_map(|(i, k, v)| Edit::AddField(i, k, v)),
        ],
        1..5,
    )
}

/// Every place in the value (as a path of keys and positions), the root first.
fn places(v: &Value, here: &mut Vec<String>, out: &mut Vec<Vec<String>>) {
    out.push(here.clone());
    match v {
        Value::Object(m) => {
            for (k, x) in m {
                here.push(k.clone());
                places(x, here, out);
                here.pop();
            }
        }
        Value::Array(a) => {
            for (i, x) in a.iter().enumerate() {
                here.push(i.to_string());
                places(x, here, out);
                here.pop();
            }
        }
        _ => {}
    }
}

fn at<'a>(v: &'a mut Value, path: &[String]) -> &'a mut Value {
    path.iter().fold(v, |v, key| match v {
        Value::Object(m) => m.get_mut(key).unwrap(),
        Value::Array(a) => &mut a[key.parse::<usize>().unwrap()],
        _ => unreachable!(),
    })
}

fn apply(mut v: Value, edits: &[Edit]) -> Value {
    for edit in edits {
        let mut all = Vec::new();
        places(&v, &mut Vec::new(), &mut all);
        match edit {
            Edit::Replace(i, new) => {
                let path = &all[i.index(all.len())];
                *at(&mut v, path) = new.clone();
            }
            Edit::Remove(i) => {
                let path = &all[i.index(all.len())];
                if let Some((last, parent)) = path.split_last() {
                    match at(&mut v, parent) {
                        Value::Object(m) => {
                            m.remove(last);
                        }
                        Value::Array(a) => {
                            a.remove(last.parse::<usize>().unwrap());
                        }
                        _ => {}
                    }
                }
            }
            Edit::AddField(i, key, new) => {
                let path = &all[i.index(all.len())];
                if let Value::Object(m) = at(&mut v, path) {
                    m.insert(key.clone(), new.clone());
                }
            }
        }
    }
    v
}

#[test]
fn every_contract_fixture_survives_a_round_trip_unchanged() {
    for (name, normalise) in TYPES {
        let sample = fixture(name);
        assert_eq!(normalise(&sample).as_ref(), Some(&sample), "{name}");
    }
}

#[test]
fn an_edited_fixture_is_refused_or_settles_after_one_round_trip() {
    ACCEPTED.store(0, Ordering::Relaxed);
    let samples: Vec<(&str, Value)> = TYPES.iter().map(|(n, _)| (*n, fixture(n))).collect();
    check((0..TYPES.len(), edits()), |(which, edits)| {
        let (name, normalise) = TYPES[which];
        let edited = apply(samples[which].1.clone(), &edits);
        if let Some(once) = normalise(&edited) {
            ACCEPTED.fetch_add(1, Ordering::Relaxed);
            let twice = normalise(&once);
            prop_assert_eq!(
                twice.as_ref(),
                Some(&once),
                "{} did not settle for {}",
                name,
                edited
            );
        }
        Ok(())
    });
    assert!(
        ACCEPTED.load(Ordering::Relaxed) * 10 >= prop_common::cases() as usize,
        "too few edited values were accepted to mean anything"
    );
}

#[test]
fn unknown_fields_of_the_generation_settings_are_kept_for_newer_frontends() {
    let base = fixture("generation-metadata");
    check(
        prop::collection::vec(("x[a-z]{1,8}", json_value()), 1..4),
        |fields| {
            let mut v = base.clone();
            for (k, x) in &fields {
                v[k] = x.clone();
            }
            let meta: GenerationMetadata = serde_json::from_value(v.clone()).unwrap();
            let back = serde_json::to_value(&meta).unwrap();
            for (k, x) in &fields {
                prop_assert_eq!(&back[k], &v[k], "{} was lost or changed", k);
                let _ = x;
            }
            Ok(())
        },
    );
}

#[test]
fn a_generation_setting_of_any_prompt_text_and_numbers_round_trips() {
    let base = fixture("generation-metadata");
    let number = prop_oneof![
        any::<u32>().prop_map(|n| json!(n)),
        (-1e9f64..1e9).prop_map(|f| json!(f))
    ];
    check(
        (any_text(), any_text(), any::<u64>(), number.clone(), number),
        |(positive, negative, seed, a, b)| {
            let mut v = base.clone();
            v["positivePrompt"] = json!(positive);
            v["negativePrompt"] = json!(negative);
            v["seed"] = json!(seed);
            v["cfgScale"] = json!(a.as_f64().unwrap());
            v["cfgRescale"] = json!(b.as_f64().unwrap());
            let meta: GenerationMetadata = serde_json::from_value(v.clone()).unwrap();
            prop_assert_eq!(meta.seed, seed);
            prop_assert_eq!(&meta.positive_prompt, &positive);
            let back: GenerationMetadata =
                serde_json::from_value(serde_json::to_value(&meta).unwrap()).unwrap();
            prop_assert_eq!(back, meta);
            Ok(())
        },
    );
}

#[test]
fn enums_and_guidance_of_any_value_are_read_or_refused_without_a_panic() {
    check(json_value(), |v| {
        let _ = serde_json::from_value::<GenerationMode>(v.clone());
        let _ = serde_json::from_value::<ModelType>(v.clone());
        let _ = serde_json::from_value::<QueueItemStatus>(v.clone());
        let _ = serde_json::from_value::<Guidance>(v.clone());
        let _ = serde_json::from_value::<ComfyGraph>(v.clone());
        let _ = serde_json::from_value::<LogEntry>(v);
        Ok(())
    });
}
