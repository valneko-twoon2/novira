use super::*;
use serde_json::json;

fn version(id: u64, base: &str, at: &str) -> Value {
    json!({"id": id, "name": format!("v{id}"), "baseModel": base, "publishedAt": at, "availability": "Public"})
}

fn have(key: &str, model: &str, version: &str) -> Installed {
    Installed {
        key: key.into(),
        model_id: model.into(),
        version_id: version.into(),
    }
}

// tags: condition
#[test]
fn a_page_address_gives_the_model_and_the_version() {
    assert_eq!(
        ids_of_page("https://civitai.com/models/4384?modelVersionId=128713"),
        Some(("4384".into(), "128713".into()))
    );
    assert_eq!(
        ids_of_page("https://civitai.com/models/4384?modelVersionId=128713&x=1"),
        Some(("4384".into(), "128713".into()))
    );
}

// tags: condition
#[test]
fn an_address_that_is_not_a_versioned_civitai_page_gives_nothing() {
    for bad in [
        "https://civitai.com/models/4384",
        "https://civitai.com/models/4384?modelVersionId=",
        "https://civitai.com/models/abc?modelVersionId=1",
        "https://civitai.com/models/4384?modelVersionId=1a",
        "https://civitai.com.evil.example/models/4384?modelVersionId=1",
        "http://civitai.com/models/4384?modelVersionId=1",
        "https://huggingface.co/owner/repo",
        "",
    ] {
        assert_eq!(ids_of_page(bad), None, "{bad:?}");
    }
}

// tags: condition
#[test]
fn a_newer_version_of_the_same_base_model_is_an_update() {
    let body = json!({"items": [{"id": 10, "modelVersions": [
        version(3, "SDXL 1.0", "2025-03-01T00:00:00.000Z"),
        version(2, "SDXL 1.0", "2025-02-01T00:00:00.000Z"),
        version(1, "SDXL 1.0", "2025-01-01T00:00:00.000Z"),
    ]}]});
    let found = updates_in(&body, &[have("k", "10", "1")]);
    assert_eq!(found.len(), 1);
    assert_eq!(
        (
            found[0].latest_version_id.as_str(),
            found[0].latest_name.as_str()
        ),
        ("3", "v3")
    );
    assert_eq!(
        found[0].page_url,
        "https://civitai.com/models/10?modelVersionId=3"
    );
    assert_eq!(found[0].key, "k");
    assert_eq!(found[0].installed_version_id, "1");
}

// tags: condition
#[test]
fn the_newest_version_installed_is_not_an_update() {
    let body = json!({"items": [{"id": 10, "modelVersions": [
        version(3, "SDXL 1.0", "2025-03-01T00:00:00.000Z"),
        version(1, "SDXL 1.0", "2025-01-01T00:00:00.000Z"),
    ]}]});
    assert!(updates_in(&body, &[have("k", "10", "3")]).is_empty());
}

// tags: condition
#[test]
fn a_newer_version_of_another_base_model_is_not_an_update() {
    // An SDXL version installed, and a newer Flux version on the same page.
    let body = json!({"items": [{"id": 10, "modelVersions": [
        version(3, "Flux.1 D", "2025-03-01T00:00:00.000Z"),
        version(1, "SDXL 1.0", "2025-01-01T00:00:00.000Z"),
    ]}]});
    assert!(updates_in(&body, &[have("k", "10", "1")]).is_empty());
}

// tags: condition
#[test]
fn a_version_behind_payment_or_not_public_is_not_offered() {
    let mut paid = version(4, "SDXL 1.0", "2025-04-01T00:00:00.000Z");
    paid["paidAccess"] = json!({"endsAt": "2026-01-01T00:00:00.000Z"});
    let mut early = version(5, "SDXL 1.0", "2025-05-01T00:00:00.000Z");
    early["availability"] = json!("EarlyAccess");
    let body = json!({"items": [{"id": 10, "modelVersions": [early, paid, version(2, "SDXL 1.0", "2025-02-01T00:00:00.000Z"), version(1, "SDXL 1.0", "2025-01-01T00:00:00.000Z")]}]});
    let found = updates_in(&body, &[have("k", "10", "1")]);
    assert_eq!(found[0].latest_version_id, "2");
}

// tags: decision-table
#[test]
fn the_newest_by_date_wins_whatever_the_order_of_the_list() {
    let body = json!({"items": [{"id": 10, "modelVersions": [
        version(1, "SDXL 1.0", "2025-01-01T00:00:00.000Z"),
        version(3, "SDXL 1.0", "2025-03-01T00:00:00.000Z"),
        version(2, "SDXL 1.0", "2025-02-01T00:00:00.000Z"),
    ]}]});
    assert_eq!(
        updates_in(&body, &[have("k", "10", "1")])[0].latest_version_id,
        "3"
    );
}

// tags: scenario
#[test]
fn an_installed_version_that_civitai_no_longer_lists_is_left_alone() {
    let body = json!({"items": [{"id": 10, "modelVersions": [version(3, "SDXL 1.0", "2025-03-01T00:00:00.000Z")]}]});
    assert!(updates_in(&body, &[have("k", "10", "99")]).is_empty());
}

// tags: equivalence
#[test]
fn two_installed_versions_of_one_model_are_each_checked() {
    let body = json!({"items": [{"id": 10, "modelVersions": [
        version(4, "Illustrious", "2025-04-01T00:00:00.000Z"),
        version(3, "SDXL 1.0", "2025-03-01T00:00:00.000Z"),
        version(2, "Illustrious", "2025-02-01T00:00:00.000Z"),
        version(1, "SDXL 1.0", "2025-01-01T00:00:00.000Z"),
    ]}]});
    let found = updates_in(
        &body,
        &[
            have("a", "10", "2"),
            have("b", "10", "1"),
            have("c", "10", "4"),
        ],
    );
    let pairs: Vec<_> = found
        .iter()
        .map(|u| (u.key.as_str(), u.latest_version_id.as_str()))
        .collect();
    assert_eq!(pairs, [("a", "4"), ("b", "3")]);
}

// tags: error-guessing
#[test]
fn an_answer_without_items_or_with_odd_entries_gives_nothing() {
    assert!(updates_in(&json!({}), &[have("k", "10", "1")]).is_empty());
    assert!(updates_in(
        &json!({"items": [{"id": "x"}, {"id": 10}, {"id": 10, "modelVersions": [{"id": 1}]}]}),
        &[have("k", "10", "1")]
    )
    .is_empty());
}
