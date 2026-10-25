//! The assistant's Wikipedia look-up against a fake `ja.wikipedia.org` / `en.wikipedia.org`: what is asked, what
//! comes back, and what is refused (too big an answer, a wrong shape, an error status, a redirect to another host). One
//! test, because the fake site and its route are shared by the whole binary.
mod fake_site;

use fake_site::{site, Route};
use novira_core::agent::reference::{lookup, MAX_EXTRACT_CHARS, MAX_RESULTS};
use serde_json::json;

const API: &str = "/w/api.php";

fn pages(n: usize) -> serde_json::Value {
    let list: Vec<_> = (1..=n)
        .map(|i| json!({"pageid": i, "title": format!("Article {i}"), "index": i, "extract": format!("About {i}. {}", "x".repeat(4000))}))
        .collect();
    json!({"batchcomplete": true, "query": {"pages": list}})
}

#[tokio::test]
async fn the_lookup_asks_one_fixed_address_and_refuses_what_is_wrong() {
    let site = site();

    // A normal answer: cut to three entries of at most 1500 characters, with article addresses.
    site.put_json(API, &pages(5));
    let hits = lookup("ja", "a&b#c d\r\nHost: evil.example").await.unwrap();
    assert_eq!(hits.len(), MAX_RESULTS);
    assert!(hits[0].extract.chars().count() <= MAX_EXTRACT_CHARS);
    assert!(hits[0].url.ends_with("/wiki/Article_1"), "{}", hits[0].url);
    let seen = site.requests(API);
    assert_eq!(seen.len(), 1);
    let target = &seen[0].target;
    // The words are one encoded parameter: no separator, fragment or line break of theirs survives.
    assert!(
        target.contains("gsrsearch=a%26b%23c+d+Host%3A+evil.example"),
        "{target}"
    );
    assert!(!target.contains('#') && !target.contains('\n'));
    assert_eq!(target.matches("action=").count(), 1);
    assert!(seen[0].authorization.is_none());

    // Nothing leaves for a language or a query that is not allowed.
    for bad in [
        ("fr", "x"),
        ("JA", "x"),
        ("ja.wikipedia.org", "x"),
        ("ja", ""),
        ("ja", " \n "),
    ] {
        assert!(lookup(bad.0, bad.1).await.is_err(), "{bad:?}");
    }
    assert!(lookup("en", &"x".repeat(101)).await.is_err());
    assert_eq!(site.requests(API).len(), 1);

    // No match is an empty list.
    site.put_json(API, &json!({"batchcomplete": true}));
    assert!(lookup("en", "zzzz").await.unwrap().is_empty());

    // A wrong shape, a refusal of the API, and an error status are errors with a sentence.
    for body in [
        "not json",
        "[]",
        r#"{"query":{"pages":"x"}}"#,
        r#"{"error":{"code":"x"}}"#,
    ] {
        site.put(API, Route::bytes(body));
        assert!(lookup("en", "x").await.is_err(), "{body}");
    }
    site.put(API, Route::status(500));
    let err = lookup("en", "x").await.unwrap_err();
    assert!(err.contains("500"), "{err}");

    // An answer past the size cap is refused, whether announced or only sent.
    site.put(API, Route::bytes(vec![b' '; 2 * 1024 * 1024]));
    assert!(lookup("en", "x").await.unwrap_err().contains("large"));
    site.put(
        API,
        Route::bytes(r#"{"batchcomplete":true}"#).announcing(5_000_000),
    );
    assert!(lookup("en", "x").await.is_err());

    // A redirect inside the same address is followed; one to another host is not (and nothing is asked there).
    site.put(
        API,
        Route::status(302).with_header("Location", "/w/moved.php"),
    );
    site.put_json("/w/moved.php", &pages(1));
    assert_eq!(lookup("en", "x").await.unwrap().len(), 1);
    assert_eq!(site.requests("/w/moved.php").len(), 1);
    let port = site.base.rsplit(':').next().unwrap();
    for away in [
        format!("http://localhost:{port}/w/moved.php"),
        "https://evil.example/w/api.php".to_string(),
        "http://127.0.0.1:1/".to_string(),
    ] {
        site.put(API, Route::status(302).with_header("Location", &away));
        let err = lookup("en", "x").await.unwrap_err();
        assert!(err.contains("302"), "{away}: {err}");
    }
    assert_eq!(site.requests("/w/moved.php").len(), 1);

    // A redirect loop ends instead of running on.
    site.put(API, Route::status(302).with_header("Location", API));
    assert!(lookup("en", "x").await.is_err());
}
