//! The assistant's request through the backend: a fake `codex` that calls one tool of the app's MCP server with curl,
//! the call reaching the window as an `agent_tool_call` event, the window's answer (`agent_tool_result`) coming back,
//! and the answers the backend refuses.
use super::common::*;
use novira_core::agent::{AgentProvider, AgentRequest, AgentToolAnswer};
use novira_core::types::BackendEvent;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Arc;

fn request() -> AgentRequest {
    serde_json::from_value(
        json!({"message": "make it a cat", "locale": "en", "screen": "generate"}),
    )
    .unwrap()
}

/// A fake `codex` that posts `body.json` (next to it) to the server named in its arguments, with the token from its
/// environment, and writes the server's answer as its own final answer.
fn fake_codex(dir: &Path) -> PathBuf {
    let call = json!({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": "set_generation_settings", "arguments": {"positivePrompt": "a cat"}}});
    std::fs::write(dir.join("body.json"), call.to_string()).unwrap();
    let (file, body) = if cfg!(windows) {
        (
            "codex.cmd",
            [
                "@echo off",
                // shift moves %0 too, so the script's folder is kept first.
                "set HERE=%~dp0",
                ":loop",
                r#"if "%~1"=="" goto done"#,
                "set A=%~1",
                r#"if "%A:~0,23%"=="mcp_servers.novira.url=" set URL=%A:~23%"#,
                r#"if "%~1"=="-o" set OUT=%~2"#,
                "shift",
                "goto loop",
                ":done",
                r#"curl -s -X POST "%URL%" -H "Authorization: Bearer %NOVIRA_MCP_TOKEN%" -H "Content-Type: application/json" --data-binary "@%HERE%body.json" > "%OUT%""#,
            ]
            .join("\r\n"),
        )
    } else {
        (
            "codex",
            [
                "#!/bin/sh",
                r#"while [ $# -gt 0 ]; do case "$1" in mcp_servers.novira.url=*) URL="${1#mcp_servers.novira.url=}";; -o) OUT="$2";; esac; shift; done"#,
                r#"curl -s -X POST "$URL" -H "Authorization: Bearer $NOVIRA_MCP_TOKEN" -H "Content-Type: application/json" --data-binary "@$(dirname "$0")/body.json" > "$OUT""#,
            ]
            .join("\n"),
        )
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

#[tokio::test]
async fn a_tool_call_reaches_the_window_and_the_windows_answer_reaches_the_model() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    // The window: answers every tool call at once, as the frontend's dispatcher would.
    let window = backend.clone();
    let seen = Arc::new(std::sync::Mutex::new(Vec::new()));
    let log = seen.clone();
    backend.set_event_sink(Arc::new(move |e| {
        if let BackendEvent::AgentToolCall { call } = &e {
            log.lock().unwrap().push(call.clone());
            window
                .agent_tool_result(AgentToolAnswer {
                    call_id: call.call_id.clone(),
                    ok: true,
                    content: json!("prompt set"),
                })
                .unwrap();
        }
        events.lock().unwrap().push(e);
    }));
    let tool = fake_codex(dir.path());
    let reply = backend
        .agent_chat_with(AgentProvider::Codex, Some(&tool), request())
        .await
        .unwrap();
    let calls = seen.lock().unwrap();
    assert_eq!(calls.len(), 1, "{calls:?}");
    assert_eq!(calls[0].tool, "set_generation_settings");
    assert_eq!(calls[0].args, json!({"positivePrompt": "a cat"}));
    // The fake's final answer is the server's JSON-RPC answer, which carries the window's text.
    let answer: serde_json::Value = serde_json::from_str(&reply.text).unwrap();
    assert_eq!(answer["result"]["content"][0]["text"], "prompt set");
    assert_eq!(answer["result"]["isError"], false);
    // The request is over: a late answer finds nothing waiting.
    let late = backend
        .agent_tool_result(AgentToolAnswer {
            call_id: calls[0].call_id.clone(),
            ok: true,
            content: json!("x"),
        })
        .unwrap_err()
        .to_string();
    assert!(late.contains("no assistant request is running"), "{late}");
}

#[tokio::test]
async fn answers_are_taken_only_for_a_waiting_call_of_a_running_request() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let answer = |id: &str| AgentToolAnswer {
        call_id: id.into(),
        ok: true,
        content: json!("x"),
    };
    for bad in [
        "",
        "not-an-id",
        "c-../../etc",
        &format!("c-{}", "z".repeat(32)),
    ] {
        let err = backend
            .agent_tool_result(answer(bad))
            .unwrap_err()
            .to_string();
        assert!(err.contains("not a tool call id"), "{bad}: {err}");
    }
    let err = backend
        .agent_tool_result(answer(&format!("c-{}", "a".repeat(32))))
        .unwrap_err()
        .to_string();
    assert!(err.contains("no assistant request is running"), "{err}");
    // Stopping when nothing runs does nothing.
    backend.agent_cancel();
}

/// A fake `codex` that writes the name and size of each `-i` file it was given (the size proves the file was there) to
/// `seen.txt` next to itself, and answers.
fn fake_codex_with_pictures(dir: &Path) -> PathBuf {
    let (file, body) = if cfg!(windows) {
        (
            "codex-pics.cmd",
            [
                "@echo off",
                "set HERE=%~dp0",
                ":loop",
                r#"if "%~1"=="" goto done"#,
                r#"if "%~1"=="-i" echo %~nx2 %~z2>> "%HERE%seen.txt""#,
                r#"if "%~1"=="-o" set OUT=%~2"#,
                "shift",
                "goto loop",
                ":done",
                r#"echo looked> "%OUT%""#,
            ]
            .join("\r\n"),
        )
    } else {
        (
            "codex-pics",
            [
                "#!/bin/sh",
                r#"HERE="$(dirname "$0")""#,
                r#"while [ $# -gt 0 ]; do case "$1" in -i) echo "$(basename "$2") $(wc -c < "$2" | tr -d ' ')" >> "$HERE/seen.txt";; -o) OUT="$2";; esac; shift; done"#,
                r#"echo looked > "$OUT""#,
            ]
            .join("\n"),
        )
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

fn with_pictures(names: &[&str]) -> AgentRequest {
    let mut request = request();
    request.images = names.iter().map(|n| n.to_string()).collect();
    request
}

#[tokio::test]
async fn attached_gallery_pictures_reach_the_tool_as_files() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let a = backend
        .upload_image(png(3200, 40), novira_core::types::ImageOptions::default())
        .await
        .unwrap();
    let b = backend
        .upload_image(png(8, 8), novira_core::types::ImageOptions::default())
        .await
        .unwrap();
    let tools = tempfile::tempdir().unwrap();
    let tool = fake_codex_with_pictures(tools.path());
    let reply = backend
        .agent_chat_with(
            AgentProvider::Codex,
            Some(&tool),
            with_pictures(&[&a.name, &b.name]),
        )
        .await
        .unwrap();
    assert_eq!(reply.text, "looked");
    let seen = std::fs::read_to_string(tools.path().join("seen.txt")).unwrap();
    let lines: Vec<&str> = seen.lines().map(str::trim).collect();
    assert_eq!(lines.len(), 2, "{seen}");
    for (i, line) in lines.iter().enumerate() {
        let (name, size) = line.split_once(' ').unwrap();
        assert_eq!(name, format!("picture-{}.jpg", i + 1));
        assert!(size.parse::<u64>().unwrap() > 0, "{line}");
    }
}

#[tokio::test]
async fn attachments_that_are_not_pictures_of_the_gallery_are_refused_before_the_tool_runs() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let stored = backend
        .upload_image(png(8, 8), novira_core::types::ImageOptions::default())
        .await
        .unwrap();
    let tools = tempfile::tempdir().unwrap();
    let tool = fake_codex_with_pictures(tools.path());
    let missing = format!("{}.png", "a".repeat(32));
    let video = format!("{}.mp4", "b".repeat(32));
    let five = [stored.name.as_str(); 5];
    for (names, says) in [
        (&five[..], "At most 4"),
        (&["../outputs/x.png"][..], "not a picture"),
        (&[r"C:\x.png"][..], "not a picture"),
        (&[video.as_str()][..], "not a picture"),
        (&[missing.as_str()][..], "no longer in the gallery"),
    ] {
        let err = backend
            .agent_chat_with(AgentProvider::Codex, Some(&tool), with_pictures(names))
            .await
            .unwrap_err()
            .to_string();
        assert!(err.contains(says), "{names:?}: {err}");
    }
    assert!(
        !tools.path().join("seen.txt").exists(),
        "the tool never ran"
    );
    // Four is allowed.
    backend
        .agent_chat_with(AgentProvider::Codex, Some(&tool), with_pictures(&five[..4]))
        .await
        .unwrap();
}
