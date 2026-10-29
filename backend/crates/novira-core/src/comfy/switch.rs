//! Changing the version of the ComfyUI novira installed: the release package replaces the old one, the pack folders move
//! over, and every pack is installed again because the Python libraries it needs lived in the old package. The old
//! package is kept until the new one answers, and put back when it does not. The same switch, to the same version,
//! changes the package (nvidia or amd) when the settings name another one (`change_package`).
use super::client::ComfyEngine;
use super::install;
use super::node_packs;
use crate::applog;
use crate::engine::{EngineError, EngineStatus};
use crate::packs::PackStatus;
use std::sync::atomic::Ordering;
use tokio_util::sync::CancellationToken;

impl ComfyEngine {
    /// Installs the package the settings name in place of the one this ComfyUI was installed from, with the same ComfyUI
    /// version. Called at start, instead of starting, when the install's record names another package.
    pub(super) async fn change_package(
        &self,
        cancel: &CancellationToken,
    ) -> Result<(), EngineError> {
        let Some((root, _)) = &self.installer else {
            return Ok(());
        };
        let Some(tag) = install::installed_version_tag(root) else {
            return Err(EngineError::Failed(
                "The ComfyUI version of the install cannot be read, so its package cannot be changed"
                    .into(),
            ));
        };
        let data_dir = root.parent().unwrap_or(root);
        self.switching_package.store(true, Ordering::SeqCst);
        let result = self.switch_to(&tag, data_dir, cancel, &|_, _| {}).await;
        self.switching_package.store(false, Ordering::SeqCst);
        for folder in result? {
            applog::warn(
                "comfy",
                format!("extension {folder} could not be installed for the new ComfyUI package"),
            );
        }
        Ok(())
    }

    pub(super) async fn switch_to(
        &self,
        tag: &str,
        data_dir: &std::path::Path,
        cancel: &CancellationToken,
        on_pack: &(dyn Fn(String, PackStatus) + Send + Sync),
    ) -> Result<Vec<String>, EngineError> {
        if !node_packs::valid_tag(tag) {
            return Err(EngineError::Failed(format!("Not a ComfyUI version: {tag}")));
        }
        let (Some((root, package)), Some(process)) = (&self.installer, &self.process) else {
            return Err(EngineError::Failed(
                "This ComfyUI was not installed by novira, so its version cannot be changed here"
                    .into(),
            ));
        };
        {
            // Not while another caller is starting it.
            let _guard = self.start_lock.lock().await;
            process.stop();
            let result = install::install_version(
                &self.http,
                root,
                package,
                Some(tag),
                true,
                cancel,
                &|s| self.set_status(s),
            )
            .await;
            if let Err(e) = result {
                drop(_guard);
                // The old package is still (or again) in place: bring it back up.
                let _ = self.ensure_ready(cancel).await;
                return Err(e);
            }
        }

        // The libraries of every pack novira installed went with the old package.
        let comfy = install::comfyui_dir(root);
        let python = process.python();
        let mut failed = Vec::new();
        for pack in node_packs::list(&node_packs::custom_nodes_dir(&comfy)) {
            let Some(url) = pack.url.clone() else {
                continue;
            };
            let Ok(repo) = node_packs::parse_github(&url) else {
                continue;
            };
            let result = node_packs::install_version(
                &self.http,
                &repo,
                pack.version.as_deref(),
                &comfy,
                &python,
                data_dir,
                cancel,
                &|s| on_pack(url.clone(), s),
            )
            .await;
            match result {
                Ok(_) => on_pack(url.clone(), PackStatus::Ready),
                Err(m) if m == "cancelled" => {
                    install::restore_previous(root).ok();
                    return Err(EngineError::Cancelled);
                }
                Err(message) => {
                    on_pack(url.clone(), PackStatus::Error { message });
                    failed.push(pack.folder);
                }
            }
        }

        self.set_status(EngineStatus::Starting);
        match self.ensure_ready(cancel).await {
            Ok(()) => {
                install::discard_previous(root);
                Ok(failed)
            }
            Err(EngineError::Cancelled) => Err(EngineError::Cancelled),
            Err(e) => {
                // The new version does not start: go back to the old one.
                process.stop();
                if install::restore_previous(root).is_ok() {
                    let _ = self.ensure_ready(cancel).await;
                    return Err(EngineError::Failed(format!(
                        "ComfyUI {tag} did not start, so the old version was put back: {e}"
                    )));
                }
                Err(e)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use std::time::Duration;

    /// An engine that novira did not install: it has no install folder and no process.
    fn engine_not_installed_by_novira() -> ComfyEngine {
        ComfyEngine::new("http://127.0.0.1:8188", None, Duration::from_secs(1)).unwrap()
    }

    #[tokio::test]
    async fn a_version_that_is_not_a_tag_is_refused_before_anything_moves() {
        let err = engine_not_installed_by_novira()
            .switch_to("../v0.3.0", Path::new("."), &CancellationToken::new(), &|_, _| {})
            .await
            .unwrap_err();
        assert!(matches!(err, EngineError::Failed(m) if m.contains("Not a ComfyUI version")));
    }

    #[tokio::test]
    async fn a_comfyui_that_novira_did_not_install_cannot_change_its_version_here() {
        let err = engine_not_installed_by_novira()
            .switch_to("v0.3.0", Path::new("."), &CancellationToken::new(), &|_, _| {})
            .await
            .unwrap_err();
        assert!(matches!(err, EngineError::Failed(m) if m.contains("not installed by novira")));
    }

    #[tokio::test]
    async fn changing_the_package_of_an_install_that_is_not_there_does_nothing() {
        let result = engine_not_installed_by_novira()
            .change_package(&CancellationToken::new())
            .await;
        assert!(result.is_ok());
    }
}
