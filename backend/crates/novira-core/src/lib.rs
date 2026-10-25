//! novira backend core. Everything here runs without Tauri so it can be tested as a plain library;
//! `backend/src-tauri` only wires these calls to IPC commands, events and the image URL scheme.
pub mod agent;
pub mod api;
pub mod applog;
pub mod backup;
pub mod child_job;
pub mod comfy;
pub mod db;
pub mod endpoints;
pub mod engine;
pub mod fonts;
pub mod gpu_lock;
pub mod hardware;
pub mod image_serve;
pub mod media;
pub mod models;
pub mod packs;
pub mod provenance;
pub mod secret;
pub mod service;
pub mod settings;
pub mod startup;
pub mod sync;
mod test_timing;
pub mod types;
pub mod unfinished;
pub mod voice;

pub use service::{Backend, BackendConfig, BackendError, EventSink};
pub use settings::Settings;

/// Whether a file name is a Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, `CONIN$`,
/// `CONOUT$`). The part before the first dot decides, in any case and with trailing spaces ignored, so `nul.png` and
/// `Con.tar.gz` are devices too: opening them writes to the device, not to a file.
pub fn is_reserved_device_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").trim_end_matches(' ');
    let up = stem.to_ascii_uppercase();
    matches!(
        up.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ((up.starts_with("COM") || up.starts_with("LPT"))
        && up.len() == 4
        && matches!(up.as_bytes()[3], b'1'..=b'9'))
}

/// A path without Windows' `\\?\` prefix, which `canonicalize` adds. Python tools that get such a path as their
/// temporary folder join it with `/` and fail (`[WinError 123]`), because Windows does not normalise a `\\?\` path.
pub fn plain_path(path: std::path::PathBuf) -> std::path::PathBuf {
    match path.to_str().and_then(|s| s.strip_prefix(r"\\?\")) {
        // `\\?\UNC\server\share` is a network path and keeps its prefix; only a drive path is made plain.
        Some(rest) if !rest.starts_with("UNC\\") => std::path::PathBuf::from(rest),
        _ => path,
    }
}

#[cfg(test)]
mod tests {
    use super::{is_reserved_device_name, plain_path};
    use std::path::PathBuf;

    #[test]
    fn device_names_are_found_by_the_part_before_the_first_dot() {
        for name in [
            "nul",
            "NUL.png",
            "Con.tar.gz",
            "com1.wav",
            "LPT9",
            "aux .x",
            "CONIN$",
            "prn.safetensors",
        ] {
            assert!(is_reserved_device_name(name), "{name}");
        }
        for name in [
            "console.png",
            "com0.png",
            "com10.png",
            "lpt.png",
            "a.nul",
            "nu.png",
            "",
            ".nul",
            "x.png",
        ] {
            assert!(!is_reserved_device_name(name), "{name}");
        }
    }

    #[test]
    fn plain_path_drops_the_verbatim_prefix_of_a_drive_path_only() {
        assert_eq!(
            plain_path(PathBuf::from(r"\\?\E:\Code\novira")),
            PathBuf::from(r"E:\Code\novira")
        );
        assert_eq!(
            plain_path(PathBuf::from(r"E:\Code\novira")),
            PathBuf::from(r"E:\Code\novira")
        );
        assert_eq!(
            plain_path(PathBuf::from(r"\\?\UNC\nas\share")),
            PathBuf::from(r"\\?\UNC\nas\share")
        );
        assert_eq!(plain_path(PathBuf::from("data")), PathBuf::from("data"));
    }
}
