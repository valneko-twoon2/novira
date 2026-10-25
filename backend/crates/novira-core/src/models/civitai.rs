//! Civitai model search for the Browse tab: request building and mapping the public API to the frontend shape.
use crate::models::install::civitai_api;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchParams {
    pub query: String,
    pub kind: String,
    pub base_model: String,
    pub sort: String,
    pub period: String,
    pub include_nsfw: bool,
    #[serde(default)]
    pub cursor: Option<String>,
    /// `civitai` (default) or `huggingface`.
    #[serde(default = "default_source")]
    pub source: String,
    /// Permission keys (see `PERMISSION_KEYS`) the license must allow; a model must allow every one of them.
    #[serde(default)]
    pub licenses: Vec<String>,
    /// Checkpoints only: `Trained` or `Merge` (empty: either).
    #[serde(default)]
    pub checkpoint_type: String,
    /// Only models with a `.safetensors` file in their newest version.
    #[serde(default)]
    pub safetensors_only: bool,
    /// Only models of this creator (empty: anyone).
    #[serde(default)]
    pub creator: String,
}

fn default_source() -> String {
    "civitai".into()
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CivitaiFile {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub format: String,
    pub precision: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CivitaiVersion {
    pub id: String,
    pub name: String,
    pub base_model: String,
    pub created_at: i64,
    pub trigger_words: Vec<String>,
    pub files: Vec<CivitaiFile>,
}

pub use crate::types::Permission;

pub const PERMISSION_KEYS: [&str; 6] = [
    "sellImages",
    "generationServices",
    "sellModel",
    "shareMerges",
    "differentLicense",
    "noCredit",
];

/// Pairs `PERMISSION_KEYS` with their answers, in that order.
pub fn permission_list(answers: [Option<bool>; 6]) -> Vec<Permission> {
    PERMISSION_KEYS
        .iter()
        .zip(answers)
        .map(|(key, allowed)| Permission {
            key: (*key).to_string(),
            allowed,
        })
        .collect()
}

/// The commercial-use summary of a permission list, from its three commercial uses (selling the generated images, use on
/// generation services, selling the model): `allowed` when all three are allowed, `denied` when none is, `limited`
/// otherwise (some allowed, or some not stated). The tag on a model then never says more than its list.
pub fn commercial_of(permissions: &[Permission]) -> &'static str {
    let answers: Vec<Option<bool>> = PERMISSION_KEYS[..3]
        .iter()
        .map(|k| {
            permissions
                .iter()
                .find(|p| p.key == *k)
                .and_then(|p| p.allowed)
        })
        .collect();
    if answers.iter().all(|a| *a == Some(true)) {
        "allowed"
    } else if answers.iter().all(|a| *a == Some(false)) {
        "denied"
    } else {
        "limited"
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CivitaiModel {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub base_model: String,
    pub creator: String,
    pub downloads: u64,
    pub likes: u64,
    pub rating: f64,
    pub rating_count: u64,
    pub created_at: i64,
    pub nsfw: bool,
    pub image_count: u32,
    /// Cover images hosted by Civitai (the frontend shows these as they are).
    pub image_urls: Vec<String>,
    pub tags: Vec<String>,
    pub description: String,
    pub license: Vec<String>,
    pub commercial: String,
    /// Each use the license allows or forbids, shown when the commercial-use tag is opened.
    pub permissions: Vec<Permission>,
    pub trigger_words: Vec<String>,
    /// Where the model comes from: `civitai` or `huggingface`.
    pub source: String,
    pub versions: Vec<CivitaiVersion>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub items: Vec<CivitaiModel>,
    pub next_cursor: Option<String>,
}

pub const SDXL_COMPATIBLE: &[&str] = &["SDXL 1.0", "Illustrious", "NoobAI", "Pony"];
const PAGE_SIZE: &str = "24";

/// Query pairs for `GET /models`.
/// Base models of the video (and other non-Stable-Diffusion) diffusion models that are shown under "Diffusion".
pub const DIFFUSION_BASES: &[&str] = &[
    "Wan Video",
    "Wan Video 1.3B t2v",
    "Wan Video 14B t2v",
    "Wan Video 14B i2v 480p",
    "Wan Video 14B i2v 720p",
    "Wan Video 2.2 I2V-A14B",
    "Wan Video 2.2 T2V-A14B",
    "Wan Video 2.2 TI2V-5B",
    "Hunyuan Video",
    "LTXV",
];

/// Whether a version's base model is one of the diffusion models that load from ComfyUI's `diffusion_models` folder.
pub fn is_diffusion_base(base: &str) -> bool {
    base.starts_with("Wan Video") || base.starts_with("Hunyuan Video") || base.starts_with("LTXV")
}

pub fn query(p: &SearchParams) -> Vec<(String, String)> {
    query_with(p, &bases(p), PAGE_SIZE, p.cursor.as_deref())
}

/// The base models a search asks for (none: any base model).
fn bases(p: &SearchParams) -> Vec<String> {
    let list = |l: &[&str]| l.iter().map(|b| b.to_string()).collect();
    match p.base_model.as_str() {
        "all" | "" if p.kind == "Diffusion" => list(DIFFUSION_BASES),
        "all" | "" => Vec::new(),
        "sdxl-compat" => list(SDXL_COMPATIBLE),
        exact => vec![exact.to_string()],
    }
}

/// The license filters Civitai can apply itself. `allowCommercialUse` is given every level asked for, so an answer is never narrower
/// than the filter wants; `keep` makes it exact.
fn license_query(licenses: &[String]) -> Vec<(String, String)> {
    let mut q = Vec::new();
    for key in licenses {
        match key.as_str() {
            "sellImages" => q.push(("allowCommercialUse".into(), "Image".into())),
            "generationServices" => q.push(("allowCommercialUse".into(), "Rent".into())),
            "sellModel" => q.push(("allowCommercialUse".into(), "Sell".into())),
            "shareMerges" => q.push(("allowDerivatives".into(), "true".into())),
            "differentLicense" => q.push(("allowDifferentLicense".into(), "true".into())),
            "noCredit" => q.push(("allowNoCredit".into(), "true".into())),
            _ => {}
        }
    }
    q
}

/// Whether a model passes the filters of the search that the model site does not apply for sure: every asked-for permission
/// is allowed, and, when asked, it has a `.safetensors` file.
fn keep(m: &CivitaiModel, p: &SearchParams) -> bool {
    let allowed = |key: &str| {
        m.permissions
            .iter()
            .any(|x| x.key == key && x.allowed == Some(true))
    };
    p.licenses.iter().all(|k| allowed(k))
        && (!p.safetensors_only
            || m.versions
                .first()
                .is_some_and(|v| v.files.iter().any(|f| f.format == "SafeTensor")))
}

/// `query` for the given base models, page size and cursor.
fn query_with(
    p: &SearchParams,
    bases: &[String],
    limit: &str,
    cursor: Option<&str>,
) -> Vec<(String, String)> {
    let mut q: Vec<(String, String)> = vec![("limit".into(), limit.into())];
    if !p.query.trim().is_empty() {
        q.push(("query".into(), p.query.trim().into()));
    }
    let types: &[&str] = match p.kind.as_str() {
        "LoRA" => &["LORA", "LoCon"],
        "Checkpoint" | "Diffusion" => &["Checkpoint"],
        "ControlNet" => &["Controlnet"],
        "VAE" => &["VAE"],
        _ => &["Checkpoint", "LORA", "LoCon", "Controlnet", "VAE"],
    };
    q.extend(types.iter().map(|t| ("types".to_string(), t.to_string())));
    q.extend(bases.iter().map(|b| ("baseModels".to_string(), b.clone())));
    q.extend(license_query(&p.licenses));
    if matches!(p.checkpoint_type.as_str(), "Trained" | "Merge") {
        q.push(("checkpointType".into(), p.checkpoint_type.clone()));
    }
    if !p.creator.trim().is_empty() {
        q.push(("username".into(), p.creator.trim().into()));
    }
    let sort = match p.sort.as_str() {
        "rating" => "Highest Rated",
        "newest" => "Newest",
        _ => "Most Downloaded",
    };
    q.push(("sort".into(), sort.into()));
    let period = match p.period.as_str() {
        "year" => "Year",
        "month" => "Month",
        "week" => "Week",
        "day" => "Day",
        _ => "AllTime",
    };
    q.push(("period".into(), period.into()));
    q.push(("nsfw".into(), p.include_nsfw.to_string()));
    if let Some(c) = cursor.filter(|c| !c.is_empty()) {
        q.push(("cursor".into(), c.to_string()));
    }
    q
}

fn kind_of(t: &str) -> Option<&'static str> {
    Some(match t {
        "LORA" | "LoCon" | "DoRA" => "LoRA",
        "Checkpoint" => "Checkpoint",
        "Controlnet" => "ControlNet",
        "VAE" => "VAE",
        _ => return None,
    })
}

fn epoch_ms(v: &Value) -> i64 {
    v.as_str()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.timestamp_millis())
        .unwrap_or(0)
}

fn strings(v: &Value) -> Vec<String> {
    match v {
        Value::Array(a) => a
            .iter()
            .filter_map(|x| x.as_str().map(str::to_string))
            .collect(),
        Value::String(s) if !s.is_empty() && s != "None" => vec![s.clone()],
        _ => Vec::new(),
    }
}

/// The permissions a creator set on Civitai (`allowCommercialUse`, `allowDerivatives`, `allowDifferentLicense`,
/// `allowNoCredit`). A missing flag stays unknown.
pub fn permissions(m: &Value) -> Vec<Permission> {
    let allowed = strings(&m["allowCommercialUse"]);
    let has = |k: &str| allowed.iter().any(|a| a == k);
    permission_list([
        Some(has("Image")),
        // `RentCivit` only allows Civitai's own service, not generation services in general.
        Some(has("Rent")),
        Some(has("Sell")),
        m["allowDerivatives"].as_bool(),
        m["allowDifferentLicense"].as_bool(),
        m["allowNoCredit"].as_bool(),
    ])
}

/// The license of a Civitai model (`GET /models/{id}`), for a model already on this PC.
pub fn license_of_model(m: &Value) -> crate::types::ModelLicense {
    crate::types::ModelLicense {
        site: "civitai".into(),
        name: None,
        commercial: commercial_of(&permissions(m)).into(),
        permissions: permissions(m),
    }
}

/// License terms as the Browse tab labels them (`Sell generated images`, `Use on generation services`, ...).
fn license(m: &Value) -> Vec<String> {
    let allowed = strings(&m["allowCommercialUse"]);
    let has = |k: &str| allowed.iter().any(|a| a == k);
    let mut out = Vec::new();
    if allowed.is_empty() {
        out.push("No commercial use".to_string());
    }
    if has("Image") {
        out.push("Sell generated images".into());
    }
    if has("Rent") || has("RentCivit") {
        out.push("Use on generation services".into());
    }
    if has("Sell") {
        out.push("Sell this model".into());
    }
    if m["allowDerivatives"].as_bool() == Some(true) {
        out.push("Share merges".into());
    }
    if m["allowNoCredit"].as_bool() == Some(false) {
        out.push("Credit required".into());
    }
    out
}

/// Plain text from Civitai's HTML description: tags removed, block ends become line breaks, entities decoded.
pub fn html_to_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut chars = html.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '<' {
            out.push(c);
            continue;
        }
        let mut tag = String::new();
        for t in chars.by_ref() {
            if t == '>' {
                break;
            }
            tag.push(t);
        }
        let name = tag
            .trim_start_matches('/')
            .split(|c: char| c.is_whitespace() || c == '/')
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        if matches!(
            name.as_str(),
            "br" | "p" | "div" | "li" | "h1" | "h2" | "h3" | "h4" | "tr"
        ) && !out.ends_with('\n')
        {
            out.push('\n');
        }
    }
    let text = out
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&");
    let mut lines: Vec<&str> = Vec::new();
    for l in text.lines().map(str::trim) {
        if !(l.is_empty() && lines.last().is_none_or(|p| p.is_empty())) {
            lines.push(l);
        }
    }
    lines.join("\n").trim().to_string()
}

/// The pictures of a model version a card can show, as (still URL, nsfw level), the pictures first and then the videos. A
/// video is shown by its first frame (`still_url`); one whose address cannot be turned into a still is left out.
fn pictures(version: &Value) -> impl Iterator<Item = (String, u64)> + '_ {
    let all = || version["images"].as_array().into_iter().flatten();
    let level = |i: &Value| i["nsfwLevel"].as_u64().unwrap_or(1);
    let still = all()
        .filter(|i| i["type"].as_str().is_none_or(|t| t == "image"))
        .filter_map(move |i| Some((thumbnail_url(i["url"].as_str()?), level(i))));
    let frames = all()
        .filter(|i| i["type"].as_str() == Some("video"))
        .filter_map(move |i| Some((still_url(i["url"].as_str()?)?, level(i))));
    still.chain(frames)
}

/// Cover image URLs of a model version. Pictures come before the first frames of videos; mature ones only when asked for.
fn image_urls(version: &Value, include_nsfw: bool) -> Vec<String> {
    pictures(version)
        .filter(|(_, level)| include_nsfw || *level <= 1)
        .map(|(url, _)| url)
        .take(8)
        .collect()
}

/// The first picture of a model version that is not mature: the cover a model installed from Civitai gets.
pub fn cover_of_version(version: &Value) -> Option<String> {
    // Civitai's levels: 1 plain, 2 mild, 4 and above mature. Up to "mild" is fine for a card in the manager.
    pictures(version)
        .find(|(_, level)| *level <= 2)
        .map(|(url, _)| url)
}

/// The cover of a model whose pictures are all mature (Civitai level 4 and above): its first one. It is kept so the model has its
/// own picture, and marked (`ModelConfig.cover_mature`); `cover_of_version` is tried first.
pub fn mature_cover_of_version(version: &Value) -> Option<String> {
    pictures(version).next().map(|(url, _)| url)
}

/// The cover to keep for a version, and whether it is a mature picture.
pub fn cover_with_maturity(version: &Value) -> Option<(String, bool)> {
    cover_of_version(version)
        .map(|c| (c, false))
        .or_else(|| mature_cover_of_version(version).map(|c| (c, true)))
}

/// Every picture of a version that the detail panel pages through, the cover first: the plain and mild ones, or all of
/// them when every picture is mature (as for the cover). At most eight.
pub fn cover_set(version: &Value) -> Vec<String> {
    let all: Vec<(String, u64)> = pictures(version).collect();
    let mild: Vec<String> = all
        .iter()
        .filter(|(_, level)| *level <= 2)
        .map(|(u, _)| u.clone())
        .take(8)
        .collect();
    if mild.is_empty() {
        all.into_iter().map(|(u, _)| u).take(8).collect()
    } else {
        mild
    }
}

/// The model's page on civitai.com for a version, from the ids the version lists.
pub fn page_url(version: &Value) -> Option<String> {
    Some(format!(
        "https://civitai.com/models/{}?modelVersionId={}",
        version["modelId"].as_u64()?,
        version["id"].as_u64()?
    ))
}

/// The words the author says activate a LoRA (`trainedWords`).
pub fn trigger_words(version: &Value) -> Vec<String> {
    version["trainedWords"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|w| w.as_str())
        .map(|w| w.trim().to_string())
        .filter(|w| !w.is_empty())
        .collect()
}

/// Civitai lists covers as `.../original=true/<name>`, the full-size file (several MB). The same path with `width=` is a
/// resized copy, which is what a card needs. (Both redirect to `blobs-b2.civitai.com`, so the CSP allows `*.civitai.com`.)
fn thumbnail_url(url: &str) -> String {
    url.replace("/original=true/", "/width=512/")
}

/// The first frame of a video as a resized picture (`anim=false`; a card cannot play a video). Only the full-size form
/// Civitai lists (`.../original=true/<name>`) is known to take it, so any other address gives none.
fn still_url(url: &str) -> Option<String> {
    url.contains("/original=true/")
        .then(|| url.replace("/original=true/", "/anim=false,width=512/"))
}

fn file(version_id: &str, f: &Value) -> Option<CivitaiFile> {
    let meta = &f["metadata"];
    Some(CivitaiFile {
        // The install source needs the version to look the file up: `civitai:<model>/<version>-<file>`.
        id: format!("{version_id}-{}", f["id"].as_u64()?),
        name: f["name"].as_str()?.to_string(),
        size_bytes: (f["sizeKB"].as_f64().unwrap_or(0.0) * 1024.0) as u64,
        format: match meta["format"].as_str() {
            Some("PickleTensor") => "PickleTensor",
            Some("GGUF") => "GGUF",
            _ => "SafeTensor",
        }
        .into(),
        precision: match meta["fp"].as_str() {
            Some("fp32") => "fp32",
            Some("bf16") => "bf16",
            Some(fp) if fp.starts_with("fp8") => "fp8",
            _ => "fp16",
        }
        .into(),
    })
}

fn model(m: &Value, include_nsfw: bool) -> Option<CivitaiModel> {
    let kind = kind_of(m["type"].as_str()?)?;
    let versions: Vec<CivitaiVersion> = m["modelVersions"]
        .as_array()
        .map(|vs| {
            vs.iter()
                .filter_map(|v| {
                    let id = v["id"].as_u64()?.to_string();
                    let files: Vec<CivitaiFile> = v["files"]
                        .as_array()?
                        .iter()
                        .filter_map(|f| file(&id, f))
                        .collect();
                    (!files.is_empty()).then(|| CivitaiVersion {
                        name: v["name"].as_str().unwrap_or_default().to_string(),
                        base_model: v["baseModel"].as_str().unwrap_or_default().to_string(),
                        created_at: epoch_ms(if v["publishedAt"].is_string() {
                            &v["publishedAt"]
                        } else {
                            &v["createdAt"]
                        }),
                        trigger_words: strings(&v["trainedWords"]),
                        files,
                        id,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let first = versions.first()?;
    let kind = if kind == "Checkpoint" && is_diffusion_base(&first.base_model) {
        "Diffusion"
    } else {
        kind
    };
    let images = image_urls(&m["modelVersions"][0], include_nsfw);
    let stats = &m["stats"];
    Some(CivitaiModel {
        id: m["id"].as_u64()?.to_string(),
        name: m["name"].as_str()?.to_string(),
        kind: kind.into(),
        base_model: first.base_model.clone(),
        creator: m["creator"]["username"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        downloads: stats["downloadCount"].as_u64().unwrap_or(0),
        likes: stats["thumbsUpCount"].as_u64().unwrap_or(0),
        rating: stats["rating"].as_f64().unwrap_or(0.0),
        rating_count: stats["ratingCount"].as_u64().unwrap_or(0),
        created_at: first.created_at,
        nsfw: m["nsfw"].as_bool().unwrap_or(false),
        image_count: images.len() as u32,
        image_urls: images,
        tags: strings(&m["tags"]),
        description: html_to_text(m["description"].as_str().unwrap_or_default()),
        license: license(m),
        commercial: commercial_of(&permissions(m)).into(),
        permissions: permissions(m),
        trigger_words: first.trigger_words.clone(),
        source: "civitai".into(),
        versions,
    })
}

pub fn map_response(body: &Value, include_nsfw: bool) -> SearchResult {
    SearchResult {
        items: body["items"]
            .as_array()
            .map(|a| a.iter().filter_map(|m| model(m, include_nsfw)).collect())
            .unwrap_or_default(),
        next_cursor: match &body["metadata"]["nextCursor"] {
            Value::String(s) => Some(s.clone()),
            Value::Number(n) => Some(n.to_string()),
            _ => None,
        },
    }
}

/// Civitai answers slowly when several base models are asked for at once and the list is ordered by popularity (seconds, against a
/// fraction of a second for one base model). So such a search is sent as one request per base model, at the same time, and the
/// answers are merged in the order of the sort.
fn splits(p: &SearchParams, bases: &[String]) -> bool {
    bases.len() > 1 && p.sort != "newest"
}

/// Prefix of a cursor that holds one cursor per base model (`{"Pony":"<cursor>", ...}`); a base model that has no more pages is left out.
const MULTI: &str = "multi:";

fn multi_cursors(cursor: Option<&str>, bases: &[String]) -> Vec<(String, Option<String>)> {
    let Some(raw) = cursor.filter(|c| !c.is_empty()) else {
        return bases.iter().map(|b| (b.clone(), None)).collect();
    };
    let parsed: serde_json::Map<String, Value> = raw
        .strip_prefix(MULTI)
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default();
    bases
        .iter()
        .filter_map(|b| {
            let c = parsed.get(b)?.as_str()?.to_string();
            Some((b.clone(), Some(c)))
        })
        .collect()
}

/// Orders merged results the way the sort does (the answers of each request are in that order already). Equal ones keep their order.
fn merge(mut items: Vec<CivitaiModel>, sort: &str) -> Vec<CivitaiModel> {
    let mut seen = std::collections::HashSet::new();
    items.retain(|m| seen.insert(m.id.clone()));
    if sort == "rating" {
        items.sort_by(|a, b| {
            b.rating
                .total_cmp(&a.rating)
                .then(b.rating_count.cmp(&a.rating_count))
        });
    } else {
        items.sort_by_key(|m| std::cmp::Reverse(m.downloads));
    }
    items
}

async fn fetch(
    http: &reqwest::Client,
    query: Vec<(String, String)>,
    api_key: Option<&str>,
    include_nsfw: bool,
) -> Result<SearchResult, String> {
    let mut req = http.get(format!("{}/models", civitai_api())).query(&query);
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
    Ok(map_response(&body, include_nsfw))
}

pub async fn search(
    http: &reqwest::Client,
    params: &SearchParams,
    api_key: Option<&str>,
) -> Result<SearchResult, String> {
    let all = bases(params);
    if !splits(params, &all) {
        let mut found = fetch(http, query(params), api_key, params.include_nsfw).await?;
        found.items.retain(|m| keep(m, params));
        return Ok(found);
    }
    // Each base model asks for its share of a page, so a merged page is about as long as a single one.
    let share = PAGE_SIZE
        .parse::<usize>()
        .unwrap_or(24)
        .div_ceil(all.len())
        .to_string();
    let starts = multi_cursors(params.cursor.as_deref(), &all);
    // A cursor that names no base model (one that is not from this kind of search) has nothing to continue.
    if starts.is_empty() {
        return Ok(SearchResult {
            items: Vec::new(),
            next_cursor: None,
        });
    }
    let requests = starts.into_iter().map(|(base, cursor)| {
        let q = query_with(
            params,
            std::slice::from_ref(&base),
            &share,
            cursor.as_deref(),
        );
        async move { (base, fetch(http, q, api_key, params.include_nsfw).await) }
    });
    let answers = futures_util::future::join_all(requests).await;
    let mut items = Vec::new();
    let mut next = serde_json::Map::new();
    let mut last_error = None;
    let mut any = false;
    for (base, answer) in answers {
        match answer {
            Ok(r) => {
                any = true;
                items.extend(r.items);
                if let Some(c) = r.next_cursor {
                    next.insert(base, Value::String(c));
                }
            }
            Err(e) => last_error = Some(e),
        }
    }
    // One base model failing is no reason to show nothing; every one failing is.
    if !any {
        return Err(last_error.unwrap_or_default());
    }
    let next_cursor = (!next.is_empty()).then(|| format!("{MULTI}{}", Value::Object(next)));
    items.retain(|m| keep(m, params));
    Ok(SearchResult {
        items: merge(items, &params.sort),
        next_cursor,
    })
}

#[cfg(test)]
mod tests;
