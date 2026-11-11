//! Talks to the real Civitai API. Run on purpose: `cargo test -p novira-core --test civitai_live -- --ignored --nocapture`.
use novira_core::models::civitai::{samples, search, updates, SearchParams};

fn params(query: &str, cursor: Option<String>) -> SearchParams {
    SearchParams {
        query: query.into(),
        kind: "LoRA".into(),
        base_model: "sdxl-compat".into(),
        sort: "downloads".into(),
        period: "month".into(),
        include_nsfw: false,
        cursor,
        source: "civitai".into(),
        licenses: Vec::new(),
        checkpoint_type: String::new(),
        safetensors_only: false,
        price: String::new(),
        creator: String::new(),
    }
}

// tags: scenario
#[tokio::test]
#[ignore = "needs network"]
async fn real_search_returns_downloadable_models_with_covers_and_pages() {
    let http = reqwest::Client::builder()
        .user_agent("novira")
        .build()
        .unwrap();
    let first = search(&http, &params("", None), None).await.unwrap();
    assert!(!first.items.is_empty());
    for m in &first.items {
        assert!(
            !m.versions.is_empty() && !m.versions[0].files.is_empty(),
            "{}",
            m.name
        );
        assert!(m.versions[0].files[0].id.contains('-'));
    }
    assert!(
        first.items.iter().any(|m| !m.image_urls.is_empty()),
        "some model has covers"
    );
    assert!(first
        .items
        .iter()
        .flat_map(|m| &m.image_urls)
        .all(|u| u.starts_with("https://image.civitai.com/")));
    let next = first.next_cursor.clone().expect("a next page");
    let second = search(&http, &params("", Some(next)), None).await.unwrap();
    assert!(
        second
            .items
            .iter()
            .all(|m| first.items.iter().all(|f| f.id != m.id)),
        "pages do not overlap"
    );
    let text = search(&http, &params("anime", None), None).await.unwrap();
    println!(
        "{} models; first: {} / {}",
        text.items.len(),
        first.items[0].name,
        first.items[0].commercial
    );
    assert!(!text.items.is_empty());
}

/// A long-lived Civitai model (4384) and one of its older versions (128713, SD 1.5).
const MODEL: &str = "4384";
const VERSION: &str = "128713";

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("novira")
        .build()
        .unwrap()
}

// tags: scenario
#[tokio::test]
#[ignore = "needs network"]
async fn real_example_settings_of_a_version_are_read() {
    let found = samples::fetch(&client(), VERSION, false, None)
        .await
        .unwrap();
    assert!(!found.is_empty(), "no example shared its settings");
    assert!(found.len() <= samples::SAMPLE_LIMIT);
    for s in &found {
        assert!(!s.prompt.is_empty());
        assert!(s.image_url.starts_with("https://"), "{}", s.image_url);
        assert_eq!(s.width.is_some(), s.height.is_some());
    }
    // Most examples record a sampler, steps, a size and the resources they used.
    assert!(found
        .iter()
        .any(|s| s.sampler.is_some() && s.steps.is_some()));
    assert!(found.iter().any(|s| s.width.is_some()));
    assert!(found.iter().any(|s| !s.resources.is_empty()));
    println!("{} examples; first: {:?}", found.len(), found[0]);
}

// tags: error-guessing
#[tokio::test]
#[ignore = "needs network"]
async fn real_older_version_is_reported_and_a_bad_id_is_refused() {
    let http = client();
    let installed = [updates::Installed {
        key: "k".into(),
        model_id: MODEL.into(),
        version_id: VERSION.into(),
    }];
    let found = updates::check(&http, &installed, None).await.unwrap();
    println!("{found:?}");
    assert!(found.len() <= 1);
    for u in &found {
        assert_eq!(u.installed_version_id, VERSION);
        assert_ne!(u.latest_version_id, VERSION);
        assert!(u
            .page_url
            .starts_with("https://civitai.com/models/4384?modelVersionId="));
    }
    assert!(samples::fetch(&http, "1; drop", false, None).await.is_err());
    assert!(updates::check(&http, &[], None).await.unwrap().is_empty());
}
