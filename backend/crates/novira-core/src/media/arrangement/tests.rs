use super::*;
use crate::types::{ImageCategory, MediaType};
use std::path::Path;

fn board(id: &str, name: &str, created_at: i64) -> BoardDTO {
    BoardDTO {
        id: id.into(),
        name: name.into(),
        archived: false,
        created_at,
        parent_id: None,
    }
}

fn picture(name: &str, board_id: Option<&str>, is_intermediate: bool) -> ImageDTO {
    ImageDTO {
        name: name.into(),
        media_type: MediaType::Image,
        url: String::new(),
        thumbnail_url: String::new(),
        width: 8,
        height: 8,
        created_at: 0,
        board_id: board_id.map(Into::into),
        starred: false,
        is_intermediate,
        category: ImageCategory::General,
        metadata: None,
        workflow: None,
    }
}

const NAME: &str = "0123456789abcdef0123456789abcdef.png";

#[test]
fn a_board_name_becomes_a_folder_name_windows_accepts() {
    assert_eq!(safe_folder("風景 / 夜"), "風景 _ 夜");
    assert_eq!(safe_folder("a:b*c?\"d<e>f|g\\h"), "a_b_c__d_e_f_g_h");
    assert_eq!(safe_folder("trailing. . "), "trailing");
    assert_eq!(safe_folder("  "), "_");
    assert_eq!(safe_folder("..."), "_");
    assert_eq!(safe_folder(".hidden"), "_.hidden");
    assert_eq!(safe_folder("CON"), "_CON");
    assert_eq!(safe_folder("tab\there"), "tab_here");
    assert_eq!(safe_folder(&"長".repeat(100)).chars().count(), 60);
}

#[test]
fn boards_of_the_same_folder_name_are_told_apart_and_the_older_keeps_the_plain_one() {
    let boards = [
        board("b2", "Landscapes", 20),
        board("b1", "landscapes", 10),
        board("b3", "未分類", 30),
        board("b4", "Landscapes", 40),
        board("b5", "Portraits", 50),
    ];
    let folders = folder_names(&boards);
    assert_eq!(folders["b1"], "landscapes");
    assert_eq!(folders["b2"], "Landscapes (2)");
    assert_eq!(folders["b4"], "Landscapes (3)");
    assert_eq!(
        folders["b3"], "未分類 (2)",
        "the uncategorized folder keeps its name"
    );
    assert_eq!(folders["b5"], "Portraits");
}

#[test]
fn a_subfolder_sits_inside_its_board_and_is_told_apart_from_its_siblings_only() {
    let mut cat = board("c1", "Cats", 2);
    cat.parent_id = Some("b1".into());
    let mut cat2 = board("c2", "cats", 3);
    cat2.parent_id = Some("b1".into());
    let mut same = board("c3", "Sea", 4);
    same.parent_id = Some("b2".into());
    let mut orphan = board("c4", "Lost", 5);
    orphan.parent_id = Some("gone".into());
    let mut deep = board("c5", "Deep", 6);
    deep.parent_id = Some("c1".into());
    let folders = folder_names(&[
        board("b1", "Sea", 1),
        board("b2", "Land", 1),
        cat,
        cat2,
        same,
        orphan,
        deep,
    ]);
    assert_eq!(folders["c1"], "Sea/Cats");
    assert_eq!(folders["c2"], "Sea/cats (2)");
    assert_eq!(
        folders["c3"], "Land/Sea",
        "a sibling name is free in another board"
    );
    assert_eq!(
        folders["c4"], "Lost",
        "a subfolder without its board sits at the top"
    );
    assert_eq!(
        folders["c5"], "Sea/Cats/Deep",
        "a subfolder of a subfolder sits inside it"
    );
    let image = picture(NAME, Some("c1"), false);
    assert_eq!(
        place_of(&image, &folders),
        Path::new("Sea").join("Cats").join(file_name(NAME, 0))
    );
}

#[test]
fn a_file_in_a_subfolder_is_found_again_and_an_emptied_subfolder_is_removed() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    std::fs::write(outputs.join(NAME), b"png").unwrap();
    let image = picture(NAME, Some("c1"), false);
    let mut cats = board("c1", "Cats", 2);
    cats.parent_id = Some("b1".into());
    let boards = [board("b1", "Sea", 1), cats];
    files.index();
    arrange(&files, &boards, [&image]);
    let placed = outputs.join("Sea").join("Cats").join(file_name(NAME, 0));
    assert!(placed.is_file());
    assert_eq!(files.index(), 1);
    assert_eq!(files.read_original(NAME).unwrap(), b"png");

    let loose = picture(NAME, None, false);
    arrange(&files, &boards, [&loose]);
    assert!(outputs
        .join(UNCATEGORIZED)
        .join(file_name(NAME, 0))
        .is_file());
    assert!(
        !outputs.join("Sea").exists(),
        "both emptied folders are gone"
    );
}

#[test]
fn a_file_is_named_by_when_it_was_made_and_found_again_by_its_name() {
    let file = file_name(NAME, 0);
    assert_eq!(file.len(), 16 + NAME.len());
    assert!(file[..8].bytes().all(|b| b.is_ascii_digit()) && &file[8..9] == "_");
    assert_eq!(name_in(&file), Some(NAME));
    assert_eq!(name_in(NAME), Some(NAME), "a file an older version stored");
    assert_eq!(name_in("20261026_184112_notes.txt"), None);
    assert_eq!(name_in("desktop.ini"), None);
    assert_eq!(name_in(&format!("{NAME}.tmp")), None);
}

#[test]
fn a_picture_goes_to_its_board_or_the_uncategorized_or_the_drafts_folder() {
    let folders = folder_names(&[board("b1", "風景", 1)]);
    let folder = |p: &ImageDTO| place_of(p, &folders).parent().unwrap().to_path_buf();
    assert_eq!(folder(&picture(NAME, Some("b1"), false)), Path::new("風景"));
    assert_eq!(
        folder(&picture(NAME, None, false)),
        Path::new(UNCATEGORIZED)
    );
    assert_eq!(
        folder(&picture(NAME, Some("gone"), false)),
        Path::new(UNCATEGORIZED)
    );
    assert_eq!(folder(&picture(NAME, Some("b1"), true)), Path::new(DRAFTS));
}

#[test]
fn arranging_moves_files_into_their_folders_follows_a_rename_and_leaves_no_empty_folder() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    std::fs::write(outputs.join(NAME), b"png").unwrap();
    let image = picture(NAME, Some("b1"), false);
    files.index();
    arrange(&files, &[board("b1", "Sea", 1)], [&image]);
    let placed = outputs.join("Sea").join(file_name(NAME, 0));
    assert_eq!(std::fs::read(&placed).unwrap(), b"png");
    assert!(!outputs.join(NAME).exists());
    assert_eq!(files.read_original(NAME).unwrap(), b"png");

    arrange(&files, &[board("b1", "Ocean", 1)], [&image]);
    assert!(outputs.join("Ocean").join(file_name(NAME, 0)).is_file());
    assert!(
        !outputs.join("Sea").exists(),
        "the old folder is removed once empty"
    );

    // A new start finds it again by the name its file holds.
    let again = ImageFiles::new(dir.path()).unwrap();
    assert_eq!(again.index(), 1);
    assert_eq!(again.read_original(NAME).unwrap(), b"png");
}

#[test]
fn a_file_already_at_the_place_is_never_replaced() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    std::fs::write(outputs.join(NAME), b"mine").unwrap();
    let rel = Path::new(UNCATEGORIZED).join(file_name(NAME, 0));
    std::fs::create_dir_all(outputs.join(UNCATEGORIZED)).unwrap();
    std::fs::write(outputs.join(&rel), b"other").unwrap();
    assert!(files.move_to(NAME, &rel).is_err());
    assert_eq!(std::fs::read(outputs.join(NAME)).unwrap(), b"mine");
    assert_eq!(std::fs::read(outputs.join(&rel)).unwrap(), b"other");
    // A name with no file moves nothing.
    assert!(!files
        .move_to("ffffffffffffffffffffffffffffffff.png", &rel)
        .unwrap());
}

#[test]
fn arranging_a_few_pictures_looks_only_at_the_folders_they_left() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    // A folder that was empty before and has nothing to do with the pictures arranged stays, as only `arrange_all`
    // lists every folder; the folder the picture leaves goes.
    std::fs::create_dir_all(outputs.join("Old board")).unwrap();
    std::fs::create_dir_all(outputs.join("Sea")).unwrap();
    std::fs::write(outputs.join("Sea").join(file_name(NAME, 0)), b"png").unwrap();
    let image = picture(NAME, None, false);
    files.index();
    arrange(&files, &[board("b1", "Sea", 1)], [&image]);
    assert!(outputs
        .join(UNCATEGORIZED)
        .join(file_name(NAME, 0))
        .is_file());
    assert!(
        !outputs.join("Sea").exists(),
        "the folder the picture left is removed"
    );
    assert!(
        outputs.join("Old board").is_dir(),
        "an unrelated empty folder is not looked at"
    );
    // The pass over the whole gallery removes it too.
    arrange_all(&files, &[board("b1", "Sea", 1)], [&image]);
    assert!(!outputs.join("Old board").exists());
}

#[test]
fn a_folder_that_still_holds_something_stays_when_one_picture_leaves() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    let other = "fedcba9876543210fedcba9876543210.png";
    std::fs::create_dir_all(outputs.join("Sea")).unwrap();
    std::fs::write(outputs.join("Sea").join(file_name(NAME, 0)), b"a").unwrap();
    std::fs::write(outputs.join("Sea").join(file_name(other, 0)), b"b").unwrap();
    files.index();
    arrange(
        &files,
        &[board("b1", "Sea", 1)],
        [&picture(NAME, None, false)],
    );
    assert!(outputs.join("Sea").join(file_name(other, 0)).is_file());
    assert!(outputs
        .join(UNCATEGORIZED)
        .join(file_name(NAME, 0))
        .is_file());
}

#[test]
fn trashing_the_last_picture_of_a_folder_removes_the_folder_and_never_outputs_itself() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    std::fs::create_dir_all(outputs.join("Sea").join("Cats")).unwrap();
    std::fs::write(
        outputs.join("Sea").join("Cats").join(file_name(NAME, 0)),
        b"png",
    )
    .unwrap();
    files.index();
    assert!(files.trash(NAME));
    assert!(
        !outputs.join("Sea").exists(),
        "the emptied subfolder and its parent are gone"
    );
    assert!(outputs.is_dir());
    // A flat file (an older version's) leaves no folder to remove, and `outputs/` stays.
    let flat = "0000000000000000000000000000000a.png";
    std::fs::write(outputs.join(flat), b"x").unwrap();
    files.index();
    assert!(files.trash(flat));
    assert!(outputs.is_dir());
}

#[test]
fn a_parent_made_in_the_same_instant_as_its_subfolder_still_comes_first() {
    let mut inner = board("a", "Inner", 1);
    inner.parent_id = Some("z".into());
    let folders = folder_names(&[inner, board("z", "Outer", 1)]);
    assert_eq!(folders["a"], "Outer/Inner");
}

#[test]
fn a_deep_board_keeps_its_folder_path_short_and_the_first_two_levels_their_names() {
    let name = "n".repeat(60);
    let mut boards = vec![board("l0", &name, 0)];
    for level in 1..8 {
        let mut b = board(&format!("l{level}"), &name, level);
        b.parent_id = Some(format!("l{}", level - 1));
        boards.push(b);
    }
    let folders = folder_names(&boards);
    assert_eq!(folders["l1"], format!("{name}/{name}"));
    let deepest = &folders["l7"];
    assert_eq!(deepest.matches('/').count(), 7);
    assert!(deepest.chars().count() <= 121 + 6 * 7, "{deepest}");
}

#[test]
fn boards_in_a_loop_get_no_folder_and_do_not_hang() {
    let mut a = board("a", "A", 1);
    a.parent_id = Some("b".into());
    let mut b = board("b", "B", 2);
    b.parent_id = Some("a".into());
    assert!(folder_names(&[a, b]).is_empty());
}

/// A file `levels` folders below `outputs/`, named the way the arrangement names it.
fn nested_file(dir: &Path, levels: usize) -> std::path::PathBuf {
    let mut folder = dir.join("outputs");
    for n in 0..levels {
        folder = folder.join(format!("level{n}"));
    }
    std::fs::create_dir_all(&folder).unwrap();
    let file = folder.join(file_name(NAME, 0));
    std::fs::write(&file, b"png").unwrap();
    file
}

#[test]
fn a_file_in_a_board_nested_three_levels_deep_is_found_by_its_name() {
    // A board three levels down lives in `outputs/<board>/<sub>/<subsub>/`; its pictures must open from there.
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    nested_file(dir.path(), 3);
    assert_eq!(files.index(), 1);
    assert_eq!(files.read_original(NAME).unwrap(), b"png");
}

#[test]
fn a_file_is_found_at_every_level_boards_can_nest_to() {
    for levels in 1..=crate::service::MAX_BOARD_DEPTH {
        let dir = tempfile::tempdir().unwrap();
        let files = ImageFiles::new(dir.path()).unwrap();
        nested_file(dir.path(), levels);
        assert_eq!(files.index(), 1, "{levels} levels");
        assert!(files.read_original(NAME).is_some(), "{levels} levels");
    }
}

#[test]
fn empty_folders_are_removed_at_every_level_boards_can_nest_to_and_a_folder_with_a_file_stays() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    // Eight levels, all empty, beside a branch that keeps a picture three levels down.
    let mut deep = outputs.join("empty0");
    for n in 1..crate::service::MAX_BOARD_DEPTH {
        deep = deep.join(format!("empty{n}"));
    }
    std::fs::create_dir_all(&deep).unwrap();
    let kept = outputs.join("keep0").join("keep1").join("keep2");
    std::fs::create_dir_all(&kept).unwrap();
    std::fs::write(kept.join(file_name(NAME, 0)), b"png").unwrap();
    files.remove_empty_folders();
    assert!(!outputs.join("empty0").exists(), "the empty branch is gone");
    assert!(kept.join(file_name(NAME, 0)).is_file());
}
