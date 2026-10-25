//! `Backend::open` with the settings that choose the engine (novira's own ComfyUI, a server at a URL, a ComfyUI
//! folder), and the failures of reading and writing `settings.json`.
use novira_core::settings::SETTINGS_FILE;
use novira_core::{Backend, BackendConfig, BackendError, Settings};

fn open(dir: &std::path::Path, settings: Settings) -> Result<Backend, BackendError> {
    Backend::open(BackendConfig {
        data_dir: dir.to_path_buf(),
        image_url_base: "http://novira-image.localhost/".into(),
        settings,
    })
}

fn quiet() -> Settings {
    Settings {
        gpu_lock: String::new(),
        ..Settings::default()
    }
}

#[test]
fn novira_own_comfyui_is_the_default_and_nothing_starts_until_it_is_needed() {
    let dir = tempfile::tempdir().unwrap();
    let backend = open(dir.path(), quiet()).unwrap();
    // The folders for models exist, and no ComfyUI folder was created or started.
    assert!(dir.path().join("models").join("checkpoints").is_dir());
    assert!(dir.path().join("extra_model_paths.yaml").is_file());
    assert!(!dir.path().join("comfyui").join("ComfyUI").exists());
    let _ = backend.engine_status();
}

#[test]
fn a_server_at_a_url_is_used_as_it_is() {
    let dir = tempfile::tempdir().unwrap();
    let settings = Settings {
        comfyui_url: Some("http://127.0.0.1:9".into()),
        ..quiet()
    };
    assert!(open(dir.path(), settings).is_ok());
}

#[test]
fn a_comfyui_folder_and_python_of_the_users_are_accepted() {
    let dir = tempfile::tempdir().unwrap();
    let settings = Settings {
        comfyui_dir: Some(dir.path().join("my-comfy")),
        comfyui_python: Some(dir.path().join("python.exe")),
        comfyui_args: vec!["--fast".into()],
        model_roots: vec![dir.path().join("elsewhere")],
        low_memory_mode: true,
        ..quiet()
    };
    assert!(open(dir.path(), settings).is_ok());
}

#[test]
fn a_comfyui_folder_started_at_a_url_must_be_on_this_pc() {
    // With both settings, novira starts the folder's ComfyUI listening on the URL's address: only this PC is accepted.
    let dir = tempfile::tempdir().unwrap();
    let both = |url: &str| Settings {
        comfyui_url: Some(url.into()),
        comfyui_dir: Some(dir.path().join("my-comfy")),
        ..quiet()
    };
    for ok in [
        "http://127.0.0.1:8190",
        "http://localhost:8190",
        "http://[::1]:8190",
    ] {
        assert!(open(dir.path(), both(ok)).is_ok(), "{ok}");
    }
    for elsewhere in [
        "http://0.0.0.0:8190",
        "http://192.168.1.20:8190",
        "http://comfy.example:8190",
        "http://127.0.0.1.evil.example:8190",
    ] {
        let Err(err) = open(dir.path(), both(elsewhere)) else {
            panic!("{elsewhere} must be refused")
        };
        assert!(
            matches!(&err, BackendError::Invalid(m) if m.contains("comfyuiUrl") && m.contains("this PC")),
            "{elsewhere}: {err}"
        );
    }
    // A server at a URL that novira does not start can be anywhere.
    let remote = Settings {
        comfyui_url: Some("http://192.168.1.20:8188".into()),
        ..quiet()
    };
    assert!(open(dir.path(), remote).is_ok());
}

#[test]
fn an_unusable_url_is_refused_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let settings = Settings {
        comfyui_url: Some("not a url".into()),
        ..quiet()
    };
    let Err(err) = open(dir.path(), settings) else {
        panic!("a broken URL must be refused")
    };
    assert!(
        matches!(&err, BackendError::Invalid(m) if m.contains("comfyuiUrl")),
        "{err}"
    );
    let settings = Settings {
        comfyui_url: Some("ftp://127.0.0.1:21".into()),
        ..quiet()
    };
    assert!(open(dir.path(), settings).is_err());
}

#[test]
fn a_settings_file_that_cannot_be_read_is_an_error_and_is_not_replaced() {
    let dir = tempfile::tempdir().unwrap();
    // A folder where the file should be: reading fails with something other than "not found".
    std::fs::create_dir(dir.path().join(SETTINGS_FILE)).unwrap();
    assert!(Settings::load(dir.path())
        .unwrap_err()
        .contains("cannot read"));
    let err = Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(true)).unwrap_err();
    assert!(err.contains("cannot read"), "{err}");
}

#[test]
fn a_settings_file_that_is_not_an_object_is_left_alone() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join(SETTINGS_FILE), "[1, 2]").unwrap();
    let err = Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(true)).unwrap_err();
    assert!(err.contains("not an object"), "{err}");
    assert_eq!(
        std::fs::read_to_string(dir.path().join(SETTINGS_FILE)).unwrap(),
        "[1, 2]"
    );
}

#[test]
fn a_blocked_temporary_file_fails_the_save_and_keeps_the_old_file() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join(SETTINGS_FILE), r#"{"gpuLock":""}"#).unwrap();
    std::fs::create_dir(dir.path().join(format!("{SETTINGS_FILE}.tmp"))).unwrap();
    let err = Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(true)).unwrap_err();
    assert!(err.contains("cannot write"), "{err}");
    assert_eq!(
        std::fs::read_to_string(dir.path().join(SETTINGS_FILE)).unwrap(),
        r#"{"gpuLock":""}"#
    );
}

#[test]
fn saving_into_a_folder_that_does_not_exist_fails() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("nope");
    let err = Settings::save_key(&missing, "lowMemoryMode", serde_json::json!(true)).unwrap_err();
    assert!(err.contains("cannot write"), "{err}");
}
