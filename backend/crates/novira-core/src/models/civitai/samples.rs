//! The generation settings Civitai keeps with its example pictures: what a model's authors and users made it with.
//!
//! Read from `GET /api/v1/images?modelVersionId=..&withMeta=true`. Civitai leaves `meta` free-form (each tool writes its own
//! keys) and the uploader may leave it out, so every field is optional and a picture without a prompt is dropped.
use super::thumbnail_url;
use crate::models::install::civitai_api;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// How many examples one request asks for (and so the most the panel shows).
pub const SAMPLE_LIMIT: usize = 24;

/// A model, LoRA, embedding or VAE an example used.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleResource {
    /// `checkpoint`, `lora`, `embed`, `vae` or another word Civitai wrote, lower case.
    pub kind: String,
    /// The name the picture recorded; none when it only recorded the version.
    pub name: Option<String>,
    /// Civitai's id of the model version, when the picture recorded it.
    pub version_id: Option<String>,
    pub weight: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sample {
    pub id: String,
    /// A small picture to tell the examples apart.
    pub image_url: String,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub seed: Option<u64>,
    pub steps: Option<u32>,
    pub cfg_scale: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub clip_skip: Option<u32>,
    /// Civitai's name for the sampler and scheduler together (`DPM++ 2M Karras`).
    pub sampler: Option<String>,
    pub resources: Vec<SampleResource>,
}

/// The query for one version's examples. Mature pictures only come back when asked for: Civitai's `nsfw=None` is the plain
/// level and `nsfw=true` every level above it, so a request that wants both sends two.
pub fn queries(version_id: &str, include_nsfw: bool) -> Vec<Vec<(String, String)>> {
    let one = |nsfw: &str| {
        vec![
            ("modelVersionId".to_string(), version_id.to_string()),
            ("withMeta".into(), "true".into()),
            ("type".into(), "image".into()),
            ("sort".into(), "Most Reactions".into()),
            ("limit".into(), SAMPLE_LIMIT.to_string()),
            ("nsfw".into(), nsfw.into()),
        ]
    };
    if include_nsfw {
        vec![one("None"), one("true")]
    } else {
        vec![one("None")]
    }
}

fn number(v: &Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.trim().parse().ok()))
        .filter(|n| n.is_finite())
}

fn whole(v: &Value) -> Option<u64> {
    number(v)
        .filter(|n| *n >= 0.0 && *n <= 9_007_199_254_740_991.0)
        .map(|n| n as u64)
}

fn text(v: &Value) -> Option<String> {
    v.as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// The size, from `Size: "832x1216"` or from separate `width` and `height`.
fn size(meta: &Value) -> (Option<u32>, Option<u32>) {
    let from_text = meta["Size"].as_str().and_then(|s| {
        let (w, h) = s.split_once(['x', 'X'])?;
        Some((w.trim().parse::<u32>().ok()?, h.trim().parse::<u32>().ok()?))
    });
    let (w, h) = from_text.map_or_else(
        || (whole(&meta["width"]), whole(&meta["height"])),
        |(w, h)| (Some(w as u64), Some(h as u64)),
    );
    let ok = |n: Option<u64>| n.filter(|n| (1..=16384).contains(n)).map(|n| n as u32);
    match (ok(w), ok(h)) {
        (Some(w), Some(h)) => (Some(w), Some(h)),
        _ => (None, None),
    }
}

/// The version id at the end of an AIR address (`urn:air:sd1:checkpoint:civitai:4384@128713`) and its kind.
fn air(address: &str) -> Option<(String, String)> {
    let rest = address.strip_prefix("urn:air:")?;
    let mut parts = rest.split(':');
    let kind = parts.nth(1)?.to_ascii_lowercase();
    let (_, version) = parts.next_back()?.split_once('@')?;
    let digits = version.chars().all(|c| c.is_ascii_digit()) && !version.is_empty();
    digits.then(|| (kind, version.to_string()))
}

fn resources(meta: &Value) -> Vec<SampleResource> {
    let mut out = Vec::new();
    for r in meta["civitaiResources"].as_array().into_iter().flatten() {
        let version_id = r["modelVersionId"].as_u64().map(|n| n.to_string());
        if version_id.is_none() {
            continue;
        }
        out.push(SampleResource {
            kind: text(&r["type"]).unwrap_or_default().to_ascii_lowercase(),
            name: None,
            version_id,
            weight: number(&r["weight"]),
        });
    }
    // Older pictures list `resources` by name; pictures made on Civitai itself also carry the checkpoint as an AIR address.
    if out.is_empty() {
        for r in meta["resources"].as_array().into_iter().flatten() {
            let Some(name) = text(&r["name"]) else {
                continue;
            };
            out.push(SampleResource {
                kind: text(&r["type"]).unwrap_or_default().to_ascii_lowercase(),
                name: Some(name),
                version_id: None,
                weight: number(&r["weight"]),
            });
        }
    }
    if !out
        .iter()
        .any(|r| r.kind == "checkpoint" || r.kind == "model")
    {
        let addresses =
            std::iter::once(&meta["Model"]).chain(meta["models"].as_array().into_iter().flatten());
        let found = addresses.filter_map(text).find_map(|a| air(&a));
        if let Some((kind, version)) = found {
            out.insert(
                0,
                SampleResource {
                    kind,
                    name: None,
                    version_id: Some(version),
                    weight: None,
                },
            );
        } else if let Some(name) = text(&meta["Model"]).filter(|m| !m.starts_with("urn:")) {
            out.insert(
                0,
                SampleResource {
                    kind: "checkpoint".into(),
                    name: Some(name),
                    version_id: None,
                    weight: None,
                },
            );
        }
    }
    out.truncate(16);
    out
}

fn sample(image: &Value) -> Option<Sample> {
    let meta = &image["meta"];
    let prompt = text(&meta["prompt"])?;
    let (width, height) = size(meta);
    Some(Sample {
        id: image["id"].as_u64()?.to_string(),
        image_url: thumbnail_url(image["url"].as_str()?),
        prompt,
        negative_prompt: text(&meta["negativePrompt"]),
        seed: whole(&meta["seed"]),
        steps: whole(&meta["steps"])
            .filter(|n| (1..=1000).contains(n))
            .map(|n| n as u32),
        cfg_scale: number(&meta["cfgScale"]).filter(|n| (0.0..=100.0).contains(n)),
        width,
        height,
        clip_skip: whole(&meta["clipSkip"])
            .filter(|n| (1..=12).contains(n))
            .map(|n| n as u32),
        sampler: text(&meta["sampler"]),
        resources: resources(meta),
    })
}

/// The examples of one answer, those with a prompt, each picture once.
pub fn map_samples(body: &Value) -> Vec<Sample> {
    let mut seen = std::collections::HashSet::new();
    body["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|i| i["type"].as_str().is_none_or(|t| t == "image"))
        .filter_map(sample)
        .filter(|s| seen.insert(s.id.clone()))
        .collect()
}

/// A version id is digits only: it goes into a query, and Civitai's ids are numbers.
pub fn is_version_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 12 && id.bytes().all(|b| b.is_ascii_digit())
}

pub async fn fetch(
    http: &reqwest::Client,
    version_id: &str,
    include_nsfw: bool,
    api_key: Option<&str>,
) -> Result<Vec<Sample>, String> {
    if !is_version_id(version_id) {
        return Err("not a Civitai version id".into());
    }
    let requests = queries(version_id, include_nsfw)
        .into_iter()
        .map(|q| async move {
            let mut req = http.get(format!("{}/images", civitai_api())).query(&q);
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
            Ok(map_samples(&body))
        });
    let answers = futures_util::future::join_all(requests).await;
    let mut out = Vec::new();
    let mut failure = None;
    for a in answers {
        match a {
            Ok(mut s) => out.append(&mut s),
            Err(e) => failure = Some(e),
        }
    }
    // The plain examples are the answer; the mature ones are extra and may fail alone.
    if out.is_empty() {
        if let Some(e) = failure {
            return Err(e);
        }
    }
    let mut seen = std::collections::HashSet::new();
    out.retain(|s| seen.insert(s.id.clone()));
    out.truncate(SAMPLE_LIMIT);
    Ok(out)
}

#[cfg(test)]
mod tests;
