//! `POST /export/images`: an export for sharing comes back as a download, the browser's replacement for the desktop's
//! folder dialog.
mod common;
use common::*;
use novira_server::{EXPORT_RESULT_HEADER, TOKEN_HEADER};
use serde_json::{json, Value};
use std::io::Read;

async fn export(f: &Fixture, content_type: &str, body: &str) -> Reply {
    let headers = [
        ("Host", f.host.as_str()),
        (TOKEN_HEADER, f.server.token.as_str()),
        ("Content-Type", content_type),
    ];
    send(
        f.server.addr,
        "POST",
        "/export/images",
        &headers,
        body.as_bytes(),
    )
    .await
}

fn request(names: &[&str], format: &str) -> String {
    json!({
        "names": names,
        "options": { "format": format, "quality": 90, "maxSide": null, "removeInfo": true, "watermark": false },
    })
    .to_string()
}

async fn stored(f: &Fixture) -> String {
    f.backend
        .upload_image(png(), Default::default())
        .await
        .unwrap()
        .name
}

fn result(reply: &Reply) -> Value {
    serde_json::from_str(
        reply
            .header(EXPORT_RESULT_HEADER)
            .expect("the result header"),
    )
    .unwrap()
}

#[tokio::test]
async fn one_picture_downloads_as_itself_and_several_as_a_zip() {
    let f = Fixture::start().await;
    let a = stored(&f).await;
    let b = stored(&f).await;

    let one = export(&f, "application/json", &request(&[&a], "jpeg")).await;
    assert_eq!(one.status, 200, "{}", String::from_utf8_lossy(&one.body));
    assert_eq!(one.header("content-type"), Some("image/jpeg"));
    let stem = a.trim_end_matches(".png");
    assert_eq!(
        one.header("content-disposition"),
        Some(format!("attachment; filename=\"{stem}.jpg\"").as_str())
    );
    assert_eq!(
        image::guess_format(&one.body).unwrap(),
        image::ImageFormat::Jpeg
    );
    assert_eq!(
        result(&one),
        json!({ "count": 1, "skipped": 0, "watermarked": 0, "folder": "" })
    );

    // A missing name is skipped and counted; the two pictures come back in one zip.
    let several = export(
        &f,
        "application/json",
        &request(&[&a, &b, "gone.png"], "png"),
    )
    .await;
    assert_eq!(several.status, 200);
    assert_eq!(several.header("content-type"), Some("application/zip"));
    let disposition = several.header("content-disposition").unwrap();
    assert!(
        disposition.starts_with("attachment; filename=\"novira-export-")
            && disposition.ends_with(".zip\""),
        "{disposition}"
    );
    assert_eq!(result(&several)["count"], json!(2));
    assert_eq!(result(&several)["skipped"], json!(1));
    let mut zip = zip_entries(&several.body);
    zip.sort();
    let mut expected = vec![a.clone(), b.clone()];
    expected.sort();
    assert_eq!(zip, expected);
    f.stop().await;
}

fn zip_entries(bytes: &[u8]) -> Vec<String> {
    // Stored entries: read the names from the central directory by hand, so the test needs no zip crate.
    let mut names = Vec::new();
    let mut pos = 0;
    while let Some(at) = bytes[pos..]
        .windows(4)
        .position(|w| w == [0x50, 0x4b, 0x01, 0x02])
    {
        let start = pos + at;
        let len = u16::from_le_bytes([bytes[start + 28], bytes[start + 29]]) as usize;
        let mut name = String::new();
        (&bytes[start + 46..start + 46 + len])
            .read_to_string(&mut name)
            .unwrap();
        names.push(name);
        pos = start + 46 + len;
    }
    names
}

#[tokio::test]
async fn a_bad_export_request_writes_nothing_and_says_why() {
    let f = Fixture::start().await;
    let a = stored(&f).await;
    // The wrong content type (a cross-site form could send it without a preflight), bad JSON, the wrong shape.
    for content_type in [
        "text/plain",
        "application/x-www-form-urlencoded",
        "multipart/form-data",
    ] {
        let r = export(&f, content_type, &request(&[&a], "png")).await;
        assert_eq!(r.status, 415, "{content_type}");
    }
    for body in [
        "{",
        "[]",
        r#"{"names":["a.png"]}"#,
        r#"{"names":"a.png","options":{}}"#,
    ] {
        let r = export(&f, "application/json", body).await;
        assert_eq!(
            (r.status, r.json()["code"].clone()),
            (400, json!("bad_arguments")),
            "{body}"
        );
    }
    // The backend's own checks: a name that escapes, no names, quality out of range, nothing that can be read.
    for body in [
        request(&["../secret.png"], "png"),
        request(&[], "png"),
        json!({ "names": [a], "options": { "format": "jpeg", "quality": 0, "maxSide": null, "removeInfo": true } })
            .to_string(),
        request(&["gone.png"], "png"),
    ] {
        let r = export(&f, "application/json", &body).await;
        assert_eq!(
            (r.status, r.json()["code"].clone()),
            (422, json!("failed")),
            "{body}"
        );
    }
    // Another site cannot ask for a download.
    let headers = [
        ("Host", f.host.as_str()),
        (TOKEN_HEADER, f.server.token.as_str()),
        ("Content-Type", "application/json"),
        ("Origin", "http://evil.example"),
    ];
    let body = request(&[&a], "png");
    let r = send(
        f.server.addr,
        "POST",
        "/export/images",
        &headers,
        body.as_bytes(),
    )
    .await;
    assert_eq!(r.status, 403);
    f.stop().await;
}
