//! Saving one setting when the settings file is in use or its folder is not a folder. Windows only (a file that is open
//! without delete sharing cannot be replaced there).
#![cfg(windows)]
use novira_core::Settings;
use std::os::windows::fs::OpenOptionsExt;

#[test]
fn a_settings_file_that_is_in_use_cannot_be_replaced() {
    let dir = tempfile::tempdir().unwrap();
    Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(true)).unwrap();
    let held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(3)
        .open(dir.path().join("settings.json"))
        .unwrap();
    let err =
        Settings::save_key(dir.path(), "lowMemoryMode", serde_json::json!(false)).unwrap_err();
    drop(held);
    assert!(err.contains("cannot write settings.json"), "{err}");
    // The value on disk is still the earlier one.
    assert!(Settings::load(dir.path()).unwrap().low_memory_mode);
}
