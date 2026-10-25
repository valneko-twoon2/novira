//! Backend events go to the window on one channel; the frontend's Tauri client listens to it.
use novira_core::EventSink;
use std::sync::Arc;
use tauri::Emitter;

pub const EVENT_CHANNEL: &str = "novira://event";

pub fn sink(app: tauri::AppHandle) -> EventSink {
    Arc::new(move |event| {
        if let Err(e) = app.emit(EVENT_CHANNEL, event) {
            // Not through applog: its sink is this function, so a failing emit would recurse.
            eprintln!("novira: event emit failed: {e}");
        }
    })
}
