//! The models each tool can run a chat turn on, with the thinking efforts each takes. Claude's are its fixed aliases.
//! Codex keeps the models of the signed-in account in `models_cache.json` in its home folder (`CODEX_HOME`, or
//! `.codex` in the user's folder); that file is outside data, so only short plain names and known efforts are kept.
use super::{AgentProvider, CLAUDE_MODEL_ALIASES};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Every effort a tool may take, from the lightest.
pub const EFFORTS: [&str; 6] = ["low", "medium", "high", "xhigh", "max", "ultra"];
/// The efforts of Claude's models.
const CLAUDE_EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];
/// The efforts offered for the tool's own default model, which every model takes.
pub const DEFAULT_EFFORTS: [&str; 3] = ["low", "medium", "high"];
/// The most models listed, and the largest cache file read.
const MAX_MODELS: usize = 40;
const MAX_CACHE_BYTES: u64 = 4 * 1024 * 1024;

/// A model the user can choose for the assistant, with the efforts it takes and the one it starts at.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentModelOption {
    pub id: String,
    pub name: String,
    pub efforts: Vec<String>,
    pub default_effort: String,
}

/// A model name that is safe to pass on: letters, digits and `.-_`, not starting with `-`, at most 64 characters.
pub fn is_plain_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && !name.starts_with('-')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || ".-_".contains(c))
}

/// The models of a tool: Claude's aliases, or the models Codex lists for the account (none when it has no list).
pub fn models_of(provider: AgentProvider) -> Vec<AgentModelOption> {
    match provider {
        AgentProvider::Claude => claude_models(),
        AgentProvider::Codex => codex_home()
            .map(|home| codex_models(&home))
            .unwrap_or_default(),
        // A server's models are listed by the server itself (`endpoint::Endpoint::list_models`).
        AgentProvider::Openai => Vec::new(),
    }
}

fn claude_models() -> Vec<AgentModelOption> {
    CLAUDE_MODEL_ALIASES
        .iter()
        .map(|alias| AgentModelOption {
            id: (*alias).to_string(),
            name: format!("{}{}", alias[..1].to_ascii_uppercase(), &alias[1..]),
            efforts: CLAUDE_EFFORTS.iter().map(|e| (*e).to_string()).collect(),
            default_effort: "high".into(),
        })
        .collect()
}

/// Codex's home folder: `CODEX_HOME` when set, otherwise `.codex` in the user's folder.
fn codex_home() -> Option<PathBuf> {
    if let Some(home) = std::env::var_os("CODEX_HOME").filter(|v| !v.is_empty()) {
        return Some(PathBuf::from(home));
    }
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(|home| PathBuf::from(home).join(".codex"))
}

/// The models in Codex's cache in `home`; none when the file is missing, too large or unreadable.
pub fn codex_models(home: &Path) -> Vec<AgentModelOption> {
    let path = home.join("models_cache.json");
    match std::fs::metadata(&path) {
        Ok(meta) if meta.is_file() && meta.len() <= MAX_CACHE_BYTES => {}
        _ => return Vec::new(),
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .map(|v| parse_codex_models(&v))
        .unwrap_or_default()
}

/// The listed models of Codex's cache, in its order of priority: hidden ones, odd names and unknown efforts left out.
pub fn parse_codex_models(cache: &Value) -> Vec<AgentModelOption> {
    let Some(models) = cache["models"].as_array() else {
        return Vec::new();
    };
    let mut listed: Vec<(i64, AgentModelOption)> = models
        .iter()
        .filter(|m| m["visibility"].as_str() == Some("list"))
        .filter_map(|m| {
            let id = m["slug"].as_str().filter(|s| is_plain_name(s))?;
            let name = m["display_name"]
                .as_str()
                .map(str::trim)
                .filter(|n| {
                    !n.is_empty() && n.chars().count() <= 64 && !n.chars().any(char::is_control)
                })
                .unwrap_or(id);
            let offered: Vec<&str> = m["supported_reasoning_levels"]
                .as_array()
                .map(|levels| {
                    levels
                        .iter()
                        .filter_map(|l| l["effort"].as_str().or_else(|| l.as_str()))
                        .collect()
                })
                .unwrap_or_default();
            let efforts: Vec<String> = EFFORTS
                .iter()
                .filter(|e| offered.contains(e))
                .map(|e| (*e).to_string())
                .collect();
            if efforts.is_empty() {
                return None;
            }
            let wanted = m["default_reasoning_level"].as_str().unwrap_or("medium");
            let default_effort = efforts
                .iter()
                .find(|e| *e == wanted)
                .or_else(|| efforts.iter().find(|e| *e == "medium"))
                .unwrap_or(&efforts[0])
                .clone();
            let priority = m["priority"].as_i64().unwrap_or(i64::MAX);
            Some((
                priority,
                AgentModelOption {
                    id: id.to_string(),
                    name: name.to_string(),
                    efforts,
                    default_effort,
                },
            ))
        })
        .collect();
    listed.sort_by_key(|(priority, _)| *priority);
    let mut seen = std::collections::HashSet::new();
    listed
        .into_iter()
        .map(|(_, m)| m)
        .filter(|m| seen.insert(m.id.clone()))
        .take(MAX_MODELS)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn claude_lists_its_aliases_with_their_efforts() {
        let models = models_of(AgentProvider::Claude);
        assert_eq!(
            models.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            CLAUDE_MODEL_ALIASES
        );
        assert_eq!(models[1].name, "Opus");
        assert_eq!(models[0].efforts.last().map(String::as_str), Some("max"));
    }

    #[test]
    fn codex_cache_keeps_listed_plain_models_in_priority_order() {
        let cache = json!({ "models": [
            { "slug": "gpt-b", "display_name": "GPT-B", "visibility": "list", "priority": 2,
              "supported_reasoning_levels": [{ "effort": "low" }, { "effort": "ultra" }, { "effort": "warp" }],
              "default_reasoning_level": "ultra" },
            { "slug": "gpt-a", "display_name": "GPT-A", "visibility": "list", "priority": 1,
              "supported_reasoning_levels": [{ "effort": "medium" }, { "effort": "high" }], "default_reasoning_level": "none" },
            { "slug": "hidden", "visibility": "hide", "priority": 0, "supported_reasoning_levels": [{ "effort": "low" }] },
            { "slug": "a b&c", "visibility": "list", "supported_reasoning_levels": [{ "effort": "low" }] },
            { "slug": "-x", "visibility": "list", "supported_reasoning_levels": [{ "effort": "low" }] },
            { "slug": "no-efforts", "visibility": "list", "supported_reasoning_levels": [{ "effort": "warp" }] },
            { "slug": "gpt-a", "display_name": "Again", "visibility": "list", "priority": 3,
              "supported_reasoning_levels": [{ "effort": "low" }] },
            { "slug": "odd-name", "display_name": "bad\u{7}name", "visibility": "list", "priority": 4,
              "supported_reasoning_levels": ["low"] }
        ]});
        let models = parse_codex_models(&cache);
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids, ["gpt-a", "gpt-b", "odd-name"]);
        assert_eq!(
            models[0].default_effort, "medium",
            "an unknown default falls back to medium"
        );
        assert_eq!(models[1].efforts, ["low", "ultra"]);
        assert_eq!(models[1].default_effort, "ultra");
        assert_eq!(
            models[2].name, "odd-name",
            "a name with a control character shows the id"
        );
        assert!(parse_codex_models(&json!({ "models": "x" })).is_empty());
    }

    #[test]
    fn codex_cache_that_is_missing_or_broken_lists_nothing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(codex_models(dir.path()).is_empty());
        std::fs::write(dir.path().join("models_cache.json"), "{not json").unwrap();
        assert!(codex_models(dir.path()).is_empty());
        std::fs::write(
            dir.path().join("models_cache.json"),
            r#"{"models":[{"slug":"m1","visibility":"list","supported_reasoning_levels":[{"effort":"high"}]}]}"#,
        )
        .unwrap();
        assert_eq!(codex_models(dir.path())[0].id, "m1");
    }

    #[test]
    fn only_plain_names_pass() {
        for ok in ["gpt-6.1-sol", "opus", "a_b"] {
            assert!(is_plain_name(ok), "{ok}");
        }
        for bad in [
            "",
            "-m",
            "a b",
            "a;b",
            "a%b",
            "a\"b",
            "a[1m]",
            &"m".repeat(65),
        ] {
            assert!(!is_plain_name(bad), "{bad:?}");
        }
    }
}
