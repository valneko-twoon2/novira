//! The assistant's status always carries the saved server, whichever provider is chosen: the Settings screen shows it
//! beside the provider. The tool of the chosen provider is a fake that is not asked anything here (it is not installed).
use novira_core::agent::{
    save_endpoint, save_provider, status, AgentProvider, AgentToolsState, EndpointConfig,
};

fn saved_server() -> EndpointConfig {
    EndpointConfig {
        base_url: "http://127.0.0.1:1/v1".into(),
        model: "local-model".into(),
        tools: AgentToolsState::default(),
        tools_reason: None,
    }
}

#[tokio::test]
async fn the_saved_server_is_reported_with_every_provider() {
    let dir = tempfile::tempdir().unwrap();
    save_endpoint(dir.path(), saved_server()).unwrap();
    // A server as the provider: ready, and its details are there.
    save_provider(dir.path(), AgentProvider::Openai).unwrap();
    let s = status(dir.path(), None).await;
    assert!(s.installed && s.logged_in);
    assert_eq!(s.endpoint.as_ref().map(|e| e.model.as_str()), Some("local-model"));
    // A command line tool as the provider (here one that does not exist): the server is still reported.
    save_provider(dir.path(), AgentProvider::Claude).unwrap();
    let missing = dir.path().join("no-such-tool.exe");
    let s = status(dir.path(), Some(&missing)).await;
    assert_eq!(s.provider, Some(AgentProvider::Claude));
    assert_eq!(s.endpoint.as_ref().map(|e| e.model.as_str()), Some("local-model"));
    // A data folder where no provider was ever saved still reports the server.
    let other = tempfile::tempdir().unwrap();
    save_endpoint(other.path(), saved_server()).unwrap();
    let s = status(other.path(), None).await;
    assert_eq!(s.endpoint.as_ref().map(|e| e.base_url.as_str()), Some("http://127.0.0.1:1/v1"));
}
