//! Windows path edge sets for the name and folder rules: reserved device names in every spelling, trailing dots and
//! spaces, alternate data streams, `\\?\` and UNC prefixes, drive-relative paths, mixed separators, names of 255 and
//! 256 characters, names equal up to case, look-alikes, right-to-left override and NUL. The rule under test is that a
//! name the app keeps stays one plain component inside its folder and never names a device. Pure functions and
//! temporary folders only; a folder check is never given a network path (a UNC lookup would reach the network).
//! Run: `cargo test -p novira-core --test prop_paths_windows`.
mod prop_common;

use novira_core::media::arrangement::{folder_names, safe_folder};
use novira_core::media::images::is_valid_name;
use novira_core::models::install::safe_file_name;
use novira_core::types::BoardDTO;
use novira_core::{is_reserved_device_name, plain_path};
use prop_common::{check, nasty_string};
use proptest::prelude::*;
use std::path::{Component, Path, PathBuf};

const DEVICES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$", "COM1", "COM2", "COM3", "COM4", "COM5",
    "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8",
    "LPT9",
];

/// A stricter statement than the code's: the part before the first dot or colon, spaces dropped, names a device
/// (Windows opens `NUL:stream` and `con.txt` as the device).
fn is_device(name: &str) -> bool {
    let stem = name
        .split(['.', ':'])
        .next()
        .unwrap_or("")
        .trim_end_matches(' ');
    let up = stem.to_ascii_uppercase();
    DEVICES.contains(&up.as_str())
}

fn one_plain_component(name: &str) -> bool {
    let mut parts = Path::new(name).components();
    matches!((parts.next(), parts.next()), (Some(Component::Normal(n)), None) if n == name)
}

/// A reserved name in any case mix, followed by something that Windows ignores or treats as a stream.
fn device_spelling() -> impl Strategy<Value = String> {
    (
        prop::sample::select(DEVICES),
        prop::collection::vec(any::<bool>(), 6),
        prop::sample::select(
            &[
                "",
                ".",
                "..",
                " ",
                ". ",
                " .",
                ".txt",
                ".tar.gz",
                " .x",
                ".png",
                ".safetensors",
                ".mp4",
                ".wav",
            ][..],
        ),
    )
        .prop_map(|(device, upper, tail)| {
            let cased: String = device
                .chars()
                .zip(upper.iter().cycle())
                .map(|(c, up)| {
                    if *up {
                        c.to_ascii_uppercase()
                    } else {
                        c.to_ascii_lowercase()
                    }
                })
                .collect();
            format!("{cased}{tail}")
        })
}

/// Pieces that matter on Windows, mixed with letters.
fn windows_text() -> impl Strategy<Value = String> {
    prop::collection::vec(
        prop_oneof![
            4 => prop::sample::select(&[
                "..", ".", "/", "\\", "\\\\?\\", "\\\\.\\", "\\\\?\\UNC\\", "C:", "C:x", ":stream", "::$DATA",
                ".", " ", "\u{202e}", "\u{ff23}\u{ff2f}\u{ff2e}", "\u{0}", "\u{200b}", "\u{3002}", "\u{ff0e}",
                "CON", "nul", "Com1", "lpt9", ".png", ".mp4", ".safetensors", ".gguf",
            ][..]).prop_map(str::to_string),
            2 => "[a-zA-Z0-9]{0,5}",
        ],
        0..8,
    )
    .prop_map(|parts| parts.concat())
}

fn any_name() -> impl Strategy<Value = String> {
    prop_oneof![windows_text(), device_spelling(), nasty_string()]
}

#[test]
fn every_spelling_of_a_device_name_is_refused_as_a_gallery_or_model_file_name() {
    check(device_spelling(), |name| {
        prop_assert!(!is_valid_name(&name), "{name:?}");
        prop_assert!(safe_file_name(&name).is_none(), "{name:?}");
        // Trailing spaces and a dot do not hide the device from the folder rule either.
        prop_assert!(!is_device(&safe_folder(&name)), "{name:?}");
        Ok(())
    });
}

#[test]
fn the_device_check_ignores_case_dots_and_trailing_spaces_and_not_longer_words() {
    for device in DEVICES {
        for name in [
            device.to_string(),
            device.to_lowercase(),
            format!("{device}.txt"),
            format!("{} .txt", device.to_lowercase()),
            format!("{device}.tar.gz"),
            format!("{device}   "),
        ] {
            assert!(is_reserved_device_name(&name), "{name:?}");
        }
        for name in [
            format!("{device}x"),
            format!("x{device}"),
            format!(".{device}"),
            format!(" {device}"),
        ] {
            assert!(!is_reserved_device_name(&name), "{name:?}");
        }
    }
    for name in [
        "COM0",
        "COM10",
        "LPT0",
        "COM",
        "LPT",
        "CONSOLE",
        "NULL",
        "AUXILIARY",
    ] {
        assert!(!is_reserved_device_name(name), "{name:?}");
    }
}

#[test]
fn a_device_name_with_a_stream_suffix_is_never_a_kept_name() {
    // The code's own check stops at the first dot, so `nul:s` is not a device to it; the callers refuse the colon first.
    for name in [
        "nul:stream",
        "NUL:s.png",
        "con.txt:stream",
        "aux::$DATA",
        "a.png:stream",
        "a.png::$DATA",
        "a.safetensors:stream",
        "COM1:",
    ] {
        assert!(!is_valid_name(name), "{name:?}");
        assert!(safe_file_name(name).is_none(), "{name:?}");
        let folder = safe_folder(name);
        assert!(!folder.contains(':') && !is_device(&folder), "{folder:?}");
    }
}

#[test]
fn an_accepted_gallery_or_model_name_is_one_plain_component_and_not_a_device() {
    check(any_name(), |name| {
        if is_valid_name(&name) {
            prop_assert!(one_plain_component(&name) && !is_device(&name), "{name:?}");
            prop_assert!(!name.contains([':', '\\', '/', '\0']));
            prop_assert!(
                name.is_ascii(),
                "a look-alike character was accepted: {name:?}"
            );
        }
        if let Some(kept) = safe_file_name(&name) {
            prop_assert!(one_plain_component(&kept) && !is_device(&kept), "{kept:?}");
            prop_assert!(!kept.ends_with(['.', ' ']), "{kept:?}");
            prop_assert!(!kept.contains(['\0', ':', '\\', '/']), "{kept:?}");
            let base = Path::new("models");
            prop_assert!(base.join(&kept).starts_with(base));
            prop_assert_eq!(kept.trim(), kept.as_str());
        }
        Ok(())
    });
}

#[test]
fn the_length_limits_are_exact_at_the_edge() {
    // Gallery names: 80 bytes is the most; model file names: 200.
    let gallery = |len: usize| format!("{}.png", "a".repeat(len - 4));
    assert!(is_valid_name(&gallery(80)));
    assert!(!is_valid_name(&gallery(81)));
    assert!(!is_valid_name(&gallery(255)));
    assert!(!is_valid_name(&gallery(256)));
    let model = |len: usize| format!("{}.safetensors", "a".repeat(len - 12));
    assert!(safe_file_name(&model(200)).is_some());
    assert!(safe_file_name(&model(201)).is_none());
    assert!(safe_file_name(&model(255)).is_none());
    assert!(safe_file_name(&model(256)).is_none());
}

#[test]
fn a_folder_made_from_a_name_is_short_plain_and_not_a_device_for_any_name() {
    check(any_name(), |name| {
        let folder = safe_folder(&name);
        prop_assert!(
            !folder.is_empty() && folder.chars().count() <= 60 + 1,
            "{folder:?}"
        );
        prop_assert!(one_plain_component(&folder), "{name:?} -> {folder:?}");
        prop_assert!(!is_device(&folder), "{name:?} -> {folder:?}");
        prop_assert!(!folder.ends_with(['.', ' ']), "{folder:?}");
        prop_assert!(
            !folder.starts_with('.') && folder.trim() == folder,
            "{folder:?}"
        );
        prop_assert!(
            !folder.contains(['<', '>', ':', '"', '/', '\\', '|', '?', '*']),
            "{folder:?}"
        );
        prop_assert!(!folder.chars().any(char::is_control), "{folder:?}");
        let base = Path::new("outputs");
        prop_assert!(base.join(&folder).starts_with(base));
        // Making a folder name again from a folder name changes nothing.
        prop_assert_eq!(safe_folder(&folder), folder);
        Ok(())
    });
}

#[test]
fn folders_of_boards_stay_inside_outputs_and_differ_even_when_the_names_differ_only_in_case() {
    let board = |i: usize, name: String, parent: Option<usize>| BoardDTO {
        id: format!("b{i}"),
        name,
        archived: false,
        created_at: i as i64,
        parent_id: parent.map(|p| format!("b{p}")),
    };
    check(
        prop::collection::vec(
            (
                prop_oneof![
                    any_name(),
                    Just("Pics".to_string()),
                    Just("pics".to_string()),
                    Just("PICS ".to_string())
                ],
                prop::option::of(0usize..6),
            ),
            1..7,
        ),
        |named| {
            let boards: Vec<BoardDTO> = named
                .iter()
                .enumerate()
                .map(|(i, (n, p))| board(i, n.clone(), p.filter(|p| *p < i)))
                .collect();
            let folders = folder_names(&boards);
            prop_assert_eq!(folders.len(), boards.len());
            let mut tops = std::collections::HashSet::new();
            for b in &boards {
                let path = &folders[&b.id];
                let outputs = Path::new("outputs");
                prop_assert!(outputs.join(path).starts_with(outputs));
                let mut depth = 0;
                for part in path.split('/') {
                    depth += 1;
                    prop_assert!(one_plain_component(part) && !is_device(part), "{path:?}");
                }
                prop_assert!(depth <= boards.len(), "{path:?}");
                if depth == 1 {
                    prop_assert!(
                        tops.insert(path.to_lowercase()),
                        "two top folders equal up to case: {path:?}"
                    );
                }
            }
            Ok(())
        },
    );
}

#[test]
fn plain_path_drops_only_the_verbatim_drive_prefix_and_keeps_unc_and_everything_else() {
    check(
        prop_oneof![
            windows_text().prop_map(PathBuf::from),
            windows_text().prop_map(|t| PathBuf::from(format!("\\\\?\\C:\\{t}"))),
            windows_text().prop_map(|t| PathBuf::from(format!("\\\\?\\UNC\\srv\\share\\{t}"))),
        ],
        |path| {
            let text = path.to_string_lossy().to_string();
            let out = plain_path(path.clone());
            let out_text = out.to_string_lossy().to_string();
            if text.starts_with("\\\\?\\UNC\\") || !text.starts_with("\\\\?\\") {
                prop_assert_eq!(&out_text, &text);
            } else {
                prop_assert_eq!(out_text.as_str(), &text[4..]);
            }
            // Applying it again changes nothing, unless the rest itself began with another `\\?\` (which is
            // the same rule applied once more).
            if !text.starts_with("\\\\?\\\\\\?\\") {
                prop_assert_eq!(plain_path(out.clone()), out);
            }
            Ok(())
        },
    );
}

#[cfg(windows)]
mod folder_checks {
    use super::*;
    use novira_core::settings::{check_install_dir, check_new_model_root};

    /// Bases on the local `C:` drive that do not exist, so the checks refuse or accept on the text alone.
    fn candidate() -> impl Strategy<Value = PathBuf> {
        (
            prop::sample::select(
                &[
                    "C:\\novira-prop-none\\",
                    "C:/novira-prop-none/",
                    "C:\\novira-prop-none/",
                    "\\\\?\\C:\\novira-prop-none\\",
                    "\\\\.\\C:\\novira-prop-none\\",
                    "\\\\.\\",
                    "C:",
                    "C:novira-prop-none\\",
                    "\\novira-prop-none\\",
                    "novira-prop-none\\",
                    "",
                ][..],
            ),
            windows_text(),
        )
            .prop_map(|(base, rest)| PathBuf::from(format!("{base}{rest}")))
    }

    fn is_plain_full(path: &Path) -> bool {
        path.is_absolute()
            && !path.components().any(|c| {
                matches!(c, Component::ParentDir)
                    || matches!(c, Component::Prefix(p) if matches!(p.kind(), std::path::Prefix::DeviceNS(_)))
            })
            && !path.to_string_lossy().chars().any(char::is_control)
    }

    #[test]
    fn a_folder_the_checks_accept_is_a_full_plain_path_outside_the_data_folder() {
        let data = tempfile::tempdir().unwrap();
        check(candidate(), |path| {
            for result in [
                check_install_dir(&path, data.path()),
                check_new_model_root(&path, &[], data.path()),
            ] {
                if result.is_ok() {
                    prop_assert!(is_plain_full(&path), "accepted {path:?}");
                    prop_assert!(!path.starts_with(data.path()), "{path:?}");
                }
            }
            Ok(())
        });
    }

    #[test]
    fn device_drive_relative_rooted_and_parent_paths_are_refused() {
        let data = tempfile::tempdir().unwrap();
        for text in [
            "\\\\.\\C:\\x",
            "\\\\.\\NUL",
            "\\\\.\\PhysicalDrive0",
            "C:x",
            "C:",
            "\\x",
            "x\\y",
            "C:\\a\\..\\b",
            "C:/a/../b",
            "C:\\a\u{0}b",
            "C:\\a\nb",
            "",
        ] {
            let path = Path::new(text);
            assert!(check_install_dir(path, data.path()).is_err(), "{text:?}");
            assert!(
                check_new_model_root(path, &[], data.path()).is_err(),
                "{text:?}"
            );
        }
    }

    #[test]
    fn a_folder_inside_the_data_folder_is_refused_in_any_case_and_with_mixed_separators() {
        let data = tempfile::tempdir().unwrap();
        let inside = data.path().join("models");
        std::fs::create_dir_all(&inside).unwrap();
        let text = inside.to_string_lossy().to_string();
        for spelling in [
            text.to_uppercase(),
            text.to_lowercase(),
            text.replace('\\', "/"),
            format!("{text}\\"),
            format!("{text}\\."),
        ] {
            let path = PathBuf::from(&spelling);
            assert!(
                check_new_model_root(&path, &[], data.path()).is_err(),
                "{spelling:?}"
            );
        }
    }
}
