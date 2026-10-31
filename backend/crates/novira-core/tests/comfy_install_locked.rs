//! A release install and a version switch that fail after the old package has been moved aside: a file of the new
//! package held open by another program (the folder cannot be moved), an old package whose extensions folder is gone,
//! a new version whose start is cancelled, and one whose old package cannot be put back. A fake `7zr.exe` stands in for
//! the unpacker. Windows only, like the install itself.
#![cfg(windows)]
use novira_core::comfy::install::{comfyui_dir, install_version, previous_dir, PORTABLE_DIR};
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineError, EngineStatus};
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

const FAKE_7ZR: &str = r#"
use std::{env, fs, path::Path};
fn main() {
    let args: Vec<String> = env::args().collect();
    let out = args.iter().find_map(|a| a.strip_prefix("-o")).unwrap();
    for rel in ["ComfyUI_windows_portable/ComfyUI/main.py", "ComfyUI_windows_portable/python_embeded/python.exe"] {
        let p = Path::new(out).join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, "x").unwrap();
    }
}
"#;

fn fake_tool() -> &'static Path {
    static TOOL: OnceLock<PathBuf> = OnceLock::new();
    TOOL.get_or_init(|| {
        let dir = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("fake7zr-locked");
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("fake7zr.rs");
        std::fs::write(&src, FAKE_7ZR).unwrap();
        let exe = dir.join(format!("fake7zr-{}.exe", std::process::id()));
        let status = std::process::Command::new("rustc")
            .arg(&src)
            .arg("-O")
            .arg("-o")
            .arg(&exe)
            .status()
            .expect("rustc is on PATH under cargo");
        assert!(status.success());
        exe
    })
}

fn quick_retries() {
    std::env::set_var("NOVIRA_TEST_RETRY_PAUSE_MS", "1");
}

/// A root with an old package (`main.py` says "old"), the unpacker and the archive of release v0.4.0 in place.
fn root_with_old_package(extensions_folder: bool) -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(root.path().join(".tools")).unwrap();
    std::fs::copy(fake_tool(), root.path().join(".tools").join("7zr.exe")).unwrap();
    std::fs::create_dir_all(root.path().join(".downloads")).unwrap();
    std::fs::write(
        root.path().join(".downloads").join("comfyui-v0.4.0.7z"),
        "ok",
    )
    .unwrap();
    let old = comfyui_dir(root.path());
    std::fs::create_dir_all(&old).unwrap();
    if extensions_folder {
        std::fs::create_dir_all(old.join("custom_nodes")).unwrap();
    }
    std::fs::write(old.join("main.py"), "old").unwrap();
    std::fs::write(old.join("comfyui_version.py"), "__version__ = \"0.3.0\"\n").unwrap();
    root
}

fn old_main(root: &Path) -> String {
    std::fs::read_to_string(comfyui_dir(root).join("main.py")).unwrap()
}

fn offline_client() -> reqwest::Client {
    reqwest::Client::builder()
        .proxy(reqwest::Proxy::all("http://127.0.0.1:1").unwrap())
        .build()
        .unwrap()
}

async fn release(root: &Path) -> Result<(), EngineError> {
    install_version(
        &offline_client(),
        root,
        "nvidia",
        Some("v0.4.0"),
        true,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
}

#[tokio::test]
async fn a_new_package_that_cannot_be_moved_into_place_puts_the_old_one_back() {
    quick_retries();
    let root = root_with_old_package(true);
    // A program opens the unpacked `main.py` as soon as it appears, and the folder around it cannot be moved.
    let unpacked = root
        .path()
        .join(".unpacking/ComfyUI_windows_portable/ComfyUI/main.py");
    let holder = std::thread::spawn(move || {
        let until = std::time::Instant::now() + Duration::from_secs(10);
        while std::time::Instant::now() < until {
            if unpacked.is_file() {
                if let Ok(f) = OpenOptions::new().read(true).share_mode(3).open(&unpacked) {
                    return Some(f);
                }
            }
            std::thread::sleep(Duration::from_micros(100));
        }
        None
    });
    let result = release(root.path()).await;
    let held = holder.join().unwrap();
    assert!(held.is_some(), "the unpacked file was never seen");
    let Err(EngineError::Failed(m)) = result else {
        panic!("the install should have failed: {result:?}");
    };
    assert!(m.starts_with("Cannot move "), "{m}");
    drop(held);
    assert_eq!(old_main(root.path()), "old");
    assert!(!previous_dir(root.path()).exists());
}

#[tokio::test]
async fn an_old_package_without_an_extensions_folder_cannot_hand_them_over() {
    let root = root_with_old_package(false);
    let result = release(root.path()).await;
    let Err(EngineError::Failed(m)) = result else {
        panic!("the install should have failed: {result:?}");
    };
    assert!(m.contains("Cannot move the extensions"), "{m}");
    assert_eq!(old_main(root.path()), "old");
}

/// An engine for the install on a closed port: the fake `python` exits at once, so the new version never answers.
fn engine(root: &Path) -> ComfyEngine {
    let python = root.join("python.cmd");
    std::fs::write(&python, "@echo off\r\nexit /b 9\r\n").unwrap();
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let process = ComfyProcess::new(OwnedProcessConfig {
        comfyui_dir: comfyui_dir(root),
        python: Some(python),
        host: "127.0.0.1".into(),
        port,
        extra_model_paths: root.join("extra.yaml"),
        extra_args: vec![],
        log_file: root.join("logs").join("comfyui.log"),
    });
    ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(process),
        Duration::from_secs(3),
    )
    .unwrap()
    .with_installer(root.to_path_buf(), "nvidia".into())
}

#[tokio::test]
async fn a_start_of_the_new_version_that_is_cancelled_ends_as_cancelled() {
    let root = root_with_old_package(true);
    let engine = engine(root.path());
    let cancel = CancellationToken::new();
    let trip = cancel.clone();
    engine.set_status_sink(Arc::new(move |s| {
        if s == EngineStatus::Starting {
            trip.cancel();
        }
    }));
    let result = engine
        .switch_version("v0.4.0", root.path(), &cancel, &|_, _| {})
        .await;
    assert_eq!(result, Err(EngineError::Cancelled));
    engine.shutdown();
}

#[tokio::test]
async fn a_new_version_that_does_not_start_and_an_old_one_that_cannot_come_back_report_the_start() {
    let root = root_with_old_package(true);
    let engine = engine(root.path());
    // Once the new version is starting, a program holds its `main.py`: the folder cannot be removed to put the old one back.
    let held = Arc::new(Mutex::new(None));
    let hold = held.clone();
    let main = comfyui_dir(root.path()).join("main.py");
    engine.set_status_sink(Arc::new(move |s| {
        if s == EngineStatus::Starting && hold.lock().unwrap().is_none() {
            *hold.lock().unwrap() = OpenOptions::new().read(true).share_mode(0).open(&main).ok();
        }
    }));
    let result = engine
        .switch_version("v0.4.0", root.path(), &CancellationToken::new(), &|_, _| {})
        .await;
    assert!(held.lock().unwrap().is_some(), "main.py was never held");
    let Err(EngineError::Failed(m)) = result else {
        panic!("the switch should have failed: {result:?}");
    };
    // The start's own error, not "the old version was put back".
    assert!(m.contains("exited while starting"), "{m}");
    assert!(root.path().join(PORTABLE_DIR).is_dir());
    held.lock().unwrap().take();
    engine.shutdown();
}
