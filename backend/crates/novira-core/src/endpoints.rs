//! The addresses of the outside services novira talks to, in one place.
//!
//! Release builds always use the real sites. A debug build (which is what the tests run) may point a service at a
//! fake server on this PC through `NOVIRA_TEST_<SERVICE>_BASE`, so the download and lookup code can be tested without
//! the network. The override is compiled in only under `debug_assertions` and accepts nothing but
//! `http://127.0.0.1:<port>` or `http://localhost:<port>`; any other value is ignored. Every other check (https only,
//! exact host match) stays as it is for the real hosts: it is the address that is swapped, not the rules.

/// An outside service with a fixed address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Service {
    /// `civitai.com` (the REST API lives under `/api/v1`).
    Civitai,
    /// `huggingface.co` (API, repository pages and file downloads).
    HuggingFace,
    /// `github.com` (ComfyUI release packages).
    GitHub,
    /// `codeload.github.com` (source archives of node packs).
    Codeload,
    /// `api.github.com` (submodule commits).
    GitHubApi,
    /// `api.comfy.org` (the list of custom node packs, the ComfyUI Registry).
    ComfyRegistry,
    /// `www.7-zip.org` (the `7zr.exe` console tool).
    SevenZip,
    /// `cai-watermark.adobe.net` (Adobe's TrustMark watermark models).
    TrustMark,
    /// `ja.wikipedia.org` (the assistant's fact look-up, text only).
    WikipediaJa,
    /// `en.wikipedia.org` (the assistant's fact look-up, text only).
    WikipediaEn,
}

impl Service {
    /// The real address: scheme and host, no path and no trailing slash.
    pub const fn origin(self) -> &'static str {
        match self {
            Service::Civitai => "https://civitai.com",
            Service::HuggingFace => "https://huggingface.co",
            Service::GitHub => "https://github.com",
            Service::Codeload => "https://codeload.github.com",
            Service::GitHubApi => "https://api.github.com",
            Service::ComfyRegistry => "https://api.comfy.org",
            Service::SevenZip => "https://www.7-zip.org",
            Service::TrustMark => "https://cai-watermark.adobe.net",
            Service::WikipediaJa => "https://ja.wikipedia.org",
            Service::WikipediaEn => "https://en.wikipedia.org",
        }
    }

    /// The environment variable that overrides the address in a debug build.
    #[cfg(any(debug_assertions, test))]
    const fn env_name(self) -> &'static str {
        match self {
            Service::Civitai => "NOVIRA_TEST_CIVITAI_BASE",
            Service::HuggingFace => "NOVIRA_TEST_HUGGINGFACE_BASE",
            Service::GitHub => "NOVIRA_TEST_GITHUB_BASE",
            Service::Codeload => "NOVIRA_TEST_CODELOAD_BASE",
            Service::GitHubApi => "NOVIRA_TEST_GITHUB_API_BASE",
            Service::ComfyRegistry => "NOVIRA_TEST_COMFY_REGISTRY_BASE",
            Service::SevenZip => "NOVIRA_TEST_SEVENZIP_BASE",
            Service::TrustMark => "NOVIRA_TEST_TRUSTMARK_BASE",
            Service::WikipediaJa => "NOVIRA_TEST_WIKIPEDIA_JA_BASE",
            Service::WikipediaEn => "NOVIRA_TEST_WIKIPEDIA_EN_BASE",
        }
    }
}

/// `value` when it is exactly `http://127.0.0.1:<port>` or `http://localhost:<port>` (no path, no credentials).
#[cfg(any(debug_assertions, test))]
fn loopback_base(value: &str) -> Option<String> {
    let port = value
        .strip_prefix("http://127.0.0.1:")
        .or_else(|| value.strip_prefix("http://localhost:"))?;
    let valid = (1..=5).contains(&port.len())
        && port.bytes().all(|b| b.is_ascii_digit())
        && port.parse::<u32>().is_ok_and(|p| (1..=65535).contains(&p));
    valid.then(|| value.to_string())
}

/// The origin of `service`, resolved through `lookup` (the environment in a debug build).
#[cfg(any(debug_assertions, test))]
fn origin_with(service: Service, lookup: impl Fn(&str) -> Option<String>) -> String {
    lookup(service.env_name())
        .and_then(|v| loopback_base(&v))
        .unwrap_or_else(|| service.origin().to_string())
}

/// The scheme and host of `service`: the real site, or in a debug build the loopback override if one is set.
pub fn origin(service: Service) -> String {
    #[cfg(debug_assertions)]
    {
        origin_with(service, |name| std::env::var(name).ok())
    }
    #[cfg(not(debug_assertions))]
    {
        service.origin().to_string()
    }
}

/// `path` (starting with `/`) on `service`.
pub fn url(service: Service, path: &str) -> String {
    format!("{}{path}", origin(service))
}

/// A file of a Hugging Face repository (`main` branch), as a download address.
pub fn hf_resolve(repo: &str, path: &str) -> String {
    url(
        Service::HuggingFace,
        &format!("/{repo}/resolve/main/{path}"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_base_accepts_only_a_loopback_origin_with_a_port() {
        assert_eq!(
            loopback_base("http://127.0.0.1:8080").as_deref(),
            Some("http://127.0.0.1:8080")
        );
        assert_eq!(
            loopback_base("http://localhost:1").as_deref(),
            Some("http://localhost:1")
        );
        for bad in [
            "",
            "https://127.0.0.1:8080",
            "http://127.0.0.1",
            "http://127.0.0.1:",
            "http://127.0.0.1:0",
            "http://127.0.0.1:65536",
            "http://127.0.0.1:80/x",
            "http://127.0.0.1:80/",
            "http://127.0.0.1:80@evil.example",
            "http://127.0.0.1:8a",
            "http://127.0.0.1.evil.example:80",
            "http://localhost.evil.example:80",
            "http://evil.example:80",
            "http://[::1]:80",
            "http://user@127.0.0.1:80",
            "https://civitai.com",
        ] {
            assert_eq!(loopback_base(bad), None, "{bad}");
        }
    }

    #[test]
    fn origin_with_uses_the_real_site_unless_a_loopback_override_is_given() {
        let none = |_: &str| None;
        assert_eq!(
            origin_with(Service::HuggingFace, none),
            "https://huggingface.co"
        );
        let local = |name: &str| {
            (name == "NOVIRA_TEST_CIVITAI_BASE").then(|| "http://127.0.0.1:9".to_string())
        };
        assert_eq!(origin_with(Service::Civitai, local), "http://127.0.0.1:9");
        // Another service is not affected by that variable.
        assert_eq!(origin_with(Service::GitHub, local), "https://github.com");
        // A remote override is ignored.
        let remote = |_: &str| Some("https://evil.example".to_string());
        assert_eq!(
            origin_with(Service::Codeload, remote),
            "https://codeload.github.com"
        );
    }

    #[test]
    fn every_service_has_its_own_variable_and_an_https_origin() {
        let all = [
            Service::Civitai,
            Service::HuggingFace,
            Service::GitHub,
            Service::Codeload,
            Service::GitHubApi,
            Service::ComfyRegistry,
            Service::SevenZip,
            Service::TrustMark,
            Service::WikipediaJa,
            Service::WikipediaEn,
        ];
        let mut names: Vec<_> = all.iter().map(|s| s.env_name()).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), all.len());
        for s in all {
            assert!(s.origin().starts_with("https://") && !s.origin().ends_with('/'));
            assert!(s.env_name().starts_with("NOVIRA_TEST_") && s.env_name().ends_with("_BASE"));
        }
    }
}
