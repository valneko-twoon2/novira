//! The ComfyUI install against a fake `7zr.exe` (a tiny program built with `rustc` in the test), so the unpack, the
//! layout checks and the error paths run without the 2 GB download. The tool and the archive are put in place up front;
//! the download steps are only reached with a proxy that refuses every connection, so nothing touches the network.
//! Windows only, like the install itself.
#![cfg(windows)]
use novira_core::comfy::install::{
    comfyui_dir, install, install_version, installed_package, is_installed, package_url,
    previous_dir, restore_previous, PORTABLE_DIR,
};
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{EngineError, EngineStatus};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

const FAKE_SOURCE: &str = r#"
use std::{env, fs, path::Path};
fn main() {
    let args: Vec<String> = env::args().collect();
    let out = args.iter().find_map(|a| a.strip_prefix("-o")).unwrap();
    let mode = fs::read_to_string(args.last().unwrap()).unwrap_or_default();
    let put = |rel: &str| {
        let p = Path::new(out).join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, "x").unwrap();
    };
    match mode.trim() {
        "fail" => {
            eprintln!("ERROR: Headers Error");
            std::process::exit(2);
        }
        "disk" => {
            eprintln!("ERROR: Can not write output file");
            std::process::exit(2);
        }
        "sleep" => std::thread::sleep(std::time::Duration::from_secs(30)),
        "flat" => put("ComfyUI/main.py"),
        "empty" => fs::create_dir_all(out).unwrap(),
        _ => {
            put("ComfyUI_windows_portable/ComfyUI/main.py");
            put("ComfyUI_windows_portable/python_embeded/python.exe");
        }
    }
}
"#;

/// The fake tool, built once per test run.
fn fake_tool() -> &'static Path {
    static TOOL: OnceLock<PathBuf> = OnceLock::new();
    TOOL.get_or_init(|| {
        let dir = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("fake7zr");
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("fake7zr.rs");
        std::fs::write(&src, FAKE_SOURCE).unwrap();
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

/// An install root with the fake tool and an archive whose content tells the tool what to do.
fn root_with_archive(mode: &str) -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(root.path().join(".tools")).unwrap();
    std::fs::copy(fake_tool(), root.path().join(".tools").join("7zr.exe")).unwrap();
    std::fs::create_dir_all(root.path().join(".downloads")).unwrap();
    std::fs::write(root.path().join(".downloads").join("comfyui.7z"), mode).unwrap();
    root
}

/// A client whose every request goes to a closed port.
fn offline_client() -> reqwest::Client {
    reqwest::Client::builder()
        .proxy(reqwest::Proxy::all("http://127.0.0.1:1").unwrap())
        .build()
        .unwrap()
}

async fn run(
    root: &Path,
    package: &str,
    cancel: &CancellationToken,
) -> (Result<(), EngineError>, Vec<EngineStatus>) {
    let seen = Mutex::new(Vec::new());
    let result = install(&offline_client(), root, package, cancel, &|s| {
        seen.lock().unwrap().push(s)
    })
    .await;
    (result, seen.into_inner().unwrap())
}

#[tokio::test]
async fn the_package_is_unpacked_from_its_top_folder_and_moved_into_place() {
    let root = root_with_archive("nested");
    // A previous install is replaced.
    std::fs::create_dir_all(root.path().join(PORTABLE_DIR)).unwrap();
    std::fs::write(root.path().join(PORTABLE_DIR).join("old.txt"), "old").unwrap();
    let (result, seen) = run(root.path(), "nvidia", &CancellationToken::new()).await;
    assert_eq!(result, Ok(()));
    assert_eq!(seen, [EngineStatus::Extracting]);
    assert!(is_installed(root.path()));
    assert!(root
        .path()
        .join(PORTABLE_DIR)
        .join("python_embeded")
        .join("python.exe")
        .is_file());
    assert!(!root.path().join(PORTABLE_DIR).join("old.txt").exists());
    assert!(!root.path().join(".unpacking").exists());
    assert!(!root.path().join(".downloads").join("comfyui.7z").exists());
}

#[tokio::test]
async fn an_archive_without_a_top_folder_works_too() {
    let root = root_with_archive("flat");
    let (result, _) = run(root.path(), "amd", &CancellationToken::new()).await;
    assert_eq!(result, Ok(()));
    assert!(comfyui_dir(root.path()).join("main.py").is_file());
}

#[tokio::test]
async fn an_archive_with_an_unexpected_layout_is_refused() {
    let root = root_with_archive("empty");
    let (result, _) = run(root.path(), "nvidia", &CancellationToken::new()).await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("unexpected layout")));
    assert!(!is_installed(root.path()));
}

#[tokio::test]
async fn a_failed_unpack_reports_the_tools_message_and_drops_the_archive() {
    let root = root_with_archive("fail");
    let (result, _) = run(root.path(), "nvidia", &CancellationToken::new()).await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("Headers Error")));
    assert!(!root.path().join(".downloads").join("comfyui.7z").exists());
    assert!(!root.path().join(".unpacking").exists());
}

#[tokio::test]
async fn a_failed_unpack_for_another_reason_keeps_the_archive_for_the_next_try() {
    // A full disk or a locked folder says nothing about the archive, so it is unpacked again without a new download.
    let root = root_with_archive("disk");
    let (result, _) = run(root.path(), "nvidia", &CancellationToken::new()).await;
    assert!(
        matches!(result, Err(EngineError::Failed(m)) if m.contains("Can not write output file"))
    );
    assert!(root.path().join(".downloads").join("comfyui.7z").is_file());
    assert!(!root.path().join(".unpacking").exists());
}

#[tokio::test]
async fn cancelling_stops_the_unpack_and_cleans_up() {
    let root = root_with_archive("sleep");
    let cancel = CancellationToken::new();
    let stopper = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        stopper.cancel();
    });
    let (result, seen) = run(root.path(), "nvidia", &cancel).await;
    assert_eq!(result, Err(EngineError::Cancelled));
    assert_eq!(seen, [EngineStatus::Extracting]);
    assert!(!root.path().join(".unpacking").exists());
}

#[tokio::test]
async fn a_tool_that_cannot_run_is_reported() {
    let root = root_with_archive("nested");
    std::fs::write(root.path().join(".tools").join("7zr.exe"), "not a program").unwrap();
    let (result, _) = run(root.path(), "nvidia", &CancellationToken::new()).await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("Cannot run 7zr.exe")));
}

#[tokio::test]
async fn an_unknown_package_is_refused_before_anything_is_done() {
    let root = tempfile::tempdir().unwrap();
    let (result, seen) = run(root.path(), "cuda", &CancellationToken::new()).await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("Unknown comfyuiPackage")));
    assert!(seen.is_empty());
    assert!(package_url("nvidia").is_ok());
}

#[tokio::test]
async fn a_missing_tool_is_downloaded_first_and_a_failed_download_is_an_error() {
    let root = tempfile::tempdir().unwrap();
    let (result, seen) = run(root.path(), "nvidia", &CancellationToken::new()).await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("Download failed")));
    assert_eq!(
        seen,
        [EngineStatus::Downloading {
            bytes: 0,
            total_bytes: 0
        }]
    );
    // A cancelled download is a cancel, not an error.
    let cancel = CancellationToken::new();
    cancel.cancel();
    let (result, _) = run(root.path(), "nvidia", &cancel).await;
    assert_eq!(result, Err(EngineError::Cancelled));
}

#[tokio::test]
async fn a_missing_archive_is_downloaded_after_the_tool_is_there() {
    let root = root_with_archive("nested");
    std::fs::remove_file(root.path().join(".downloads").join("comfyui.7z")).unwrap();
    let (result, _) = run(root.path(), "nvidia", &CancellationToken::new()).await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("Download failed")));
}

/// A root with a package of an older version installed, one extension folder in it, and the archive of the release `tag`.
fn root_with_old_package_and_release(mode: &str, tag: &str) -> tempfile::TempDir {
    let root = root_with_archive("unused");
    let _ = std::fs::remove_file(root.path().join(".downloads").join("comfyui.7z"));
    std::fs::write(
        root.path()
            .join(".downloads")
            .join(format!("comfyui-{tag}.7z")),
        mode,
    )
    .unwrap();
    let old = comfyui_dir(root.path());
    std::fs::create_dir_all(old.join("custom_nodes").join("my-pack")).unwrap();
    std::fs::write(
        old.join("custom_nodes").join("my-pack").join("nodes.py"),
        "x",
    )
    .unwrap();
    std::fs::write(old.join("main.py"), "old").unwrap();
    root
}

#[tokio::test]
async fn a_release_replaces_the_package_keeps_the_old_one_and_moves_the_extensions_over() {
    let root = root_with_old_package_and_release("nested", "v0.3.50");
    let result = install_version(
        &offline_client(),
        root.path(),
        "nvidia",
        Some("v0.3.50"),
        true,
        &CancellationToken::new(),
        &|_| {},
    )
    .await;
    assert_eq!(result, Ok(()));
    // The new package is in place, with the extension that was in the old one.
    assert!(is_installed(root.path()));
    assert_ne!(
        std::fs::read_to_string(comfyui_dir(root.path()).join("main.py")).unwrap(),
        "old"
    );
    assert!(comfyui_dir(root.path())
        .join("custom_nodes/my-pack/nodes.py")
        .is_file());
    // The old package is kept (without the extension that moved) until the caller drops it.
    assert_eq!(
        std::fs::read_to_string(previous_dir(root.path()).join("ComfyUI/main.py")).unwrap(),
        "old"
    );
    assert!(!previous_dir(root.path())
        .join("ComfyUI/custom_nodes/my-pack")
        .exists());
}

#[tokio::test]
async fn a_release_records_its_package_and_the_record_goes_back_with_the_old_package() {
    let root = root_with_old_package_and_release("nested", "v0.3.50");
    std::fs::write(
        root.path().join(PORTABLE_DIR).join("novira-package.txt"),
        "amd",
    )
    .unwrap();
    install_version(
        &offline_client(),
        root.path(),
        "nvidia",
        Some("v0.3.50"),
        true,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
    .unwrap();
    assert_eq!(installed_package(root.path()).as_deref(), Some("nvidia"));
    restore_previous(root.path()).unwrap();
    assert_eq!(installed_package(root.path()).as_deref(), Some("amd"));
}

/// A start whose install was made from another package than the settings name installs the settings package in its
/// place, with the same ComfyUI version. When the new one does not start, the old one comes back and the start fails.
#[tokio::test]
async fn a_start_with_another_package_changes_it_and_a_change_that_fails_puts_the_old_one_back() {
    let root = root_with_old_package_and_release("nested", "v0.3.50");
    std::fs::write(
        root.path().join(PORTABLE_DIR).join("novira-package.txt"),
        "amd",
    )
    .unwrap();
    std::fs::write(
        comfyui_dir(root.path()).join("comfyui_version.py"),
        "__version__ = \"0.3.50\"\n",
    )
    .unwrap();
    // A python that does not exist: the new package cannot start, so the change falls back to the old one.
    let process = ComfyProcess::new(OwnedProcessConfig {
        comfyui_dir: comfyui_dir(root.path()),
        python: Some(root.path().join("no-such-python.exe")),
        host: "127.0.0.1".into(),
        port: 1,
        extra_model_paths: root.path().join("extra_model_paths.yaml"),
        extra_args: Vec::new(),
        log_file: root.path().join("comfyui.log"),
    });
    let engine = ComfyEngine::new("http://127.0.0.1:1", Some(process), Duration::from_secs(5))
        .unwrap()
        .with_installer(root.path().to_path_buf(), "nvidia".into());
    let result = engine.ensure_ready(&CancellationToken::new()).await;
    assert!(
        matches!(result, Err(EngineError::Failed(ref m)) if m.contains("put back")),
        "{result:?}"
    );
    assert_eq!(
        installed_package(root.path()).as_deref(),
        Some("amd"),
        "the old package and its record are back"
    );
    assert_eq!(
        std::fs::read_to_string(comfyui_dir(root.path()).join("main.py")).unwrap(),
        "old"
    );
}

#[tokio::test]
async fn a_release_that_cannot_be_unpacked_leaves_the_old_package_alone() {
    let root = root_with_old_package_and_release("fail", "v0.3.50");
    let result = install_version(
        &offline_client(),
        root.path(),
        "nvidia",
        Some("v0.3.50"),
        true,
        &CancellationToken::new(),
        &|_| {},
    )
    .await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("Headers Error")));
    assert_eq!(
        std::fs::read_to_string(comfyui_dir(root.path()).join("main.py")).unwrap(),
        "old"
    );
    assert!(comfyui_dir(root.path())
        .join("custom_nodes/my-pack/nodes.py")
        .is_file());
    assert!(!previous_dir(root.path()).exists());
}
