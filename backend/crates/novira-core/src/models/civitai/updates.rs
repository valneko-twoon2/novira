//! Telling whether a Civitai model the user installed has a newer version.
//!
//! An installed model remembers its page (`https://civitai.com/models/<model>?modelVersionId=<version>`). One request per fifty
//! models asks Civitai for those models by id, and each is compared with its own newest version of the same base model: a model
//! page often holds an SDXL and a Flux version side by side, and neither is an update of the other.
use crate::models::install::civitai_api;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// How many models one request asks about.
const CHUNK: usize = 50;

/// An installed model that has a newer version.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUpdate {
    /// The key of the installed model.
    pub key: String,
    pub model_id: String,
    pub installed_version_id: String,
    pub latest_version_id: String,
    pub latest_name: String,
    /// When the newer version came out (epoch ms).
    pub published_at: i64,
    /// The newer version's page on civitai.com.
    pub page_url: String,
}

/// An installed model as the check sees it: its key and the ids its page names.
#[derive(Debug, Clone, PartialEq)]
pub struct Installed {
    pub key: String,
    pub model_id: String,
    pub version_id: String,
}

fn digits(s: &str) -> bool {
    !s.is_empty() && s.len() <= 12 && s.bytes().all(|b| b.is_ascii_digit())
}

/// The model id and version id of a Civitai page address; none for any other address or one without a version.
pub fn ids_of_page(url: &str) -> Option<(String, String)> {
    let rest = url.strip_prefix("https://civitai.com/models/")?;
    let (model, query) = rest.split_once("?modelVersionId=")?;
    let version = query.split(['&', '#']).next()?;
    (digits(model) && digits(version)).then(|| (model.to_string(), version.to_string()))
}

fn epoch_ms(v: &Value) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(v.as_str()?)
        .ok()
        .map(|d| d.timestamp_millis())
}

/// Whether a version can be downloaded by anyone: public and not behind payment.
fn free(v: &Value) -> bool {
    v["availability"].as_str().is_none_or(|a| a == "Public") && !v["paidAccess"].is_object()
}

/// The installed models of one answer that have a newer version.
pub fn updates_in(body: &Value, installed: &[Installed]) -> Vec<ModelUpdate> {
    let mut out = Vec::new();
    for item in body["items"].as_array().into_iter().flatten() {
        let Some(model_id) = item["id"].as_u64().map(|n| n.to_string()) else {
            continue;
        };
        let versions = item["modelVersions"]
            .as_array()
            .map_or(&[][..], Vec::as_slice);
        for have in installed.iter().filter(|i| i.model_id == model_id) {
            let Some(current) = versions.iter().find(|v| {
                v["id"].as_u64().map(|n| n.to_string()).as_deref() == Some(&have.version_id)
            }) else {
                continue;
            };
            let (Some(base), Some(since)) = (
                current["baseModel"].as_str(),
                epoch_ms(&current["publishedAt"]),
            ) else {
                continue;
            };
            let newest = versions
                .iter()
                .filter(|v| free(v) && v["baseModel"].as_str() == Some(base))
                .filter_map(|v| Some((v, epoch_ms(&v["publishedAt"])?)))
                .filter(|(_, at)| *at > since)
                .max_by_key(|(_, at)| *at);
            let Some((latest, at)) = newest else {
                continue;
            };
            let Some(latest_id) = latest["id"].as_u64().map(|n| n.to_string()) else {
                continue;
            };
            out.push(ModelUpdate {
                key: have.key.clone(),
                model_id: model_id.clone(),
                installed_version_id: have.version_id.clone(),
                page_url: format!(
                    "https://civitai.com/models/{model_id}?modelVersionId={latest_id}"
                ),
                latest_name: latest["name"].as_str().unwrap_or_default().to_string(),
                latest_version_id: latest_id,
                published_at: at,
            });
        }
    }
    out
}

/// Asks Civitai about the installed models and returns those with a newer version. A chunk that fails is skipped unless every
/// one fails. Adult models are only returned with `nsfw=true`, which is asked for here because the models are already installed.
pub async fn check(
    http: &reqwest::Client,
    installed: &[Installed],
    api_key: Option<&str>,
) -> Result<Vec<ModelUpdate>, String> {
    let mut ids: Vec<&str> = installed.iter().map(|i| i.model_id.as_str()).collect();
    ids.sort_unstable();
    ids.dedup();
    let requests = ids.chunks(CHUNK).map(|chunk| async move {
        let mut req = http.get(format!("{}/models", civitai_api())).query(&[
            ("ids", chunk.join(",")),
            ("limit", chunk.len().to_string()),
            ("nsfw", "true".into()),
        ]);
        if let Some(k) = api_key {
            req = req.bearer_auth(k);
        }
        let res = req
            .send()
            .await
            .map_err(|e| format!("Civitai request failed: {e}"))?;
        if !res.status().is_success() {
            return Err(format!("Civitai answered {}", res.status()));
        }
        let body: Value = res
            .json()
            .await
            .map_err(|e| format!("Unexpected Civitai response: {e}"))?;
        Ok(updates_in(&body, installed))
    });
    let mut out = Vec::new();
    let mut failure = None;
    let mut any = ids.is_empty();
    for answer in futures_util::future::join_all(requests).await {
        match answer {
            Ok(mut u) => {
                any = true;
                out.append(&mut u);
            }
            Err(e) => failure = Some(e),
        }
    }
    if !any {
        return Err(failure.unwrap_or_default());
    }
    out.sort_by(|a, b| a.key.cmp(&b.key));
    Ok(out)
}

#[cfg(test)]
mod tests;
