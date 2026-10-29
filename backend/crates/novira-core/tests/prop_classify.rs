//! Property tests for the name-based rules that tell a model's kind and family when its tensors say nothing (a GGUF
//! file, an unreadable header): any file name gives an answer, the answer does not depend on letter case or on the
//! folder the file sits in, and a name with a family word gives that family. In process only.
//! Run: `cargo test -p novira-core --test prop_classify`.
mod prop_common;

use novira_core::comfy::split::{is_gguf, name_has};
use novira_core::models::classify::{detect_base, detect_variant, kind_from_name};
use novira_core::types::{BaseModel, ModelType};
use prop_common::{any_text, check};
use proptest::prelude::*;

const BASES: [BaseModel; 22] = [
    BaseModel::Sd1,
    BaseModel::Sd2,
    BaseModel::Sdxl,
    BaseModel::Sd3,
    BaseModel::Flux,
    BaseModel::Flux2,
    BaseModel::Anima,
    BaseModel::Chroma,
    BaseModel::QwenImage,
    BaseModel::ZImage,
    BaseModel::Hidream,
    BaseModel::Auraflow,
    BaseModel::HunyuanImage,
    BaseModel::HunyuanDit,
    BaseModel::Wan,
    BaseModel::HunyuanVideo,
    BaseModel::HunyuanVideo15,
    BaseModel::LtxVideo,
    BaseModel::Ltx2,
    BaseModel::Any,
    BaseModel::Sd1,
    BaseModel::Sdxl,
];

const KINDS: [ModelType; 13] = [
    ModelType::Main,
    ModelType::Vae,
    ModelType::Lora,
    ModelType::Controlnet,
    ModelType::T2iAdapter,
    ModelType::IpAdapter,
    ModelType::ClipVision,
    ModelType::SpandrelImageToImage,
    ModelType::T5Encoder,
    ModelType::ClipEmbed,
    ModelType::DiffusionModel,
    ModelType::TextEncoder,
    ModelType::ModelPatch,
];

const WORDS: &[&str] = &[
    "flux",
    "kontext",
    "fill",
    "klein",
    "9b",
    "wan",
    "i2v",
    "t2v",
    "qwen",
    "edit",
    "2509",
    "layered",
    "lora",
    "lokr",
    "vae",
    "ae",
    "controlnet",
    "upscale",
    "esrgan",
    "umt5",
    "t5xxl",
    "text_encoder",
    "xl",
    "pony",
    "illustrious",
    "sd15",
    "v1-5",
    "hunyuan",
    "ltx",
    "chroma",
    "zimage",
    "hidream",
    "auraflow",
    "anima",
    "_sr_",
    "Q8_0",
    "fp8",
];

/// File names: hostile text, or family words with separators and an ending, optionally in a folder.
fn file_name() -> impl Strategy<Value = String> {
    prop_oneof![
        2 => any_text(),
        3 => (
            prop::collection::vec(prop::sample::select(WORDS), 0..4),
            prop::sample::select(&["-", "_", ".", " "][..]),
            prop::sample::select(&[".safetensors", ".gguf", ".pth", ".ckpt", ".bin", ""][..]),
        )
            .prop_map(|(words, sep, end)| format!("{}{end}", words.join(sep))),
    ]
}

/// A name without a folder part, so that putting any folder in front must change nothing.
fn bare_name() -> impl Strategy<Value = String> {
    file_name().prop_map(|n| n.replace(['/', '\\'], "_"))
}

fn folder() -> impl Strategy<Value = String> {
    prop_oneof![any_text(), Just("models/flux".to_string())].prop_map(|f| format!("{f}/"))
}

#[test]
fn any_file_name_gets_a_kind_a_family_and_a_variant_without_a_panic() {
    check(
        (file_name(), 0..BASES.len(), 0..KINDS.len()),
        |(name, base, kind)| {
            let _ = kind_from_name(&name);
            let _ = detect_base(KINDS[kind], None, &name);
            let _ = detect_variant(BASES[base], None, &name);
            let _ = is_gguf(&name);
            Ok(())
        },
    );
}

#[test]
fn the_kind_of_a_name_does_not_depend_on_letter_case_or_the_folder() {
    check((bare_name(), folder()), |(name, dir)| {
        let kind = kind_from_name(&name);
        prop_assert_eq!(
            kind_from_name(&name.to_ascii_uppercase()),
            kind,
            "upper case"
        );
        prop_assert_eq!(
            kind_from_name(&name.to_ascii_lowercase()),
            kind,
            "lower case"
        );
        let nested = format!("{dir}{name}");
        prop_assert_eq!(kind_from_name(&nested), kind, "folder in {}", nested);
        Ok(())
    });
}

#[test]
fn a_gguf_or_pth_name_has_the_kind_its_ending_gives() {
    check((bare_name(), any::<bool>()), |(stem, gguf)| {
        if gguf {
            let kind = kind_from_name(&format!("{stem}.GGUF"));
            prop_assert!(
                matches!(
                    kind,
                    Some(ModelType::TextEncoder | ModelType::DiffusionModel)
                ),
                "{kind:?}"
            );
            let (a, b) = (format!("{stem}.gguf"), format!("{stem}.GgUf"));
            prop_assert!(is_gguf(&a) && is_gguf(&b));
        } else {
            prop_assert_eq!(
                kind_from_name(&format!("{stem}.Pth")),
                Some(ModelType::SpandrelImageToImage)
            );
        }
        Ok(())
    });
}

#[test]
fn a_name_ending_otherwise_is_not_a_gguf_file() {
    check(any_text(), |name| {
        prop_assert_eq!(is_gguf(&name), name.to_ascii_lowercase().ends_with(".gguf"));
        Ok(())
    });
}

#[test]
fn the_family_from_a_name_is_stable_under_case_and_helpers_have_no_family() {
    check((file_name(), 0..KINDS.len()), |(name, kind)| {
        let kind = KINDS[kind];
        let base = detect_base(kind, None, &name);
        prop_assert_eq!(detect_base(kind, None, &name.to_ascii_uppercase()), base);
        if matches!(
            kind,
            ModelType::SpandrelImageToImage | ModelType::ClipVision | ModelType::TextEncoder
        ) {
            prop_assert_eq!(base, BaseModel::Any, "a {:?} belongs to no family", kind);
        }
        Ok(())
    });
}

#[test]
fn a_variant_from_a_name_ignores_the_folder_and_the_case() {
    check(
        (bare_name(), 0..BASES.len(), folder()),
        |(name, base, dir)| {
            let base = BASES[base];
            let want = detect_variant(base, None, &name);
            prop_assert_eq!(detect_variant(base, None, &format!("{dir}{name}")), want);
            prop_assert_eq!(detect_variant(base, None, &name.to_ascii_uppercase()), want);
            Ok(())
        },
    );
}

#[test]
fn a_family_word_decides_the_family_of_a_plain_file() {
    check(
        (
            prop::sample::select(
                &[
                    ("flux", BaseModel::Flux),
                    ("qwen-image", BaseModel::QwenImage),
                    ("hidream", BaseModel::Hidream),
                    ("auraflow", BaseModel::Auraflow),
                    ("chroma", BaseModel::Chroma),
                ][..],
            ),
            "[0-9]{0,3}",
            "[0-9]{0,3}",
            prop::sample::select(&[".safetensors", ".ckpt", ".gguf"][..]),
            any::<bool>(),
        ),
        |((word, family), before, after, end, upper)| {
            let mut name = format!("{before}{word}{after}{end}");
            if upper {
                name = name.to_ascii_uppercase();
            }
            prop_assert_eq!(
                detect_base(ModelType::Main, None, &name),
                family,
                "{}",
                name
            );
            Ok(())
        },
    );
}

#[test]
fn the_whole_name_rule_of_a_word_that_is_a_file_name() {
    check(
        ("[a-z0-9._/-]{0,16}", "[a-z0-9._-]{0,8}"),
        |(name, tail)| {
            // A word such as `ae.safetensors` is a whole file name: it matches only the file with exactly that name.
            let word = "ae.safetensors";
            let file = name.rsplit(['\\', '/']).next().unwrap_or(&name);
            prop_assert_eq!(name_has(&name, word), file == word);
            // Any other word matches where it appears in the path.
            let other = format!("x{tail}");
            prop_assert_eq!(name_has(&name, &other), name.contains(&other));
            Ok(())
        },
    );
}
