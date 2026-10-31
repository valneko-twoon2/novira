//! The pack and ComfyUI release look-ups of the service against a fake GitHub: versions, repository info and the
//! checks that refuse a request before any address is called. The addresses point at a loopback server (debug-only
//! override), so nothing leaves this PC.
use super::common::*;
use crate::fake_site::{site, Route};
use novira_core::BackendError;
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
async fn the_versions_and_the_info_of_a_pack_come_from_its_repository() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    site().put_json(
        "/repos/owner/svc-pack/tags",
        &json!([{"name": "v2.0.0"}, {"name": "v1.0.0"}, {"name": "../bad"}]),
    );
    assert_eq!(
        backend
            .node_pack_versions("https://github.com/owner/svc-pack")
            .await
            .unwrap(),
        ["v2.0.0", "v1.0.0"]
    );
    site().put("/repos/owner/svc-pack-err/tags", Route::status(403));
    assert!(matches!(
        backend
            .node_pack_versions("https://github.com/owner/svc-pack-err")
            .await,
        Err(BackendError::Internal(m)) if m.contains("403")
    ));
    site().put_json(
        "/repos/owner/svc-pack",
        &json!({"owner": {"login": "owner"}, "license": {"spdx_id": "MIT"}}),
    );
    let info = backend
        .node_pack_info("https://github.com/owner/svc-pack")
        .await
        .unwrap();
    assert_eq!(info.author, "owner");
    assert_eq!(info.license.as_deref(), Some("MIT"));
    assert!(matches!(
        backend
            .node_pack_info("https://github.com/owner/svc-pack-missing")
            .await,
        Err(BackendError::Internal(_))
    ));
    for bad in ["https://example.com/a/b", "not a url", ""] {
        assert!(matches!(
            backend.node_pack_versions(bad).await,
            Err(BackendError::Invalid(_))
        ));
        assert!(matches!(
            backend.node_pack_info(bad).await,
            Err(BackendError::Invalid(_))
        ));
        assert!(matches!(
            backend.install_node_pack(bad, None).await,
            Err(BackendError::Invalid(_))
        ));
    }
    assert!(matches!(
        backend
            .install_node_pack("https://github.com/owner/svc-pack", Some("../x"))
            .await,
        Err(BackendError::Invalid(m)) if m.contains("Not a version tag")
    ));
}

#[tokio::test]
async fn the_comfyui_releases_are_listed_and_a_bad_version_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    site().put_json(
        "/repos/comfyanonymous/ComfyUI/releases",
        &json!([{"tag_name": "v0.4.0"}, {"tag_name": "v0.3.0"}]),
    );
    let versions = backend.comfy_versions().await.unwrap();
    assert_eq!(versions, ["v0.4.0", "v0.3.0"]);
    assert!(matches!(
        backend.switch_comfy_version("../v0.4.0").await,
        Err(BackendError::Invalid(m)) if m.contains("Not a ComfyUI version")
    ));
    // An engine that novira did not install cannot change its version.
    assert!(matches!(
        backend.switch_comfy_version("v0.4.0").await,
        Err(BackendError::Internal(_))
    ));
}
