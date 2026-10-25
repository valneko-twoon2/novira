//! Unfinished downloads: the partial files an interrupted download leaves in novira's download folders (`<name>.part`,
//! with its `<name>.part.resume` record). Settings → Data lists them and deletes the ones picked. Only files in those
//! folders are listed, and a delete removes only an entry the listing holds: the paths the caller sends are compared
//! with the listing, never joined to the data folder. A download that is running keeps its part (`hold`).
use crate::sync::LockExt;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// The most paths one delete may name.
pub const MAX_PICKED: usize = 1000;
/// The longest path a delete accepts (the listed paths are far shorter).
const MAX_PATH_LEN: usize = 512;

const PART: &str = ".part";
const RECORD: &str = ".resume";
/// How deep under `models/` the `.downloads` folders are looked for: `models/.downloads` (models),
/// `models/<pack>/.downloads` (packs) and `models/voice/<model>/.downloads` (voice).
const MODEL_DEPTH: usize = 4;

/// One unfinished download as the list shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnfinishedDownload {
    /// Relative to the data folder, `/`-separated. A delete names the download by this value.
    pub path: String,
    /// The file name, e.g. `comfyui.part`.
    pub name: String,
    /// Bytes kept so far (0 for a record whose partial file is gone).
    pub bytes: u64,
}

/// A listed entry: what the list shows, the file itself (the partial file, or a record without one) and the partial
/// file it belongs to.
struct Found {
    item: UnfinishedDownload,
    file: PathBuf,
    part: PathBuf,
}

/// The unfinished downloads in the data folder, sorted by path.
pub fn list(data_dir: &Path) -> Vec<UnfinishedDownload> {
    let mut items: Vec<UnfinishedDownload> = scan(data_dir).into_iter().map(|f| f.item).collect();
    items.sort_by(|a, b| a.path.cmp(&b.path));
    items
}

/// Deletes the listed entries named in `paths`, with their records, and returns the list that is left. A path the
/// listing does not hold is ignored, and so is a download running now: its part is held (see `hold`).
pub fn delete(data_dir: &Path, paths: &[String]) -> Vec<UnfinishedDownload> {
    for found in scan(data_dir) {
        if !paths.contains(&found.item.path) || is_held(&found.part) {
            continue;
        }
        // The record goes only with its partial file: a file that cannot be removed (another program has it) keeps both.
        if std::fs::remove_file(&found.file).is_ok() && found.file != record_of(&found.part) {
            let _ = std::fs::remove_file(record_of(&found.part));
        }
    }
    list(data_dir)
}

/// Checks the paths a delete names: at most `MAX_PICKED`, each non-empty, short and without control characters.
pub fn check_picked(paths: &[String]) -> Result<(), String> {
    if paths.len() > MAX_PICKED {
        return Err(format!(
            "At most {MAX_PICKED} unfinished downloads can be deleted at once"
        ));
    }
    if paths
        .iter()
        .any(|p| p.is_empty() || p.len() > MAX_PATH_LEN || p.chars().any(char::is_control))
    {
        return Err("Not an unfinished download path".into());
    }
    Ok(())
}

/// Every unfinished download now, with the file it is and the partial file it belongs to.
fn scan(data_dir: &Path) -> Vec<Found> {
    let mut found = Vec::new();
    for folder in download_folders(data_dir) {
        let Ok(entries) = std::fs::read_dir(&folder) else {
            continue;
        };
        for entry in entries.flatten() {
            if !entry.file_type().is_ok_and(|t| t.is_file()) {
                continue;
            }
            let file = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            let (part, bytes) = if name.ends_with(PART) {
                let bytes = entry.metadata().map_or(0, |m| m.len());
                (file.clone(), bytes)
            } else if let Some(stem) = name.strip_suffix(RECORD) {
                // A record is listed only when its partial file is gone; the partial file's own entry covers it otherwise.
                let part = file.with_file_name(stem);
                if part.is_file() {
                    continue;
                }
                (part, 0)
            } else {
                continue;
            };
            let Some(path) = relative(data_dir, &file) else {
                continue;
            };
            found.push(Found {
                item: UnfinishedDownload { path, name, bytes },
                file,
                part,
            });
        }
    }
    found
}

/// The folders novira downloads into, under the data folder.
fn download_folders(data_dir: &Path) -> Vec<PathBuf> {
    let mut folders = vec![
        data_dir.join("comfyui").join(".downloads"),
        data_dir.join("comfyui").join(".tools"),
        crate::provenance::files::download_dir(data_dir),
    ];
    find_downloads(&data_dir.join("models"), 0, &mut folders);
    folders.sort();
    folders.dedup();
    folders
}

/// Adds every `.downloads` folder under `dir` that is at most `MODEL_DEPTH` levels down. Links are not followed.
fn find_downloads(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if !entry.file_type().is_ok_and(|t| t.is_dir()) {
            continue;
        }
        if entry.file_name() == ".downloads" {
            out.push(entry.path());
        } else if depth + 1 < MODEL_DEPTH {
            find_downloads(&entry.path(), depth + 1, out);
        }
    }
}

/// `path` relative to `data_dir`, with `/` between the parts.
fn relative(data_dir: &Path, path: &Path) -> Option<String> {
    let rest = path.strip_prefix(data_dir).ok()?;
    let parts: Vec<String> = rest
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    Some(parts.join("/"))
}

/// The record beside a partial file: the same path with `.resume` added (as `models::install` writes it).
fn record_of(part: &Path) -> PathBuf {
    let mut name = part.as_os_str().to_os_string();
    name.push(RECORD);
    PathBuf::from(name)
}

/// The partial files of the downloads running now, by `key`.
static HELD: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Holds `part` while a download writes it, so a delete keeps it. The hold ends when the guard is dropped.
pub fn hold(part: &Path) -> Hold {
    let key = key(part);
    HELD.lock_safe().push(key.clone());
    Hold(key)
}

/// A partial file held by a running download (see `hold`).
pub struct Hold(String);

impl Drop for Hold {
    fn drop(&mut self) {
        let mut held = HELD.lock_safe();
        if let Some(i) = held.iter().position(|k| *k == self.0) {
            held.swap_remove(i);
        }
    }
}

fn is_held(part: &Path) -> bool {
    let key = key(part);
    HELD.lock_safe().contains(&key)
}

/// The path as its parts, lower-cased (Windows paths do not differ by case, and a wrongly matched file is only kept),
/// so that `/` and `\` spellings of one path give one key.
fn key(part: &Path) -> String {
    part.components()
        .map(|c| c.as_os_str().to_string_lossy().to_lowercase())
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path, bytes: usize) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, vec![0u8; bytes]).unwrap();
    }

    /// A data folder with partial files in each download folder, and files that are not unfinished.
    fn data() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let d = dir.path();
        write(&d.join("comfyui/.downloads/comfyui.part"), 10);
        write(&d.join("comfyui/.downloads/comfyui.part.resume"), 2);
        // A finished archive kept for a retry, and a file outside every download folder.
        write(&d.join("comfyui/.downloads/comfyui.7z"), 5);
        write(&d.join("comfyui/ComfyUI/notes.part"), 1);
        write(&d.join("comfyui/.tools/7zr.part"), 3);
        write(&d.join("models/.downloads/abc.part"), 7);
        write(&d.join("models/Video/.downloads/wan.part"), 4);
        write(&d.join("models/voice/custom/.downloads/1.part"), 6);
        write(&d.join("models/trustmark/encoder_P.onnx.part"), 8);
        // A finished model, not in a download folder.
        write(&d.join("models/sdxl.safetensors"), 9);
        dir
    }

    fn paths(items: &[UnfinishedDownload]) -> Vec<&str> {
        items.iter().map(|i| i.path.as_str()).collect()
    }

    #[test]
    fn lists_the_partial_files_of_every_download_folder() {
        let dir = data();
        let items = list(dir.path());
        assert_eq!(
            paths(&items),
            [
                "comfyui/.downloads/comfyui.part",
                "comfyui/.tools/7zr.part",
                "models/.downloads/abc.part",
                "models/Video/.downloads/wan.part",
                "models/trustmark/encoder_P.onnx.part",
                "models/voice/custom/.downloads/1.part",
            ]
        );
        assert_eq!(items[0].name, "comfyui.part");
        assert_eq!(items[0].bytes, 10);
    }

    #[test]
    fn a_record_is_listed_only_when_its_partial_file_is_gone() {
        let dir = tempfile::tempdir().unwrap();
        write(&dir.path().join("models/.downloads/gone.part.resume"), 2);
        let items = list(dir.path());
        assert_eq!(paths(&items), ["models/.downloads/gone.part.resume"]);
        assert_eq!(items[0].bytes, 0);
        assert!(delete(dir.path(), &[items[0].path.clone()]).is_empty());
        assert!(!dir
            .path()
            .join("models/.downloads/gone.part.resume")
            .exists());
    }

    #[test]
    fn a_delete_removes_the_picked_partial_file_and_its_record_only() {
        let dir = data();
        let d = dir.path();
        let left = delete(d, &["comfyui/.downloads/comfyui.part".into()]);
        assert_eq!(left.len(), 5);
        assert!(!d.join("comfyui/.downloads/comfyui.part").exists());
        assert!(!d.join("comfyui/.downloads/comfyui.part.resume").exists());
        assert!(d.join("comfyui/.downloads/comfyui.7z").exists());
        assert!(d.join("comfyui/ComfyUI/notes.part").exists());
        assert!(d.join("models/.downloads/abc.part").exists());
    }

    #[test]
    fn paths_the_listing_does_not_hold_are_ignored() {
        let dir = data();
        let d = dir.path();
        let before = list(d);
        let asked: Vec<String> = [
            "../comfyui/ComfyUI/notes.part",
            "models/sdxl.safetensors",
            "comfyui/.downloads/comfyui.7z",
            "comfyui\\.downloads\\comfyui.part",
            "/comfyui/.downloads/comfyui.part",
        ]
        .map(String::from)
        .into();
        assert_eq!(delete(d, &asked), before);
        assert!(d.join("comfyui/ComfyUI/notes.part").exists());
        assert!(d.join("models/sdxl.safetensors").exists());
        assert!(d.join("comfyui/.downloads/comfyui.7z").exists());
    }

    #[test]
    fn a_held_partial_file_is_kept_until_the_hold_ends() {
        let dir = data();
        let d = dir.path();
        let part = d.join("models/.downloads/abc.part");
        let hold = hold(&part);
        let left = delete(d, &["models/.downloads/abc.part".into()]);
        assert!(part.exists());
        assert!(paths(&left).contains(&"models/.downloads/abc.part"));
        drop(hold);
        delete(d, &["models/.downloads/abc.part".into()]);
        assert!(!part.exists());
    }

    #[test]
    fn the_number_and_the_shape_of_picked_paths_are_checked() {
        assert!(check_picked(&["comfyui/.downloads/comfyui.part".into()]).is_ok());
        assert!(check_picked(&vec!["a.part".to_string(); MAX_PICKED]).is_ok());
        assert!(check_picked(&vec!["a.part".to_string(); MAX_PICKED + 1]).is_err());
        assert!(check_picked(&[String::new()]).is_err());
        assert!(check_picked(&["x".repeat(MAX_PATH_LEN + 1)]).is_err());
        assert!(check_picked(&["a\nb.part".into()]).is_err());
    }
}
