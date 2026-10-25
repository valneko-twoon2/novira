//! The service's wiring that the larger flows leave out: engine status changes reaching the event stream, the model
//! folders it scans, and shutting down with a finished model download on the list.
mod fake_site;

use fake_site::{site, Route};
use novira_core::engine::{
    Engine, EngineError, EngineJob, EngineOutput, EngineStatus, ProgressFn, StatusSink,
};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// An engine that keeps the status sink it is given, so the test can report a change as the engine would.
#[derive(Default)]
struct Reporting {
    sink: Mutex<Option<StatusSink>>,
}

#[async_trait::async_trait]
impl Engine for Reporting {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Err(EngineError::Failed("no generation in this test".into()))
    }

    fn set_status_sink(&self, sink: StatusSink) {
        *self.sink.lock().unwrap() = Some(sink);
    }
}

fn open(dir: &std::path::Path, engine: Arc<Reporting>) -> (Backend, Arc<Mutex<Vec<BackendEvent>>>) {
    site();
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        engine,
    )
    .unwrap();
    let events: Arc<Mutex<Vec<BackendEvent>>> = Arc::default();
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    (backend, events)
}

#[tokio::test]
async fn engine_status_changes_reach_the_event_stream() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(Reporting::default());
    let (_backend, events) = open(dir.path(), engine.clone());
    let sink = engine
        .sink
        .lock()
        .unwrap()
        .clone()
        .expect("the service sets a sink");
    sink(EngineStatus::Starting);
    assert!(events.lock().unwrap().iter().any(|e| matches!(
        e,
        BackendEvent::EngineStatus {
            status: EngineStatus::Starting
        }
    )));
}

#[tokio::test]
async fn the_model_folders_are_listed_and_shutdown_copes_with_a_finished_download() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(Reporting::default()));
    assert!(backend.model_roots().iter().any(|r| r.ends_with("models")));

    site().put("/dl/shutdown-demo.bin", Route::bytes(vec![0u8; 16]));
    let url = format!("{}/dl/shutdown-demo.bin", site().base);
    let job = backend.install_model(&url, None).unwrap();
    for _ in 0..250 {
        let done = events.lock().unwrap().iter().any(|e| {
            matches!(e, BackendEvent::ModelInstall { job: j }
                if j.id == job.id && matches!(j.status, ModelInstallStatus::Completed | ModelInstallStatus::Error | ModelInstallStatus::Cancelled))
        });
        if done {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    backend.shutdown();
}
