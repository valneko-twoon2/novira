//! Models: install from a source, list, edit, delete and scan a folder.
use super::*;
use crate::sync::LockExt;
use sha2::{Digest, Sha256};
use std::io::Read;

const COVERS_CHECKED_META: &str = "covers_checked_3";
const LICENSES_CHECKED_META: &str = "licenses_checked_1";

/// Where a model's license can be read without hashing the file.
#[derive(Debug, PartialEq)]
enum LicenseRef {
    Civitai(u64),
    HuggingFace(String),
}

/// The Civitai model id or Hugging Face repository named by an install source, if any.
fn license_ref_of_source(source: &str) -> Option<LicenseRef> {
    // `civitai:<modelId>/<versionId>-<fileId>`, as the Browse tab sends it.
    if let Some(rest) = source.strip_prefix("civitai:") {
        return rest
            .split('/')
            .next()?
            .parse()
            .ok()
            .map(LicenseRef::Civitai);
    }
    match install::parse_source(source).ok()? {
        Source::CivitaiPage { model_id, .. } => Some(LicenseRef::Civitai(model_id)),
        Source::HuggingFace { repo, .. } => Some(LicenseRef::HuggingFace(repo)),
        Source::Url(url) => {
            let u = reqwest::Url::parse(&url).ok()?;
            if !install::host_is(&u, "huggingface.co") {
                return None;
            }
            let mut parts = u.path_segments()?;
            let (owner, repo) = (parts.next()?, parts.next()?);
            (!owner.is_empty() && !repo.is_empty())
                .then(|| LicenseRef::HuggingFace(format!("{owner}/{repo}")))
        }
        _ => None,
    }
}

/// The SHA-256 of a file, as Civitai spells it.
fn file_sha256(path: &Path) -> std::io::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}

impl Backend {
    pub fn list_starter_models(&self) -> Vec<StarterModel> {
        starter::starter_models()
    }

    /// The starter files the installed model `model_key` needs but the library does not hold (see `models::parts`).
    pub fn model_parts(&self, model_key: &str) -> Result<ModelPartsReport> {
        let s = self.state();
        let model = s
            .models
            .iter()
            .find(|m| m.key == model_key)
            .ok_or_else(|| BackendError::NotFound(format!("model not found: {model_key}")))?;
        Ok(crate::models::parts::missing_parts(&s.models, model))
    }

    pub fn install_model(&self, source: &str, name: Option<String>) -> Result<ModelInstallJob> {
        let parsed = install::parse_source(source).map_err(BackendError::Invalid)?;
        let starter = starter::starter_models()
            .into_iter()
            .find(|s| s.source == source);
        let display = name
            .or_else(|| starter.as_ref().map(|s| s.name.clone()))
            .unwrap_or_else(|| {
                source
                    .trim()
                    .rsplit(['/', '\\', ':'])
                    .find(|s| !s.is_empty())
                    .unwrap_or(source)
                    .to_string()
            });
        let job = ModelInstallJob {
            id: new_id("install"),
            source: source.to_string(),
            name: display,
            status: ModelInstallStatus::Waiting,
            bytes: 0,
            total_bytes: 0,
            error: None,
        };
        let cancel = self.inner.shutdown.child_token();
        {
            // One source is one partial file (`install::part_name`): a second install of it waits for the first.
            let mut list = self.inner.installs.lock_safe();
            if list.iter().any(|i| {
                i.job.source == source
                    && matches!(
                        i.job.status,
                        ModelInstallStatus::Waiting
                            | ModelInstallStatus::Downloading
                            | ModelInstallStatus::Running
                    )
            }) {
                return Err(BackendError::Invalid(
                    "This model is already being installed".into(),
                ));
            }
            list.push(Install {
                job: job.clone(),
                cancel: cancel.clone(),
            });
        }
        self.emit(BackendEvent::ModelInstall { job: job.clone() });
        let this = self.clone();
        let id = job.id.clone();
        let hint = starter.map(|s| s.kind);
        tokio::spawn(async move {
            let result = this.run_install(&id, parsed, hint, &cancel).await;
            match result {
                Ok(model) => {
                    this.update_install(&id, |j| j.status = ModelInstallStatus::Completed);
                    this.emit(BackendEvent::ModelAdded { model });
                }
                Err(InstallError::Cancelled) => {
                    this.update_install(&id, |j| j.status = ModelInstallStatus::Cancelled)
                }
                Err(InstallError::Failed(e)) => this.update_install(&id, |j| {
                    crate::applog::error("models", format!("install of {} failed: {e}", j.name));
                    j.status = ModelInstallStatus::Error;
                    j.error = Some(e);
                }),
            }
        });
        Ok(job)
    }

    fn update_install(&self, id: &str, f: impl FnOnce(&mut ModelInstallJob)) {
        let job = {
            let mut list = self.inner.installs.lock_safe();
            let Some(i) = list.iter_mut().find(|i| i.job.id == id) else {
                return;
            };
            f(&mut i.job);
            i.job.clone()
        };
        self.emit(BackendEvent::ModelInstall { job });
    }

    async fn run_install(
        &self,
        id: &str,
        source: Source,
        hint: Option<ModelType>,
        cancel: &CancellationToken,
    ) -> std::result::Result<ModelConfig, InstallError> {
        let fail = |e: String| InstallError::Failed(e);
        let job_source = self
            .inner
            .installs
            .lock_safe()
            .iter()
            .find(|i| i.job.id == id)
            .map(|i| (i.job.source.clone(), i.job.name.clone()))
            .unwrap_or_default();
        // The repository a Hugging Face file comes from, to find its picture once the file is in place.
        let hf_repo = match &source {
            Source::HuggingFace { repo, .. } => Some(repo.clone()),
            _ => None,
        };
        let (file, kind, cover, cover_mature, trigger_words) = match source {
            Source::Local(path) => {
                self.update_install(id, |j| j.status = ModelInstallStatus::Running);
                if !path.is_file() || !layout::is_model_file(&path) {
                    return Err(fail(format!("Not a model file: {}", path.display())));
                }
                let kind = hint
                    .or_else(|| {
                        classify::read_header(&path)
                            .as_ref()
                            .and_then(classify::detect_kind)
                    })
                    .or_else(|| classify::kind_from_name(&path.to_string_lossy()))
                    .ok_or_else(|| fail("Cannot tell what kind of model this file is".into()))?;
                let file_name = path
                    .file_name()
                    .map(|f| f.to_string_lossy().into_owned())
                    .unwrap_or_default();
                let dest = install::target_dir(&self.inner.models_dir, kind)
                    .map_err(fail)?
                    .join(&file_name);
                if dest.exists() {
                    return Err(fail(format!("{file_name} is already in the models folder")));
                }
                let (src, d) = (path.clone(), dest.clone());
                tokio::task::spawn_blocking(move || install::link_or_copy(&src, &d))
                    .await
                    .map_err(|e| fail(e.to_string()))?
                    .map_err(|e| fail(e.to_string()))?;
                (dest, kind, None, false, Vec::new())
            }
            remote => {
                let key = self.civitai_key();
                let resolved = tokio::select! {
                    _ = cancel.cancelled() => return Err(InstallError::Cancelled),
                    r = install::resolve(&self.inner.http, &remote, key.as_deref()) => r.map_err(fail)?,
                };
                let file_name = install::safe_file_name(&resolved.file_name)
                    .ok_or_else(|| fail(format!("Unsupported file: {}", resolved.file_name)))?;
                let total = resolved.total_bytes;
                self.update_install(id, |j| {
                    j.status = ModelInstallStatus::Downloading;
                    j.total_bytes = total;
                });
                let part = self
                    .inner
                    .models_dir
                    .join(".downloads")
                    .join(install::part_name(&job_source.0));
                let bearer = if resolved.civitai {
                    self.civitai_key()
                } else if resolved.hugging_face {
                    self.hf_token()
                } else {
                    None
                };
                let mut last = Instant::now();
                install::download(
                    &self.inner.http,
                    &resolved.url,
                    bearer.as_deref(),
                    &part,
                    cancel,
                    |bytes, total| {
                        if last.elapsed() >= Duration::from_millis(250) || bytes == total {
                            last = Instant::now();
                            self.update_install(id, |j| {
                                j.bytes = bytes;
                                j.total_bytes = total;
                            });
                        }
                    },
                )
                .await?;
                self.update_install(id, |j| j.status = ModelInstallStatus::Running);
                let from_header = classify::read_header_unchecked(&part)
                    .as_ref()
                    .and_then(classify::detect_kind);
                let kind = match install::pick_kind(hint, from_header, resolved.kind)
                    .or_else(|| classify::kind_from_name(&file_name))
                {
                    Some(k) => k,
                    None => {
                        let _ = std::fs::remove_file(&part);
                        return Err(fail("Cannot tell what kind of model this file is".into()));
                    }
                };
                let dest = install::target_dir(&self.inner.models_dir, kind)
                    .map_err(fail)?
                    .join(&file_name);
                if dest.exists() {
                    let _ = std::fs::remove_file(&part);
                    return Err(fail(format!("{file_name} is already in the models folder")));
                }
                std::fs::create_dir_all(dest.parent().expect("has parent"))
                    .map_err(|e| fail(e.to_string()))?;
                std::fs::rename(&part, &dest).map_err(|e| fail(e.to_string()))?;
                (
                    dest,
                    kind,
                    resolved.cover.clone(),
                    resolved.cover_mature,
                    resolved.trigger_words.clone(),
                )
            }
        };
        let cover = match (cover, hf_repo) {
            (None, Some(repo)) => {
                huggingface::cover_of_repo(&self.inner.http, &repo, self.hf_token().as_deref())
                    .await
            }
            (cover, _) => cover,
        };
        let cat = layout::category_for_kind(kind).expect("target_dir checked the category");
        let found = FoundModel {
            comfy_name: file
                .file_name()
                .map(|f| f.to_string_lossy().into_owned())
                .unwrap_or_default(),
            size: std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0),
            path: file,
            folder: cat.folder,
            kind,
        };
        let (source, name) = job_source;
        let mut model = registry::new_record(&found, Some(&source), Some(&name));
        model.cover_image_url = cover;
        model.cover_mature = (model.cover_image_url.is_some() && cover_mature).then_some(true);
        if model.trigger_phrases.is_none() && !trigger_words.is_empty() {
            model.trigger_phrases = Some(trigger_words);
        }
        // Read from the source only; a file without one is looked up by hash on the next start.
        if let Ok(license) = self.lookup_license(&source, None).await {
            model.license = license;
        }
        self.upsert_model(model.clone())
            .map_err(|e| fail(e.to_string()))?;
        Ok(model)
    }

    /// Asks Civitai for the picture (and trigger words) of every model that has none, by the hash of its file: models put
    /// in the folder by hand, or installed before covers were kept. Each model is asked once; a file Civitai does not
    /// know stays without a cover. Runs in the background and stops at the first network failure (it retries next start).
    pub async fn fill_model_covers(self) {
        let checked: HashSet<String> = self
            .db()
            .meta(COVERS_CHECKED_META)
            .ok()
            .flatten()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        let todo: Vec<(String, PathBuf)> = self
            .state()
            .models
            .iter()
            .filter(|m| m.cover_image_url.is_none() && !checked.contains(&m.key))
            .map(|m| (m.key.clone(), PathBuf::from(&m.path)))
            .collect();
        let mut checked = checked;
        for (key, path) in todo {
            if self.inner.shutdown.is_cancelled() {
                return;
            }
            let Ok(Ok(hash)) = tokio::task::spawn_blocking(move || file_sha256(&path)).await else {
                continue;
            };
            let url = format!("{}/model-versions/by-hash/{hash}", install::civitai_api());
            let mut req = self.inner.http.get(url);
            if let Some(k) = self.civitai_key() {
                req = req.bearer_auth(k);
            }
            let found = match req.send().await {
                Ok(res) if res.status().is_success() => res.json::<Value>().await.ok(),
                Ok(res) if res.status() == reqwest::StatusCode::NOT_FOUND => None,
                _ => return,
            };
            checked.insert(key.clone());
            if let Ok(text) = serde_json::to_string(&checked) {
                let _ = self.db().set_meta(COVERS_CHECKED_META, &text);
            }
            let Some(version) = found else { continue };
            let cover = civitai::cover_with_maturity(&version);
            let words = civitai::trigger_words(&version);
            // The record may have been edited meanwhile: change only what is missing.
            let updated = {
                let s = self.state();
                s.models.iter().find(|m| m.key == key).cloned()
            };
            let Some(mut model) = updated else { continue };
            if model.cover_image_url.is_none() {
                if let Some((url, mature)) = cover {
                    model.cover_image_url = Some(url);
                    model.cover_mature = mature.then_some(true);
                }
            }
            if model.trigger_phrases.is_none() && !words.is_empty() {
                model.trigger_phrases = Some(words);
            }
            if self.upsert_model(model.clone()).is_ok() {
                self.emit(BackendEvent::ModelAdded { model });
            }
        }
    }

    /// GET on the Civitai API: `Ok(None)` when Civitai does not know the thing, `Err` when the request failed.
    async fn civitai_get(&self, url: &str) -> std::result::Result<Option<Value>, ()> {
        let mut req = self.inner.http.get(url);
        if let Some(k) = self.civitai_key() {
            req = req.bearer_auth(k);
        }
        match req.send().await {
            Ok(res) if res.status().is_success() => Ok(res.json::<Value>().await.ok()),
            Ok(res) if res.status() == reqwest::StatusCode::NOT_FOUND => Ok(None),
            _ => Err(()),
        }
    }

    /// The license of a model, from the site its source names, or (with `path`) from Civitai by the file's hash.
    /// `Ok(None)` when no site knows it, `Err` when the network failed (worth asking again later).
    async fn lookup_license(
        &self,
        source: &str,
        path: Option<&Path>,
    ) -> std::result::Result<Option<ModelLicense>, ()> {
        let target = match license_ref_of_source(source) {
            Some(r) => r,
            None => {
                let Some(path) = path.map(Path::to_path_buf) else {
                    return Ok(None);
                };
                let Ok(Ok(hash)) = tokio::task::spawn_blocking(move || file_sha256(&path)).await
                else {
                    return Ok(None);
                };
                let url = format!("{}/model-versions/by-hash/{hash}", install::civitai_api());
                match self
                    .civitai_get(&url)
                    .await?
                    .and_then(|v| v["modelId"].as_u64())
                {
                    Some(id) => LicenseRef::Civitai(id),
                    None => return Ok(None),
                }
            }
        };
        match target {
            LicenseRef::Civitai(id) => Ok(self
                .civitai_get(&format!("{}/models/{id}", install::civitai_api()))
                .await?
                .map(|m| civitai::license_of_model(&m))),
            LicenseRef::HuggingFace(repo) => {
                huggingface::license_of_repo(&self.inner.http, &repo, self.hf_token().as_deref())
                    .await
                    .map(Some)
                    .ok_or(())
            }
        }
    }

    /// Looks up the license of every model that has none (models put in the folder by hand, or installed before
    /// licenses were kept). Each model is asked once; runs in the background and stops at the first network failure
    /// (it retries on the next start).
    pub async fn fill_model_licenses(self) {
        let mut checked: HashSet<String> = self
            .db()
            .meta(LICENSES_CHECKED_META)
            .ok()
            .flatten()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        let todo: Vec<(String, String, PathBuf)> = self
            .state()
            .models
            .iter()
            .filter(|m| m.license.is_none() && !checked.contains(&m.key))
            .map(|m| (m.key.clone(), m.source.clone(), PathBuf::from(&m.path)))
            .collect();
        for (key, source, path) in todo {
            if self.inner.shutdown.is_cancelled() {
                return;
            }
            let Ok(license) = self.lookup_license(&source, Some(&path)).await else {
                return;
            };
            checked.insert(key.clone());
            if let Ok(text) = serde_json::to_string(&checked) {
                let _ = self.db().set_meta(LICENSES_CHECKED_META, &text);
            }
            let Some(license) = license else { continue };
            let current = {
                let s = self.state();
                s.models.iter().find(|m| m.key == key).cloned()
            };
            let Some(mut model) = current else { continue };
            model.license = Some(license);
            if self.upsert_model(model.clone()).is_ok() {
                self.emit(BackendEvent::ModelAdded { model });
            }
        }
    }

    pub(super) fn upsert_model(&self, model: ModelConfig) -> Result<()> {
        let mut s = self.state();
        if s.hidden_models.remove(&model.key) {
            let hidden = serde_json::to_string(&s.hidden_models).expect("set serializes");
            self.db().set_meta(HIDDEN_MODELS_META, &hidden)?;
        }
        match s.models.iter_mut().find(|m| m.key == model.key) {
            Some(m) => *m = model.clone(),
            None => s.models.push(model.clone()),
        }
        drop(s);
        self.db().put(Table::Models, &model.key, 0, &model)?;
        Ok(())
    }

    pub fn cancel_install(&self, job_id: &str) {
        if let Some(i) = self
            .inner
            .installs
            .lock_safe()
            .iter()
            .find(|i| i.job.id == job_id)
        {
            i.cancel.cancel();
        }
    }

    /// Applies a partial `ModelConfig`. File facts (key, path, size, ComfyUI address) cannot be changed.
    pub fn update_model(&self, key: &str, patch: Value) -> Result<ModelConfig> {
        let Value::Object(patch) = patch else {
            return Err(BackendError::Invalid("patch must be an object".into()));
        };
        let mut s = self.state();
        let model = s
            .models
            .iter_mut()
            .find(|m| m.key == key)
            .ok_or_else(|| BackendError::NotFound(format!("model not found: {key}")))?;
        let mut v = serde_json::to_value(&*model).map_err(internal)?;
        let obj = v.as_object_mut().expect("model is an object");
        for (k, val) in patch {
            if !matches!(
                k.as_str(),
                "key" | "path" | "size" | "comfy" | "type" | "format"
            ) {
                obj.insert(k, val);
            }
        }
        let updated: ModelConfig =
            serde_json::from_value(v).map_err(|e| BackendError::Invalid(e.to_string()))?;
        *model = updated.clone();
        drop(s);
        self.db().put(Table::Models, key, 0, &updated)?;
        Ok(updated)
    }

    /// Removes a model. Files novira installed are deleted; files in the user's own folders are only hidden.
    pub fn delete_model(&self, key: &str) -> Result<()> {
        let mut s = self.state();
        let Some(pos) = s.models.iter().position(|m| m.key == key) else {
            return Ok(());
        };
        let model = s.models.remove(pos);
        let path = PathBuf::from(&model.path);
        let owned = path.starts_with(&self.inner.models_dir);
        if !owned {
            s.hidden_models.insert(key.to_string());
        }
        let hidden = serde_json::to_string(&s.hidden_models).expect("set serializes");
        drop(s);
        if owned {
            std::fs::remove_file(&path).map_err(|e| {
                BackendError::Internal(format!("Cannot delete {}: {e}", path.display()))
            })?;
            self.db().delete(Table::Models, &[key])?;
        } else {
            self.db().set_meta(HIDDEN_MODELS_META, &hidden)?;
        }
        Ok(())
    }

    /// Model files in a folder, and whether each is already installed.
    pub async fn scan_folder(&self, path: &str) -> Result<Vec<ScannedFile>> {
        let dir = PathBuf::from(path.trim());
        if !dir.is_absolute() || !dir.is_dir() {
            return Err(BackendError::Invalid(format!("Not a folder: {path}")));
        }
        let files = tokio::task::spawn_blocking(move || layout::walk(&dir))
            .await
            .map_err(internal)?;
        let s = self.state();
        Ok(files
            .into_iter()
            .map(|f| {
                let name = f.file_name().map(|n| n.to_string_lossy().to_lowercase());
                let size = std::fs::metadata(&f).map(|m| m.len()).ok();
                let installed = s.models.iter().any(|m| {
                    let mp = Path::new(&m.path);
                    mp == f
                        || (mp.file_name().map(|n| n.to_string_lossy().to_lowercase()) == name
                            && Some(m.size) == size)
                });
                ScannedFile {
                    path: f.to_string_lossy().into_owned(),
                    installed,
                }
            })
            .collect())
    }

    /// The model files of a Hugging Face repository, for the install tab (see `models::huggingface::list_model_files`).
    pub async fn hugging_face_files(&self, repo: &str) -> Result<Vec<String>> {
        let token = self.hf_token();
        crate::models::huggingface::list_model_files(
            &self.inner.http,
            repo.trim(),
            token.as_deref(),
        )
        .await
        .map_err(BackendError::Invalid)
    }

    pub fn model_roots(&self) -> &[PathBuf] {
        &self.inner.roots
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sources_name_the_site_to_ask_for_the_license() {
        assert_eq!(
            license_ref_of_source("civitai:1234/5678-9"),
            Some(LicenseRef::Civitai(1234))
        );
        assert_eq!(
            license_ref_of_source("https://civitai.com/models/42?modelVersionId=7"),
            Some(LicenseRef::Civitai(42))
        );
        assert_eq!(
            license_ref_of_source("owner/repo::lora.safetensors"),
            Some(LicenseRef::HuggingFace("owner/repo".into()))
        );
        assert_eq!(
            license_ref_of_source("https://huggingface.co/owner/repo/resolve/main/a.safetensors"),
            Some(LicenseRef::HuggingFace("owner/repo".into()))
        );
        assert_eq!(license_ref_of_source("E:/models/a.safetensors"), None);
        assert_eq!(
            license_ref_of_source("https://example.com/a.safetensors"),
            None
        );
    }

    #[test]
    fn the_hash_is_spelled_as_civitai_spells_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.safetensors");
        std::fs::write(&path, b"abc").unwrap();
        assert_eq!(
            file_sha256(&path).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
