//! The assistant on an OpenAI-compatible server through the backend: saving the server (address checks, what is kept),
//! the status the window shows, a request that runs the tool loop with the window answering the calls, and a model
//! that cannot use tools being shown as such and refused afterwards.
use super::common::*;
#[path = "../agent_endpoint/server.rs"]
mod server;
use novira_core::agent::{
    AgentEndpointInput, AgentProvider, AgentRequest, AgentToolAnswer, AgentToolsState,
};
use novira_core::types::BackendEvent;
use serde_json::json;
use server::{calls, no_tools, says, Fake};
use std::sync::Arc;

fn input(base: &str, model: &str) -> AgentEndpointInput {
    AgentEndpointInput {
        base_url: base.into(),
        model: model.into(),
        api_key: None,
    }
}

fn request() -> AgentRequest {
    serde_json::from_value(json!({"message": "make it blue", "locale": "en"})).unwrap()
}

#[tokio::test]
async fn saving_selects_the_server_and_the_status_shows_it_without_a_key() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(backend.agent_status().await.endpoint.is_none());
    let status = backend
        .agent_endpoint_save(input(" http://127.0.0.1:11434/v1/ ", " llama3.2 "))
        .await
        .unwrap();
    assert_eq!(status.provider, Some(AgentProvider::Openai));
    assert!(status.installed && status.logged_in && status.models.is_empty());
    let info = status.endpoint.unwrap();
    assert_eq!(info.base_url, "http://127.0.0.1:11434/v1");
    assert_eq!(info.model, "llama3.2");
    assert!(!info.has_key && !info.remote && !info.insecure);
    assert_eq!(info.tools, AgentToolsState::Unknown);
    // It survives a restart; switching to a CLI keeps the saved server for the form.
    drop(backend);
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(
        backend.agent_status().await.endpoint.unwrap().model,
        "llama3.2"
    );
}

#[tokio::test]
async fn a_remote_http_server_is_flagged_and_bad_addresses_and_models_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let status = backend
        .agent_endpoint_save(input("http://192.168.1.20:11434/v1", "m"))
        .await
        .unwrap();
    let info = status.endpoint.unwrap();
    assert!(info.remote && info.insecure);
    let hosted = backend
        .agent_endpoint_save(input("https://api.example.com/v1", "m"))
        .await
        .unwrap()
        .endpoint
        .unwrap();
    assert!(hosted.remote && !hosted.insecure);
    for bad in [
        "ftp://x/v1",
        "http://user:secret@host/v1",
        "javascript:alert(1)",
        "not a url",
        "http://host/v1?key=1",
        "",
    ] {
        let err = backend
            .agent_endpoint_save(input(bad, "m"))
            .await
            .unwrap_err()
            .to_string();
        assert!(!err.contains("secret"), "{bad}: {err}");
        assert!(
            backend.agent_endpoint_models(input(bad, "")).await.is_err(),
            "{bad}"
        );
        assert!(
            backend.agent_endpoint_test(input(bad, "m")).await.is_err(),
            "{bad}"
        );
    }
    for bad in ["", "   ", "a\nb"] {
        assert!(
            backend
                .agent_endpoint_save(input("http://127.0.0.1:1/v1", bad))
                .await
                .is_err(),
            "{bad:?}"
        );
    }
    // The failed saves changed nothing.
    assert_eq!(
        backend.agent_status().await.endpoint.unwrap().base_url,
        "https://api.example.com/v1"
    );
}

#[tokio::test]
async fn a_server_has_no_sign_in() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let err = backend
        .agent_login(AgentProvider::Openai)
        .await
        .unwrap_err()
        .to_string();
    assert!(err.contains("no sign-in"), "{err}");
}

#[tokio::test]
async fn a_request_runs_the_tool_loop_and_the_window_answers_each_call() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let fake = Fake::start().await;
    backend
        .agent_endpoint_save(input(&fake.base, "llama3.2"))
        .await
        .unwrap();
    fake.queue(calls(&[(
        "c1",
        "set_generation_settings",
        json!({"positivePrompt": "a blue sky"}),
    )]));
    fake.queue(says("<thoughts>- blue</thoughts>Done."));
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
    }));
    let reply = backend.agent_chat(request()).await.unwrap();
    assert_eq!(reply.text, "Done.");
    let calls = seen.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].tool, "set_generation_settings");
    assert_eq!(calls[0].args, json!({"positivePrompt": "a blue sky"}));
    assert!(!calls[0].read_gated);
    // The model got the window's text back.
    let second = &fake.chats()[1].body;
    assert_eq!(
        second["messages"].as_array().unwrap().last().unwrap()["content"],
        "prompt set"
    );
}

#[tokio::test]
async fn a_model_without_tools_is_recorded_refused_and_cleared_by_choosing_another() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let fake = Fake::start().await;
    backend
        .agent_endpoint_save(input(&fake.base, "gemma:2b"))
        .await
        .unwrap();
    fake.queue(no_tools("gemma:2b"));
    let err = backend.agent_chat(request()).await.unwrap_err().to_string();
    assert!(
        err.contains("cannot use the app's tools") && err.contains("does not support tools"),
        "{err}"
    );
    let info = backend.agent_status().await.endpoint.unwrap();
    assert_eq!(info.tools, AgentToolsState::Unsupported);
    assert!(info
        .tools_reason
        .unwrap()
        .contains("does not support tools"));
    // The next send fails at once, without asking the server again.
    let before = fake.chats().len();
    let err = backend.agent_chat(request()).await.unwrap_err().to_string();
    assert!(err.contains("cannot use the app's tools"), "{err}");
    assert_eq!(fake.chats().len(), before);
    // Saving the same server and model again keeps the record; another model clears it.
    let same = backend
        .agent_endpoint_save(input(&fake.base, "gemma:2b"))
        .await
        .unwrap();
    assert_eq!(same.endpoint.unwrap().tools, AgentToolsState::Unsupported);
    let other = backend
        .agent_endpoint_save(input(&fake.base, "qwen3:8b"))
        .await
        .unwrap();
    assert_eq!(other.endpoint.unwrap().tools, AgentToolsState::Unknown);
}

#[tokio::test]
async fn test_connection_keeps_its_tools_verdict_for_the_saved_server_only() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let fake = Fake::start().await;
    backend
        .agent_endpoint_save(input(&fake.base, "qwen3:8b"))
        .await
        .unwrap();
    // A test of another model does not touch the saved record.
    fake.queue(no_tools("gemma:2b"));
    let other = backend
        .agent_endpoint_test(input(&fake.base, "gemma:2b"))
        .await
        .unwrap();
    assert_eq!(other.tools, AgentToolsState::Unsupported);
    assert_eq!(
        backend.agent_status().await.endpoint.unwrap().tools,
        AgentToolsState::Unknown
    );
    // A test of the saved model is kept and shown in the status.
    fake.queue(calls(&[("t", "get_screen", json!({}))]));
    fake.queue(says("generate"));
    let ok = backend
        .agent_endpoint_test(input(&fake.base, "qwen3:8b"))
        .await
        .unwrap();
    assert_eq!(ok.tools, AgentToolsState::Supported);
    assert_eq!(
        backend.agent_status().await.endpoint.unwrap().tools,
        AgentToolsState::Supported
    );
    let models = backend
        .agent_endpoint_models(input(&fake.base, ""))
        .await
        .unwrap();
    assert_eq!(models, ["llama3.2:latest", "qwen3:8b"]);
}

#[cfg(windows)]
#[tokio::test]
async fn the_key_is_stored_apart_sent_as_a_header_kept_for_the_same_address_and_dropped_for_another(
) {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let fake = Fake::start().await;
    let secret = "sk-test-secret-value";
    let mut with_key = input(&fake.base, "m");
    with_key.api_key = Some(secret.into());
    let status = backend.agent_endpoint_save(with_key).await.unwrap();
    assert!(status.endpoint.unwrap().has_key);
    // Neither the settings file nor the status carries the key; the secret file is not plain text.
    let settings = std::fs::read_to_string(dir.path().join("agent.json")).unwrap();
    assert!(!settings.contains(secret), "{settings}");
    let sealed = std::fs::read(dir.path().join("secrets").join("assistant-endpoint.key")).unwrap();
    assert!(!String::from_utf8_lossy(&sealed).contains(secret));
    // Saving without a key field keeps it, and the model list call uses it.
    backend
        .agent_endpoint_save(input(&fake.base, "m2"))
        .await
        .unwrap();
    backend
        .agent_endpoint_models(input(&fake.base, ""))
        .await
        .unwrap();
    assert_eq!(
        fake.seen().last().unwrap().authorization.as_deref(),
        Some(format!("Bearer {secret}").as_str())
    );
    // Another address never gets the saved key.
    let other = Fake::start().await;
    backend
        .agent_endpoint_models(input(&other.base, ""))
        .await
        .unwrap();
    assert_eq!(other.seen()[0].authorization, None);
    let moved = backend
        .agent_endpoint_save(input(&other.base, "m"))
        .await
        .unwrap();
    assert!(!moved.endpoint.unwrap().has_key);
    // An empty key removes it.
    let mut again = input(&fake.base, "m");
    again.api_key = Some(secret.into());
    backend.agent_endpoint_save(again).await.unwrap();
    let mut remove = input(&fake.base, "m");
    remove.api_key = Some(String::new());
    let gone = backend.agent_endpoint_save(remove).await.unwrap();
    assert!(!gone.endpoint.unwrap().has_key);
}

#[tokio::test]
async fn an_attached_picture_goes_to_the_server_as_a_jpeg_data_url_scaled_down() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let picture = backend
        .upload_image(png(2000, 1000), novira_core::types::ImageOptions::default())
        .await
        .unwrap();
    let fake = Fake::start().await;
    backend
        .agent_endpoint_save(input(&fake.base, "llava"))
        .await
        .unwrap();
    fake.queue(says("A prompt."));
    let mut request = request();
    request.images = vec![picture.name.clone()];
    assert_eq!(backend.agent_chat(request).await.unwrap().text, "A prompt.");
    let body = &fake.chats()[0].body;
    let content = body["messages"].as_array().unwrap().last().unwrap()["content"]
        .as_array()
        .unwrap()
        .clone();
    assert!(content[0]["text"]
        .as_str()
        .unwrap()
        .starts_with("make it blue"));
    let url = content[1]["image_url"]["url"].as_str().unwrap();
    let data = url.strip_prefix("data:image/jpeg;base64,").unwrap();
    use base64::Engine;
    let jpeg = base64::engine::general_purpose::STANDARD
        .decode(data)
        .unwrap();
    let sent = image::load_from_memory(&jpeg).unwrap();
    assert_eq!((sent.width(), sent.height()), (1568, 784));
}
