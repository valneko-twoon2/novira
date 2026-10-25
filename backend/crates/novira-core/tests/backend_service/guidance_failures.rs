//! Guidance that is refused when it is queued or that fails when the job runs: reference images with a picture or model
//! missing or a span that runs backwards, a model key nobody knows, and pictures deleted after the job was queued.
use super::common::*;
use novira_core::types::*;
use std::sync::Arc;

fn reference(url: &str, model_key: &str, begin_end: [f64; 2]) -> RefImageInput {
    RefImageInput {
        image_url: url.into(),
        model_key: model_key.into(),
        clip_vision_model: ClipVisionModel::VitH,
        weight: 0.6,
        begin_end,
        method: RefImageMethod::Style,
        region_image_url: None,
    }
}

fn control(url: &str, model_key: &str) -> ControlLayerInput {
    ControlLayerInput {
        image_url: url.into(),
        model_key: model_key.into(),
        weight: 0.5,
        begin_end: [0.0, 1.0],
        control_mode: ControlMode::Balanced,
        control_type: None,
    }
}

#[tokio::test]
async fn reference_images_with_a_missing_picture_or_model_or_a_backwards_span_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let stored = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    for bad in [
        reference("", "ipa", [0.0, 1.0]),
        reference(&stored.url, " ", [0.0, 1.0]),
        reference(&stored.url, "ipa", [0.8, 0.2]),
    ] {
        let mut req = request("m", "x", 1);
        req.params.ref_image_count = Some(1);
        req.guidance.ref_images = vec![bad];
        assert!(backend.enqueue(req).is_err());
    }
    assert!(backend.queue_snapshot().items.is_empty());
    backend.shutdown();
}

#[tokio::test]
async fn guidance_that_names_unknown_models_or_deleted_pictures_fails_the_job_with_a_reason() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let main = main_key(&backend);
    let picture = |b: &novira_core::Backend| {
        let b = b.clone();
        async move {
            b.upload_image(png(8, 8), ImageOptions::default())
                .await
                .unwrap()
        }
    };
    // Queue four jobs first, then let the worker see them: a control layer with an unknown model, and a mask, a control
    // picture and a reference picture that were deleted from the gallery in between.
    let (known, mask, control_picture, reference_picture) = (
        picture(&backend).await,
        picture(&backend).await,
        picture(&backend).await,
        picture(&backend).await,
    );
    let mut unknown_model = request(&main, "x", 1);
    unknown_model.params.control_layer_count = Some(1);
    unknown_model.guidance.control_layers = vec![control(&known.url, "no-such-model")];
    backend.enqueue(unknown_model).unwrap();

    let mut gone_mask = request(&main, "x", 1);
    gone_mask.params.generation_mode = GenerationMode::Inpaint;
    gone_mask.init_image_url = Some(known.url.clone());
    gone_mask.guidance.mask_image_url = Some(mask.url.clone());
    backend.enqueue(gone_mask).unwrap();

    let mut gone_control = request(&main, "x", 1);
    gone_control.params.control_layer_count = Some(1);
    gone_control.guidance.control_layers = vec![control(&control_picture.url, "no-such-model")];
    backend.enqueue(gone_control).unwrap();

    let mut gone_reference = request(&main, "x", 1);
    gone_reference.params.ref_image_count = Some(1);
    gone_reference.guidance.ref_images = vec![reference(
        &reference_picture.url,
        "no-such-model",
        [0.0, 1.0],
    )];
    backend.enqueue(gone_reference).unwrap();

    backend
        .delete_images(&[mask.name, control_picture.name, reference_picture.name])
        .unwrap();
    tokio::spawn(backend.clone().run_worker());
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; 4]).await;
    let errors: Vec<String> = backend
        .queue_snapshot()
        .items
        .into_iter()
        .map(|q| q.error.unwrap())
        .collect();
    assert!(errors[0].contains("model not found"), "{errors:?}");
    assert!(errors[1].contains("picture was deleted"), "{errors:?}");
    backend.shutdown();
}
