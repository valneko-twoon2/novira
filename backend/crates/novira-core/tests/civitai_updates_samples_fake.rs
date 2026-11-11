//! The two Civitai lookups of the Browse tab that go over the wire: the example settings of a version and the check for newer
//! versions of installed models. The address points at a loopback server (debug-only override), so nothing leaves this PC.
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::models::civitai::samples;
use novira_core::models::civitai::updates::{check, Installed};
use serde_json::json;

fn have(key: &str, model: &str, version: &str) -> Installed {
    Installed {
        key: key.into(),
        model_id: model.into(),
        version_id: version.into(),
    }
}

fn model_with_versions(id: u64, versions: serde_json::Value) -> serde_json::Value {
    json!({ "id": id, "name": format!("m{id}"), "modelVersions": versions })
}

fn version(id: u64, base: &str, at: &str) -> serde_json::Value {
    json!({"id": id, "name": format!("v{id}"), "baseModel": base, "publishedAt": at, "availability": "Public"})
}

/// One test, because the answer of a path is shared by everything in this binary that asks for it.
// tags: boundary, condition, error-guessing
#[tokio::test]
async fn the_update_check_asks_civitai_by_id_and_tells_what_is_newer() {
    let http = client();
    let path = "/api/v1/models";

    // Nothing installed: nothing to ask, nothing to report.
    let before = site().requests(path).len();
    assert_eq!(check(&http, &[], None).await.unwrap(), vec![]);
    assert_eq!(site().requests(path).len(), before);

    // An installed model with a newer version of the same base model; ids asked once each, with the key and the adult flag.
    site().put_json(
        path,
        &json!({"items": [model_with_versions(
            9001,
            json!([
                version(2, "SDXL 1.0", "2026-03-01T00:00:00.000Z"),
                version(1, "SDXL 1.0", "2026-01-01T00:00:00.000Z"),
                version(3, "Flux.1 D", "2026-04-01T00:00:00.000Z"),
            ]),
        )]}),
    );
    let found = check(
        &http,
        &[have("b-key", "9001", "1"), have("a-key", "9001", "1")],
        Some("secret-key"),
    )
    .await
    .unwrap();
    assert_eq!(found.len(), 2);
    assert_eq!(found[0].key, "a-key", "sorted by key");
    assert_eq!(found[0].latest_version_id, "2");
    assert_eq!(
        found[0].page_url,
        "https://civitai.com/models/9001?modelVersionId=2"
    );
    let asked = site().requests(path);
    let last = asked.last().unwrap();
    assert!(last.target.contains("ids=9001"));
    assert_eq!(last.target.matches("9001").count(), 1, "one id, asked once");
    assert!(last.target.contains("nsfw=true"));
    assert_eq!(last.authorization.as_deref(), Some("Bearer secret-key"));

    // The newest version already installed: no update.
    assert!(check(&http, &[have("k", "9001", "2")], None)
        .await
        .unwrap()
        .is_empty());

    // More than fifty models are asked about in more than one request.
    let ids: Vec<Installed> = (0..120u64)
        .map(|n| have(&format!("k{n}"), &(7000 + n).to_string(), "1"))
        .collect();
    let before = site().requests(path).len();
    check(&http, &ids, None).await.unwrap();
    assert_eq!(site().requests(path).len() - before, 3);

    // Civitai refusing every request is an error that says so; an answer that is not JSON is one too.
    site().put(path, Route::status(500));
    let err = check(&http, &[have("k", "9001", "1")], None)
        .await
        .unwrap_err();
    assert!(err.contains("500"), "{err}");
    site().put(path, Route::bytes("not json"));
    let err = check(&http, &[have("k", "9001", "1")], None)
        .await
        .unwrap_err();
    assert!(err.contains("Unexpected Civitai response"), "{err}");
}

fn example(id: u64, prompt: &str) -> serde_json::Value {
    json!({
        "id": id,
        "url": format!("https://image.civitai.com/x/{id}/original=true/{id}.jpeg"),
        "type": "image",
        "meta": {"prompt": prompt, "seed": 5, "steps": 20, "cfgScale": 7, "Size": "832x1216", "sampler": "Euler a"},
    })
}

// tags: error-guessing, boundary, condition
#[tokio::test]
async fn the_examples_of_a_version_are_asked_for_with_the_key_and_each_picture_comes_once() {
    // Refused ids first: they make no request.
    let http = client();
    for bad in ["", "12a", "1 2", "../1", &"9".repeat(13)] {
        assert!(
            samples::fetch(&http, bad, false, None).await.is_err(),
            "{bad}"
        );
    }

    let path = "/api/v1/images";
    site().put_json(
        path,
        &json!({"items": [example(1, "a cat"), example(2, "a dog"), example(1, "a cat again"), json!({"id": 3, "url": "https://image.civitai.com/x/3/original=true/3.jpeg", "meta": {}})]}),
    );
    let one = samples::fetch(&http, "5501", false, Some("sample-key"))
        .await
        .unwrap();
    assert_eq!(
        one.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
        ["1", "2"]
    );
    assert_eq!(one[0].width, Some(832));
    let asked = site().requests(path);
    assert!(asked
        .iter()
        .any(|r| r.target.contains("modelVersionId=5501")
            && r.target.contains("nsfw=None")
            && r.authorization.as_deref() == Some("Bearer sample-key")));

    // Adult examples are a second request, and the same picture in both is shown once.
    let before = site().requests(path).len();
    let both = samples::fetch(&http, "5502", true, None).await.unwrap();
    assert_eq!(both.len(), 2);
    let asked = site().requests(path);
    assert_eq!(asked.len() - before, 2);
    assert!(asked[before..]
        .iter()
        .any(|r| r.target.contains("nsfw=true")));

    // A refusal from Civitai is an error that says so, and so is an answer that is not JSON.
    site().put(path, Route::status(500));
    let err = samples::fetch(&http, "5503", false, None)
        .await
        .unwrap_err();
    assert!(err.contains("500"), "{err}");
    site().put(path, Route::bytes("not json"));
    let err = samples::fetch(&http, "5504", false, None)
        .await
        .unwrap_err();
    assert!(err.contains("Unexpected Civitai response"), "{err}");
}
