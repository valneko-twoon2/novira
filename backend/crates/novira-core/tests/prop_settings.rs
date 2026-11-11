//! Property tests for `settings.json`: loading a valid or partly filled document, writing keys back one by one and
//! loading again changes nothing; keys this version does not know stay in the file; a damaged document never panics
//! and never leaves a half-written file. The settings file has no whole-document save: `Settings::save_key` rewrites
//! one key and keeps the rest, so "save" below means saving every key of the loaded value in turn.
//! Run: `cargo test -p novira-core --test prop_settings`.
mod prop_common;

use novira_core::settings::{check_package, check_start_timeout, Settings, SETTINGS_FILE};
use prop_common::{any_text, check, check_up_to, json_value, nasty_string};
use proptest::prelude::*;
use serde_json::{json, Map, Value};

/// Keys of the current `Settings` type (camelCase on disk).
const KNOWN: &[&str] = &[
    "comfyuiUrl",
    "comfyuiDir",
    "comfyuiPackage",
    "comfyuiInstallDir",
    "comfyuiPython",
    "comfyuiArgs",
    "modelRoots",
    "gpuLock",
    "civitaiApiKey",
    "civitaiLookup",
    "comfyuiStartTimeoutSecs",
    "lowMemoryMode",
];

/// JSON without fractions: serde_json reads a printed float back one ulp off, which says nothing about settings.
fn tame(value: Value) -> Value {
    match value {
        Value::Number(n) if n.is_f64() => json!(n.as_f64().unwrap_or(0.0) as i64),
        Value::Array(v) => Value::Array(v.into_iter().map(tame).collect()),
        Value::Object(m) => Value::Object(m.into_iter().map(|(k, v)| (k, tame(v))).collect()),
        other => other,
    }
}

fn plain_json() -> impl Strategy<Value = Value> {
    json_value().prop_map(tame)
}

fn opt_text() -> impl Strategy<Value = Value> {
    prop_oneof![Just(Value::Null), any_text().prop_map(Value::String)]
}

/// One value of the right type for each known key, inside the valid grammar.
fn known_value(key: &'static str) -> BoxedStrategy<Value> {
    match key {
        "comfyuiPackage" | "gpuLock" => any_text().prop_map(Value::String).boxed(),
        "comfyuiArgs" | "modelRoots" => prop::collection::vec(any_text(), 0..5)
            .prop_map(|v| json!(v))
            .boxed(),
        "civitaiLookup" | "lowMemoryMode" => any::<bool>().prop_map(Value::Bool).boxed(),
        "comfyuiStartTimeoutSecs" => any::<u64>().prop_map(|n| json!(n)).boxed(),
        _ => opt_text().boxed(),
    }
}

/// A partly filled settings document: any subset of the known keys with valid types, plus keys this version does not
/// know with any JSON value.
fn document() -> impl Strategy<Value = Value> {
    let known = KNOWN
        .iter()
        .map(|k| prop::option::of(known_value(k)).prop_map(move |v| (*k, v)))
        .collect::<Vec<_>>();
    let unknown = prop::collection::vec(("x[a-z]{1,6}", plain_json()), 0..4);
    (known, unknown).prop_map(|(known, unknown)| {
        let mut map = Map::new();
        for (key, value) in known {
            if let Some(value) = value {
                map.insert(key.to_string(), value);
            }
        }
        for (key, value) in unknown {
            map.insert(key, value);
        }
        Value::Object(map)
    })
}

fn put(dir: &std::path::Path, doc: &Value) {
    std::fs::write(dir.join(SETTINGS_FILE), doc.to_string()).unwrap();
}

fn on_disk(dir: &std::path::Path) -> Value {
    serde_json::from_slice(&std::fs::read(dir.join(SETTINGS_FILE)).unwrap()).unwrap()
}

fn save_all(dir: &std::path::Path, s: &Settings) {
    let Value::Object(map) = serde_json::to_value(s).unwrap() else {
        panic!("settings are not an object")
    };
    for (key, value) in map {
        Settings::save_key(dir, &key, value).unwrap();
    }
}

// tags: decision-table
#[test]
fn loading_then_saving_every_key_and_loading_again_gives_the_same_settings() {
    check_up_to(64, document(), |doc| {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), &doc);
        let first = Settings::load(dir.path()).unwrap();
        save_all(dir.path(), &first);
        let second = Settings::load(dir.path()).unwrap();
        prop_assert_eq!(&second, &first);
        // A second round of saving changes the file no further.
        let after_one = on_disk(dir.path());
        save_all(dir.path(), &second);
        prop_assert_eq!(on_disk(dir.path()), after_one);
        Ok(())
    });
}

// tags: state-transition
#[test]
fn keys_this_version_does_not_know_survive_saving() {
    check_up_to(64, document(), |doc| {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), &doc);
        let loaded = Settings::load(dir.path()).unwrap();
        save_all(dir.path(), &loaded);
        let saved = on_disk(dir.path());
        for (key, value) in doc.as_object().unwrap() {
            if !KNOWN.contains(&key.as_str()) {
                prop_assert_eq!(saved.get(key), Some(value), "unknown key {:?} changed", key);
            }
        }
        Ok(())
    });
}

// tags: error-guessing, decision-table
#[test]
fn a_missing_key_takes_its_default_and_saving_one_key_leaves_the_others_as_loaded() {
    check_up_to(
        64,
        (document(), prop::sample::select(KNOWN)),
        |(doc, key)| {
            let dir = tempfile::tempdir().unwrap();
            put(dir.path(), &doc);
            let before = Settings::load(dir.path()).unwrap();
            let before_json = serde_json::to_value(&before).unwrap();
            if doc.get(key).is_none() {
                let defaults = serde_json::to_value(Settings::default()).unwrap();
                prop_assert_eq!(&before_json[key], &defaults[key]);
            }
            // Saving the key's own value back changes no field.
            Settings::save_key(dir.path(), key, before_json[key].clone()).unwrap();
            let after = serde_json::to_value(Settings::load(dir.path()).unwrap()).unwrap();
            prop_assert_eq!(after, before_json);
            Ok(())
        },
    );
}

// tags: equivalence
#[test]
fn a_saved_value_of_the_right_type_is_what_loads_next() {
    check_up_to(
        64,
        prop::sample::select(KNOWN).prop_flat_map(|k| known_value(k).prop_map(move |v| (k, v))),
        |(key, value)| {
            let dir = tempfile::tempdir().unwrap();
            Settings::save_key(dir.path(), key, value.clone()).unwrap();
            let loaded = serde_json::to_value(Settings::load(dir.path()).unwrap()).unwrap();
            prop_assert_eq!(&loaded[key], &value);
            let defaults = serde_json::to_value(Settings::default()).unwrap();
            for other in KNOWN.iter().filter(|k| **k != key) {
                prop_assert_eq!(&loaded[*other], &defaults[*other]);
            }
            Ok(())
        },
    );
}

// tags: boundary, decision-table
#[test]
fn the_start_timeout_and_package_checks_accept_exactly_their_range() {
    check(
        prop_oneof![
            any::<u64>(),
            0u64..2000,
            prop::sample::select(&[29u64, 30, 31, 1799, 1800, 1801, u64::MAX][..])
        ],
        |secs| {
            prop_assert_eq!(
                check_start_timeout(secs).is_ok(),
                (30..=1800).contains(&secs)
            );
            Ok(())
        },
    );
    check(prop_oneof![nasty_string(), any::<String>()], |name| {
        prop_assert_eq!(
            check_package(&name).is_ok(),
            name == "nvidia" || name == "amd",
            "{:?}",
            name
        );
        Ok(())
    });
}

// tags: boundary
#[test]
fn an_out_of_range_start_timeout_in_the_file_is_kept_as_written_not_clamped() {
    // Behaviour as coded: loading does not clamp; the range is enforced where the app saves the value.
    for secs in [0u64, 1, 29, 1801, u64::MAX] {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), &json!({ "comfyuiStartTimeoutSecs": secs }));
        assert_eq!(
            Settings::load(dir.path())
                .unwrap()
                .comfyui_start_timeout_secs,
            secs
        );
    }
}

// tags: error-guessing
#[test]
fn a_document_with_swapped_types_is_an_error_or_loads_and_never_panics() {
    check_up_to(64, json_value(), |doc| {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), &doc);
        let _ = Settings::load(dir.path());
        Ok(())
    });
    // Known keys holding values of the wrong type, written out.
    for bad in [
        json!({ "comfyuiArgs": "--fast" }),
        json!({ "comfyuiStartTimeoutSecs": -1 }),
        json!({ "comfyuiStartTimeoutSecs": 1.5 }),
        json!({ "lowMemoryMode": "yes" }),
        json!({ "modelRoots": [1] }),
        json!([1]),
        json!("text"),
    ] {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), &bad);
        assert!(Settings::load(dir.path()).is_err(), "{bad}");
    }
    // An array is refused whatever it holds: serde alone would read `[]` as all defaults and `[null]` as a first field
    // (`novira_core::strict`); nothing in the app writes one.
    for array in [json!([]), json!([null]), json!([1, 2, 3])] {
        let dir = tempfile::tempdir().unwrap();
        put(dir.path(), &array);
        let error = Settings::load(dir.path()).unwrap_err();
        assert!(error.contains("sequence"), "{array}: {error}");
    }
    let dir = tempfile::tempdir().unwrap();
    put(dir.path(), &Value::Null);
    assert!(Settings::load(dir.path()).is_err());
}

// tags: decision-table
#[test]
fn saving_a_key_into_any_document_either_writes_a_whole_object_or_leaves_the_file_alone() {
    check_up_to(
        64,
        (
            prop_oneof![document(), plain_json()],
            prop_oneof![
                prop::sample::select(KNOWN).prop_map(str::to_string),
                nasty_string(),
                Just(String::new())
            ],
            plain_json(),
        ),
        |(doc, key, value)| {
            let dir = tempfile::tempdir().unwrap();
            let text = doc.to_string();
            std::fs::write(dir.path().join(SETTINGS_FILE), &text).unwrap();
            let result = Settings::save_key(dir.path(), &key, value.clone());
            let now = std::fs::read_to_string(dir.path().join(SETTINGS_FILE)).unwrap();
            match result {
                Ok(()) => {
                    let saved: Value = serde_json::from_str(&now).expect("a whole JSON file");
                    prop_assert_eq!(saved.get(&key), Some(&value));
                    prop_assert!(doc.is_object());
                    for (k, v) in doc.as_object().unwrap() {
                        if *k != key {
                            prop_assert_eq!(saved.get(k), Some(v));
                        }
                    }
                }
                Err(_) => prop_assert_eq!(now, text, "a refused save changed the file"),
            }
            prop_assert!(
                !dir.path().join(format!("{SETTINGS_FILE}.tmp")).exists(),
                "the sibling was left behind"
            );
            let _ = Settings::load(dir.path());
            Ok(())
        },
    );
}

// tags: error-guessing, boundary
#[test]
fn huge_and_odd_strings_are_stored_whole_and_read_back() {
    let dir = tempfile::tempdir().unwrap();
    let huge = "あ\u{202e}\0\n".repeat(200_000);
    Settings::save_key(dir.path(), "gpuLock", json!(huge)).unwrap();
    assert_eq!(Settings::load(dir.path()).unwrap().gpu_lock, huge);
    assert!(!dir.path().join("settings.json.tmp").exists());
}

// tags: error-guessing
#[test]
fn bytes_that_are_not_text_are_an_error_and_are_left_alone() {
    let dir = tempfile::tempdir().unwrap();
    let bytes = [0xffu8, 0xfe, 0x00, 0x7b];
    std::fs::write(dir.path().join(SETTINGS_FILE), bytes).unwrap();
    assert!(Settings::load(dir.path()).is_err());
    assert!(Settings::save_key(dir.path(), "lowMemoryMode", json!(true)).is_err());
    assert_eq!(
        std::fs::read(dir.path().join(SETTINGS_FILE)).unwrap(),
        bytes
    );
}
