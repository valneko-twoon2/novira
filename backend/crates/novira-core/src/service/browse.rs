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

    /// The generation settings Civitai keeps with the example pictures of one model version.
    pub async fn civitai_samples(
        &self,
        version_id: &str,
        include_nsfw: bool,
    ) -> Result<Vec<civitai::samples::Sample>> {
        civitai::samples::fetch(
            &self.inner.search_http,
            version_id,
            include_nsfw,
            self.civitai_key().as_deref(),
        )
        .await
        .map_err(BackendError::Internal)
    }

    /// The installed Civitai models that have a newer version of the same base model. A model that did not come from Civitai,
    /// or whose page names no version, is not asked about.
    pub async fn check_model_updates(&self) -> Result<Vec<civitai::updates::ModelUpdate>> {
        let installed: Vec<civitai::updates::Installed> = self
            .state()
            .models
            .iter()
            .filter_map(|m| {
                let (model_id, version_id) = civitai::updates::ids_of_page(m.page_url.as_deref()?)?;
                Some(civitai::updates::Installed {
                    key: m.key.clone(),
                    model_id,
                    version_id,
                })
            })
            .collect();
        if installed.is_empty() {
            return Ok(Vec::new());
        }
        civitai::updates::check(
            &self.inner.search_http,
            &installed,
            self.civitai_key().as_deref(),
        )
        .await
        .map_err(BackendError::Internal)
    }
}
