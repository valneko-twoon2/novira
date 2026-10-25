//! Backup and restore of the user's data (`crate::backup`). The shell asks for the file in a native dialog
//! and passes the chosen path here; the WebView never sends one.
use super::*;
use crate::backup::{
    self, archive, restore, BackupInfo, BackupPhase, BackupProgress, BackupSummary, RestoreOutcome,
};

/// Progress events at most this often (a backup can hold thousands of files).
const PROGRESS_EVERY: Duration = Duration::from_millis(150);

impl Backend {
    /// A progress callback that sends `backup` events, at most every `PROGRESS_EVERY` (the last one always).
    fn progress_sink(&self, phase: BackupPhase) -> impl FnMut(u32, u32) {
        let this = self.clone();
        let mut last: Option<Instant> = None;
        move |done, total| {
            let now = Instant::now();
            if done < total && last.is_some_and(|t| now.duration_since(t) < PROGRESS_EVERY) {
                return;
            }
            last = Some(now);
            this.emit(BackendEvent::Backup {
                progress: BackupProgress { phase, done, total },
            });
        }
    }

    /// Checks the frontend's saved state before the shell asks where to save, so a bad request fails without a dialog.
    pub fn check_ui_state(&self, ui_state: &str) -> Result<()> {
        backup::check_ui_state(ui_state).map_err(BackendError::Invalid)
    }

    /// Writes a backup of the database, the gallery files and `ui_state` to `target` (chosen by the user).
    pub async fn create_backup(&self, ui_state: String, target: PathBuf) -> Result<BackupSummary> {
        self.check_ui_state(&ui_state)?;
        let this = self.clone();
        tokio::task::spawn_blocking(move || -> Result<BackupSummary> {
            let work = this
                .inner
                .data_dir
                .join("cache")
                .join(format!("backup-{}", uuid::Uuid::new_v4().simple()));
            std::fs::create_dir_all(&work).map_err(internal)?;
            let result = this.write_backup(&ui_state, &target, &work);
            let _ = std::fs::remove_dir_all(&work);
            result
        })
        .await
        .map_err(internal)?
    }

    fn write_backup(&self, ui_state: &str, target: &Path, work: &Path) -> Result<BackupSummary> {
        let database = work.join(crate::db::DB_FILE);
        self.db().backup_to(&database)?;
        // The copy decides what the backup holds: the gallery files of the images it lists.
        let (images, boards, workflows) = {
            let copy = Db::open(work)?;
            let images: Vec<ImageDTO> = copy.load(Table::Images)?;
            let boards = copy.load::<Value>(Table::Boards)?.len();
            let workflows = copy.load::<Value>(Table::Workflows)?.len();
            (images, boards, workflows)
        };
        let files = &self.inner.files;
        let mut originals = Vec::new();
        let mut thumbnails = Vec::new();
        for image in &images {
            if let Some(path) = files.original_path(&image.name) {
                originals.push((image.name.clone(), path));
            }
            if let Some(path) = files.thumbnail_path(&image.name).filter(|p| p.is_file()) {
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default();
                thumbnails.push((name, path));
            }
        }
        let info = BackupInfo {
            app_version: env!("CARGO_PKG_VERSION").into(),
            created_at: now(),
            images: images.len() as u32,
            boards: boards as u32,
            workflows: workflows as u32,
        };
        let contents = archive::Contents {
            info: info.clone(),
            database: &database,
            ui_state,
            originals,
            thumbnails,
        };
        let bytes = archive::write(target, &contents, self.progress_sink(BackupPhase::Create))
            .map_err(|e| BackendError::Internal(format!("cannot write the backup: {e}")))?;
        Ok(BackupSummary {
            file_name: target
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            bytes,
            info,
        })
    }

    /// Checks a backup zip (chosen by the user) and unpacks it to be applied at the next start. Returns what it holds
    /// so the user can confirm.
    pub async fn stage_restore(&self, zip: PathBuf) -> Result<BackupInfo> {
        let this = self.clone();
        tokio::task::spawn_blocking(move || {
            restore::stage(
                &zip,
                &this.inner.data_dir,
                this.progress_sink(BackupPhase::Restore),
            )
            .map_err(BackendError::Invalid)
        })
        .await
        .map_err(internal)?
    }

    /// The user confirmed: the unpacked backup replaces the current data at the next start.
    pub fn confirm_restore(&self) -> Result<()> {
        restore::mark_ready(&self.inner.data_dir).map_err(BackendError::Invalid)
    }

    /// The user changed their mind: the unpacked backup is removed.
    pub fn discard_restore(&self) -> Result<()> {
        restore::discard(&self.inner.data_dir).map_err(internal)
    }

    /// What this start did with a confirmed restore; answered once.
    pub fn take_restore_outcome(&self) -> RestoreOutcome {
        restore::take_outcome(&self.inner.data_dir)
    }
}
