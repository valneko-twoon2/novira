//! Backend settings, read from `<data dir>/settings.json` (optional, never committed). Missing keys use the defaults.
use crate::types::{ComfyuiMode, ComfyuiPackage};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const SETTINGS_FILE: &str = "settings.json";
pub const GPU_LOCK_ENV: &str = "NOVIRA_GPU_LOCK";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Connect to an already running ComfyUI at this URL instead of novira's own copy. Leave unset to use
    /// the ComfyUI that novira downloads into its data folder and starts itself. With `comfyuiDir` also set, the
    /// URL is where that folder's ComfyUI is started when nothing answers there, so its host must be on this PC.
    pub comfyui_url: Option<String>,
    /// Use an existing local ComfyUI folder (the one holding `main.py`) instead of downloading one.
    /// novira starts it and stops it again on exit (on a free port of this PC, or at `comfyuiUrl` when that is set).
    pub comfyui_dir: Option<PathBuf>,
    /// Which ComfyUI portable package to download: `nvidia` (default) or `amd`.
    pub comfyui_package: String,
    /// Where novira's own ComfyUI is installed (owned mode); unset for `comfyui` in the data folder. Read at start.
    pub comfyui_install_dir: Option<PathBuf>,
    /// Python used to start ComfyUI. Defaults to the venv / embedded Python inside `comfyuiDir`.
    pub comfyui_python: Option<PathBuf>,
    /// Extra arguments for the owned ComfyUI process.
    pub comfyui_args: Vec<String>,
    /// Folders scanned for models. Both ComfyUI (`checkpoints`, `loras`, ...) and Stability Matrix
    /// (`StableDiffusion`, `Lora`, ...) layouts are recognized. novira's own `models/` folder is always included.
    pub model_roots: Vec<PathBuf>,
    /// GPU lock directory: "auto" (the `NOVIRA_GPU_LOCK` environment variable; no lock when it is unset), an explicit path, or "" to disable.
    pub gpu_lock: String,
    /// Optional Civitai API key used for searches and downloads that need an account.
    pub civitai_api_key: Option<String>,
    /// Look up each local model on Civitai by its file hash, for a picture and a license. Off by default: the hash of
    /// every model file is sent to Civitai. Read at start.
    pub civitai_lookup: bool,
    /// Seconds to wait for an owned ComfyUI to answer after starting it.
    pub comfyui_start_timeout_secs: u64,
    /// Start the owned ComfyUI in low-memory mode (`comfy::process::LOW_MEMORY_FLAG`): slower, but fits small GPUs.
    /// Set from the app (Settings, or after running out of memory).
    pub low_memory_mode: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            comfyui_url: None,
            comfyui_package: "nvidia".into(),
            comfyui_dir: None,
            comfyui_install_dir: None,
            comfyui_python: None,
            comfyui_args: Vec::new(),
            model_roots: Vec::new(),
            gpu_lock: "auto".into(),
            civitai_api_key: None,
            civitai_lookup: false,
            comfyui_start_timeout_secs: 180,
            low_memory_mode: false,
        }
    }
}

impl Settings {
    /// Reads `settings.json` from the data dir; a missing file gives the defaults, a broken one is an error.
    pub fn load(data_dir: &Path) -> Result<Self, String> {
        let path = data_dir.join(SETTINGS_FILE);
        match std::fs::read_to_string(&path) {
            Ok(text) => {
                serde_json::from_str(&text).map_err(|e| format!("invalid {SETTINGS_FILE}: {e}"))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(format!("cannot read {SETTINGS_FILE}: {e}")),
        }
    }

    /// Writes one key of `settings.json`, keeping every other key (and keys this version does not know) as it is.
    /// A missing file is created; a broken one is an error and is left untouched.
    pub fn save_key(data_dir: &Path, key: &str, value: serde_json::Value) -> Result<(), String> {
        let path = data_dir.join(SETTINGS_FILE);
        let mut doc = match std::fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str::<serde_json::Value>(&text)
                .map_err(|e| format!("invalid {SETTINGS_FILE}: {e}"))?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => serde_json::json!({}),
            Err(e) => return Err(format!("cannot read {SETTINGS_FILE}: {e}")),
        };
        let Some(map) = doc.as_object_mut() else {
            return Err(format!("invalid {SETTINGS_FILE}: not an object"));
        };
        map.insert(key.to_string(), value);
        let text = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
        // Write a sibling first and move it over, so a crash never leaves half a file.
        let temp = data_dir.join(format!("{SETTINGS_FILE}.tmp"));
        std::fs::write(&temp, text).map_err(|e| format!("cannot write {SETTINGS_FILE}: {e}"))?;
        std::fs::rename(&temp, &path).map_err(|e| format!("cannot write {SETTINGS_FILE}: {e}"))
    }

    /// The ComfyUI the app uses, from `comfyuiUrl` and `comfyuiDir`. The URL decides the address (and so the mode shown);
    /// a folder set with it is started there when nothing answers (`Backend::open`).
    pub fn comfyui_mode(&self) -> ComfyuiMode {
        match (&self.comfyui_url, &self.comfyui_dir) {
            (Some(_), _) => ComfyuiMode::Url,
            (None, Some(_)) => ComfyuiMode::Folder,
            (None, None) => ComfyuiMode::Owned,
        }
    }

    /// The folder novira's own ComfyUI is installed in: `comfyuiInstallDir`, else `comfyui` in the data folder.
    pub fn install_root(&self, data_dir: &Path) -> PathBuf {
        self.comfyui_install_dir
            .clone()
            .unwrap_or_else(|| data_dir.join("comfyui"))
    }

    /// The package as the wire shows it. A value the app does not know (only possible by editing the file) shows as
    /// the default, which is also what a check of the value would accept.
    pub fn package(&self) -> ComfyuiPackage {
        match self.comfyui_package.as_str() {
            "amd" => ComfyuiPackage::Amd,
            _ => ComfyuiPackage::Nvidia,
        }
    }

    /// The GPU lock directory, or `None` when locking is disabled.
    pub fn gpu_lock_path(&self) -> Option<PathBuf> {
        match self.gpu_lock.as_str() {
            "" => None,
            "auto" => std::env::var_os(GPU_LOCK_ENV)
                .filter(|p| !p.is_empty())
                .map(PathBuf::from),
            explicit => Some(PathBuf::from(explicit)),
        }
    }
}

/// The shortest and longest wait for an owned ComfyUI to answer that the app accepts (`comfyuiStartTimeoutSecs`).
pub const START_TIMEOUT_SECS: std::ops::RangeInclusive<u64> = 30..=1800;
/// The most extra model folders (`modelRoots`); each one is scanned at every start.
pub const MAX_MODEL_ROOTS: usize = 16;

/// `comfyuiPackage` must name a package the installer knows.
pub fn check_package(package: &str) -> Result<(), String> {
    match package {
        "nvidia" | "amd" => Ok(()),
        _ => Err("The ComfyUI package must be \"nvidia\" or \"amd\"".into()),
    }
}

/// `comfyuiStartTimeoutSecs` must be a whole number of seconds within `START_TIMEOUT_SECS`.
pub fn check_start_timeout(secs: u64) -> Result<(), String> {
    if START_TIMEOUT_SECS.contains(&secs) {
        Ok(())
    } else {
        Err(format!(
            "The ComfyUI start timeout must be {} to {} seconds",
            START_TIMEOUT_SECS.start(),
            START_TIMEOUT_SECS.end()
        ))
    }
}

/// Checks a folder chosen as an extra model folder against the saved ones: a plain absolute path of an existing
/// folder, not listed yet (compared after resolving it, and without case on Windows), outside the data folder, and
/// no more than `MAX_MODEL_ROOTS` in all.
pub fn check_new_model_root(root: &Path, saved: &[PathBuf], data_dir: &Path) -> Result<(), String> {
    if saved.len() >= MAX_MODEL_ROOTS {
        return Err(format!(
            "At most {MAX_MODEL_ROOTS} model folders can be added"
        ));
    }
    let text = root.to_string_lossy();
    if text.is_empty() || text.chars().any(char::is_control) {
        return Err("Not a folder path".into());
    }
    if !root.is_absolute() {
        return Err("The model folder must be a full path".into());
    }
    if root
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir) || is_device_prefix(&c))
    {
        return Err("Not a plain folder path".into());
    }
    match std::fs::metadata(root) {
        Ok(m) if m.is_dir() => {}
        Ok(_) => return Err("The model folder is not a folder".into()),
        Err(_) => return Err("The model folder does not exist".into()),
    }
    let key = path_key(root);
    let data = path_key(data_dir);
    if key == data || key.starts_with(&format!("{data}{}", std::path::MAIN_SEPARATOR)) {
        return Err("The model folder cannot be the data folder or inside it".into());
    }
    if saved.iter().any(|s| path_key(s) == key) {
        return Err("This model folder is already added".into());
    }
    Ok(())
}

/// Checks a folder chosen to install novira's ComfyUI in: a full, plain path that is not the data folder or a folder
/// holding it, and that is either empty (or new) or already holds a novira install, so nothing else is mixed into it.
pub fn check_install_dir(dir: &Path, data_dir: &Path) -> Result<(), String> {
    let text = dir.to_string_lossy();
    if text.is_empty() || text.chars().any(char::is_control) {
        return Err("Not a folder path".into());
    }
    if !dir.is_absolute() {
        return Err("The ComfyUI folder must be a full path".into());
    }
    if dir
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir) || is_device_prefix(&c))
    {
        return Err("Not a plain folder path".into());
    }
    if dir.parent().is_none() {
        return Err("A drive root cannot hold ComfyUI; make a folder in it".into());
    }
    let (key, data) = (path_key(dir), path_key(data_dir));
    let sep = std::path::MAIN_SEPARATOR;
    if key == data || data.starts_with(&format!("{key}{sep}")) {
        return Err("The ComfyUI folder cannot be the data folder or hold it".into());
    }
    match std::fs::metadata(dir) {
        Ok(m) if !m.is_dir() => return Err("The ComfyUI folder is not a folder".into()),
        Ok(_) => {
            let empty = std::fs::read_dir(dir)
                .map_err(|e| format!("Cannot read the folder: {e}"))?
                .next()
                .is_none();
            if !empty && !crate::comfy::install::is_installed(dir) {
                return Err(
                    "Choose an empty folder, or one that already holds novira's ComfyUI".into(),
                );
            }
        }
        Err(_) => {}
    }
    Ok(())
}

/// A device path (`\\.\...`) is not a folder the user picks.
fn is_device_prefix(c: &std::path::Component) -> bool {
    matches!(c, std::path::Component::Prefix(p) if matches!(p.kind(), std::path::Prefix::DeviceNS(_)))
}

/// A path in the form two paths are compared in: resolved when it exists (links, `.`, short names), without the
/// `\\?\` prefix that resolving adds, without a trailing separator, and in lower case on Windows.
fn path_key(path: &Path) -> String {
    let resolved = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let text = resolved.to_string_lossy();
    let text = text
        .strip_prefix(r"\\?\UNC\")
        .map(|rest| format!(r"\\{rest}"))
        .unwrap_or_else(|| text.strip_prefix(r"\\?\").unwrap_or(&text).to_string());
    let text = text.trim_end_matches(['/', '\\']).to_string();
    if cfg!(windows) {
        text.to_lowercase()
    } else {
        text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_gives_defaults() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(Settings::load(dir.path()).unwrap(), Settings::default());
    }

    #[test]
    fn partial_file_keeps_other_defaults() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join(SETTINGS_FILE),
            r#"{"comfyuiUrl":"http://127.0.0.1:9000","gpuLock":""}"#,
        )
        .unwrap();
        let s = Settings::load(dir.path()).unwrap();
        assert_eq!(s.comfyui_url.as_deref(), Some("http://127.0.0.1:9000"));
        assert_eq!(s.comfyui_package, "nvidia");
        assert_eq!(s.gpu_lock_path(), None);
        assert_eq!(s.comfyui_start_timeout_secs, 180);
    }

    #[test]
    fn saving_a_key_keeps_the_others() {
        let dir = tempfile::tempdir().unwrap();
        Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(true)).unwrap();
        assert!(Settings::load(dir.path()).unwrap().low_memory_mode);
        std::fs::write(
            dir.path().join(SETTINGS_FILE),
            r#"{"comfyuiArgs":["--fast"],"lowMemoryMode":true,"futureKey":1}"#,
        )
        .unwrap();
        Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(false)).unwrap();
        let text = std::fs::read_to_string(dir.path().join(SETTINGS_FILE)).unwrap();
        let doc: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(
            doc,
            serde_json::json!({ "comfyuiArgs": ["--fast"], "lowMemoryMode": false, "futureKey": 1 })
        );
        let s = Settings::load(dir.path()).unwrap();
        assert!(!s.low_memory_mode);
        assert_eq!(s.comfyui_args, ["--fast"]);
    }

    #[test]
    fn saving_into_a_broken_file_leaves_it_alone() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(SETTINGS_FILE), "{").unwrap();
        assert!(Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(true)).is_err());
        assert_eq!(
            std::fs::read_to_string(dir.path().join(SETTINGS_FILE)).unwrap(),
            "{"
        );
    }

    #[test]
    fn broken_file_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(SETTINGS_FILE), "{").unwrap();
        assert!(Settings::load(dir.path()).is_err());
    }

    #[test]
    fn the_mode_follows_the_url_then_the_folder() {
        let mut s = Settings::default();
        assert_eq!(s.comfyui_mode(), ComfyuiMode::Owned);
        s.comfyui_dir = Some(PathBuf::from("D:/ComfyUI"));
        assert_eq!(s.comfyui_mode(), ComfyuiMode::Folder);
        s.comfyui_url = Some("http://127.0.0.1:8188".into());
        assert_eq!(s.comfyui_mode(), ComfyuiMode::Url);
    }

    #[test]
    fn an_unknown_saved_package_shows_as_the_default() {
        let mut s = Settings::default();
        assert_eq!(s.package(), ComfyuiPackage::Nvidia);
        s.comfyui_package = "amd".into();
        assert_eq!(s.package(), ComfyuiPackage::Amd);
        s.comfyui_package = "intel".into();
        assert_eq!(s.package(), ComfyuiPackage::Nvidia);
    }

    #[test]
    fn only_the_known_packages_are_accepted() {
        assert!(check_package("nvidia").is_ok());
        assert!(check_package("amd").is_ok());
        for bad in [
            "",
            "NVIDIA",
            "Amd",
            "cpu",
            "nvidia ",
            "../nvidia",
            "nvidia\0",
            "amd\n",
        ] {
            assert!(check_package(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn the_start_timeout_is_kept_within_its_range() {
        for ok in [30, 31, 180, 1799, 1800] {
            assert!(check_start_timeout(ok).is_ok(), "{ok}");
        }
        for bad in [0, 29, 1801, u64::MAX] {
            let err = check_start_timeout(bad).unwrap_err();
            assert!(err.contains("30 to 1800"), "{err}");
        }
    }

    /// A data folder and two folders beside it, all real.
    fn folders() -> (tempfile::TempDir, PathBuf, PathBuf, PathBuf) {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let a = base.path().join("ModelsA");
        let b = base.path().join("ModelsB");
        for d in [&data, &a, &b] {
            std::fs::create_dir_all(d).unwrap();
        }
        (base, data, a, b)
    }

    #[test]
    fn a_new_existing_folder_is_accepted() {
        let (_base, data, a, b) = folders();
        assert!(check_new_model_root(&a, &[], &data).is_ok());
        assert!(check_new_model_root(&b, std::slice::from_ref(&a), &data).is_ok());
        // A folder whose name only starts like the data folder's is outside it.
        let near = data.with_file_name("novira-data-models");
        std::fs::create_dir_all(&near).unwrap();
        assert!(check_new_model_root(&near, &[], &data).is_ok());
    }

    #[test]
    fn a_folder_already_listed_is_refused_in_any_spelling() {
        let (_base, data, a, _b) = folders();
        let err = check_new_model_root(&a, std::slice::from_ref(&a), &data).unwrap_err();
        assert!(err.contains("already"), "{err}");
        let with_dot = a.join(".");
        assert!(check_new_model_root(&with_dot, std::slice::from_ref(&a), &data).is_err());
        let with_slash = PathBuf::from(format!("{}{}", a.display(), std::path::MAIN_SEPARATOR));
        assert!(check_new_model_root(&with_slash, std::slice::from_ref(&a), &data).is_err());
        if cfg!(windows) {
            let upper = PathBuf::from(a.to_string_lossy().to_uppercase());
            assert!(check_new_model_root(&upper, std::slice::from_ref(&a), &data).is_err());
        }
    }

    #[test]
    fn the_data_folder_and_folders_inside_it_are_refused() {
        let (_base, data, _a, _b) = folders();
        let inside = data.join("models");
        std::fs::create_dir_all(inside.join("loras")).unwrap();
        for bad in [data.clone(), inside.clone(), inside.join("loras")] {
            let err = check_new_model_root(&bad, &[], &data).unwrap_err();
            assert!(err.contains("data folder"), "{bad:?}: {err}");
        }
        if cfg!(windows) {
            let upper = PathBuf::from(inside.to_string_lossy().to_uppercase());
            assert!(check_new_model_root(&upper, &[], &data).is_err());
        }
    }

    #[test]
    fn paths_that_are_not_plain_existing_folders_are_refused() {
        let (base, data, a, _b) = folders();
        let file = base.path().join("model.safetensors");
        std::fs::write(&file, b"x").unwrap();
        let bad = [
            PathBuf::new(),
            PathBuf::from("models"),
            PathBuf::from(r"..\models"),
            PathBuf::from("%2e%2e"),
            a.join("..").join("ModelsB"),
            a.join("..").join("novira-data"),
            base.path().join("missing"),
            file,
            PathBuf::from(format!("{}\0", a.display())),
            PathBuf::from(format!("{}\n", a.display())),
        ];
        for path in bad {
            assert!(check_new_model_root(&path, &[], &data).is_err(), "{path:?}");
        }
    }

    #[cfg(windows)]
    #[test]
    fn windows_device_paths_are_refused() {
        let (_base, data, _a, _b) = folders();
        for path in [r"\\.\C:\Models", r"\\.\PhysicalDrive0"] {
            assert!(
                check_new_model_root(Path::new(path), &[], &data).is_err(),
                "{path}"
            );
        }
    }

    #[test]
    fn no_more_than_the_limit_of_folders() {
        let (base, data, a, _b) = folders();
        let saved: Vec<PathBuf> = (0..MAX_MODEL_ROOTS)
            .map(|i| base.path().join(format!("m{i}")))
            .collect();
        let err = check_new_model_root(&a, &saved, &data).unwrap_err();
        assert!(err.contains("16"), "{err}");
        assert!(check_new_model_root(&a, &saved[1..], &data).is_ok());
    }
}
