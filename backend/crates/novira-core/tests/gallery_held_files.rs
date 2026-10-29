//! The gallery's trash when a picture's file is held open by another program (a viewer, a virus scanner): a picture
//! whose file cannot be moved is not lost. Windows only.
#![cfg(windows)]
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use novira_core::types::*;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// The original of a picture under `outputs/`, wherever the folders put it.
fn original_of(dir: &Path, img: &ImageDTO) -> PathBuf {
    fn find(dir: &Path, file: &str) -> Option<PathBuf> {
        for e in std::fs::read_dir(dir).ok()?.flatten() {
            let p = e.path();
            if p.is_dir() {
                if let Some(f) = find(&p, file) {
                    return Some(f);
                }
            } else if p.file_name().is_some_and(|n| n == file) {
                return Some(p);
            }
        }
        None
    }
    let file = novira_core::media::arrangement::file_name(&img.name, img.created_at);
    find(&dir.join("outputs"), &file)
        .or_else(|| find(&dir.join("outputs"), &img.name))
        .expect("the original")
}

fn hold(path: &Path) -> std::fs::File {
    OpenOptions::new()
        .read(true)
        .share_mode(3) // reads and writes of others are fine; moving or deleting it is not
        .open(path)
        .unwrap()
}

fn listed(b: &novira_core::Backend, name: &str) -> bool {
    b.bootstrap().images.iter().any(|i| i.name == name)
}

#[tokio::test]
async fn a_picture_whose_file_is_held_stays_in_the_gallery_when_it_is_deleted() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let img = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let file = original_of(dir.path(), &img);
    let held = hold(&file);
    let result = backend.delete_images(std::slice::from_ref(&img.name));
    assert!(
        result.is_err(),
        "the deletion that could not move the file must say so"
    );
    assert!(file.is_file());
    assert!(
        listed(&backend, &img.name),
        "the picture left the gallery with its file in place"
    );
    drop(held);
    // Once the file is free, the same deletion works.
    backend
        .delete_images(std::slice::from_ref(&img.name))
        .unwrap();
    assert!(!listed(&backend, &img.name));
    assert!(dir.path().join("trash").join(&img.name).is_file());
}

#[tokio::test]
async fn a_trashed_picture_whose_file_is_held_stays_in_the_trash_when_it_is_restored() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let img = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    backend
        .delete_images(std::slice::from_ref(&img.name))
        .unwrap();
    let trashed = dir.path().join("trash").join(&img.name);
    assert!(trashed.is_file());
    let held = hold(&trashed);
    let back = backend
        .restore_images(std::slice::from_ref(&img.name))
        .unwrap();
    assert!(
        back.is_empty(),
        "the picture cannot be back while its file cannot move"
    );
    assert!(trashed.is_file());
    drop(held);
    // It is still in the trash, so the restore works once the file is free.
    let back = backend
        .restore_images(std::slice::from_ref(&img.name))
        .unwrap();
    assert_eq!(back.len(), 1, "the picture was lost from the trash");
    assert!(listed(&backend, &img.name));
}
