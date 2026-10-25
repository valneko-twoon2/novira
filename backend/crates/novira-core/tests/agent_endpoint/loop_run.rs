//! The app's own tool loop against a fake OpenAI-compatible server: what is sent, how the model's calls are checked
//! and run through the shared handler, and the limits.
use super::server::*;
use novira_core::agent::mcp::ToolOutcome;
use novira_core::agent::relay::MAX_RESULT_BYTES;
use novira_core::agent::toolloop::{run, run_capped, EndpointError};
use novira_core::agent::tools::TOOLS;
use novira_core::agent::{AgentRequest, AgentToolAnswer, Endpoint, Relay};
use serde_json::{json, Value};
use std::sync::Arc;

fn request() -> AgentRequest {
    serde_json::from_value(json!({
        "message": "make it blue", "locale": "en", "screen": "generate",
        "history": [{"role": "user", "text": "hi"}, {"role": "assistant", "text": "hello"}]
    }))
    .unwrap()
}

fn endpoint(fake: &Fake) -> Endpoint {
    Endpoint::new(
        &fake.base,
        novira_core::agent::endpoint::ApiKey::new("sk-test-key"),
    )
    .unwrap()
}

/// The `tool` message of a request's body whose id is `id`.
fn tool_result(body: &Value, id: &str) -> String {
    body["messages"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["role"] == "tool" && m["tool_call_id"] == id)
        .unwrap_or_else(|| panic!("no tool message {id} in {body}"))["content"]
        .as_str()
        .unwrap()
        .to_string()
}

#[tokio::test]
async fn a_tool_call_runs_through_the_handler_and_its_result_goes_back_until_the_model_answers() {
    let fake = Fake::start().await;
    fake.queue(calls(&[("c1", "select_model", json!({"key": "m1"}))]));
    fake.queue(calls(&[("c2", "get_screen", json!({}))]));
    fake.queue(says(
        "<thoughts>\n- picked m1\n</thoughts>\nDone: model set.",
    ));
    let handler = Arc::new(Scripted::default());
    let reply = run(&endpoint(&fake), "llama3.2", &request(), handler.clone())
        .await
        .unwrap();
    assert_eq!(reply.text, "Done: model set.");
    assert_eq!(reply.thoughts, vec!["picked m1".to_string()]);
    assert_eq!(handler.tools_seen(), ["select_model", "get_screen"]);
    assert_eq!(handler.seen.lock().unwrap()[0].args, json!({"key": "m1"}));

    let chats = fake.chats();
    assert_eq!(chats.len(), 3);
    let first = &chats[0].body;
    assert_eq!(
        chats[0].authorization.as_deref(),
        Some("Bearer sk-test-key")
    );
    assert_eq!(first["model"], "llama3.2");
    assert_eq!(first["stream"], false);
    // The rules are the system message; the earlier turns and the message follow as turns.
    let roles: Vec<&str> = first["messages"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["role"].as_str().unwrap())
        .collect();
    assert_eq!(roles, ["system", "user", "assistant", "user"]);
    assert!(first["messages"][0]["content"]
        .as_str()
        .unwrap()
        .starts_with("You are the assistant inside novira"));
    assert_eq!(first["messages"][3]["content"], "make it blue");
    // Every tool is offered, from the same definitions the MCP server lists.
    let offered = first["tools"].as_array().unwrap();
    assert_eq!(offered.len(), TOOLS.len());
    assert_eq!(offered[0]["type"], "function");
    assert_eq!(offered[0]["function"]["name"], TOOLS[0].name);
    // The result comes back as a tool message after the assistant's own call.
    assert_eq!(tool_result(&chats[1].body, "c1"), "ran select_model");
    let echoed = &chats[1].body["messages"][4];
    assert_eq!(echoed["role"], "assistant");
    assert_eq!(echoed["tool_calls"][0]["function"]["name"], "select_model");
    assert_eq!(tool_result(&chats[2].body, "c2"), "ran get_screen");
}

#[tokio::test]
async fn arguments_that_break_the_schema_never_reach_the_handler() {
    let fake = Fake::start().await;
    fake.queue(calls(&[
        ("a", "set_generation_settings", json!({"steps": 9999})),
        ("b", "delete_images", json!({})),
        ("c", "select_model", json!({"key": "m", "evil": 1})),
    ]));
    // Arguments that are not JSON at all.
    fake.queue(Reply::Json(
        200,
        json!({"choices": [{"message": {"content": null, "tool_calls": [
            {"id": "d", "type": "function", "function": {"name": "select_model", "arguments": "{oops"}}
        ]}}]}),
    ));
    fake.queue(says("I could not do that."));
    let handler = Arc::new(Scripted::default());
    let reply = run(&endpoint(&fake), "m", &request(), handler.clone())
        .await
        .unwrap();
    assert_eq!(reply.text, "I could not do that.");
    assert!(handler.tools_seen().is_empty());
    let chats = fake.chats();
    assert!(
        tool_result(&chats[1].body, "a").starts_with("Error: ")
            && tool_result(&chats[1].body, "a").contains("at most 150")
    );
    assert!(tool_result(&chats[1].body, "b").contains("unknown tool"));
    assert!(tool_result(&chats[1].body, "c").contains("unknown field"));
    assert!(tool_result(&chats[2].body, "d").contains("not valid JSON"));
}

#[tokio::test]
async fn reads_of_pictures_and_prompts_go_to_the_handler_marked_read_gated_and_a_decline_is_the_models_error(
) {
    let fake = Fake::start().await;
    fake.queue(calls(&[
        ("g", "list_gallery_images", json!({})),
        (
            "s",
            "get_generation_settings",
            json!({"includePrompts": true}),
        ),
        ("p", "get_generation_settings", json!({})),
    ]));
    fake.queue(says("Going on without it."));
    let handler = Arc::new(Scripted::answering(
        "list_gallery_images",
        ToolOutcome::error("The user declined to let you read their pictures."),
    ));
    run(&endpoint(&fake), "m", &request(), handler.clone())
        .await
        .unwrap();
    let seen = handler.seen.lock().unwrap();
    assert_eq!(
        seen.iter()
            .map(|c| (c.tool, c.read_gated))
            .collect::<Vec<_>>(),
        [
            ("list_gallery_images", true),
            ("get_generation_settings", true),
            ("get_generation_settings", false)
        ]
    );
    let chats = fake.chats();
    assert!(tool_result(&chats[1].body, "g").starts_with("Error: The user declined"));
}

#[tokio::test]
async fn a_relayed_answer_over_the_cap_reaches_the_model_as_an_error() {
    let fake = Fake::start().await;
    fake.queue(calls(&[("big", "get_screen", json!({}))]));
    fake.queue(says("ok"));
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let relay = Arc::new(Relay::new(move |call| {
        let _ = tx.send(call);
    }));
    let window = relay.clone();
    let answering = tokio::spawn(async move {
        let call = rx.recv().await.unwrap();
        assert_eq!(call.tool, "get_screen");
        window
            .answer(AgentToolAnswer {
                call_id: call.call_id,
                ok: true,
                content: json!("x".repeat(MAX_RESULT_BYTES + 1)),
            })
            .unwrap();
    });
    run(&endpoint(&fake), "m", &request(), relay).await.unwrap();
    answering.await.unwrap();
    let text = tool_result(&fake.chats()[1].body, "big");
    assert!(
        text.starts_with("Error: ") && text.contains("too large"),
        "{text}"
    );
}

#[tokio::test]
async fn the_tool_call_cap_is_enforced_and_a_model_that_ignores_it_is_stopped() {
    let fake = Fake::start().await;
    for i in 0..10 {
        fake.queue(calls(&[(&format!("k{i}"), "get_screen", json!({}))]));
    }
    let handler = Scripted::default();
    let err = run_capped(&endpoint(&fake), "m", &request(), &handler, 2)
        .await
        .unwrap_err();
    assert!(
        matches!(&err, EndpointError::Failed(m) if m.contains("kept calling tools")),
        "{err:?}"
    );
    // Only the first two calls ran; the rest were told the calls are used up.
    assert_eq!(handler.tools_seen().len(), 2);
    let chats = fake.chats();
    assert!(tool_result(&chats[3].body, "k2").contains("used up its tool calls"));
    assert_eq!(
        chats.len(),
        2 + 1 + 3,
        "two rounds, then three more before it stops"
    );
}

#[tokio::test]
async fn a_model_that_stops_calling_after_the_cap_may_still_answer() {
    let fake = Fake::start().await;
    fake.queue(calls(&[
        ("k0", "get_screen", json!({})),
        ("k1", "get_screen", json!({})),
    ]));
    fake.queue(calls(&[("k2", "get_screen", json!({}))]));
    fake.queue(says("Done as far as I got."));
    let handler = Scripted::default();
    let reply = run_capped(&endpoint(&fake), "m", &request(), &handler, 2)
        .await
        .unwrap();
    assert_eq!(reply.text, "Done as far as I got.");
    assert_eq!(handler.tools_seen().len(), 2);
}

#[tokio::test]
async fn a_server_that_read_only_part_of_the_first_request_is_reported_before_its_answer_is_used() {
    let fake = Fake::start().await;
    // The server read 2051 tokens of a request of many thousands, and the model answered without the tools.
    fake.queue(says_after_reading("I have no tool for that.", 2051));
    let handler = Arc::new(Scripted::default());
    let err = run(&endpoint(&fake), "m", &request(), handler.clone())
        .await
        .unwrap_err();
    match &err {
        EndpointError::NoTools(reason) => {
            assert!(reason.contains("context window is too small"), "{reason}")
        }
        other => panic!("{other:?}"),
    }
    assert!(handler.tools_seen().is_empty());
    // A server that reads all of it (or reports no count) is fine; only the first round is judged.
    fake.queue(says_after_reading("Done.", 100_000));
    assert_eq!(
        run(
            &endpoint(&fake),
            "m",
            &request(),
            Arc::new(Scripted::default())
        )
        .await
        .unwrap()
        .text,
        "Done."
    );
    fake.queue(calls(&[("c", "get_screen", json!({}))]));
    fake.queue(says_after_reading("Later rounds are not judged.", 10));
    assert!(run(
        &endpoint(&fake),
        "m",
        &request(),
        Arc::new(Scripted::default())
    )
    .await
    .is_ok());
}

#[tokio::test]
async fn thinking_blocks_are_dropped_and_an_empty_answer_is_an_error() {
    let fake = Fake::start().await;
    fake.queue(says("<think>let me see</think>All set."));
    let reply = run(
        &endpoint(&fake),
        "m",
        &request(),
        Arc::new(Scripted::default()),
    )
    .await
    .unwrap();
    assert_eq!(reply.text, "All set.");
    fake.queue(says("   "));
    let err = run(
        &endpoint(&fake),
        "m",
        &request(),
        Arc::new(Scripted::default()),
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        EndpointError::Failed("the model gave no answer".into())
    );
}

#[tokio::test]
async fn a_server_that_rejects_tools_is_reported_as_such_and_other_errors_are_not() {
    let fake = Fake::start().await;
    fake.queue(no_tools("gemma:2b"));
    let err = run(
        &endpoint(&fake),
        "gemma:2b",
        &request(),
        Arc::new(Scripted::default()),
    )
    .await
    .unwrap_err();
    match &err {
        EndpointError::NoTools(reason) => {
            assert!(reason.contains("does not support tools"), "{reason}")
        }
        other => panic!("{other:?}"),
    }
    let shown = err.to_string();
    assert!(shown.contains("cannot use the app's tools") && shown.contains("test the connection"));

    fake.queue(Reply::Json(
        404,
        json!({"error": {"message": "model \"x\" not found"}}),
    ));
    let err = run(
        &endpoint(&fake),
        "x",
        &request(),
        Arc::new(Scripted::default()),
    )
    .await
    .unwrap_err();
    assert!(
        matches!(&err, EndpointError::Failed(m) if m.contains("404") && m.contains("not found")),
        "{err:?}"
    );

    fake.queue(Reply::Raw(200, b"<html>login</html>".to_vec()));
    let err = run(
        &endpoint(&fake),
        "x",
        &request(),
        Arc::new(Scripted::default()),
    )
    .await
    .unwrap_err();
    assert!(
        matches!(&err, EndpointError::Failed(m) if m.contains("not JSON")),
        "{err:?}"
    );

    fake.queue(Reply::Json(200, json!({"choices": []})));
    let err = run(
        &endpoint(&fake),
        "x",
        &request(),
        Arc::new(Scripted::default()),
    )
    .await
    .unwrap_err();
    assert!(
        matches!(&err, EndpointError::Failed(m) if m.contains("no message")),
        "{err:?}"
    );
}
