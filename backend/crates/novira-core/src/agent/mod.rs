//! The AI assistant. It is one of three providers. `claude` and `codex` are command-line tools the user signs in to (a
//! subscription login, no API key stored here): each request is one headless run with the tool's own tools switched off
//! and only the app's MCP server connected (`mcp`), so the model acts on the app through the tools in `tools`. The
//! third is a server with an OpenAI-compatible chat-completions API (Ollama, LM Studio, ...): a model there has no MCP
//! client, so the app calls the server itself and runs the tool loop (`toolloop`, `endpoint`), sending each call the
//! model returns through the same `mcp::dispatch`. Either way each call is relayed to the frontend, which owns what it
//! reads and changes (`relay`).

//! Layout: `cli` runs the tools, `prompt` builds what is sent, `chat` runs one request with its MCP server, `tools`
//! defines and checks the tools, `mcp` serves them, `relay` passes the calls to the frontend, `reply` reads the final
//! answer, `endpoint` talks to an OpenAI-compatible server and `toolloop` runs a request on it, `attach` prepares the
//! pictures the user attaches, `reference` looks facts up on Wikipedia; this file holds the data types and the saved choice of provider.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

pub mod attach;
mod chat;
mod cli;
pub mod endpoint;
pub mod mcp;
mod models;
mod prompt;
pub mod reference;
pub mod relay;
mod reply;
pub mod toolloop;
pub mod tools;

pub use attach::AgentImage;
pub use chat::{
    chat, claude_args, claude_mcp_config, claude_message, codex_args, McpLink, CHAT_TIMEOUT,
    MAX_TOOL_CALLS, TOKEN_ENV,
};
pub use cli::{find_exe, login, status, status_of};
pub use endpoint::{
    AgentEndpointInfo, AgentEndpointInput, AgentEndpointTest, AgentToolsState, Endpoint,
    EndpointConfig, OLLAMA_URL,
};
pub use models::{models_of, AgentModelOption};
pub use prompt::{build_prompt, build_system};
pub use relay::{AgentToolAnswer, AgentToolCall, Relay};
pub use reply::parse_reply;

const PROVIDER_FILE: &str = "agent.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentProvider {
    Claude,
    Codex,
    /// A server with an OpenAI-compatible chat-completions API (Ollama, LM Studio, llama.cpp, vLLM, hosted services).
    /// Not a command: the app talks to it itself and runs the tool loop (`toolloop`).
    Openai,
}

impl AgentProvider {
    /// The command-line tool of the provider; none for a server the app talks to itself.
    fn exe_name(self) -> Option<&'static str> {
        match self {
            Self::Claude => Some("claude"),
            Self::Codex => Some("codex"),
            Self::Openai => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub provider: Option<AgentProvider>,
    /// The selected tool was found on this PC (a server is always "installed": there is nothing to install).
    pub installed: bool,
    /// Signed in to the tool, or for a server: a base URL and a model are saved.
    pub logged_in: bool,
    /// The models the user can choose for the tool, with their efforts; empty when the tool lists none (and for a
    /// server, whose models come from `agent_endpoint_models`).
    pub models: Vec<AgentModelOption>,
    /// The saved OpenAI-compatible server, shown whichever provider is selected so the form keeps its values.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<AgentEndpointInfo>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTurn {
    pub role: String,
    pub text: String,
}

/// One message to the assistant. Only what every request needs travels with it; the model reads the rest (models,
/// settings, editors, the guide, extensions) through the app's tools.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRequest {
    pub message: String,
    pub locale: String,
    #[serde(default)]
    pub history: Vec<AgentTurn>,
    /// What the user is looking at: a tab (`generate`, `canvas`, `comic`, `upscaling`, `workflows`, `models`,
    /// `browse`, `queue`, `extensions`) or, on the Generate tab, `text`, `video`, `music`, `voice` or `logo`.
    #[serde(default)]
    pub screen: Option<String>,
    /// The id (`ext:<folder>`) of the extension the user asked about from the extension manager.
    #[serde(default)]
    pub focus: Option<String>,
    /// The model the tool runs this request on (an alias such as `opus`, or a full model name); none is the tool's default.
    /// Claude takes letters, digits and `.-_[]`; Codex only a model it listed itself (see `cli_model`).
    #[serde(default)]
    pub agent_model: Option<String>,
    /// How hard the model thinks: one the chosen model takes (see `cli_effort`); none is the default.
    #[serde(default)]
    pub effort: Option<String>,
    /// Gallery pictures the user attached to this message (names; at most `attach::MAX_ATTACHMENTS`). The service reads
    /// them and hands them to the provider with the message.
    #[serde(default)]
    pub images: Vec<String>,
    /// The attached pictures, read and prepared by the service (`attach::prepare`); never part of the wire request.
    #[serde(skip)]
    pub attached: Vec<AgentImage>,
}

/// Claude's model aliases, passed as fixed arguments (`--model <alias>`).
pub const CLAUDE_MODEL_ALIASES: [&str; 4] = ["fable", "opus", "sonnet", "haiku"];

/// How the chosen model reaches the tool. A program started through a `.cmd` file goes through cmd.exe, so only fixed
/// words are ever arguments; a typed name goes in an environment variable instead (docs/design/security.md).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelChoice<'a> {
    /// One of Claude's aliases: the argument `--model <alias>`.
    Alias(&'static str),
    /// Any other model name, in `ANTHROPIC_MODEL`. Only a short name of letters, digits and `.-_[]` is passed on.
    Named(&'a str),
    /// A model Codex listed for the account: the argument `-m <name>`, a plain name (see `models::is_plain_name`).
    Listed(&'a str),
}

/// The model of a request for the tool, or none for its default. Codex's model can only be set by an argument, so it
/// takes only a name of the models it listed (`listed`), which are plain names.
pub fn cli_model<'a>(
    provider: AgentProvider,
    request: &'a AgentRequest,
    listed: &[AgentModelOption],
) -> Option<ModelChoice<'a>> {
    let name = request.agent_model.as_deref()?.trim();
    if provider == AgentProvider::Openai {
        // A server's model is part of its saved settings, never taken from a request.
        return None;
    }
    if provider == AgentProvider::Codex {
        let known = listed.iter().any(|m| m.id == name) && models::is_plain_name(name);
        return known.then_some(ModelChoice::Listed(name));
    }
    if let Some(alias) = CLAUDE_MODEL_ALIASES.iter().copied().find(|a| *a == name) {
        return Some(ModelChoice::Alias(alias));
    }
    let plain = !name.is_empty()
        && name.len() <= 64
        && !name.starts_with('-')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || ".-_[]".contains(c));
    plain.then_some(ModelChoice::Named(name))
}

/// The effort of a request when the tool knows it: one the chosen model takes (`listed`), or for the tool's default
/// model `low` to `max` for Claude and `low` to `high` for Codex.
pub fn cli_effort(
    provider: AgentProvider,
    request: &AgentRequest,
    listed: &[AgentModelOption],
) -> Option<&'static str> {
    let wanted = request.effort.as_deref()?.trim();
    let model = request.agent_model.as_deref().map(str::trim);
    let allowed = |e: &str| match listed.iter().find(|m| Some(m.id.as_str()) == model) {
        Some(m) => m.efforts.iter().any(|x| x == e),
        None => match provider {
            AgentProvider::Claude => e != "ultra",
            AgentProvider::Codex => models::DEFAULT_EFFORTS.contains(&e),
            AgentProvider::Openai => false,
        },
    };
    models::EFFORTS
        .iter()
        .copied()
        .find(|e| *e == wanted && allowed(e))
}

/// The assistant's final answer. What it changed on the way is known to the frontend, which ran the tool calls.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AgentReply {
    /// A few short lines on how the request was read and why (the model's own summary).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub thoughts: Vec<String>,
    pub text: String,
}

// Provider selection ---------------------------------------------------------------------------------------------

/// What `agent.json` holds: the selected provider and the saved OpenAI-compatible server (never its key, which is a
/// secret in `secrets/`). Each part is read on its own, so an unreadable one does not lose the other.
#[derive(Default, Serialize)]
struct SavedChoice {
    provider: Option<AgentProvider>,
    endpoint: Option<EndpointConfig>,
}

fn load_choice(data_dir: &Path) -> SavedChoice {
    let Some(text) = std::fs::read_to_string(data_dir.join(PROVIDER_FILE)).ok() else {
        return SavedChoice::default();
    };
    let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&text) else {
        return SavedChoice::default();
    };
    SavedChoice {
        provider: map
            .get("provider")
            .and_then(|v| serde_json::from_value(v.clone()).ok()),
        endpoint: map
            .get("endpoint")
            .and_then(|v| serde_json::from_value(v.clone()).ok()),
    }
}

fn store_choice(data_dir: &Path, choice: &SavedChoice) -> Result<(), String> {
    let body = serde_json::to_string(choice).map_err(|e| e.to_string())?;
    std::fs::write(data_dir.join(PROVIDER_FILE), body)
        .map_err(|e| format!("cannot save the assistant choice: {e}"))
}

pub fn load_provider(data_dir: &Path) -> Option<AgentProvider> {
    load_choice(data_dir).provider
}

pub fn save_provider(data_dir: &Path, provider: AgentProvider) -> Result<(), String> {
    let mut choice = load_choice(data_dir);
    choice.provider = Some(provider);
    store_choice(data_dir, &choice)
}

/// The saved OpenAI-compatible server, if any.
pub fn load_endpoint(data_dir: &Path) -> Option<EndpointConfig> {
    load_choice(data_dir).endpoint
}

/// Saves the server and selects it as the assistant's provider.
pub fn save_endpoint(data_dir: &Path, endpoint: EndpointConfig) -> Result<(), String> {
    let mut choice = load_choice(data_dir);
    choice.provider = Some(AgentProvider::Openai);
    choice.endpoint = Some(endpoint);
    store_choice(data_dir, &choice)
}

/// The saved server's API key (a DPAPI secret), if one is set.
pub fn load_endpoint_key(data_dir: &Path) -> Result<Option<endpoint::ApiKey>, String> {
    Ok(
        crate::secret::load_secret(data_dir, crate::secret::Secret::AssistantEndpoint)?
            .and_then(|k| endpoint::ApiKey::new(&k)),
    )
}

/// Saves, replaces (`Some`) or removes (`None`) the saved server's API key.
pub fn save_endpoint_key(data_dir: &Path, key: Option<&str>) -> Result<(), String> {
    crate::secret::save_secret(data_dir, crate::secret::Secret::AssistantEndpoint, key)
}

/// Records what is known about the saved server's tool support, when it is still the server and model tested.
pub fn record_tools(
    data_dir: &Path,
    base_url: &str,
    model: &str,
    tools: AgentToolsState,
    reason: Option<String>,
) -> Result<(), String> {
    let mut choice = load_choice(data_dir);
    let Some(saved) = choice.endpoint.as_mut() else {
        return Ok(());
    };
    if saved.base_url != base_url || saved.model != model {
        return Ok(());
    }
    saved.tools = tools;
    saved.tools_reason = reason;
    store_choice(data_dir, &choice)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> AgentRequest {
        serde_json::from_value(serde_json::json!({
            "message": "anime girl",
            "locale": "ja",
            "history": [{"role": "user", "text": "hi"}]
        }))
        .unwrap()
    }

    #[test]
    fn only_plain_model_names_and_known_efforts_reach_the_tool() {
        let claude = models_of(AgentProvider::Claude);
        let mut req = request();
        assert_eq!(cli_model(AgentProvider::Claude, &req, &claude), None);
        req.agent_model = Some(" opus ".into());
        assert_eq!(
            cli_model(AgentProvider::Claude, &req, &claude),
            Some(ModelChoice::Alias("opus"))
        );
        for named in ["sonnet[1m]", "claude-opus-5-5"] {
            req.agent_model = Some(named.into());
            assert_eq!(
                cli_model(AgentProvider::Claude, &req, &claude),
                Some(ModelChoice::Named(named))
            );
        }
        for bad in [
            "",
            " ",
            "-x",
            "a b",
            "a;b",
            "a&b",
            "a%b",
            "a\"b",
            &"m".repeat(65),
        ] {
            req.agent_model = Some(bad.to_string());
            assert_eq!(
                cli_model(AgentProvider::Claude, &req, &claude),
                None,
                "{bad:?}"
            );
        }
        req.agent_model = None;
        req.effort = Some("max".into());
        assert_eq!(
            cli_effort(AgentProvider::Claude, &req, &claude),
            Some("max")
        );
        req.effort = Some("ultra".into());
        assert_eq!(cli_effort(AgentProvider::Claude, &req, &claude), None);
    }

    #[test]
    fn codex_takes_only_a_model_it_listed_and_an_effort_that_model_takes() {
        let listed = vec![AgentModelOption {
            id: "gpt-6-sol".into(),
            name: "GPT-6-Sol".into(),
            efforts: vec!["low".into(), "medium".into(), "ultra".into()],
            default_effort: "medium".into(),
        }];
        let mut req = request();
        req.agent_model = Some("gpt-6-sol".into());
        assert_eq!(
            cli_model(AgentProvider::Codex, &req, &listed),
            Some(ModelChoice::Listed("gpt-6-sol"))
        );
        req.effort = Some("ultra".into());
        assert_eq!(
            cli_effort(AgentProvider::Codex, &req, &listed),
            Some("ultra")
        );
        req.effort = Some("high".into());
        assert_eq!(
            cli_effort(AgentProvider::Codex, &req, &listed),
            None,
            "the model does not take high"
        );
        // A name Codex did not list never becomes an argument, and its default model stops at high.
        for other in ["gpt-7", "gpt-6-sol & calc", ""] {
            req.agent_model = Some(other.into());
            assert_eq!(
                cli_model(AgentProvider::Codex, &req, &listed),
                None,
                "{other:?}"
            );
        }
        req.agent_model = None;
        assert_eq!(
            cli_effort(AgentProvider::Codex, &req, &listed),
            Some("high")
        );
        req.effort = Some("max".into());
        assert_eq!(cli_effort(AgentProvider::Codex, &req, &listed), None);
    }

    #[test]
    fn provider_choice_is_saved_and_read_back() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load_provider(dir.path()), None);
        save_provider(dir.path(), AgentProvider::Codex).unwrap();
        assert_eq!(load_provider(dir.path()), Some(AgentProvider::Codex));
    }
}
