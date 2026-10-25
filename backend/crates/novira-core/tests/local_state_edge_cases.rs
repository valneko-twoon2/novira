//! Failure paths of the small local-state modules: the saved secrets, the GPU lock and the lock setting. Folders and
//! files stand in for the things that go wrong (a directory where a file belongs, a file where a folder belongs).
#![cfg(windows)]
use novira_core::gpu_lock::{release_all, try_acquire};
use novira_core::secret::{load_secret, save_secret, Secret};
use novira_core::settings::{Settings, GPU_LOCK_ENV};
use std::path::PathBuf;

// Secrets ---------------------------------------------------------------------------------------------------------

fn secret_file(data: &std::path::Path, name: &str) -> PathBuf {
    data.join("secrets").join(name)
}

#[test]
fn a_secret_that_cannot_be_read_names_the_secret_in_the_error() {
    let data = tempfile::tempdir().unwrap();
    // A directory where the key file belongs: reading it fails with something other than "not found".
    std::fs::create_dir_all(secret_file(data.path(), "civitai.key")).unwrap();
    std::fs::create_dir_all(secret_file(data.path(), "huggingface.key")).unwrap();
    let civitai = load_secret(data.path(), Secret::Civitai).unwrap_err();
    assert!(civitai.contains("Civitai key"), "{civitai}");
    let hf = load_secret(data.path(), Secret::HuggingFace).unwrap_err();
    assert!(hf.contains("Hugging Face token"), "{hf}");
}

#[test]
fn removing_a_secret_that_cannot_be_removed_is_an_error() {
    let data = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(secret_file(data.path(), "assistant-endpoint.key")).unwrap();
    let err = save_secret(data.path(), Secret::AssistantEndpoint, None).unwrap_err();
    assert!(
        err.contains("cannot remove the saved assistant server key"),
        "{err}"
    );
}

#[test]
fn saving_a_secret_where_the_folder_or_file_is_blocked_is_an_error() {
    // The secrets folder cannot be created because a file has its name.
    let blocked = tempfile::tempdir().unwrap();
    std::fs::write(blocked.path().join("secrets"), b"x").unwrap();
    let err = save_secret(blocked.path(), Secret::Civitai, Some("key")).unwrap_err();
    assert!(err.contains("cannot create the secrets folder"), "{err}");
    let err = save_secret(blocked.path(), Secret::AssistantEndpoint, Some("key")).unwrap_err();
    assert!(err.contains("cannot create the secrets folder"), "{err}");

    // The key file cannot be written because a directory has its name.
    let data = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(secret_file(data.path(), "assistant-endpoint.key")).unwrap();
    let err = save_secret(data.path(), Secret::AssistantEndpoint, Some("key")).unwrap_err();
    assert!(
        err.contains("cannot save the assistant server key"),
        "{err}"
    );
}

#[test]
fn a_leftover_that_cannot_be_removed_does_not_stop_a_site_key_from_being_saved() {
    let data = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(secret_file(data.path(), "civitai.key")).unwrap();
    save_secret(data.path(), Secret::Civitai, Some("key")).unwrap();
    assert_eq!(
        load_secret(data.path(), Secret::Civitai)
            .unwrap()
            .as_deref(),
        Some("key")
    );
    save_secret(data.path(), Secret::Civitai, None).unwrap();
}

// GPU lock --------------------------------------------------------------------------------------------------------

#[test]
fn the_lock_cannot_be_taken_inside_a_file() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("file"), b"x").unwrap();
    assert!(try_acquire(&dir.path().join("file").join("gpu.lock")).is_err());
}

#[test]
fn a_lock_name_the_system_refuses_is_an_error_not_a_busy_lock() {
    let dir = tempfile::tempdir().unwrap();
    // `?` is not allowed in a Windows file name, so creating the folder fails for a reason other than "exists".
    assert!(try_acquire(&dir.path().join("gpu?lock")).is_err());
}

#[test]
fn an_owner_record_with_a_reused_process_id_frees_the_lock() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("gpu.lock");
    std::fs::create_dir(&path).unwrap();
    // This very process is alive, but it did not start at the recorded time: the id was reused after the owner died.
    let owner = dir.path().join("gpu.lock.owner");
    std::fs::write(&owner, format!("{} 1", std::process::id())).unwrap();
    let guard = try_acquire(&path).unwrap();
    assert!(guard.is_some());
}

#[test]
fn releasing_everything_removes_the_locks_this_process_holds() {
    let dir = tempfile::tempdir().unwrap();
    let a = dir.path().join("a.lock");
    let b = dir.path().join("b.lock");
    let ga = try_acquire(&a).unwrap().unwrap();
    let gb = try_acquire(&b).unwrap().unwrap();
    release_all();
    assert!(!a.exists() && !b.exists());
    drop((ga, gb));
}

// The lock setting ------------------------------------------------------------------------------------------------

#[test]
fn the_auto_lock_follows_the_environment_variable_and_ignores_an_empty_one() {
    let settings = Settings::default();
    assert_eq!(settings.gpu_lock, "auto");
    std::env::set_var(GPU_LOCK_ENV, "");
    assert_eq!(settings.gpu_lock_path(), None);
    std::env::set_var(GPU_LOCK_ENV, "E:\\locks\\gpu");
    assert_eq!(
        settings.gpu_lock_path(),
        Some(PathBuf::from("E:\\locks\\gpu"))
    );
    std::env::remove_var(GPU_LOCK_ENV);
    assert_eq!(settings.gpu_lock_path(), None);
}

#[test]
fn a_lock_with_an_unreadable_owner_record_is_left_alone() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("gpu.lock");
    std::fs::create_dir(&path).unwrap();
    std::fs::write(dir.path().join("gpu.lock.owner"), "not a record").unwrap();
    assert!(try_acquire(&path).unwrap().is_none());
    assert!(path.is_dir());
}

#[test]
fn a_lock_path_without_a_parent_is_tried_as_it_is() {
    // The drive root has no parent and already exists, so it can never be taken (and is never removed).
    let result = try_acquire(std::path::Path::new("C:\\"));
    assert!(!matches!(result, Ok(Some(_))));
}
