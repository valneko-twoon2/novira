//! Small decisions of the model helpers that the larger tests leave out: a folder scanned twice, base models named only
//! in a LoRA's training metadata, adult words in camelCase names and picture captions, and `.gitmodules` lines of other
//! keys.
use novira_core::comfy::node_packs::parse_gitmodules;
use novira_core::models::classify::{detect_base, parse_header};
use novira_core::models::content_filter::looks_adult;
use novira_core::models::layout::scan_roots;
use novira_core::types::{BaseModel, ModelType};
use serde_json::json;

#[test]
fn a_model_in_two_scanned_folders_is_listed_once_from_the_first() {
    let first = tempfile::tempdir().unwrap();
    let second = tempfile::tempdir().unwrap();
    for root in [&first, &second] {
        std::fs::create_dir_all(root.path().join("loras")).unwrap();
        std::fs::write(root.path().join("loras").join("same.safetensors"), b"x").unwrap();
    }
    let found = scan_roots(&[first.path().to_path_buf(), second.path().to_path_buf()]);
    let same: Vec<_> = found
        .iter()
        .filter(|m| m.comfy_name == "same.safetensors")
        .collect();
    assert_eq!(same.len(), 1);
    assert!(same[0].path.starts_with(first.path()));
}

fn lora_header(base: &str) -> novira_core::models::classify::Header {
    let bytes = serde_json::to_vec(&json!({
        "__metadata__": { "ss_base_model_version": base },
        "lora_te2_a.lora_up.weight": { "dtype": "F16", "shape": [1], "data_offsets": [0, 2] }
    }))
    .unwrap();
    parse_header(&bytes).unwrap()
}

#[test]
fn a_loras_training_metadata_names_its_base_model_and_an_unknown_one_falls_back_to_the_file_name() {
    for (version, expected) in [
        ("sdxl_base_v1-0", BaseModel::Sdxl),
        ("sd_v1", BaseModel::Sd1),
        ("sd_v2", BaseModel::Sd2),
        ("flux1-dev", BaseModel::Flux),
    ] {
        assert_eq!(
            detect_base(
                ModelType::Lora,
                Some(&lora_header(version)),
                "x.safetensors"
            ),
            expected,
            "{version}"
        );
    }
    // Nothing recognizable: the answer comes from the name, so only check that it is given.
    let _ = detect_base(
        ModelType::Lora,
        Some(&lora_header("something else")),
        "x.safetensors",
    );
}

#[test]
fn adult_words_are_found_in_camel_case_names_and_in_picture_captions() {
    assert!(looks_adult("NudeXL", &[], &json!({})));
    assert!(looks_adult(
        "plain-model",
        &[],
        &json!({ "widget": ["a nude figure"] })
    ));
    assert!(!looks_adult(
        "plain-model",
        &[],
        &json!({ "widget": ["a red apple"] })
    ));
}

#[test]
fn gitmodules_lines_of_other_keys_are_ignored() {
    let text =
        "[submodule \"a\"]\n\tpath = libs/a\n\tbranch = main\n\turl = https://example.com/a.git\n";
    assert_eq!(
        parse_gitmodules(text),
        vec![(
            "libs/a".to_string(),
            "https://example.com/a.git".to_string()
        )]
    );
}
