//! A model-based property test of the model packs: random sequences of installing a pack, deleting or putting back
//! one of its files, the download server answering or refusing, and a restart, on a backend whose downloads come from a
//! fake site on this PC. After an install ends and after a restart, the status must be what the files on disk say.
//! Run: `cargo test -p novira-core --test prop_packs`.
mod fake_site;
mod prop_common;

use fake_site::{site, Route};
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::packs::{self, PackKind, PackStatus};
use novira_core::types::BackendEvent;
use novira_core::voice::QwenVoice;
use novira_core::{Backend, BackendConfig, Settings};
use prop_common::check_up_to;
use proptest::prelude::*;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

struct NoEngine;

#[async_trait::async_trait]
impl Engine for NoEngine {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Ok(EngineOutput::Nothing)
    }
}

type Events = Arc<Mutex<Vec<BackendEvent>>>;

fn open(dir: &Path) -> (Backend, Events) {
    site();
    let voice = Arc::new(QwenVoice::new(
        dir.to_path_buf(),
        dir.join("models"),
        None,
        None,
    ));
    let backend = Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        Arc::new(NoEngine),
        voice,
        (None, None),
    )
    .unwrap();
    let events: Events = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    (backend, events)
}

/// The packs whose files all come from Hugging Face and each sit in their own folder.
const KINDS: [PackKind; 3] = [PackKind::Video, PackKind::Music, PackKind::Logo];

#[derive(Debug, Clone)]
enum Op {
    Install(usize),
    Remove(usize, usize),
    Put(usize, usize),
    Server(bool),
    Restart,
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        4 => (0usize..3).prop_map(Op::Install),
        3 => (0usize..3, 0usize..3).prop_map(|(k, i)| Op::Remove(k, i)),
        2 => (0usize..3, 0usize..3).prop_map(|(k, i)| Op::Put(k, i)),
        2 => any::<bool>().prop_map(Op::Server),
        1 => Just(Op::Restart),
    ]
}

fn serve(ok: bool) {
    for kind in KINDS {
        for f in packs::files(kind) {
            let path = format!("/{}/resolve/main/{}", f.repo, f.path);
            site().put(
                &path,
                if ok {
                    Route::bytes("downloaded")
                } else {
                    Route::status(404)
                },
            );
        }
    }
}

fn file(models: &Path, kind: PackKind, i: usize) -> std::path::PathBuf {
    let list = packs::files(kind);
    packs::file_path(models, kind, &list[i % list.len()])
}

fn all_present(models: &Path, kind: PackKind) -> bool {
    packs::files(kind)
        .iter()
        .all(|f| packs::file_path(models, kind, f).is_file())
}

fn terminal_events(events: &Events, kind: PackKind) -> usize {
    events
        .lock()
        .unwrap()
        .iter()
        .filter(|e| matches!(e, BackendEvent::Pack { kind: k, status } if *k == kind && matches!(status, PackStatus::Ready | PackStatus::Error { .. })))
        .count()
}

#[test]
fn a_pack_ends_as_ready_or_failed_exactly_as_its_files_and_the_server_say() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let _guard = rt.enter();
    check_up_to(24, prop::collection::vec(op(), 1..14), |ops| {
        let dir = tempfile::tempdir().unwrap();
        let models = dir.path().join("models");
        let (mut backend, mut events) = open(dir.path());
        let mut server_ok = true;
        serve(true);
        for op in ops {
            match op {
                Op::Server(ok) => {
                    server_ok = ok;
                    serve(ok);
                }
                Op::Remove(k, i) => {
                    let _ = std::fs::remove_file(file(&models, KINDS[k], i));
                }
                Op::Put(k, i) => {
                    let p = file(&models, KINDS[k], i);
                    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
                    std::fs::write(p, b"x").unwrap();
                }
                Op::Restart => {
                    backend.shutdown();
                    drop(backend);
                    (backend, events) = open(dir.path());
                    for kind in KINDS {
                        let want = if all_present(&models, kind) {
                            PackStatus::Ready
                        } else {
                            packs::disk_status(&models, kind)
                        };
                        prop_assert_eq!(backend.pack_status(kind), want);
                    }
                }
                Op::Install(k) => {
                    let kind = KINDS[k];
                    let before = terminal_events(&events, kind);
                    let before_files: Vec<Option<Vec<u8>>> = packs::files(kind)
                        .iter()
                        .map(|f| std::fs::read(packs::file_path(&models, kind, f)).ok())
                        .collect();
                    rt.block_on(backend.install_pack(kind)).unwrap();
                    let started = std::time::Instant::now();
                    while terminal_events(&events, kind) == before {
                        prop_assert!(
                            started.elapsed() < Duration::from_secs(20),
                            "the install never ended"
                        );
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    let ends_ready = before_files.iter().all(Option::is_some) || server_ok;
                    if ends_ready {
                        prop_assert_eq!(backend.pack_status(kind), PackStatus::Ready);
                        prop_assert!(all_present(&models, kind));
                    } else {
                        prop_assert!(
                            matches!(backend.pack_status(kind), PackStatus::Error { .. }),
                            "{:?}",
                            backend.pack_status(kind)
                        );
                    }
                    // A file is either whole under its own name or not there; one that was there is untouched.
                    for (f, was) in packs::files(kind).iter().zip(&before_files) {
                        let now = std::fs::read(packs::file_path(&models, kind, f)).ok();
                        match was {
                            Some(_) => prop_assert_eq!(&now, was),
                            None => {
                                prop_assert!(now.is_none() || now == Some(b"downloaded".to_vec()))
                            }
                        }
                    }
                }
            }
        }
        backend.shutdown();
        Ok(())
    });
}
