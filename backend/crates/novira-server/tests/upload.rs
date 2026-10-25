//! `POST /upload/image`: a picture posted as bytes, the browser's replacement for the desktop's raw upload body.
mod common;
use common::*;
use novira_server::TOKEN_HEADER;
use serde_json::json;

async fn upload(f: &Fixture, content_type: &str, options: Option<&str>, body: &[u8]) -> Reply {
    let mut headers = vec![
        ("Host", f.host.as_str()),
        (TOKEN_HEADER, f.server.token.as_str()),
        ("Content-Type", content_type),
    ];
    if let Some(options) = options {
        headers.push(("x-novira-options", options));
    }
    send(f.server.addr, "POST", "/upload/image", &headers, body).await
}

#[tokio::test]
async fn a_posted_picture_is_stored_with_its_options_and_served_by_name() {
    let f = Fixture::start().await;
    let options =
        json!({ "boardId": null, "isIntermediate": true, "category": "control" }).to_string();
    let stored = upload(&f, "application/octet-stream", Some(&options), &png()).await;
    assert_eq!(
        stored.status,
        200,
        "{}",
        String::from_utf8_lossy(&stored.body)
    );
    let image = stored.json();
    assert_eq!(image["isIntermediate"], json!(true));
    assert_eq!(image["category"], json!("control"));
    let url = image["url"].as_str().unwrap();
    assert!(url.starts_with("/novira-image/full/"), "{url}");
    assert_eq!(f.get(url, &[]).await.status, 200);
    assert!(f
        .backend
        .bootstrap()
        .images
        .iter()
        .any(|i| i.name == image["name"].as_str().unwrap()));
    // No options is the plain defaults.
    assert_eq!(
        upload(&f, "application/octet-stream", None, &png())
            .await
            .status,
        200
    );
    f.stop().await;
}

#[tokio::test]
async fn an_upload_that_is_not_a_picture_or_not_well_formed_stores_nothing() {
    let f = Fixture::start().await;
    let before = f.backend.bootstrap().images.len();
    // Not an image, empty, and the wrong content type (a form or a plain fetch could send these without a preflight).
    let r = upload(&f, "application/octet-stream", None, b"not a picture").await;
    assert_eq!((r.status, r.json()["code"].clone()), (422, json!("failed")));
    assert_eq!(
        upload(&f, "application/octet-stream", None, b"")
            .await
            .status,
        422
    );
    for content_type in [
        "text/plain",
        "application/json",
        "multipart/form-data",
        "image/png",
    ] {
        let r = upload(&f, content_type, None, &png()).await;
        assert_eq!(r.status, 415, "{content_type}");
    }
    // Options that are not JSON, or the wrong shape.
    for options in [
        "nope",
        "[1]",
        r#"{"category":"nothing"}"#,
        r#"{"boardId":5}"#,
    ] {
        let r = upload(&f, "application/octet-stream", Some(options), &png()).await;
        assert_eq!(r.status, 400, "{options}");
    }
    // The page's cross-site check still applies.
    let headers = [
        ("Host", f.host.as_str()),
        (TOKEN_HEADER, f.server.token.as_str()),
        ("Content-Type", "application/octet-stream"),
        ("Origin", "http://evil.example"),
    ];
    let r = send(f.server.addr, "POST", "/upload/image", &headers, &png()).await;
    assert_eq!(r.status, 403);
    assert_eq!(f.backend.bootstrap().images.len(), before);
    f.stop().await;
}
