//! Comic projects, one row each in the `comics` table. Like the canvas the frontend owns the shape of the
//! document; the backend checks the id, the size and that the document is a JSON object, then keeps it as it is.
use super::*;

/// Largest comic document accepted (bytes of its JSON text). The same cap as the canvas document.
pub const MAX_COMIC_BYTES: usize = 32 * 1024 * 1024;
/// Longest comic id accepted (characters).
const MAX_COMIC_ID_LEN: usize = 64;

/// A comic id is 1 to 64 ASCII letters, digits, `-` or `_`: it is the row key the frontend chooses.
fn valid_comic_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_COMIC_ID_LEN
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

impl Backend {
    /// Every saved comic, oldest change first.
    pub fn list_comics(&self) -> Result<Vec<ComicRecord>> {
        Ok(self.db().load(Table::Comics)?)
    }

    /// Saves the comic under `id`, replacing the one there, and stamps it with the time of this save.
    /// The id must be a valid comic id, the document a JSON object no larger than `MAX_COMIC_BYTES`.
    pub fn save_comic(&self, id: &str, document: Value) -> Result<()> {
        if !valid_comic_id(id) {
            return Err(BackendError::Invalid(
                "the comic id must be 1 to 64 letters, digits, '-' or '_'".into(),
            ));
        }
        if !document.is_object() {
            return Err(BackendError::Invalid(
                "the comic must be a JSON object".into(),
            ));
        }
        let size = serde_json::to_string(&document).map_err(internal)?.len();
        if size > MAX_COMIC_BYTES {
            return Err(BackendError::Invalid("the comic is too large".into()));
        }
        let record = ComicRecord {
            id: id.into(),
            updated_at: now(),
            document,
        };
        self.db()
            .put(Table::Comics, id, record.updated_at, &record)?;
        Ok(())
    }

    /// Removes the comic under `id`; nothing happens when there is none.
    pub fn delete_comic(&self, id: &str) -> Result<()> {
        self.db().delete(Table::Comics, &[id])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::ProgressFn;
    use serde_json::json;

    /// A service with an engine that never runs anything: comics do not use it.
    struct NoEngine;

    #[async_trait::async_trait]
    impl Engine for NoEngine {
        async fn generate(
            &self,
            _job: &EngineJob,
            _progress: ProgressFn<'_>,
            _cancel: &CancellationToken,
        ) -> std::result::Result<EngineOutput, EngineError> {
            Err(EngineError::Cancelled)
        }
    }

    fn open(dir: &std::path::Path) -> Backend {
        Backend::open_with_engine(
            BackendConfig {
                data_dir: dir.to_path_buf(),
                image_url_base: "http://novira-image.localhost".into(),
                settings: Settings {
                    gpu_lock: String::new(),
                    ..Settings::default()
                },
            },
            Arc::new(NoEngine),
        )
        .unwrap()
    }

    fn comic(title: &str) -> Value {
        json!({ "title": title, "pages": [{ "panels": [] }] })
    }

    #[test]
    fn a_saved_comic_is_listed_with_the_document_as_it_was_saved() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        assert!(backend.list_comics().unwrap().is_empty());
        let doc = json!({ "title": "夜明け", "pages": [1.5, null, true], "nested": { "a": [] } });
        backend.save_comic("comic-1", doc.clone()).unwrap();
        let listed = backend.list_comics().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, "comic-1");
        assert_eq!(listed[0].document, doc);
        assert!(listed[0].updated_at > 0);
    }

    #[test]
    fn saving_the_same_id_replaces_the_document() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        backend.save_comic("c", comic("first")).unwrap();
        backend.save_comic("c", comic("second")).unwrap();
        let listed = backend.list_comics().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].document, comic("second"));
    }

    #[test]
    fn comics_are_listed_oldest_change_first() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        backend.save_comic("older", comic("a")).unwrap();
        std::thread::sleep(Duration::from_millis(5));
        backend.save_comic("newer", comic("b")).unwrap();
        let ids: Vec<String> = backend
            .list_comics()
            .unwrap()
            .into_iter()
            .map(|c| c.id)
            .collect();
        assert_eq!(ids, ["older", "newer"]);
    }

    #[test]
    fn ids_outside_the_rule_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        let too_long = "x".repeat(MAX_COMIC_ID_LEN + 1);
        for id in ["", "a b", "a/b", "a.b", "é", too_long.as_str()] {
            assert!(
                backend.save_comic(id, comic("x")).is_err(),
                "{id:?} must be refused"
            );
        }
        let longest = "x".repeat(MAX_COMIC_ID_LEN);
        for id in ["a", "A-9_z", longest.as_str()] {
            assert!(
                backend.save_comic(id, comic("x")).is_ok(),
                "{id:?} must be accepted"
            );
        }
        assert_eq!(backend.list_comics().unwrap().len(), 3);
    }

    #[test]
    fn a_document_that_is_not_an_object_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        for doc in [json!([1]), json!("text"), json!(null), json!(3)] {
            assert!(backend.save_comic("c", doc).is_err());
        }
        assert!(backend.list_comics().unwrap().is_empty());
    }

    #[test]
    fn a_document_over_the_size_cap_is_refused_and_the_saved_one_stays() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        backend.save_comic("c", comic("good")).unwrap();
        // `{"x":"` and `"}` are 8 bytes around the string, so this text is one byte over the cap.
        let over = json!({ "x": "a".repeat(MAX_COMIC_BYTES - 7) });
        assert!(backend.save_comic("c", over).is_err());
        let listed = backend.list_comics().unwrap();
        assert_eq!(listed[0].document, comic("good"));
    }

    #[test]
    fn a_document_of_exactly_the_size_cap_is_accepted() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        let at_cap = json!({ "x": "a".repeat(MAX_COMIC_BYTES - 8) });
        assert_eq!(
            serde_json::to_string(&at_cap).unwrap().len(),
            MAX_COMIC_BYTES
        );
        backend.save_comic("c", at_cap).unwrap();
    }

    #[test]
    fn delete_removes_the_comic_and_is_harmless_when_absent() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        backend.save_comic("a", comic("a")).unwrap();
        backend.save_comic("b", comic("b")).unwrap();
        backend.delete_comic("a").unwrap();
        backend.delete_comic("missing").unwrap();
        let ids: Vec<String> = backend
            .list_comics()
            .unwrap()
            .into_iter()
            .map(|c| c.id)
            .collect();
        assert_eq!(ids, ["b"]);
    }
}
