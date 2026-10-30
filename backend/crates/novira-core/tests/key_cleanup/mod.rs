//! Removes the site keys a test saved, even when it fails: they live in the Windows Credential Manager, which a deleted
//! temporary data folder does not clear, and it refuses new entries when old ones pile up. Declare it after the data
//! folder so it is dropped first.
use novira_core::secret::{save_secret, Secret};
use std::path::{Path, PathBuf};

pub struct KeyCleanup(PathBuf);

impl KeyCleanup {
    pub fn new(data_dir: &Path) -> Self {
        Self(data_dir.to_path_buf())
    }
}

impl Drop for KeyCleanup {
    fn drop(&mut self) {
        for which in [Secret::Civitai, Secret::HuggingFace] {
            let _ = save_secret(&self.0, which, None);
        }
    }
}
