//! Running the `claude` / `codex` tools: finding them, sign-in status and sign-in.
use super::*;

const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

/// Finds the tool on PATH, trying the executable and script forms Windows installs use.
pub fn find_exe(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let exts: &[&str] = if cfg!(windows) {
        &[".exe", ".cmd", ".bat"]
    } else {
        &[""]
    };
    std::env::split_paths(&path)
        .flat_map(|dir| exts.iter().map(move |e| dir.join(format!("{name}{e}"))))
        .find(|p| p.is_file())
}

pub(super) fn command(exe: &Path) -> Command {
    let mut cmd = Command::new(exe);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    cmd
}

/// How the command's stdin is used.
#[derive(Clone, Copy, PartialEq)]
pub(super) enum Stdin {
    /// Write the input, then close it (the tool reads the prompt until end of input).
    Close,
    /// Write the input and keep it open until the tool exits. A sign-in waits for the browser, and
    /// `claude auth login` gives up with "Invalid code" the moment it reads end of input.
    Hold,
}

/// Runs the command with `input` on stdin; returns (success, stdout, stderr).
pub(super) async fn run(
    mut cmd: Command,
    input: &str,
    stdin_mode: Stdin,
    limit: Duration,
) -> Result<(bool, String, String), String> {
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("cannot start the tool: {e}"))?;
    let mut held = child.stdin.take();
    if stdin_mode == Stdin::Close {
        // Written beside the wait, so a large input (a message with pictures) cannot stall against a tool that
        // prints before it has read it all; the pipe closes when the writing ends.
        if let Some(mut stdin) = held.take() {
            let input = input.to_owned();
            tokio::spawn(async move {
                let _ = stdin.write_all(input.as_bytes()).await;
            });
        }
    } else if let Some(stdin) = held.as_mut() {
        let _ = stdin.write_all(input.as_bytes()).await;
    }
    let out = tokio::time::timeout(limit, child.wait_with_output())
        .await
        .map_err(|_| "the tool took too long and was stopped".to_string())?
        .map_err(|e| e.to_string())?;
    drop(held);
    Ok((
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
    ))
}

pub async fn status(data_dir: &Path, exe_override: Option<&Path>) -> AgentStatus {
    let endpoint = load_endpoint(data_dir);
    let has_key = load_endpoint_key(data_dir).is_ok_and(|k| k.is_some());
    let info = endpoint.as_ref().map(|e| e.info(has_key));
    let Some(provider) = load_provider(data_dir) else {
        return AgentStatus {
            provider: None,
            installed: false,
            logged_in: false,
            models: Vec::new(),
            endpoint: info,
        };
    };
    if provider == AgentProvider::Openai {
        // Nothing to install; ready once a server and a model are saved.
        return AgentStatus {
            provider: Some(provider),
            installed: true,
            logged_in: endpoint.is_some_and(|e| !e.base_url.is_empty() && !e.model.is_empty()),
            models: Vec::new(),
            endpoint: info,
        };
    }
    AgentStatus {
        endpoint: info,
        ..status_of(provider, exe_override).await
    }
}

pub async fn status_of(provider: AgentProvider, exe_override: Option<&Path>) -> AgentStatus {
    let Some(exe) = provider.exe_name().and_then(|name| {
        exe_override
            .map(Path::to_path_buf)
            .or_else(|| find_exe(name))
    }) else {
        return AgentStatus {
            provider: Some(provider),
            installed: provider == AgentProvider::Openai,
            logged_in: false,
            models: Vec::new(),
            endpoint: None,
        };
    };
    let mut cmd = command(&exe);
    match provider {
        AgentProvider::Claude => cmd.args(["auth", "status"]),
        AgentProvider::Codex => cmd.args(["login", "status"]),
        AgentProvider::Openai => unreachable!("a server has no command"),
    };
    let logged_in = match run(cmd, "", Stdin::Close, Duration::from_secs(30)).await {
        Ok((true, stdout, stderr)) => match provider {
            AgentProvider::Claude => serde_json::from_str::<Value>(&stdout)
                .ok()
                .and_then(|v| v["loggedIn"].as_bool())
                .unwrap_or(false),
            AgentProvider::Codex => {
                // The tool prints its state to stderr.
                format!("{stdout}{stderr}")
                    .to_lowercase()
                    .contains("logged in")
            }
            AgentProvider::Openai => false,
        },
        _ => false,
    };
    AgentStatus {
        provider: Some(provider),
        installed: true,
        logged_in,
        models: super::models_of(provider),
        endpoint: None,
    }
}

/// Starts the tool's own sign-in (it opens the browser) and waits until it ends.
pub async fn login(provider: AgentProvider, exe_override: Option<&Path>) -> Result<(), String> {
    let name = provider
        .exe_name()
        .ok_or("a server has no sign-in; enter its address and model instead")?;
    let exe = exe_override
        .map(Path::to_path_buf)
        .or_else(|| find_exe(name))
        .ok_or_else(|| {
            format!("`{name}` is not installed on this PC. Install it first, then try again")
        })?;
    let mut cmd = command(&exe);
    match provider {
        AgentProvider::Claude => cmd.args(["auth", "login"]),
        AgentProvider::Codex => cmd.arg("login"),
        AgentProvider::Openai => unreachable!("a server has no command"),
    };
    let (ok, stdout, stderr) = run(cmd, "", Stdin::Hold, LOGIN_TIMEOUT).await?;
    if ok {
        Ok(())
    } else {
        // Claude reports why on stdout, Codex on stderr.
        let why = if stderr.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        Err(format!("Sign-in did not finish: {}", why.trim()))
    }
}
