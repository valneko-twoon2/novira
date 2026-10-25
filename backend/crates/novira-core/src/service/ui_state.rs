//! The screen state (what the pages keep under `novira.*` in the browser's storage: settings, history, drafts, presets,
//! the prompt book) kept in the database, so the desktop app and the browser server, which open the same data folder one
//! after the other, show the same state. One JSON object of key to text in the `meta` table; the frontend owns the texts.
use super::*;

const UI_STATE_META: &str = "ui_state";
/// What a start replaced with the backend's state, kept once so it is not lost (the latest only).
const REPLACED_META: &str = "ui_state_replaced";

/// Largest screen state accepted (bytes). Pictures are not in it: they are gallery images.
pub const MAX_UI_STATE_BYTES: usize = 32 * 1024 * 1024;
/// Every key of the state starts with this, and a key is at most this long.
const KEY_PREFIX: &str = "novira.";
const MAX_KEY_LEN: usize = 200;
/// The longest sender id a save may carry.
const MAX_ORIGIN_LEN: usize = 64;

/// The revision of the latest save: milliseconds since the epoch, raised by one when two saves land in the same
/// millisecond, so it only grows (also across restarts, which a plain counter would not).
static LAST_REVISION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn next_revision() -> u64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64);
    let previous = LAST_REVISION
        .try_update(
            std::sync::atomic::Ordering::SeqCst,
            std::sync::atomic::Ordering::SeqCst,
            |last| Some(now.max(last + 1)),
        )
        .unwrap_or(0);
    now.max(previous + 1)
}

/// The sender id as the event carries it: a page's random id, else empty. Anything that is not 1 to 64 letters,
/// digits, `-` or `_` is dropped, so an event never carries text the page did not mint.
fn clean_origin(origin: Option<&str>) -> String {
    match origin {
        Some(o)
            if !o.is_empty()
                && o.len() <= MAX_ORIGIN_LEN
                && o.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') =>
        {
            o.to_string()
        }
        _ => String::new(),
    }
}

/// Checks the text is a JSON object of `novira.*` keys with text values.
fn check(state: &str) -> Result<()> {
    if state.len() > MAX_UI_STATE_BYTES {
        return Err(BackendError::Invalid(
            "the screen state is too large".into(),
        ));
    }
    match serde_json::from_str::<Value>(state) {
        Ok(Value::Object(map))
            if map.iter().all(|(k, v)| {
                k.starts_with(KEY_PREFIX) && k.len() <= MAX_KEY_LEN && v.is_string()
            }) =>
        {
            Ok(())
        }
        _ => Err(BackendError::Invalid(
            "the screen state must be a JSON object of novira.* keys with text values".into(),
        )),
    }
}

impl Backend {
    /// The first thing a page asks at start-up. `local` is what the page's own storage holds when this page has never
    /// been synced with the backend (else `None`).
    /// - The backend has a state: it is returned (the page takes it); a different `local` is kept in the database
    ///   first (`ui_state_replaced`), since the backend's state wins.
    /// - The backend has none: `local` becomes the state, and `None` is returned (the page keeps what it has).
    pub fn adopt_ui_state(&self, local: Option<&str>) -> Result<Option<String>> {
        if let Some(local) = local {
            check(local)?;
        }
        let db = self.db();
        match db.meta(UI_STATE_META)? {
            Some(saved) => {
                if let Some(local) = local.filter(|l| *l != saved && *l != "{}") {
                    db.set_meta(REPLACED_META, local)?;
                }
                Ok(Some(saved))
            }
            None => {
                if let Some(local) = local.filter(|l| *l != "{}") {
                    db.set_meta(UI_STATE_META, local)?;
                }
                Ok(None)
            }
        }
    }

    /// Replaces the saved screen state, then tells every open page with a `ui_state_changed` event (the state itself
    /// is not in it: a page reads it with `adopt_ui_state`). `origin` is the saving page's own id, so that page can
    /// tell the event is its own echo.
    pub fn save_ui_state(&self, state: &str, origin: Option<&str>) -> Result<()> {
        check(state)?;
        self.db().set_meta(UI_STATE_META, state)?;
        self.emit(BackendEvent::UiStateChanged {
            origin: clean_origin(origin),
            revision: next_revision(),
        });
        Ok(())
    }
}
