//! Property tests for what the backend reads from the machine and from the user's choices of folders: the graphics-card
//! parsers, the settings validators, the data-folder checks and the pack file layout. Generated hostile input must never
//! panic, and what a check accepts must have the shape the rest of the app relies on. Temporary folders only; no network.
//! Run: `cargo test -p novira-core --test prop_machine`.
mod prop_common;

use novira_core::data_location::{self, Location};
use novira_core::hardware::{parse_adapters, parse_nvidia_smi};
use novira_core::packs::{disk_status_in, file_path, files, pack_root, PackKind, PackStatus};
use novira_core::settings::{
    check_install_dir, check_new_model_root, check_package, check_start_timeout, MAX_MODEL_ROOTS,
    START_TIMEOUT_SECS,
};
use prop_common::{any_text, check, check_up_to, nasty_string};
use proptest::prelude::*;
use std::path::{Component, Path, PathBuf};

fn kind() -> impl Strategy<Value = PackKind> {
    prop::sample::select(&PackKind::ALL[..])
}

fn has_parent_dir(p: &Path) -> bool {
    p.components().any(|c| matches!(c, Component::ParentDir))
}

// ---------------------------------------------------------------- the graphics-card parsers

#[test]
fn nvidia_smi_gives_the_card_with_the_most_memory_and_never_panics() {
    check(
        prop::collection::vec(("[A-Za-z0-9 ]{0,12}", 0u64..2_000_000), 0..6),
        |cards| {
            let out: String = cards.iter().map(|(n, m)| format!("{n}, {m}\n")).collect();
            let got = parse_nvidia_smi(&out);
            match cards.iter().map(|(_, m)| *m).max() {
                None => prop_assert!(got.is_none()),
                Some(most) => {
                    let got = got.expect("a card");
                    prop_assert_eq!(got.vram_bytes, Some(most * 1024 * 1024));
                }
            }
            Ok(())
        },
    );
    check(any_text(), |text| {
        let _ = parse_nvidia_smi(&text);
        Ok(())
    });
    check(any::<u64>(), |mib| {
        // A size near u64::MAX saturates instead of overflowing.
        let got = parse_nvidia_smi(&format!("GPU, {mib}")).unwrap();
        prop_assert_eq!(got.vram_bytes, Some(mib.saturating_mul(1024 * 1024)));
        Ok(())
    });
}

fn qword_listing(adapters: &[(u8, u64)]) -> (String, String) {
    let mut sizes = String::new();
    let mut names = String::new();
    for (i, (_, bytes)) in adapters.iter().enumerate() {
        let key = format!("HKEY_LOCAL_MACHINE\\X\\{i:04}");
        sizes +=
            &format!("\n{key}\n    HardwareInformation.qwMemorySize    REG_QWORD    {bytes:#x}\n");
        names += &format!("\n{key}\n    DriverDesc    REG_SZ    Card {i}\n");
    }
    (sizes, names)
}

#[test]
fn adapter_listings_give_the_largest_adapter_with_a_size_and_never_panic() {
    check(
        prop::collection::vec((any::<u8>(), 0u64..u64::MAX / 2), 0..6),
        |adapters| {
            let (sizes, names) = qword_listing(&adapters);
            let got = parse_adapters(&sizes, &names);
            let most = adapters.iter().map(|(_, b)| *b).filter(|b| *b > 0).max();
            prop_assert_eq!(got.as_ref().and_then(|g| g.vram_bytes), most);
            if let Some(g) = got {
                prop_assert!(g.gpu_name.starts_with("Card "));
            }
            Ok(())
        },
    );
    check(prop::collection::vec(any::<u8>(), 8), |bytes| {
        let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
        let sizes = format!("HKEY_A\n    n    REG_BINARY    {hex}\n");
        let want = u64::from_le_bytes(bytes.try_into().unwrap());
        let got = parse_adapters(&sizes, "").and_then(|g| g.vram_bytes);
        prop_assert_eq!(got, (want > 0).then_some(want));
        Ok(())
    });
    check((any_text(), any_text()), |(a, b)| {
        let _ = parse_adapters(&a, &b);
        Ok(())
    });
}

// ---------------------------------------------------------------- the settings validators

#[test]
fn a_package_is_accepted_only_when_the_installer_knows_it() {
    check(any_text(), |text| {
        prop_assert_eq!(
            check_package(&text).is_ok(),
            text == "nvidia" || text == "amd"
        );
        Ok(())
    });
}

#[test]
fn a_start_timeout_is_accepted_exactly_inside_its_range() {
    check(
        prop_oneof![
            any::<u64>(),
            0u64..2000,
            Just(*START_TIMEOUT_SECS.start()),
            Just(*START_TIMEOUT_SECS.end())
        ],
        |secs| {
            prop_assert_eq!(
                check_start_timeout(secs).is_ok(),
                START_TIMEOUT_SECS.contains(&secs)
            );
            Ok(())
        },
    );
}

#[test]
fn a_model_folder_that_is_accepted_is_a_plain_existing_folder_outside_the_data_folder() {
    let base = tempfile::tempdir().unwrap();
    let data = base.path().join("data");
    std::fs::create_dir_all(&data).unwrap();
    let data_text = data.to_string_lossy().to_string();
    check_up_to(
        128,
        (nasty_string(), any::<bool>()),
        |(text, under_base)| {
            let path = if under_base {
                base.path().join(&text)
            } else {
                PathBuf::from(&text)
            };
            if check_new_model_root(&path, &[], &data).is_ok() {
                prop_assert!(path.is_absolute() && path.is_dir(), "{path:?}");
                prop_assert!(!has_parent_dir(&path));
                prop_assert!(!path
                    .to_string_lossy()
                    .to_lowercase()
                    .starts_with(&data_text.to_lowercase()));
            }
            Ok(())
        },
    );
}

#[test]
fn model_folders_are_refused_when_listed_already_or_when_there_are_too_many() {
    let base = tempfile::tempdir().unwrap();
    let data = base.path().join("data");
    std::fs::create_dir_all(data.join("inner")).unwrap();
    check_up_to(32, "[a-z]{1,8}", |name| {
        let dir = base.path().join(format!("m-{name}"));
        std::fs::create_dir_all(&dir).unwrap();
        prop_assert!(check_new_model_root(&dir, &[], &data).is_ok());
        prop_assert!(check_new_model_root(&dir, std::slice::from_ref(&dir), &data).is_err());
        // The same folder spelled with a trailing separator, or through `.`, is the same folder.
        prop_assert!(
            check_new_model_root(&dir.join("."), std::slice::from_ref(&dir), &data).is_err()
        );
        let full: Vec<PathBuf> = (0..MAX_MODEL_ROOTS)
            .map(|i| base.path().join(format!("x{i}")))
            .collect();
        prop_assert!(check_new_model_root(&dir, &full, &data).is_err());
        prop_assert!(check_new_model_root(&data, &[], &data).is_err());
        prop_assert!(check_new_model_root(&data.join("inner"), &[], &data).is_err());
        Ok(())
    });
}

#[test]
fn a_comfyui_folder_that_is_accepted_is_full_plain_and_apart_from_the_data_folder() {
    let base = tempfile::tempdir().unwrap();
    let data = base.path().join("data");
    std::fs::create_dir_all(&data).unwrap();
    check_up_to(
        128,
        (nasty_string(), any::<bool>()),
        |(text, under_base)| {
            let path = if under_base {
                base.path().join(&text)
            } else {
                PathBuf::from(&text)
            };
            if check_install_dir(&path, &data).is_ok() {
                prop_assert!(path.is_absolute() && path.parent().is_some(), "{path:?}");
                prop_assert!(!has_parent_dir(&path));
                prop_assert!(path != data && !data.starts_with(&path));
            }
            Ok(())
        },
    );
    // Something that holds the data folder, or is it, is never a ComfyUI folder.
    assert!(check_install_dir(&data, &data).is_err());
    assert!(check_install_dir(base.path(), &data).is_err());
}

// ---------------------------------------------------------------- the data folder

#[test]
fn a_data_folder_that_is_accepted_is_a_full_plain_path_with_a_parent() {
    let base = tempfile::tempdir().unwrap();
    check_up_to(
        128,
        (nasty_string(), any::<bool>()),
        |(text, under_base)| {
            let path = if under_base {
                base.path().join(&text)
            } else {
                PathBuf::from(&text)
            };
            if data_location::check_folder(&path).is_ok() {
                prop_assert!(path.is_absolute() && path.parent().is_some(), "{path:?}");
                prop_assert!(!has_parent_dir(&path));
                prop_assert!(!path.exists() || path.is_dir());
            }
            Ok(())
        },
    );
}

#[test]
fn a_new_data_folder_is_refused_when_it_is_the_current_one_or_nested_with_it() {
    let base = tempfile::tempdir().unwrap();
    let current = base.path().join("current");
    std::fs::create_dir_all(&current).unwrap();
    std::fs::write(current.join("novira.db"), b"x").unwrap();
    check_up_to(64, "[a-z]{1,8}", |name| {
        let outside = base.path().join(format!("o-{name}"));
        prop_assert!(data_location::check_new(&outside, &current, true).is_ok());
        prop_assert!(data_location::check_new(&outside, &current, false).is_ok());
        prop_assert!(data_location::check_new(&current, &current, false).is_err());
        prop_assert!(data_location::check_new(&current.join(&name), &current, false).is_err());
        prop_assert!(data_location::check_new(base.path(), &current, false).is_err());
        // A moved-into folder may not already hold something with the name of the current data (without case).
        let clash = base.path().join(format!("c-{name}"));
        std::fs::create_dir_all(&clash).unwrap();
        std::fs::write(clash.join("NOVIRA.DB"), b"y").unwrap();
        prop_assert!(data_location::check_new(&clash, &current, true).is_err());
        prop_assert!(data_location::check_new(&clash, &current, false).is_ok());
        Ok(())
    });
}

#[test]
fn the_pointer_round_trips_and_a_damaged_one_is_no_pointer() {
    let base = tempfile::tempdir().unwrap();
    check_up_to(
        64,
        (
            "[a-z]{1,8}",
            prop::option::of("[a-z]{1,8}"),
            prop::option::of(any_text()),
        ),
        |(name, from, err)| {
            let pointer = base.path().join("p").join("data-location.json");
            let location = Location {
                data_dir: base.path().join(&name),
                move_from: from.map(|f| base.path().join(f)),
                move_error: err,
            };
            data_location::write(&pointer, &location).unwrap();
            prop_assert_eq!(data_location::read(&pointer), Some(location));
            data_location::clear(&pointer).unwrap();
            prop_assert_eq!(data_location::read(&pointer), None);
            // Clearing twice is fine.
            prop_assert!(data_location::clear(&pointer).is_ok());
            Ok(())
        },
    );
    check_up_to(128, any_text(), |text| {
        let pointer = base.path().join("junk.json");
        std::fs::write(&pointer, &text).unwrap();
        if let Some(l) = data_location::read(&pointer) {
            prop_assert!(l.data_dir.is_absolute());
        }
        Ok(())
    });
    // A pointer naming a relative folder is not one.
    let pointer = base.path().join("rel.json");
    std::fs::write(&pointer, r#"{"dataDir":"relative/dir"}"#).unwrap();
    assert_eq!(data_location::read(&pointer), None);
}

// ---------------------------------------------------------------- packs

#[test]
fn a_pack_file_always_lives_under_the_models_folder_in_its_own_pack_folder() {
    let models = PathBuf::from("models-root");
    check(kind(), |k| {
        for f in files(k) {
            let p = file_path(&models, k, f);
            prop_assert!(p.starts_with(pack_root(&models, f.home.unwrap_or(k))));
            prop_assert!(p.starts_with(&models));
            prop_assert!(!has_parent_dir(&p));
        }
        Ok(())
    });
}

#[test]
fn a_pack_is_ready_exactly_when_every_file_is_there_and_missing_counts_only_what_is_not() {
    check_up_to(
        24,
        (kind(), prop::collection::vec(any::<bool>(), 8)),
        |(k, present)| {
            let root = tempfile::tempdir().unwrap();
            let roots = vec![root.path().to_path_buf()];
            let mut absent = 0u64;
            for (i, f) in files(k).iter().enumerate() {
                if present[i % present.len()] {
                    let p = file_path(root.path(), k, f);
                    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
                    std::fs::write(&p, b"x").unwrap();
                }
            }
            for f in files(k) {
                if !file_path(root.path(), k, f).is_file() {
                    absent += f.approx_bytes;
                }
            }
            match disk_status_in(&roots, k) {
                PackStatus::Ready => prop_assert!(absent == 0),
                PackStatus::Missing { total_bytes } => {
                    prop_assert!(absent > 0 || files(k).is_empty() || total_bytes == 0);
                    prop_assert_eq!(total_bytes, absent);
                }
                other => prop_assert!(false, "{other:?}"),
            }
            Ok(())
        },
    );
}
