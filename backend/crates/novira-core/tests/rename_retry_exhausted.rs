//! Moving a freshly unpacked folder into place when Windows keeps refusing access (a virus scanner holds one of its
//! files): the install retries, then reports the move that failed. The pauses between retries are shortened
//! (debug-only seam), so the whole budget runs in a moment. The ComfyUI install uses a fake `7zr.exe` built
//! with `rustc` and the node pack install a batch file for `python`; nothing touches the network except the fake site
//! on this PC. Windows only.
#![cfg(windows)]
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::comfy::install::install as install_comfy;
use novira_core::comfy::node_packs::{custom_nodes_dir, install as install_pack, parse_github};
use novira_core::engine::EngineError;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;

/// Watches from another thread until `find` names an existing file, then holds it open without delete sharing: the
/// folder around a file that is open cannot be moved.
fn hold_when_it_appears(
    find: impl Fn() -> Option<PathBuf> + Send + 'static,
) -> std::thread::JoinHandle<Option<std::fs::File>> {
    std::thread::spawn(move || {
        let until = std::time::Instant::now() + std::time::Duration::from_secs(10);
        while std::time::Instant::now() < until {
            if let Some(path) = find() {
                if let Ok(file) = OpenOptions::new().read(true).share_mode(3).open(path) {
                    return Some(file);
                }
            }
            std::thread::sleep(std::time::Duration::from_micros(100));
        }
        None
    })
}

fn quick_retries() {
    std::env::set_var("NOVIRA_TEST_RETRY_PAUSE_MS", "1");
}

const FAKE_7ZR: &str = r#"
use std::{env, fs, path::Path};
fn main() {
    let args: Vec<String> = env::args().collect();
    let out = args.iter().find_map(|a| a.strip_prefix("-o")).unwrap();
    let p = Path::new(out).join("ComfyUI_windows_portable/ComfyUI/main.py");
    fs::create_dir_all(p.parent().unwrap()).unwrap();
    fs::write(p, "x").unwrap();
}
"#;

#[tokio::test]
async fn a_package_folder_that_cannot_be_moved_is_reported_after_the_retries() {
    quick_retries();
    let tools = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("fake7zr-retry");
    std::fs::create_dir_all(&tools).unwrap();
    let src = tools.join("fake7zr.rs");
    std::fs::write(&src, FAKE_7ZR).unwrap();
    let exe = tools.join(format!("fake7zr-{}.exe", std::process::id()));
    let built = std::process::Command::new("rustc")
        .arg(&src)
        .arg("-O")
        .arg("-o")
        .arg(&exe)
        .status()
        .expect("rustc is on PATH under cargo");
    assert!(built.success());

    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(root.path().join(".tools")).unwrap();
    std::fs::copy(&exe, root.path().join(".tools").join("7zr.exe")).unwrap();
    std::fs::create_dir_all(root.path().join(".downloads")).unwrap();
    std::fs::write(root.path().join(".downloads").join("comfyui.7z"), "x").unwrap();
    // The unpacked program file is opened by something else as soon as it appears.
    let unpacked = root
        .path()
        .join(".unpacking/ComfyUI_windows_portable/ComfyUI/main.py");
    let holder = hold_when_it_appears(move || unpacked.is_file().then(|| unpacked.clone()));
    let result = install_comfy(
        &client_without_network(),
        root.path(),
        "nvidia",
        &CancellationToken::new(),
        &|_| {},
    )
    .await;
    let Err(EngineError::Failed(message)) = result else {
        panic!("the install should have failed: {result:?}");
    };
    assert!(message.starts_with("Cannot move "), "{message}");
    assert!(
        holder.join().unwrap().is_some(),
        "the unpacked file never appeared"
    );
}

fn client_without_network() -> reqwest::Client {
    reqwest::Client::builder()
        .proxy(reqwest::Proxy::all("http://127.0.0.1:1").unwrap())
        .build()
        .unwrap()
}

/// A `python` that fakes `-m zipfile -e`: every archive holds one top folder with a file and a `.gitmodules` that
/// names one submodule.
const FAKE_PYTHON: &str = r#"@echo off
setlocal EnableDelayedExpansion
if "%~2"=="zipfile" goto unzip
exit /b 9
:unzip
set "OUT=%~5"
mkdir "!OUT!"
mkdir "!OUT!\pack-abc"
echo code> "!OUT!\pack-abc\nodes.py"
echo [submodule "x"]> "!OUT!\pack-abc\.gitmodules"
echo     path = libs/x>> "!OUT!\pack-abc\.gitmodules"
echo     url = https://github.com/owner/subrepo>> "!OUT!\pack-abc\.gitmodules"
exit /b 0
"#;

#[tokio::test]
async fn a_submodule_that_cannot_be_moved_in_fails_the_pack_install_after_the_retries() {
    quick_retries();
    let comfy = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    std::fs::write(tools.path().join("python.cmd"), FAKE_PYTHON).unwrap();
    site().put("/owner/np-stuck/zip/HEAD", Route::bytes("stuck"));
    site().put("/owner/subrepo/zip/HEAD", Route::bytes("sub"));
    let repo = parse_github("https://github.com/owner/np-stuck").unwrap();
    // A file of the unpacked submodule is opened by something else as soon as it appears.
    let watched = custom_nodes_dir(comfy.path());
    let holder = hold_when_it_appears(move || {
        std::fs::read_dir(&watched)
            .into_iter()
            .flatten()
            .flatten()
            .map(|work| work.path().join("sub0/unpacked/pack-abc/nodes.py"))
            .find(|file| file.is_file())
    });
    let result = install_pack(
        &client(),
        &repo,
        comfy.path(),
        &tools.path().join("python.cmd"),
        &comfy.path().join("data"),
        &CancellationToken::new(),
        &|_| {},
    )
    .await;
    assert!(
        holder.join().unwrap().is_some(),
        "the unpacked file never appeared"
    );
    assert!(result.is_err(), "{result:?}");
    assert!(!custom_nodes_dir(comfy.path()).join("np-stuck").exists());
}
