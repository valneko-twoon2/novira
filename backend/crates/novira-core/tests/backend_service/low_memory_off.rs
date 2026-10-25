//! Switching low-memory mode off again restarts a running engine too.
use super::common::*;
use std::sync::Arc;

#[tokio::test]
async fn low_memory_mode_switched_off_restarts_the_engine_that_runs_with_it() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine {
        running_low_memory: Some(false).into(),
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine.clone());
    backend.set_low_memory_mode(true).await.unwrap();
    assert_eq!(*engine.restarts.lock().unwrap(), 1);
    let mode = backend.set_low_memory_mode(false).await.unwrap();
    assert!(!mode.enabled && !mode.pending_restart);
    assert_eq!(*engine.restarts.lock().unwrap(), 2);
    assert_eq!(*engine.running_low_memory.lock().unwrap(), Some(false));
    backend.shutdown();
}
