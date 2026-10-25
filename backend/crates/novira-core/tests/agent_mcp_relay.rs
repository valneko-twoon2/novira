//! A tool call's whole way without a model: an HTTP client speaking MCP to the app's server, the relay turning the
//! call into an event, a fake frontend answering it, and the answer coming back as the MCP result. The backend's side
//! (events and `agent_tool_result`) is in `backend_service/assistant.rs`.
use novira_core::agent::mcp::{self, McpServer};
use novira_core::agent::{AgentToolAnswer, AgentToolCall, Relay};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::mpsc;

/// The server with a relay whose events go to the returned channel (the frontend's side).
async fn server() -> (
    McpServer,
    Arc<Relay>,
    mpsc::UnboundedReceiver<AgentToolCall>,
) {
    let (tx, rx) = mpsc::unbounded_channel();
    let relay = Arc::new(Relay::new(move |call| {
        let _ = tx.send(call);
    }));
    let server = mcp::start(relay.clone(), 20).await.unwrap();
    (server, relay, rx)
}

async fn post(server: &McpServer, body: Value) -> reqwest::Response {
    reqwest::Client::new()
        .post(server.url())
        .bearer_auth(&server.token)
        .header("Accept", "application/json, text/event-stream")
        .json(&body)
        .send()
        .await
        .unwrap()
}

async fn call(server: &McpServer, tool: &str, args: Value) -> Value {
    let body = json!({"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": tool, "arguments": args}});
    post(server, body).await.json().await.unwrap()
}

#[tokio::test]
async fn a_call_goes_to_the_frontend_and_its_answer_is_the_result() {
    let (server, relay, mut events) = server().await;
    let frontend = tokio::spawn(async move {
        let call = events.recv().await.unwrap();
        assert_eq!(call.tool, "set_generation_settings");
        assert_eq!(call.args, json!({"positivePrompt": "a red apple"}));
        assert!(!call.read_gated);
        relay
            .answer(AgentToolAnswer {
                call_id: call.call_id,
                ok: true,
                content: json!({"changed": ["positivePrompt"]}),
            })
            .unwrap();
    });
    let result = call(
        &server,
        "set_generation_settings",
        json!({"positivePrompt": "a red apple"}),
    )
    .await;
    frontend.await.unwrap();
    assert_eq!(result["id"], 9);
    assert_eq!(result["result"]["isError"], false);
    assert_eq!(
        result["result"]["content"][0]["text"],
        r#"{"changed":["positivePrompt"]}"#
    );
}

#[tokio::test]
async fn a_read_the_user_declines_comes_back_as_a_tool_error() {
    let (server, relay, mut events) = server().await;
    let frontend = tokio::spawn(async move {
        let call = events.recv().await.unwrap();
        assert!(call.read_gated);
        relay
            .answer(AgentToolAnswer {
                call_id: call.call_id,
                ok: false,
                content: json!("The user declined."),
            })
            .unwrap();
    });
    let result = call(
        &server,
        "get_generation_settings",
        json!({"includePrompts": true}),
    )
    .await;
    frontend.await.unwrap();
    assert_eq!(result["result"]["isError"], true);
    assert_eq!(result["result"]["content"][0]["text"], "The user declined.");
}

#[tokio::test]
async fn a_call_with_bad_arguments_never_reaches_the_frontend() {
    let (server, _relay, mut events) = server().await;
    let result = call(&server, "add_lora", json!({"key": "l1", "weight": 50})).await;
    assert_eq!(result["result"]["isError"], true);
    assert!(events.try_recv().is_err());
}

#[tokio::test]
async fn a_client_without_the_token_is_turned_away() {
    let (server, _relay, mut events) = server().await;
    let response = reqwest::Client::new()
        .post(server.url())
        .json(&json!({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status().as_u16(), 401);
    assert!(events.try_recv().is_err());
}
