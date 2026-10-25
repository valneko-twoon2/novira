//! Pins window settings the UI depends on.

fn conf() -> serde_json::Value {
    serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json parses")
}

#[test]
fn html_drag_and_drop_reaches_the_page() {
    // With Tauri's own file-drop handling on (the default), WebView2 on Windows never delivers HTML5 drag events, so
    // dragging a gallery picture onto a reference image, the upscale input or the canvas silently does nothing.
    // The page reads dropped OS files itself (ImageDropZone), so the native handler is not needed.
    let conf = conf();
    let windows = conf["app"]["windows"].as_array().expect("windows");
    assert!(!windows.is_empty());
    for window in windows {
        assert_eq!(
            window["dragDropEnabled"].as_bool(),
            Some(false),
            "every window must set dragDropEnabled: false"
        );
    }
}
