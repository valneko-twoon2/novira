//! Changing the ComfyUI version (and package) of the install novira owns, against a fake `7zr.exe`, a fake `python` and a
//! loopback site that stands in for ComfyUI and for GitHub. The release archive is put in place up front, so nothing is
//! downloaded; the packs are fetched from the fake site. Windows only, like the install itself.
#![cfg(windows)]
mod fake_site;

use fake_site::{site, Route};
use novira_core::comfy::install::{comfyui_dir, previous_dir, PORTABLE_DIR};
use novira_core::comfy::node_packs::custom_nodes_dir;
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineError, EngineStatus};
use novira_core::packs::PackStatus;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// The unpacker: lays out a portable ComfyUI, or fails, as the archive's text says.
const FAKE_7ZR: &str = r#"
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
    if mode.trim() == "fail" {
        eprintln!("ERROR: Can not write output file");
        std::process::exit(2);
    }
    put("ComfyUI_windows_portable/ComfyUI/main.py");
    put("ComfyUI_windows_portable/python_embeded/python.exe");
}
"#;

/// The pack unzipper (the "archive" is one line, `plain` or `badzip`); started as ComfyUI it only stays running.
const FAKE_PYTHON: &str = "@echo off\r\n\
if \"%~2\"==\"zipfile\" goto unzip\r\n\
exit /b 9\r\n\
:unzip\r\n\
set /p MODE=<\"%~4\"\r\n\
set \"OUT=%~5\"\r\n\
if \"%MODE%\"==\"badzip\" goto badzip\r\n\
mkdir \"%OUT%\"\r\n\
mkdir \"%OUT%\\pack-abc\"\r\n\
echo code> \"%OUT%\\pack-abc\\nodes.py\"\r\n\
exit /b 0\r\n\
:badzip\r\n\
echo corrupt archive 1>&2\r\n\
exit /b 3\r\n";

fn fake_tool() -> &'static Path {
    static TOOL: OnceLock<PathBuf> = OnceLock::new();
    TOOL.get_or_init(|| {
        let dir = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("fake7zr-switch");
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

struct World {
    root: tempfile::TempDir,
}

impl World {
    /// An install of the old version with the unpacker and the release archive `tag` (its text is the mode) in place.
    fn new(tag: &str, archive_mode: &str) -> World {
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(root.path().join(".tools")).unwrap();
        std::fs::copy(fake_tool(), root.path().join(".tools").join("7zr.exe")).unwrap();
        std::fs::create_dir_all(root.path().join(".downloads")).unwrap();
        std::fs::write(
            root.path()
                .join(".downloads")
                .join(format!("comfyui-{tag}.7z")),
            archive_mode,
        )
        .unwrap();
        let comfy = comfyui_dir(root.path());
        std::fs::create_dir_all(comfy.join("custom_nodes")).unwrap();
        std::fs::write(comfy.join("main.py"), "old").unwrap();
        std::fs::write(
            comfy.join("comfyui_version.py"),
            "__version__ = \"0.3.0\"\n",
        )
        .unwrap();
        World { root }
    }

    fn root(&self) -> &Path {
        self.root.path()
    }

    /// A pack of the old install, as novira marks it.
    fn pack(&self, folder: &str, url: Option<&str>) {
        let dir = custom_nodes_dir(&comfyui_dir(self.root())).join(folder);
        std::fs::create_dir_all(&dir).unwrap();
        if let Some(url) = url {
            std::fs::write(
                dir.join(".novira-pack.json"),
                serde_json::json!({ "url": url }).to_string(),
            )
            .unwrap();
        }
    }

    /// An engine for the install. `up` serves ComfyUI's `/system_stats` from the fake site; otherwise the port is closed
    /// and the fake python (which exits at once) cannot start it.
    fn engine(&self, up: bool, package: &str) -> ComfyEngine {
        let python = self.root().join("python.cmd");
        std::fs::write(&python, FAKE_PYTHON).unwrap();
        let port = if up {
            site().put("/system_stats", Route::bytes("{}"));
            site()
                .base
                .rsplit(':')
                .next()
                .unwrap()
                .parse::<u16>()
                .unwrap()
        } else {
            let closed = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            closed.local_addr().unwrap().port()
        };
        self.engine_on(port, package)
    }

    fn engine_on(&self, port: u16, package: &str) -> ComfyEngine {
        let python = self.root().join("python.cmd");
        std::fs::write(&python, FAKE_PYTHON).unwrap();
        let process = ComfyProcess::new(OwnedProcessConfig {
            comfyui_dir: comfyui_dir(self.root()),
            python: Some(python),
            host: "127.0.0.1".into(),
            port,
            extra_model_paths: self.root().join("extra.yaml"),
            extra_args: vec![],
            log_file: self.root().join("logs").join("comfyui.log"),
        });
        ComfyEngine::new(
            &format!("http://127.0.0.1:{port}"),
            Some(process),
            Duration::from_secs(3),
        )
        .unwrap()
        .with_installer(self.root().to_path_buf(), package.into())
    }
}

fn serve_pack(name: &str, mode: &str) {
    site().put(&format!("/owner/{name}/zip/HEAD"), Route::bytes(mode));
}

#[tokio::test]
async fn a_switch_installs_the_new_version_and_every_pack_again() {
    let world = World::new("v0.4.0", "ok");
    world.pack("sw-good", Some("https://github.com/owner/sw-good"));
    world.pack("sw-bad", Some("https://github.com/owner/sw-bad"));
    world.pack("sw-unmarked", None);
    world.pack(
        "sw-elsewhere",
        Some("https://example.com/owner/sw-elsewhere"),
    );
    serve_pack("sw-good", "plain");
    serve_pack("sw-bad", "badzip");
    let engine = world.engine(true, "nvidia");
    let seen = Mutex::new(Vec::new());
    let failed = engine
        .switch_version(
            "v0.4.0",
            world.root().parent().unwrap(),
            &CancellationToken::new(),
            &|url, s| seen.lock().unwrap().push((url, s)),
        )
        .await
        .unwrap();
    // Only the pack that could not be fetched is reported; the others are installed again or have nothing to fetch.
    assert_eq!(failed, ["sw-bad"]);
    let seen = seen.into_inner().unwrap();
    assert!(seen
        .iter()
        .any(|(u, s)| u.ends_with("sw-good") && *s == PackStatus::Ready));
    assert!(seen
        .iter()
        .any(|(u, s)| u.ends_with("sw-bad") && matches!(s, PackStatus::Error { .. })));
    let comfy = comfyui_dir(world.root());
    assert_eq!(std::fs::read_to_string(comfy.join("main.py")).unwrap(), "x");
    assert!(custom_nodes_dir(&comfy)
        .join("sw-good")
        .join("nodes.py")
        .is_file());
    // The old package is dropped once the new one answers.
    assert!(!previous_dir(world.root()).exists());
    assert_eq!(engine.status(), EngineStatus::Ready);
    engine.shutdown();
}

#[tokio::test]
async fn a_package_that_cannot_be_unpacked_leaves_the_old_version_running() {
    let world = World::new("v0.4.0", "fail");
    let engine = world.engine(true, "nvidia");
    let err = engine
        .switch_version(
            "v0.4.0",
            world.root(),
            &CancellationToken::new(),
            &|_, _| {},
        )
        .await
        .unwrap_err();
    assert!(
        matches!(&err, EngineError::Failed(m) if m.contains("Unpacking ComfyUI failed")),
        "{err:?}"
    );
    assert_eq!(
        std::fs::read_to_string(comfyui_dir(world.root()).join("main.py")).unwrap(),
        "old"
    );
    engine.shutdown();
}

#[tokio::test]
async fn a_cancelled_pack_install_puts_the_old_version_back() {
    let world = World::new("v0.4.0", "ok");
    world.pack("sw-cancel", Some("https://github.com/owner/sw-cancel"));
    serve_pack("sw-cancel", "plain");
    let engine = world.engine(true, "nvidia");
    let cancel = CancellationToken::new();
    let trip = cancel.clone();
    let err = engine
        .switch_version("v0.4.0", world.root(), &cancel, &|_, _| trip.cancel())
        .await;
    // The cancel lands during the first pack: the work stops and the old package is back.
    assert_eq!(err, Err(EngineError::Cancelled));
    assert_eq!(
        std::fs::read_to_string(comfyui_dir(world.root()).join("main.py")).unwrap(),
        "old"
    );
    engine.shutdown();
}

#[tokio::test]
async fn a_new_version_that_does_not_start_is_replaced_by_the_old_one() {
    let world = World::new("v0.4.0", "ok");
    let engine = world.engine(false, "nvidia");
    let err = engine
        .switch_version(
            "v0.4.0",
            world.root(),
            &CancellationToken::new(),
            &|_, _| {},
        )
        .await
        .unwrap_err();
    assert!(
        matches!(&err, EngineError::Failed(m) if m.contains("did not start, so the old version was put back")),
        "{err:?}"
    );
    assert_eq!(
        std::fs::read_to_string(comfyui_dir(world.root()).join("main.py")).unwrap(),
        "old"
    );
    assert!(!previous_dir(world.root()).exists());
    assert!(world.root().join(PORTABLE_DIR).is_dir());
    engine.shutdown();
}

/// A ComfyUI stand-in on a free port that refuses (503) until `delay` has passed (the new package "starts" late). A
/// closed port is not used: Windows retries a refused loopback connection for seconds.
async fn answer_later(delay: Duration) -> (u16, tokio::task::JoinHandle<()>) {
    let started = std::time::Instant::now();
    let app = axum::Router::new().route(
        "/system_stats",
        axum::routing::get(move || async move {
            if started.elapsed() >= delay {
                axum::http::StatusCode::OK
            } else {
                axum::http::StatusCode::SERVICE_UNAVAILABLE
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    (
        port,
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() }),
    )
}

#[tokio::test]
async fn a_package_change_installs_the_same_version_again() {
    let world = World::new("v0.3.0", "ok");
    world.pack("sw-pkg-bad", Some("https://github.com/owner/sw-pkg-bad"));
    serve_pack("sw-pkg-bad", "badzip");
    // The install was made from the nvidia package and the settings now name amd.
    novira_core::comfy::install::adopt_package(world.root(), "nvidia").unwrap();
    let (port, server) = answer_later(Duration::from_millis(500)).await;
    let engine = world.engine_on(port, "amd");
    engine.prepare(&CancellationToken::new()).await.unwrap();
    assert_eq!(
        std::fs::read_to_string(comfyui_dir(world.root()).join("main.py")).unwrap(),
        "x"
    );
    assert_eq!(
        novira_core::comfy::install::installed_package(world.root()).as_deref(),
        Some("amd")
    );
    server.abort();
    engine.shutdown();
}

#[tokio::test]
async fn a_package_change_needs_a_readable_version() {
    let world = World::new("v0.3.0", "ok");
    std::fs::remove_file(comfyui_dir(world.root()).join("comfyui_version.py")).unwrap();
    novira_core::comfy::install::adopt_package(world.root(), "nvidia").unwrap();
    let engine = world.engine(false, "amd");
    let err = engine.prepare(&CancellationToken::new()).await.unwrap_err();
    assert!(
        matches!(&err, EngineError::Failed(m) if m.contains("cannot be read")),
        "{err:?}"
    );
    engine.shutdown();
}
