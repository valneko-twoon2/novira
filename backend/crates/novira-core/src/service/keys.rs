//! The Civitai key and Hugging Face token: saved encrypted, held in memory, never handed out.
use super::*;
use crate::sync::RwLockExt;

impl Backend {
    pub(super) fn civitai_key(&self) -> Option<String> {
        self.inner.civitai_key.read_safe().clone()
    }

    pub(super) fn hf_token(&self) -> Option<String> {
        self.inner.hf_token.read_safe().clone()
    }

    /// Whether a Hugging Face token is set. The token itself is never handed out.
    pub fn has_hf_token(&self) -> bool {
        self.hf_token().is_some()
    }

    /// Saves the token encrypted (a blank one removes it) and uses it from now on.
    pub fn set_hf_token(&self, token: Option<String>) -> Result<()> {
        let token = token
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty());
        secret::save_secret(&self.inner.data_dir, Secret::HuggingFace, token.as_deref())
            .map_err(BackendError::Internal)?;
        *self.inner.hf_token.write_safe() = token;
        Ok(())
    }

    /// Whether a Civitai key is set. The key itself is never handed out.
    pub fn has_civitai_key(&self) -> bool {
        self.civitai_key().is_some()
    }

    /// Saves the key encrypted (a blank one removes it) and uses it from now on.
    pub fn set_civitai_key(&self, key: Option<String>) -> Result<()> {
        let key = key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty());
        secret::save_civitai_key(&self.inner.data_dir, key.as_deref())
            .map_err(BackendError::Internal)?;
        *self.inner.civitai_key.write_safe() = key;
        Ok(())
    }
}
