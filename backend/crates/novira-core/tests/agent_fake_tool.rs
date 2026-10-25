//! The assistant's tool handling against fake `claude` / `codex` programs (small scripts in a temporary folder), so the
//! status, sign-in and chat paths run without a real login. The real tools are in `agent_live.rs`.
use novira_core::agent::mcp::{ToolHandler, ToolOutcome};
use novira_core::agent::tools::CheckedCall;
use novira_core::agent::{
    chat, load_provider, login, models_of, save_provider, status, status_of, AgentProvider,
    AgentRequest, AgentStatus,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// A frontend that is never asked: the fake tools do not call the app's server.
struct NoFrontend;

#[async_trait::async_trait]
impl ToolHandler for NoFrontend {
    async fn call(&self, _call: CheckedCall) -> ToolOutcome {
        ToolOutcome::error("not expected")
    }
}

fn tools() -> Arc<dyn ToolHandler> {
    Arc::new(NoFrontend)
}

/// Writes a script that behaves like a command line tool: `windows` is a batch file, `unix` a shell script.
fn fake_tool(dir: &Path, name: &str, windows: &str, unix: &str) -> PathBuf {
    let (file, body) = if cfg!(windows) {
        (format!("{name}.cmd"), format!("@echo off\r\n{windows}\r\n"))
    } else {
        (name.to_string(), format!("#!/bin/sh\n{unix}\n"))
    };
    let path = dir.join(file);
    std::fs::write(&path, body).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    path
}

fn request() -> AgentRequest {
    serde_json::from_value(serde_json::json!({
        "message": "anime girl",
        "locale": "en"
    }))
    .unwrap()
}

// Status --------------------------------------------------------------------------------------------------------

#[tokio::test]
async fn claude_is_logged_in_when_its_status_says_so() {
    let dir = tempfile::tempdir().unwrap();
    let on = fake_tool(
        dir.path(),
        "claude-on",
        r#"echo {"loggedIn":true}"#,
        r#"echo '{"loggedIn":true}'"#,
    );
    let off = fake_tool(
        dir.path(),
        "claude-off",
        r#"echo {"loggedIn":false}"#,
        r#"echo '{"loggedIn":false}'"#,
    );
    let junk = fake_tool(dir.path(), "claude-junk", "echo not json", "echo not json");
    let on = status_of(AgentProvider::Claude, Some(&on)).await;
    assert_eq!(
        on,
        AgentStatus {
            provider: Some(AgentProvider::Claude),
            installed: true,
            logged_in: true,
            models: models_of(AgentProvider::Claude),
            endpoint: None,
        }
    );
    assert!(!status_of(AgentProvider::Claude, Some(&off)).await.logged_in);
    assert!(
        !status_of(AgentProvider::Claude, Some(&junk))
            .await
            .logged_in
    );
}

#[tokio::test]
async fn codex_prints_its_state_on_either_stream() {
    let dir = tempfile::tempdir().unwrap();
    // The real tool writes to stderr; stdout is accepted too.
    let on_stderr = fake_tool(
        dir.path(),
        "codex-err",
        "echo Logged in using ChatGPT 1>&2",
        "echo Logged in using ChatGPT >&2",
    );
    let on_stdout = fake_tool(
        dir.path(),
        "codex-out",
        "echo Logged in using an API key",
        "echo Logged in using an API key",
    );
    let off = fake_tool(
        dir.path(),
        "codex-off",
        "echo Not signed in 1>&2",
        "echo Not signed in >&2",
    );
    assert!(
        status_of(AgentProvider::Codex, Some(&on_stderr))
            .await
            .logged_in
    );
    assert!(
        status_of(AgentProvider::Codex, Some(&on_stdout))
            .await
            .logged_in
    );
    assert!(!status_of(AgentProvider::Codex, Some(&off)).await.logged_in);
}

#[tokio::test]
async fn a_tool_that_fails_or_cannot_start_is_installed_but_not_logged_in() {
    let dir = tempfile::tempdir().unwrap();
    let failing = fake_tool(
        dir.path(),
        "claude-fail",
        r#"echo {"loggedIn":true}& exit /b 1"#,
        r#"echo '{"loggedIn":true}'; exit 1"#,
    );
    let st = status_of(AgentProvider::Claude, Some(&failing)).await;
    assert!(st.installed && !st.logged_in);
    let missing = dir.path().join("does-not-exist");
    let st = status_of(AgentProvider::Claude, Some(&missing)).await;
    assert!(st.installed && !st.logged_in);
}

#[tokio::test]
async fn the_chosen_tool_is_remembered_and_reported() {
    let data = tempfile::tempdir().unwrap();
    assert_eq!(load_provider(data.path()), None);
    let none = status(data.path(), None).await;
    assert_eq!(
        none,
        AgentStatus {
            provider: None,
            installed: false,
            logged_in: false,
            models: Vec::new(),
            endpoint: None,
        }
    );
    save_provider(data.path(), AgentProvider::Codex).unwrap();
    assert_eq!(load_provider(data.path()), Some(AgentProvider::Codex));
    let tool = fake_tool(
        data.path(),
        "codex-on",
        "echo logged in 1>&2",
        "echo logged in >&2",
    );
    let st = status(data.path(), Some(&tool)).await;
    assert_eq!(st.provider, Some(AgentProvider::Codex));
    assert!(st.installed && st.logged_in);
}

#[test]
fn a_damaged_choice_file_means_no_choice() {
    let data = tempfile::tempdir().unwrap();
    std::fs::write(data.path().join("agent.json"), "not json").unwrap();
    assert_eq!(load_provider(data.path()), None);
    std::fs::write(data.path().join("agent.json"), r#"{"provider":"gemini"}"#).unwrap();
    assert_eq!(load_provider(data.path()), None);
}

// Sign-in -------------------------------------------------------------------------------------------------------

#[tokio::test]
async fn sign_in_succeeds_when_the_tool_exits_cleanly() {
    let dir = tempfile::tempdir().unwrap();
    let ok = fake_tool(dir.path(), "claude-login", "exit /b 0", "exit 0");
    assert_eq!(login(AgentProvider::Claude, Some(&ok)).await, Ok(()));
}

#[tokio::test]
async fn a_failed_sign_in_explains_why_from_the_stream_the_tool_uses() {
    let dir = tempfile::tempdir().unwrap();
    let on_stdout = fake_tool(
        dir.path(),
        "claude-bad",
        "echo Invalid code& exit /b 1",
        "echo Invalid code; exit 1",
    );
    let on_stderr = fake_tool(
        dir.path(),
        "codex-bad",
        "echo browser closed 1>&2& exit /b 1",
        "echo browser closed >&2; exit 1",
    );
    let err = login(AgentProvider::Claude, Some(&on_stdout))
        .await
        .unwrap_err();
    assert!(err.contains("Invalid code"), "{err}");
    let err = login(AgentProvider::Codex, Some(&on_stderr))
        .await
        .unwrap_err();
    assert!(err.contains("browser closed"), "{err}");
}

#[tokio::test]
async fn sign_in_with_a_tool_that_cannot_start_says_so() {
    let dir = tempfile::tempdir().unwrap();
    let err = login(AgentProvider::Claude, Some(&dir.path().join("nope")))
        .await
        .unwrap_err();
    assert!(err.contains("cannot start"), "{err}");
}

// Chat ----------------------------------------------------------------------------------------------------------

#[tokio::test]
async fn claude_answers_with_a_json_wrapper_whose_result_is_the_final_answer() {
    let dir = tempfile::tempdir().unwrap();
    let answer =
        r#"{"result":"<thoughts>Read it as a portrait.</thoughts>Picked it","is_error":false}"#;
    let tool = fake_tool(
        dir.path(),
        "claude-chat",
        &format!("echo {answer}"),
        &format!("cat >/dev/null; echo '{answer}'"),
    );
    let reply = chat(AgentProvider::Claude, Some(&tool), &request(), tools())
        .await
        .unwrap();
    assert_eq!(reply.text, "Picked it");
    assert_eq!(reply.thoughts, vec!["Read it as a portrait."]);
}

#[tokio::test]
async fn claude_reporting_an_error_becomes_the_error_text() {
    let dir = tempfile::tempdir().unwrap();
    let wrapper = r#"{"result":"Not logged in","is_error":true}"#;
    let tool = fake_tool(
        dir.path(),
        "claude-err",
        &format!("echo {wrapper}"),
        &format!("echo '{wrapper}'"),
    );
    let err = chat(AgentProvider::Claude, Some(&tool), &request(), tools())
        .await
        .unwrap_err();
    assert_eq!(err, "Not logged in");
}

#[tokio::test]
async fn claude_printing_something_else_is_an_unexpected_answer() {
    let dir = tempfile::tempdir().unwrap();
    let tool = fake_tool(
        dir.path(),
        "claude-odd",
        "echo what 1>&2& echo plain text",
        "echo what >&2; echo plain text",
    );
    let err = chat(AgentProvider::Claude, Some(&tool), &request(), tools())
        .await
        .unwrap_err();
    assert!(err.starts_with("unexpected answer from claude"), "{err}");
    assert!(err.contains("what"), "{err}");
}

#[tokio::test]
async fn codex_writes_its_answer_to_the_file_named_after_o() {
    let dir = tempfile::tempdir().unwrap();
    let windows = [
        ":loop",
        r#"if "%~1"=="" goto done"#,
        r#"if "%~1"=="-o" set OUT=%~2"#,
        "shift",
        "goto loop",
        ":done",
        r#"echo From codex> "%OUT%""#,
    ]
    .join("\r\n");
    let unix = r#"while [ $# -gt 0 ]; do if [ "$1" = "-o" ]; then OUT="$2"; fi; shift; done
echo 'From codex' > "$OUT""#;
    let tool = fake_tool(dir.path(), "codex-chat", &windows, unix);
    let reply = chat(AgentProvider::Codex, Some(&tool), &request(), tools())
        .await
        .unwrap();
    assert_eq!(reply.text, "From codex");
    assert!(reply.thoughts.is_empty());
}

#[tokio::test]
async fn codex_without_an_answer_file_is_an_error() {
    let dir = tempfile::tempdir().unwrap();
    let tool = fake_tool(dir.path(), "codex-silent", "exit /b 0", "exit 0");
    let err = chat(AgentProvider::Codex, Some(&tool), &request(), tools())
        .await
        .unwrap_err();
    assert!(err.starts_with("codex gave no answer"), "{err}");
}

#[tokio::test]
async fn chat_without_the_tool_installed_names_it() {
    let dir = tempfile::tempdir().unwrap();
    let err = chat(
        AgentProvider::Claude,
        Some(&dir.path().join("nope")),
        &request(),
        tools(),
    )
    .await
    .unwrap_err();
    assert!(err.contains("cannot start"), "{err}");
}

#[test]
fn a_tool_is_found_on_the_path_in_its_windows_script_forms() {
    // Only this test changes PATH, and the other tests here pass the program explicitly.
    let dir = tempfile::tempdir().unwrap();
    let name = "novira-fake-tool-for-find-exe";
    assert!(novira_core::agent::find_exe(name).is_none());
    let script = fake_tool(dir.path(), name, "exit /b 0", "exit 0");
    let old = std::env::var_os("PATH").unwrap_or_default();
    let mut paths: Vec<PathBuf> = std::env::split_paths(&old).collect();
    paths.insert(0, dir.path().to_path_buf());
    std::env::set_var("PATH", std::env::join_paths(paths).unwrap());
    let found = novira_core::agent::find_exe(name);
    std::env::set_var("PATH", old);
    assert_eq!(found, Some(script));
}

#[tokio::test]
async fn claude_runs_on_the_chosen_model_and_effort_and_drops_unsafe_names() {
    let dir = tempfile::tempdir().unwrap();
    // The fake writes the arguments it was given and the model in its environment next to itself, then answers.
    let tool = fake_tool(
        dir.path(),
        "claude-args",
        r#"echo %* model=%ANTHROPIC_MODEL% > "%~dp0args.txt"& echo {"result":"ok","is_error":false}"#,
        r#"echo "$@" "model=$ANTHROPIC_MODEL" > "$(dirname "$0")/args.txt"; echo '{"result":"ok","is_error":false}'"#,
    );
    let args = || std::fs::read_to_string(dir.path().join("args.txt")).unwrap();
    let mut req = request();
    req.agent_model = Some("opus".into());
    req.effort = Some("high".into());
    chat(AgentProvider::Claude, Some(&tool), &req, tools())
        .await
        .unwrap();
    assert!(
        args().contains("--model opus") && args().contains("--effort high"),
        "{}",
        args()
    );
    // A typed name goes in the environment, never as an argument.
    req.agent_model = Some("claude-opus-5-5".into());
    chat(AgentProvider::Claude, Some(&tool), &req, tools())
        .await
        .unwrap();
    assert!(
        !args().contains("--model") && args().contains("model=claude-opus-5-5"),
        "{}",
        args()
    );
    // A name that is not a plain model name, and an effort the tool does not know, are not passed on.
    req.agent_model = Some("--dangerously-skip-permissions".into());
    req.effort = Some("turbo".into());
    chat(AgentProvider::Claude, Some(&tool), &req, tools())
        .await
        .unwrap();
    assert!(
        !args().contains("--model")
            && !args().contains("--effort")
            && !args().contains("dangerously"),
        "{}",
        args()
    );
}

#[tokio::test]
async fn claude_is_given_the_apps_server_in_a_config_file_and_codex_the_token_in_its_environment() {
    let dir = tempfile::tempdir().unwrap();
    // Each fake copies what it was given next to itself: Claude's config file, Codex's token variable and arguments.
    let claude = fake_tool(
        dir.path(),
        "claude-mcp",
        r#"set HERE=%~dp0
:loop
rem An empty argument (--tools "") is not the end: only a missing one is.
if [%1]==[] goto done
if "%~1"=="--mcp-config" copy /y "%~2" "%HERE%mcp.json" >nul
shift
goto loop
:done
echo {"result":"ok","is_error":false}"#,
        r#"while [ $# -gt 0 ]; do if [ "$1" = "--mcp-config" ]; then cp "$2" "$(dirname "$0")/mcp.json"; fi; shift; done
echo '{"result":"ok","is_error":false}'"#,
    );
    chat(AgentProvider::Claude, Some(&claude), &request(), tools())
        .await
        .unwrap();
    let config: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(dir.path().join("mcp.json")).unwrap())
            .unwrap();
    let server = &config["mcpServers"]["novira"];
    assert_eq!(server["type"], "http");
    let url = server["url"].as_str().unwrap();
    assert!(
        url.starts_with("http://127.0.0.1:") && url.ends_with("/mcp"),
        "{url}"
    );
    let auth = server["headers"]["Authorization"].as_str().unwrap();
    assert_eq!(auth.len(), "Bearer ".len() + 64, "{auth}");

    let codex = fake_tool(
        dir.path(),
        "codex-mcp",
        r#"echo %NOVIRA_MCP_TOKEN% %*> "%~dp0codex.txt"
:loop
if "%~1"=="" goto done
if "%~1"=="-o" set OUT=%~2
shift
goto loop
:done
echo ok> "%OUT%""#,
        r#"echo "$NOVIRA_MCP_TOKEN $*" > "$(dirname "$0")/codex.txt"
while [ $# -gt 0 ]; do if [ "$1" = "-o" ]; then OUT="$2"; fi; shift; done
echo ok > "$OUT""#,
    );
    chat(AgentProvider::Codex, Some(&codex), &request(), tools())
        .await
        .unwrap();
    let seen = std::fs::read_to_string(dir.path().join("codex.txt")).unwrap();
    let token = seen.split_whitespace().next().unwrap();
    assert_eq!(token.len(), 64, "{seen}");
    assert!(
        seen.contains("mcp_servers.novira.url=http://127.0.0.1:"),
        "{seen}"
    );
    assert!(
        seen.contains("mcp_servers.novira.bearer_token_env_var=NOVIRA_MCP_TOKEN"),
        "{seen}"
    );
    // The token is in the environment only, never among the arguments.
    assert_eq!(seen.matches(token).count(), 1, "{seen}");
}
