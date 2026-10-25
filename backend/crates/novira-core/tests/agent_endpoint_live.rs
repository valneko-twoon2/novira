//! The assistant on a real OpenAI-compatible server (Ollama). Ignored: it needs a running server and a model, and it
//! uses the GPU, so take the GPU lock first (docs/verification.md) and run it by name:
//!
//! `NOVIRA_TEST_OLLAMA_URL=http://127.0.0.1:11434/v1 NOVIRA_TEST_OLLAMA_MODEL=<a model that can call tools>
//!  [NOVIRA_TEST_OLLAMA_NO_TOOLS_MODEL=<a model that cannot>] cargo test -p novira-core --test agent_endpoint_live -- --ignored --nocapture`
#[path = "agent_endpoint/server.rs"]
mod server;
use novira_core::agent::endpoint::ApiKey;
use novira_core::agent::toolloop::{run, EndpointError};
use novira_core::agent::{AgentRequest, AgentToolsState, Endpoint};
use serde_json::json;
use server::Scripted;
use std::sync::Arc;

fn url() -> String {
    std::env::var("NOVIRA_TEST_OLLAMA_URL").unwrap_or_else(|_| "http://127.0.0.1:11434/v1".into())
}

fn model() -> String {
    std::env::var("NOVIRA_TEST_OLLAMA_MODEL").expect("set NOVIRA_TEST_OLLAMA_MODEL")
}

fn endpoint() -> Endpoint {
    Endpoint::new(&url(), ApiKey::new("")).unwrap()
}

#[tokio::test]
#[ignore]
async fn the_server_lists_the_model_and_test_connection_passes_for_a_model_with_tools() {
    let names = endpoint().list_models().await.unwrap();
    println!("models: {names:?}");
    let result = endpoint().test(&model()).await;
    println!("test: {result:?}");
    assert!(result.reachable);
    assert_eq!(result.model_found, Some(true));
    assert_eq!(result.tools, AgentToolsState::Supported, "{result:?}");
}

#[tokio::test]
#[ignore]
async fn a_real_model_calls_the_apps_tool_and_answers() {
    let request: AgentRequest = serde_json::from_value(json!({
        "message": "Which screen am I on? Look it up with your tools, then tell me in one sentence.",
        "locale": "en", "screen": "generate"
    }))
    .unwrap();
    let handler = Arc::new(Scripted::answering(
        "get_screen",
        novira_core::agent::mcp::ToolOutcome {
            ok: true,
            text: r#"{"screen":"generate","kind":"image"}"#.into(),
            image: None,
        },
    ));
    let reply = run(&endpoint(), &model(), &request, handler.clone())
        .await
        .unwrap();
    println!(
        "tools run: {:?}\nreply: {}",
        handler.tools_seen(),
        reply.text
    );
    assert!(handler.tools_seen().contains(&"get_screen"));
    assert!(!reply.text.is_empty());
}

#[tokio::test]
#[ignore]
async fn a_model_without_tools_is_reported_as_such() {
    let Ok(model) = std::env::var("NOVIRA_TEST_OLLAMA_NO_TOOLS_MODEL") else {
        println!("NOVIRA_TEST_OLLAMA_NO_TOOLS_MODEL is not set; nothing to check");
        return;
    };
    let result = endpoint().test(&model).await;
    println!("test: {result:?}");
    assert_eq!(result.tools, AgentToolsState::Unsupported, "{result:?}");
    let request: AgentRequest =
        serde_json::from_value(json!({"message": "hi", "locale": "en"})).unwrap();
    let err = run(&endpoint(), &model, &request, Arc::new(Scripted::default()))
        .await
        .unwrap_err();
    println!("send: {err}");
    assert!(matches!(err, EndpointError::NoTools(_)), "{err:?}");
}

/// Run against a server left at Ollama's default context window (4096 tokens), with `NOVIRA_TEST_OLLAMA_SMALL_CONTEXT=1`.
#[tokio::test]
#[ignore]
async fn a_small_context_window_is_reported_by_test_connection_and_by_a_request() {
    if std::env::var("NOVIRA_TEST_OLLAMA_SMALL_CONTEXT").is_err() {
        println!("NOVIRA_TEST_OLLAMA_SMALL_CONTEXT is not set; nothing to check");
        return;
    }
    let result = endpoint().test(&model()).await;
    println!("test: {result:?}");
    assert_eq!(result.tools, AgentToolsState::Unsupported, "{result:?}");
    assert!(result
        .tools_reason
        .unwrap()
        .contains("context window is too small"));
    let request: AgentRequest =
        serde_json::from_value(json!({"message": "hi", "locale": "en"})).unwrap();
    let err = run(
        &endpoint(),
        &model(),
        &request,
        Arc::new(Scripted::default()),
    )
    .await
    .unwrap_err();
    println!("send: {err}");
    assert!(
        matches!(&err, EndpointError::NoTools(r) if r.contains("context window is too small")),
        "{err:?}"
    );
}

#[tokio::test]
#[ignore]
async fn prints_what_the_server_reports_it_read_of_the_whole_request() {
    use novira_core::agent::endpoint::CALL_TIMEOUT;
    let request: AgentRequest =
        serde_json::from_value(json!({"message": "hi", "locale": "en"})).unwrap();
    let body = json!({
        "model": model(),
        "messages": [
            {"role": "system", "content": novira_core::agent::build_system(&request)},
            {"role": "user", "content": "hi"}
        ],
        "tools": novira_core::agent::toolloop::tool_specs(None),
        "max_tokens": 1, "stream": false
    });
    let bytes = body["messages"].to_string().len() + body["tools"].to_string().len();
    println!("request bytes: {bytes}");
    for i in 0..3 {
        let answer = endpoint()
            .chat_completions(&body, CALL_TIMEOUT)
            .await
            .unwrap();
        println!("round {i}: usage {}", answer["usage"]);
    }
}
