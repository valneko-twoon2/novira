//! Starting and stopping the ComfyUI process novira owns, with a fake `python` (a batch file) that logs its arguments
//! and keeps running. Windows only, like the fake interpreter.
#![cfg(windows)]
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig, LOW_MEMORY_FLAG};
use std::path::{Path, PathBuf};
use std::time::Duration;

fn fake_python(dir: &Path, body: &[&str]) -> PathBuf {
    let path = dir.join("python.cmd");
    std::fs::write(&path, format!("@echo off\r\n{}\r\n", body.join("\r\n"))).unwrap();
    path
}

/// A ComfyUI folder with a `main.py` and a data folder holding the log, as the app lays them out.
fn config(root: &Path, python: Option<PathBuf>) -> OwnedProcessConfig {
    let comfy = root.join("comfy");
    std::fs::create_dir_all(&comfy).unwrap();
    std::fs::write(comfy.join("main.py"), "").unwrap();
    OwnedProcessConfig {
        comfyui_dir: comfy,
        python,
        host: "127.0.0.1".into(),
        port: 8199,
        extra_model_paths: root.join("extra.yaml"),
        extra_args: vec!["--fast".into()],
        log_file: root.join("data").join("logs").join("comfyui.log"),
    }
}

fn wait_for(mut f: impl FnMut() -> bool) {
    for _ in 0..200 {
        if f() {
            return;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    panic!("timed out");
}

#[test]
fn the_process_starts_once_logs_its_arguments_and_stops() {
    let root = tempfile::tempdir().unwrap();
    let python = fake_python(root.path(), &["echo ARGS %*", "ping -n 30 127.0.0.1 >nul"]);
    let cfg = config(root.path(), Some(python));
    let log = cfg.log_file.clone();
    let p = ComfyProcess::new(cfg);
    assert!(!p.is_running());
    p.start().unwrap();
    assert!(p.is_running());
    // Starting again while it runs does nothing.
    p.start().unwrap();
    wait_for(|| std::fs::read_to_string(&log).is_ok_and(|t| t.contains("ARGS")));
    let text = std::fs::read_to_string(&log).unwrap();
    assert!(
        text.contains("main.py --listen 127.0.0.1 --port 8199"),
        "{text}"
    );
    assert!(text.contains("--fast") && !text.contains(LOW_MEMORY_FLAG));
    // The caches are kept in the data folder.
    assert!(root
        .path()
        .join("data")
        .join("cache")
        .join("huggingface")
        .is_dir());

    // The running process keeps its mode; the next start would use the new one.
    assert!(!p.low_memory_pending());
    p.set_low_memory(true);
    assert!(p.low_memory_pending());
    p.set_low_memory(false);
    assert!(!p.low_memory_pending());

    p.stop();
    assert!(!p.is_running());
    // Stopping twice is fine.
    p.stop();
}

#[test]
fn a_process_started_in_low_memory_mode_carries_the_flag() {
    let root = tempfile::tempdir().unwrap();
    let python = fake_python(root.path(), &["echo ARGS %*", "ping -n 30 127.0.0.1 >nul"]);
    let cfg = config(root.path(), Some(python));
    let log = cfg.log_file.clone();
    let p = ComfyProcess::new(cfg);
    p.set_low_memory(true);
    p.start().unwrap();
    wait_for(|| std::fs::read_to_string(&log).is_ok_and(|t| t.contains("ARGS")));
    assert!(std::fs::read_to_string(&log)
        .unwrap()
        .contains(LOW_MEMORY_FLAG));
    assert!(!p.low_memory_pending());
    p.set_low_memory(false);
    assert!(p.low_memory_pending());
}

#[test]
fn a_process_that_exits_is_noticed_and_can_be_started_again() {
    let root = tempfile::tempdir().unwrap();
    let python = fake_python(root.path(), &["exit /b 0"]);
    let p = ComfyProcess::new(config(root.path(), Some(python)));
    p.start().unwrap();
    wait_for(|| !p.is_running());
    p.start().unwrap();
    wait_for(|| !p.is_running());
}

#[test]
fn an_interpreter_that_cannot_start_is_reported() {
    let root = tempfile::tempdir().unwrap();
    let p = ComfyProcess::new(config(root.path(), Some(root.path().join("no-python.exe"))));
    let err = p.start().unwrap_err();
    assert!(err.contains("Cannot start ComfyUI"), "{err}");
    assert!(!p.is_running());
}

#[test]
fn a_log_folder_that_cannot_be_made_is_reported() {
    let root = tempfile::tempdir().unwrap();
    let mut cfg = config(root.path(), None);
    std::fs::write(root.path().join("blocked"), "x").unwrap();
    cfg.log_file = root.path().join("blocked").join("comfyui.log");
    assert!(ComfyProcess::new(cfg).start().is_err());
}

#[test]
fn without_an_explicit_python_the_one_next_to_the_install_is_used() {
    let root = tempfile::tempdir().unwrap();
    let cfg = config(root.path(), None);
    // `venv\Scripts\python.exe` inside the folder wins; it is not a program, so starting fails with its path.
    let venv = cfg.comfyui_dir.join("venv").join("Scripts");
    std::fs::create_dir_all(&venv).unwrap();
    std::fs::write(venv.join("python.exe"), "not a program").unwrap();
    let found = novira_core::comfy::process::find_python(&cfg.comfyui_dir);
    assert_eq!(found, venv.join("python.exe"));
    let err = ComfyProcess::new(cfg).start().unwrap_err();
    assert!(err.contains("python.exe"), "{err}");
}
