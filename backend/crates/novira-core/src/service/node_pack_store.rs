//! Custom node packs of the ComfyUI novira runs: the list, installing one in the background, removing one, and
//! restarting ComfyUI so it loads them.
use super::*;
use crate::comfy::node_packs;
use crate::sync::LockExt;
use std::sync::atomic::Ordering;

impl Backend {
    /// ComfyUI's folder and its Python, when novira knows them (its own copy, or a configured folder).
    fn comfy_install(&self) -> Option<(PathBuf, PathBuf)> {
        let dir = self.inner.voice_python.1.clone()?;
        let python = voice::resolve_python(self.inner.voice_python.0.as_deref(), Some(&dir))?;
        Some((dir, python))
    }

    pub fn node_packs(&self) -> NodePacks {
        let dir = self.comfy_install().map(|(d, _)| d);
        NodePacks {
            available: dir.is_some(),
            installed: dir
                .as_ref()
                .map(|d| node_packs::list(&node_packs::custom_nodes_dir(d)))
                .unwrap_or_default(),
            comfy_version: dir.as_deref().and_then(node_packs::comfyui_version),
            restart_needed: self.inner.restart_needed.load(Ordering::SeqCst),
        }
    }

    fn set_node_pack(&self, url: &str, status: PackStatus) {
        self.emit(BackendEvent::NodePack {
            url: url.to_string(),
            status,
        });
    }

    /// The tags of a pack's repository, newest first: the versions it can be installed at.
    pub async fn node_pack_versions(&self, url: &str) -> Result<Vec<String>> {
        let repo = node_packs::parse_github(url).map_err(BackendError::Invalid)?;
        node_packs::tags(&self.inner.http, &repo)
            .await
            .map_err(BackendError::Internal)
    }

    /// Every pack of the ComfyUI Registry, most downloaded first. A list read within the hour is returned as it is. An older
    /// one (in memory, or the copy kept on disk from an earlier start) is returned at once too and read again in the
    /// background, so opening the manager never waits for the 60 pages; only the very first read, or `refresh`, does.
    pub async fn registry_nodes(
        &self,
        refresh: bool,
    ) -> Result<Vec<crate::comfy::registry::RegistryNode>> {
        const FRESH: Duration = Duration::from_secs(3600);
        if !refresh {
            if let Some((age, list)) = self.kept_registry().await {
                if age >= FRESH {
                    self.refresh_registry_later();
                }
                return Ok(list.as_ref().clone());
            }
        }
        Ok(self.read_registry().await?.as_ref().clone())
    }

    fn registry_file(&self) -> PathBuf {
        self.inner
            .data_dir
            .join("cache")
            .join("registry-nodes.json")
    }

    /// The list already at hand and how old it is: the one in memory, else the copy on disk (which then goes into memory).
    async fn kept_registry(
        &self,
    ) -> Option<(Duration, Arc<Vec<crate::comfy::registry::RegistryNode>>)> {
        if let Some((at, list)) = self.inner.registry_cache.lock_safe().as_ref() {
            return Some((at.elapsed(), list.clone()));
        }
        let path = self.registry_file();
        let (age, list) =
            tokio::task::spawn_blocking(move || crate::comfy::registry::load_cache(&path))
                .await
                .ok()??;
        let list = Arc::new(list);
        let at = Instant::now().checked_sub(age).unwrap_or_else(Instant::now);
        let mut slot = self.inner.registry_cache.lock_safe();
        // A read that finished while the file was being read is newer than the file.
        Some(match slot.as_ref() {
            Some((at, list)) => (at.elapsed(), list.clone()),
            None => {
                *slot = Some((at, list.clone()));
                (age, list)
            }
        })
    }

    /// Reads every page of the registry and keeps the list in memory and on disk.
    async fn read_registry(&self) -> Result<Arc<Vec<crate::comfy::registry::RegistryNode>>> {
        let list = Arc::new(
            crate::comfy::registry::fetch_all(&self.inner.http)
                .await
                .map_err(BackendError::Internal)?,
        );
        *self.inner.registry_cache.lock_safe() = Some((Instant::now(), list.clone()));
        let (path, saved) = (self.registry_file(), list.clone());
        // The disk copy only saves the next start a wait; failing to write it costs nothing else.
        let _ =
            tokio::task::spawn_blocking(move || crate::comfy::registry::save_cache(&path, &saved))
                .await;
        Ok(list)
    }

    /// Reads the registry again without making anyone wait; one such read at a time, and a failure keeps the old list.
    fn refresh_registry_later(&self) {
        use std::sync::atomic::Ordering;
        if self
            .inner
            .registry_refreshing
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }
        let this = self.clone();
        tokio::spawn(async move {
            let _ = this.read_registry().await;
            this.inner
                .registry_refreshing
                .store(false, Ordering::SeqCst);
        });
    }

    /// The author and licence of a pack's GitHub repository.
    pub async fn node_pack_info(&self, url: &str) -> Result<node_packs::RepoInfo> {
        let repo = node_packs::parse_github(url).map_err(BackendError::Invalid)?;
        node_packs::repo_info(&self.inner.http, &repo)
            .await
            .map_err(BackendError::Internal)
    }

    /// Installs a pack from its GitHub address in the background (at a tag when `version` is given, else the default
    /// branch); progress arrives as `node_pack` events.
    pub async fn install_node_pack(&self, url: &str, version: Option<&str>) -> Result<()> {
        let repo = node_packs::parse_github(url).map_err(BackendError::Invalid)?;
        if let Some(tag) = version {
            if !node_packs::valid_tag(tag) {
                return Err(BackendError::Invalid(format!("Not a version tag: {tag}")));
            }
        }
        let version = version.map(str::to_string);
        let (dir, python) = self.comfy_install().ok_or_else(|| {
            BackendError::Invalid(
                "Packs can only be installed into a ComfyUI whose folder novira knows".into(),
            )
        })?;
        let url = repo.url();
        let token = {
            let mut running = self.inner.node_pack_jobs.lock_safe();
            if running.contains_key(&url) {
                return Ok(());
            }
            let token = self.inner.shutdown.child_token();
            running.insert(url.clone(), token.clone());
            token
        };
        let this = self.clone();
        tokio::spawn(async move {
            let sink = this.clone();
            let key = url.clone();
            let report = move |s: PackStatus| sink.set_node_pack(&key, s);
            let result = node_packs::install_version(
                &this.inner.http,
                &repo,
                version.as_deref(),
                &dir,
                &python,
                &this.inner.data_dir,
                &token,
                &report,
            )
            .await;
            this.inner.node_pack_jobs.lock_safe().remove(&url);
            match result {
                Ok(_) => {
                    this.inner.restart_needed.store(true, Ordering::SeqCst);
                    this.set_node_pack(&url, PackStatus::Ready);
                }
                Err(m) if m == "cancelled" => {
                    this.set_node_pack(&url, PackStatus::Missing { total_bytes: 0 })
                }
                Err(message) => this.set_node_pack(&url, PackStatus::Error { message }),
            }
        });
        Ok(())
    }

    pub fn cancel_node_pack(&self, url: &str) {
        let key = node_packs::parse_github(url)
            .map(|r| r.url())
            .unwrap_or_else(|_| url.to_string());
        if let Some(t) = self.inner.node_pack_jobs.lock_safe().get(&key) {
            t.cancel();
        }
    }

    pub fn remove_node_pack(&self, folder: &str) -> Result<NodePacks> {
        let (dir, _) = self.comfy_install().ok_or_else(|| {
            BackendError::Invalid("novira does not know the ComfyUI folder".into())
        })?;
        node_packs::remove(&node_packs::custom_nodes_dir(&dir), folder)
            .map_err(BackendError::Invalid)?;
        self.inner.restart_needed.store(true, Ordering::SeqCst);
        Ok(self.node_packs())
    }

    async fn pack_call(&self, route: &str, body: Option<Value>) -> Result<Value> {
        if !node_packs::route_allowed(route) {
            return Err(BackendError::Invalid(format!("Not a pack route: {route}")));
        }
        self.inner
            .engine
            .pack_request(&self.inner.shutdown, route, body)
            .await
            .map_err(|e| BackendError::Internal(e.to_string()))
    }

    /// The axes and presets of the Face Rig pack (what each handle can mean).
    pub async fn face_rig_library(&self) -> Result<Value> {
        self.pack_call("nkd/facerig/library", None).await
    }

    /// Renders a pose on the portrait. The picture goes along only when `image` is set.
    pub async fn face_rig_preview(&self, req: FaceRigPreview) -> Result<Value> {
        use base64::Engine as _;
        let mut body = serde_json::json!({
            "node": req.node_key,
            "rig": req.rig,
            "quality": if req.quality == "drag" { "drag" } else { "final" },
            "crop_factor": req.crop_factor.clamp(1.5, 3.0),
            "src_ratio": req.src_ratio.clamp(0.0, 1.0),
            "face_index": req.face_index.min(64),
        });
        if let Some(name) = &req.image {
            let bytes =
                self.inner.files.read_original(name).ok_or_else(|| {
                    BackendError::NotFound(format!("The picture {name} was deleted"))
                })?;
            body["frame"] = Value::String(format!(
                "data:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            ));
        }
        self.pack_call("nkd/facerig/preview", Some(body)).await
    }

    /// The ComfyUI releases it can be switched to, newest first.
    pub async fn comfy_versions(&self) -> Result<Vec<String>> {
        crate::comfy::install::release_tags(&self.inner.http)
            .await
            .map_err(BackendError::Internal)
    }

    /// Replaces the ComfyUI novira installed by the release `version` and installs every pack again; returns the
    /// folders of the packs that could not be installed again. Refused while a job or a pack install runs.
    pub async fn switch_comfy_version(&self, version: &str) -> Result<Vec<String>> {
        if !node_packs::valid_tag(version) {
            return Err(BackendError::Invalid(format!(
                "Not a ComfyUI version: {version}"
            )));
        }
        let busy = self
            .state()
            .queue
            .iter()
            .any(|q| q.status == QueueItemStatus::InProgress);
        if busy || !self.inner.node_pack_jobs.lock_safe().is_empty() {
            return Err(BackendError::Invalid(
                "ComfyUI cannot change version while a job or an extension install is running"
                    .into(),
            ));
        }
        let sink = self.clone();
        let on_pack = move |url: String, status: PackStatus| sink.set_node_pack(&url, status);
        let failed = self
            .inner
            .engine
            .switch_version(
                version,
                &self.inner.data_dir,
                &self.inner.shutdown,
                &on_pack,
            )
            .await
            .map_err(|e| BackendError::Internal(e.to_string()))?;
        self.inner.restart_needed.store(false, Ordering::SeqCst);
        Ok(failed)
    }

    /// Restarts ComfyUI so it loads the packs; refused while a job runs.
    pub async fn restart_engine(&self) -> Result<NodePacks> {
        let busy = self
            .state()
            .queue
            .iter()
            .any(|q| q.status == QueueItemStatus::InProgress);
        if busy {
            return Err(BackendError::Invalid(
                "ComfyUI cannot restart while a job is running".into(),
            ));
        }
        self.inner
            .engine
            .restart(&self.inner.shutdown)
            .await
            .map_err(|e| BackendError::Internal(e.to_string()))?;
        self.inner.restart_needed.store(false, Ordering::SeqCst);
        Ok(self.node_packs())
    }
}
