//! The agent tools when none is installed: the search path holds nothing, so finding, status and sign-in report that the
//! tool is missing. This test changes `PATH` for its whole process, so it is the only test in this file.
use novira_core::agent::{find_exe, login, status_of, AgentProvider};

#[tokio::test]
async fn without_the_tool_on_the_path_status_and_sign_in_say_it_is_not_installed() {
    let empty = tempfile::tempdir().unwrap();
    std::env::set_var("PATH", empty.path());
    for (provider, exe) in [
        (AgentProvider::Claude, "claude"),
        (AgentProvider::Codex, "codex"),
    ] {
        assert_eq!(find_exe(exe), None);
        let status = status_of(provider, None).await;
        assert!(!status.installed && !status.logged_in);
        let err = login(provider, None).await.unwrap_err();
        assert!(err.contains("is not installed on this PC"), "{err}");
        assert!(err.contains(exe), "{err}");
    }
}
