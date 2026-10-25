//! Contract tests between the Rust wire types and `frontend/src/backend/types.ts`.
//!
//! Each JSON file in `contract/` (repository root) is a value of one wire type, written from a TypeScript sample that
//! must satisfy the TS type (`frontend/src/backend/contract.test.ts`). Here every fixture is checked against the Rust
//! type, so a field or enum value renamed, added or removed on one side only fails one of the two test suites.
//!
//! How each kind of type is checked:
//! - `Serialize + Deserialize` (`both.rs`): deserialize the fixture, serialize it again and require the same JSON. A
//!   field Rust does not know is dropped on the way and fails the comparison.
//! - `Serialize` only, sent to the frontend (`outbound.rs`): rebuild the value with an exhaustive struct literal from
//!   the fixture's fields, serialize it and compare with the whole fixture. A field added in Rust fails to compile.
//! - `Deserialize` only, received from the frontend (`inbound.rs`): destructure the value exhaustively, write it back
//!   with the wire names and compare with the fixture. A field added in Rust fails to compile.
//! - Enums and tagged enums (`enums.rs`, `outbound.rs`): an exhaustive `match` names every Rust variant, so a new
//!   variant fails to compile until it is listed (and added to the TS sample and the fixture).
//!
//! Explicit exceptions:
//! - `GenerationMetadata` keeps unknown fields in `extra` (`#[serde(flatten)]`) so newer frontends round-trip; a round
//!   trip alone would hide a renamed field, so `extra` must be empty for the fixtures (`metadata`).
//! - `ModelConfig.comfy` is backend-only addressing the frontend ignores; it is in neither `types.ts` nor the fixture.
//! - Fields Rust keeps as `String` or `Value` where TS has a union or a structure (`scheduler`, `category`, `site`,
//!   `commercial`, `AgentToolCall.args`, ...) are checked for presence and casing only; TS checks the literals.
//! - `pack_status` and the Face Rig / `node_defs` replies (ComfyUI's JSON passed through as `Value`) have no fixture.
//! - f64 fields use non-integer values in the fixtures: serde writes `7.0`, and serde_json compares it unequal to `7`.
mod both;
mod enums;
mod family_sampling;
mod inbound;
mod outbound;
mod share_backup;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;

/// Every fixture and the check that runs on it. A fixture file missing here fails `every_fixture_is_checked`.
/// A fixture's file name (without `.json`) and its check.
type Check = (&'static str, fn(&Value));

const CHECKS: &[Check] = &[
    ("enums", enums::enums),
    ("family-sampling", family_sampling::family_sampling),
    ("generation-metadata", both::generation_metadata),
    ("enqueue-request", both::enqueue_request),
    ("queue-item", both::queue_item),
    ("progress-event", both::progress_event),
    ("retry-size", both::retry_size),
    ("image-dto", both::image_dto),
    ("board-dto", both::board_dto),
    ("board-patch", both::board_patch),
    ("image-patch", both::image_patch),
    ("image-options", both::image_options),
    ("model-config", both::model_config),
    ("starter-model", both::starter_model),
    ("model-parts-report", both::model_parts_report),
    ("model-install-job", both::model_install_job),
    ("saved-workflow", both::saved_workflow),
    ("workflow-input", both::workflow_input),
    ("comic-record", both::comic_record),
    ("face-rig-preview-request", both::face_rig_preview_request),
    ("queue-snapshot", outbound::queue_snapshot),
    ("scanned-file", outbound::scanned_file),
    ("civitai-search-result", outbound::civitai_search_result),
    ("node-packs", outbound::node_packs),
    ("comfy-ui-locale", outbound::comfy_ui_locale),
    ("engine-status", outbound::engine_status),
    ("low-memory-mode", outbound::low_memory_mode),
    ("engine-settings", outbound::engine_settings),
    ("engine-settings-patch", inbound::engine_settings_patch),
    ("pack-status", outbound::pack_status),
    ("hardware-info", outbound::hardware_info),
    ("bootstrap", outbound::bootstrap),
    ("backend-events", outbound::backend_events),
    ("agent-status", outbound::agent_status),
    ("agent-reply", outbound::agent_reply),
    ("agent-endpoint-test", outbound::agent_endpoint_test),
    ("agent-endpoint-input", inbound::agent_endpoint_input),
    ("civitai-search-params", inbound::civitai_search_params),
    ("agent-request", inbound::agent_request),
    ("agent-tool-answer", inbound::agent_tool_answer),
    ("export-options", share_backup::export_options),
    ("export-result", share_backup::export_result),
    ("backup-info", share_backup::backup_info),
    ("backup-summary", share_backup::backup_summary),
    ("restore-outcome", share_backup::restore_outcome),
    ("share-enums", share_backup::share_enums),
    ("watermark-status", share_backup::watermark_status),
    ("watermark-check", share_backup::watermark_check),
    ("unfinished-download", outbound::unfinished_download),
];

fn contract_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../contract")
}

fn fixture(name: &str) -> Value {
    let path = contract_dir().join(format!("{name}.json"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{name}.json: {e}"))
}

/// The field `key` of `v` as `T`. The field must be present: an absent `Option` would otherwise read as `None`.
pub fn get<T: DeserializeOwned>(v: &Value, key: &str) -> T {
    let field = v
        .get(key)
        .unwrap_or_else(|| panic!("`{key}` is missing from {v}"));
    serde_json::from_value(field.clone()).unwrap_or_else(|e| panic!("`{key}`: {e}"))
}

pub fn parse<T: DeserializeOwned>(v: &Value) -> T {
    serde_json::from_value(v.clone()).unwrap_or_else(|e| panic!("{e} in {v}"))
}

/// Requires `value` to serialize to exactly `expected`.
pub fn assert_wire<T: Serialize>(value: &T, expected: &Value, what: &str) {
    assert_eq!(&serde_json::to_value(value).unwrap(), expected, "{what}");
}

/// Deserializes `v` and requires it to serialize back to the same JSON.
pub fn round_trip<T: Serialize + DeserializeOwned>(v: &Value, what: &str) -> T {
    let value: T = parse(v);
    assert_wire(&value, v, what);
    value
}

/// The keys of a tagged-enum fixture, sorted.
pub fn keys(v: &Value) -> Vec<String> {
    let mut keys: Vec<String> = v.as_object().expect("an object").keys().cloned().collect();
    keys.sort();
    keys
}

#[test]
fn every_fixture_is_checked() {
    let mut files: Vec<String> = std::fs::read_dir(contract_dir())
        .unwrap()
        .filter_map(|e| {
            let name = e.unwrap().file_name().into_string().unwrap();
            name.strip_suffix(".json").map(str::to_string)
        })
        .collect();
    let mut checked: Vec<String> = CHECKS.iter().map(|(n, _)| n.to_string()).collect();
    files.sort();
    checked.sort();
    assert_eq!(files, checked);
}

#[test]
fn fixtures_match_the_rust_types() {
    let failed: Vec<&str> = CHECKS
        .iter()
        .filter(|(name, check)| {
            let v = fixture(name);
            std::panic::catch_unwind(|| check(&v)).is_err()
        })
        .map(|(name, _)| *name)
        .collect();
    assert!(
        failed.is_empty(),
        "fixtures that do not match (details above): {failed:?}"
    );
}
