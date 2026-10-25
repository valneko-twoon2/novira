include!("src/command_list.rs");

use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Newest modification time of the files under `dir` (None when there are none).
fn newest(dir: &Path) -> Option<SystemTime> {
    let mut latest = None;
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        let time = if path.is_dir() {
            newest(&path)
        } else {
            entry.metadata().ok()?.modified().ok()
        };
        latest = latest.max(time);
    }
    latest
}

/// Builds the frontend into `frontend/dist` when it is missing or older than its sources, so a plain
/// `cargo run` / `cargo build` opens the real app. Set NOVIRA_SKIP_FRONTEND_BUILD=1 to skip (CI without Node).
fn ensure_frontend() {
    let frontend: PathBuf = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../frontend");
    for watched in ["src", "index.html", "package.json", "vite.config.ts"] {
        println!(
            "cargo:rerun-if-changed={}",
            frontend.join(watched).display()
        );
    }
    println!("cargo:rerun-if-env-changed=NOVIRA_SKIP_FRONTEND_BUILD");
    if std::env::var_os("NOVIRA_SKIP_FRONTEND_BUILD").is_some() {
        return;
    }
    let index = frontend.join("dist").join("index.html");
    let built = index.metadata().and_then(|m| m.modified()).ok();
    let source = ["src", "index.html", "package.json", "vite.config.ts"]
        .iter()
        .filter_map(|p| {
            let path = frontend.join(p);
            if path.is_dir() {
                newest(&path)
            } else {
                path.metadata().and_then(|m| m.modified()).ok()
            }
        })
        .max();
    if built.is_some() && built >= source {
        return;
    }
    if !frontend.join("node_modules").is_dir() {
        panic!("frontend/node_modules is missing: run `npm install` in frontend/ (or set NOVIRA_SKIP_FRONTEND_BUILD=1)");
    }
    let status = if cfg!(windows) {
        std::process::Command::new("cmd")
            .args(["/C", "npm", "exec", "--", "vite", "build"])
            .current_dir(&frontend)
            .status()
    } else {
        std::process::Command::new("npm")
            .args(["exec", "--", "vite", "build"])
            .current_dir(&frontend)
            .status()
    };
    match status {
        Ok(s) if s.success() => {}
        other => panic!("the frontend build failed: {other:?}"),
    }
}

fn main() {
    ensure_frontend();
    // Only the listed commands are exposed to the WebView; each gets an `allow-<command>` permission.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
