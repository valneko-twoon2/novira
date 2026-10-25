//! Secret scan over the files git would commit (tracked plus untracked, not ignored): credential patterns
//! and key files. Keys belong in `novira-data/secrets/` (DPAPI) and never in the repository.
//!
//! Limits: only well-known token shapes are matched (Hugging Face, Anthropic, OpenAI, GitHub, AWS, PEM private
//! keys) plus 32-hex values on a line that names a key or token (Civitai keys have no prefix). Binary files and
//! files over 5 MB are skipped, history is not scanned, and a secret in an unknown format is not found.
use super::repo_root;
use regex::Regex;
use std::process::Command;

/// Files allowed to contain a match, with the reason. Keep it empty unless a fixture truly needs a key shape.
const ALLOWED: &[(&str, &str)] = &[];

const BINARY_EXT: &[&str] = &[
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "ico",
    "icns",
    "bmp",
    "mp4",
    "webm",
    "wav",
    "mp3",
    "ogg",
    "flac",
    "woff",
    "woff2",
    "ttf",
    "otf",
    "zip",
    "7z",
    "gz",
    "exe",
    "dll",
    "pdf",
    "safetensors",
    "ckpt",
    "pt",
    "bin",
    "sqlite",
];

struct Rule {
    name: &'static str,
    re: Regex,
}

fn rules() -> Vec<Rule> {
    let r = |name, re: &str| Rule {
        name,
        re: Regex::new(re).unwrap(),
    };
    vec![
        r("Hugging Face token", r"\bhf_[A-Za-z0-9]{30,}\b"),
        r("Anthropic key", r"\bsk-ant-[A-Za-z0-9_\-]{20,}"),
        r("OpenAI key", r"\bsk-(proj-|svcacct-)?[A-Za-z0-9_\-]{32,}"),
        r(
            "GitHub token",
            r"\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b",
        ),
        r("AWS access key", r"\b(AKIA|ASIA)[0-9A-Z]{16}\b"),
        r("private key", r"-----BEGIN ([A-Z]+ )*PRIVATE KEY-----"),
        r(
            "32-hex key next to a key name",
            r"(?i)(civitai|api[_-]?key|token|secret|bearer|authorization|password)[^\n]{0,40}\b[0-9a-f]{32}\b",
        ),
    ]
}

/// Names of files that hold keys by their nature.
fn key_file(path: &str) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path).to_ascii_lowercase();
    (name == ".env" || name.starts_with(".env.")) && !name.ends_with(".example")
        || ["pem", "key", "p12", "pfx", "keystore"]
            .iter()
            .any(|e| name.ends_with(&format!(".{e}")))
        || matches!(
            name.as_str(),
            "id_rsa" | "id_ed25519" | "id_ecdsa" | "credentials.json"
        )
}

fn findings(rules: &[Rule], text: &str) -> Vec<&'static str> {
    rules
        .iter()
        .filter(|r| r.re.is_match(text))
        .map(|r| r.name)
        .collect()
}

#[test]
fn no_credentials_in_files_git_would_commit() {
    let root = repo_root();
    let out = Command::new("git")
        .args([
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
        ])
        .current_dir(&root)
        .output()
        .expect("git is needed for the secret scan");
    assert!(out.status.success(), "git ls-files failed");
    let rules = rules();
    let mut found = Vec::new();
    for path in String::from_utf8_lossy(&out.stdout)
        .split('\0')
        .filter(|p| !p.is_empty())
    {
        if ALLOWED.iter().any(|(p, _)| *p == path) {
            continue;
        }
        if key_file(path) {
            found.push(format!("{path}: key file"));
            continue;
        }
        let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if BINARY_EXT.contains(&ext.as_str()) {
            continue;
        }
        let Ok(bytes) = std::fs::read(root.join(path)) else {
            continue;
        }; // deleted in the work tree
        if bytes.len() > 5 * 1024 * 1024 || bytes[..bytes.len().min(8000)].contains(&0) {
            continue;
        }
        for name in findings(&rules, &String::from_utf8_lossy(&bytes)) {
            found.push(format!("{path}: {name}"));
        }
    }
    assert!(
        found.is_empty(),
        "possible secrets (remove them and rotate the key):\n{}",
        found.join("\n")
    );
}

#[test]
fn the_patterns_recognise_real_shapes_only() {
    let rules = rules();
    // Built at run time so this file does not contain a matching token itself.
    let hex = "0123456789abcdef".repeat(2);
    let alnum = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
    for sample in [
        format!("token = \"hf_{alnum}\""),
        format!("sk-ant-api03-{alnum}"),
        format!("OPENAI_API_KEY=sk-proj-{alnum}"),
        format!("ghp_{alnum}"),
        format!("{}BEGIN OPENSSH PRIVATE KEY-----", "-".repeat(5)),
        format!("civitai_key: {hex}"),
    ] {
        assert!(!findings(&rules, &sample).is_empty(), "missed: {sample}");
    }
    for sample in [
        "hf_token is set".to_string(),
        "task-list-item".to_string(),
        format!("checksum = \"{hex}{hex}\""),
        format!("image id {hex}"),
    ] {
        assert!(
            findings(&rules, &sample).is_empty(),
            "false alarm: {sample}"
        );
    }
    assert!(
        key_file("deploy/.env")
            && key_file("a/server.pem")
            && !key_file(".env.example")
            && !key_file("keys.rs")
    );
}
