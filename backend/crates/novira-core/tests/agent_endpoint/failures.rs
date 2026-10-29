//! Odd answers of an OpenAI-compatible server: a body cut off mid-way, a huge error page, an error inside a 200, a
//! probe the server refuses, a tool call whose arguments are not JSON.
use super::server::*;
use novira_core::agent::{AgentToolsState, Endpoint};
use serde_json::json;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

fn endpoint(base: &str) -> Endpoint {
    Endpoint::new(base, None).unwrap()
}

#[tokio::test]
async fn the_base_address_is_kept_without_a_trailing_slash() {
    let e = endpoint("http://127.0.0.1:9/v1/");
    assert_eq!(e.base().as_str(), "http://127.0.0.1:9/v1");
}

#[tokio::test]
async fn a_body_cut_off_by_the_server_is_a_connection_failure_not_a_timeout() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        // Read the request head, promise 1000 bytes, send 3 and hang up.
        let mut buf = [0u8; 4096];
        let _ = tokio::io::AsyncReadExt::read(&mut socket, &mut buf).await;
        let _ = socket
            .write_all(b"HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: 1000\r\n\r\n{\"a")
            .await;
        let _ = socket.shutdown().await;
    });
    let err = endpoint(&format!("http://127.0.0.1:{port}/v1"))
        .list_models()
        .await
        .unwrap_err();
    assert_eq!(err.status, None);
    assert!(err.message.contains("the connection failed"), "{err}");
}

#[tokio::test]
async fn a_huge_error_page_is_cut_and_still_reported_with_its_status() {
    let fake = Fake::start().await;
    fake.queue(Reply::Raw(502, vec![b'x'; 2 * 1024 * 1024]));
    let err = endpoint(&fake.base)
        .chat_completions(
            &json!({"model": "m", "messages": []}),
            Duration::from_secs(10),
        )
        .await
        .unwrap_err();
    assert_eq!(err.status, Some(502));
    assert!(err.message.starts_with("the server answered 502"), "{err}");
    assert!(err.message.len() < 2000, "{}", err.message.len());
}

#[tokio::test]
async fn an_error_inside_a_200_answer_is_reported_with_the_servers_words() {
    let fake = Fake::start().await;
    fake.queue(Reply::Json(
        200,
        json!({"error": {"message": "model is loading"}}),
    ));
    fake.queue(Reply::Json(200, json!({"error": "plain text failure"})));
    fake.queue(Reply::Json(200, json!({"error": {"code": 7}})));
    async fn call(e: &Endpoint) -> novira_core::agent::endpoint::CallError {
        e.chat_completions(
            &json!({"model": "m", "messages": []}),
            Duration::from_secs(10),
        )
        .await
        .unwrap_err()
    }
    let e = endpoint(&fake.base);
    let first = call(&e).await;
    assert_eq!(first.status, Some(200));
    assert!(first.message.contains("model is loading"), "{first}");
    assert!(call(&e).await.message.contains("plain text failure"));
    assert!(call(&e).await.message.contains("unknown"));
}

#[tokio::test]
async fn test_connection_reports_a_server_that_rejects_the_probe() {
    let fake = Fake::start().await;
    fake.set_probe(no_tools("tiny"));
    let result = endpoint(&fake.base).test("tiny").await;
    assert!(result.reachable);
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    assert!(result
        .tools_reason
        .unwrap()
        .contains("does not support tools"));
    // A server that fails the probe for another reason is an error, not a verdict on the model.
    fake.set_probe(Reply::Json(500, json!({"error": "boom"})));
    let result = endpoint(&fake.base).test("tiny").await;
    assert_eq!(result.tools, AgentToolsState::Unknown);
    assert!(result.error.unwrap().contains("boom"));
}

#[tokio::test]
async fn test_connection_reports_a_second_request_the_server_refuses_for_tools() {
    let fake = Fake::start().await;
    fake.queue(no_tools("tiny"));
    let result = endpoint(&fake.base).test("tiny").await;
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    // A tool call whose arguments are not JSON.
    fake.queue(Reply::Json(
        200,
        json!({"choices": [{"message": {"role": "assistant", "content": null, "tool_calls": [
            {"id": "t", "type": "function", "function": {"name": "get_screen", "arguments": "{not json"}}
        ]}}]}),
    ));
    let result = endpoint(&fake.base).test("tiny").await;
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    assert!(result.tools_reason.unwrap().contains("not valid"));
}
