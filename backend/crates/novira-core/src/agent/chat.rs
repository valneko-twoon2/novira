//! One request: start the app's MCP server for it, run the tool headless with only that server's tools, read the final
//! answer, stop the server. Attached pictures go to Claude in a stream-json message on stdin and to Codex as `-i` files
//! in the request's temporary folder.
use super::attach::{self, AgentImage};
use super::cli::{command, run, Stdin};
use super::mcp::{self, ToolHandler};
use super::*;
use std::ffi::OsString;
use std::sync::Arc;

/// How long one request may run, tool calls and the user's permission answers included.
pub const CHAT_TIMEOUT: Duration = Duration::from_secs(15 * 60);
/// The most tool calls one request may make.
pub const MAX_TOOL_CALLS: usize = 150;
/// The environment variable Codex reads the server's token from.
pub const TOKEN_ENV: &str = "NOVIRA_MCP_TOKEN";
/// The name the server goes by in the tools (its tools are `mcp__novira__<name>` in Claude).
pub const SERVER_NAME: &str = "novira";

const CLAUDE_SYSTEM: &str = "You are the assistant of the novira app: you set the app up for the user through its novira tools and answer questions about it.";

pub async fn chat(
    provider: AgentProvider,
    exe_override: Option<&Path>,
    request: &AgentRequest,
    tools: Arc<dyn ToolHandler>,
) -> Result<AgentReply, String> {
    let name = provider
        .exe_name()
        .ok_or("this assistant is a server, not a command-line tool")?;
    let exe = exe_override
        .map(Path::to_path_buf)
        .or_else(|| find_exe(name))
        .ok_or_else(|| format!("`{name}` is not installed on this PC"))?;
    let images = &request.attached;
    let prompt = format!("{}{}", build_prompt(request), attach::note(images.len()));
    let work = std::env::temp_dir().join(format!("novira-agent-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&work).map_err(|e| e.to_string())?;
    let server = mcp::start(tools, MAX_TOOL_CALLS)
        .await
        .map_err(|e| format!("cannot start the assistant's tool server: {e}"))?;
    let result = chat_in(provider, &exe, &prompt, images, &work, request, &server).await;
    drop(server);
    let _ = std::fs::remove_dir_all(&work);
    result.map(|answer| parse_reply(&answer))
}

/// How the tool reaches the app's server.
pub struct McpLink<'a> {
    pub url: &'a str,
    pub token: &'a str,
}

/// Claude's MCP configuration (written to a file in the request's own temporary folder): the one server, by HTTP,
/// with the request's token.
pub fn claude_mcp_config(link: &McpLink) -> Value {
    serde_json::json!({
        "mcpServers": {
            SERVER_NAME: {"type": "http", "url": link.url, "headers": {"Authorization": format!("Bearer {}", link.token)}}
        }
    })
}

/// Claude's arguments: print mode, no built-in tools, no settings or other MCP servers, only the app's tools allowed.
/// Every argument is a fixed word except the configuration file's path in the request's temporary folder. With
/// `stream` the message comes as one stream-json line (`claude_message`, the form that carries pictures) and the
/// answer as stream-json lines.
pub fn claude_args(
    model: Option<ModelChoice>,
    effort: Option<&str>,
    config: &Path,
    stream: bool,
) -> Vec<OsString> {
    let format: &[&str] = if stream {
        &[
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
        ]
    } else {
        &["--output-format", "json"]
    };
    let mut args: Vec<OsString> = std::iter::once(&"-p")
        .chain(format)
        .map(OsString::from)
        .collect();
    args.extend(
        [
            "--no-session-persistence",
            "--tools",
            "",
            "--setting-sources",
            "",
            "--strict-mcp-config",
            "--allowedTools",
            "mcp__novira",
            "--system-prompt",
            CLAUDE_SYSTEM,
        ]
        .iter()
        .map(OsString::from),
    );
    args.push("--mcp-config".into());
    args.push(config.as_os_str().to_owned());
    if let Some(ModelChoice::Alias(alias)) = model {
        args.push("--model".into());
        args.push(alias.into());
    }
    if let Some(effort) = effort {
        args.push("--effort".into());
        args.push(effort.into());
    }
    args
}

/// Claude's stream-json input: one user message with the pictures and then the prompt, as one line.
pub fn claude_message(prompt: &str, images: &[AgentImage]) -> String {
    let mut content: Vec<Value> = images
        .iter()
        .map(|image| {
            serde_json::json!({
                "type": "image",
                "source": {"type": "base64", "media_type": AgentImage::MEDIA_TYPE, "data": image.base64()}
            })
        })
        .collect();
    content.push(serde_json::json!({"type": "text", "text": prompt}));
    let message = serde_json::json!({
        "type": "user",
        "message": {"role": "user", "content": content}
    });
    format!("{message}\n")
}

/// The final answer of Claude's stream-json output: the last `result` line.
fn stream_result(stdout: &str) -> Option<Value> {
    stdout
        .lines()
        .rev()
        .filter_map(|line| serde_json::from_str::<Value>(line.trim()).ok())
        .find(|v| v["type"] == "result")
}

/// Codex's arguments: a read-only sandbox, no user config or rules, and the app's server by URL with the token read
/// from `TOKEN_ENV`. The URL is `http://127.0.0.1:<port>/mcp` (not TOML, so Codex takes it as text); the rest are fixed
/// words, a model Codex listed, the attached pictures and the answer file in the request's temporary folder.
pub fn codex_args(
    model: Option<ModelChoice>,
    effort: Option<&str>,
    url: &str,
    images: &[PathBuf],
    out: &Path,
) -> Vec<OsString> {
    let mut args: Vec<OsString> = [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--ignore-user-config",
        "--ignore-rules",
    ]
    .iter()
    .map(OsString::from)
    .collect();
    for setting in [
        format!("mcp_servers.{SERVER_NAME}.url={url}"),
        format!("mcp_servers.{SERVER_NAME}.bearer_token_env_var={TOKEN_ENV}"),
        // The user may take a while to answer a permission question.
        format!("mcp_servers.{SERVER_NAME}.tool_timeout_sec=900"),
        format!("mcp_servers.{SERVER_NAME}.default_tools_approval_mode=approve"),
    ] {
        args.push("-c".into());
        args.push(setting.into());
    }
    // A model Codex listed itself, a plain name (letters, digits and .-_), so cmd.exe reads nothing into it.
    if let Some(ModelChoice::Listed(name)) = model {
        args.push("-m".into());
        args.push(name.into());
    }
    if let Some(effort) = effort {
        // A fixed word without quotes: Codex reads a value that is not TOML as plain text.
        args.push("-c".into());
        args.push(format!("model_reasoning_effort={effort}").into());
    }
    // `-i` takes several files; the `-o` that follows ends the list.
    for image in images {
        args.push("-i".into());
        args.push(image.as_os_str().to_owned());
    }
    args.push("-o".into());
    args.push(out.as_os_str().to_owned());
    args.push("-".into());
    args
}

async fn chat_in(
    provider: AgentProvider,
    exe: &Path,
    prompt: &str,
    images: &[AgentImage],
    work: &Path,
    request: &AgentRequest,
    server: &mcp::McpServer,
) -> Result<String, String> {
    let mut cmd = command(exe);
    cmd.current_dir(work);
    // The model and the effort the user chose, each checked (see cli_model, cli_effort): fixed words as arguments, a
    // typed model name in the environment.
    let listed = super::models_of(provider);
    let model = cli_model(provider, request, &listed);
    let effort = cli_effort(provider, request, &listed);
    let url = server.url();
    match provider {
        AgentProvider::Claude => {
            let config = work.join("mcp.json");
            let link = McpLink {
                url: &url,
                token: &server.token,
            };
            std::fs::write(&config, claude_mcp_config(&link).to_string())
                .map_err(|e| e.to_string())?;
            let stream = !images.is_empty();
            cmd.args(claude_args(model, effort, &config, stream));
            if let Some(ModelChoice::Named(name)) = model {
                cmd.env("ANTHROPIC_MODEL", name);
            }
            let input = if stream {
                claude_message(prompt, images)
            } else {
                prompt.to_string()
            };
            let (ok, stdout, stderr) = run(cmd, &input, Stdin::Close, CHAT_TIMEOUT).await?;
            let wrapper = if stream {
                stream_result(&stdout)
            } else {
                serde_json::from_str::<Value>(stdout.trim()).ok()
            }
            .ok_or_else(|| format!("unexpected answer from claude: {}", stderr.trim()))?;
            let result = wrapper["result"].as_str().unwrap_or("").to_string();
            if !ok || wrapper["is_error"].as_bool().unwrap_or(false) {
                return Err(if result.is_empty() { stderr } else { result });
            }
            Ok(result)
        }
        AgentProvider::Codex => {
            let out = work.join("answer.txt");
            let mut files = Vec::new();
            for (i, image) in images.iter().enumerate() {
                let file = work.join(format!("picture-{}.jpg", i + 1));
                std::fs::write(&file, &image.jpeg).map_err(|e| e.to_string())?;
                files.push(file);
            }
            cmd.args(codex_args(model, effort, &url, &files, &out));
            cmd.env(TOKEN_ENV, &server.token);
            let (ok, _, stderr) = run(cmd, prompt, Stdin::Close, CHAT_TIMEOUT).await?;
            let answer = std::fs::read_to_string(&out).unwrap_or_default();
            if !ok || answer.trim().is_empty() {
                return Err(format!("codex gave no answer: {}", stderr.trim()));
            }
            Ok(answer)
        }
        AgentProvider::Openai => Err("this assistant is a server, not a command-line tool".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(args: &[OsString]) -> Vec<String> {
        args.iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn claude_gets_only_the_apps_server_and_its_tools_and_no_built_in_ones() {
        let args = strings(&claude_args(
            Some(ModelChoice::Alias("opus")),
            Some("high"),
            Path::new("C:/t/mcp.json"),
            false,
        ));
        let after = |flag: &str| args[args.iter().position(|a| a == flag).unwrap() + 1].clone();
        assert_eq!(after("--tools"), "");
        assert_eq!(after("--setting-sources"), "");
        assert_eq!(after("--allowedTools"), "mcp__novira");
        assert_eq!(after("--mcp-config"), "C:/t/mcp.json");
        assert!(args.contains(&"--strict-mcp-config".to_string()));
        assert_eq!(after("--model"), "opus");
        assert_eq!(after("--effort"), "high");
        assert_eq!(after("--output-format"), "json");
        assert!(!args.iter().any(|a| a == "--input-format"));
        assert!(!args
            .iter()
            .any(|a| a.contains("dangerously") || a.contains("bypass")));
        // A typed model name never becomes an argument.
        let named = strings(&claude_args(
            Some(ModelChoice::Named("claude-x")),
            None,
            Path::new("c.json"),
            false,
        ));
        assert!(!named
            .iter()
            .any(|a| a == "--model" || a == "claude-x" || a == "--effort"));
    }

    #[test]
    fn claudes_config_names_the_server_by_http_with_the_token_in_a_header() {
        let config = claude_mcp_config(&McpLink {
            url: "http://127.0.0.1:5/mcp",
            token: "abc",
        });
        let server = &config["mcpServers"]["novira"];
        assert_eq!(server["type"], "http");
        assert_eq!(server["url"], "http://127.0.0.1:5/mcp");
        assert_eq!(server["headers"]["Authorization"], "Bearer abc");
        assert_eq!(config["mcpServers"].as_object().unwrap().len(), 1);
    }

    #[test]
    fn codex_gets_the_server_by_url_the_token_by_environment_and_stays_read_only() {
        let args = strings(&codex_args(
            Some(ModelChoice::Listed("gpt-6-sol")),
            Some("medium"),
            "http://127.0.0.1:5/mcp",
            &[],
            Path::new("o.txt"),
        ));
        let after = |flag: &str| args[args.iter().position(|a| a == flag).unwrap() + 1].clone();
        assert_eq!(after("--sandbox"), "read-only");
        assert!(
            args.contains(&"--ignore-user-config".to_string())
                && args.contains(&"--ignore-rules".to_string())
        );
        assert!(args.contains(&"mcp_servers.novira.url=http://127.0.0.1:5/mcp".to_string()));
        assert!(args.contains(&format!(
            "mcp_servers.novira.bearer_token_env_var={TOKEN_ENV}"
        )));
        assert!(args.contains(&"model_reasoning_effort=medium".to_string()));
        assert_eq!(after("-m"), "gpt-6-sol");
        assert_eq!(after("-o"), "o.txt");
        assert_eq!(args.last().unwrap(), "-");
        // The token itself is never an argument.
        assert!(!args.iter().any(|a| a.contains("Bearer")));
        assert!(!args
            .iter()
            .any(|a| a.contains("dangerously") || a.contains("full-access")));
        assert!(!args.contains(&"-i".to_string()));
    }

    #[test]
    fn with_pictures_claude_reads_one_stream_json_message_and_answers_in_stream_json() {
        let args = strings(&claude_args(None, None, Path::new("c.json"), true));
        let after = |flag: &str| args[args.iter().position(|a| a == flag).unwrap() + 1].clone();
        assert_eq!(args[0], "-p");
        assert_eq!(after("--input-format"), "stream-json");
        assert_eq!(after("--output-format"), "stream-json");
        assert!(args.contains(&"--verbose".to_string()));
        // The same lock-down as without pictures.
        assert_eq!(after("--tools"), "");
        assert_eq!(after("--allowedTools"), "mcp__novira");
        let pictures = [
            AgentImage {
                jpeg: vec![1, 2, 3],
            },
            AgentImage { jpeg: vec![4] },
        ];
        let line = claude_message("describe it", &pictures);
        assert!(
            line.ends_with('\n') && line.matches('\n').count() == 1,
            "one line"
        );
        let message: Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(message["type"], "user");
        let content = message["message"]["content"].as_array().unwrap();
        assert_eq!(content.len(), 3);
        assert_eq!(content[0]["source"]["media_type"], "image/jpeg");
        assert_eq!(content[0]["source"]["data"], "AQID");
        assert_eq!(content[1]["source"]["data"], "BA==");
        assert_eq!(
            content[2],
            serde_json::json!({"type": "text", "text": "describe it"})
        );
    }

    #[test]
    fn the_answer_of_a_stream_is_its_last_result_line() {
        let out = "{\"type\":\"system\"}\nnot json\n{\"type\":\"assistant\"}\n{\"type\":\"result\",\"result\":\"done\",\"is_error\":false}\n";
        assert_eq!(stream_result(out).unwrap()["result"], "done");
        assert!(stream_result("{\"type\":\"assistant\"}").is_none());
        assert!(stream_result("").is_none());
    }

    #[test]
    fn codex_gets_each_picture_after_i_before_the_answer_file() {
        let pictures = [
            PathBuf::from("w/picture-1.jpg"),
            PathBuf::from("w/picture-2.jpg"),
        ];
        let args = strings(&codex_args(
            None,
            None,
            "http://127.0.0.1:5/mcp",
            &pictures,
            Path::new("o.txt"),
        ));
        let o = args.iter().position(|a| a == "-o").unwrap();
        assert_eq!(
            args[o - 4..o],
            ["-i", "w/picture-1.jpg", "-i", "w/picture-2.jpg"].map(String::from)
        );
        assert_eq!(args.last().unwrap(), "-");
    }
}
