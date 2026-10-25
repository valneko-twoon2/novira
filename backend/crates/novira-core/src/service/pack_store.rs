//! Model packs: their status, the download, and cancelling it.
use super::*;
use crate::sync::LockExt;

/// What a pack looks like on disk when the app starts.
/// `roots` are the model folders, the data folder's own first: a pack counts as ready when its files are in any of them.
pub(super) fn initial_status(roots: &[PathBuf], kind: PackKind, data_dir: &Path) -> PackStatus {
    match kind {
        PackKind::Voice => voice::disk_status_in(data_dir, roots),
        _ => packs::disk_status_in(roots, kind),
    }
}

impl Backend {
    pub fn packs(&self) -> packs::Packs {
        packs::Packs {
            video: self.pack_status(PackKind::Video),
            turbo: self.pack_status(PackKind::Turbo),
            music: self.pack_status(PackKind::Music),
            voice: self.pack_status(PackKind::Voice),
            inpaint: self.pack_status(PackKind::Inpaint),
            logo: self.pack_status(PackKind::Logo),
        }
    }

    pub fn pack_status(&self, kind: PackKind) -> PackStatus {
        self.inner.packs.lock_safe()[&kind].clone()
    }

    fn set_pack(&self, kind: PackKind, status: PackStatus) {
        self.inner.packs.lock_safe().insert(kind, status.clone());
        self.emit(BackendEvent::Pack { kind, status });
    }

    /// Downloads a pack in the background; progress arrives as `pack` events.
    ///
    /// `async` on purpose: it spawns a task, which needs the caller to be inside the async runtime (a plain synchronous
    /// Tauri command runs outside it, and spawning there panics).
    pub async fn install_pack(&self, kind: PackKind) -> Result<()> {
        let token = {
            let mut running = self.inner.pack_cancel.lock_safe();
            if running.contains_key(&kind) {
                return Ok(());
            }
            let token = self.inner.shutdown.child_token();
            running.insert(kind, token.clone());
            token
        };
        let this = self.clone();
        tokio::spawn(async move {
            let sink = this.clone();
            let report = move |s: PackStatus| sink.set_pack(kind, s);
            let result = match kind {
                PackKind::Voice => {
                    let python = voice::resolve_python(
                        this.inner.voice_python.0.as_deref(),
                        this.inner.voice_python.1.as_deref(),
                    );
                    voice::install(
                        &this.inner.http,
                        &this.inner.data_dir,
                        &this.inner.models_dir,
                        python.as_deref(),
                        this.hf_token().as_deref(),
                        &token,
                        &report,
                    )
                    .await
                }
                _ => {
                    packs::install_files_in(
                        &this.inner.http,
                        &this.inner.models_dir,
                        &this.inner.roots,
                        kind,
                        &token,
                        &report,
                    )
                    .await
                }
            };
            this.inner.pack_cancel.lock_safe().remove(&kind);
            match result {
                Ok(()) => this.set_pack(kind, PackStatus::Ready),
                Err(m) if m == "cancelled" => this.set_pack(kind, this.disk_status_of(kind)),
                Err(message) => this.set_pack(kind, PackStatus::Error { message }),
            }
        });
        Ok(())
    }

    fn disk_status_of(&self, kind: PackKind) -> PackStatus {
        initial_status(&self.inner.roots, kind, &self.inner.data_dir)
    }

    pub fn cancel_pack(&self, kind: PackKind) {
        if let Some(t) = self.inner.pack_cancel.lock_safe().get(&kind) {
            t.cancel();
        }
    }
}
