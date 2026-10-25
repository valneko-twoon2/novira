//! The ComfyUI Registry (`api.comfy.org`): the public list of custom node packs with their downloads, versions and
//! publishers. novira reads the whole list once, keeps it for an hour, and lets the screen sort and search it.
use super::node_packs::{self, GithubRepo};
use futures_util::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;

const PAGE_SIZE: u32 = 100;
/// The registry holds about 6,000 packs today; this stops a runaway answer from asking for pages forever.
const MAX_PAGES: u32 = 200;
const MAX_PAGE_BYTES: usize = 5_000_000;
/// Pages asked for at once. The registry answers 24 at a time as fast as 6 (measured 2026-10-13: about 1.3 s against 1 s
/// for one), so a wider spread cuts the 60 pages from about ten rounds to about four.
const PAGES_AT_ONCE: usize = 16;
/// The list as kept on disk is a few megabytes; a file past this is not read.
const MAX_CACHE_BYTES: u64 = 40_000_000;
/// Icons are shown only from these hosts (the screen allows exactly them as image sources).
const ICON_HOSTS: [&str; 2] = ["raw.githubusercontent.com", "avatars.githubusercontent.com"];

/// One pack of the registry, reduced to what the screen shows.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryNode {
    pub id: String,
    pub name: String,
    pub description: String,
    /// Who published it (the registry's publisher name, else its author field).
    pub publisher: String,
    /// `https://github.com/<owner>/<repo>`: packs hosted anywhere else are left out, as novira installs from GitHub only.
    pub repository: String,
    pub icon: Option<String>,
    pub downloads: u64,
    pub stars: u64,
    pub version: Option<String>,
    /// Date (`YYYY-MM-DD`) the latest version was published.
    pub updated: Option<String>,
    pub license: Option<String>,
}

fn text(v: &serde_json::Value, max: usize) -> String {
    v.as_str()
        .map(|s| s.chars().filter(|c| !c.is_control()).take(max).collect())
        .unwrap_or_default()
}

/// The licence name when the registry gives one as text (`{"text": "MIT"}`); a licence kept only as a file name is left out.
fn license_of(v: &serde_json::Value) -> Option<String> {
    let parsed: serde_json::Value = serde_json::from_str(v.as_str()?).ok()?;
    let name = parsed["text"].as_str()?.trim();
    (!name.is_empty() && name.chars().count() <= 40 && !name.contains('\n'))
        .then(|| name.to_string())
}

fn icon_of(v: &serde_json::Value) -> Option<String> {
    let url = v.as_str()?;
    let rest = url.strip_prefix("https://")?;
    let host = rest.split('/').next()?;
    (ICON_HOSTS.contains(&host)
        && url.len() <= 300
        && !url.chars().any(|c| c.is_control() || c.is_whitespace()))
    .then(|| url.to_string())
}

fn parse_node(n: &serde_json::Value) -> Option<RegistryNode> {
    if n["status"].as_str() != Some("NodeStatusActive") {
        return None;
    }
    let repo: GithubRepo = node_packs::parse_github(n["repository"].as_str()?).ok()?;
    let id = text(&n["id"], 100);
    if id.is_empty() {
        return None;
    }
    let publisher = [&n["publisher"]["name"], &n["author"]]
        .iter()
        .map(|v| text(v, 80))
        .find(|s| !s.is_empty())
        .unwrap_or_else(|| repo.owner.clone());
    let name = text(&n["name"], 120);
    let version = n["latest_version"]["version"]
        .as_str()
        .filter(|v| node_packs::valid_tag(v))
        .map(str::to_string);
    let updated = n["latest_version"]["createdAt"]
        .as_str()
        .map(|d| d.chars().take(10).collect());
    Some(RegistryNode {
        name: if name.is_empty() {
            repo.repo.clone()
        } else {
            name
        },
        id,
        description: text(&n["description"], 300),
        publisher,
        repository: repo.url(),
        icon: icon_of(&n["icon"]),
        downloads: n["downloads"].as_u64().unwrap_or(0),
        stars: n["github_stars"].as_u64().unwrap_or(0),
        version,
        updated,
        license: license_of(&n["license"]),
    })
}

/// The packs of one page of the registry, and how many pages there are.
pub fn parse_page(body: &[u8]) -> Result<(Vec<RegistryNode>, u32), String> {
    let v: serde_json::Value = serde_json::from_slice(body)
        .map_err(|_| "The registry's answer was not understood".to_string())?;
    let nodes = v["nodes"]
        .as_array()
        .ok_or("The registry's answer had no list of packs")?;
    let pages = v["totalPages"]
        .as_u64()
        .unwrap_or(1)
        .clamp(1, MAX_PAGES as u64) as u32;
    Ok((nodes.iter().filter_map(parse_node).collect(), pages))
}

async fn page(http: &reqwest::Client, n: u32) -> Result<(Vec<RegistryNode>, u32), String> {
    let url = crate::endpoints::url(
        crate::endpoints::Service::ComfyRegistry,
        &format!("/nodes?page={n}&limit={PAGE_SIZE}"),
    );
    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Cannot reach the ComfyUI registry: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "The ComfyUI registry did not answer (HTTP {})",
            resp.status().as_u16()
        ));
    }
    if resp
        .content_length()
        .is_some_and(|n| n as usize > MAX_PAGE_BYTES)
    {
        return Err("The registry's answer is unexpectedly large".into());
    }
    let body = resp.bytes().await.map_err(|e| e.to_string())?;
    if body.len() > MAX_PAGE_BYTES {
        return Err("The registry's answer is unexpectedly large".into());
    }
    parse_page(&body)
}

/// Every active GitHub-hosted pack of the registry, most downloaded first.
pub async fn fetch_all(http: &reqwest::Client) -> Result<Vec<RegistryNode>, String> {
    let (mut all, pages) = page(http, 1).await?;
    let rest: Vec<Result<Vec<RegistryNode>, String>> = stream::iter(2..=pages)
        .map(|n| async move { page(http, n).await.map(|p| p.0) })
        .buffer_unordered(PAGES_AT_ONCE)
        .collect()
        .await;
    for r in rest {
        all.extend(r?);
    }
    all.sort_by(|a, b| {
        b.downloads
            .cmp(&a.downloads)
            .then_with(|| a.name.cmp(&b.name))
            .then_with(|| a.id.cmp(&b.id))
    });
    all.dedup_by(|a, b| a.id == b.id);
    Ok(all)
}

/// A node as read back from the disk copy: the same checks as for a fresh answer, so a damaged or edited file cannot
/// bring in a repository or an icon the screen would not otherwise show.
fn trusted(mut n: RegistryNode) -> Option<RegistryNode> {
    let repo = node_packs::parse_github(&n.repository).ok()?;
    n.repository = repo.url();
    n.icon = n.icon.filter(|i| icon_of(&serde_json::json!(i)).is_some());
    n.version = n.version.filter(|v| node_packs::valid_tag(v));
    (!n.id.is_empty()).then_some(n)
}

/// The list saved by [`save_cache`] and how long ago it was saved, or None (no file, too big, not a list).
pub fn load_cache(path: &Path) -> Option<(Duration, Vec<RegistryNode>)> {
    let meta = std::fs::metadata(path).ok()?;
    if meta.len() > MAX_CACHE_BYTES {
        return None;
    }
    let age = meta
        .modified()
        .ok()
        .and_then(|m| m.elapsed().ok())
        .unwrap_or_default();
    let list: Vec<RegistryNode> = serde_json::from_slice(&std::fs::read(path).ok()?).ok()?;
    let list: Vec<RegistryNode> = list.into_iter().filter_map(trusted).collect();
    (!list.is_empty()).then_some((age, list))
}

/// Saves the list through a temporary name, so a reader never sees half of it. Best effort: the caller ignores a failure.
pub fn save_cache(path: &Path, list: &[RegistryNode]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.part");
    std::fs::write(&tmp, serde_json::to_vec(list)?)?;
    std::fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAGE: &str = r#"{"totalPages":3,"nodes":[
      {"id":"a","name":"Alpha","description":"Does a","status":"NodeStatusActive","repository":"https://github.com/ow/Alpha.git","downloads":10,"github_stars":2,
       "license":"{\"text\": \"MIT\"}","icon":"https://raw.githubusercontent.com/ow/Alpha/main/i.png","publisher":{"name":"Pub"},"latest_version":{"version":"1.2.0","createdAt":"2026-01-02T03:04:05Z"}},
      {"id":"b","name":"","status":"NodeStatusActive","repository":"https://gitlab.com/x/y"},
      {"id":"c","name":"Banned","status":"NodeStatusBanned","repository":"https://github.com/ow/c"},
      {"id":"d","name":"Dee","status":"NodeStatusActive","repository":"https://github.com/ow/Dee","author":"Me","license":"{\"file\": \"LICENSE\"}","icon":"https://evil.example/i.png"}]}"#;

    #[test]
    fn a_page_keeps_active_github_packs_and_only_safe_fields() {
        let (nodes, pages) = parse_page(PAGE.as_bytes()).unwrap();
        assert_eq!(pages, 3);
        assert_eq!(nodes.len(), 2);
        let a = &nodes[0];
        assert_eq!(
            (
                a.repository.as_str(),
                a.publisher.as_str(),
                a.downloads,
                a.stars
            ),
            ("https://github.com/ow/Alpha", "Pub", 10, 2)
        );
        assert_eq!(
            (
                a.version.as_deref(),
                a.updated.as_deref(),
                a.license.as_deref()
            ),
            (Some("1.2.0"), Some("2026-01-02"), Some("MIT"))
        );
        assert!(a.icon.is_some());
        // A licence kept as a file name is not a name; an icon from another host is dropped; the author field stands in for a publisher.
        let d = &nodes[1];
        assert_eq!(
            (
                d.license.as_deref(),
                d.icon.as_deref(),
                d.publisher.as_str()
            ),
            (None, None, "Me")
        );
    }

    #[test]
    fn an_answer_that_is_not_a_list_is_refused() {
        assert!(parse_page(b"not json").is_err());
        assert!(parse_page(br#"{"error":"x"}"#).is_err());
    }

    #[test]
    fn icons_need_https_and_an_allowed_host_exactly() {
        let ok = serde_json::json!("https://avatars.githubusercontent.com/u/1?v=4");
        assert!(icon_of(&ok).is_some());
        for bad in [
            "http://raw.githubusercontent.com/a.png",
            "https://raw.githubusercontent.com.evil.example/a.png",
            "hhttps://avatars.githubusercontent.com/u/1",
            "https://raw.githubusercontent.com/a b.png",
        ] {
            assert!(icon_of(&serde_json::json!(bad)).is_none(), "{bad}");
        }
    }

    fn node(id: &str, repo: &str, icon: Option<&str>) -> RegistryNode {
        RegistryNode {
            id: id.into(),
            name: id.into(),
            description: String::new(),
            publisher: "Pub".into(),
            repository: repo.into(),
            icon: icon.map(str::to_string),
            downloads: 1,
            stars: 1,
            version: Some("1.0.0".into()),
            updated: None,
            license: None,
        }
    }

    #[test]
    fn a_saved_list_reads_back_with_its_age() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("cache").join("registry.json");
        let list = vec![node("a", "https://github.com/ow/a", None)];
        save_cache(&path, &list).unwrap();
        let (age, back) = load_cache(&path).unwrap();
        assert_eq!(back, list);
        assert!(age < Duration::from_secs(60));
        assert!(!path.with_extension("json.part").exists());
    }

    #[test]
    fn a_missing_or_damaged_file_reads_as_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("registry.json");
        assert!(load_cache(&path).is_none());
        std::fs::write(&path, b"not json").unwrap();
        assert!(load_cache(&path).is_none());
        std::fs::write(&path, b"[]").unwrap();
        assert!(load_cache(&path).is_none());
    }

    #[test]
    fn the_disk_copy_is_checked_again_when_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("registry.json");
        let list = vec![
            node(
                "ok",
                "https://github.com/ow/ok.git",
                Some("https://evil.example/i.png"),
            ),
            node("away", "https://gitlab.com/ow/away", None),
            node("", "https://github.com/ow/none", None),
        ];
        std::fs::write(&path, serde_json::to_vec(&list).unwrap()).unwrap();
        let (_, back) = load_cache(&path).unwrap();
        assert_eq!(back.len(), 1);
        assert_eq!(back[0].repository, "https://github.com/ow/ok");
        assert_eq!(back[0].icon, None);
    }
}
