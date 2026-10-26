use super::*;

fn choice(dir: &Path, data: &str, comfyui: Option<&str>) -> Choice {
    Choice {
        data_dir: dir.join(data),
        comfyui_dir: comfyui.map(|c| dir.join(c)),
    }
}

#[test]
fn it_is_a_first_start_only_when_no_pointer_and_no_data_exist() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("cfg").join("data-location.json");
    let beside = dir.path().join("app").join("novira-data");
    let user = dir.path().join("user").join("novira-data");
    assert!(needed(&pointer, &[&beside, &user]));
    std::fs::create_dir_all(&beside).unwrap();
    assert!(!needed(&pointer, &[&beside, &user]), "data beside the app");
    std::fs::remove_dir_all(&beside).unwrap();
    std::fs::create_dir_all(&user).unwrap();
    assert!(
        !needed(&pointer, &[&beside, &user]),
        "data an older version left"
    );
    std::fs::remove_dir_all(&user).unwrap();
    std::fs::create_dir_all(pointer.parent().unwrap()).unwrap();
    std::fs::write(&pointer, "{}").unwrap();
    assert!(
        !needed(&pointer, &[&beside, &user]),
        "a pointer already exists"
    );
}

#[test]
fn a_choice_makes_the_folder_the_setting_and_the_pointer() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("cfg").join("data-location.json");
    let c = choice(dir.path(), "data", Some("engine"));
    apply(&pointer, &c).unwrap();
    assert!(c.data_dir.is_dir());
    assert_eq!(data_location::read(&pointer).unwrap().data_dir, c.data_dir);
    let saved = Settings::load(&c.data_dir).unwrap();
    assert_eq!(saved.comfyui_install_dir, c.comfyui_dir);
}

#[test]
fn without_a_comfyui_folder_the_setting_is_left_out() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("p.json");
    let c = choice(dir.path(), "data", None);
    apply(&pointer, &c).unwrap();
    assert!(!c.data_dir.join(settings::SETTINGS_FILE).exists());
    assert!(!needed(&pointer, &[]));
}

#[test]
fn a_bad_choice_changes_nothing_and_stays_a_first_start() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("p.json");
    let file = dir.path().join("file.txt");
    std::fs::write(&file, "x").unwrap();
    let full = dir.path().join("full");
    std::fs::create_dir_all(&full).unwrap();
    std::fs::write(full.join("stuff.txt"), "x").unwrap();
    let data = dir.path().join("data");
    let only = |data_dir: PathBuf| Choice {
        data_dir,
        comfyui_dir: None,
    };
    let with = |comfyui: PathBuf| Choice {
        data_dir: data.clone(),
        comfyui_dir: Some(comfyui),
    };
    for bad in [
        only(PathBuf::from("relative")),
        only(file.clone()),
        only(dir.path().join("a").join("..").join("b")),
        with(data.clone()),
        with(full.clone()),
        with(PathBuf::from("rel")),
    ] {
        assert!(apply(&pointer, &bad).is_err(), "{bad:?}");
    }
    assert!(!pointer.exists());
    assert!(!data.exists());
}

#[test]
fn a_folder_that_already_holds_data_is_accepted_as_it_is() {
    let dir = tempfile::tempdir().unwrap();
    let pointer = dir.path().join("p.json");
    let existing = dir.path().join("library");
    std::fs::create_dir_all(&existing).unwrap();
    std::fs::write(existing.join("novira.sqlite"), "db").unwrap();
    let c = Choice {
        data_dir: existing.clone(),
        comfyui_dir: None,
    };
    apply(&pointer, &c).unwrap();
    assert!(existing.join("novira.sqlite").is_file());
}
