//! The canvas document (layers, masks, bounding box) kept across restarts.
//! One JSON text in the `meta` table; the frontend owns its shape, the backend only checks size and that it parses.
use super::*;

const CANVAS_META: &str = "canvas";

/// Largest canvas document accepted (bytes). Strokes are the bulk of it; pictures are saved as gallery images.
pub const MAX_CANVAS_BYTES: usize = 32 * 1024 * 1024;

impl Backend {
    /// The saved canvas document, or `None` when nothing was saved yet.
    pub fn load_canvas(&self) -> Result<Option<String>> {
        Ok(self.db().meta(CANVAS_META)?)
    }

    /// Replaces the saved canvas document. It must be a JSON object no larger than `MAX_CANVAS_BYTES`.
    pub fn save_canvas(&self, document: &str) -> Result<()> {
        if document.len() > MAX_CANVAS_BYTES {
            return Err(BackendError::Invalid(
                "the canvas document is too large".into(),
            ));
        }
        match serde_json::from_str::<Value>(document) {
            Ok(Value::Object(_)) => {}
            _ => {
                return Err(BackendError::Invalid(
                    "the canvas document must be a JSON object".into(),
                ))
            }
        }
        self.db().set_meta(CANVAS_META, document)?;
        Ok(())
    }
}
