//! Hugging Face model search for the Browse tab. The public `GET /api/models` list is mapped to the same shape
//! Civitai results use, so the Browse tab shows both. A repository is offered through its single model files
//! (`.safetensors`, `.gguf`, ...); folders of a diffusers pipeline are skipped because ComfyUI loads single files.
use crate::models::civitai::{
    commercial_of, CivitaiFile, CivitaiModel, CivitaiVersion, SearchParams, SearchResult,
};
use crate::models::content_filter::looks_adult;
use serde_json::Value;

const PAGE_SIZE: &str = "24";
const MAX_IMAGES: usize = 8;
const MAX_FILES: usize = 12;
/// Most files the install tab lists for one repository.
const MAX_LISTED_FILES: usize = 500;
/// Folders that hold the parts of a diffusers pipeline rather than a loadable single file.
const COMPONENT_DIRS: &[&str] = &[
    "unet",
    "transformer",
    "text_encoder",
    "text_encoder_2",
    "text_encoder_3",
    "vae",
    "scheduler",
    "tokenizer",
    "tokenizer_2",
    "tokenizer_3",
    "safety_checker",
    "feature_extractor",
    "image_encoder",
    "controlnet",
];
const MODEL_EXTENSIONS: &[&str] = &["safetensors", "gguf", "ckpt", "pt", "pth"];
const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];

/// Query pairs for `GET /api/models`.
pub fn query(p: &SearchParams) -> Vec<(String, String)> {
    let mut q: Vec<(String, String)> = vec![
        ("limit".into(), PAGE_SIZE.into()),
        ("full".into(), "true".into()),
        ("direction".into(), "-1".into()),
    ];
    let mut search = p.query.trim().to_string();
    match p.kind.as_str() {
        "LoRA" => {
            q.push(("filter".into(), "lora".into()));
            q.push(("filter".into(), "text-to-image".into()));
        }
        "Checkpoint" => q.push(("filter".into(), "text-to-image".into())),
        "ControlNet" => q.push(("filter".into(), "controlnet".into())),
        // Video and other diffusion models are tagged by what they make, not text-to-image: no tag filter.
        "Diffusion" => {}
        "VAE" if !search.to_lowercase().contains("vae") => {
            search = format!("{search} vae").trim().to_string();
        }
        _ => {}
    }
    match p.base_model.as_str() {
        "sdxl-compat" | "SDXL 1.0" => q.push(("filter".into(), "stable-diffusion-xl".into())),
        "SD 1.5" => q.push(("filter".into(), "stable-diffusion".into())),
        "FLUX.1" => q.push(("filter".into(), "flux".into())),
        _ => {}
    }
    if !search.is_empty() {
        q.push(("search".into(), search));
    }
    let sort = match p.sort.as_str() {
        "rating" => "likes",
        "newest" => "createdAt",
        _ => "downloads",
    };
    q.push(("sort".into(), sort.into()));
    if let Some(c) = p.cursor.as_ref().filter(|c| !c.is_empty()) {
        q.push(("cursor".into(), c.clone()));
    }
    q
}

fn epoch_ms(v: &Value) -> i64 {
    v.as_str()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.timestamp_millis())
        .unwrap_or(0)
}

fn extension(path: &str) -> String {
    path.rsplit('.').next().unwrap_or("").to_lowercase()
}

/// Model files a repository offers: single files outside diffusers component folders.
pub fn model_files(siblings: &Value) -> Vec<CivitaiFile> {
    let mut out = Vec::new();
    for s in siblings.as_array().into_iter().flatten() {
        let Some(path) = s["rfilename"].as_str() else {
            continue;
        };
        if !is_single_model_file(path) {
            continue;
        }
        let ext = extension(path);
        let name = path.rsplit('/').next().unwrap_or(path).to_string();
        let lower = name.to_lowercase();
        let precision = ["fp8", "bf16", "fp32", "fp16"]
            .iter()
            .find(|p| lower.contains(*p))
            .copied()
            .unwrap_or("fp16");
        out.push(CivitaiFile {
            id: path.to_string(),
            name,
            // The list does not carry file sizes; the frontend shows them as unknown.
            size_bytes: s["size"].as_u64().unwrap_or(0),
            format: match ext.as_str() {
                "gguf" => "GGUF",
                "safetensors" => "SafeTensor",
                _ => "PickleTensor",
            }
            .into(),
            precision: precision.into(),
        });
        if out.len() >= MAX_FILES {
            break;
        }
    }
    out
}

/// Whether a file of a repository is a single model file: a model extension, and not inside a folder of a diffusers
/// pipeline (ComfyUI loads single files).
fn is_single_model_file(path: &str) -> bool {
    if !MODEL_EXTENSIONS.contains(&extension(path).as_str()) {
        return false;
    }
    let first = path.split('/').next().unwrap_or("");
    !(path.contains('/') && COMPONENT_DIRS.contains(&first))
}

/// The single model files of a repository as paths in it, for the install tab. A path the installer would refuse is left
/// out, so every file listed can be installed.
pub fn repo_model_files(siblings: &Value) -> Vec<String> {
    siblings
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s["rfilename"].as_str())
        .filter(|p| is_single_model_file(p) && super::install::is_repo_file_path(p))
        .take(MAX_LISTED_FILES)
        .map(str::to_string)
        .collect()
}

/// The model files of a Hugging Face repository (`owner/repo`), for the install tab to offer. Only the repository's
/// description is read; nothing is downloaded. The token (when set) is sent, so gated repositories can be listed.
pub async fn list_model_files(
    http: &reqwest::Client,
    repo: &str,
    token: Option<&str>,
) -> Result<Vec<String>, String> {
    if !super::install::is_hugging_face_repo(repo) {
        return Err(format!(
            "Not a Hugging Face repository (owner/name): {repo}"
        ));
    }
    let mut req = http.get(crate::endpoints::url(
        crate::endpoints::Service::HuggingFace,
        &format!("/api/models/{repo}"),
    ));
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("Hugging Face request failed: {e}"))?;
    // Hugging Face answers 401 for a repository that does not exist as well as for a gated one without a token.
    if matches!(
        res.status(),
        reqwest::StatusCode::NOT_FOUND | reqwest::StatusCode::UNAUTHORIZED
    ) {
        return Err(format!(
            "No Hugging Face repository named {repo} that can be seen (a private or gated one needs a token in Settings)"
        ));
    }
    if !res.status().is_success() {
        return Err(format!("Hugging Face answered {}", res.status()));
    }
    let m: Value = res
        .json()
        .await
        .map_err(|e| format!("Unexpected Hugging Face response: {e}"))?;
    Ok(repo_model_files(&m["siblings"]))
}

/// The first picture of a repository, for the cover of a model installed from it; None when it has none or the
/// request fails (the model is then shown without a cover, as before).
pub async fn cover_of_repo(
    http: &reqwest::Client,
    repo: &str,
    token: Option<&str>,
) -> Option<String> {
    let mut req = http.get(crate::endpoints::url(
        crate::endpoints::Service::HuggingFace,
        &format!("/api/models/{repo}"),
    ));
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let res = req.send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let m: Value = res.json().await.ok()?;
    cover_urls(repo, &m["siblings"]).into_iter().next()
}

/// Pictures in the repository (LoRA galleries mostly), those under `images/` first.
fn cover_urls(repo: &str, siblings: &Value) -> Vec<String> {
    let mut images: Vec<&str> = siblings
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s["rfilename"].as_str())
        .filter(|p| IMAGE_EXTENSIONS.contains(&extension(p).as_str()))
        .collect();
    images.sort_by_key(|p| !p.starts_with("images/"));
    images
        .into_iter()
        .take(MAX_IMAGES)
        .map(|p| crate::endpoints::hf_resolve(repo, p))
        .collect()
}

fn tag_value<'a>(tags: &'a [String], prefix: &str) -> Option<&'a str> {
    tags.iter().find_map(|t| t.strip_prefix(prefix))
}

fn kind_of(tags: &[String], siblings: &Value) -> &'static str {
    let has = |t: &str| tags.iter().any(|x| x == t);
    if has("lora") {
        "LoRA"
    } else if has("image-to-video") || has("text-to-video") || has("video-to-video") {
        "Diffusion"
    } else if has("controlnet") {
        "ControlNet"
    } else if has("vae")
        || model_files(siblings)
            .iter()
            .all(|f| f.name.to_lowercase().contains("vae"))
    {
        "VAE"
    } else {
        "Checkpoint"
    }
}

fn base_of(tags: &[String]) -> String {
    let has = |t: &str| tags.iter().any(|x| x == t);
    if has("stable-diffusion-xl") || has("sdxl") {
        "SDXL 1.0".into()
    } else if has("flux") {
        "FLUX.1".into()
    } else if has("stable-diffusion") {
        "SD 1.5".into()
    } else {
        tag_value(tags, "base_model:")
            .filter(|b| {
                !b.starts_with("adapter:")
                    && !b.starts_with("finetune:")
                    && !b.starts_with("quantized:")
            })
            .map(|b| b.rsplit('/').next().unwrap_or(b).to_string())
            .unwrap_or_else(|| "—".into())
    }
}

/// What a license tag allows, item by item (see `civitai::PERMISSION_KEYS`). Unknown licenses answer nothing.
pub fn permissions(license: Option<&str>) -> Vec<crate::models::civitai::Permission> {
    const Y: Option<bool> = Some(true);
    const N: Option<bool> = Some(false);
    let answers = match license.unwrap_or("") {
        "cc0-1.0" | "unlicense" | "wtfpl" => [Y, Y, Y, Y, Y, Y],
        // Permissive, but the notice or the credit has to stay.
        "apache-2.0" | "mit" | "bsd-2-clause" | "bsd-3-clause" | "cc-by-4.0" => [Y, Y, Y, Y, Y, N],
        "cc-by-sa-4.0" => [Y, Y, Y, Y, N, N],
        // FLUX.1 [dev]: outputs may be used commercially; the model itself only non-commercially.
        "flux-1-dev-non-commercial-license" => [Y, N, N, Y, N, N],
        // OpenRAIL: commercial use allowed, but the use restrictions must travel with the model and its derivatives.
        l if l.contains("openrail") => [Y, Y, Y, Y, N, N],
        l if l.contains("-nc") || l.contains("non-commercial") => {
            [N, N, N, if l.contains("-nd") { N } else { Y }, N, N]
        }
        _ => [None; 6],
    };
    crate::models::civitai::permission_list(answers)
}

/// The license of a repository, read from its `license:` tag; None when the request fails.
pub async fn license_of_repo(
    http: &reqwest::Client,
    repo: &str,
    token: Option<&str>,
) -> Option<crate::types::ModelLicense> {
    let mut req = http.get(crate::endpoints::url(
        crate::endpoints::Service::HuggingFace,
        &format!("/api/models/{repo}"),
    ));
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let res = req.send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let m: Value = res.json().await.ok()?;
    let tags: Vec<String> = m["tags"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|t| t.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();
    Some(license_of_tag(tag_value(&tags, "license:")))
}

/// The license record for a `license:` tag value.
pub fn license_of_tag(license: Option<&str>) -> crate::types::ModelLicense {
    crate::types::ModelLicense {
        site: "huggingface".into(),
        name: license.map(str::to_string),
        commercial: commercial_of(&permissions(license)).into(),
        permissions: permissions(license),
    }
}

fn visible_tags(tags: &[String]) -> Vec<String> {
    tags.iter()
        .filter(|t| {
            !t.contains(':')
                && !matches!(
                    t.as_str(),
                    "diffusers"
                        | "safetensors"
                        | "text-to-image"
                        | "region:us"
                        | "endpoints_compatible"
                        | "stable-diffusion-xl"
                        | "stable-diffusion"
                        | "sdxl"
                        | "flux"
                        | "lora"
                )
        })
        .take(8)
        .cloned()
        .collect()
}

pub fn map_response(body: &Value, include_nsfw: bool) -> Vec<CivitaiModel> {
    let mut out = Vec::new();
    for m in body.as_array().into_iter().flatten() {
        let Some(id) = m["id"].as_str() else { continue };
        let tags: Vec<String> = m["tags"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|t| t.as_str().map(str::to_string))
            .collect();
        let nsfw = looks_adult(id, &tags, &m["cardData"]);
        if m["private"].as_bool() == Some(true) || (nsfw && !include_nsfw) {
            continue;
        }
        let files = model_files(&m["siblings"]);
        if files.is_empty() {
            continue;
        }
        let license = tag_value(&tags, "license:").map(str::to_string);
        let base = base_of(&tags);
        let covers = cover_urls(id, &m["siblings"]);
        let trigger_words: Vec<String> = match &m["cardData"]["instance_prompt"] {
            Value::String(s) => s
                .split(',')
                .map(|w| w.trim().to_string())
                .filter(|w| !w.is_empty())
                .take(8)
                .collect(),
            _ => Vec::new(),
        };
        let created = epoch_ms(&m["createdAt"]);
        let gated = m["gated"].as_bool() == Some(true) || m["gated"].is_string();
        let mut notes = Vec::new();
        if gated {
            notes.push("Gated: accept the terms on huggingface.co and set a Hugging Face token in Settings.".to_string());
        }
        out.push(CivitaiModel {
            id: id.to_string(),
            name: id.rsplit('/').next().unwrap_or(id).to_string(),
            kind: kind_of(&tags, &m["siblings"]).into(),
            base_model: base.clone(),
            creator: m["author"]
                .as_str()
                .or_else(|| id.split('/').next())
                .unwrap_or("")
                .to_string(),
            downloads: m["downloads"].as_u64().unwrap_or(0),
            likes: m["likes"].as_u64().unwrap_or(0),
            rating: 0.0,
            rating_count: 0,
            created_at: created,
            nsfw,
            image_count: covers.len() as u32,
            image_urls: covers,
            tags: visible_tags(&tags),
            description: notes.join("\n"),
            license: license.clone().into_iter().collect(),
            commercial: commercial_of(&permissions(license.as_deref())).into(),
            permissions: permissions(license.as_deref()),
            trigger_words: trigger_words.clone(),
            source: "huggingface".into(),
            versions: vec![CivitaiVersion {
                id: "main".into(),
                name: "main".into(),
                base_model: base,
                created_at: epoch_ms(&m["lastModified"]).max(created),
                trigger_words,
                files,
            }],
        });
    }
    out
}

/// The cursor of the next page from the `Link: <...&cursor=...>; rel="next"` header.
pub fn next_cursor(link_header: Option<&str>) -> Option<String> {
    let link = link_header?;
    let next = link.split(',').find(|part| part.contains("rel=\"next\""))?;
    let url = next
        .split(';')
        .next()?
        .trim()
        .trim_start_matches('<')
        .trim_end_matches('>');
    let parsed = reqwest::Url::parse(url).ok()?;
    parsed
        .query_pairs()
        .find(|(k, _)| k == "cursor")
        .map(|(_, v)| v.into_owned())
}

/// Pages fetched at most per search while filtering leaves too few models to show.
const MAX_PAGES: usize = 4;
/// Enough models for a page of results.
const ENOUGH: usize = 12;

pub async fn search(
    http: &reqwest::Client,
    params: &SearchParams,
    token: Option<&str>,
) -> Result<SearchResult, String> {
    let mut params = params.clone();
    let mut items = Vec::new();
    let mut next_cursor;
    let mut pages = 0;
    loop {
        let (mut page, next) = fetch_page(http, &params, token).await?;
        items.append(&mut page);
        next_cursor = next;
        pages += 1;
        // Filtering (adult content, no single model file) can empty a page; look further so the list does not stall.
        if items.len() >= ENOUGH || next_cursor.is_none() || pages >= MAX_PAGES {
            break;
        }
        params.cursor = next_cursor.clone();
    }
    Ok(SearchResult { items, next_cursor })
}

async fn fetch_page(
    http: &reqwest::Client,
    params: &SearchParams,
    token: Option<&str>,
) -> Result<(Vec<CivitaiModel>, Option<String>), String> {
    let mut req = http
        .get(crate::endpoints::url(
            crate::endpoints::Service::HuggingFace,
            "/api/models",
        ))
        .query(&query(params));
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("Hugging Face request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("Hugging Face answered {}", res.status()));
    }
    let link = res
        .headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let body: Value = res
        .json()
        .await
        .map_err(|e| format!("Unexpected Hugging Face response: {e}"))?;
    Ok((
        map_response(&body, params.include_nsfw),
        next_cursor(link.as_deref()),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn params(kind: &str) -> SearchParams {
        SearchParams {
            query: " anime ".into(),
            kind: kind.into(),
            base_model: "sdxl-compat".into(),
            sort: "rating".into(),
            period: "all".into(),
            include_nsfw: false,
            cursor: Some("abc".into()),
            source: "huggingface".into(),
            licenses: Vec::new(),
            checkpoint_type: String::new(),
            safetensors_only: false,
            creator: String::new(),
        }
    }

    #[test]
    fn query_uses_tags_for_the_kind_and_base_and_the_hub_sort_names() {
        let q = query(&params("LoRA"));
        let count = |k: &str, v: &str| q.iter().filter(|(a, b)| a == k && b == v).count();
        assert_eq!(count("filter", "lora"), 1);
        assert_eq!(count("filter", "text-to-image"), 1);
        assert_eq!(count("filter", "stable-diffusion-xl"), 1);
        assert_eq!(count("search", "anime"), 1);
        assert_eq!(count("sort", "likes"), 1);
        assert_eq!(count("cursor", "abc"), 1);
        let vae = query(&params("VAE"));
        assert!(vae.iter().any(|(k, v)| k == "search" && v == "anime vae"));
    }

    #[test]
    fn the_install_list_keeps_single_model_files_that_the_installer_accepts() {
        let siblings = json!([
            { "rfilename": "README.md" },
            { "rfilename": "model.safetensors" },
            { "rfilename": "sub/lora.ckpt" },
            { "rfilename": "unet/diffusion_pytorch_model.safetensors" },
            { "rfilename": "name with space.safetensors" },
            { "rfilename": "../escape.safetensors" },
            { "rfilename": "model.bin" },
        ]);
        assert_eq!(
            repo_model_files(&siblings),
            vec!["model.safetensors", "sub/lora.ckpt"]
        );
    }

    #[test]
    fn only_single_model_files_outside_pipeline_folders_are_offered() {
        let siblings = json!([
            {"rfilename": ".gitattributes"},
            {"rfilename": "unet/diffusion_pytorch_model.safetensors"},
            {"rfilename": "vae/diffusion_pytorch_model.safetensors"},
            {"rfilename": "anime.fp16.safetensors"},
            {"rfilename": "loras/style.safetensors"},
            {"rfilename": "model.gguf"},
            {"rfilename": "images/a.png"}
        ]);
        let files = model_files(&siblings);
        let ids: Vec<&str> = files.iter().map(|f| f.id.as_str()).collect();
        assert_eq!(
            ids,
            vec![
                "anime.fp16.safetensors",
                "loras/style.safetensors",
                "model.gguf"
            ]
        );
        assert_eq!(files[0].precision, "fp16");
        assert_eq!(files[2].format, "GGUF");
        assert_eq!(files[1].name, "style.safetensors");
    }

    #[test]
    fn a_repository_maps_to_the_browse_shape() {
        let body = json!([
            {
                "id": "someone/anime-lora", "author": "someone", "downloads": 1200, "likes": 34,
                "createdAt": "2025-10-28T22:07:46.000Z", "lastModified": "2025-11-01T00:00:00.000Z",
                "tags": ["diffusers", "text-to-image", "lora", "stable-diffusion-xl", "anime", "license:apache-2.0", "base_model:adapter:x/y"],
                "cardData": {"instance_prompt": "anime style, 1girl"},
                "siblings": [{"rfilename": "a.safetensors"}, {"rfilename": "images/1.png"}, {"rfilename": "images/2.jpg"}, {"rfilename": "cover.webp"}]
            },
            {"id": "x/pipeline-only", "tags": [], "siblings": [{"rfilename": "unet/a.safetensors"}]},
            {"id": "x/private", "private": true, "siblings": [{"rfilename": "a.safetensors"}]},
            {"id": "x/mature", "tags": ["not-for-all-audiences"], "siblings": [{"rfilename": "a.safetensors"}]}
        ]);
        let items = map_response(&body, false);
        assert_eq!(
            items.len(),
            1,
            "no files, private and mature repositories are left out"
        );
        let m = &items[0];
        assert_eq!(
            (m.id.as_str(), m.name.as_str(), m.kind.as_str()),
            ("someone/anime-lora", "anime-lora", "LoRA")
        );
        assert_eq!(
            (
                m.base_model.as_str(),
                m.commercial.as_str(),
                m.source.as_str()
            ),
            ("SDXL 1.0", "allowed", "huggingface")
        );
        assert_eq!(m.trigger_words, vec!["anime style", "1girl"]);
        assert_eq!(m.tags, vec!["anime"]);
        assert_eq!(
            m.image_urls[0],
            "https://huggingface.co/someone/anime-lora/resolve/main/images/1.png"
        );
        assert_eq!(m.image_urls.len(), 3);
        assert_eq!(m.versions[0].files[0].id, "a.safetensors");
        assert_eq!(
            map_response(&body, true).len(),
            2,
            "mature repositories show when enabled"
        );
    }

    #[test]
    fn permissions_by_license() {
        let of = |l: Option<&str>| -> Vec<Option<bool>> {
            permissions(l).iter().map(|p| p.allowed).collect()
        };
        assert_eq!(of(Some("apache-2.0"))[0], Some(true));
        assert_eq!(of(Some("apache-2.0"))[5], Some(false));
        assert_eq!(of(Some("cc-by-nc-4.0"))[..3], [Some(false); 3]);
        assert_eq!(of(Some("cc-by-nc-nd-4.0"))[3], Some(false));
        assert_eq!(of(Some("creativeml-openrail-m"))[1], Some(true));
        assert_eq!(
            of(Some("flux-1-dev-non-commercial-license"))[..3],
            [Some(true), Some(false), Some(false)]
        );
        assert_eq!(of(Some("other")), vec![None; 6]);
        assert_eq!(of(None).len(), 6);
    }

    #[test]
    fn license_levels() {
        let commercial = |l: Option<&str>| commercial_of(&permissions(l));
        assert_eq!(commercial(Some("apache-2.0")), "allowed");
        assert_eq!(commercial(Some("creativeml-openrail-m")), "allowed");
        assert_eq!(commercial(Some("cc-by-nc-4.0")), "denied");
        // FLUX.1 [dev]: its pictures may be sold, the model may not be run as a service or sold.
        assert_eq!(
            commercial(Some("flux-1-dev-non-commercial-license")),
            "limited"
        );
        assert_eq!(commercial(Some("other")), "limited");
        assert_eq!(commercial(None), "limited");
    }

    #[test]
    fn the_next_page_cursor_comes_from_the_link_header() {
        let link =
            "<https://huggingface.co/api/models?search=a&limit=2&cursor=eyJ4IjoxfQ>; rel=\"next\"";
        assert_eq!(next_cursor(Some(link)).as_deref(), Some("eyJ4IjoxfQ"));
        assert_eq!(next_cursor(Some("<https://x/?a=1>; rel=\"prev\"")), None);
        assert_eq!(next_cursor(None), None);
    }
}
