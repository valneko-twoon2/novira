//! Shared pieces of the property tests (`prop_*.rs`): a runner with a fixed seed and a bounded case count, and
//! strategies for hostile strings, bytes and JSON. Everything runs in process; nothing here touches a network.
//!
//! Seed policy: every run starts from the same seed, so a failure reproduces on any machine. `PROPTEST_SEED=<n>`
//! explores other cases; `PROPTEST_CASES=<n>` changes the case count (default 256). A minimal failing input found
//! that way is pinned as a plain `#[test]` with the input written out, not kept as a regression file.
#![allow(dead_code)]

use proptest::prelude::*;
use proptest::strategy::Strategy;
use proptest::test_runner::{Config, RngAlgorithm, TestCaseError, TestRng, TestRunner};
use serde_json::{json, Map, Number, Value};

pub const DEFAULT_SEED: u64 = 0x4E6F_7669_7261_0001;

fn env_number(name: &str) -> Option<u64> {
    std::env::var(name).ok()?.trim().parse().ok()
}

/// The case count: `PROPTEST_CASES` or 256, never more than 4096 so a test stays within a few seconds.
pub fn cases() -> u32 {
    env_number("PROPTEST_CASES").map_or(256, |n| n.clamp(1, 4096) as u32)
}

fn rng() -> TestRng {
    let seed = env_number("PROPTEST_SEED").unwrap_or(DEFAULT_SEED);
    let mut bytes = [0u8; 32];
    for (i, chunk) in bytes.chunks_mut(8).enumerate() {
        chunk.copy_from_slice(&seed.wrapping_add(i as u64).to_le_bytes());
    }
    TestRng::from_seed(RngAlgorithm::ChaCha, &bytes)
}

/// Runs `test` on `cases()` generated values (a panic inside it counts as a failure and is shrunk like any other).
pub fn check<S: Strategy>(strategy: S, test: impl Fn(S::Value) -> Result<(), TestCaseError>)
where
    S::Value: std::fmt::Debug,
{
    check_up_to(u32::MAX, strategy, test)
}

/// Like `check`, for a test whose cases are slow (file system, system key store): at most `limit` cases.
pub fn check_up_to<S: Strategy>(
    limit: u32,
    strategy: S,
    test: impl Fn(S::Value) -> Result<(), TestCaseError>,
) where
    S::Value: std::fmt::Debug,
{
    let config = Config {
        cases: cases().min(limit),
        max_shrink_iters: 4000,
        failure_persistence: None,
        ..Config::default()
    };
    let mut runner = TestRunner::new_with_rng(config, rng());
    if let Err(e) = runner.run(&strategy, test) {
        panic!("{e}");
    }
}

/// Words that tend to matter to path, URL and JSON handling.
const TOKENS: &[&str] = &[
    "..",
    ".",
    "/",
    "\\",
    "//",
    ":",
    "%2e%2e",
    "%2f",
    "%5c",
    "%252e",
    "\\\\?\\",
    "\\\\server\\share",
    "C:",
    "c:\\",
    "~",
    "*",
    "?",
    "\"",
    "<",
    ">",
    "|",
    "\0",
    "\n",
    "\r\n",
    "\t",
    " ",
    "CON",
    "nul",
    "COM1",
    "aux",
    "LPT9",
    ".png",
    ".mp4",
    ".wav",
    ".safetensors",
    ".ckpt",
    ".gguf",
    ".zip",
    "civitai.com",
    "huggingface.co",
    "github.com",
    "https://",
    "http://",
    "civitai:",
    "::",
    "-",
    "_",
    "a",
    "Z",
    "0",
    "é",
    "日本",
    "\u{202e}",
    "\u{feff}",
    "{",
    "}",
    "[",
    "]",
    "null",
];

/// Strings built from hostile tokens and ordinary letters.
pub fn nasty_string() -> impl Strategy<Value = String> {
    prop::collection::vec(
        prop_oneof![
            4 => prop::sample::select(TOKENS).prop_map(str::to_string),
            1 => "[a-zA-Z0-9]{0,6}",
            1 => any::<char>().prop_map(String::from),
        ],
        0..10,
    )
    .prop_map(|parts| parts.concat())
}

const ENDINGS: &[&str] = &[".png", ".mp4", ".wav", ".safetensors", ".gguf", ".zip"];

/// Any string, a hostile-token string, or one with a valid-looking ending.
pub fn any_text() -> impl Strategy<Value = String> {
    prop_oneof![
        3 => nasty_string(),
        1 => any::<String>(),
        1 => (nasty_string(), prop::sample::select(ENDINGS)).prop_map(|(a, b)| format!("{a}{b}")),
    ]
}

/// Arbitrary bytes, up to `max` of them.
pub fn bytes(max: usize) -> impl Strategy<Value = Vec<u8>> {
    prop::collection::vec(any::<u8>(), 0..max)
}

const KEYS: &[&str] = &[
    "nodes",
    "edges",
    "text",
    "actions",
    "type",
    "id",
    "key",
    "name",
    "items",
    "files",
    "images",
    "outputs",
    "inputs",
    "class_type",
    "prompt",
    "model",
    "base",
    "version",
    "versions",
    "siblings",
    "rfilename",
    "tags",
    "description",
    "title",
    "widget",
    "modelVersions",
    "metadata",
    "__metadata__",
    "ops",
    "op",
    "graph",
    "fields",
    "weight",
    "patch",
    "steps",
    "width",
    "height",
    "seed",
    "ids",
    "data",
    "node",
    "value",
    "max",
    "format",
    "downloadUrl",
    "sizeKB",
    "primary",
    "trainedWords",
    "allowCommercialUse",
    "nsfwLevel",
    "url",
    "error",
    "message",
    "details",
    "node_errors",
    "install",
    "path",
    "size",
    "status",
    "status_str",
    "messages",
];

fn json_leaf() -> impl Strategy<Value = Value> {
    prop_oneof![
        Just(Value::Null),
        any::<bool>().prop_map(Value::Bool),
        any::<i64>().prop_map(|n| json!(n)),
        any::<u64>().prop_map(|n| json!(n)),
        prop::num::f64::NORMAL.prop_map(|f| Value::Number(Number::from_f64(f).unwrap())),
        prop::sample::select(&[0.0f64, 1.0, -1.0, 0.5, 1e300, 1e-300][..])
            .prop_map(|f| Value::Number(Number::from_f64(f).unwrap())),
        any_text().prop_map(Value::String),
    ]
}

/// Arbitrary JSON, with object keys drawn from the names the backend reads so that deeper code is reached.
pub fn json_value() -> impl Strategy<Value = Value> {
    json_leaf().prop_recursive(4, 64, 6, |inner| {
        let key = prop_oneof![3 => prop::sample::select(KEYS).prop_map(str::to_string), 1 => "[a-z]{0,5}"];
        prop_oneof![
            prop::collection::vec(inner.clone(), 0..6).prop_map(Value::Array),
            prop::collection::vec((key, inner), 0..6)
                .prop_map(|kv| Value::Object(kv.into_iter().collect::<Map<_, _>>())),
        ]
    })
}

/// A JSON object (what most parsers expect at the top).
pub fn json_object() -> impl Strategy<Value = Value> {
    json_value().prop_map(|v| match v {
        Value::Object(_) => v,
        other => json!({ "value": other }),
    })
}
