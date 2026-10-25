//! Talks to the real Hugging Face API. Run on purpose: `cargo test -p novira-core --test huggingface_live -- --ignored --nocapture`.
use novira_core::models::civitai::SearchParams;
use novira_core::models::huggingface::search;

fn params(query: &str, cursor: Option<String>) -> SearchParams {
    SearchParams {
        query: query.into(),
        kind: "LoRA".into(),
        base_model: "sdxl-compat".into(),
        sort: "downloads".into(),
        period: "all".into(),
        include_nsfw: false,
        cursor,
        source: "huggingface".into(),
        licenses: Vec::new(),
        checkpoint_type: String::new(),
        safetensors_only: false,
        creator: String::new(),
    }
}

#[tokio::test]
#[ignore = "needs network"]
async fn real_search_returns_downloadable_single_files_and_pages() {
    let http = reqwest::Client::builder()
        .user_agent("novira")
        .build()
        .unwrap();
    let first = search(&http, &params("", None), None).await.unwrap();
    assert!(!first.items.is_empty());
    for m in &first.items {
        assert!(
            m.id.contains('/') && !m.versions[0].files.is_empty(),
            "{}",
            m.id
        );
        assert_eq!(m.source, "huggingface");
    }
    let next = first.next_cursor.clone().expect("a next page");
    let second = search(&http, &params("", Some(next)), None).await.unwrap();
    assert!(second
        .items
        .iter()
        .all(|m| first.items.iter().all(|f| f.id != m.id)));
    println!(
        "{} models; first: {} ({} files)",
        first.items.len(),
        first.items[0].id,
        first.items[0].versions[0].files.len()
    );
}

#[tokio::test]
#[ignore = "needs network"]
async fn adult_models_are_left_out_unless_asked_for() {
    let http = reqwest::Client::builder()
        .user_agent("novira")
        .build()
        .unwrap();
    for query in ["nsfw", "girl", "pony", "anime", "realistic woman"] {
        let mut asked = params(query, None);
        asked.include_nsfw = true;
        let all = search(&http, &asked, None).await.unwrap();
        let safe = search(&http, &params(query, None), None).await.unwrap();
        let hidden: Vec<&str> = all
            .items
            .iter()
            .filter(|m| safe.items.iter().all(|s| s.id != m.id))
            .map(|m| m.id.as_str())
            .collect();
        println!(
            "{query}: shown {} / with adult {} / hidden {hidden:?}",
            safe.items.len(),
            all.items.len()
        );
        println!(
            "  safe: {:?}",
            safe.items.iter().map(|m| m.id.as_str()).collect::<Vec<_>>()
        );
        assert!(safe.items.iter().all(|m| !m.nsfw), "{query}");
    }
}
