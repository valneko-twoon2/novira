//! Replacing an installed node pack when the new copy cannot be moved into place (a virus scanner holds one of its
//! files): the pack that was installed stays as it was. The archive comes from a fake GitHub and `python` is a batch
//! file that fakes the unzip step; the retry pauses are shortened (debug-only seam). Windows only.
#![cfg(windows)]
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::comfy::node_packs::{custom_nodes_dir, install, parse_github};
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;

const FAKE_PYTHON: &str = r#"@echo off
setlocal EnableDelayedExpansion
if "%~2"=="zipfile" goto unzip
exit /b 9
:unzip
set /p MODE=<"%~4"
set "OUT=%~5"
mkdir "!OUT!"
mkdir "!OUT!\pack-abc"
echo !MODE!> "!OUT!\pack-abc\nodes.py"
exit /b 0
"#;

/// Holds the file from another thread as soon as it appears; a folder around an open file cannot be moved.
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

#[tokio::test]
async fn a_pack_whose_new_copy_cannot_be_moved_in_keeps_the_installed_one() {
    std::env::set_var("NOVIRA_TEST_RETRY_PAUSE_MS", "1");
    let comfy = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    std::fs::write(tools.path().join("python.cmd"), FAKE_PYTHON).unwrap();
    let python = tools.path().join("python.cmd");
    let repo = parse_github("https://github.com/owner/np-keep").unwrap();
    let run = || async {
        install(
            &client(),
            &repo,
            comfy.path(),
            &python,
            &comfy.path().join("data"),
            &CancellationToken::new(),
            &|_| {},
        )
        .await
    };

    site().put("/owner/np-keep/zip/HEAD", Route::bytes("old"));
    run().await.unwrap();
    let installed = custom_nodes_dir(comfy.path()).join("np-keep");
    assert_eq!(
        std::fs::read_to_string(installed.join("nodes.py"))
            .unwrap()
            .trim(),
        "old"
    );

    // The next copy has a file that something else opens as soon as it appears.
    site().put("/owner/np-keep/zip/HEAD", Route::bytes("new"));
    let watched = custom_nodes_dir(comfy.path());
    let holder = hold_when_it_appears(move || {
        std::fs::read_dir(&watched)
            .into_iter()
            .flatten()
            .flatten()
            .map(|work| work.path().join("pack/unpacked/pack-abc/nodes.py"))
            .find(|file| file.is_file())
    });
    let result = run().await;
    assert!(
        holder.join().unwrap().is_some(),
        "the unpacked file never appeared"
    );
    assert!(result.is_err(), "{result:?}");
    // The pack that was installed is still there, with its own files.
    let kept = std::fs::read_to_string(installed.join("nodes.py"));
    assert_eq!(
        kept.as_deref().map(str::trim).ok(),
        Some("old"),
        "the installed pack was lost"
    );
}
