//! Saved workflows.
use super::*;

/// Largest workflow graph accepted (bytes of its JSON text). The same cap as the canvas and comic documents.
pub const MAX_WORKFLOW_BYTES: usize = 32 * 1024 * 1024;
/// Longest name and author accepted (characters).
const MAX_NAME_CHARS: usize = 200;
/// Longest description accepted (characters).
const MAX_DESCRIPTION_CHARS: usize = 20_000;
/// Most tags, and the longest tag (characters).
const MAX_TAGS: usize = 50;
const MAX_TAG_CHARS: usize = 100;

fn invalid(what: &str) -> BackendError {
    BackendError::Invalid(format!("the workflow's {what}"))
}

/// What a workflow must be to be saved: a name, text of sane length without control characters (a description may
/// have line breaks and tabs), at most `MAX_TAGS` tags, and a graph that is a JSON object no larger than
/// `MAX_WORKFLOW_BYTES`. The graph's own shape is the frontend's: the backend keeps it as it is.
fn check(input: &WorkflowInput) -> Result<()> {
    let plain = |text: &str, longest: usize| {
        text.chars().count() <= longest && !text.chars().any(char::is_control)
    };
    if input.name.trim().is_empty() || !plain(&input.name, MAX_NAME_CHARS) {
        return Err(invalid(&format!(
            "name must be 1 to {MAX_NAME_CHARS} characters without control characters"
        )));
    }
    if !plain(&input.author, MAX_NAME_CHARS) {
        return Err(invalid(&format!(
            "author must be at most {MAX_NAME_CHARS} characters without control characters"
        )));
    }
    let description_ok = input.description.chars().count() <= MAX_DESCRIPTION_CHARS
        && !input
            .description
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'));
    if !description_ok {
        return Err(invalid(&format!(
            "description must be at most {MAX_DESCRIPTION_CHARS} characters without control characters"
        )));
    }
    if input.tags.len() > MAX_TAGS || !input.tags.iter().all(|t| plain(t, MAX_TAG_CHARS)) {
        return Err(invalid(&format!(
            "tags must be at most {MAX_TAGS}, each at most {MAX_TAG_CHARS} characters without control characters"
        )));
    }
    if !input.graph.is_object() {
        return Err(invalid("graph must be a JSON object"));
    }
    let size = serde_json::to_string(&input.graph).map_err(internal)?.len();
    if size > MAX_WORKFLOW_BYTES {
        return Err(invalid("graph is too large"));
    }
    Ok(())
}

impl Backend {
    /// Saves a workflow of the user's: a new one, or the one of `input.id` when it is a saved workflow of the user's
    /// (any other id makes a new one). The database is written first, so a write that fails leaves the list in memory
    /// as it was.
    pub fn save_workflow(&self, input: WorkflowInput) -> Result<SavedWorkflow> {
        check(&input)?;
        let known = input.id.as_deref().and_then(|id| {
            self.state()
                .workflows
                .iter()
                .find(|w| w.id == id && w.category == "user")
                .map(|w| w.id.clone())
        });
        let saved = SavedWorkflow {
            id: known.unwrap_or_else(|| new_id("wf")),
            name: input.name,
            description: input.description,
            author: input.author,
            tags: input.tags,
            category: "user".into(),
            updated_at: now(),
            graph: input.graph,
        };
        self.db()
            .put(Table::Workflows, &saved.id, saved.updated_at, &saved)?;
        let mut s = self.state();
        match s.workflows.iter_mut().find(|w| w.id == saved.id) {
            Some(w) => *w = saved.clone(),
            None => s.workflows.push(saved.clone()),
        }
        Ok(saved)
    }

    /// Removes the workflow under `id`; the database first, like a save.
    pub fn delete_workflow(&self, id: &str) -> Result<()> {
        self.db().delete(Table::Workflows, &[id])?;
        self.state().workflows.retain(|w| w.id != id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::ProgressFn;
    use serde_json::json;

    /// A service with an engine that never runs anything: saved workflows do not use it.
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

    fn input() -> WorkflowInput {
        WorkflowInput {
            id: None,
            name: "W".into(),
            description: "line one\nline two\tend".into(),
            author: "me".into(),
            tags: vec!["a".into(), "b".into()],
            graph: json!({ "nodes": [] }),
        }
    }

    fn refused(backend: &Backend, change: impl FnOnce(&mut WorkflowInput)) -> String {
        let mut wf = input();
        change(&mut wf);
        backend.save_workflow(wf).unwrap_err().to_string()
    }

    #[test]
    fn a_workflow_is_saved_and_replaced_as_it_was_given() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        let first = backend.save_workflow(input()).unwrap();
        assert_eq!(first.category, "user");
        let mut again = input();
        again.id = Some(first.id.clone());
        again.name = "W2".into();
        let second = backend.save_workflow(again).unwrap();
        assert_eq!(second.id, first.id);
        let listed = backend.bootstrap().workflows;
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "W2");
        backend.delete_workflow(&first.id).unwrap();
        assert!(backend.bootstrap().workflows.is_empty());
    }

    #[test]
    fn a_name_must_be_there_and_plain_and_not_too_long() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        for name in [
            "",
            "   ",
            "a\u{0}b",
            "a\nb",
            &"x".repeat(MAX_NAME_CHARS + 1),
        ] {
            let err = refused(&backend, |w| w.name = name.into());
            assert!(err.contains("name"), "{name:?}: {err}");
        }
        let longest = "é".repeat(MAX_NAME_CHARS);
        assert!(backend
            .save_workflow(WorkflowInput {
                name: longest,
                ..input()
            })
            .is_ok());
        assert!(
            refused(&backend, |w| w.author = "x".repeat(MAX_NAME_CHARS + 1)).contains("author")
        );
        assert!(refused(&backend, |w| w.author = "a\u{7}".into()).contains("author"));
        assert_eq!(backend.bootstrap().workflows.len(), 1);
    }

    #[test]
    fn a_description_may_have_line_breaks_but_no_other_control_characters() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        assert!(refused(&backend, |w| w.description = "a\u{1b}[0m".into()).contains("description"));
        assert!(refused(&backend, |w| w.description =
            "x".repeat(MAX_DESCRIPTION_CHARS + 1))
        .contains("description"));
        assert!(backend.save_workflow(input()).is_ok());
    }

    #[test]
    fn tags_are_limited_in_number_and_length() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        let many: Vec<String> = (0..=MAX_TAGS).map(|i| format!("t{i}")).collect();
        assert!(refused(&backend, |w| w.tags = many).contains("tags"));
        assert!(
            refused(&backend, |w| w.tags = vec!["x".repeat(MAX_TAG_CHARS + 1)]).contains("tags")
        );
        assert!(refused(&backend, |w| w.tags = vec!["a\nb".into()]).contains("tags"));
        let most: Vec<String> = (0..MAX_TAGS).map(|i| format!("t{i}")).collect();
        assert!(backend
            .save_workflow(WorkflowInput {
                tags: most,
                ..input()
            })
            .is_ok());
    }

    #[test]
    fn a_graph_must_be_an_object_of_a_sane_size() {
        let dir = tempfile::tempdir().unwrap();
        let backend = open(dir.path());
        for graph in [json!(null), json!([1]), json!("text"), json!(3)] {
            let err = refused(&backend, |w| w.graph = graph);
            assert!(err.contains("graph must be a JSON object"), "{err}");
        }
        let big = json!({ "blob": "x".repeat(MAX_WORKFLOW_BYTES) });
        assert!(refused(&backend, |w| w.graph = big).contains("too large"));
        assert!(backend.bootstrap().workflows.is_empty());
    }
}
