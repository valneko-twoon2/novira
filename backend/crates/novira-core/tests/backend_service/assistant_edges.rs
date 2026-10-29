//! The assistant at its edges: the pictures a tool names are read from the gallery with refusals, a second request
//! while one runs, stopping it, a server that fails, and a fact look-up in a language that is not offered.
use super::assistant_endpoint::server;
use super::common::*;
use novira_core::agent::{AgentEndpointInput, AgentRequest, AgentToolAnswer};
use novira_core::types::{BackendEvent, ImageOptions};
use serde_json::json;
use server::{calls, says, Fake, Reply};
use std::sync::Arc;

fn request() -> AgentRequest {
    serde_json::from_value(json!({"message": "show the page", "locale": "en"})).unwrap()
}

async fn connected(dir: &std::path::Path) -> (novira_core::Backend, Fake) {
    let (backend, _) = open(dir, Arc::new(FakeEngine::default()));
    let fake = Fake::start().await;
    backend
        .agent_endpoint_save(AgentEndpointInput {
            base_url: fake.base.clone(),
            model: "llama3.2".into(),
            api_key: None,
        })
        .await
        .unwrap();
    (backend, fake)
}

#[tokio::test]
async fn a_picture_a_tool_names_is_read_from_the_gallery_or_refused_with_the_reason() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, fake) = connected(dir.path()).await;
    let stored = backend
        .upload_image(png(16, 16), ImageOptions::default())
        .await
        .unwrap();
    let gone = format!("{}.png", "c".repeat(32));
    let names = [
        "../secret.png".to_string(),
        format!("{}.mp4", "d".repeat(32)),
        format!("{}.wav", "e".repeat(32)),
        gone,
        stored.name.clone(),
    ];
    let list: Vec<(String, &str, serde_json::Value)> = (0..names.len())
        .map(|i| (format!("c{i}"), "view_comic_page", json!({"page": i + 1})))
        .collect();
    let refs: Vec<(&str, &str, serde_json::Value)> = list
        .iter()
        .map(|(id, tool, args)| (id.as_str(), *tool, args.clone()))
        .collect();
    fake.queue(calls(&refs));
    fake.queue(says("done"));
    let window = backend.clone();
    let picked = names.to_vec();
    backend.set_event_sink(Arc::new(move |e| {
        if let BackendEvent::AgentToolCall { call } = &e {
            let at = call.args["page"].as_u64().unwrap() as usize - 1;
            window
                .agent_tool_result(AgentToolAnswer {
                    call_id: call.call_id.clone(),
                    ok: true,
                    content: json!({ "picture": picked[at], "page": 1 }),
                })
                .unwrap();
        }
    }));
    let reply = backend.agent_chat(request()).await.unwrap();
    assert_eq!(reply.text, "done");
    let body = fake.chats()[1].body.to_string();
    for why in [
        "is not a picture of the gallery",
        "is no longer in the gallery",
    ] {
        assert!(body.contains(why), "{why}: {body}");
    }
    // The stored picture went to the model as a picture, once.
    assert_eq!(body.matches("data:image/jpeg;base64").count(), 1, "{body}");
}

#[tokio::test]
async fn a_second_request_waits_out_the_first_and_stopping_ends_it() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, fake) = connected(dir.path()).await;
    // Stopping when nothing runs does nothing.
    backend.agent_cancel();
    fake.queue(calls(&[(
        "c1",
        "set_generation_settings",
        json!({"positivePrompt": "x"}),
    )]));
    // Nobody answers the call, so the first request keeps running.
    let first = tokio::spawn({
        let b = backend.clone();
        async move { b.agent_chat(request()).await }
    });
    wait_until(|| fake.chats().len() == 1).await;
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    let err = backend.agent_chat(request()).await.unwrap_err().to_string();
    assert!(err.contains("already working"), "{err}");
    backend.agent_cancel();
    let err = first.await.unwrap().unwrap_err().to_string();
    assert!(err.contains("Stopped"), "{err}");
}

#[tokio::test]
async fn a_server_that_fails_is_an_internal_error_and_an_unknown_language_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, fake) = connected(dir.path()).await;
    fake.queue(Reply::Json(500, json!({"error": {"message": "boom"}})));
    let err = backend.agent_chat(request()).await.unwrap_err();
    assert!(
        matches!(err, novira_core::BackendError::Internal(_)),
        "{err}"
    );
    let err = backend.lookup_reference("xx", "tokyo").await.unwrap_err();
    assert!(err.to_string().to_lowercase().contains("language"), "{err}");
}
