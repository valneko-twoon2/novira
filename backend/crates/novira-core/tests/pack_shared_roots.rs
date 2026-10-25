//! Model packs kept in a shared model folder (the `modelRoots` setting): they are found there, ComfyUI is told about them, and
//! nothing is ever written, moved or deleted in that folder. Nothing here touches the network.
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::packs::{self, PackKind, PackStatus};
use novira_core::voice::{model_dir, site_dir, QwenVoice, CUSTOM_VOICE, VOICE_DESIGN};
use novira_core::{Backend, BackendConfig, Settings};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

struct Idle;

#[async_trait::async_trait]
impl Engine for Idle {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Ok(EngineOutput::Nothing)
    }

    async fn restart(&self, _cancel: &CancellationToken) -> Result<(), EngineError> {
        Ok(())
    }
}

/// A backend in `data` whose `modelRoots` is `shared`; the voice engine reads the same roots, as `Backend::open` sets it up.
fn open(data: &Path, shared: &Path) -> Backend {
    let voice = QwenVoice::new(data.to_path_buf(), data.join("models"), None, None)
        .with_read_roots(vec![shared.to_path_buf()]);
    Backend::open_with_engines(
        BackendConfig {
            data_dir: data.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                model_roots: vec![shared.to_path_buf()],
                ..Settings::default()
            },
        },
        Arc::new(Idle),
        Arc::new(voice),
        (None, None),
    )
    .unwrap()
}

fn write_all(root: &Path, kind: PackKind) {
    for f in packs::files(kind) {
        let p = packs::file_path(root, kind, f);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(&p, b"x").unwrap();
    }
}

fn walk(dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for e in std::fs::read_dir(dir).unwrap().flatten() {
        out.push(e.path());
        if e.path().is_dir() {
            out.extend(walk(&e.path()));
        }
    }
    out.sort();
    out
}

#[tokio::test]
async fn packs_in_a_shared_root_are_ready_and_comfy_is_told_where_they_are() {
    let data = tempfile::tempdir().unwrap();
    let shared = tempfile::tempdir().unwrap();
    write_all(shared.path(), PackKind::Music);
    write_all(shared.path(), PackKind::Logo);
    let before = walk(shared.path());
    let backend = open(data.path(), shared.path());
    let all = backend.packs();
    assert_eq!(all.music, PackStatus::Ready);
    assert_eq!(all.logo, PackStatus::Ready);
    assert!(matches!(all.video, PackStatus::Missing { .. }));
    let yaml = std::fs::read_to_string(data.path().join("extra_model_paths.yaml")).unwrap();
    assert!(
        yaml.contains("novira_music:") && yaml.contains("novira_music_1:"),
        "{yaml}"
    );
    assert!(
        yaml.contains("novira_logo_1:") && !yaml.contains("novira_video_1:"),
        "{yaml}"
    );
    assert!(yaml.contains(&*shared.path().to_string_lossy()), "{yaml}");
    assert_eq!(
        walk(shared.path()),
        before,
        "start-up wrote into the shared root"
    );
}

#[tokio::test]
async fn installing_a_pack_that_is_already_shared_downloads_nothing_and_writes_nothing_there() {
    let data = tempfile::tempdir().unwrap();
    let shared = tempfile::tempdir().unwrap();
    write_all(shared.path(), PackKind::Music);
    let before = walk(shared.path());
    let backend = open(data.path(), shared.path());
    backend.install_pack(PackKind::Music).await.unwrap();
    for _ in 0..200 {
        if backend.pack_status(PackKind::Music) == PackStatus::Ready {
            break;
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
    assert_eq!(backend.pack_status(PackKind::Music), PackStatus::Ready);
    assert_eq!(walk(shared.path()), before);
    // Installs land in the data folder only: no music file was copied there either.
    let own = packs::file_path(
        &data.path().join("models"),
        PackKind::Music,
        &packs::MUSIC_FILES[0],
    );
    assert!(!own.exists());
}

#[tokio::test]
async fn the_voice_pack_is_ready_when_the_libraries_are_local_and_the_models_are_shared() {
    let data = tempfile::tempdir().unwrap();
    let shared = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(site_dir(data.path())).unwrap();
    std::fs::write(site_dir(data.path()).join(".ready"), b"x").unwrap();
    for m in [&CUSTOM_VOICE, &VOICE_DESIGN] {
        std::fs::create_dir_all(model_dir(shared.path(), m)).unwrap();
        std::fs::write(model_dir(shared.path(), m).join(".complete"), b"x").unwrap();
    }
    let backend = open(data.path(), shared.path());
    assert_eq!(backend.pack_status(PackKind::Voice), PackStatus::Ready);
}
