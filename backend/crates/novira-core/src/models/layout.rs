//! Model folders: ComfyUI's categories and the folder names that hold them in ComfyUI and Stability Matrix layouts.
use crate::types::ModelType;
use std::path::{Path, PathBuf, MAIN_SEPARATOR_STR};

pub struct Category {
    /// ComfyUI folder category (`folder_paths` name).
    pub folder: &'static str,
    pub kind: ModelType,
    /// Sub-folders of a model root that belong to this category.
    pub aliases: &'static [&'static str],
}

pub const CATEGORIES: &[Category] = &[
    Category {
        folder: "checkpoints",
        kind: ModelType::Main,
        aliases: &["checkpoints", "StableDiffusion", "Stable-diffusion"],
    },
    Category {
        folder: "loras",
        kind: ModelType::Lora,
        aliases: &["loras", "Lora", "LyCORIS"],
    },
    Category {
        folder: "vae",
        kind: ModelType::Vae,
        aliases: &["vae", "VAE"],
    },
    Category {
        folder: "controlnet",
        kind: ModelType::Controlnet,
        aliases: &["controlnet", "ControlNet"],
    },
    Category {
        folder: "ipadapter",
        kind: ModelType::IpAdapter,
        aliases: &["ipadapter", "IpAdapter", "IpAdaptersXl", "IpAdapters15"],
    },
    Category {
        folder: "clip_vision",
        kind: ModelType::ClipVision,
        aliases: &["clip_vision", "ClipVision"],
    },
    Category {
        folder: "upscale_models",
        kind: ModelType::SpandrelImageToImage,
        aliases: &["upscale_models", "ESRGAN", "RealESRGAN", "SwinIR"],
    },
    Category {
        folder: "diffusion_models",
        kind: ModelType::DiffusionModel,
        aliases: &["diffusion_models", "unet", "UNet"],
    },
    Category {
        folder: "text_encoders",
        kind: ModelType::TextEncoder,
        aliases: &["text_encoders", "clip", "CLIP"],
    },
    Category {
        folder: "model_patches",
        kind: ModelType::ModelPatch,
        aliases: &["model_patches"],
    },
];

pub const MODEL_EXTENSIONS: &[&str] = &["safetensors", "ckpt", "pt", "pth", "bin", "gguf", "sft"];
const MAX_DEPTH: usize = 6;

pub fn category_for_kind(kind: ModelType) -> Option<&'static Category> {
    CATEGORIES.iter().find(|c| c.kind == kind)
}

pub fn category_by_folder(folder: &str) -> Option<&'static Category> {
    CATEGORIES.iter().find(|c| c.folder == folder)
}

pub fn is_model_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| MODEL_EXTENSIONS.iter().any(|m| m.eq_ignore_ascii_case(e)))
}

#[derive(Debug, Clone, PartialEq)]
pub struct FoundModel {
    pub path: PathBuf,
    pub folder: &'static str,
    pub kind: ModelType,
    /// Name relative to the category folder, with the platform separator (what ComfyUI lists).
    pub comfy_name: String,
    pub size: u64,
}

/// Model files below a folder (recursive, hidden entries skipped).
pub fn walk(dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    walk_into(dir, 0, &mut out);
    out.sort();
    out
}

fn walk_into(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() || (ft.is_symlink() && path.is_dir()) {
            if depth < MAX_DEPTH {
                walk_into(&path, depth + 1, out);
            }
        } else if is_model_file(&path) {
            out.push(path);
        }
    }
}

fn relative_name(dir: &Path, file: &Path) -> Option<String> {
    let rel = file.strip_prefix(dir).ok()?;
    let parts: Vec<String> = rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    Some(parts.join(MAIN_SEPARATOR_STR))
}

/// Every model in the given roots, by category. Earlier roots win when two roots hold the same name.
pub fn scan_roots(roots: &[PathBuf]) -> Vec<FoundModel> {
    let mut out: Vec<FoundModel> = Vec::new();
    for root in roots {
        for cat in CATEGORIES {
            for alias in cat.aliases {
                let dir = root.join(alias);
                for file in walk(&dir) {
                    let Some(comfy_name) = relative_name(&dir, &file) else {
                        continue;
                    };
                    if out
                        .iter()
                        .any(|m| m.folder == cat.folder && m.comfy_name == comfy_name)
                    {
                        continue;
                    }
                    let size = std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
                    out.push(FoundModel {
                        path: file,
                        folder: cat.folder,
                        kind: cat.kind,
                        comfy_name,
                        size,
                    });
                }
            }
        }
    }
    out
}

/// Kinds whose tensor names are unmistakable, so a file holding them does not belong among the main models.
const MISFILED_KINDS: &[ModelType] = &[
    ModelType::IpAdapter,
    ModelType::Lora,
    ModelType::Controlnet,
    ModelType::ClipVision,
    ModelType::Vae,
    ModelType::DiffusionModel,
    ModelType::TextEncoder,
    ModelType::ModelPatch,
];

/// Moves files that sit in the checkpoints folder of `models_dir` but hold another kind of model (an IP-Adapter
/// downloaded as a "Checkpoint") into that kind's folder, so they stop appearing among the main models. A file whose name is
/// taken in the target folder stays. Returns the moves made, as (from, to).
pub fn move_misfiled(models_dir: &Path) -> Vec<(PathBuf, PathBuf)> {
    let mut moved = Vec::new();
    let Some(main) = category_for_kind(ModelType::Main) else {
        return moved;
    };
    for alias in main.aliases {
        for file in walk(&models_dir.join(alias)) {
            let Some(kind) = crate::models::classify::read_header(&file)
                .as_ref()
                .and_then(crate::models::classify::detect_kind)
                .filter(|k| MISFILED_KINDS.contains(k))
            else {
                continue;
            };
            let (Some(cat), Some(name)) = (category_for_kind(kind), file.file_name()) else {
                continue;
            };
            let dest = models_dir.join(cat.folder).join(name);
            if dest.exists() || std::fs::create_dir_all(models_dir.join(cat.folder)).is_err() {
                continue;
            }
            if std::fs::rename(&file, &dest).is_ok() {
                moved.push((file, dest));
            }
        }
    }
    moved
}

/// ComfyUI `extra_model_paths.yaml` that exposes the same folders, so ComfyUI lists the names novira uses.
pub fn extra_model_paths_yaml(roots: &[PathBuf]) -> String {
    let mut out = String::from("# Generated by novira. Edits are overwritten.\n");
    for (i, root) in roots.iter().enumerate() {
        let mut body = String::new();
        for cat in CATEGORIES {
            let present: Vec<&&str> = cat
                .aliases
                .iter()
                .filter(|a| root.join(a).is_dir())
                .collect();
            if present.is_empty() {
                continue;
            }
            body.push_str(&format!("  {}: |\n", cat.folder));
            for a in present {
                body.push_str(&format!("    {a}\n"));
            }
        }
        if body.is_empty() {
            continue;
        }
        out.push_str(&format!(
            "novira_{i}:\n  base_path: '{}'\n",
            root.to_string_lossy().replace('\'', "''")
        ));
        out.push_str(&body);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(p: &Path, bytes: usize) {
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, vec![0u8; bytes]).unwrap();
    }

    /// A safetensors file whose header lists the given tensor names (no weights).
    fn safetensors(p: &Path, keys: &[&str]) {
        let header: serde_json::Map<String, serde_json::Value> = keys
            .iter()
            .map(|k| {
                (
                    (*k).to_string(),
                    serde_json::json!({"dtype": "F32", "shape": [1], "data_offsets": [0, 4]}),
                )
            })
            .collect();
        let json = serde_json::to_vec(&header).unwrap();
        let mut bytes = (json.len() as u64).to_le_bytes().to_vec();
        bytes.extend(json);
        bytes.extend([0u8; 4]);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, bytes).unwrap();
    }

    #[test]
    fn an_ip_adapter_filed_among_the_checkpoints_is_moved_to_its_own_folder() {
        let d = tempfile::tempdir().unwrap();
        let m = d.path();
        safetensors(
            &m.join("checkpoints/ipa.safetensors"),
            &["image_proj.proj.weight", "ip_adapter.1.to_k_ip.weight"],
        );
        safetensors(
            &m.join("checkpoints/real.safetensors"),
            &["model.diffusion_model.input_blocks.0.0.weight"],
        );
        safetensors(
            &m.join("checkpoints/lora.safetensors"),
            &["lora_unet_x.lora_down.weight"],
        );
        safetensors(
            &m.join("checkpoints/ae.safetensors"),
            &[
                "encoder.down.0.block.0.conv1.weight",
                "decoder.up.0.block.0.conv1.weight",
            ],
        );
        // The target folder already has a file of that name: the checkpoint stays rather than overwrite it.
        safetensors(
            &m.join("checkpoints/dup.safetensors"),
            &["image_proj.proj.weight"],
        );
        touch(&m.join("ipadapter/dup.safetensors"), 3);
        let moved = move_misfiled(m);
        assert_eq!(moved.len(), 3);
        assert!(m.join("vae/ae.safetensors").is_file());
        assert!(m.join("ipadapter/ipa.safetensors").is_file());
        assert!(m.join("loras/lora.safetensors").is_file());
        assert!(m.join("checkpoints/real.safetensors").is_file());
        assert!(m.join("checkpoints/dup.safetensors").is_file());
        assert!(!m.join("checkpoints/ipa.safetensors").exists());
        // Nothing left to move the second time.
        assert_eq!(move_misfiled(m).len(), 0);
    }

    #[test]
    fn both_layouts_are_scanned_and_first_root_wins() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        touch(&a.path().join("checkpoints/sdxl/base.safetensors"), 10);
        touch(&a.path().join("loras/.hidden/x.safetensors"), 1);
        touch(&a.path().join("loras/readme.txt"), 1);
        touch(&b.path().join("StableDiffusion/sdxl/base.safetensors"), 20);
        touch(&b.path().join("Lora/style.safetensors"), 5);
        touch(&b.path().join("ESRGAN/4x.pth"), 5);
        let found = scan_roots(&[a.path().to_path_buf(), b.path().to_path_buf()]);
        let sep = MAIN_SEPARATOR_STR;
        let names: Vec<(&str, String, u64)> = found
            .iter()
            .map(|m| (m.folder, m.comfy_name.clone(), m.size))
            .collect();
        assert_eq!(
            names,
            vec![
                ("checkpoints", format!("sdxl{sep}base.safetensors"), 10),
                ("loras", "style.safetensors".to_string(), 5),
                ("upscale_models", "4x.pth".to_string(), 5),
            ]
        );
    }

    #[test]
    fn quantised_diffusion_models_are_found_in_either_folder_name() {
        let a = tempfile::tempdir().unwrap();
        touch(&a.path().join("diffusion_models/HighNoise/wan-q4.gguf"), 3);
        touch(&a.path().join("unet/flux.gguf"), 2);
        let found = scan_roots(&[a.path().to_path_buf()]);
        assert_eq!(found.len(), 2);
        assert!(found
            .iter()
            .all(|f| f.kind == ModelType::DiffusionModel && f.folder == "diffusion_models"));
    }

    #[test]
    fn yaml_lists_only_existing_folders() {
        let a = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(a.path().join("Lora")).unwrap();
        std::fs::create_dir_all(a.path().join("LyCORIS")).unwrap();
        let yaml = extra_model_paths_yaml(&[a.path().to_path_buf(), PathBuf::from("Z:/missing")]);
        assert!(yaml.contains("novira_0:"));
        assert!(yaml.contains("  loras: |\n    Lora\n    LyCORIS\n"));
        assert!(!yaml.contains("checkpoints"));
        assert!(!yaml.contains("novira_1"));
    }

    #[test]
    fn ipadapter_and_clip_vision_folders_are_exposed_under_the_names_the_ipadapter_pack_reads() {
        // ComfyUI_IPAdapter_plus keeps the `ipadapter` paths already registered (from this file) and adds its own.
        let a = tempfile::tempdir().unwrap();
        for cat in ["ipadapter", "clip_vision", "controlnet"] {
            std::fs::create_dir_all(a.path().join(cat)).unwrap();
        }
        let yaml = extra_model_paths_yaml(&[a.path().to_path_buf()]);
        assert!(yaml.contains("  ipadapter: |\n    ipadapter\n"), "{yaml}");
        assert!(
            yaml.contains("  clip_vision: |\n    clip_vision\n"),
            "{yaml}"
        );
        assert!(yaml.contains("  controlnet: |\n    controlnet\n"), "{yaml}");
        touch(&a.path().join("ipadapter/ip-adapter_sd15.safetensors"), 1);
        let found = scan_roots(&[a.path().to_path_buf()]);
        assert_eq!(found[0].kind, ModelType::IpAdapter);
    }
}
