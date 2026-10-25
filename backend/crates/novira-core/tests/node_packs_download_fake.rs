//! Installing a custom node pack from a fake GitHub: the archive download, the unpacking, submodules, requirements,
//! `install.py`, replacing an installed pack and rolling back. The addresses point at a loopback server (debug-only
//! override) and `python` is a batch file that fakes the unzip and pip steps, so nothing needs the network or
//! Python. The "archives" are one line of text that tells the fake Python what tree to create. Windows only.
#![cfg(windows)]
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::comfy::node_packs::{
    custom_nodes_dir, install, install_version, list, parse_github, tags,
};
use novira_core::packs::PackStatus;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

const FAKE_PYTHON: &str = r#"@echo off
setlocal EnableDelayedExpansion
set "DIR=%~dp0"
if "%~2"=="zipfile" goto unzip
if "%~2"=="pip" goto pip
if "%~1"=="install.py" goto setup
exit /b 9
:unzip
set /p MODE=<"%~4"
set "OUT=%~5"
if "!MODE!"=="badzip" goto badzip
mkdir "!OUT!"
if "!MODE!"=="empty" exit /b 0
mkdir "!OUT!\pack-abc"
if "!MODE!"=="twotop" mkdir "!OUT!\other"
echo code> "!OUT!\pack-abc\nodes.py"
if "!MODE!"=="reqs" echo numpy> "!OUT!\pack-abc\requirements.txt"
if "!MODE!"=="mediapipe" echo numpy> "!OUT!\pack-abc\requirements.txt"
if "!MODE!"=="mediapipe" echo mediapipe^>=0.8.0>> "!OUT!\pack-abc\requirements.txt"
if "!MODE!"=="mediapipe" echo yacs>> "!OUT!\pack-abc\requirements.txt"
if "!MODE!"=="mediapipe" echo albumentationsx>> "!OUT!\pack-abc\requirements.txt"
if "!MODE!"=="installpy" echo print^(1^)> "!OUT!\pack-abc\install.py"
if "!MODE!"=="subs" goto subs
if "!MODE!"=="subs_dotdot" goto subs
if "!MODE!"=="subs_offsite" goto subs
exit /b 0
:badzip
echo corrupt archive 1>&2
exit /b 3
:subs
set "SUBPATH=libs/x"
set "SUBURL=https://github.com/owner/subrepo"
if "!MODE!"=="subs_dotdot" set "SUBPATH=../evil"
if "!MODE!"=="subs_offsite" set "SUBURL=https://gitlab.com/owner/subrepo"
echo [submodule "x"]> "!OUT!\pack-abc\.gitmodules"
echo     path = !SUBPATH!>> "!OUT!\pack-abc\.gitmodules"
echo     url = !SUBURL!>> "!OUT!\pack-abc\.gitmodules"
exit /b 0
:pip
if "%~3"=="freeze" goto freeze
echo %*>> "%DIR%pip.log"
if "%~7"=="-r" copy "%~8" "%DIR%requirements-seen.txt" >nul
if exist "%DIR%pipfail.txt" echo no matching distribution 1>&2
if exist "%DIR%pipfail.txt" exit /b 1
exit /b 0
:freeze
if exist "%DIR%freezefail.txt" exit /b 1
echo torch==2.1.0
echo numpy==1.26.0
exit /b 0
:setup
echo ran> installed.txt
if exist "%DIR%setupfail.txt" echo setup exploded 1>&2
if exist "%DIR%setupfail.txt" exit /b 1
exit /b 0
"#;

/// A temporary world: a ComfyUI folder and a folder holding the fake Python.
struct World {
    comfy: tempfile::TempDir,
    tools: tempfile::TempDir,
}

impl World {
    fn new() -> World {
        let tools = tempfile::tempdir().unwrap();
        // cmd finds `goto` labels by byte offset, so the batch must have CRLF line endings (a Rust string holds LF).
        let batch = FAKE_PYTHON.replace("\r\n", "\n").replace('\n', "\r\n");
        std::fs::write(tools.path().join("python.cmd"), batch).unwrap();
        World {
            comfy: tempfile::tempdir().unwrap(),
            tools,
        }
    }

    fn python(&self) -> PathBuf {
        self.tools.path().join("python.cmd")
    }

    fn flag(&self, name: &str) {
        std::fs::write(self.tools.path().join(name), "x").unwrap();
    }

    fn pip_log(&self) -> String {
        std::fs::read_to_string(self.tools.path().join("pip.log")).unwrap_or_default()
    }

    /// The requirements file the last `pip install -r` was given.
    fn requirements_seen(&self) -> String {
        std::fs::read_to_string(self.tools.path().join("requirements-seen.txt")).unwrap_or_default()
    }

    fn pack(&self, name: &str) -> PathBuf {
        custom_nodes_dir(self.comfy.path()).join(name)
    }

    async fn install(&self, name: &str) -> (Result<String, String>, Vec<PackStatus>) {
        self.install_with(name, &self.python(), &CancellationToken::new())
            .await
    }

    async fn install_with(
        &self,
        name: &str,
        python: &Path,
        cancel: &CancellationToken,
    ) -> (Result<String, String>, Vec<PackStatus>) {
        let repo = parse_github(&format!("https://github.com/owner/{name}")).unwrap();
        let seen = Mutex::new(Vec::new());
        let result = install(
            &client(),
            &repo,
            self.comfy.path(),
            python,
            &self.comfy.path().join("data"),
            cancel,
            &|s| seen.lock().unwrap().push(s),
        )
        .await;
        (result, seen.into_inner().unwrap())
    }
}

/// Serves the archive of `owner/<name>` with the given mode line.
fn serve_pack(name: &str, mode: &str) {
    site().put(&format!("/owner/{name}/zip/HEAD"), Route::bytes(mode));
}

fn steps(seen: &[PackStatus]) -> Vec<String> {
    seen.iter()
        .filter_map(|s| match s {
            PackStatus::Installing { step } => Some(step.clone()),
            _ => None,
        })
        .collect()
}

#[tokio::test]
async fn a_pack_is_downloaded_unpacked_marked_and_listed() {
    let world = World::new();
    serve_pack("np-plain", "plain");
    let (result, seen) = world.install("np-plain").await;
    assert_eq!(result, Ok("np-plain".to_string()));
    assert!(world.pack("np-plain").join("nodes.py").is_file());
    assert!(seen
        .iter()
        .any(|s| matches!(s, PackStatus::Downloading { file, .. } if file == "np-plain")));
    assert_eq!(steps(&seen), ["unpack"]);
    // No requirements, no install.py: pip never ran, and the work folder is gone.
    assert_eq!(world.pip_log(), "");
    let listed = list(&custom_nodes_dir(world.comfy.path()));
    assert_eq!(listed.len(), 1);
    assert_eq!(
        listed[0].url.as_deref(),
        Some("https://github.com/owner/np-plain")
    );
}

#[tokio::test]
async fn requirements_are_installed_with_the_torch_pins_as_constraints() {
    let world = World::new();
    serve_pack("np-reqs", "reqs");
    let (result, seen) = world.install("np-reqs").await;
    assert_eq!(result, Ok("np-reqs".to_string()));
    assert_eq!(steps(&seen), ["unpack", "requirements"]);
    let log = world.pip_log();
    assert!(log.contains("install") && log.contains("-c") && log.contains("-r"));
    assert!(log.contains("requirements.txt"));
}

#[tokio::test]
async fn the_pose_pack_is_installed_without_mediapipe_or_albumentationsx_and_keeps_its_own_list() {
    let world = World::new();
    site().put(
        "/Fannovel16/comfyui_controlnet_aux/zip/HEAD",
        Route::bytes("mediapipe"),
    );
    let repo = parse_github("https://github.com/Fannovel16/comfyui_controlnet_aux").unwrap();
    let result = install(
        &client(),
        &repo,
        world.comfy.path(),
        &world.python(),
        &world.comfy.path().join("data"),
        &CancellationToken::new(),
        &|_| {},
    )
    .await;
    assert_eq!(result, Ok("comfyui_controlnet_aux".to_string()));
    // pip got the list without mediapipe (it would replace the cv2.pyd that ComfyUI has loaded) and without
    // albumentationsx (it would change albucore under the installed albumentations)...
    let seen = world.requirements_seen();
    assert!(seen.contains("numpy") && seen.contains("yacs"), "{seen}");
    assert!(!seen.contains("mediapipe"), "{seen}");
    assert!(!seen.contains("albumentationsx"), "{seen}");
    // ...and the pack's own file is as it was shipped.
    let own = std::fs::read_to_string(
        world
            .pack("comfyui_controlnet_aux")
            .join("requirements.txt"),
    )
    .unwrap();
    assert!(
        own.contains("mediapipe") && own.contains("albumentationsx"),
        "{own}"
    );
}

#[tokio::test]
async fn an_install_py_runs_inside_the_pack_folder() {
    let world = World::new();
    serve_pack("np-setup", "installpy");
    let (result, seen) = world.install("np-setup").await;
    assert_eq!(result, Ok("np-setup".to_string()));
    assert_eq!(steps(&seen), ["unpack", "install.py"]);
    assert!(world.pack("np-setup").join("installed.txt").is_file());
}

#[tokio::test]
async fn an_installed_pack_is_replaced() {
    let world = World::new();
    std::fs::create_dir_all(world.pack("np-replace")).unwrap();
    std::fs::write(world.pack("np-replace").join("old.txt"), "old").unwrap();
    serve_pack("np-replace", "plain");
    let (result, _) = world.install("np-replace").await;
    assert_eq!(result, Ok("np-replace".to_string()));
    assert!(world.pack("np-replace").join("nodes.py").is_file());
    assert!(!world.pack("np-replace").join("old.txt").exists());
}

#[tokio::test]
async fn a_failing_install_py_puts_the_previous_pack_back() {
    let world = World::new();
    world.flag("setupfail.txt");
    std::fs::create_dir_all(world.pack("np-rollback")).unwrap();
    std::fs::write(world.pack("np-rollback").join("old.txt"), "old").unwrap();
    serve_pack("np-rollback", "installpy");
    let (result, _) = world.install("np-rollback").await;
    let err = result.unwrap_err();
    assert!(
        err.contains("install.py failed") && err.contains("setup exploded"),
        "{err}"
    );
    assert!(world.pack("np-rollback").join("old.txt").is_file());
    assert!(!world.pack("np-rollback").join("nodes.py").exists());
    // Nothing else is left in custom_nodes (the work folder is removed).
    let names: Vec<_> = std::fs::read_dir(custom_nodes_dir(world.comfy.path()))
        .unwrap()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(names, ["np-rollback"]);
}

#[tokio::test]
async fn a_failed_first_install_leaves_no_folder_behind() {
    let world = World::new();
    world.flag("pipfail.txt");
    serve_pack("np-pipfail", "reqs");
    let (result, _) = world.install("np-pipfail").await;
    let err = result.unwrap_err();
    assert!(
        err.contains("Installing the pack's libraries failed"),
        "{err}"
    );
    assert!(err.contains("no matching distribution"), "{err}");
    assert!(!world.pack("np-pipfail").exists());
}

#[tokio::test]
async fn a_pip_freeze_that_fails_stops_the_install() {
    let world = World::new();
    world.flag("freezefail.txt");
    serve_pack("np-freeze", "reqs");
    let (result, _) = world.install("np-freeze").await;
    assert!(result
        .unwrap_err()
        .contains("Reading the installed libraries failed"));
    assert!(!world.pack("np-freeze").exists());
}

#[tokio::test]
async fn a_submodule_is_fetched_at_the_commit_the_pack_pins() {
    let world = World::new();
    serve_pack("np-subs", "subs");
    site().put_json(
        "/repos/owner/np-subs/contents/libs/x",
        &serde_json::json!({"type": "submodule", "sha": "c0ffee1"}),
    );
    site().put("/owner/subrepo/zip/c0ffee1", Route::bytes("plain"));
    let (result, seen) = world.install("np-subs").await;
    assert_eq!(result, Ok("np-subs".to_string()));
    assert!(world.pack("np-subs").join("libs/x/nodes.py").is_file());
    assert!(seen
        .iter()
        .any(|s| matches!(s, PackStatus::Downloading { file, .. } if file == "subrepo")));
    assert_eq!(site().requests("/owner/subrepo/zip/c0ffee1").len(), 1);
}

#[tokio::test]
async fn a_submodule_falls_back_to_head_when_github_does_not_say_which_commit() {
    let world = World::new();
    serve_pack("np-subs-head", "subs");
    // The contents API answers with a plain file, not a submodule.
    site().put_json(
        "/repos/owner/np-subs-head/contents/libs/x",
        &serde_json::json!({"type": "file"}),
    );
    site().put("/owner/subrepo/zip/HEAD", Route::bytes("plain"));
    let (result, _) = world.install("np-subs-head").await;
    assert_eq!(result, Ok("np-subs-head".to_string()));
    assert!(world.pack("np-subs-head").join("libs/x/nodes.py").is_file());
}

#[tokio::test]
async fn a_submodule_outside_the_pack_or_off_github_is_refused() {
    let world = World::new();
    serve_pack("np-dotdot", "subs_dotdot");
    let (result, _) = world.install("np-dotdot").await;
    assert!(result.unwrap_err().contains("Unexpected submodule path"));
    serve_pack("np-offsite", "subs_offsite");
    let (result, _) = world.install("np-offsite").await;
    assert!(result.unwrap_err().contains("which is not on GitHub"));
    assert!(!world.pack("np-dotdot").exists() && !world.pack("np-offsite").exists());
}

#[tokio::test]
async fn archives_with_a_bad_layout_or_content_are_refused() {
    let world = World::new();
    for (name, mode, expected) in [
        ("np-twotop", "twotop", "unexpected layout"),
        ("np-empty", "empty", "unexpected layout"),
        ("np-badzip", "badzip", "corrupt archive"),
    ] {
        serve_pack(name, mode);
        let (result, _) = world.install(name).await;
        let err = result.unwrap_err();
        assert!(err.contains(expected), "{name}: {err}");
        assert!(!world.pack(name).exists());
    }
}

#[tokio::test]
async fn a_missing_archive_and_a_python_that_does_not_exist_are_errors() {
    let world = World::new();
    // Nothing is served for this repository: GitHub answers 404.
    let (result, _) = world.install("np-nothing").await;
    assert!(result.unwrap_err().contains("Download answered 404"));
    serve_pack("np-nopython", "plain");
    let (result, _) = world
        .install_with(
            "np-nopython",
            &world.tools.path().join("no-such-python.cmd"),
            &CancellationToken::new(),
        )
        .await;
    let err = result.unwrap_err();
    assert!(err.contains("Unpacking the pack failed"), "{err}");
}

#[tokio::test]
async fn a_pack_installed_at_a_tag_comes_from_that_tag_and_remembers_it() {
    let world = World::new();
    site().put("/owner/np-tag/zip/refs/tags/v1.2.0", Route::bytes("plain"));
    let repo = parse_github("https://github.com/owner/np-tag").unwrap();
    let result = install_version(
        &client(),
        &repo,
        Some("v1.2.0"),
        world.comfy.path(),
        &world.python(),
        &world.comfy.path().join("data"),
        &CancellationToken::new(),
        &|_| {},
    )
    .await;
    assert_eq!(result, Ok("np-tag".to_string()));
    assert_eq!(
        site().requests("/owner/np-tag/zip/refs/tags/v1.2.0").len(),
        1
    );
    let listed = list(&custom_nodes_dir(world.comfy.path()));
    assert_eq!(listed[0].version.as_deref(), Some("v1.2.0"));
}

#[tokio::test]
async fn a_tag_that_is_not_plain_is_refused_before_anything_is_fetched() {
    let world = World::new();
    let repo = parse_github("https://github.com/owner/np-badtag").unwrap();
    for bad in ["../x", "a/b", "v1 2", "", "-v"] {
        let result = install_version(
            &client(),
            &repo,
            Some(bad),
            world.comfy.path(),
            &world.python(),
            &world.comfy.path().join("data"),
            &CancellationToken::new(),
            &|_| {},
        )
        .await;
        assert!(result.unwrap_err().contains("Not a version tag"), "{bad}");
    }
    assert!(!world.pack("np-badtag").exists());
}

#[tokio::test]
async fn the_versions_of_a_pack_are_its_valid_tags_newest_first() {
    site().put_json(
        "/repos/owner/np-versions/tags",
        &serde_json::json!([{"name": "v2.0.0"}, {"name": "../evil"}, {"name": "v1.0.0"}]),
    );
    let repo = parse_github("https://github.com/owner/np-versions").unwrap();
    assert_eq!(
        tags(&client(), &repo).await,
        Ok(vec!["v2.0.0".into(), "v1.0.0".into()])
    );
    // GitHub answering with an error is reported, not mistaken for "no versions".
    site().put("/repos/owner/np-versions-err/tags", Route::status(403));
    let repo = parse_github("https://github.com/owner/np-versions-err").unwrap();
    assert!(tags(&client(), &repo).await.unwrap_err().contains("403"));
}
