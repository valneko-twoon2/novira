//! The app's own log: lines from the backend (and panics, see the shell) go to stderr, to `logs/novira.log` in the
//! data folder (kept below a size limit) and, once the window is up, to the frontend's developer log as events.
use crate::sync::RwLockExt;
use crate::types::{BackendEvent, LogEntry, LogLevel};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

type Sink = Arc<dyn Fn(BackendEvent) + Send + Sync>;

static SINK: RwLock<Option<Sink>> = RwLock::new(None);
static FILE: Mutex<Option<PathBuf>> = Mutex::new(None);

/// A log file is moved to `<name>.1` once it grows past this.
pub const MAX_FILE_BYTES: u64 = 2_000_000;
/// Longest message kept; longer ones are cut (a stray huge error must not flood the window).
pub const MAX_MESSAGE_CHARS: usize = 4_000;

/// Sends later lines to the window too.
pub fn set_sink(sink: Sink) {
    *SINK.write_safe() = Some(sink);
}

/// Also appends lines to this file (rotated at `MAX_FILE_BYTES`).
pub fn set_file(path: PathBuf) {
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    *FILE.lock().unwrap_or_else(|p| p.into_inner()) = Some(path);
}

pub fn info(source: &str, message: impl Into<String>) {
    log(LogLevel::Info, source, message);
}

pub fn warn(source: &str, message: impl Into<String>) {
    log(LogLevel::Warn, source, message);
}

pub fn error(source: &str, message: impl Into<String>) {
    log(LogLevel::Error, source, message);
}

pub fn log(level: LogLevel, source: &str, message: impl Into<String>) {
    let entry = entry(level, source, message.into());
    eprintln!(
        "novira [{:?}] {}: {}",
        entry.level, entry.source, entry.message
    );
    append_to_file(&entry);
    // Never let logging itself fail the caller (it runs inside the panic hook too).
    let sink = SINK.read_safe().clone();
    if let Some(sink) = sink {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            sink(BackendEvent::Log { entry })
        }));
    }
}

fn entry(level: LogLevel, source: &str, mut message: String) -> LogEntry {
    if message.chars().count() > MAX_MESSAGE_CHARS {
        message = message.chars().take(MAX_MESSAGE_CHARS).collect::<String>() + "…";
    }
    let at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    LogEntry {
        at,
        level,
        source: source.chars().take(40).collect(),
        message,
    }
}

fn append_to_file(entry: &LogEntry) {
    let path = FILE.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let Some(path) = path else { return };
    if std::fs::metadata(&path)
        .map(|m| m.len() > MAX_FILE_BYTES)
        .unwrap_or(false)
    {
        let _ = std::fs::rename(&path, path.with_extension("log.1"));
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(
            f,
            "{} {:?} {}: {}",
            entry.at, entry.level, entry.source, entry.message
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn long_messages_and_sources_are_cut() {
        let e = entry(
            LogLevel::Info,
            &"s".repeat(100),
            "x".repeat(MAX_MESSAGE_CHARS + 10),
        );
        assert_eq!(e.source.len(), 40);
        assert_eq!(e.message.chars().count(), MAX_MESSAGE_CHARS + 1);
        assert!(e.message.ends_with('…'));
        assert!(e.at > 0);
    }

    #[test]
    fn lines_reach_the_file_and_the_file_rotates() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("logs").join("novira.log");
        set_file(path.clone());
        error("test", "first line");
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("Error test: first line"), "{text}");
        std::fs::write(&path, vec![b'a'; MAX_FILE_BYTES as usize + 1]).unwrap();
        info("test", "after rotation");
        assert!(path.with_extension("log.1").exists());
        assert!(std::fs::read_to_string(&path)
            .unwrap()
            .contains("after rotation"));
        *FILE.lock().unwrap() = None;
    }
}
