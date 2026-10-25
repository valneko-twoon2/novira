//! The `novira-image` URI scheme of the desktop shell. What a path serves is decided in
//! `novira_core::image_serve`, shared with the browser server; this file only names the scheme and its base URL.
pub use novira_core::image_serve::{parse_range, serve, Served};

pub const SCHEME: &str = "novira-image";

/// Base URL the WebView uses for the scheme (Windows/Android serve custom schemes over `http://<scheme>.localhost`).
pub fn url_base() -> String {
    if cfg!(any(windows, target_os = "android")) {
        format!("http://{SCHEME}.localhost")
    } else {
        format!("{SCHEME}://localhost")
    }
}
