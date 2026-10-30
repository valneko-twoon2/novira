//! A move of the data folder cut off at each of its steps (the power goes, the process is killed), then the next start.
//! Wherever it stopped, the next start opens one whole data folder: the new one with everything in it, the pointer
//! naming it, and nothing of the move left behind.
use super::*;

const FILES: [(&str, &str); 4] = [
    ("novira.sqlite", "the database"),
    ("outputs/a.png", "a picture"),
    ("models/m.safetensors", "a model"),
    ("settings.json", "{}"),
];

fn put(dir: &Path, name: &str, text: &str) {
    let path = dir.join(name);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
}

/// An old data folder, a new folder that already holds something of the user's (unless `new_exists` is false) and a
/// pointer asking for the move.
fn ask_for_move(root: &Path, new_exists: bool) -> (PathBuf, PathBuf, PathBuf) {
    let (old, new) = (root.join("old"), root.join("new"));
    for (name, text) in FILES {
        put(&old, name, text);
    }
    if new_exists {
        put(&new, "keep.txt", "not ours");
    }
    let pointer = root.join("data-location.json");
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    (old, new, pointer)
}

fn assert_moved(old: &Path, new: &Path, pointer: &Path, opened: Option<PathBuf>, case: &str) {
    assert_eq!(opened.as_deref(), Some(new), "{case}");
    for (name, text) in FILES {
        assert_eq!(
            std::fs::read_to_string(new.join(name)).ok().as_deref(),
            Some(text),
            "{case}: {name}"
        );
    }
    assert!(!old.exists(), "{case}: the old folder is left");
    assert!(
        !new.join(MOVE_MARKER).exists(),
        "{case}: the marker is left"
    );
    assert_eq!(
        read(pointer).unwrap(),
        Location {
            data_dir: new.to_path_buf(),
            move_from: None,
            move_error: None
        },
        "{case}"
    );
}

fn quiet(from: &Path) -> Progress<'static> {
    Progress::new(from, &|_, _| {})
}

#[test]
fn a_move_into_a_folder_cut_off_after_any_entry_is_finished_by_the_next_start() {
    for k in 0..=FILES.len() {
        let dir = tempfile::tempdir().unwrap();
        let (old, new, pointer) = ask_for_move(dir.path(), true);
        move_entries(&old, &new, &mut quiet(&old), k).unwrap();
        let opened = apply_pending(&pointer);
        assert_moved(&old, &new, &pointer, opened, &format!("cut off after {k}"));
        assert!(new.join("keep.txt").is_file());
    }
}

#[test]
fn a_copy_cut_off_half_way_through_a_file_is_copied_again_whole() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new, pointer) = ask_for_move(dir.path(), true);
    move_entries(&old, &new, &mut quiet(&old), 0).unwrap();
    // The start was copying the database to another drive when it stopped: half of it is there, all of it still here.
    put(&new, "novira.sqlite", "the data");
    let opened = apply_pending(&pointer);
    assert_moved(&old, &new, &pointer, opened, "half a copy");
}

#[test]
fn a_move_into_a_new_folder_cut_off_before_the_pointer_was_written_opens_the_new_folder() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new, pointer) = ask_for_move(dir.path(), false);
    // The whole folder was renamed, then the start stopped.
    move_data(&old, &new, &mut quiet(&old)).unwrap();
    let opened = apply_pending(&pointer);
    assert_moved(&old, &new, &pointer, opened, "renamed whole");
}

#[test]
fn a_copy_to_a_new_folder_cut_off_part_way_is_finished_by_the_next_start() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new, pointer) = ask_for_move(dir.path(), false);
    // A copy to another drive (the whole rename failed): the move made the folder, copied the database, then stopped.
    let entries = std::fs::read_dir(&old)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    put(
        &new,
        MOVE_MARKER,
        &serde_json::to_string(&MoveRecord {
            made: true,
            entries,
        })
        .unwrap(),
    );
    put(&new, "novira.sqlite", "the database");
    let opened = apply_pending(&pointer);
    assert_moved(&old, &new, &pointer, opened, "copy cut off");
}

#[test]
fn a_start_cut_off_while_the_old_folder_was_removed_opens_the_new_one_and_drops_the_marker() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new, pointer) = ask_for_move(dir.path(), true);
    move_data(&old, &new, &mut quiet(&old)).unwrap();
    // The pointer names the new folder; the old folder and the marker were not removed yet.
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: None,
            move_error: None,
        },
    )
    .unwrap();
    put(&old, "outputs/left.png", "left behind");
    assert_eq!(apply_pending(&pointer), Some(new.clone()));
    assert!(!new.join(MOVE_MARKER).exists());
    assert!(new.join("novira.sqlite").is_file());
}

#[test]
fn a_damaged_marker_moves_nothing_and_keeps_the_old_folder_in_use() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new, pointer) = ask_for_move(dir.path(), true);
    put(&new, MOVE_MARKER, "{ not json");
    assert_eq!(apply_pending(&pointer), Some(old.clone()));
    assert!(old.join("novira.sqlite").is_file());
    assert!(read(&pointer)
        .unwrap()
        .move_error
        .unwrap()
        .contains("damaged"));
}

#[test]
fn a_move_that_fails_after_a_cut_off_start_puts_back_what_both_starts_moved() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new, _pointer) = ask_for_move(dir.path(), true);
    // The first start renamed two entries and stopped.
    move_entries(&old, &new, &mut quiet(&old), 2).unwrap();
    // The next start cannot move the rest: an entry it cannot read stands where a file was.
    let record: MoveRecord =
        serde_json::from_str(&std::fs::read_to_string(new.join(MOVE_MARKER)).unwrap()).unwrap();
    let moved: Vec<&String> = record.entries.iter().take(2).collect();
    assert!(moved
        .iter()
        .all(|n| new.join(n).exists() && !old.join(n).exists()));
    let err = undo(&old, &new, &record, "copying failed: test".into());
    assert_eq!(err, "copying failed: test");
    for (name, text) in FILES {
        assert_eq!(
            std::fs::read_to_string(old.join(name)).unwrap(),
            text,
            "{name}"
        );
    }
    assert!(!new.join(MOVE_MARKER).exists());
    assert!(new.join("keep.txt").is_file());
    for name in &record.entries {
        assert!(!new.join(name).exists(), "{name} left in the new folder");
    }
}
