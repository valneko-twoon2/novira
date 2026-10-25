//! Keeps the app alive after a failure: scans the backend's Rust sources for the two patterns that turn one panic
//! into a dead app.
//! 1. `.lock().unwrap()` / `.read().unwrap()` / `.write().unwrap()` (or `.expect(..)`): after one panic while the
//!    lock is held, every later caller panics too. Use `novira_core::sync::{LockExt, RwLockExt}` instead.
//! 2. A synchronous `#[tauri::command]` whose body does not go through `commands::guard`: those run on the window's
//!    main thread, where a panic ends the app.
//!
//! Limits: text scans of non-test code: everything before the first `#[cfg(test)]` of a file is read, and `tests.rs`
//! files are skipped (they are test modules, declared as `#[cfg(test)] mod tests;`). A lock call split over lines with a
//! comment in between, or a command body that calls `guard` only on one branch, is not seen.
use regex::Regex;
use std::path::{Path, PathBuf};

fn backend_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).unwrap().flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if !["target", "tests", "gen", "__snapshots__"].contains(&name.as_str()) {
                walk(&path, out);
            }
        } else if name.ends_with(".rs") {
            out.push(path);
        }
    }
}

/// Non-test code of each Rust source under `backend/*/src`.
fn sources() -> Vec<(String, String)> {
    let mut files = Vec::new();
    walk(&backend_root(), &mut files);
    files
        .into_iter()
        .filter(|p| p.components().any(|c| c.as_os_str() == "src"))
        .filter(|p| p.file_name().is_some_and(|n| n != "tests.rs"))
        .map(|p| {
            let text = std::fs::read_to_string(&p).unwrap();
            let code = match text.find("#[cfg(test)]") {
                Some(i) => text[..i].to_string(),
                None => text,
            };
            (p.display().to_string(), code)
        })
        .collect()
}

#[test]
fn no_lock_is_unwrapped() {
    let bad = Regex::new(r"\.(lock|read|write)\(\)\s*\.(unwrap\(\)|expect\()").unwrap();
    let mut found = Vec::new();
    for (path, code) in sources() {
        for m in bad.find_iter(&code) {
            let line = code[..m.start()].lines().count();
            found.push(format!("{path}:{line}"));
        }
    }
    assert!(
        found.is_empty(),
        "use lock_safe / read_safe / write_safe (novira_core::sync) instead of unwrapping a lock:\n{}",
        found.join("\n")
    );
}

#[test]
fn every_synchronous_command_is_guarded() {
    let code = std::fs::read_to_string(backend_root().join("src-tauri/src/commands.rs")).unwrap();
    let command = Regex::new(r"#\[tauri::command\]\s*pub fn (\w+)\([^{]*\{\s*(\S+)").unwrap();
    let mut seen = 0;
    let mut unguarded = Vec::new();
    for c in command.captures_iter(&code) {
        seen += 1;
        if !c[2].starts_with("guard(") {
            unguarded.push(c[1].to_string());
        }
    }
    assert!(seen > 10, "the scan found only {seen} synchronous commands");
    assert!(
        unguarded.is_empty(),
        "wrap these command bodies in guard(|| ..): {unguarded:?}"
    );
}
