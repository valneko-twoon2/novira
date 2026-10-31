//! A start-up restore cut off after each of its steps (the power goes, the process is killed), then the next start.
//! Whatever step it stopped at, the next start ends with one whole data folder: the restored one when the backup is
//! good, the previous one when it is refused. Nothing is left half moved, and no restore folder stays behind.
use super::*;
use std::io::Write;

/// A database whose `meta` says which data it is.
fn database(dir: &Path, which: &str) {
    Db::open(dir).unwrap().set_meta("which", which).unwrap();
}

fn which(data: &Path) -> Option<String> {
    Db::open(data).unwrap().meta("which").unwrap()
}

/// A data folder with current data and a confirmed restore of a backup; `good: false` damages the unpacked database so
/// the start-up check refuses it.
fn data_with_ready_restore(root: &Path, good: bool) -> PathBuf {
    let made = root.join("made");
    std::fs::create_dir_all(&made).unwrap();
    database(&made, "restored");
    let zip_path = root.join("backup.zip");
    let manifest = serde_json::json!({
        "format": FORMAT, "version": VERSION, "appVersion": "0.0.0", "createdAt": 1,
        "images": 1, "boards": 0, "workflows": 0
    });
    let mut zip = zip::ZipWriter::new(File::create(&zip_path).unwrap());
    for (name, bytes) in [
        (MANIFEST, serde_json::to_vec(&manifest).unwrap()),
        (DATABASE, std::fs::read(made.join(DATABASE)).unwrap()),
        ("outputs/new.png", b"restored picture".to_vec()),
        ("thumbnails/new.thumb", b"restored thumbnail".to_vec()),
    ] {
        zip.start_file(name, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(&bytes).unwrap();
    }
    zip.finish().unwrap();

    let data = root.join("data");
    std::fs::create_dir_all(data.join(OUTPUTS)).unwrap();
    std::fs::create_dir_all(data.join(THUMBNAILS)).unwrap();
    database(&data, "current");
    std::fs::write(data.join(OUTPUTS).join("old.png"), b"current picture").unwrap();
    std::fs::write(
        data.join(THUMBNAILS).join("old.thumb"),
        b"current thumbnail",
    )
    .unwrap();
    stage(&zip_path, &data, |_, _| {}).unwrap();
    if !good {
        std::fs::write(staging(&data).join(DATABASE), b"not a database at all").unwrap();
    }
    mark_ready(&data).unwrap();
    data
}

/// The folders the restore leaves in the data folder that should not be there at the end.
fn leftovers(data: &Path) -> Vec<String> {
    std::fs::read_dir(data)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with(OLD_PREFIX) || n == STAGING)
        .collect()
}

fn assert_restored(data: &Path, k: usize) {
    assert_eq!(
        which(data).as_deref(),
        Some("restored"),
        "cut off after {k} steps"
    );
    assert!(data.join(OUTPUTS).join("new.png").is_file(), "after {k}");
    assert!(
        data.join(THUMBNAILS).join("new.thumb").is_file(),
        "after {k}"
    );
    assert!(!data.join(OUTPUTS).join("old.png").exists(), "after {k}");
    assert!(
        leftovers(data).is_empty(),
        "after {k}: {:?}",
        leftovers(data)
    );
    assert!(
        matches!(take_outcome(data), RestoreOutcome::Restored { .. }),
        "after {k}"
    );
}

fn assert_kept(data: &Path, k: usize) {
    assert_eq!(
        which(data).as_deref(),
        Some("current"),
        "cut off after {k} steps"
    );
    assert_eq!(
        std::fs::read(data.join(OUTPUTS).join("old.png")).unwrap(),
        b"current picture",
        "after {k}"
    );
    assert!(
        data.join(THUMBNAILS).join("old.thumb").is_file(),
        "after {k}"
    );
    assert!(!data.join(OUTPUTS).join("new.png").exists(), "after {k}");
    assert!(
        leftovers(data).is_empty(),
        "after {k}: {:?}",
        leftovers(data)
    );
    match take_outcome(data) {
        RestoreOutcome::Failed { message } => {
            assert!(message.contains("kept as it was"), "after {k}: {message}")
        }
        other => panic!("after {k}: {other:?}"),
    }
}

/// Runs the restore for `k` steps and stops there, as a start that was cut off. Returns whether it had finished.
fn cut_off_after(data: &Path, k: usize) -> bool {
    let mut run = Applying::begin(data).unwrap();
    (0..k).any(|_| run.step() != Next::More)
}

#[test]
fn a_good_restore_cut_off_after_any_step_is_finished_by_the_next_start() {
    for k in 0.. {
        let dir = tempfile::tempdir().unwrap();
        let data = data_with_ready_restore(dir.path(), true);
        let finished = cut_off_after(&data, k);
        apply_pending(&data);
        assert_restored(&data, k);
        if finished {
            assert!(k > 5, "the restore took only {k} steps");
            break;
        }
    }
}

#[test]
fn a_refused_restore_cut_off_after_any_step_puts_the_previous_data_back_at_the_next_start() {
    for k in 0.. {
        let dir = tempfile::tempdir().unwrap();
        let data = data_with_ready_restore(dir.path(), false);
        let finished = cut_off_after(&data, k);
        apply_pending(&data);
        assert_kept(&data, k);
        if finished {
            assert!(k > 10, "the roll back took only {k} steps");
            break;
        }
    }
}

#[test]
fn a_start_cut_off_while_the_previous_data_was_being_removed_finishes_the_removal() {
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path(), true);
    let journal = std::fs::read_to_string(staging(&data).join(JOURNAL)).ok();
    assert_eq!(journal, None, "no journal before the first start");
    let mut run = Applying::begin(&data).unwrap();
    let old = run.old.clone();
    while run.step() == Next::More {}
    // Cut off half way through removing the previous data: part of it is still there, the marker and journal too.
    std::fs::create_dir_all(old.join(OUTPUTS)).unwrap();
    std::fs::write(old.join(OUTPUTS).join("old.png"), b"current picture").unwrap();
    apply_pending(&data);
    assert_restored(&data, usize::MAX);
}

#[test]
fn a_start_cut_off_while_the_staging_folder_was_being_removed_applies_nothing_again() {
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path(), true);
    apply_pending(&data);
    assert_restored(&data, usize::MAX);
    // The marker is removed first, so a cut-off removal leaves at most the rest of the folder.
    std::fs::create_dir_all(staging(&data)).unwrap();
    std::fs::write(staging(&data).join(UI_STATE), b"{}").unwrap();
    apply_pending(&data);
    assert_eq!(which(&data).as_deref(), Some("restored"));
    assert!(leftovers(&data).is_empty());
    assert_eq!(take_outcome(&data), RestoreOutcome::None);
    // A marker left without the journal and the restored items (as the order before 2026-10-31 could leave it) is
    // refused before anything moves: that start once moved the restored data aside and deleted it.
    std::fs::create_dir_all(staging(&data)).unwrap();
    std::fs::write(staging(&data).join(READY), b"").unwrap();
    apply_pending(&data);
    assert_eq!(which(&data).as_deref(), Some("restored"));
    assert!(data.join(OUTPUTS).join("new.png").is_file());
    assert!(leftovers(&data).is_empty());
    assert!(matches!(take_outcome(&data), RestoreOutcome::Failed { .. }));
}

#[test]
fn a_damaged_journal_changes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path(), true);
    for name in [
        "../outside",
        "backup-before-restore-x/../../y",
        "someone-elses-folder",
    ] {
        std::fs::write(staging(&data).join(JOURNAL), name).unwrap();
        assert!(Applying::begin(&data).is_err(), "{name}");
    }
    // A journal that is there but cannot be read is not a missing one: starting afresh would write a new journal over it
    // and lose the folder the previous data was moved into.
    let unreadable = [b'b', 0xff, 0xfe, b'x'];
    std::fs::write(staging(&data).join(JOURNAL), unreadable).unwrap();
    let err = Applying::begin(&data).err().unwrap();
    assert!(err.contains("cannot read the restore journal"), "{err}");
    assert_eq!(
        std::fs::read(staging(&data).join(JOURNAL)).unwrap(),
        unreadable
    );
    std::fs::remove_file(staging(&data).join(JOURNAL)).unwrap();
    std::fs::remove_file(staging(&data).join(DATABASE)).unwrap();
    assert!(Applying::begin(&data).is_err(), "no database to restore");
    assert_eq!(which(&data).as_deref(), Some("current"));
}

#[test]
fn a_refused_restore_into_an_empty_data_folder_says_the_data_was_kept() {
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path(), false);
    // Nothing of the current data is there, so nothing is moved aside and no folder for it is made.
    for item in [DATABASE, OUTPUTS, THUMBNAILS] {
        let _ = std::fs::remove_dir_all(data.join(item));
        let _ = std::fs::remove_file(data.join(item));
    }
    apply_pending(&data);
    match take_outcome(&data) {
        RestoreOutcome::Failed { message } => {
            assert!(message.contains("kept as it was"), "{message}")
        }
        other => panic!("{other:?}"),
    }
    assert!(leftovers(&data).is_empty());
}

#[test]
fn a_folder_of_the_previous_data_that_cannot_be_removed_is_named() {
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path(), false);
    let mut run = Applying::begin(&data).unwrap();
    let old = run.old.clone();
    let mut last = Next::More;
    for _ in 0..8 {
        last = run.step();
        if last != Next::More {
            break;
        }
        // Something that is not the data's lands in the folder of the previous data, so it cannot be removed empty.
        if old.is_dir() {
            std::fs::write(old.join("someone-elses.txt"), b"x").unwrap();
        }
    }
    while last == Next::More {
        last = run.step();
    }
    match last {
        Next::Refused(message) => {
            assert!(
                message.contains("putting the previous data back failed"),
                "{message}"
            );
            assert!(message.contains(&old.display().to_string()), "{message}");
        }
        other => panic!("{other:?}"),
    }
    assert_eq!(which(&data).as_deref(), Some("current"));
}
