//! Low-memory mode: the `lowMemoryMode` setting and the ComfyUI restart that applies it.
use super::*;
use std::sync::atomic::Ordering;

impl Backend {
    pub fn low_memory_mode(&self) -> LowMemoryMode {
        let enabled = self.inner.low_memory.load(Ordering::SeqCst);
        LowMemoryMode {
            enabled,
            owned_engine: self.inner.low_memory_owned,
            pending_restart: self.inner.engine.low_memory_pending(),
        }
    }

    /// Saves the setting and restarts the engine to apply it, unless a job is running or the engine is not running
    /// yet: then it applies when the engine starts next (`pendingRestart` says which).
    pub async fn set_low_memory_mode(&self, enabled: bool) -> Result<LowMemoryMode> {
        crate::settings::Settings::save_key(
            &self.inner.data_dir,
            "lowMemoryMode",
            Value::Bool(enabled),
        )
        .map_err(BackendError::Internal)?;
        self.inner.low_memory.store(enabled, Ordering::SeqCst);
        self.inner.engine.set_low_memory(enabled);
        let busy = self
            .state()
            .queue
            .iter()
            .any(|q| q.status == QueueItemStatus::InProgress);
        if self.inner.engine.low_memory_pending() && !busy {
            crate::applog::info(
                "engine",
                format!("restarting ComfyUI for low-memory mode {}", on_off(enabled)),
            );
            self.inner
                .engine
                .restart(&self.inner.shutdown)
                .await
                .map_err(|e| BackendError::Internal(e.to_string()))?;
        }
        Ok(self.low_memory_mode())
    }
}

fn on_off(enabled: bool) -> &'static str {
    if enabled {
        "on"
    } else {
        "off"
    }
}
