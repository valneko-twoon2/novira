//! Fuzz-style tests of the search clients against the loopback fake site (`fake_site`, 127.0.0.1 only): the
//! fake Civitai and Hugging Face answer with any status, any bytes, any JSON and any `Link` header, and the client
//! must return a result or an error within a few seconds and never panic. Nothing leaves this PC: the service
//! addresses are pointed at the loopback server before the first request.
//! Run: `cargo test -p novira-core --test prop_loopback`.
mod fake_site;
mod prop_common;

use fake_site::{site, Route};
use novira_core::models::civitai::{self, SearchParams};
use novira_core::models::huggingface;
use prop_common::{any_text, bytes, check_up_to, json_value};
use proptest::prelude::*;
use std::time::Duration;

fn params(source: &str) -> SearchParams {
    serde_json::from_value(serde_json::json!({
        "query": "x", "kind": "lora", "baseModel": "", "sort": "downloads", "period": "AllTime",
        "includeNsfw": true, "cursor": null, "source": source,
    }))
    .unwrap()
}

/// A body: raw bytes, any text, or any JSON.
fn body() -> impl Strategy<Value = Vec<u8>> {
    prop_oneof![
        bytes(300),
        any_text().prop_map(String::into_bytes),
        json_value().prop_map(|v| serde_json::to_vec(&v).unwrap()),
        json_value().prop_map(|v| serde_json::to_vec(
            &serde_json::json!({ "items": [v.clone(), v], "metadata": {} })
        )
        .unwrap()),
        json_value().prop_map(|v| serde_json::to_vec(
            &serde_json::json!([v.clone(), { "id": "a/b", "siblings": [v], "tags": [] }])
        )
        .unwrap()),
    ]
}

fn status() -> impl Strategy<Value = u16> {
    prop::sample::select(
        &[
            200u16, 200, 200, 201, 204, 301, 400, 401, 404, 429, 500, 503,
        ][..],
    )
}

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
}

fn client() -> reqwest::Client {
    // No redirects: whatever a hostile answer points at is never fetched.
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap()
}

#[test]
fn a_civitai_search_survives_any_answer() {
    let (rt, http) = (runtime(), client());
    site();
    check_up_to(64, (status(), body()), |(status, body)| {
        site().put(
            "/api/v1/models",
            Route {
                status,
                headers: vec![],
                body,
                announced: None,
            },
        );
        let result = rt.block_on(civitai::search(&http, &params("civitai"), None));
        if let Ok(r) = result {
            prop_assert!(r.items.len() <= 1000);
        }
        Ok(())
    });
    // An answer shorter than it announced is an error, not a hang (same route, so in the same test).
    site().put(
        "/api/v1/models",
        Route::bytes(b"{\"items\": [".to_vec()).announcing(5000),
    );
    let started = std::time::Instant::now();
    assert!(rt
        .block_on(civitai::search(&http, &params("civitai"), None))
        .is_err());
    assert!(started.elapsed() < Duration::from_secs(5));
}

#[test]
fn a_hugging_face_search_survives_any_answer_and_any_link_header() {
    let (rt, http) = (runtime(), client());
    site();
    check_up_to(
        64,
        (status(), body(), "[ -~]{0,120}", any::<bool>()),
        |(status, body, link, with_link)| {
            let headers = if with_link {
                vec![("Link".to_string(), link)]
            } else {
                vec![]
            };
            site().put(
                "/api/models",
                Route {
                    status,
                    headers,
                    body,
                    announced: None,
                },
            );
            let result = rt.block_on(huggingface::search(&http, &params("huggingface"), None));
            if let Ok(r) = result {
                prop_assert!(r.items.len() <= 1000);
            }
            // Every request of this test went to the loopback server.
            prop_assert!(site().base.starts_with("http://127.0.0.1:"));
            Ok(())
        },
    );
}
