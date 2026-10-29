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
    copy_whole(&old, &new, &mut Progress::new(&old, &report)).unwrap();
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
    assert!(!old.exists());
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
