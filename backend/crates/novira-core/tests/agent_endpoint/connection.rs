//! The connection to a fake OpenAI-compatible server: the model list, "test connection", the key, redirects, size and
//! time limits.
use super::server::*;
use novira_core::agent::endpoint::{ApiKey, CALL_TIMEOUT};
use novira_core::agent::{AgentToolsState, Endpoint};
use serde_json::json;
use std::time::Duration;

fn endpoint(base: &str, key: Option<&str>) -> Endpoint {
    Endpoint::new(base, key.and_then(ApiKey::new)).unwrap()
}

#[tokio::test]
async fn the_model_list_is_read_sorted_and_sent_with_the_key_as_a_header() {
    let fake = Fake::start().await;
    fake.set_models(Reply::Json(
        200,
        json!({"data": [{"id": "qwen3:8b"}, {"id": "a-model"}, {"id": "qwen3:8b"}, {"id": ""}, {"nope": 1}]}),
    ));
    let names = endpoint(&fake.base, Some("sk-abc"))
        .list_models()
        .await
        .unwrap();
    assert_eq!(names, ["a-model", "qwen3:8b"]);
    let seen = fake.seen();
    assert_eq!(seen[0].method, "GET");
    assert_eq!(seen[0].path, "/v1/models");
    assert_eq!(seen[0].authorization.as_deref(), Some("Bearer sk-abc"));
    // Without a key no Authorization header is sent.
    endpoint(&fake.base, None).list_models().await.unwrap();
    assert_eq!(fake.seen()[1].authorization, None);
}

#[tokio::test]
async fn a_server_without_a_model_list_or_with_an_odd_one_is_an_error_not_an_empty_list() {
    let fake = Fake::start().await;
    fake.set_models(Reply::Json(404, json!({"error": {"message": "not found"}})));
    let err = endpoint(&fake.base, None).list_models().await.unwrap_err();
    assert_eq!(err.status, Some(404));
    fake.set_models(Reply::Json(200, json!({"models": []})));
    let err = endpoint(&fake.base, None).list_models().await.unwrap_err();
    assert!(err.message.contains("unexpected shape"), "{err}");
    fake.set_models(Reply::Raw(200, b"<html>".to_vec()));
    assert!(endpoint(&fake.base, None).list_models().await.is_err());
}

#[tokio::test]
async fn nothing_listening_is_reported_as_a_connection_failure() {
    // Port 9 (discard) is closed on a normal PC; the address is valid but nothing answers.
    let err = endpoint("http://127.0.0.1:9/v1", None)
        .list_models()
        .await
        .unwrap_err();
    assert_eq!(err.status, None);
    assert!(err.message.contains("cannot connect"), "{err}");
}

#[tokio::test]
async fn test_connection_passes_when_the_model_exists_and_makes_a_valid_tool_call() {
    let fake = Fake::start().await;
    fake.queue(calls(&[("t", "get_screen", json!({}))]));
    fake.queue(says("generate"));
    let result = endpoint(&fake.base, None).test("llama3.2").await;
    assert!(result.reachable && result.error.is_none(), "{result:?}");
    assert_eq!(
        result.model_found,
        Some(true),
        "llama3.2 matches llama3.2:latest"
    );
    assert_eq!(result.tools, AgentToolsState::Supported);
    let chats = fake.chats();
    // Only the trivial tool is offered, and its result goes back in the second request.
    assert_eq!(chats[0].body["tools"].as_array().unwrap().len(), 1);
    assert_eq!(chats[0].body["tools"][0]["function"]["name"], "get_screen");
    assert_eq!(
        chats[1].body["messages"]
            .as_array()
            .unwrap()
            .last()
            .unwrap()["role"],
        "tool"
    );
}

#[tokio::test]
async fn test_connection_sends_the_whole_request_once_and_fails_when_the_server_cuts_it_short() {
    let fake = Fake::start().await;
    // Ollama's default window: it reports 2051 tokens read of a request that is thousands of tokens long.
    fake.set_probe(read_tokens(2051));
    let result = endpoint(&fake.base, None).test("llama3.2").await;
    assert!(result.reachable && result.error.is_none(), "{result:?}");
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    let reason = result.tools_reason.unwrap();
    assert!(
        reason.contains("context window is too small") && reason.contains("OLLAMA_CONTEXT_LENGTH"),
        "{reason}"
    );
    assert!(reason.contains("2051 tokens"), "{reason}");
    // The probe is the real request (all the tools and the rules) with room for one token only; no tool round trip ran.
    let probes = fake.probes();
    assert_eq!(probes.len(), 1);
    assert_eq!(
        probes[0].body["tools"].as_array().unwrap().len(),
        novira_core::agent::tools::TOOLS.len()
    );
    assert!(probes[0].body["messages"][0]["content"]
        .as_str()
        .unwrap()
        .starts_with("You are the assistant inside novira"));
    assert!(fake.chats().is_empty());
    // A server that reports no count is not judged.
    fake.set_probe(Reply::Json(
        200,
        json!({"choices": [{"message": {"content": "h"}}]}),
    ));
    fake.queue(calls(&[("t", "get_screen", json!({}))]));
    fake.queue(says("generate"));
    assert_eq!(
        endpoint(&fake.base, None).test("llama3.2").await.tools,
        AgentToolsState::Supported
    );
}

#[tokio::test]
async fn test_connection_says_so_when_the_server_rejects_tools() {
    let fake = Fake::start().await;
    fake.queue(no_tools("gemma:2b"));
    let result = endpoint(&fake.base, None).test("gemma:2b").await;
    assert!(result.reachable);
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    assert!(result
        .tools_reason
        .unwrap()
        .contains("does not support tools"));
}

#[tokio::test]
async fn test_connection_says_so_when_the_model_answers_in_words_or_calls_wrongly() {
    let fake = Fake::start().await;
    fake.queue(says("The screen is generate."));
    let result = endpoint(&fake.base, None).test("qwen3:8b").await;
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    assert!(result
        .tools_reason
        .unwrap()
        .contains("instead of calling the tool"));
    fake.queue(calls(&[("t", "select_model", json!({"key": "m"}))]));
    let result = endpoint(&fake.base, None).test("qwen3:8b").await;
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    assert!(result
        .tools_reason
        .unwrap()
        .contains("instead of the tool it was given"));
    // Arguments the schema refuses (get_screen takes none).
    fake.queue(calls(&[("t", "get_screen", json!({"x": 1}))]));
    let result = endpoint(&fake.base, None).test("qwen3:8b").await;
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    assert!(result.tools_reason.unwrap().contains("not valid"));
    // The model cannot take the tool's result back.
    fake.queue(calls(&[("t", "get_screen", json!({}))]));
    fake.queue(Reply::Json(500, json!({"error": "template error"})));
    let result = endpoint(&fake.base, None).test("qwen3:8b").await;
    assert_eq!(result.tools, AgentToolsState::Unsupported);
    assert!(result
        .tools_reason
        .unwrap()
        .contains("could not take a tool's result"));
}

#[tokio::test]
async fn test_connection_tells_a_missing_model_and_an_unreachable_server() {
    let fake = Fake::start().await;
    fake.queue(Reply::Json(
        404,
        json!({"error": {"message": "model \"nope\" not found"}}),
    ));
    let result = endpoint(&fake.base, None).test("nope").await;
    assert!(result.reachable);
    assert_eq!(result.model_found, Some(false));
    assert_eq!(result.tools, AgentToolsState::Unknown);
    assert!(result.error.unwrap().contains("not found"));

    let down = endpoint("http://127.0.0.1:9/v1", None).test("m").await;
    assert!(!down.reachable);
    assert!(down.error.unwrap().contains("cannot connect"));
    assert_eq!(down.tools, AgentToolsState::Unknown);
    // No model chosen: reachability only, and no chat call is made.
    let none = endpoint(&fake.base, None).test("  ").await;
    assert!(none.reachable && none.tools == AgentToolsState::Unknown && none.error.is_some());
}

#[tokio::test]
async fn the_key_never_appears_in_an_error_even_when_the_server_echoes_it() {
    let fake = Fake::start().await;
    let key = "sk-very-secret-1234567890";
    fake.queue(Reply::Json(
        401,
        json!({"error": {"message": format!("Incorrect API key provided: {key}. Check Authorization: Bearer {key}")}}),
    ));
    let e = endpoint(&fake.base, Some(key));
    let err = e
        .chat_completions(&json!({"model": "m", "messages": []}), CALL_TIMEOUT)
        .await
        .unwrap_err();
    assert_eq!(err.status, Some(401));
    assert!(
        !err.message.contains(key) && err.message.contains("***"),
        "{err}"
    );
    assert!(!format!("{err:?}").contains(key));
    assert!(!format!("{e:?}").contains(key));
    // A refused connection names no key either.
    let down = endpoint("http://127.0.0.1:9/v1", Some(key));
    let err = down.list_models().await.unwrap_err();
    assert!(!err.message.contains(key));
}

#[tokio::test]
async fn a_redirect_to_another_origin_is_not_followed_and_the_key_does_not_follow_it() {
    let target = Fake::start().await;
    let fake = Fake::start().await;
    fake.set_models(Reply::Redirect(format!("{}/elsewhere", target.origin)));
    let err = endpoint(&fake.base, Some("sk-abc"))
        .list_models()
        .await
        .unwrap_err();
    assert_eq!(err.status, Some(307), "{err}");
    assert!(
        target.seen().is_empty(),
        "the other host was never contacted"
    );
}

#[tokio::test]
async fn a_redirect_inside_the_same_origin_is_followed() {
    let fake = Fake::start().await;
    fake.set_models(Reply::Redirect(format!("{}/elsewhere", fake.origin)));
    // `/elsewhere` answers a list with no models.
    let names = endpoint(&fake.base, Some("sk-abc"))
        .list_models()
        .await
        .unwrap();
    assert!(names.is_empty());
    assert_eq!(fake.seen().last().unwrap().path, "/elsewhere");
}

#[tokio::test]
async fn an_answer_over_the_size_cap_is_refused() {
    let fake = Fake::start().await;
    fake.queue(Reply::Big(5 * 1024 * 1024));
    let err = endpoint(&fake.base, None)
        .chat_completions(&json!({"model": "m", "messages": []}), CALL_TIMEOUT)
        .await
        .unwrap_err();
    assert!(err.message.contains("too large"), "{err}");
}

#[tokio::test]
async fn a_server_that_does_not_answer_in_time_is_stopped() {
    let fake = Fake::start().await;
    fake.queue(Reply::Slow(Duration::from_secs(5), json!({"choices": []})));
    let started = std::time::Instant::now();
    let err = endpoint(&fake.base, None)
        .chat_completions(
            &json!({"model": "m", "messages": []}),
            Duration::from_millis(300),
        )
        .await
        .unwrap_err();
    assert!(err.message.contains("did not answer in time"), "{err}");
    assert!(started.elapsed() < Duration::from_secs(3));
}
