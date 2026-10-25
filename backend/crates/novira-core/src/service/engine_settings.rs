//! The engine settings the Settings screen shows and changes: the ComfyUI package, its start timeout, the extra
//! model folders and the Civitai lookup. Each change is checked here and written into `settings.json` with
//! `Settings::save_key`; it applies when the app starts next (`restartNeeded`). The model folders are read once at
//! start (the scan and ComfyUI's `extra_model_paths.yaml`), so they are not applied while the app runs.
use super::*;
use crate::{data_location, settings};

impl Backend {
    /// Whether the app started with the Civitai lookup on (the lookup runs at start only, so this is the value that counts).
    pub fn civitai_lookup_at_start(&self) -> bool {
        self.inner.started_settings.civitai_lookup
    }

    /// The engine settings as saved, and whether they differ from what the app started with.
    pub fn engine_settings(&self) -> Result<EngineSettings> {
        let saved = Settings::load(&self.inner.data_dir).map_err(BackendError::Internal)?;
        let started = &self.inner.started_settings;
        let pending = self.pending_location();
        let restart_needed = pending.is_some()
            || saved.comfyui_install_dir != started.comfyui_install_dir
            || saved.comfyui_package != started.comfyui_package
            || saved.comfyui_start_timeout_secs != started.comfyui_start_timeout_secs
            || saved.model_roots != started.model_roots
            || saved.civitai_lookup != started.civitai_lookup;
        let root = started.install_root(&self.inner.data_dir);
        let comfyui_installed = saved.comfyui_mode() == ComfyuiMode::Owned
            && crate::comfy::install::is_installed(&root);
        let installed_comfyui_package = comfyui_installed
            .then(|| crate::comfy::install::installed_package(&root))
            .flatten()
            .and_then(|name| match name.as_str() {
                "nvidia" => Some(ComfyuiPackage::Nvidia),
                "amd" => Some(ComfyuiPackage::Amd),
                _ => None,
            });
        Ok(EngineSettings {
            data_dir: self.inner.data_dir.to_string_lossy().into_owned(),
            data_dir_changeable: self.location_pointer().is_some(),
            data_dir_next: pending
                .as_ref()
                .map(|p| p.data_dir.to_string_lossy().into_owned()),
            data_dir_moves: pending.as_ref().is_some_and(|p| p.move_from.is_some()),
            data_dir_note: self.location_note(),
            comfyui_mode: saved.comfyui_mode(),
            comfyui_url: saved.comfyui_url.clone(),
            comfyui_dir: saved
                .comfyui_dir
                .as_ref()
                .map(|d| d.to_string_lossy().into_owned()),
            comfyui_install_dir: saved
                .comfyui_install_dir
                .as_ref()
                .map(|d| d.to_string_lossy().into_owned()),
            comfyui_root: root.to_string_lossy().into_owned(),
            comfyui_package: saved.package(),
            comfyui_installed,
            installed_comfyui_package,
            comfyui_start_timeout_secs: saved.comfyui_start_timeout_secs,
            model_roots: saved
                .model_roots
                .iter()
                .map(|r| r.to_string_lossy().into_owned())
                .collect(),
            civitai_lookup: saved.civitai_lookup,
            restart_needed,
        })
    }

    /// Checks every value of the patch first, then saves them; nothing is written when one is wrong.
    pub fn set_engine_settings(&self, patch: EngineSettingsPatch) -> Result<EngineSettings> {
        if let Some(package) = &patch.comfyui_package {
            settings::check_package(package).map_err(BackendError::Invalid)?;
        }
        if let Some(secs) = patch.comfyui_start_timeout_secs {
            settings::check_start_timeout(secs).map_err(BackendError::Invalid)?;
        }
        let _write = self.inner.settings_write.lock_safe();
        if let Some(package) = patch.comfyui_package {
            // An install made before the record existed is taken to be from the package saved so far: it must be
            // recorded before the change, or the change would look like no change at all.
            let saved = Settings::load(&self.inner.data_dir).map_err(BackendError::Internal)?;
            if saved.comfyui_mode() == ComfyuiMode::Owned {
                crate::comfy::install::adopt_package(
                    &saved.install_root(&self.inner.data_dir),
                    &saved.comfyui_package,
                )
                .map_err(internal)?;
            }
            self.save_setting("comfyuiPackage", Value::String(package))?;
        }
        if let Some(secs) = patch.comfyui_start_timeout_secs {
            self.save_setting("comfyuiStartTimeoutSecs", Value::from(secs))?;
        }
        if let Some(on) = patch.civitai_lookup {
            self.save_setting("civitaiLookup", Value::Bool(on))?;
        }
        drop(_write);
        self.engine_settings()
    }

    /// Tells the backend which file records where the data folder is; without one, the data folder cannot be changed
    /// from the app (it is fixed by `NOVIRA_DATA_DIR` or by the shell).
    pub fn set_location_pointer(&self, pointer: Option<PathBuf>) {
        *self.inner.location_pointer.write_safe() = pointer;
    }

    fn location_pointer(&self) -> Option<PathBuf> {
        self.inner.location_pointer.read_safe().clone()
    }

    /// The change waiting for the next start: the pointer names a folder other than the one this run opened.
    fn pending_location(&self) -> Option<data_location::Location> {
        let location = data_location::read(&self.location_pointer()?)?;
        (location.data_dir != self.inner.data_dir).then_some(location)
    }

    /// Why the last requested move did not happen, while the pointer still names the folder in use.
    fn location_note(&self) -> Option<String> {
        data_location::read(&self.location_pointer()?)?.move_error
    }

    /// Fails when the data folder cannot be changed from the app, so the shell does not ask for a folder in vain.
    pub fn check_data_dir_changeable(&self) -> Result<()> {
        self.location_pointer().map(|_| ()).ok_or_else(|| {
            BackendError::Invalid(
                "The data folder is fixed here and cannot be changed from the app".into(),
            )
        })
    }

    /// Makes `folder` (from the shell's dialog) the data folder of the next start, with the current data moved into it
    /// when `move_data` is set (done at that start, before anything is opened).
    pub fn set_data_dir(&self, folder: &Path, move_data: bool) -> Result<EngineSettings> {
        self.check_data_dir_changeable()?;
        let pointer = self.location_pointer().expect("checked above");
        data_location::check_new(folder, &self.inner.data_dir, move_data)
            .map_err(BackendError::Invalid)?;
        let location = data_location::Location {
            data_dir: folder.to_path_buf(),
            move_from: move_data.then(|| self.inner.data_dir.clone()),
            move_error: None,
        };
        data_location::write(&pointer, &location).map_err(BackendError::Internal)?;
        self.engine_settings()
    }

    /// Cancels a change waiting for the next start: the folder in use stays the data folder.
    pub fn cancel_data_dir_change(&self) -> Result<EngineSettings> {
        self.check_data_dir_changeable()?;
        let pointer = self.location_pointer().expect("checked above");
        let location = data_location::Location {
            data_dir: self.inner.data_dir.clone(),
            ..Default::default()
        };
        data_location::write(&pointer, &location).map_err(BackendError::Internal)?;
        self.engine_settings()
    }

    /// Chooses the folder novira's own ComfyUI is installed in from the next start (`None`: `comfyui` in the data
    /// folder again). Nothing is moved: a folder that holds an install is used as it is, an empty one gets a new install.
    pub fn set_comfyui_install_dir(&self, folder: Option<&Path>) -> Result<EngineSettings> {
        if let Some(folder) = folder {
            settings::check_install_dir(folder, &self.inner.data_dir)
                .map_err(BackendError::Invalid)?;
        }
        let _write = self.inner.settings_write.lock_safe();
        let value = match folder {
            Some(f) => Value::String(f.to_string_lossy().into_owned()),
            None => Value::Null,
        };
        self.save_setting("comfyuiInstallDir", value)?;
        drop(_write);
        self.engine_settings()
    }

    /// Fails when no more model folders can be added, so the shell does not ask for a folder in vain.
    pub fn check_model_root_room(&self) -> Result<()> {
        let saved = Settings::load(&self.inner.data_dir).map_err(BackendError::Internal)?;
        if saved.model_roots.len() >= settings::MAX_MODEL_ROOTS {
            return Err(BackendError::Invalid(format!(
                "At most {} model folders can be added",
                settings::MAX_MODEL_ROOTS
            )));
        }
        Ok(())
    }

    /// Adds a folder the shell's dialog returned to the extra model folders (`settings::check_new_model_root`).
    pub fn add_model_root(&self, folder: &Path) -> Result<EngineSettings> {
        let _write = self.inner.settings_write.lock_safe();
        let mut saved = Settings::load(&self.inner.data_dir).map_err(BackendError::Internal)?;
        settings::check_new_model_root(folder, &saved.model_roots, &self.inner.data_dir)
            .map_err(BackendError::Invalid)?;
        saved.model_roots.push(folder.to_path_buf());
        self.save_model_roots(&saved.model_roots)?;
        drop(_write);
        self.engine_settings()
    }

    /// Removes the extra model folder at `index` (the order of `modelRoots`).
    pub fn remove_model_root(&self, index: usize) -> Result<EngineSettings> {
        let _write = self.inner.settings_write.lock_safe();
        let mut saved = Settings::load(&self.inner.data_dir).map_err(BackendError::Internal)?;
        if index >= saved.model_roots.len() {
            return Err(BackendError::Invalid(
                "There is no model folder at that place".into(),
            ));
        }
        saved.model_roots.remove(index);
        self.save_model_roots(&saved.model_roots)?;
        drop(_write);
        self.engine_settings()
    }

    fn save_model_roots(&self, roots: &[PathBuf]) -> Result<()> {
        let value = serde_json::to_value(roots).map_err(internal)?;
        self.save_setting("modelRoots", value)
    }

    fn save_setting(&self, key: &str, value: Value) -> Result<()> {
        Settings::save_key(&self.inner.data_dir, key, value).map_err(BackendError::Internal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::ProgressFn;
    use crate::settings::SETTINGS_FILE;

    /// An engine that never runs anything: the settings do not use it.
    struct NoEngine;

    #[async_trait::async_trait]
    impl Engine for NoEngine {
        async fn generate(
            &self,
            _job: &EngineJob,
            _progress: ProgressFn<'_>,
            _cancel: &CancellationToken,
        ) -> std::result::Result<EngineOutput, EngineError> {
            Err(EngineError::Cancelled)
        }
    }

    /// A service on `data`, started with `settings` (which are also saved, as the app reads them from the file).
    fn open(data: &Path, settings: Settings) -> Backend {
        std::fs::create_dir_all(data).unwrap();
        std::fs::write(
            data.join(SETTINGS_FILE),
            serde_json::to_string(&settings).unwrap(),
        )
        .unwrap();
        Backend::open_with_engine(
            BackendConfig {
                data_dir: data.to_path_buf(),
                image_url_base: "http://novira-image.localhost".into(),
                settings,
            },
            Arc::new(NoEngine),
        )
        .unwrap()
    }

    fn quiet() -> Settings {
        Settings {
            gpu_lock: String::new(),
            ..Settings::default()
        }
    }

    fn saved(data: &Path) -> serde_json::Value {
        serde_json::from_str(&std::fs::read_to_string(data.join(SETTINGS_FILE)).unwrap()).unwrap()
    }

    #[test]
    fn the_settings_show_what_is_saved_and_nothing_needs_a_restart_at_first() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        let s = b.engine_settings().unwrap();
        assert_eq!(s.data_dir, data.to_string_lossy());
        assert_eq!(s.comfyui_mode, ComfyuiMode::Owned);
        assert_eq!(s.comfyui_url, None);
        assert_eq!(s.comfyui_dir, None);
        assert_eq!(s.comfyui_package, ComfyuiPackage::Nvidia);
        assert_eq!(s.comfyui_start_timeout_secs, 180);
        assert!(s.model_roots.is_empty());
        assert!(!s.restart_needed);
    }

    #[test]
    fn a_change_is_saved_beside_the_other_keys_and_needs_a_restart() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        let s = b
            .set_engine_settings(EngineSettingsPatch {
                comfyui_package: Some("amd".into()),
                comfyui_start_timeout_secs: Some(600),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(s.comfyui_package, ComfyuiPackage::Amd);
        assert_eq!(s.comfyui_start_timeout_secs, 600);
        assert!(s.restart_needed);
        let file = saved(&data);
        assert_eq!(file["comfyuiPackage"], "amd");
        assert_eq!(file["comfyuiStartTimeoutSecs"], 600);
        assert_eq!(file["gpuLock"], "", "other keys are kept");
        // Changing it back to what the app started with needs no restart.
        let s = b
            .set_engine_settings(EngineSettingsPatch {
                comfyui_package: Some("nvidia".into()),
                comfyui_start_timeout_secs: Some(180),
                ..Default::default()
            })
            .unwrap();
        assert!(!s.restart_needed);
        // An empty patch changes nothing.
        assert_eq!(
            b.set_engine_settings(EngineSettingsPatch::default())
                .unwrap(),
            s
        );
    }

    #[test]
    fn the_data_folder_can_be_changed_only_when_the_shell_gave_a_pointer() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        assert!(!b.engine_settings().unwrap().data_dir_changeable);
        assert!(b.set_data_dir(&base.path().join("new"), false).is_err());
        assert!(b.cancel_data_dir_change().is_err());
        assert!(b.check_data_dir_changeable().is_err());
    }

    #[test]
    fn a_data_folder_change_waits_for_the_next_start_and_can_be_cancelled() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let pointer = base.path().join("cfg").join("data-location.json");
        let b = open(&data, quiet());
        b.set_location_pointer(Some(pointer.clone()));
        let new = base.path().join("elsewhere");
        let s = b.set_data_dir(&new, true).unwrap();
        assert!(s.data_dir_changeable && s.restart_needed && s.data_dir_moves);
        assert_eq!(
            s.data_dir_next.as_deref(),
            Some(new.to_string_lossy().as_ref())
        );
        assert_eq!(
            s.data_dir,
            data.to_string_lossy(),
            "this run still uses the old folder"
        );
        let kept = data_location::read(&pointer).unwrap();
        assert_eq!(
            (kept.data_dir, kept.move_from),
            (new.clone(), Some(data.clone()))
        );
        // Without a move, the folder is only opened.
        let s = b.set_data_dir(&new, false).unwrap();
        assert!(!s.data_dir_moves && s.data_dir_next.is_some());
        let s = b.cancel_data_dir_change().unwrap();
        assert_eq!((s.data_dir_next, s.restart_needed), (None, false));
    }

    #[test]
    fn a_folder_that_cannot_hold_the_data_is_refused_and_nothing_is_written() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let pointer = base.path().join("data-location.json");
        let b = open(&data, quiet());
        b.set_location_pointer(Some(pointer.clone()));
        let full = base.path().join("full");
        std::fs::create_dir_all(&full).unwrap();
        std::fs::write(full.join("a.txt"), "x").unwrap();
        assert!(
            b.set_data_dir(&full, true).is_err(),
            "a move needs an empty folder"
        );
        assert!(
            b.set_data_dir(&data, false).is_err(),
            "the folder already in use"
        );
        assert!(b.set_data_dir(&data.join("inside"), false).is_err());
        assert!(!pointer.exists());
    }

    #[test]
    fn the_comfyui_install_folder_is_chosen_and_reset_for_the_next_start() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        let s = b.engine_settings().unwrap();
        assert_eq!(
            (s.comfyui_install_dir, s.comfyui_root),
            (None, data.join("comfyui").to_string_lossy().into_owned())
        );
        let spot = base.path().join("engine");
        let s = b.set_comfyui_install_dir(Some(&spot)).unwrap();
        assert_eq!(
            s.comfyui_install_dir.as_deref(),
            Some(spot.to_string_lossy().as_ref())
        );
        assert!(s.restart_needed, "applies at the next start");
        assert_eq!(
            s.comfyui_root,
            data.join("comfyui").to_string_lossy(),
            "the running one is where it started"
        );
        assert_eq!(
            saved(&data)["comfyuiInstallDir"],
            spot.to_string_lossy().as_ref()
        );
        let s = b.set_comfyui_install_dir(None).unwrap();
        assert!(s.comfyui_install_dir.is_none() && !s.restart_needed);
        assert!(saved(&data)["comfyuiInstallDir"].is_null());
    }

    #[test]
    fn the_comfyui_install_folder_must_be_empty_or_hold_an_install_and_not_be_the_data_folder() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        let full = base.path().join("full");
        std::fs::create_dir_all(&full).unwrap();
        std::fs::write(full.join("a.txt"), "x").unwrap();
        assert!(b.set_comfyui_install_dir(Some(&full)).is_err());
        assert!(b.set_comfyui_install_dir(Some(&data)).is_err());
        assert!(
            b.set_comfyui_install_dir(Some(base.path())).is_err(),
            "a folder that holds the data folder"
        );
        assert!(b
            .set_comfyui_install_dir(Some(Path::new("relative")))
            .is_err());
        // A folder that already holds an install is taken as it is.
        let made = base.path().join("made");
        let main = crate::comfy::install::comfyui_dir(&made).join("main.py");
        std::fs::create_dir_all(main.parent().unwrap()).unwrap();
        std::fs::write(main, "").unwrap();
        assert!(b.set_comfyui_install_dir(Some(&made)).is_ok());
        assert!(saved(&data)["comfyuiInstallDir"].is_string());
    }

    #[test]
    fn the_civitai_lookup_is_off_until_saved_and_applies_at_the_next_start() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        assert!(!b.civitai_lookup_at_start());
        assert!(!b.engine_settings().unwrap().civitai_lookup);
        let s = b
            .set_engine_settings(EngineSettingsPatch {
                civitai_lookup: Some(true),
                ..Default::default()
            })
            .unwrap();
        assert!(s.civitai_lookup && s.restart_needed);
        assert_eq!(saved(&data)["civitaiLookup"], true);
        // The running app still has it off: the lookup runs at start only.
        assert!(!b.civitai_lookup_at_start());
    }

    #[test]
    fn a_patch_with_one_bad_value_writes_nothing() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        let before = saved(&data);
        for patch in [
            EngineSettingsPatch {
                comfyui_package: Some("amd".into()),
                comfyui_start_timeout_secs: Some(29),
                ..Default::default()
            },
            EngineSettingsPatch {
                comfyui_package: Some("../amd".into()),
                comfyui_start_timeout_secs: Some(600),
                ..Default::default()
            },
            EngineSettingsPatch {
                comfyui_package: None,
                comfyui_start_timeout_secs: Some(1801),
                ..Default::default()
            },
        ] {
            assert!(matches!(
                b.set_engine_settings(patch),
                Err(BackendError::Invalid(_))
            ));
        }
        assert_eq!(saved(&data), before);
    }

    #[test]
    fn the_patch_refuses_fields_it_does_not_know() {
        let bad =
            serde_json::json!({ "comfyuiUrl": "http://evil.example", "comfyuiPackage": "amd" });
        assert!(serde_json::from_value::<EngineSettingsPatch>(bad).is_err());
        let fraction = serde_json::json!({ "comfyuiStartTimeoutSecs": 30.5 });
        assert!(serde_json::from_value::<EngineSettingsPatch>(fraction).is_err());
        let negative = serde_json::json!({ "comfyuiStartTimeoutSecs": -60 });
        assert!(serde_json::from_value::<EngineSettingsPatch>(negative).is_err());
    }

    #[test]
    fn model_folders_are_added_checked_and_removed() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let models = base.path().join("Models");
        let more = base.path().join("More");
        std::fs::create_dir_all(&models).unwrap();
        std::fs::create_dir_all(&more).unwrap();
        let b = open(&data, quiet());

        let s = b.add_model_root(&models).unwrap();
        assert_eq!(s.model_roots, [models.to_string_lossy()]);
        assert!(s.restart_needed);
        assert!(matches!(
            b.add_model_root(&models),
            Err(BackendError::Invalid(_))
        ));
        assert!(matches!(
            b.add_model_root(&data.join("models")),
            Err(BackendError::Invalid(_))
        ));
        let s = b.add_model_root(&more).unwrap();
        assert_eq!(s.model_roots.len(), 2);
        assert_eq!(saved(&data)["gpuLock"], "", "other keys are kept");

        assert!(matches!(
            b.remove_model_root(2),
            Err(BackendError::Invalid(_))
        ));
        assert!(matches!(
            b.remove_model_root(usize::MAX),
            Err(BackendError::Invalid(_))
        ));
        let s = b.remove_model_root(0).unwrap();
        assert_eq!(s.model_roots, [more.to_string_lossy()]);
        let s = b.remove_model_root(0).unwrap();
        assert!(s.model_roots.is_empty());
        assert!(!s.restart_needed, "back to what the app started with");
    }

    #[test]
    fn no_more_than_the_limit_of_model_folders() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        for i in 0..settings::MAX_MODEL_ROOTS {
            let dir = base.path().join(format!("m{i}"));
            std::fs::create_dir_all(&dir).unwrap();
            assert!(b.check_model_root_room().is_ok());
            b.add_model_root(&dir).unwrap();
        }
        let extra = base.path().join("extra");
        std::fs::create_dir_all(&extra).unwrap();
        assert!(b.check_model_root_room().is_err());
        assert!(matches!(
            b.add_model_root(&extra),
            Err(BackendError::Invalid(_))
        ));
        assert_eq!(
            b.engine_settings().unwrap().model_roots.len(),
            settings::MAX_MODEL_ROOTS
        );
    }

    #[test]
    fn a_folder_or_url_engine_is_shown_as_saved() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(
            &data,
            Settings {
                comfyui_url: Some("http://127.0.0.1:8188".into()),
                ..quiet()
            },
        );
        let s = b.engine_settings().unwrap();
        assert_eq!(s.comfyui_mode, ComfyuiMode::Url);
        assert_eq!(s.comfyui_url.as_deref(), Some("http://127.0.0.1:8188"));
    }

    /// A ComfyUI install in the data folder: its `main.py` in the package folder, as an install leaves it.
    fn fake_install(data: &Path) {
        let comfy = data.join("comfyui").join("portable").join("ComfyUI");
        std::fs::create_dir_all(&comfy).unwrap();
        std::fs::write(comfy.join("main.py"), "").unwrap();
    }

    #[test]
    fn the_settings_say_whether_the_install_is_there_and_which_package_it_came_from() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        let s = b.engine_settings().unwrap();
        assert!(!s.comfyui_installed);
        assert_eq!(s.installed_comfyui_package, None);
        fake_install(&data);
        std::fs::write(data.join("comfyui/portable/novira-package.txt"), "amd").unwrap();
        let s = b.engine_settings().unwrap();
        assert!(s.comfyui_installed);
        assert_eq!(s.installed_comfyui_package, Some(ComfyuiPackage::Amd));
    }

    #[test]
    fn a_package_change_first_records_an_install_that_has_no_record() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        // The default package is nvidia, and this install has no record (it was made before the record existed).
        fake_install(&data);
        let s = b
            .set_engine_settings(EngineSettingsPatch {
                comfyui_package: Some("amd".into()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(s.comfyui_package, ComfyuiPackage::Amd);
        assert_eq!(s.installed_comfyui_package, Some(ComfyuiPackage::Nvidia));
        assert!(s.restart_needed);
        assert_eq!(
            std::fs::read_to_string(data.join("comfyui/portable/novira-package.txt")).unwrap(),
            "nvidia"
        );
    }

    #[test]
    fn a_broken_settings_file_is_an_error_and_is_left_alone() {
        let base = tempfile::tempdir().unwrap();
        let data = base.path().join("novira-data");
        let b = open(&data, quiet());
        std::fs::write(data.join(SETTINGS_FILE), "{").unwrap();
        assert!(b.engine_settings().is_err());
        assert!(b.remove_model_root(0).is_err());
        assert_eq!(
            std::fs::read_to_string(data.join(SETTINGS_FILE)).unwrap(),
            "{"
        );
    }
}
