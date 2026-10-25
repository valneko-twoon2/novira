//! Pins the security-critical parts of `tauri.conf.json` (the WebView's CSP) and keeps Tauri plugins out.
//! The capability list itself is checked against the registered commands in `src/commands.rs`.
//! Limits: this reads the configuration only; it does not load the page, so a CSP the runtime would
//! modify or ignore is not detected.
use super::repo_root;
use std::collections::HashMap;

fn conf() -> serde_json::Value {
    serde_json::from_str(include_str!("../../tauri.conf.json")).expect("tauri.conf.json parses")
}

/// Directive name -> its sources, in order.
fn parse_csp(csp: &str) -> HashMap<String, Vec<String>> {
    csp.split(';')
        .filter_map(|d| {
            let mut parts = d.split_whitespace();
            let name = parts.next()?.to_ascii_lowercase();
            Some((name, parts.map(str::to_string).collect()))
        })
        .collect()
}

fn csp() -> HashMap<String, Vec<String>> {
    let conf = conf();
    let csp = conf["app"]["security"]["csp"]
        .as_str()
        .expect("app.security.csp is a single string");
    parse_csp(csp)
}

fn sources<'a>(csp: &'a HashMap<String, Vec<String>>, directive: &str) -> &'a [String] {
    csp.get(directive)
        .or_else(|| csp.get("default-src"))
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

#[test]
fn scripts_come_only_from_the_app_itself() {
    let csp = csp();
    assert_eq!(csp["default-src"], ["'self'"]);
    assert_eq!(sources(&csp, "script-src"), ["'self'"]);
    for (name, list) in &csp {
        for bad in [
            "'unsafe-eval'",
            "'wasm-unsafe-eval'",
            "'unsafe-hashes'",
            "'strict-dynamic'",
        ] {
            assert!(!list.iter().any(|s| s == bad), "{name} allows {bad}");
        }
        // Inline code is allowed for styles only (React style props); never for scripts.
        if name != "style-src" {
            assert!(
                !list.iter().any(|s| s == "'unsafe-inline'"),
                "{name} allows 'unsafe-inline'"
            );
        }
    }
}

#[test]
fn plugins_frames_forms_and_base_are_closed() {
    let csp = csp();
    for directive in ["object-src", "frame-src", "base-uri", "form-action"] {
        assert_eq!(
            csp.get(directive).map(Vec::as_slice),
            Some(&["'none'".to_string()][..]),
            "{directive}"
        );
    }
}

#[test]
fn no_directive_allows_any_host_or_scheme() {
    let csp = csp();
    for (name, list) in &csp {
        for s in list {
            assert_ne!(s, "*", "{name} allows every host");
            assert!(
                !matches!(s.as_str(), "http:" | "https:" | "ws:" | "wss:" | "file:"),
                "{name} allows the whole scheme {s}"
            );
            // Subdomain wildcards are acceptable for pictures from the model sites, and for the videos Civitai shows as
            // covers (its own host only).
            if s.contains('*') {
                assert!(
                    name == "img-src" || (name == "media-src" && s == "https://*.civitai.com"),
                    "{name} has a wildcard host {s}"
                );
            }
        }
    }
}

#[test]
fn connections_stay_inside_the_app() {
    let csp = csp();
    let allowed = [
        "'self'",
        "ipc:",
        "http://ipc.localhost",
        "http://novira-image.localhost",
        "novira-image:",
        "data:",
        "blob:",
    ];
    for s in sources(&csp, "connect-src") {
        assert!(
            allowed.contains(&s.as_str()),
            "connect-src allows {s}: the WebView talks to the backend over IPC only"
        );
    }
}

#[test]
fn development_and_asset_settings_do_not_loosen_the_policy() {
    let conf = conf();
    let security = &conf["app"]["security"];
    // null: the dev build uses the same CSP.
    assert!(security["devCsp"].is_null(), "devCsp must stay null");
    assert!(security
        .get("dangerousDisableAssetCspModification")
        .is_none());
    assert!(security.get("dangerousRemoteDomainIpcAccess").is_none());
    assert!(
        security["assetProtocol"]["enable"].as_bool() != Some(true),
        "the asset protocol exposes files"
    );
    for window in conf["app"]["windows"].as_array().unwrap() {
        if let Some(url) = window["url"].as_str() {
            assert!(!url.contains("://"), "window loads a remote page: {url}");
        }
    }
}

#[test]
fn no_tauri_plugin_is_a_dependency() {
    // fs, shell, http, opener and friends would widen what the WebView can do.
    let root = repo_root();
    for manifest in [
        "backend/Cargo.toml",
        "backend/src-tauri/Cargo.toml",
        "backend/crates/novira-core/Cargo.toml",
    ] {
        let text = std::fs::read_to_string(root.join(manifest)).unwrap();
        assert!(
            !text.contains("tauri-plugin-"),
            "{manifest} depends on a Tauri plugin"
        );
    }
    let package = std::fs::read_to_string(root.join("frontend/package.json")).unwrap();
    assert!(
        !package.contains("@tauri-apps/plugin-"),
        "frontend/package.json depends on a Tauri plugin"
    );
}

#[test]
fn only_the_default_capability_exists() {
    // A second capability file would grant permissions the command list test does not see.
    let dir = repo_root().join("backend/src-tauri/capabilities");
    let names: Vec<String> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(names, ["default.json"]);
}
