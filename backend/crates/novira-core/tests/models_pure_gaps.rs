//! Small decisions of the model helpers that the broader tests do not reach: an architecture name nobody knows, and a
//! word hidden in a camel-case name.
use novira_core::models::classify::{detect_base, parse_header};
use novira_core::models::content_filter::looks_adult;
use novira_core::types::{BaseModel, ModelType};
use serde_json::json;

#[test]
fn an_unknown_architecture_in_the_metadata_falls_through_to_the_training_version() {
    let bytes = serde_json::to_vec(&json!({
        "__metadata__": {
            "modelspec.architecture": "something-new/lora",
            "ss_base_model_version": "sdxl_base_v1-0"
        },
        "lora_te2_a.lora_up.weight": { "dtype": "F16", "shape": [1], "data_offsets": [0, 2] }
    }))
    .unwrap();
    let header = parse_header(&bytes).unwrap();
    assert_eq!(
        detect_base(ModelType::Lora, Some(&header), "style.safetensors"),
        BaseModel::Sdxl
    );
}

#[test]
fn a_word_inside_a_camel_case_name_is_found() {
    let none: Vec<String> = Vec::new();
    assert!(looks_adult(
        "owner/plain-model",
        &none,
        &json!({"description": "A soft LookNude portrait style"})
    ));
    assert!(!looks_adult(
        "owner/plain-model",
        &none,
        &json!({"description": "A soft LookGood portrait style"})
    ));
}
