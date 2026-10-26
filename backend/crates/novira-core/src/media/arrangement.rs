//! Where each gallery file sits under `outputs/`, so the folder reads well in Explorer: one folder per board (named
//! after it), one for uncategorized pictures and one for drafts and other pictures the gallery does not show, each file
//! named `<YYYYMMDD_HHMMSS>_<name>` from when it was made. The name stays whole in the file name, so a file is found
//! again by its name wherever it is (`ImageFiles::index`). Only the place on disk changes: the gallery, its addresses
//! and backups still know a picture by its name.
use crate::media::images::ImageFiles;
use crate::types::{BoardDTO, ImageDTO};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

/// The folder of pictures on no board.
pub const UNCATEGORIZED: &str = "未分類";
/// The folder of pictures the gallery does not show: drafts, the canvas's work, masks.
pub const DRAFTS: &str = "_下書き";
/// Longest folder name taken from a board name, in characters.
const MAX_FOLDER_CHARS: usize = 60;

/// A board name as a folder name Windows accepts: no `<>:"/\|?*` or control characters, no dot or space at the end,
/// not a reserved device name, not empty and not too long.
pub fn safe_folder(name: &str) -> String {
    let replaced: String = name
        .chars()
        .map(|c| {
            if c.is_control() || "<>:\"/\\|?*".contains(c) {
                '_'
            } else {
                c
            }
        })
        .take(MAX_FOLDER_CHARS)
        .collect();
    let trimmed = replaced.trim().trim_end_matches(['.', ' ']).to_string();
    if trimmed.is_empty() || trimmed.chars().all(|c| c == '.') {
        return "_".into();
    }
    if trimmed.starts_with('.') || crate::is_reserved_device_name(&trimmed) {
        return format!("_{trimmed}");
    }
    trimmed
}

/// The folder of each board, by id. Two boards whose names make the same folder (or a board named like the uncategorized
/// or drafts folder) are told apart by " (2)", " (3)" and so on, the older board keeping the plain name.
pub fn folder_names(boards: &[BoardDTO]) -> HashMap<String, String> {
    let mut taken: HashSet<String> = [UNCATEGORIZED, DRAFTS]
        .iter()
        .map(|n| n.to_lowercase())
        .collect();
    let mut ordered: Vec<&BoardDTO> = boards.iter().collect();
    ordered.sort_by(|a, b| {
        a.created_at
            .cmp(&b.created_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    let mut out = HashMap::new();
    for board in ordered {
        let base = safe_folder(&board.name);
        let mut folder = base.clone();
        let mut n = 2;
        while taken.contains(&folder.to_lowercase()) {
            folder = format!("{base} ({n})");
            n += 1;
        }
        taken.insert(folder.to_lowercase());
        out.insert(board.id.clone(), folder);
    }
    out
}

/// `<YYYYMMDD_HHMMSS>_<name>`, in local time.
pub fn file_name(name: &str, created_at_ms: i64) -> String {
    use chrono::TimeZone;
    let stamp = chrono::Local
        .timestamp_millis_opt(created_at_ms)
        .earliest()
        .map(|t| t.format("%Y%m%d_%H%M%S").to_string())
        .unwrap_or_else(|| "00000000_000000".into());
    format!("{stamp}_{name}")
}

/// The name a file of `outputs/` holds: the file name itself (as an older version stored it) or what follows the time.
pub fn name_in(file_name: &str) -> Option<&str> {
    let bytes = file_name.as_bytes();
    let stamped = bytes.len() > 16
        && bytes[..8].iter().all(u8::is_ascii_digit)
        && bytes[8] == b'_'
        && bytes[9..15].iter().all(u8::is_ascii_digit)
        && bytes[15] == b'_';
    let name = if stamped { &file_name[16..] } else { file_name };
    crate::media::images::is_valid_name(name).then_some(name)
}

/// Where a picture's file belongs under `outputs/`.
pub fn place_of(image: &ImageDTO, folders: &HashMap<String, String>) -> PathBuf {
    let folder = if image.is_intermediate {
        DRAFTS
    } else {
        image
            .board_id
            .as_ref()
            .and_then(|id| folders.get(id))
            .map_or(UNCATEGORIZED, String::as_str)
    };
    PathBuf::from(folder).join(file_name(&image.name, image.created_at))
}

/// Moves each picture's file to where it belongs (only those not there yet), then removes folders left empty. A file
/// that cannot be moved stays where it is and still opens.
pub fn arrange<'a>(
    files: &ImageFiles,
    boards: &[BoardDTO],
    pictures: impl IntoIterator<Item = &'a ImageDTO>,
) {
    let folders = folder_names(boards);
    let mut moved = false;
    for image in pictures {
        match files.move_to(&image.name, &place_of(image, &folders)) {
            Ok(true) => moved = true,
            Ok(false) => {}
            Err(e) => crate::applog::warn(
                "gallery",
                format!("{} was not moved into its folder: {e}", image.name),
            ),
        }
    }
    if moved {
        files.remove_empty_folders();
    }
}

#[cfg(test)]
mod tests;
