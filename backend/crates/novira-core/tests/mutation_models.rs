//! Tests added after mutation testing (cargo-mutants, `scripts\mutation.bat`) showed that a change of the model helpers went
//! unnoticed. Each test names the behaviour that a mutant used to break without any test failing.
use novira_core::models::classify::{detect_base, detect_kind, read_header_unchecked, Header};
use novira_core::models::layout::walk;
use novira_core::types::{BaseModel, ModelType};
use std::io::Write;

/// Builds `levels` nested folders below `root` and puts a model file into the innermost one.
fn nested_model(root: &std::path::Path, levels: usize) -> std::path::PathBuf {
    let mut dir = root.to_path_buf();
    for level in 0..levels {
        dir = dir.join(format!("d{level}"));
    }
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("deep.safetensors");
    std::fs::write(&file, b"x").unwrap();
    file
}

#[test]
fn walk_stops_descending_after_six_levels_of_folders() {
    let at_limit = tempfile::tempdir().unwrap();
    let file = nested_model(at_limit.path(), 6);
    assert_eq!(walk(at_limit.path()), vec![file]);

    let beyond = tempfile::tempdir().unwrap();
    nested_model(beyond.path(), 7);
    assert!(walk(beyond.path()).is_empty());
}

fn keys_only(keys: &[&str]) -> Header {
    Header {
        keys: keys.iter().map(|k| k.to_string()).collect(),
        ..Header::default()
    }
}

#[test]
fn each_lora_tensor_name_alone_marks_a_lora() {
    for key in [
        "lora_unet_x",
        "a.lora_down.weight",
        "a.lora_A.weight",
        "a.lora_up.weight",
    ] {
        assert_eq!(
            detect_kind(&keys_only(&[key])),
            Some(ModelType::Lora),
            "{key}"
        );
    }
}

#[test]
fn a_wan_transformer_needs_both_the_block_prefix_and_the_attention_name() {
    assert_eq!(
        detect_kind(&keys_only(&["blocks.0.self_attn.q.weight"])),
        Some(ModelType::DiffusionModel)
    );
    assert_eq!(detect_kind(&keys_only(&["blocks.0.ffn.weight"])), None);
    assert_eq!(detect_kind(&keys_only(&["other.self_attn.q.weight"])), None);
}

#[test]
fn a_vae_needs_both_an_encoder_and_a_decoder() {
    assert_eq!(
        detect_kind(&keys_only(&[
            "encoder.down.0.weight",
            "decoder.up.0.weight"
        ])),
        Some(ModelType::Vae)
    );
    assert_eq!(detect_kind(&keys_only(&["encoder.down.0.weight"])), None);
    assert_eq!(detect_kind(&keys_only(&["decoder.up.0.weight"])), None);
}

/// Writes a safetensors-like file whose JSON header is padded with spaces to exactly `len` bytes.
fn file_with_header_of(dir: &std::path::Path, len: u64) -> std::path::PathBuf {
    let json = br#"{"__metadata__":{"k":"v"}}"#;
    let path = dir.join("padded.safetensors");
    let mut file = std::fs::File::create(&path).unwrap();
    file.write_all(&len.to_le_bytes()).unwrap();
    file.write_all(json).unwrap();
    file.write_all(&vec![b' '; len as usize - json.len()])
        .unwrap();
    path
}

#[test]
fn a_header_of_exactly_64_mib_is_read_and_one_byte_more_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let max = 64 * 1024 * 1024;
    let header = read_header_unchecked(&file_with_header_of(dir.path(), max)).unwrap();
    assert_eq!(header.metadata["k"], "v");

    // The length prefix alone decides: no body is needed to be refused.
    let refused = dir.path().join("too_long.safetensors");
    std::fs::write(&refused, (max + 1).to_le_bytes()).unwrap();
    assert!(read_header_unchecked(&refused).is_none());
}

#[test]
fn an_sd15_file_name_is_recognised_by_either_of_its_spellings() {
    for name in ["x-v1-5.safetensors", "x-sd-1.safetensors"] {
        assert_eq!(
            detect_base(ModelType::Main, None, name),
            BaseModel::Sd1,
            "{name}"
        );
    }
    assert_eq!(
        detect_base(ModelType::Main, None, "plain.safetensors"),
        BaseModel::Any
    );
}

#[test]
fn a_lora_with_only_a_second_text_encoder_is_sdxl() {
    let header = keys_only(&["text_encoder_2.layers.0.weight"]);
    assert_eq!(
        detect_base(ModelType::Lora, Some(&header), "plain.safetensors"),
        BaseModel::Sdxl
    );
}
