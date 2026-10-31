use super::*;

fn put(dir: &Path, name: &str, text: &str) {
    let path = dir.join(name);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
}

#[test]
fn the_pointer_reads_back_what_was_written_and_a_broken_one_reads_as_none() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("cfg").join("data-location.json");
    assert_eq!(read(&pointer), None);
    let location = Location {
        data_dir: dir.path().join("data"),
        move_from: Some(dir.path().join("old")),
        move_error: None,
    };
    write(&pointer, &location).unwrap();
    assert_eq!(read(&pointer), Some(location));
    std::fs::write(&pointer, "{ not json").unwrap();
    assert_eq!(read(&pointer), None);
    // A relative path is no folder to open.
    std::fs::write(&pointer, r#"{"dataDir":"relative/dir"}"#).unwrap();
    assert_eq!(read(&pointer), None);
    clear(&pointer).unwrap();
    clear(&pointer).unwrap();
}

#[test]
fn a_new_data_folder_is_checked() {
    let dir = tempfile::tempdir().unwrap();
    let current = dir.path().join("current");
    put(&current, "novira.sqlite", "db");
    let ok = |new: &Path, mv| check_new(new, &current, mv);
    assert!(ok(&dir.path().join("fresh"), true).is_ok());
    assert!(ok(&current, false).is_err());
    assert!(ok(&current.join("inner"), false).is_err());
    assert!(ok(dir.path(), false).is_err());
    assert!(ok(Path::new("relative"), false).is_err());
    let file = dir.path().join("file.txt");
    std::fs::write(&file, "x").unwrap();
    assert!(ok(&file, false).is_err());
    let full = dir.path().join("full");
    put(&full, "novira.sqlite", "db");
    assert!(
        ok(&full, true).is_err(),
        "a move cannot put the data over a file of the same name"
    );
    let beside = dir.path().join("beside");
    put(&beside, "portable/ComfyUI/main.py", "");
    assert!(
        ok(&beside, true).is_ok(),
        "other things in the folder stay beside the data"
    );
    let upper = dir.path().join("upper");
    put(&upper, "NOVIRA.SQLITE", "db");
    assert!(ok(&upper, true).is_err(), "names are compared without case");
    assert!(
        ok(&full, false).is_ok(),
        "without a move, a folder with data is opened as it is"
    );
    let empty = dir.path().join("empty");
    std::fs::create_dir_all(&empty).unwrap();
    assert!(ok(&empty, true).is_ok());
}

#[test]
fn a_pending_move_carries_the_data_over_and_opens_the_new_folder() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    put(&old, "models/checkpoints/a.safetensors", "weights");
    let pointer = dir.path().join("cfg/data-location.json");
    let asked = Location {
        data_dir: new.clone(),
        move_from: Some(old.clone()),
        move_error: None,
    };
    write(&pointer, &asked).unwrap();
    assert_eq!(apply_pending(&pointer), Some(new.clone()));
    assert_eq!(
        std::fs::read_to_string(new.join("novira.sqlite")).unwrap(),
        "db"
    );
    assert_eq!(
        std::fs::read_to_string(new.join("models/checkpoints/a.safetensors")).unwrap(),
        "weights"
    );
    assert!(!old.exists());
    // The request is spent: the next start only opens the folder.
    assert_eq!(
        read(&pointer).unwrap(),
        Location {
            data_dir: new.clone(),
            move_from: None,
            move_error: None
        }
    );
    assert_eq!(apply_pending(&pointer), Some(new));
}

#[test]
fn a_move_into_a_folder_that_holds_other_things_puts_the_data_beside_them() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    put(&old, "comfyui/portable/ComfyUI/main.py", "old engine");
    put(&new, "portable/ComfyUI/main.py", "new engine");
    let pointer = dir.path().join("data-location.json");
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    assert_eq!(apply_pending(&pointer), Some(new.clone()));
    assert_eq!(
        std::fs::read_to_string(new.join("novira.sqlite")).unwrap(),
        "db"
    );
    assert_eq!(
        std::fs::read_to_string(new.join("comfyui/portable/ComfyUI/main.py")).unwrap(),
        "old engine"
    );
    assert_eq!(
        std::fs::read_to_string(new.join("portable/ComfyUI/main.py")).unwrap(),
        "new engine"
    );
    assert!(!old.exists());
    assert!(read(&pointer).unwrap().move_error.is_none());
}

#[test]
fn a_move_onto_a_name_the_folder_already_has_is_refused_and_the_old_folder_stays_in_use() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    put(&old, "outputs/a.png", "picture");
    put(&new, "Outputs/other.png", "not ours");
    let pointer = dir.path().join("data-location.json");
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    assert_eq!(apply_pending(&pointer), Some(old.clone()));
    assert!(old.join("novira.sqlite").is_file());
    assert!(old.join("outputs/a.png").is_file());
    assert!(new.join("Outputs/other.png").is_file());
    assert!(!new.join("novira.sqlite").exists());
    let after = read(&pointer).unwrap();
    assert_eq!(after.data_dir, old);
    assert!(after.move_from.is_none());
    assert!(after.move_error.unwrap().contains("already holds"));
}

#[test]
fn a_move_is_refused_while_another_novira_holds_the_old_folder() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    let _held = crate::startup::try_claim(&old.join(LOCK_FILE))
        .unwrap()
        .unwrap();
    let pointer = dir.path().join("data-location.json");
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    assert_eq!(apply_pending(&pointer), Some(old.clone()));
    assert!(!new.exists());
    assert!(read(&pointer)
        .unwrap()
        .move_error
        .unwrap()
        .contains("another novira"));
}

#[test]
fn a_pointer_without_a_move_just_names_the_folder() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("data-location.json");
    assert_eq!(apply_pending(&pointer), None);
    write(
        &pointer,
        &Location {
            data_dir: dir.path().join("data"),
            ..Location::default()
        },
    )
    .unwrap();
    assert_eq!(apply_pending(&pointer), Some(dir.path().join("data")));
}

#[test]
fn a_move_is_pending_only_while_the_pointer_still_asks_for_it() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    let pointer = dir.path().join("cfg/data-location.json");
    assert!(!move_pending(&pointer));
    let asked = Location {
        data_dir: new.clone(),
        move_from: Some(old),
        move_error: None,
    };
    write(&pointer, &asked).unwrap();
    assert!(move_pending(&pointer));
    apply_pending(&pointer);
    assert!(!move_pending(&pointer));
}

#[test]
fn a_copy_to_another_drive_reports_its_bytes_up_to_the_whole_size() {
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    std::fs::create_dir_all(old.join("models")).unwrap();
    // Larger than one piece, so the file reports more than once.
    std::fs::write(old.join("models/a.safetensors"), vec![7u8; 9 * 1024 * 1024]).unwrap();
    let seen = std::cell::RefCell::new(Vec::new());
    let report = |done: u64, total: u64| seen.borrow_mut().push((done, total));
    copy_tree(&old, &new, &mut Progress::new(&old, &report)).unwrap();
    let seen = seen.into_inner();
    let whole = 2 + 9 * 1024 * 1024;
    assert!(seen.iter().all(|&(_, total)| total == whole));
    assert!(seen.windows(2).all(|w| w[0].0 <= w[1].0), "never goes back");
    assert!(
        seen.iter()
            .filter(|&&(done, _)| done > 2 && done < whole)
            .count()
            >= 1
    );
    assert_eq!(seen.last().unwrap().0, whole);
    assert_eq!(
        std::fs::read(new.join("models/a.safetensors"))
            .unwrap()
            .len(),
        9 * 1024 * 1024
    );
}

#[cfg(windows)]
#[test]
fn a_move_that_fails_halfway_puts_back_what_it_moved_and_removes_what_it_copied() {
    use std::os::windows::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    put(&old, "outputs/a.png", "picture");
    put(&old, "outputs/b.png", "picture");
    put(&new, "keep.txt", "not ours");
    // Opened with no sharing at all: the file can be neither renamed nor copied.
    let _held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(old.join("outputs/b.png"))
        .unwrap();
    let pointer = dir.path().join("data-location.json");
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    assert_eq!(apply_pending(&pointer), Some(old.clone()));
    assert!(old.join("novira.sqlite").is_file());
    assert!(old.join("outputs/a.png").is_file());
    assert!(old.join("outputs/b.png").is_file());
    assert!(!new.join("novira.sqlite").exists());
    assert!(!new.join("outputs").exists());
    assert!(new.join("keep.txt").is_file());
    let after = read(&pointer).unwrap();
    assert_eq!(after.data_dir, old);
    assert!(after.move_error.unwrap().contains("copying failed"));
}

#[test]
fn the_pointer_has_its_own_file_for_a_debug_build() {
    // The folder depends on the environment; the file name does not.
    if let Some(release) = pointer_path(false) {
        assert!(release.ends_with("novira/data-location.json"));
    }
    if let Some(dev) = pointer_path(true) {
        assert!(dev.ends_with("novira/data-location-dev.json"));
    }
}

#[test]
fn a_pointer_that_cannot_be_removed_or_written_is_an_error() {
    let dir = tempfile::tempdir().unwrap();
    // A folder where the pointer file should be: it cannot be removed as a file.
    let as_folder = dir.path().join("data-location.json");
    std::fs::create_dir_all(as_folder.join("inner")).unwrap();
    assert!(clear(&as_folder).unwrap_err().contains("cannot remove"));
    // A missing pointer is already cleared.
    assert!(clear(&dir.path().join("none.json")).is_ok());
    // A file where the pointer's folder should be.
    put(dir.path(), "cfg", "a file");
    let location = Location {
        data_dir: dir.path().join("data"),
        ..Location::default()
    };
    let err = write(&dir.path().join("cfg/sub/pointer.json"), &location).unwrap_err();
    assert!(err.contains("cannot create"), "{err}");
}

#[test]
fn a_size_of_a_folder_that_is_not_there_is_nothing() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(size_of(&dir.path().join("none")), 0);
}

#[cfg(windows)]
#[test]
fn a_first_start_folder_must_be_a_plain_full_path() {
    for bad in ["", "data", r"C:\data\..\other", r"\\.\COM42\x", r"C:\"] {
        assert!(check_folder(Path::new(bad)).is_err(), "{bad}");
    }
    let err = check_folder(Path::new("C:\\a\nb")).unwrap_err();
    assert_eq!(err, "Not a folder path");
    let dir = tempfile::tempdir().unwrap();
    put(dir.path(), "file.txt", "x");
    assert!(check_folder(&dir.path().join("file.txt"))
        .unwrap_err()
        .contains("not a folder"));
    assert!(check_folder(&dir.path().join("new")).is_ok());
    // A move into a folder that is not there yet has nothing to clash with.
    let current = dir.path().join("current");
    std::fs::create_dir_all(&current).unwrap();
    assert!(check_new(&dir.path().join("new"), &current, true).is_ok());
}

#[test]
fn a_move_from_a_folder_that_is_gone_or_cannot_be_locked_is_recorded() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("data-location.json");
    let ask = |from: &Path, to: &Path| {
        write(
            &pointer,
            &Location {
                data_dir: to.to_path_buf(),
                move_from: Some(from.to_path_buf()),
                move_error: None,
            },
        )
        .unwrap();
        let opened = apply_pending(&pointer);
        (opened, read(&pointer).unwrap())
    };
    let gone = dir.path().join("gone");
    let (opened, after) = ask(&gone, &dir.path().join("new"));
    assert_eq!(opened, Some(gone));
    assert!(after.move_error.unwrap().contains("does not exist"));
    // The lock file is a folder: the old data folder cannot be locked at all.
    let old = dir.path().join("old");
    std::fs::create_dir_all(old.join(LOCK_FILE)).unwrap();
    let (opened, after) = ask(&old, &dir.path().join("new2"));
    assert_eq!(opened, Some(old));
    assert!(after
        .move_error
        .unwrap()
        .contains("cannot lock the current data folder"));
}

#[cfg(windows)]
#[test]
fn a_copy_that_cannot_read_a_file_leaves_nothing_in_the_new_folder() {
    use std::os::windows::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    put(&old, "b.png", "picture");
    let _held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(old.join("b.png"))
        .unwrap();
    let pointer = dir.path().join("data-location.json");
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    // `new` does not exist: the folder is renamed, which fails with a file held, then copied, which fails too.
    assert_eq!(apply_pending(&pointer), Some(old.clone()));
    assert!(!new.exists());
    assert!(old.join("novira.sqlite").is_file());
    assert!(read(&pointer)
        .unwrap()
        .move_error
        .unwrap()
        .contains("copying failed"));
}

#[cfg(windows)]
#[test]
fn files_that_stay_behind_after_a_copy_are_not_an_error() {
    use std::os::windows::fs::OpenOptionsExt;
    const SHARE_READ: u32 = 1;
    // A new folder that is not there yet: the whole folder is copied after its rename failed.
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "novira.sqlite", "db");
    put(&old, "outputs/a.png", "picture");
    let held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(SHARE_READ)
        .open(old.join("outputs/a.png"))
        .unwrap();
    let pointer = dir.path().join("data-location.json");
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    assert_eq!(apply_pending(&pointer), Some(new.clone()));
    assert_eq!(
        std::fs::read_to_string(new.join("outputs/a.png")).unwrap(),
        "picture"
    );
    assert!(read(&pointer).unwrap().move_error.is_none());
    drop(held);

    // A new folder that exists: each entry is renamed or, when it is in use, copied.
    let (old, new) = (dir.path().join("old2"), dir.path().join("new2"));
    put(&old, "novira.sqlite", "db");
    put(&old, "outputs/a.png", "picture");
    put(&old, "plain.txt", "text");
    put(&new, "keep.txt", "not ours");
    let _file = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(SHARE_READ)
        .open(old.join("novira.sqlite"))
        .unwrap();
    let _inside = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(SHARE_READ)
        .open(old.join("outputs/a.png"))
        .unwrap();
    write(
        &pointer,
        &Location {
            data_dir: new.clone(),
            move_from: Some(old.clone()),
            move_error: None,
        },
    )
    .unwrap();
    assert_eq!(apply_pending(&pointer), Some(new.clone()));
    assert_eq!(
        std::fs::read_to_string(new.join("novira.sqlite")).unwrap(),
        "db"
    );
    assert_eq!(
        std::fs::read_to_string(new.join("outputs/a.png")).unwrap(),
        "picture"
    );
    assert_eq!(
        std::fs::read_to_string(new.join("plain.txt")).unwrap(),
        "text"
    );
    assert!(new.join("keep.txt").is_file());
}

#[test]
fn a_pointer_below_a_file_cannot_be_written() {
    let dir = tempfile::tempdir().unwrap();
    put(dir.path(), "file", "x");
    let pointer = dir
        .path()
        .join("file")
        .join("sub")
        .join("data-location.json");
    let location = Location {
        data_dir: dir.path().join("data"),
        move_from: None,
        move_error: None,
    };
    let err = write(&pointer, &location).unwrap_err();
    assert!(err.contains("cannot create"), "{err}");
}

#[test]
fn a_move_from_a_folder_that_is_gone_is_not_checked_for_clashes() {
    let dir = tempfile::tempdir().unwrap();
    let (current, new) = (dir.path().join("gone"), dir.path().join("new"));
    put(&new, "keep.txt", "x");
    // Nothing to compare against: the move itself reports that the old folder is missing.
    assert!(check_new(&new, &current, true).is_ok());
}

#[test]
fn a_move_to_a_place_that_cannot_be_made_fails_with_the_reason() {
    let dir = tempfile::tempdir().unwrap();
    let old = dir.path().join("old");
    put(&old, "novira.sqlite", "db");
    put(dir.path(), "file", "x");
    let new = dir.path().join("file").join("sub").join("data");
    let err = move_data(&old, &new, &mut Progress::new(&old, &|_, _| {})).unwrap_err();
    assert!(!err.is_empty());
    assert!(old.join("novira.sqlite").is_file());
}

#[cfg(windows)]
#[test]
fn a_file_that_cannot_be_moved_or_copied_is_not_left_half_copied() {
    use std::os::windows::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().unwrap();
    let (old, new) = (dir.path().join("old"), dir.path().join("new"));
    put(&old, "a.txt", "a");
    put(&old, "held.bin", "held");
    put(&new, "keep.txt", "not ours");
    let _held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(old.join("held.bin"))
        .unwrap();
    let err = move_data(&old, &new, &mut Progress::new(&old, &|_, _| {})).unwrap_err();
    assert!(err.contains("copying failed"), "{err}");
    assert!(old.join("a.txt").is_file() && old.join("held.bin").is_file());
    assert!(!new.join("a.txt").exists() && !new.join("held.bin").exists());
    assert!(new.join("keep.txt").is_file());
}
