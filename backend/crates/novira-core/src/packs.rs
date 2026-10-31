//! Model packs: the extra files a kind of media needs beyond the image models, downloaded on request.
//!
//! - Video: Wan 2.2 "TI2V 5B" (diffusion model, text encoder, VAE).
//! - Turbo: the 4-step distilled Wan 2.2 5B (one diffusion model; it reuses the video pack's text encoder and VAE).
//! - Music: ACE-Step 1.5 turbo, one all-in-one checkpoint.
//! - Logo: Z-Image-Turbo in 8-bit (diffusion model, Qwen3-4B text encoder, VAE; about 12 GB), an 8-step image model that
//!   draws legible text.
//!
//! A pack lives under `<models>/<kind>/` instead of the normal model folders, so its files never show up in the lists
//! of image models; ComfyUI sees them through one extra `extra_model_paths.yaml` section per pack. (The voice engine
//! is not a ComfyUI model and has its own installer in `voice`.)
use crate::models::install::{download, InstallError};
use crate::types::ComfyRef;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PackKind {
    Video,
    Turbo,
    Music,
    Voice,
    Inpaint,
    Logo,
}

impl PackKind {
    pub const ALL: [PackKind; 6] = [
        PackKind::Video,
        PackKind::Turbo,
        PackKind::Music,
        PackKind::Voice,
        PackKind::Inpaint,
        PackKind::Logo,
    ];

    /// The packs ComfyUI loads files from (the voice engine runs outside ComfyUI).
    pub const COMFY: [PackKind; 5] = [
        PackKind::Video,
        PackKind::Turbo,
        PackKind::Music,
        PackKind::Inpaint,
        PackKind::Logo,
    ];

    /// Folder under the models folder.
    pub fn dir(self) -> &'static str {
        match self {
            Self::Video => "video",
            Self::Turbo => "turbo",
            Self::Music => "music",
            Self::Voice => "voice",
            Self::Inpaint => "inpaint",
            Self::Logo => "logo",
        }
    }
}

pub struct PackFile {
    /// ComfyUI folder category the file belongs to.
    pub folder: &'static str,
    pub file: &'static str,
    /// Hugging Face repository and the path of the file in it (unused when `url` is set).
    pub repo: &'static str,
    pub path: &'static str,
    /// A direct address, for a file that is not on Hugging Face.
    pub url: Option<&'static str>,
    /// The pack whose folder holds the file, when it is one another pack already downloads (default: this pack).
    pub home: Option<PackKind>,
    /// Rough size, only used to show progress before the real size is known.
    pub approx_bytes: u64,
}

pub const VIDEO_FILES: [PackFile; 3] = [
    PackFile {
        folder: "diffusion_models",
        file: "wan2.2_ti2v_5B_fp16.safetensors",
        repo: "Comfy-Org/Wan_2.2_ComfyUI_Repackaged",
        path: "split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors",
        approx_bytes: 10_000_000_000,
        url: None,
        home: None,
    },
    PackFile {
        folder: "text_encoders",
        file: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        repo: "Comfy-Org/Wan_2.1_ComfyUI_repackaged",
        path: "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        approx_bytes: 6_735_906_897,
        url: None,
        home: None,
    },
    PackFile {
        folder: "vae",
        file: "wan2.2_vae.safetensors",
        repo: "Comfy-Org/Wan_2.2_ComfyUI_Repackaged",
        path: "split_files/vae/wan2.2_vae.safetensors",
        approx_bytes: 1_409_400_960,
        url: None,
        home: None,
    },
];

/// The "Turbo" distilled Wan 2.2 5B: the same architecture in 4 steps, so one model file; the text encoder and VAE are
/// the video pack's, downloaded into its folders (a user with both packs holds each file once).
pub const TURBO_FILES: [PackFile; 3] = [
    PackFile {
        folder: "diffusion_models",
        file: "wan2.2_ti2v_5b_turbo_bf16_f32_mixed.safetensors",
        repo: "SuShuHeng/wan2.2_it2v_5B_Turbo_ConvRot_INT8_INT4",
        path: "wan2.2_ti2v_5b_turbo_bf16_f32_mixed.safetensors",
        approx_bytes: 10_021_605_552,
        url: None,
        home: None,
    },
    PackFile {
        folder: "text_encoders",
        file: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        repo: "Comfy-Org/Wan_2.1_ComfyUI_repackaged",
        path: "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        approx_bytes: 6_735_906_897,
        url: None,
        home: Some(PackKind::Video),
    },
    PackFile {
        folder: "vae",
        file: "wan2.2_vae.safetensors",
        repo: "Comfy-Org/Wan_2.2_ComfyUI_Repackaged",
        path: "split_files/vae/wan2.2_vae.safetensors",
        approx_bytes: 1_409_400_960,
        url: None,
        home: Some(PackKind::Video),
    },
];

/// The `model_key` of a video request that asks for the Turbo model.
pub const TURBO_KEY: &str = "video-turbo";

pub const MUSIC_FILES: [PackFile; 1] = [PackFile {
    folder: "checkpoints",
    file: "ace_step_1.5_turbo_aio.safetensors",
    repo: "Comfy-Org/ace_step_1.5_ComfyUI_files",
    path: "checkpoints/ace_step_1.5_turbo_aio.safetensors",
    approx_bytes: 10_030_000_000,
    url: None,
    home: None,
}];

/// LaMa, the model "erase the selection" fills with (used by the comfyui-inpaint-nodes pack from `models/inpaint`).
pub const INPAINT_FILES: [PackFile; 1] = [PackFile {
    folder: "inpaint",
    file: "big-lama.pt",
    repo: "",
    path: "",
    url: Some("https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt"),
    home: None,
    approx_bytes: 205_669_692,
}];

/// Z-Image-Turbo (Apache-2.0) in 8-bit floats, so the pack is about 12 GB instead of the 21 GB of the bf16 files: the
/// diffusion model is a community repack (T5B), the text encoder and VAE are Comfy-Org's. ComfyUI upcasts the weights
/// layer by layer, so the node graph is the same as for bf16.
pub const LOGO_FILES: [PackFile; 3] = [
    PackFile {
        folder: "diffusion_models",
        file: "z-image-turbo-fp8-e4m3fn.safetensors",
        repo: "T5B/Z-Image-Turbo-FP8",
        path: "z-image-turbo-fp8-e4m3fn.safetensors",
        approx_bytes: 6_154_974_440,
        url: None,
        home: None,
    },
    PackFile {
        folder: "text_encoders",
        file: "qwen_3_4b_fp8_mixed.safetensors",
        repo: "Comfy-Org/z_image_turbo",
        path: "split_files/text_encoders/qwen_3_4b_fp8_mixed.safetensors",
        approx_bytes: 5_631_994_051,
        url: None,
        home: None,
    },
    PackFile {
        folder: "vae",
        file: "ae.safetensors",
        repo: "Comfy-Org/z_image_turbo",
        path: "split_files/vae/ae.safetensors",
        approx_bytes: 335_304_388,
        url: None,
        home: None,
    },
];

/// The files of a ComfyUI pack; the voice engine has none.
pub fn files(kind: PackKind) -> &'static [PackFile] {
    match kind {
        PackKind::Video => &VIDEO_FILES,
        PackKind::Turbo => &TURBO_FILES,
        PackKind::Music => &MUSIC_FILES,
        PackKind::Voice => &[],
        PackKind::Inpaint => &INPAINT_FILES,
        PackKind::Logo => &LOGO_FILES,
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "state",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum PackStatus {
    /// Something is not installed yet.
    Missing {
        total_bytes: u64,
    },
    Downloading {
        file: String,
        index: u32,
        count: u32,
        bytes: u64,
        total_bytes: u64,
    },
    /// A step that is not a plain download (installing the voice engine's libraries).
    Installing {
        step: String,
    },
    Ready,
    Error {
        message: String,
    },
}

/// The status of every pack, as the frontend gets it at start.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Packs {
    pub video: PackStatus,
    pub turbo: PackStatus,
    pub music: PackStatus,
    pub voice: PackStatus,
    pub inpaint: PackStatus,
    pub logo: PackStatus,
}

pub fn pack_root(models_dir: &Path, kind: PackKind) -> PathBuf {
    models_dir.join(kind.dir())
}

pub fn file_path(models_dir: &Path, kind: PackKind, f: &PackFile) -> PathBuf {
    pack_root(models_dir, f.home.unwrap_or(kind))
        .join(f.folder)
        .join(f.file)
}

/// Where a pack file is: the first of `roots` (the data folder's models folder first, then the user's `modelRoots`) that
/// holds it. Other roots are only read, never written.
pub fn find_file(roots: &[PathBuf], kind: PackKind, f: &PackFile) -> Option<PathBuf> {
    roots
        .iter()
        .map(|root| file_path(root, kind, f))
        .find(|p| p.is_file())
}

/// Whether every file of the pack is in one of `roots`.
pub fn is_installed_in(roots: &[PathBuf], kind: PackKind) -> bool {
    files(kind)
        .iter()
        .all(|f| find_file(roots, kind, f).is_some())
}

/// Whether every file of the pack is in the data folder's own models folder.
pub fn is_installed(models_dir: &Path, kind: PackKind) -> bool {
    is_installed_in(&[models_dir.to_path_buf()], kind)
}

/// `Ready` when every file is in one of `roots`, otherwise `Missing` with the size of what is not.
pub fn disk_status_in(roots: &[PathBuf], kind: PackKind) -> PackStatus {
    if is_installed_in(roots, kind) {
        PackStatus::Ready
    } else {
        PackStatus::Missing {
            total_bytes: files(kind)
                .iter()
                .filter(|f| find_file(roots, kind, f).is_none())
                .map(|f| f.approx_bytes)
                .sum(),
        }
    }
}

/// `Ready` when every file is in the data folder's models folder, otherwise `Missing`.
pub fn disk_status(models_dir: &Path, kind: PackKind) -> PackStatus {
    disk_status_in(&[models_dir.to_path_buf()], kind)
}

fn pack_ref(kind: PackKind, folder: &str) -> ComfyRef {
    let f = files(kind)
        .iter()
        .find(|f| f.folder == folder)
        .expect("pack file");
    ComfyRef {
        folder: f.folder.into(),
        name: f.file.into(),
    }
}

pub fn video_unet_ref() -> ComfyRef {
    pack_ref(PackKind::Video, "diffusion_models")
}

pub fn video_text_encoder_ref() -> ComfyRef {
    pack_ref(PackKind::Video, "text_encoders")
}

pub fn video_turbo_unet_ref() -> ComfyRef {
    pack_ref(PackKind::Turbo, "diffusion_models")
}

pub fn video_vae_ref() -> ComfyRef {
    pack_ref(PackKind::Video, "vae")
}

pub fn music_checkpoint_ref() -> ComfyRef {
    pack_ref(PackKind::Music, "checkpoints")
}

pub fn logo_unet_ref() -> ComfyRef {
    pack_ref(PackKind::Logo, "diffusion_models")
}

pub fn logo_text_encoder_ref() -> ComfyRef {
    pack_ref(PackKind::Logo, "text_encoders")
}

pub fn logo_vae_ref() -> ComfyRef {
    pack_ref(PackKind::Logo, "vae")
}

/// The `extra_model_paths.yaml` sections that let ComfyUI load the pack files.
pub fn extra_paths_yaml(models_dir: &Path) -> String {
    let mut out = String::new();
    for kind in PackKind::COMFY {
        out.push_str(&format!(
            "novira_{}:\n  base_path: '{}'\n",
            kind.dir(),
            pack_root(models_dir, kind)
                .to_string_lossy()
                .replace('\'', "''")
        ));
        let mut seen = Vec::new();
        for f in files(kind).iter().filter(|f| f.home.is_none()) {
            if !seen.contains(&f.folder) {
                seen.push(f.folder);
                out.push_str(&format!("  {}: {}\n", f.folder, f.folder));
            }
        }
    }
    out
}

/// The sections for every root: the data folder's (the first) as `extra_paths_yaml` writes them, then one section per pack
/// folder that exists in each further root (`novira_<kind>_<n>`, only its existing subfolders), so ComfyUI also loads packs
/// the user keeps in a shared model folder. Nothing is created in those roots.
pub fn extra_paths_yaml_in(roots: &[PathBuf]) -> String {
    let Some((own, shared)) = roots.split_first() else {
        return String::new();
    };
    let mut out = extra_paths_yaml(own);
    for (n, root) in shared.iter().enumerate() {
        for kind in PackKind::COMFY {
            let base = pack_root(root, kind);
            let mut folders: Vec<&str> = Vec::new();
            for f in files(kind).iter().filter(|f| f.home.is_none()) {
                if !folders.contains(&f.folder) && base.join(f.folder).is_dir() {
                    folders.push(f.folder);
                }
            }
            if folders.is_empty() {
                continue;
            }
            out.push_str(&format!(
                "novira_{}_{}:
  base_path: '{}'
",
                kind.dir(),
                n + 1,
                base.to_string_lossy().replace('\'', "''")
            ));
            for folder in folders {
                out.push_str(&format!(
                    "  {folder}: {folder}
"
                ));
            }
        }
    }
    out
}

/// Creates the pack folders (ComfyUI only lists folders that exist).
pub fn prepare_dirs(models_dir: &Path) -> std::io::Result<()> {
    for kind in PackKind::COMFY {
        for f in files(kind) {
            std::fs::create_dir_all(pack_root(models_dir, f.home.unwrap_or(kind)).join(f.folder))?;
        }
    }
    Ok(())
}

fn url_of(f: &PackFile) -> String {
    match f.url {
        Some(url) => url.to_string(),
        None => crate::endpoints::hf_resolve(f.repo, f.path),
    }
}

/// Downloads the missing files one after another; each is moved into place only when complete. `Err("cancelled")`
/// when stopped.
pub async fn install_files(
    http: &reqwest::Client,
    models_dir: &Path,
    kind: PackKind,
    cancel: &CancellationToken,
    status: &(dyn Fn(PackStatus) + Send + Sync),
) -> Result<(), String> {
    install_files_in(http, models_dir, &[], kind, cancel, status).await
}

/// Like `install_files`, and a file already in one of `read_roots` (the user's shared model folders) is not downloaded
/// again. Everything downloaded goes to `models_dir`; the other roots are never written.
pub async fn install_files_in(
    http: &reqwest::Client,
    models_dir: &Path,
    read_roots: &[PathBuf],
    kind: PackKind,
    cancel: &CancellationToken,
    status: &(dyn Fn(PackStatus) + Send + Sync),
) -> Result<(), String> {
    prepare_dirs(models_dir).map_err(|e| e.to_string())?;
    let downloads = pack_root(models_dir, kind).join(".downloads");
    std::fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;
    let list = files(kind);
    let count = list.len() as u32;
    for (i, f) in list.iter().enumerate() {
        let dest = file_path(models_dir, kind, f);
        if dest.is_file() || find_file(read_roots, kind, f).is_some() {
            continue;
        }
        let part = downloads.join(format!("{}.part", f.file));
        let mut last = Instant::now() - Duration::from_secs(1);
        let mut report = |bytes: u64, total: u64| {
            if last.elapsed() >= Duration::from_millis(500) {
                last = Instant::now();
                status(PackStatus::Downloading {
                    file: f.file.into(),
                    index: i as u32 + 1,
                    count,
                    bytes,
                    total_bytes: if total > 0 { total } else { f.approx_bytes },
                });
            }
        };
        download(http, &url_of(f), None, &part, cancel, &mut report)
            .await
            .map_err(|e| match e {
                InstallError::Cancelled => "cancelled".to_string(),
                InstallError::Failed(m) => m,
            })?;
        crate::models::install::rename_when_free(&part, &dest)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_all(dir: &Path, kind: PackKind) {
        for f in files(kind) {
            let p = file_path(dir, kind, f);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(&p, b"x").unwrap();
        }
    }

    #[test]
    fn missing_until_every_file_is_there() {
        let dir = tempfile::tempdir().unwrap();
        assert!(matches!(
            disk_status(dir.path(), PackKind::Video),
            PackStatus::Missing { total_bytes } if total_bytes > 17_000_000_000
        ));
        assert!(matches!(
            disk_status(dir.path(), PackKind::Music),
            PackStatus::Missing { total_bytes } if total_bytes > 9_000_000_000
        ));
        write_all(dir.path(), PackKind::Video);
        assert_eq!(disk_status(dir.path(), PackKind::Video), PackStatus::Ready);
        // One pack being there does not make another one ready.
        assert!(!is_installed(dir.path(), PackKind::Music));
        write_all(dir.path(), PackKind::Music);
        assert_eq!(disk_status(dir.path(), PackKind::Music), PackStatus::Ready);
    }

    #[test]
    fn comfy_sees_each_pack_through_its_own_yaml_section() {
        let yaml = extra_paths_yaml(Path::new("D:/data/models"));
        assert!(yaml.contains("novira_video:") && yaml.contains("novira_music:"));
        assert!(
            yaml.contains("D:/data/models") && yaml.contains("video") && yaml.contains("music")
        );
        assert!(yaml.contains("  diffusion_models: diffusion_models\n"));
        assert!(yaml.contains("  text_encoders: text_encoders\n"));
        assert!(yaml.contains("  vae: vae\n"));
        assert!(yaml.contains("  checkpoints: checkpoints\n"));
    }

    #[test]
    fn the_turbo_model_shares_the_video_packs_encoder_and_vae() {
        let dir = tempfile::tempdir().unwrap();
        let models = dir.path();
        // Only the shared files are there: the Turbo model itself is still missing.
        for f in VIDEO_FILES
            .iter()
            .filter(|f| f.folder != "diffusion_models")
        {
            let path = file_path(models, PackKind::Video, f);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, b"x").unwrap();
        }
        assert!(!is_installed(models, PackKind::Turbo));
        assert_eq!(
            disk_status(models, PackKind::Turbo),
            PackStatus::Missing {
                total_bytes: TURBO_FILES[0].approx_bytes
            }
        );
        let own = file_path(models, PackKind::Turbo, &TURBO_FILES[0]);
        std::fs::create_dir_all(own.parent().unwrap()).unwrap();
        std::fs::write(own, b"x").unwrap();
        assert!(is_installed(models, PackKind::Turbo));
        assert!(!is_installed(models, PackKind::Video));
        // ComfyUI finds the shared files through the video section, not a second copy.
        let yaml = extra_paths_yaml(models);
        let turbo = yaml
            .split("novira_turbo:")
            .nth(1)
            .unwrap()
            .split("novira_")
            .next()
            .unwrap();
        assert!(turbo.contains("diffusion_models") && !turbo.contains("text_encoders"));
    }

    #[test]
    fn the_logo_model_is_the_8_bit_build_with_its_own_folders() {
        let yaml = extra_paths_yaml(Path::new("D:/data/models"));
        let logo = yaml.split("novira_logo:").nth(1).unwrap();
        for folder in ["diffusion_models", "text_encoders", "vae"] {
            assert!(logo.contains(&format!("  {folder}: {folder}")), "{folder}");
        }
        assert!(LOGO_FILES
            .iter()
            .all(|f| url_of(f).starts_with("https://huggingface.co/")
                && f.file.ends_with(".safetensors")));
        assert_eq!(
            logo_text_encoder_ref().name,
            "qwen_3_4b_fp8_mixed.safetensors"
        );
        // The 8-bit files keep the pack near 12 GB; the bf16 ones were 21 GB.
        let total: u64 = LOGO_FILES.iter().map(|f| f.approx_bytes).sum();
        assert!((11_000_000_000..13_000_000_000).contains(&total), "{total}");
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_installed(dir.path(), PackKind::Logo));
        write_all(dir.path(), PackKind::Logo);
        assert!(dir
            .path()
            .join("logo/diffusion_models/z-image-turbo-fp8-e4m3fn.safetensors")
            .is_file());
        assert_eq!(disk_status(dir.path(), PackKind::Logo), PackStatus::Ready);
    }

    #[test]
    fn the_erase_model_has_its_own_folder_and_a_direct_address() {
        let yaml = extra_paths_yaml(Path::new("D:/data/models"));
        assert!(
            yaml.contains("novira_inpaint:")
                && yaml.contains(
                    "  inpaint: inpaint
"
                )
        );
        assert_eq!(
            url_of(&INPAINT_FILES[0]),
            "https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt"
        );
        assert!(url_of(&VIDEO_FILES[0]).starts_with("https://huggingface.co/Comfy-Org/"));
        let dir = tempfile::tempdir().unwrap();
        assert!(matches!(
            disk_status(dir.path(), PackKind::Inpaint),
            PackStatus::Missing { total_bytes } if total_bytes > 150_000_000 && total_bytes < 400_000_000
        ));
        write_all(dir.path(), PackKind::Inpaint);
        assert!(dir.path().join("inpaint/inpaint/big-lama.pt").is_file());
        assert_eq!(
            disk_status(dir.path(), PackKind::Inpaint),
            PackStatus::Ready
        );
    }

    #[test]
    fn refs_point_at_the_pack_files() {
        assert_eq!(video_unet_ref().folder, "diffusion_models");
        assert_eq!(video_text_encoder_ref().folder, "text_encoders");
        assert!(video_vae_ref().name.contains("wan2.2_vae"));
        assert!(music_checkpoint_ref().name.contains("ace_step"));
    }

    #[test]
    fn the_voice_engine_has_no_comfy_files() {
        assert!(files(PackKind::Voice).is_empty());
        let dir = tempfile::tempdir().unwrap();
        // With no files to wait for, the generic check reads "ready"; the voice engine reports its own state.
        assert!(is_installed(dir.path(), PackKind::Voice));
    }

    #[test]
    fn a_pack_in_a_shared_root_counts_and_its_files_are_found_there() {
        let own = tempfile::tempdir().unwrap();
        let shared = tempfile::tempdir().unwrap();
        let roots = [own.path().to_path_buf(), shared.path().to_path_buf()];
        assert!(!is_installed_in(&roots, PackKind::Music));
        write_all(shared.path(), PackKind::Music);
        assert!(is_installed_in(&roots, PackKind::Music));
        assert_eq!(disk_status_in(&roots, PackKind::Music), PackStatus::Ready);
        // The data folder alone still says missing: reading elsewhere is explicit.
        assert!(!is_installed(own.path(), PackKind::Music));
        let found = find_file(&roots, PackKind::Music, &MUSIC_FILES[0]).unwrap();
        assert!(found.starts_with(shared.path()));
        // The own folder wins when both hold the file.
        write_all(own.path(), PackKind::Music);
        let found = find_file(&roots, PackKind::Music, &MUSIC_FILES[0]).unwrap();
        assert!(found.starts_with(own.path()));
    }

    #[test]
    fn a_half_shared_pack_reports_only_what_is_missing_everywhere() {
        let own = tempfile::tempdir().unwrap();
        let shared = tempfile::tempdir().unwrap();
        let roots = [own.path().to_path_buf(), shared.path().to_path_buf()];
        // The video encoder is in the shared root, the VAE in the own one; the model itself is nowhere.
        let enc = file_path(shared.path(), PackKind::Video, &VIDEO_FILES[1]);
        std::fs::create_dir_all(enc.parent().unwrap()).unwrap();
        std::fs::write(enc, b"x").unwrap();
        let vae = file_path(own.path(), PackKind::Video, &VIDEO_FILES[2]);
        std::fs::create_dir_all(vae.parent().unwrap()).unwrap();
        std::fs::write(vae, b"x").unwrap();
        assert_eq!(
            disk_status_in(&roots, PackKind::Video),
            PackStatus::Missing {
                total_bytes: VIDEO_FILES[0].approx_bytes
            }
        );
    }

    #[test]
    fn comfy_gets_a_section_per_existing_pack_folder_of_a_shared_root_and_nothing_is_created_there()
    {
        let own = tempfile::tempdir().unwrap();
        let shared = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(shared.path().join("music/checkpoints")).unwrap();
        std::fs::create_dir_all(shared.path().join("video/vae")).unwrap();
        let before: Vec<_> = walk(shared.path());
        let yaml = extra_paths_yaml_in(&[own.path().to_path_buf(), shared.path().to_path_buf()]);
        // The own sections come first and are unchanged.
        assert!(yaml.starts_with(&extra_paths_yaml(own.path())));
        let music = yaml.split("novira_music_1:").nth(1).unwrap();
        let music = music.split("novira_").next().unwrap();
        assert!(
            music.contains("music")
                && music.contains(
                    "  checkpoints: checkpoints
"
                )
        );
        let video = yaml.split("novira_video_1:").nth(1).unwrap();
        let video = video.split("novira_").next().unwrap();
        assert!(
            video.contains(
                "  vae: vae
"
            ) && !video.contains("diffusion_models")
        );
        // A pack folder the shared root lacks gets no section; a root with no packs adds nothing.
        assert!(!yaml.contains("novira_logo_1") && !yaml.contains("novira_inpaint_1"));
        let none = tempfile::tempdir().unwrap();
        assert_eq!(
            extra_paths_yaml_in(&[own.path().to_path_buf(), none.path().to_path_buf()]),
            extra_paths_yaml(own.path())
        );
        assert_eq!(extra_paths_yaml_in(&[]), "");
        assert_eq!(before, walk(shared.path()));
    }

    fn walk(dir: &Path) -> Vec<PathBuf> {
        let mut out = Vec::new();
        for e in std::fs::read_dir(dir).unwrap().flatten() {
            out.push(e.path());
            if e.path().is_dir() {
                out.extend(walk(&e.path()));
            }
        }
        out.sort();
        out
    }

    #[test]
    fn kinds_serialize_in_snake_case() {
        assert_eq!(
            serde_json::to_string(&PackKind::Music).unwrap(),
            "\"music\""
        );
        let json = serde_json::to_value(PackStatus::Installing {
            step: "libs".into(),
        })
        .unwrap();
        assert_eq!(json["state"], "installing");
    }
}
