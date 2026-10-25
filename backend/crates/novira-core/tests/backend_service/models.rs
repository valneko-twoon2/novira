//! Models in user folders and installing local files.
use super::common::*;
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::path::Path;
use std::sync::Arc;

#[tokio::test]
async fn models_in_user_folders_are_hidden_not_deleted() {
    let dir = tempfile::tempdir().unwrap();
    let user_root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(user_root.path().join("Lora")).unwrap();
    let user_file = user_root.path().join("Lora").join("mine.safetensors");
    std::fs::write(&user_file, b"x").unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let config = |d: &Path| BackendConfig {
        data_dir: d.to_path_buf(),
        image_url_base: BASE.into(),
        settings: Settings {
            gpu_lock: String::new(),
            model_roots: vec![user_root.path().to_path_buf()],
            ..Settings::default()
        },
    };
    let backend =
        Backend::open_with_engine(config(dir.path()), Arc::new(FakeEngine::default())).unwrap();
    let models = backend.bootstrap().models;
    let mine = models
        .iter()
        .find(|m| m.path.ends_with("mine.safetensors"))
        .unwrap()
        .clone();
    let owned = models
        .iter()
        .find(|m| m.path.ends_with("detail-xl.safetensors"))
        .unwrap()
        .clone();
    backend.delete_model(&mine.key).unwrap();
    backend.delete_model(&owned.key).unwrap();
    assert!(user_file.exists(), "the user's file stays");
    assert!(
        !Path::new(&owned.path).exists(),
        "novira's own copy is removed"
    );
    let scanned = backend
        .scan_folder(&user_root.path().to_string_lossy())
        .await
        .unwrap();
    assert_eq!(scanned.len(), 1);
    assert!(!scanned[0].installed);
    drop(backend);
    let backend =
        Backend::open_with_engine(config(dir.path()), Arc::new(FakeEngine::default())).unwrap();
    assert!(
        backend.bootstrap().models.iter().all(|m| m.key != mine.key),
        "hidden models stay hidden"
    );
    let yaml = std::fs::read_to_string(dir.path().join("extra_model_paths.yaml")).unwrap();
    assert!(yaml.contains("Lora"));
}

#[tokio::test]
async fn installing_a_local_file_links_it_into_the_models_folder() {
    let dir = tempfile::tempdir().unwrap();
    let src_dir = tempfile::tempdir().unwrap();
    let src = src_dir.path().join("style.safetensors");
    let header =
        br#"{"lora_te2_x.lora_up.weight":{"dtype":"F16","shape":[1],"data_offsets":[0,2]}}"#;
    let mut bytes = (header.len() as u64).to_le_bytes().to_vec();
    bytes.extend_from_slice(header);
    bytes.extend_from_slice(&[0, 0]);
    std::fs::write(&src, bytes).unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let job = backend.install_model(&src.to_string_lossy(), None).unwrap();
    assert_eq!(job.status, ModelInstallStatus::Waiting);
    wait_until(|| {
        events
            .lock()
            .unwrap()
            .iter()
            .any(|e| matches!(e, BackendEvent::ModelAdded { .. }))
    })
    .await;
    let model = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.source == src.to_string_lossy())
        .unwrap();
    assert_eq!((model.kind, model.base), (ModelType::Lora, BaseModel::Sdxl));
    assert!(dir
        .path()
        .join("models")
        .join("loras")
        .join("style.safetensors")
        .exists());
    // A second install of the same file name is refused.
    backend.install_model(&src.to_string_lossy(), None).unwrap();
    wait_until(|| events.lock().unwrap().iter().any(|e| matches!(e, BackendEvent::ModelInstall { job } if job.status == ModelInstallStatus::Error))).await;
    assert!(backend.install_model("Lykon/dreamshaper-8", None).is_err());
}

#[tokio::test]
async fn the_lora_base_check_runs_once_and_then_keeps_the_users_choice() {
    let dir = tempfile::tempdir().unwrap();
    let loras = dir.path().join("models").join("loras");
    std::fs::create_dir_all(&loras).unwrap();
    // An Anima LoRA whose trainer wrote the SD 1.5 architecture into its metadata.
    let header = br#"{"__metadata__":{"modelspec.architecture":"stable-diffusion-v1/lora"},"lora_unet_blocks_0_adaln_modulation_self_attn_1.lora_down.weight":{"dtype":"F16","shape":[1],"data_offsets":[0,2]}}"#;
    let mut bytes = (header.len() as u64).to_le_bytes().to_vec();
    bytes.extend_from_slice(header);
    bytes.extend_from_slice(&[0, 0]);
    std::fs::write(loras.join("anima-style.safetensors"), bytes).unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let lora = backend.bootstrap().models[0].clone();
    assert_eq!(lora.base, BaseModel::Anima);
    // The user moves it to SD 1.5 by hand: the next starts do not check it again.
    backend
        .update_model(&lora.key, serde_json::json!({ "base": "sd-1" }))
        .unwrap();
    drop(backend);
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(backend.bootstrap().models[0].base, BaseModel::Sd1);
}
