//! Installing, replacing and removing a node pack when something is in the way: a submodule archive that is missing, a
//! submodule folder whose parent is a file, a pack folder in use, and a python that cannot be started. The archive comes
//! from a fake GitHub and `python` is a batch file that fakes the unzip step. Windows only.
#![cfg(windows)]
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::comfy::node_packs::{custom_nodes_dir, install, parse_github, remove};
use std::fs::{File, OpenOptions};
use std::os::windows::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use tokio_util::sync::CancellationToken;

/// A `python` that fakes `-m zipfile -e <archive> <out>`; the archive is one word that picks the layout.
const FAKE_PYTHON: &str = r#"@echo off
setlocal EnableDelayedExpansion
if "%~2"=="zipfile" goto unzip
exit /b 9
:unzip
set /p MODE=<"%~4"
set "OUT=%~5"
mkdir "!OUT!"
mkdir "!OUT!\pack-abc"
echo code> "!OUT!\pack-abc\nodes.py"
if "!MODE!"=="plain" exit /b 0
if "!MODE!"=="libsfile" echo file> "!OUT!\pack-abc\libs"
echo [submodule "x"]> "!OUT!\pack-abc\.gitmodules"
echo     path = libs/x>> "!OUT!\pack-abc\.gitmodules"
set "SUB=subrepo"
if "!MODE!"=="nosub" set "SUB=no-such-sub"
echo     url = https://github.com/owner/!SUB!>> "!OUT!\pack-abc\.gitmodules"
exit /b 0
"#;

struct World {
    comfy: tempfile::TempDir,
    tools: tempfile::TempDir,
}

impl World {
    fn new() -> World {
        let tools = tempfile::tempdir().unwrap();
        std::fs::write(tools.path().join("python.cmd"), FAKE_PYTHON).unwrap();
        World {
            comfy: tempfile::tempdir().unwrap(),
            tools,
        }
    }

    fn python(&self) -> PathBuf {
        self.tools.path().join("python.cmd")
    }

    async fn install_with(&self, name: &str, python: &Path) -> Result<String, String> {
        let repo = parse_github(&format!("https://github.com/owner/{name}")).unwrap();
        install(
            &client(),
            &repo,
            self.comfy.path(),
            python,
            &self.comfy.path().join("data"),
            &CancellationToken::new(),
            &|_| {},
        )
        .await
    }

    async fn install(&self, name: &str) -> Result<String, String> {
        self.install_with(name, &self.python()).await
    }
}

fn serve(name: &str, mode: &str) {
    site().put(&format!("/owner/{name}/zip/HEAD"), Route::bytes(mode));
}

fn hold(path: &Path) -> File {
    OpenOptions::new()
        .read(true)
        .share_mode(3) // read and write sharing, but not delete
        .open(path)
        .unwrap()
}

#[tokio::test]
async fn a_submodule_archive_that_cannot_be_fetched_stops_the_install() {
    let world = World::new();
    serve("npf-nosub", "nosub");
    // The submodule's archive is not on the fake site: it answers 404.
    let err = world.install("npf-nosub").await.unwrap_err();
    assert!(!err.is_empty());
    assert!(!custom_nodes_dir(world.comfy.path())
        .join("npf-nosub")
        .exists());
}

#[tokio::test]
async fn a_submodule_whose_folder_cannot_be_made_stops_the_install() {
    let world = World::new();
    serve("npf-libsfile", "libsfile");
    site().put("/owner/subrepo/zip/HEAD", Route::bytes("plain"));
    // `libs` is a file in the pack, so `libs/x` cannot be a folder.
    let err = world.install("npf-libsfile").await.unwrap_err();
    assert!(!err.is_empty());
}

#[tokio::test]
async fn an_installed_pack_that_is_in_use_cannot_be_replaced_or_removed() {
    let world = World::new();
    serve("npf-inuse", "plain");
    assert_eq!(world.install("npf-inuse").await, Ok("npf-inuse".into()));
    let pack = custom_nodes_dir(world.comfy.path()).join("npf-inuse");
    let _held = hold(&pack.join("nodes.py"));
    // Moving the installed folder aside fails, and the pack stays as it was.
    let err = world.install("npf-inuse").await.unwrap_err();
    assert!(err.contains("Cannot replace the installed"), "{err}");
    assert!(pack.join("nodes.py").is_file());
    // Removing it fails too.
    let err = remove(&custom_nodes_dir(world.comfy.path()), "npf-inuse").unwrap_err();
    assert!(err.contains("Cannot remove"), "{err}");
}

#[tokio::test]
async fn a_python_that_cannot_be_run_stops_the_install() {
    let world = World::new();
    serve("npf-nopython", "plain");
    let not_a_program = world.tools.path().join("python.exe");
    std::fs::write(&not_a_program, b"this is text").unwrap();
    let err = world
        .install_with("npf-nopython", &not_a_program)
        .await
        .unwrap_err();
    assert!(err.contains("Cannot run Python"), "{err}");
}
