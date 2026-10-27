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

#[test]
fn the_window_starts_hidden_until_its_theme_is_set() {
    // Shown at once, the frame followed Windows until setup gave it the saved theme, so a light app opened in a dark
    // frame; setup shows the window itself (`show_window`) on every path.
    let conf = conf();
    for window in conf["app"]["windows"].as_array().expect("windows") {
        assert_eq!(window["visible"].as_bool(), Some(false));
    }
    let lib = include_str!("../src/lib.rs");
    assert_eq!(
        lib.matches("show_window(app,").count(),
        3,
        "the moving, first-start and normal paths each show it"
    );
}
