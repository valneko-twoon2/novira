//! Guidance checks added after mutation testing (cargo-mutants, `scripts\mutation.bat`): a video or sound is not a picture for
//! a mask or control layer, and the base model a ControlNet must fit is the one of the job's own main model.
use super::common::*;
use novira_core::types::*;
use std::sync::Arc;

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

fn key_of(b: &novira_core::Backend, file_part: &str) -> String {
    b.bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.contains(file_part))
        .unwrap_or_else(|| panic!("no model {file_part}"))
        .key
}

#[tokio::test]
async fn a_video_or_a_sound_is_not_accepted_as_a_mask_or_a_control_picture() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let main = main_key(&backend);
    let picture = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    // The queue only checks that the name is a valid gallery name; the worker refuses what is not a picture.
    let other = |ext: &str| {
        picture
            .url
            .replace(&picture.name, &format!("some-file.{ext}"))
    };
    for ext in ["mp4", "wav"] {
        let mut req = request(&main, "x", 1);
        req.params.generation_mode = GenerationMode::Inpaint;
        req.init_image_url = Some(picture.url.clone());
        req.guidance.mask_image_url = Some(other(ext));
        backend.enqueue(req).unwrap();
    }
    tokio::spawn(backend.clone().run_worker());
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; 2]).await;
    for item in backend.queue_snapshot().items {
        let error = item.error.unwrap();
        assert!(error.contains("not a stored picture"), "{error}");
    }
    backend.shutdown();
}

#[tokio::test]
async fn a_controlnet_must_fit_the_base_of_the_jobs_own_main_model() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    // An SD 1.5 main model and one SDXL ControlNet: the only other model has a base that does not fit the main one.
    for (folder, file) in [
        ("checkpoints", "sd15_base.safetensors"),
        ("controlnet", "union-xl.safetensors"),
    ] {
        std::fs::create_dir_all(models.join(folder)).unwrap();
        std::fs::write(models.join(folder).join(file), b"x").unwrap();
    }
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let picture = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let mut req = request(&key_of(&backend, "sd15_base"), "x", 1);
    req.params.control_layer_count = Some(1);
    req.guidance.control_layers = vec![control(&picture.url, &key_of(&backend, "union-xl"))];
    backend.enqueue(req).unwrap();
    tokio::spawn(backend.clone().run_worker());
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let error = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(error.contains("is for sdxl models"), "{error}");
    assert!(error.contains("the main model is sd-1"), "{error}");
    backend.shutdown();
}
