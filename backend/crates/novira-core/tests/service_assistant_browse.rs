//! The service's assistant and Browse calls against fake `claude` / `codex` programs found on a replaced `PATH`, and
//! against a proxy that refuses every connection (so the model sites are never reached). The process-wide
//! environment is changed, so everything runs in one test, one step after the other.
use novira_core::agent::{AgentProvider, AgentRequest};
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::models::civitai::SearchParams;
use novira_core::{Backend, BackendConfig, BackendError, Settings};
use std::path::Path;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

struct NullEngine;

#[async_trait::async_trait]
impl Engine for NullEngine {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Ok(EngineOutput::Nothing)
    }
}

fn write_tool(dir: &Path, name: &str, windows: &str, unix: &str) {
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
}

fn request() -> AgentRequest {
    serde_json::from_value(serde_json::json!({
        "message": "anime girl",
        "locale": "en",
        "models": [],
        "current": {"modelKey": null}
    }))
    .unwrap()
}

fn search(source: &str) -> SearchParams {
    serde_json::from_value(serde_json::json!({
        "query": "cat", "kind": "all", "baseModel": "all", "sort": "newest", "period": "all",
        "includeNsfw": false, "source": source,
    }))
    .unwrap()
}

#[tokio::test]
async fn assistant_and_browse_calls_reach_their_tools_and_report_failures() {
    let data = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    // Every outgoing request goes to a proxy that hangs up at once, so it fails without touching the network.
    let proxy = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let proxy_url = format!("http://{}", proxy.local_addr().unwrap());
    std::thread::spawn(move || {
        for stream in proxy.incoming() {
            drop(stream);
        }
    });
    for key in [
        "HTTPS_PROXY",
        "https_proxy",
        "HTTP_PROXY",
        "http_proxy",
        "ALL_PROXY",
    ] {
        std::env::set_var(key, &proxy_url);
    }
    std::env::remove_var("NO_PROXY");
    std::env::remove_var("no_proxy");
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: data.path().to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        Arc::new(NullEngine),
    )
    .unwrap();

    let t = std::time::Instant::now();
    // Browse: both sources report the failed connection as an internal error.
    for source in ["civitai", "huggingface"] {
        let err = backend.search_civitai(search(source)).await.unwrap_err();
        assert!(matches!(err, BackendError::Internal(_)), "{source}: {err}");
    }

    eprintln!("browse {:?}", t.elapsed());
    // No tool is chosen yet.
    let err = backend.agent_chat(request()).await.unwrap_err();
    assert!(matches!(err, BackendError::Invalid(_)), "{err}");
    assert_eq!(backend.agent_status().await.provider, None);

    // PATH unset: nothing can be found.
    let original = std::env::var_os("PATH");
    std::env::remove_var("PATH");
    let err = backend
        .agent_login(AgentProvider::Claude)
        .await
        .unwrap_err();
    assert!(err.to_string().contains("not installed"), "{err}");

    // PATH with an empty folder: still not installed, and nothing is saved.
    std::env::set_var("PATH", tools.path());
    let err = backend.agent_login(AgentProvider::Codex).await.unwrap_err();
    assert!(matches!(err, BackendError::Invalid(_)), "{err}");
    assert!(novira_core::agent::load_provider(data.path()).is_none());

    // A fake claude that is signed in and answers every call with the same wrapper (a plain-text answer).
    let answer = r#"{"loggedIn":true,"result":"Hello"}"#;
    write_tool(
        tools.path(),
        "claude",
        &format!("echo {answer}"),
        &format!("echo '{answer}'"),
    );
    let status = backend.agent_login(AgentProvider::Claude).await.unwrap();
    assert!(status.installed && status.logged_in);
    assert_eq!(
        novira_core::agent::load_provider(data.path()),
        Some(AgentProvider::Claude)
    );
    let status = backend.agent_status().await;
    assert_eq!(status.provider, Some(AgentProvider::Claude));
    assert!(status.logged_in);
    let reply = backend.agent_chat(request()).await.unwrap();
    assert_eq!(reply.text, "Hello");

    // A sign-in that fails gives the reason: the tool's stderr first, else its stdout.
    write_tool(
        tools.path(),
        "codex",
        "echo cannot reach the browser 1>&2& exit /b 1",
        "echo cannot reach the browser >&2; exit 1",
    );
    let err = backend.agent_login(AgentProvider::Codex).await.unwrap_err();
    assert!(
        err.to_string().contains("cannot reach the browser"),
        "{err}"
    );
    write_tool(
        tools.path(),
        "codex",
        "echo declined on stdout& exit /b 1",
        "echo declined on stdout; exit 1",
    );
    let err = backend.agent_login(AgentProvider::Codex).await.unwrap_err();
    assert!(err.to_string().contains("declined on stdout"), "{err}");

    // A tool found on PATH that cannot be started is reported, not a panic.
    #[cfg(unix)]
    {
        std::fs::write(tools.path().join("codex"), "not a program").unwrap();
        let err = backend.agent_login(AgentProvider::Codex).await.unwrap_err();
        assert!(matches!(err, BackendError::Internal(_)), "{err}");
    }

    match original {
        Some(p) => std::env::set_var("PATH", p),
        None => std::env::remove_var("PATH"),
    }
}
