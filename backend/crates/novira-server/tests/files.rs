//! Pictures by name and the files of the built frontend: what is served and what is refused.
mod common;
use common::*;
use novira_server::{IMAGE_URL_BASE, TOKEN_HEADER};

// tags: equivalence, condition
#[tokio::test]
async fn pictures_are_served_by_name_only() {
    let f = Fixture::start().await;
    let img = f
        .backend
        .upload_image(png(), Default::default())
        .await
        .unwrap();
    assert!(
        img.url.starts_with(&format!("{IMAGE_URL_BASE}/full/")),
        "{}",
        img.url
    );
    let full = f.get(&img.url, &[]).await;
    assert_eq!(
        (full.status, full.header("content-type")),
        (200, Some("image/png"))
    );
    assert_eq!(&full.body[..4], b"\x89PNG");
    assert_eq!(f.get(&img.thumbnail_url, &[]).await.status, 200);
    let piece = f.get(&img.url, &[("Range", "bytes=0-3")]).await;
    assert_eq!((piece.status, piece.body.len()), (206, 4));
    assert_eq!(
        f.get(&img.url, &[("Range", "bytes=99999-")]).await.status,
        416
    );
    // Names that are not stored pictures, and every spelling of a way out of the folder.
    let stored = img.name.as_str();
    for bad in [
        "/novira-image/full/novira.sqlite".to_string(),
        "/novira-image/full/..%2Fnovira.sqlite".to_string(),
        "/novira-image/full/..%2F..%2Fnovira.sqlite".to_string(),
        "/novira-image/full/..%5Cnovira.sqlite".to_string(),
        "/novira-image/full/%2e%2e%2fnovira.sqlite".to_string(),
        "/novira-image/full/..".to_string(),
        "/novira-image/full/notes.txt".to_string(),
        "/novira-image/full/x.png.exe".to_string(),
        "/novira-image/full/nul.png".to_string(),
        "/novira-image/full/missing.png".to_string(),
        format!("/novira-image/other/{stored}"),
        format!("/novira-image/thumb/{stored}/x"),
        format!("/novira-image/%2e%2e/full/{stored}"),
        format!("/novira-image/full/{stored}%00.png"),
        "/novira-image/full/".to_string(),
        "/novira-image/full".to_string(),
        "/novira-image".to_string(),
    ] {
        let r = f.get(&bad, &[]).await;
        assert!(matches!(r.status, 404 | 405), "{bad} gave {}", r.status);
        assert!(
            !r.body.starts_with(b"\x89PNG") && !r.body.starts_with(b"SQLite"),
            "{bad} leaked a file"
        );
    }
    // Pictures are read-only.
    let headers = [
        ("Host", f.host.as_str()),
        (TOKEN_HEADER, f.server.token.as_str()),
    ];
    assert_eq!(
        send(f.server.addr, "POST", &img.url, &headers, b"")
            .await
            .status,
        405
    );
    f.stop().await;
}

// tags: condition
#[tokio::test]
async fn a_frontend_file_the_browser_already_has_is_not_sent_again() {
    let f = Fixture::start().await;
    let first = f.get("/assets/app.js", &[]).await;
    assert_eq!(first.status, 200);
    let tag = first.header("etag").expect("a validator").to_string();
    assert_eq!(first.header("cache-control"), Some("no-cache"));
    // The browser asks with the tag it has: no body comes back.
    for asked in [
        tag.clone(),
        format!("W/{tag}"),
        format!("\"other\", {tag}"),
        "*".into(),
    ] {
        let again = f.get("/assets/app.js", &[("If-None-Match", &asked)]).await;
        assert_eq!((again.status, again.body.len()), (304, 0), "{asked}");
        assert_eq!(again.header("etag"), Some(tag.as_str()));
    }
    // Another tag, or a file changed by a new build, is sent whole with its new tag.
    let other = f
        .get("/assets/app.js", &[("If-None-Match", "\"other\"")])
        .await;
    assert_eq!(
        (other.status, other.body.as_slice()),
        (200, &b"console.log(1)"[..])
    );
    std::fs::write(f.dist().join("assets").join("app.js"), "console.log(22)").unwrap();
    let rebuilt = f.get("/assets/app.js", &[("If-None-Match", &tag)]).await;
    assert_eq!(
        (rebuilt.status, rebuilt.body.as_slice()),
        (200, &b"console.log(22)"[..])
    );
    assert_ne!(rebuilt.header("etag"), Some(tag.as_str()));
    // The tag is no credential: without the token the file is refused as before.
    let anonymous = send(
        f.server.addr,
        "GET",
        "/assets/app.js",
        &[("Host", f.host.as_str()), ("If-None-Match", &tag)],
        b"",
    )
    .await;
    assert_eq!(anonymous.status, 401);
    f.stop().await;
}

// tags: error-guessing
#[tokio::test]
async fn only_files_of_the_frontend_folder_are_served() {
    let f = Fixture::start().await;
    let js = f.get("/assets/app.js", &[]).await;
    assert_eq!(
        (js.status, js.header("content-type")),
        (200, Some("text/javascript; charset=utf-8"))
    );
    assert_eq!(js.body, b"console.log(1)");
    for bad in [
        "/../secret.txt",
        "/%2e%2e/secret.txt",
        "/%2E%2E%2Fsecret.txt",
        "/..%5Csecret.txt",
        "/assets/../../secret.txt",
        "/assets/%2e%2e/%2e%2e/secret.txt",
        "/assets/data.bin",
        "/assets",
        "/assets/",
        "/missing.js",
        "//secret.txt",
        "/C:/Windows/win.ini",
        "/assets/app.js%00.png",
        "/novira.lock",
    ] {
        let r = f.get(bad, &[]).await;
        assert_eq!(r.status, 404, "{bad}");
        assert_ne!(r.body, b"secret");
    }
    let headers = [
        ("Host", f.host.as_str()),
        (TOKEN_HEADER, f.server.token.as_str()),
    ];
    assert_eq!(
        send(f.server.addr, "POST", "/assets/app.js", &headers, b"")
            .await
            .status,
        405
    );
    assert_eq!(
        send(f.server.addr, "DELETE", "/assets/app.js", &headers, b"")
            .await
            .status,
        405
    );
    f.stop().await;
}
