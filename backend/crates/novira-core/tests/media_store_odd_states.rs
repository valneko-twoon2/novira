//! The picture store when its folders are gone, taken by files, or hold more than pictures: the index of
//! `outputs/` with sub-folders, moving into a folder that cannot be made, and a trash that cannot be opened.
use novira_core::media::images::{self, ImageFiles};
use std::path::Path;

fn png() -> Vec<u8> {
    let img = image::RgbImage::from_pixel(8, 8, image::Rgb([10, 20, 30]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

#[test]
fn a_store_whose_outputs_folder_vanished_indexes_nothing_and_cleans_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    std::fs::remove_dir_all(dir.path().join("outputs")).unwrap();
    assert_eq!(files.index(), 0);
    files.remove_empty_folders();
}

#[test]
fn the_index_finds_pictures_in_sub_folders_and_skips_what_is_not_one() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let outputs = dir.path().join("outputs");
    let top = images::new_name();
    let deep = images::new_name();
    std::fs::write(outputs.join(&top), png()).unwrap();
    std::fs::create_dir_all(outputs.join("board").join("nested")).unwrap();
    std::fs::write(outputs.join("board").join(&deep), png()).unwrap();
    std::fs::write(outputs.join("board").join("notes.txt"), b"x").unwrap();
    std::fs::write(outputs.join("readme.txt"), b"x").unwrap();
    assert_eq!(files.index(), 2);
    assert_eq!(
        files.original_path(&deep).unwrap(),
        outputs.join("board").join(&deep)
    );
    // An empty board folder goes, a folder with a picture stays.
    std::fs::create_dir_all(outputs.join("empty")).unwrap();
    files.remove_empty_folders();
    assert!(!outputs.join("empty").exists());
    assert!(outputs.join("board").join(&deep).exists());
}

#[test]
fn moving_a_picture_is_refused_or_fails_cleanly() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    // A name that is not a picture name, and a picture with no file.
    assert!(!files.move_to("../x", Path::new("a/x.png")).unwrap());
    let name = images::new_name();
    assert!(!files
        .move_to(&name, Path::new("a").join(&name).as_path())
        .unwrap());
    // A target folder that cannot be made because a file has its name.
    files.store(&name, &png()).unwrap();
    std::fs::write(dir.path().join("outputs").join("blocked"), b"file").unwrap();
    let rel = Path::new("blocked").join("inner").join(&name);
    assert!(files.move_to(&name, &rel).is_err());
    assert!(files.original_path(&name).unwrap().is_file());
}

#[test]
fn a_trash_that_cannot_be_made_keeps_the_picture_where_it_is() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let name = images::new_name();
    files.store(&name, &png()).unwrap();
    std::fs::write(dir.path().join("trash"), b"a file").unwrap();
    assert!(!files.trash(&name));
    assert!(files.original_path(&name).unwrap().is_file());
    // Invalid names are refused by trash and restore alike.
    assert!(!files.trash("../x.png"));
    assert!(!files.restore("../x.png"));
    files.purge("../x.png");
}

fn picture(name: &str, board: Option<&str>) -> novira_core::types::ImageDTO {
    serde_json::from_value(serde_json::json!({
        "name": name, "url": "", "thumbnailUrl": "", "width": 8, "height": 8, "createdAt": 1_700_000_000_000i64,
        "boardId": board, "starred": false, "isIntermediate": false, "category": "general",
        "metadata": null, "workflow": null
    }))
    .unwrap()
}

#[test]
fn a_picture_whose_folder_place_is_taken_stays_where_it_is() {
    use novira_core::media::arrangement::{arrange, place_of};
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let name = images::new_name();
    files.store(&name, &png()).unwrap();
    let image = picture(&name, None);
    // Another file already sits where the picture belongs.
    let target = dir
        .path()
        .join("outputs")
        .join(place_of(&image, &Default::default()));
    std::fs::create_dir_all(target.parent().unwrap()).unwrap();
    std::fs::write(&target, b"other").unwrap();
    arrange(&files, &[], [&image]);
    assert_eq!(std::fs::read(&target).unwrap(), b"other");
    assert!(files.read_original(&name).is_some());
}

#[test]
fn every_export_format_has_its_content_type() {
    use novira_core::media::export::ExportFormat;
    assert_eq!(ExportFormat::Webp.content_type(), "image/webp");
    assert_eq!(ExportFormat::Png.content_type(), "image/png");
    assert_eq!(ExportFormat::Jpeg.content_type(), "image/jpeg");
}
