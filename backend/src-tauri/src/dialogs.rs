//! Native file dialogs. The shell opens them itself inside novira's own commands, so the WebView never chooses or
//! sees a path and no dialog plugin is needed. On Windows `rfd` runs each dialog on a thread of its own
//! (COM initialised there), so awaiting it from an async command does not block the window's event loop.
use rfd::AsyncFileDialog;
use std::path::PathBuf;

/// A dialog owned by the app's window (modal to it).
fn dialog(webview: &tauri::Webview) -> AsyncFileDialog {
    AsyncFileDialog::new().set_parent(&webview.window())
}

/// Asks for a folder; `None` when the user cancels.
pub async fn pick_folder(webview: &tauri::Webview) -> Option<PathBuf> {
    let handle = dialog(webview).pick_folder().await?;
    Some(handle.path().to_path_buf())
}

/// Asks where to save a zip, offering `file_name`; `None` when the user cancels. The name always ends in `.zip`.
pub async fn save_zip(webview: &tauri::Webview, file_name: &str) -> Option<PathBuf> {
    let handle = dialog(webview)
        .add_filter("zip", &["zip"])
        .set_file_name(file_name)
        .save_file()
        .await?;
    Some(with_zip_extension(handle.path().to_path_buf()))
}

/// Asks for a zip to open; `None` when the user cancels.
pub async fn open_zip(webview: &tauri::Webview) -> Option<PathBuf> {
    let handle = dialog(webview)
        .add_filter("zip", &["zip"])
        .pick_file()
        .await?;
    Some(handle.path().to_path_buf())
}

/// Asks for a picture (PNG, JPEG or WebP) to check for a watermark; `None` when the user cancels.
pub async fn open_picture(webview: &tauri::Webview) -> Option<PathBuf> {
    let handle = dialog(webview)
        .add_filter("png, jpg, webp", &["png", "jpg", "jpeg", "webp"])
        .pick_file()
        .await?;
    Some(handle.path().to_path_buf())
}

/// `name` → `name.zip`; a name that already ends in `.zip` (any case) is kept.
pub fn with_zip_extension(path: PathBuf) -> PathBuf {
    let is_zip = path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("zip"));
    if is_zip {
        path
    } else {
        let mut name = path.into_os_string();
        name.push(".zip");
        PathBuf::from(name)
    }
}

#[cfg(test)]
mod tests {
    use super::with_zip_extension;
    use std::path::PathBuf;

    #[test]
    fn a_saved_backup_always_ends_in_zip() {
        assert_eq!(
            with_zip_extension(PathBuf::from("D:/b/novira-backup")),
            PathBuf::from("D:/b/novira-backup.zip")
        );
        assert_eq!(
            with_zip_extension(PathBuf::from("D:/b/x.ZIP")),
            PathBuf::from("D:/b/x.ZIP")
        );
        assert_eq!(
            with_zip_extension(PathBuf::from("D:/b/x.tar")),
            PathBuf::from("D:/b/x.tar.zip")
        );
    }
}
