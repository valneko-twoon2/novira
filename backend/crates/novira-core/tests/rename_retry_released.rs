//! Moving a freshly unpacked folder into place when Windows refuses access for a moment (a virus scanner looks at one
//! of its files): the install retries and goes through once the file is let go. The pauses between retries are set to 40 ms
//! (debug-only seam; the variable is process-wide, so this file has no other test). Windows only.
#![cfg(windows)]
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::comfy::node_packs::{custom_nodes_dir, install as install_pack, parse_github};
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;

/// Watches from another thread until `find` names an existing file, holds it open without delete sharing for
/// `hold_ms`, then lets it go.
fn hold_a_while_when_it_appears(
    find: impl Fn() -> Option<PathBuf> + Send + 'static,
    hold_ms: u64,
) -> std::thread::JoinHandle<bool> {
    std::thread::spawn(move || {
        let until = std::time::Instant::now() + std::time::Duration::from_secs(10);
        while std::time::Instant::now() < until {
            if let Some(path) = find() {
                if let Ok(file) = OpenOptions::new().read(true).share_mode(3).open(path) {
                    std::thread::sleep(std::time::Duration::from_millis(hold_ms));
                    drop(file);
                    return true;
                }
            }
            std::thread::sleep(std::time::Duration::from_micros(100));
        }
        false
    })
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
async fn a_submodule_folder_that_is_held_for_a_moment_is_moved_in_after_a_retry() {
    std::env::set_var("NOVIRA_TEST_RETRY_PAUSE_MS", "40");
    let comfy = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    std::fs::write(tools.path().join("python.cmd"), FAKE_PYTHON).unwrap();
    site().put("/owner/np-brief/zip/HEAD", Route::bytes("brief"));
    site().put("/owner/subrepo/zip/HEAD", Route::bytes("sub"));
    let repo = parse_github("https://github.com/owner/np-brief").unwrap();
    let watched = custom_nodes_dir(comfy.path());
    let holder = hold_a_while_when_it_appears(
        move || {
            std::fs::read_dir(&watched)
                .into_iter()
                .flatten()
                .flatten()
                .map(|work| work.path().join("sub0/unpacked/pack-abc/nodes.py"))
                .find(|file| file.is_file())
        },
        100,
    );
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
    assert!(holder.join().unwrap(), "the unpacked file never appeared");
    result.unwrap();
    assert!(custom_nodes_dir(comfy.path()).join("np-brief").is_dir());
}
