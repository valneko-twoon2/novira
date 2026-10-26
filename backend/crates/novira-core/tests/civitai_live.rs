//! Talks to the real Civitai API. Run on purpose: `cargo test -p novira-core --test civitai_live -- --ignored --nocapture`.
use novira_core::models::civitai::{search, SearchParams};

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
