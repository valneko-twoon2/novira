//! The downloads of the engine and the packs against a fake download host: ComfyUI's package and `7zr.exe`, a model
//! pack's files and the voice models. The addresses point at a loopback server (debug-only override), the
//! 7-Zip tool is a tiny program built with `rustc`, and the voice step's `python` is a batch file. Windows only.
#![cfg(windows)]
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::comfy::install::{comfyui_dir, install, is_installed, package_url, sevenzip_url};
use novira_core::engine::{EngineError, EngineStatus};
use novira_core::packs::{
    file_path, files, install_files, is_installed as pack_installed, PackKind, PackStatus,
};
use novira_core::voice::{
    install as install_voice, is_installed as voice_installed, model_dir, site_dir, CUSTOM_VOICE,
    VOICE_DESIGN,
};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
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

/// The fake 7-Zip, built once per test run.
fn fake_tool() -> &'static Path {
    static TOOL: OnceLock<PathBuf> = OnceLock::new();
    TOOL.get_or_init(|| {
        let dir = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("fake7zr-served");
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

fn package_path(package: &str) -> String {
    package_url(package)
        .unwrap()
        .strip_prefix(&site().base)
        .expect("the package address is on the fake site")
        .to_string()
}

#[test]
fn the_addresses_point_at_the_fake_site_in_a_debug_build() {
    // Starting the site sets the variables, so it comes before the first address is asked for.
    let base = site().base.clone();
    assert_eq!(sevenzip_url(), format!("{base}/a/7zr.exe"));
    assert_eq!(
        package_url("amd").unwrap(),
        format!("{base}/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_amd.7z")
    );
}

#[tokio::test]
async fn the_tool_and_the_package_are_downloaded_unpacked_and_moved_into_place() {
    let root = tempfile::tempdir().unwrap();
    site().put(
        "/a/7zr.exe",
        Route::bytes(std::fs::read(fake_tool()).unwrap()),
    );
    site().put(&package_path("nvidia"), Route::bytes("an archive"));
    let seen = Mutex::new(Vec::new());
    let result = install(
        &client(),
        root.path(),
        "nvidia",
        &CancellationToken::new(),
        &|s| seen.lock().unwrap().push(s),
    )
    .await;
    assert_eq!(result, Ok(()));
    let seen = seen.into_inner().unwrap();
    assert_eq!(
        seen.first(),
        Some(&EngineStatus::Downloading {
            bytes: 0,
            total_bytes: 0
        })
    );
    assert_eq!(seen.last(), Some(&EngineStatus::Extracting));
    assert!(is_installed(root.path()));
    assert!(comfyui_dir(root.path()).join("main.py").is_file());
    assert!(root.path().join(".tools").join("7zr.exe").is_file());
    // The archive and the half-written names are gone once the package is in place.
    assert!(!root.path().join(".downloads").join("comfyui.7z").exists());
    assert!(!root.path().join(".downloads").join("comfyui.part").exists());
}

#[tokio::test]
async fn a_package_the_host_does_not_have_is_an_error_and_leaves_no_partial_file() {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(root.path().join(".tools")).unwrap();
    std::fs::copy(fake_tool(), root.path().join(".tools").join("7zr.exe")).unwrap();
    site().put(&package_path("amd"), Route::status(404));
    let result = install(
        &client(),
        root.path(),
        "amd",
        &CancellationToken::new(),
        &|_| {},
    )
    .await;
    assert!(matches!(result, Err(EngineError::Failed(m)) if m.contains("Download answered 404")));
    assert!(!root.path().join(".downloads").join("comfyui.part").exists());
    assert!(!is_installed(root.path()));
}

#[tokio::test]
async fn a_pack_file_is_downloaded_and_moved_into_place_and_a_refusal_is_explained() {
    let models = tempfile::tempdir().unwrap();
    let f = &files(PackKind::Music)[0];
    site().put(
        &format!("/{}/resolve/main/{}", f.repo, f.path),
        Route::bytes("pack file"),
    );
    let seen = Mutex::new(Vec::new());
    install_files(
        &client(),
        models.path(),
        PackKind::Music,
        &CancellationToken::new(),
        &|s| seen.lock().unwrap().push(s),
    )
    .await
    .unwrap();
    assert!(pack_installed(models.path(), PackKind::Music));
    assert_eq!(
        std::fs::read(file_path(models.path(), PackKind::Music, f)).unwrap(),
        b"pack file"
    );
    assert!(seen
        .lock()
        .unwrap()
        .iter()
        .any(|s| matches!(s, PackStatus::Downloading { file, .. } if file == f.file)));
    // A file that needs a login says so; a connection that drops half-way is reported and leaves nothing behind.
    let logo = &files(PackKind::Logo)[0];
    let logo_path = format!("/{}/resolve/main/{}", logo.repo, logo.path);
    site().put(&logo_path, Route::status(401));
    let models = tempfile::tempdir().unwrap();
    let err = install_files(
        &client(),
        models.path(),
        PackKind::Logo,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
    .unwrap_err();
    assert!(err.contains("needs an API key"), "{err}");
    site().put(&logo_path, Route::bytes("only a bit").announcing(1000));
    let err = install_files(
        &client(),
        models.path(),
        PackKind::Logo,
        &CancellationToken::new(),
        &|_| {},
    )
    .await
    .unwrap_err();
    assert!(err.contains("Download"), "{err}");
    assert!(!file_path(models.path(), PackKind::Logo, logo).exists());
}

fn fake_python(dir: &Path) -> PathBuf {
    let path = dir.join("python.cmd");
    std::fs::write(&path, "@echo off\r\nexit /b 0\r\n").unwrap();
    path
}

fn tree_path(repo: &str) -> String {
    format!("/api/models/{repo}/tree/main")
}

fn serve_voice_model(repo: &str, files: &[(&str, &str)]) {
    let mut tree = vec![
        serde_json::json!({"type": "directory", "path": "speech_tokenizer"}),
        serde_json::json!({"type": "file", "path": "README.md", "size": 5}),
        serde_json::json!({"type": "file", "path": "assets/logo.png", "size": 5}),
    ];
    for (path, body) in files {
        tree.push(serde_json::json!({"type": "file", "path": path, "size": body.len()}));
        site().put(&format!("/{repo}/resolve/main/{path}"), Route::bytes(*body));
    }
    site().put_json(&tree_path(repo), &serde_json::Value::Array(tree));
}

#[tokio::test]
async fn the_voice_models_are_listed_downloaded_and_marked_complete() {
    let data = tempfile::tempdir().unwrap();
    let models = tempfile::tempdir().unwrap();
    let python = fake_python(data.path());
    // The libraries are in place already, so only the model step runs.
    std::fs::create_dir_all(site_dir(data.path())).unwrap();
    std::fs::write(site_dir(data.path()).join(".ready"), b"x").unwrap();
    // Hugging Face answers: not found for one repository, and something that is not a list for the other.
    site().put(&tree_path(CUSTOM_VOICE.repo), Route::status(404));
    let run = |token: Option<&'static str>| {
        let seen = Mutex::new(Vec::new());
        let (data, models, python) = (data.path(), models.path(), python.clone());
        async move {
            let result = install_voice(
                &client(),
                data,
                models,
                Some(&python),
                token,
                &CancellationToken::new(),
                &|s| seen.lock().unwrap().push(s),
            )
            .await;
            (result, seen.into_inner().unwrap())
        }
    };
    let (result, _) = run(None).await;
    assert_eq!(result.unwrap_err(), "Hugging Face answered 404 Not Found");
    site().put(&tree_path(CUSTOM_VOICE.repo), Route::bytes("not a list"));
    let (result, _) = run(None).await;
    assert!(result
        .unwrap_err()
        .contains("Unexpected Hugging Face response"));
    // Both repositories list their files; one file is there already with the right size and is not fetched again.
    serve_voice_model(
        CUSTOM_VOICE.repo,
        &[("config.json", "{}"), ("model.safetensors", "weights")],
    );
    serve_voice_model(VOICE_DESIGN.repo, &[("config.json", "{ }")]);
    let kept = model_dir(models.path(), &CUSTOM_VOICE).join("config.json");
    std::fs::create_dir_all(kept.parent().unwrap()).unwrap();
    std::fs::write(&kept, "{}").unwrap();
    let (result, seen) = run(Some("hf_voice_token")).await;
    result.unwrap();
    assert!(voice_installed(data.path(), models.path()));
    assert_eq!(
        std::fs::read(model_dir(models.path(), &CUSTOM_VOICE).join("model.safetensors")).unwrap(),
        b"weights"
    );
    assert_eq!(
        std::fs::read(model_dir(models.path(), &VOICE_DESIGN).join("config.json")).unwrap(),
        b"{ }"
    );
    assert!(seen
        .iter()
        .any(|s| matches!(s, PackStatus::Downloading { file, .. } if file == "model.safetensors")));
    let fetched = site().requests(&format!("/{}/resolve/main/config.json", CUSTOM_VOICE.repo));
    assert!(fetched.is_empty(), "the finished file is skipped");
    let weights = site().requests(&format!(
        "/{}/resolve/main/model.safetensors",
        CUSTOM_VOICE.repo
    ));
    assert_eq!(
        weights[0].authorization.as_deref(),
        Some("Bearer hf_voice_token")
    );
    // The README and pictures are not part of the model.
    assert!(!model_dir(models.path(), &CUSTOM_VOICE)
        .join("README.md")
        .exists());
}
