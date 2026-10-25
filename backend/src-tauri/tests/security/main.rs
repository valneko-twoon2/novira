//! Mechanical security checks over the configuration and the sources (see `.claude/rules/security.md`).
//! Each module states what it guards and what it cannot see. Run with `cargo test -p novira --test security`.
mod config;
mod secrets;
mod source_scan;

use std::path::PathBuf;

/// The repository root (backend/src-tauri -> ../..).
pub fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("repository root")
}
