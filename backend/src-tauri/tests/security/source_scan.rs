//! Source scans of the Rust code under `backend/` for two injection patterns:
//! 1. starting a command interpreter (`cmd /C`, `powershell -Command`, `sh -c`, …) with `Command::new`;
//!    programs are started directly with their arguments as separate values;
//! 2. SQL built with `format!`: only a table name from `db::Table::name()` may be put into SQL text,
//!    values go through bound parameters, and `rusqlite` is used only in the database module.
//!
//! Limits: these are text scans. A program name held in a variable, SQL assembled with `+`, `concat!` or
//! `push_str`, or a database reached through a re-export is not seen. Comment lines are skipped.
use super::repo_root;
use regex::Regex;
use std::path::{Path, PathBuf};

/// Build-time only: runs `npm` through `cmd /C` with fixed arguments; never reachable from the app.
const SHELL_ALLOWED: &[&str] = &["backend/src-tauri/build.rs"];
/// These checks themselves hold the forbidden forms as test data.
const SCAN_SELF: &str = "backend/src-tauri/tests/security/";
/// The database module, and the service's conversion of its error type; and one test that has to delete the first-scan
/// marks from `meta` (one fixed statement without values; `Db` cannot remove a mark).
const RUSQLITE_ALLOWED: &[&str] = &[
    "backend/crates/novira-core/src/db.rs",
    "backend/crates/novira-core/src/service/mod.rs",
    "backend/crates/novira-core/tests/backend_service/first_scan.rs",
];

fn rust_sources() -> Vec<(String, String)> {
    let root = repo_root();
    let mut files = Vec::new();
    walk(&root.join("backend"), &mut files);
    files
        .into_iter()
        .filter_map(|p| {
            let rel = p
                .strip_prefix(&root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            if rel.starts_with(SCAN_SELF) {
                return None;
            }
            let text = std::fs::read_to_string(&p).unwrap();
            // Drop comment lines so documentation may name the forbidden forms.
            let code: Vec<&str> = text
                .lines()
                .filter(|l| !l.trim_start().starts_with("//"))
                .collect();
            Some((rel, code.join("\n")))
        })
        .collect()
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_string_lossy();
        if path.is_dir() {
            if !matches!(name.as_ref(), "target" | "gen" | "node_modules") {
                walk(&path, out);
            }
        } else if name.ends_with(".rs") {
            out.push(path);
        }
    }
}

fn shell_violations(code: &str) -> Vec<String> {
    let interpreter = Regex::new(
        r#"(?i)Command::new\(\s*"(cmd|cmd\.exe|powershell|powershell\.exe|pwsh|pwsh\.exe|sh|bash|zsh|wsl|wsl\.exe|/bin/sh|/bin/bash|/usr/bin/env)""#,
    )
    .unwrap();
    // Interpreter switches as separate argument values (`.arg("/C")`, `.args(["-Command", …])`).
    let switch = Regex::new(r#""(/[cC]|/[kK]|-[cC]ommand|-[eE]ncoded[cC]ommand)""#).unwrap();
    interpreter
        .find_iter(code)
        .chain(switch.find_iter(code))
        .map(|m| m.as_str().to_string())
        .collect()
}

#[test]
fn no_command_interpreter_is_started() {
    let mut found = Vec::new();
    for (path, code) in rust_sources() {
        if SHELL_ALLOWED.contains(&path.as_str()) {
            continue;
        }
        for hit in shell_violations(&code) {
            found.push(format!("{path}: {hit}"));
        }
    }
    assert!(
        found.is_empty(),
        "start the program directly, not through a shell:\n{}",
        found.join("\n")
    );
}

/// Every `format!(…)` call in `code` as (first string literal, remaining arguments).
fn format_calls(code: &str) -> Vec<(String, Vec<String>)> {
    let mut out = Vec::new();
    let mut rest = code;
    while let Some(i) = rest.find("format!(") {
        let body = &rest[i + "format!(".len()..];
        let (args, used) = split_args(body);
        rest = &body[used..];
        let Some((first, others)) = args.split_first() else {
            continue;
        };
        let lit = first.trim();
        let lit = lit.trim_start_matches('r').trim_matches('#');
        if lit.starts_with('"') {
            out.push((
                lit.trim_matches('"').to_string(),
                others.iter().map(|a| a.trim().to_string()).collect(),
            ));
        }
    }
    out
}

/// Splits the arguments up to the closing parenthesis; returns them and the bytes consumed.
fn split_args(body: &str) -> (Vec<String>, usize) {
    let bytes = body.as_bytes();
    let (mut depth, mut i, mut start) = (0i32, 0usize, 0usize);
    let mut args = Vec::new();
    while i < bytes.len() {
        match bytes[i] {
            b'"' => {
                i += 1;
                while i < bytes.len() && bytes[i] != b'"' {
                    i += if bytes[i] == b'\\' { 2 } else { 1 };
                }
            }
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' | b'}' if depth > 0 => depth -= 1,
            b')' => {
                args.push(body[start..i].to_string());
                return (args, i + 1);
            }
            b',' if depth == 0 => {
                args.push(body[start..i].to_string());
                start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    (args, bytes.len())
}

fn sql_violations(code: &str) -> Vec<String> {
    // Statement shapes rather than single keywords, so messages such as "update failed: {e}" are not SQL.
    let sql = Regex::new(
        r"(?is)^\s*(select\b.*\bfrom\b|insert\s+(or\s+\w+\s+)?into\b|replace\s+into\b|update\s+\S+\s+set\b|delete\s+from\b|(create|drop)\s+(temp\s+|unique\s+)?(table|index|view|trigger)\b|alter\s+table\b|pragma\s|attach\s+database\b|with\s+\w+\s+as\s*\()",
    )
    .unwrap();
    let table_name = Regex::new(r"^[a-z_][a-z0-9_]*\.name\(\)$").unwrap();
    let mut found = Vec::new();
    for (lit, args) in format_calls(code) {
        if !sql.is_match(&lit) {
            continue;
        }
        // Inline captures (`{id}`) or format specs would put an arbitrary value into the SQL text.
        let holes = lit.matches('{').count() - 2 * lit.matches("{{").count();
        let bare = lit.matches("{}").count();
        let named_args = args.iter().any(|a| !table_name.is_match(a));
        if holes != bare || bare != args.len() || named_args {
            found.push(format!("format!(\"{lit}\", {})", args.join(", ")));
        }
    }
    found
}

#[test]
fn sql_text_takes_only_table_names() {
    let mut found = Vec::new();
    for (path, code) in rust_sources() {
        for hit in sql_violations(&code) {
            found.push(format!("{path}: {hit}"));
        }
        if code.contains("rusqlite") && !RUSQLITE_ALLOWED.contains(&path.as_str()) {
            found.push(format!("{path}: uses rusqlite outside the database module"));
        }
    }
    assert!(
        found.is_empty(),
        "bind values as parameters (?1); only Table::name() may be formatted into SQL:\n{}",
        found.join("\n")
    );
}

#[test]
fn the_scans_recognise_the_forbidden_forms() {
    assert_eq!(
        shell_violations(r#"std::process::Command::new("cmd").args(["/C", "x"])"#).len(),
        2
    );
    assert_eq!(
        shell_violations("Command::new(\n    \"PowerShell\"\n)").len(),
        1
    );
    assert_eq!(
        shell_violations(r#"cmd.args(["-Command", script])"#).len(),
        1
    );
    assert!(shell_violations(r#"Command::new(python).args(["-m", "pip", "-c", file])"#).is_empty());

    assert!(sql_violations(r#"format!("DELETE FROM {} WHERE id = ?1", table.name())"#).is_empty());
    assert!(
        sql_violations(r#"format!("CREATE TABLE IF NOT EXISTS {} (id TEXT);", t.name())"#)
            .is_empty()
    );
    assert_eq!(
        sql_violations(r#"format!("SELECT * FROM images WHERE id = '{id}'")"#).len(),
        1
    );
    assert_eq!(
        sql_violations(r#"format!("DELETE FROM {} WHERE id = '{}'", table.name(), id)"#).len(),
        1
    );
    assert_eq!(
        sql_violations(r#"format!("  update images set data = '{}'", data)"#).len(),
        1
    );
    assert!(sql_violations(r#"format!("selected {} images", n)"#).is_empty());
    assert!(sql_violations(r#"format!("update failed: {e}")"#).is_empty());
}
