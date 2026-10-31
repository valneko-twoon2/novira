//! Property tests for where gallery files go and what they are called: board names become folder names that stay inside
//! `outputs/`, a file name written from a picture's name gives that name back, and shared copies never take the name
//! of a file that is already there. Pure functions and temporary folders only.
//! Run: `cargo test -p novira-core --test prop_gallery_files`.
mod prop_common;

use novira_core::media::arrangement::{
    file_name, folder_names, name_in, place_of, safe_folder, DRAFTS, UNCATEGORIZED,
};
use novira_core::media::export::{unique_name, write_unique};
use novira_core::media::images::is_valid_name;
use novira_core::types::{BoardDTO, ImageCategory, ImageDTO, MediaType};
use prop_common::{any_text, bytes, check, check_up_to};
use proptest::prelude::*;
use std::collections::{HashMap, HashSet};
use std::path::{Component, Path};

fn is_one_plain_component(name: &str) -> bool {
    let mut parts = Path::new(name).components();
    matches!((parts.next(), parts.next()), (Some(Component::Normal(n)), None) if n == name)
}

fn assert_safe_folder(folder: &str) -> Result<(), TestCaseError> {
    prop_assert!(!folder.is_empty());
    prop_assert!(
        is_one_plain_component(folder),
        "not one plain component: {folder:?}"
    );
    prop_assert!(
        !folder
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c)),
        "forbidden character in {folder:?}"
    );
    prop_assert!(
        !folder.ends_with('.') && !folder.ends_with(' '),
        "Windows drops a trailing dot or space: {folder:?}"
    );
    prop_assert!(!folder.starts_with('.'), "hidden or dot folder: {folder:?}");
    prop_assert!(
        !novira_core::is_reserved_device_name(folder),
        "device name {folder:?}"
    );
    // 60 characters taken from the board name, plus the `_` put before a name that needed it.
    prop_assert!(folder.chars().count() <= 61, "too long: {folder:?}");
    Ok(())
}

fn board(id: usize, name: String, created_at: i64) -> BoardDTO {
    BoardDTO {
        id: format!("board-{id}"),
        name,
        archived: false,
        created_at,
    }
}

fn picture(name: String, created_at: i64, board_id: Option<String>, draft: bool) -> ImageDTO {
    ImageDTO {
        name,
        media_type: MediaType::Image,
        url: String::new(),
        thumbnail_url: String::new(),
        width: 1,
        height: 1,
        created_at,
        board_id,
        starred: false,
        is_intermediate: draft,
        category: ImageCategory::General,
        metadata: None,
        workflow: None,
    }
}

/// A name the app generates: hex or a UUID with a picture, video or audio extension.
fn valid_name() -> impl Strategy<Value = String> {
    (
        "[a-f0-9]{1,8}(-[a-f0-9]{4}){0,4}",
        prop::sample::select(&[".png", ".mp4", ".wav", ".mp3", ".flac"][..]),
    )
        .prop_map(|(stem, ext)| format!("{stem}{ext}"))
}

#[test]
fn any_board_name_becomes_one_safe_folder_name_and_settles() {
    check(any_text(), |name| {
        let folder = safe_folder(&name);
        assert_safe_folder(&folder)?;
        // Naming the folder again after itself changes nothing, so a rename round trip does not drift.
        prop_assert_eq!(safe_folder(&folder), folder);
        Ok(())
    });
}

#[test]
fn boards_never_share_a_folder_or_take_the_two_fixed_ones() {
    check(
        prop::collection::vec((any_text(), -1_000i64..1_000), 0..12),
        |boards| {
            let boards: Vec<BoardDTO> = boards
                .into_iter()
                .enumerate()
                .map(|(i, (name, at))| board(i, name, at))
                .collect();
            let folders = folder_names(&boards);
            prop_assert_eq!(folders.len(), boards.len());
            let mut seen: HashSet<String> = [UNCATEGORIZED, DRAFTS]
                .iter()
                .map(|n| n.to_lowercase())
                .collect();
            for b in &boards {
                let folder = &folders[&b.id];
                assert_safe_folder(folder)?;
                // Windows compares folder names without regard to case.
                prop_assert!(
                    seen.insert(folder.to_lowercase()),
                    "{folder:?} is taken twice"
                );
            }
            Ok(())
        },
    );
}

#[test]
fn a_file_name_gives_back_the_name_it_was_made_from() {
    // Years 1970..=9999: the stamp is `YYYYMMDD_HHMMSS` only while the year has four digits.
    check((valid_name(), 0i64..253_402_300_000_000), |(name, at)| {
        let file = file_name(&name, at);
        prop_assert_eq!(name_in(&file), Some(name.as_str()), "file {}", file);
        Ok(())
    });
}

#[test]
fn a_name_read_from_a_file_is_always_a_valid_name_the_file_ends_with() {
    check(any_text(), |file| {
        if let Some(name) = name_in(&file) {
            prop_assert!(is_valid_name(name), "{name:?}");
            prop_assert!(file.ends_with(name));
        }
        Ok(())
    });
}

#[test]
fn a_picture_is_placed_in_one_folder_under_outputs_and_found_again_by_name() {
    check(
        (
            valid_name(),
            any_text(),
            any::<i64>(),
            any::<bool>(),
            any::<bool>(),
        ),
        |(name, board_name, at, draft, on_board)| {
            let b = board(1, board_name, 0);
            let folders = folder_names(std::slice::from_ref(&b));
            let board_id = on_board.then(|| b.id.clone());
            let place = place_of(&picture(name.clone(), at, board_id, draft), &folders);
            let parts: Vec<_> = place.components().collect();
            prop_assert_eq!(parts.len(), 2, "{:?}", place);
            prop_assert!(parts.iter().all(|c| matches!(c, Component::Normal(_))));
            let folder = place.parent().unwrap().to_string_lossy().into_owned();
            let expected = if draft {
                DRAFTS.to_string()
            } else if on_board {
                folders[&b.id].clone()
            } else {
                UNCATEGORIZED.to_string()
            };
            prop_assert_eq!(folder, expected);
            // The file name is kept whole inside, which is how the scan finds the picture again.
            let file = place.file_name().unwrap().to_string_lossy().into_owned();
            prop_assert!(file.ends_with(&name));
            Ok(())
        },
    );
}

#[test]
fn a_place_of_an_unknown_board_falls_back_to_the_uncategorized_folder() {
    check((valid_name(), "[a-z]{1,8}"), |(name, id)| {
        let place = place_of(
            &picture(name, 0, Some(id), false),
            &HashMap::<String, String>::new(),
        );
        prop_assert_eq!(place.parent().unwrap(), Path::new(UNCATEGORIZED));
        Ok(())
    });
}

#[test]
fn unique_names_never_repeat_and_never_take_a_name_already_held() {
    check(
        (
            "[a-z0-9-]{0,6}",
            "[a-z]{1,4}",
            0usize..40,
            prop::collection::vec("[a-z0-9-]{0,6}(-[0-9]{1,2})?\\.[a-z]{1,4}", 0..10),
        ),
        |(stem, ext, count, held)| {
            let mut taken: HashSet<String> = held.iter().cloned().collect();
            let before = taken.clone();
            let mut given = Vec::new();
            for _ in 0..count {
                given.push(unique_name(&mut taken, &stem, &ext));
            }
            let distinct: HashSet<&String> = given.iter().collect();
            prop_assert_eq!(
                distinct.len(),
                given.len(),
                "a name was given twice: {:?}",
                given
            );
            for name in &given {
                prop_assert!(!before.contains(name), "{name} was already held");
                prop_assert!(taken.contains(name));
                let suffix = format!(".{ext}");
                prop_assert!(name.ends_with(&suffix));
            }
            prop_assert_eq!(taken.len(), before.len() + count);
            Ok(())
        },
    );
}

#[test]
fn writing_copies_never_overwrites_a_file_and_every_copy_keeps_its_bytes() {
    check_up_to(
        48,
        (
            "[a-z0-9]{1,6}",
            prop::collection::vec(bytes(24), 1..8),
            prop::collection::vec(bytes(24), 0..3),
        ),
        |(stem, copies, existing)| {
            let dir = tempfile::tempdir().unwrap();
            // Files already there under the first names the writer would try.
            let mut keep: Vec<(std::path::PathBuf, Vec<u8>)> = Vec::new();
            for (i, data) in existing.iter().enumerate() {
                let name = if i == 0 {
                    format!("{stem}.png")
                } else {
                    format!("{stem}-{}.png", i + 1)
                };
                let path = dir.path().join(name);
                std::fs::write(&path, data).unwrap();
                keep.push((path, data.clone()));
            }
            let mut written = Vec::new();
            for data in &copies {
                written.push((
                    write_unique(dir.path(), &stem, "png", data).unwrap(),
                    data.clone(),
                ));
            }
            let mut paths: HashSet<_> = keep.iter().map(|(p, _)| p.clone()).collect();
            for (path, data) in &written {
                prop_assert!(
                    paths.insert(path.clone()),
                    "{path:?} was written onto a file"
                );
                prop_assert_eq!(&std::fs::read(path).unwrap(), data);
                prop_assert_eq!(path.parent().unwrap(), dir.path());
            }
            for (path, data) in &keep {
                prop_assert_eq!(&std::fs::read(path).unwrap(), data, "{:?} changed", path);
            }
            Ok(())
        },
    );
}
