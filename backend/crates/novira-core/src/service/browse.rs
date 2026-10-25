//! Searching the model sites for the Browse tab.
use super::*;

impl Backend {
    pub async fn search_civitai(
        &self,
        params: civitai::SearchParams,
    ) -> Result<civitai::SearchResult> {
        if params.source == "huggingface" {
            return huggingface::search(
                &self.inner.search_http,
                &params,
                self.hf_token().as_deref(),
            )
            .await
            .map_err(BackendError::Internal);
        }
        civitai::search(
            &self.inner.search_http,
            &params,
            self.civitai_key().as_deref(),
        )
        .await
        .map_err(BackendError::Internal)
    }
}
