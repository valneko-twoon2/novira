//! The gallery at start-up is a summary: `bootstrap` leaves out every picture's metadata and workflow (most of the bytes of a
//! large gallery), and `image_details` gives them back for the pictures a page asks for.
use super::common::*;
use novira_core::media::images;
use novira_core::types::*;
use std::sync::Arc;

/// A picture that carries a prompt, as a generated one does.
async fn generated(backend: &novira_core::Backend, prompt: &str, size: u32) -> ImageDTO {
    let meta = request("m", prompt, 1).params;
    let tagged = images::with_text(
        &png(size, size),
        images::METADATA_KEY,
        &serde_json::to_string(&meta).unwrap(),
    )
    .unwrap();
    backend
        .upload_image(tagged, ImageOptions::default())
        .await
        .unwrap()
}

#[tokio::test]
async fn bootstrap_sends_summaries_and_image_details_gives_the_rest() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let a = generated(&backend, "first prompt", 8).await;
    let b = generated(&backend, "second prompt", 9).await;
    let boot = backend.bootstrap();
    assert!(boot.images_summary);
    assert_eq!(boot.images.len(), 2);
    for s in &boot.images {
        assert!(s.metadata.is_none() && s.workflow.is_none(), "{}", s.name);
    }
    // The summary keeps what the grid shows.
    let listed = boot.images.iter().find(|i| i.name == a.name).unwrap();
    assert_eq!((listed.width, listed.height), (a.width, a.height));
    assert_eq!(listed.created_at, a.created_at);
    assert_eq!(listed.url, a.url);
    assert_eq!(listed.thumbnail_url, a.thumbnail_url);
    assert_eq!(listed.board_id, a.board_id);
    assert_eq!(listed.starred, a.starred);

    let got = backend.image_details(&[b.name.clone(), "nobody.png".into(), a.name.clone()]);
    assert_eq!(got.len(), 2, "a name the gallery does not hold is left out");
    for full in &got {
        let own = if full.name == a.name { &a } else { &b };
        assert_eq!(full, own);
    }
    assert_eq!(
        got.iter()
            .find(|i| i.name == a.name)
            .unwrap()
            .metadata
            .as_ref()
            .unwrap()
            .positive_prompt,
        "first prompt"
    );
    assert!(backend.image_details(&[]).is_empty());
}

#[tokio::test]
async fn image_details_answers_at_most_the_limit() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let a = generated(&backend, "p", 8).await;
    // The names past the limit are not looked at, even if the gallery holds them.
    let mut names = vec!["x.png".to_string(); novira_core::service::MAX_IMAGE_DETAILS];
    names.push(a.name.clone());
    assert!(backend.image_details(&names).is_empty());
    names.truncate(novira_core::service::MAX_IMAGE_DETAILS - 1);
    names.push(a.name.clone());
    assert_eq!(backend.image_details(&names).len(), 1);
}

#[tokio::test]
async fn a_start_up_answer_stays_small_for_a_large_gallery() {
    // The budget: what the screens read at start-up is the grid's fields, not every prompt. 300 pictures with a 1000-character
    // prompt each would weigh over 300 kB with their metadata; the summaries must stay under a third of that.
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let prompt = "a long prompt, ".repeat(70);
    for _ in 0..300 {
        generated(&backend, &prompt, 4).await;
    }
    let boot = backend.bootstrap();
    let summary = serde_json::to_string(&boot.images).unwrap().len();
    let names: Vec<String> = boot.images.iter().map(|i| i.name.clone()).collect();
    let whole = serde_json::to_string(&backend.image_details(&names))
        .unwrap()
        .len();
    assert!(whole > 300_000, "the pictures carry their prompts: {whole}");
    assert!(
        summary * 3 < whole,
        "summaries {summary} bytes, whole pictures {whole} bytes"
    );
}
