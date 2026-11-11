//! Keeps the window on the app's own page. The window has no back button, so a click that leaves the page (a link to
//! a picture, whose scheme is another origin, or to a website) would strand the user on it for good. Every top-level
//! navigation away from the app's origin is refused; the app opens websites through its own commands.
use tauri::{plugin::TauriPlugin, Manager, Runtime, Url};

/// Whether `url` is the app's own page: the bundled screens (`tauri://localhost`, or `http(s)://tauri.localhost` on
/// Windows) or, in a debug build, the dev server `dev` (same origin).
pub fn is_app_url(url: &Url, dev: Option<&Url>) -> bool {
    match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" if url.host_str() == Some("tauri.localhost") => true,
        _ => cfg!(debug_assertions) && dev.is_some_and(|d| d.origin() == url.origin()),
    }
}

/// The guard, as a plugin without commands (it needs no permission).
pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|webview, url| {
            let dev = webview.config().build.dev_url.clone();
            let allowed = is_app_url(url, dev.as_ref());
            if !allowed {
                novira_core::applog::warn(
                    "navigation",
                    format!(
                        "refused to leave the app for {}",
                        url.origin().ascii_serialization()
                    ),
                );
            }
            allowed
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::is_app_url;
    use tauri::Url;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    // tags: equivalence, error-guessing, condition
    #[test]
    fn only_the_apps_own_page_may_be_opened_in_the_window() {
        let dev = url("http://localhost:5173");
        for ok in [
            "http://tauri.localhost/",
            "https://tauri.localhost/index.html",
            "tauri://localhost/",
        ] {
            assert!(is_app_url(&url(ok), Some(&dev)), "{ok}");
        }
        for bad in [
            "http://novira-image.localhost/full/a.png",
            "novira-image://localhost/full/a.png",
            "https://civitai.com/models/1",
            "http://tauri.localhost.evil.example/",
            "tauri://evil/",
            "http://localhost:5174/",
            "file:///C:/Windows/",
        ] {
            assert!(!is_app_url(&url(bad), Some(&dev)), "{bad}");
        }
        // The dev server counts only in a debug build, and only on its own origin.
        assert_eq!(
            is_app_url(&url("http://localhost:5173/?scenario=empty"), Some(&dev)),
            cfg!(debug_assertions)
        );
        assert!(!is_app_url(&url("http://localhost:5173/"), None));
    }
}
