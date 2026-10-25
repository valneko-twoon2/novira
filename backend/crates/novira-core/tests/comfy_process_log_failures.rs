//! Starting the ComfyUI process when its log file cannot be opened: the start is refused with the reason and nothing is
//! left running.
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use std::path::Path;

fn config(root: &Path) -> OwnedProcessConfig {
    let comfy = root.join("comfy");
    std::fs::create_dir_all(&comfy).unwrap();
    std::fs::write(comfy.join("main.py"), "").unwrap();
    OwnedProcessConfig {
        comfyui_dir: comfy,
        python: None,
        host: "127.0.0.1".into(),
        port: 8199,
        extra_model_paths: root.join("extra.yaml"),
        extra_args: vec![],
        log_file: root.join("data").join("logs").join("comfyui.log"),
    }
}

#[test]
fn a_log_file_that_cannot_be_opened_is_reported() {
    let root = tempfile::tempdir().unwrap();
    let cfg = config(root.path());
    // A folder where the log file should be.
    std::fs::create_dir_all(&cfg.log_file).unwrap();
    let process = ComfyProcess::new(cfg);
    assert!(process.start().is_err());
    assert!(!process.is_running());
}
