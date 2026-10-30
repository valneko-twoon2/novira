//! Keeps the stored model records in step with the files on disk. User edits (name, description,
//! default settings, trigger phrases) live in the records and survive rescans.
use super::classify;
use super::layout::FoundModel;
use crate::types::{BaseModel, ComfyRef, ModelConfig, ModelType};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

fn type_slug(kind: ModelType) -> &'static str {
    match kind {
        ModelType::Main => "main",
        ModelType::Vae => "vae",
        ModelType::Lora => "lora",
        ModelType::Controlnet => "controlnet",
        ModelType::T2iAdapter => "t2i",
        ModelType::IpAdapter => "ipa",
        ModelType::ClipVision => "clipvision",
        ModelType::SpandrelImageToImage => "upscale",
        ModelType::T5Encoder => "t5",
        ModelType::ClipEmbed => "clip",
        ModelType::DiffusionModel => "diffusion",
        ModelType::TextEncoder => "textenc",
        ModelType::ModelPatch => "patch",
    }
}

/// Stable key from the ComfyUI address, so the same file keeps its key across scans and restarts.
pub fn key_for(kind: ModelType, folder: &str, comfy_name: &str) -> String {
    let digest = Sha256::digest(format!("{folder}/{}", comfy_name.replace('\\', "/")).as_bytes());
    let hex: String = digest.iter().take(6).map(|b| format!("{b:02x}")).collect();
    format!("{}-{hex}", type_slug(kind))
}

fn stem(name: &str) -> String {
    let file = name.rsplit(['\\', '/']).next().unwrap_or(name);
    match file.rfind('.') {
        Some(i) if i > 0 => file[..i].to_string(),
        _ => file.to_string(),
    }
}

/// A fresh record for a file that has none yet.
pub fn new_record(
    found: &FoundModel,
    source: Option<&str>,
    display_name: Option<&str>,
) -> ModelConfig {
    let header = classify::read_header(&found.path);
    let file_name = found
        .path
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_default();
    ModelConfig {
        key: key_for(found.kind, found.folder, &found.comfy_name),
        name: display_name
            .map(stem)
            .unwrap_or_else(|| stem(&found.comfy_name)),
        base: classify::detect_base(found.kind, header.as_ref(), &file_name),
        kind: found.kind,
        format: classify::detect_format(found.kind, &found.path),
        description: String::new(),
        path: found.path.to_string_lossy().into_owned(),
        size: found.size,
        source: source
            .map(str::to_string)
            .unwrap_or_else(|| found.path.to_string_lossy().into_owned()),
        default_settings: None,
        license: None,
        trigger_phrases: header
            .as_ref()
            .and_then(|h| {
                h.metadata
                    .get("modelspec.trigger_phrase")
                    .and_then(|v| v.as_str())
            })
            .map(|t| {
                t.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
        cover_image_url: None,
        cover_mature: None,
        cover_image_urls: None,
        page_url: None,
        comfy: Some(ComfyRef {
            folder: found.folder.to_string(),
            name: found.comfy_name.clone(),
        }),
    }
}

pub struct Merged {
    /// Models present on disk and not hidden, in scan order.
    pub listed: Vec<ModelConfig>,
    /// Records that are new or whose file facts changed and must be written back.
    pub changed: Vec<ModelConfig>,
}

pub fn merge(found: &[FoundModel], stored: &[ModelConfig], hidden: &HashSet<String>) -> Merged {
    let mut listed = Vec::new();
    let mut changed = Vec::new();
    for f in found {
        let key = key_for(f.kind, f.folder, &f.comfy_name);
        if hidden.contains(&key) {
            continue;
        }
        let path = f.path.to_string_lossy().into_owned();
        let record = match stored.iter().find(|m| m.key == key) {
            Some(old) if old.size == f.size && old.path == path => old.clone(),
            Some(old) => {
                // The file changed: refresh file facts, keep the user's edits.
                let fresh = new_record(f, Some(&old.source), None);
                let updated = ModelConfig {
                    base: fresh.base,
                    format: fresh.format,
                    path,
                    size: f.size,
                    comfy: fresh.comfy,
                    ..old.clone()
                };
                changed.push(updated.clone());
                updated
            }
            None => {
                let fresh = new_record(f, None, None);
                changed.push(fresh.clone());
                fresh
            }
        };
        listed.push(record);
    }
    Merged { listed, changed }
}

/// LoRA records an older version gave an SD family although the file's tensors are of a newer one (a trainer that wrote
/// the wrong architecture), corrected to that family. Run once per fix of the detection: a base the user chose other than
/// an SD family stays, and so does an SD base the file does not contradict.
pub fn corrected_lora_bases(listed: &[ModelConfig]) -> Vec<ModelConfig> {
    let sd = |b: BaseModel| matches!(b, BaseModel::Sd1 | BaseModel::Sd2 | BaseModel::Sdxl);
    listed
        .iter()
        .filter(|m| m.kind == ModelType::Lora && sd(m.base))
        .filter_map(|m| {
            let path = std::path::Path::new(&m.path);
            let header = classify::read_header(path)?;
            let file_name = path.file_name()?.to_string_lossy();
            let base = classify::detect_base(ModelType::Lora, Some(&header), &file_name);
            (!sd(base) && base != BaseModel::Any).then(|| ModelConfig { base, ..m.clone() })
        })
        .collect()
}

/// Records an older version stored without a family (`any`) although the current detection names one for the file (the
/// HunyuanImage 2.1 VAE, before its name was read), corrected to that family. Run once per fix of the detection, so a base
/// the user sets afterwards stays; a file that cannot be read, or still names no family, is left as it is.
pub fn corrected_any_bases(listed: &[ModelConfig]) -> Vec<ModelConfig> {
    listed
        .iter()
        .filter(|m| m.base == BaseModel::Any)
        .filter_map(|m| {
            let path = std::path::Path::new(&m.path);
            if !path.is_file() {
                return None;
            }
            let header = classify::read_header(path);
            let file_name = path.file_name()?.to_string_lossy();
            let base = classify::detect_base(m.kind, header.as_ref(), &file_name);
            (base != BaseModel::Any).then(|| ModelConfig { base, ..m.clone() })
        })
        .collect()
}

/// Records whose stored commercial-use summary no longer matches their permission list (an older version summed it up
/// differently), corrected to `civitai::commercial_of`. Records without a license or a permission list stay.
pub fn corrected_license_summaries(listed: &[ModelConfig]) -> Vec<ModelConfig> {
    listed
        .iter()
        .filter_map(|m| {
            let license = m.license.as_ref().filter(|l| !l.permissions.is_empty())?;
            let commercial = crate::models::civitai::commercial_of(&license.permissions);
            (license.commercial != commercial).then(|| {
                let mut fixed = m.clone();
                if let Some(l) = fixed.license.as_mut() {
                    l.commercial = commercial.into();
                }
                fixed
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn found(dir: &std::path::Path, name: &str, size: usize) -> FoundModel {
        let path = dir.join(name);
        std::fs::write(&path, vec![0u8; size]).unwrap();
        FoundModel {
            path,
            folder: "loras",
            kind: ModelType::Lora,
            comfy_name: name.into(),
            size: size as u64,
        }
    }

    #[test]
    fn keys_are_stable_and_separator_independent() {
        assert_eq!(
            key_for(ModelType::Main, "checkpoints", "a\\b.safetensors"),
            key_for(ModelType::Main, "checkpoints", "a/b.safetensors")
        );
        assert_ne!(
            key_for(ModelType::Main, "checkpoints", "a.safetensors"),
            key_for(ModelType::Main, "checkpoints", "b.safetensors")
        );
        assert!(key_for(ModelType::Lora, "loras", "x").starts_with("lora-"));
    }

    #[test]
    fn rescans_keep_user_edits_and_skip_hidden_or_missing_files() {
        let dir = tempfile::tempdir().unwrap();
        let a = found(dir.path(), "detail-xl.safetensors", 4);
        let b = found(dir.path(), "hidden.safetensors", 4);
        let first = merge(&[a.clone(), b.clone()], &[], &HashSet::new());
        assert_eq!(first.changed.len(), 2);
        let mut edited = first.listed[0].clone();
        assert_eq!(edited.name, "detail-xl");
        assert_eq!(edited.base, BaseModel::Sdxl);
        edited.name = "My detail".into();
        let gone = ModelConfig {
            key: "lora-gone".into(),
            path: PathBuf::from("Z:/gone").to_string_lossy().into(),
            ..edited.clone()
        };

        let hidden: HashSet<String> = [first.listed[1].key.clone()].into();
        let second = merge(&[a.clone(), b], &[edited.clone(), gone], &hidden);
        assert_eq!(second.listed, vec![edited.clone()]);
        assert!(second.changed.is_empty());

        // A changed file refreshes its size but keeps the name.
        let a2 = found(dir.path(), "detail-xl.safetensors", 9);
        let third = merge(&[a2], &[edited], &HashSet::new());
        assert_eq!(third.listed[0].name, "My detail");
        assert_eq!(third.listed[0].size, 9);
        assert_eq!(third.changed.len(), 1);
    }

    #[test]
    fn a_changed_file_refreshes_what_the_file_says_about_itself_and_not_the_users_edits() {
        let dir = tempfile::tempdir().unwrap();
        let a = found(dir.path(), "detail-xl.safetensors", 4);
        let fresh = merge(std::slice::from_ref(&a), &[], &HashSet::new()).listed[0].clone();
        let stale = ModelConfig {
            base: BaseModel::Flux,
            format: crate::types::ModelFormat::Gguf,
            comfy: Some(ComfyRef {
                name: "old-name.safetensors".into(),
                ..fresh.comfy.clone().unwrap()
            }),
            name: "My detail".into(),
            ..fresh.clone()
        };
        assert_ne!((stale.base, stale.format), (fresh.base, fresh.format));
        let a2 = found(dir.path(), "detail-xl.safetensors", 9);
        let merged = merge(&[a2], &[stale], &HashSet::new()).listed[0].clone();
        assert_eq!(merged.base, fresh.base);
        assert_eq!(merged.format, fresh.format);
        assert_eq!(merged.comfy, fresh.comfy);
        assert_eq!(merged.name, "My detail");
    }

    /// A LoRA file whose header holds `keys` and `meta`.
    fn lora_file(dir: &std::path::Path, name: &str, keys: &[&str], meta: &str) -> FoundModel {
        let tensors: Vec<String> = keys
            .iter()
            .map(|k| format!(r#""{k}":{{"dtype":"F16","shape":[1],"data_offsets":[0,2]}}"#))
            .collect();
        let json = format!(r#"{{"__metadata__":{meta},{}}}"#, tensors.join(","));
        let mut bytes = (json.len() as u64).to_le_bytes().to_vec();
        bytes.extend_from_slice(json.as_bytes());
        bytes.extend_from_slice(&[0, 0]);
        let path = dir.join(name);
        std::fs::write(&path, &bytes).unwrap();
        FoundModel {
            path,
            folder: "loras",
            kind: ModelType::Lora,
            comfy_name: name.into(),
            size: bytes.len() as u64,
        }
    }

    #[test]
    fn a_lora_stored_with_an_sd_base_its_tensors_contradict_is_corrected() {
        let dir = tempfile::tempdir().unwrap();
        let anima = lora_file(
            dir.path(),
            "anima-style.safetensors",
            &["lora_unet_blocks_0_adaln_modulation_self_attn_1.lora_down.weight"],
            r#"{"modelspec.architecture":"stable-diffusion-v1/lora"}"#,
        );
        let xl = lora_file(
            dir.path(),
            "detail.safetensors",
            &["lora_te2_text_model.lora_up.weight"],
            "{}",
        );
        let listed = merge(&[anima.clone(), xl], &[], &HashSet::new()).listed;
        // As an older version stored them: the Anima LoRA as SD 1.5, and one the user moved to Anima by hand.
        let stored = |name: &str, base: BaseModel| ModelConfig {
            base,
            ..listed.iter().find(|m| m.name == name).unwrap().clone()
        };
        let wrong = stored("anima-style", BaseModel::Sd1);
        let fixed = corrected_lora_bases(&[
            wrong.clone(),
            stored("detail", BaseModel::Sdxl),
            stored("anima-style", BaseModel::Anima),
        ]);
        assert_eq!(
            fixed,
            vec![ModelConfig {
                base: BaseModel::Anima,
                ..wrong
            }]
        );
        // A file that cannot be read is left as it is.
        std::fs::remove_file(&anima.path).unwrap();
        assert!(corrected_lora_bases(&[stored("anima-style", BaseModel::Sd1)]).is_empty());
    }

    #[test]
    fn a_record_stored_without_a_family_takes_the_one_its_file_now_names() {
        let dir = tempfile::tempdir().unwrap();
        let vae_of = |name: &str, shape: &str| {
            let path = dir.path().join(name);
            let json = format!(
                r#"{{"decoder.conv_in.weight":{{"dtype":"F16","shape":{shape},"data_offsets":[0,2]}}}}"#
            );
            let json = json.as_bytes();
            let mut bytes = (json.len() as u64).to_le_bytes().to_vec();
            bytes.extend_from_slice(json);
            bytes.extend_from_slice(&[0, 0]);
            std::fs::write(&path, &bytes).unwrap();
            FoundModel {
                path,
                folder: "vae",
                kind: ModelType::Vae,
                comfy_name: name.into(),
                size: bytes.len() as u64,
            }
        };
        let vae = |name: &str| vae_of(name, "[1]");
        let listed = merge(
            &[
                vae("hunyuan_image_2.1_vae_fp16.safetensors"),
                vae("plain.safetensors"),
                vae_of("vae-ft-mse-840000-ema-pruned.safetensors", "[512,4,3,3]"),
            ],
            &[],
            &HashSet::new(),
        )
        .listed;
        let stored = |name: &str, base: BaseModel| ModelConfig {
            base,
            ..listed.iter().find(|m| m.name == name).unwrap().clone()
        };
        let old = stored("hunyuan_image_2.1_vae_fp16", BaseModel::Any);
        let fixed = corrected_any_bases(&[
            old.clone(),
            stored("plain", BaseModel::Any),
            stored("hunyuan_image_2.1_vae_fp16", BaseModel::Sdxl),
        ]);
        assert_eq!(
            fixed,
            vec![ModelConfig {
                base: BaseModel::HunyuanImage,
                ..old.clone()
            }]
        );
        // The SD 1.5 VAE, offered with every model before its latent channels were read.
        let mse = stored("vae-ft-mse-840000-ema-pruned", BaseModel::Any);
        assert_eq!(
            corrected_any_bases(std::slice::from_ref(&mse)),
            vec![ModelConfig {
                base: BaseModel::Sd1,
                ..mse
            }]
        );
        // A file that is gone is left as it is.
        std::fs::remove_file(&old.path).unwrap();
        assert!(corrected_any_bases(&[old]).is_empty());
    }

    #[test]
    fn a_stored_license_summary_is_brought_in_line_with_its_permissions() {
        let dir = tempfile::tempdir().unwrap();
        let file = found(dir.path(), "m.safetensors", 8);
        let base = merge(&[file], &[], &HashSet::new()).listed.remove(0);
        let perm = |key: &str, allowed: bool| crate::types::Permission {
            key: key.into(),
            allowed: Some(allowed),
        };
        let with = |commercial: &str, permissions: Vec<crate::types::Permission>| ModelConfig {
            license: Some(crate::types::ModelLicense {
                site: "civitai".into(),
                name: None,
                commercial: commercial.into(),
                permissions,
            }),
            ..base.clone()
        };
        // An older version called a model that only lets its pictures be sold "allowed".
        let images_only = vec![
            perm("sellImages", true),
            perm("generationServices", false),
            perm("sellModel", false),
        ];
        let fixed = corrected_license_summaries(&[with("allowed", images_only.clone())]);
        assert_eq!(fixed, vec![with("limited", images_only.clone())]);
        // A summary that already matches, an empty list and no license are left alone.
        assert!(corrected_license_summaries(&[
            with("limited", images_only),
            with("allowed", vec![]),
            base.clone()
        ])
        .is_empty());
    }
}
