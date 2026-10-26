use super::*;
use crate::types::{ImageCategory, MediaType};
use std::path::Path;

fn board(id: &str, name: &str, created_at: i64) -> BoardDTO {
    BoardDTO {
        id: id.into(),
        name: name.into(),
        archived: false,
        created_at,
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
