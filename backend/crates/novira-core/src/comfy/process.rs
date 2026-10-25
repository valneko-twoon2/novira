//! A ComfyUI process that novira starts itself. Only this process is stopped on exit; a server
//! that was already running is never touched.
use crate::sync::LockExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

/// ComfyUI's option for low-memory mode. With dynamic VRAM (on by default on NVIDIA in ComfyUI 0.38, the version read)
/// `--lowvram` does nothing; `--novram` turns dynamic VRAM off and keeps as little of a model in GPU memory as it can
///.
pub const LOW_MEMORY_FLAG: &str = "--novram";

/// ComfyUI's mutually exclusive VRAM options: argparse refuses a second one, so low-memory mode replaces them.
const VRAM_FLAGS: &[&str] = &["--gpu-only", "--highvram", "--lowvram", "--novram"];

/// Whether the host of an address (as a URL gives it) is on this PC: `localhost` or a loopback IP. The owned ComfyUI is
/// started with `--listen <host>`, so nothing that would open it to the network may be passed on.
pub fn is_this_pc(host: &str) -> bool {
    let host = host.trim_start_matches('[').trim_end_matches(']');
    host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback())
}

pub struct OwnedProcessConfig {
    pub comfyui_dir: PathBuf,
    pub python: Option<PathBuf>,
    pub host: String,
    pub port: u16,
    pub extra_model_paths: PathBuf,
    pub extra_args: Vec<String>,
    pub log_file: PathBuf,
}

pub struct ComfyProcess {
    config: OwnedProcessConfig,
    child: Mutex<Option<Child>>,
    /// Start with low-memory mode from the next start on.
    low_memory: AtomicBool,
    /// Whether the running process was started in low-memory mode.
    started_low_memory: AtomicBool,
}

/// The Python that belongs to a ComfyUI folder: its venv, the portable build's embedded Python, or `python`.
pub fn find_python(dir: &Path) -> PathBuf {
    let candidates = [
        dir.join("venv").join("Scripts").join("python.exe"),
        dir.join(".venv").join("Scripts").join("python.exe"),
        dir.join("..").join("python_embeded").join("python.exe"),
        dir.join("venv").join("bin").join("python"),
        dir.join(".venv").join("bin").join("python"),
    ];
    candidates
        .into_iter()
        .find(|p| p.is_file())
        .unwrap_or_else(|| PathBuf::from("python"))
}

/// Command-line arguments for `main.py`. Low-memory mode adds [`LOW_MEMORY_FLAG`] in place of any VRAM option of the
/// user's own arguments, and is left out when they ask for `--cpu` (there is no GPU memory to save).
pub fn arguments(c: &OwnedProcessConfig, low_memory: bool) -> Vec<String> {
    let mut args = vec![
        "main.py".to_string(),
        "--listen".into(),
        c.host.clone(),
        "--port".into(),
        c.port.to_string(),
        "--disable-auto-launch".into(),
        "--preview-method".into(),
        "auto".into(),
        "--extra-model-paths-config".into(),
        c.extra_model_paths.to_string_lossy().into_owned(),
    ];
    let low_memory = low_memory && !c.extra_args.iter().any(|a| a == "--cpu");
    args.extend(
        c.extra_args
            .iter()
            .filter(|a| !low_memory || !VRAM_FLAGS.contains(&a.as_str()))
            .cloned(),
    );
    if low_memory {
        args.push(LOW_MEMORY_FLAG.into());
    }
    args
}

impl ComfyProcess {
    pub fn new(config: OwnedProcessConfig) -> Self {
        Self {
            config,
            child: Mutex::new(None),
            low_memory: AtomicBool::new(false),
            started_low_memory: AtomicBool::new(false),
        }
    }

    /// Low-memory mode for the next start; a running process keeps what it was started with.
    pub fn set_low_memory(&self, on: bool) {
        self.low_memory.store(on, Ordering::SeqCst);
    }

    /// The process runs with the other low-memory value than the one set for the next start.
    pub fn low_memory_pending(&self) -> bool {
        self.is_running()
            && self.started_low_memory.load(Ordering::SeqCst)
                != self.low_memory.load(Ordering::SeqCst)
    }

    pub fn is_running(&self) -> bool {
        let mut guard = self.child.lock_safe();
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(None) => true,
                _ => {
                    *guard = None;
                    false
                }
            },
            None => false,
        }
    }

    /// The ComfyUI folder this process runs.
    pub fn comfyui_dir(&self) -> &Path {
        &self.config.comfyui_dir
    }

    /// The Python it runs with.
    pub fn python(&self) -> PathBuf {
        self.config
            .python
            .clone()
            .unwrap_or_else(|| find_python(&self.config.comfyui_dir))
    }

    /// Starts the process unless ours is still running. Output goes to the log file.
    pub fn start(&self) -> Result<(), String> {
        if self.is_running() {
            return Ok(());
        }
        let c = &self.config;
        if !c.comfyui_dir.join("main.py").is_file() {
            return Err(format!(
                "ComfyUI was not found in {}",
                c.comfyui_dir.display()
            ));
        }
        if let Some(parent) = c.log_file.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let log = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&c.log_file)
            .map_err(|e| e.to_string())?;
        let err_log = log.try_clone().map_err(|e| e.to_string())?;
        let python = c
            .python
            .clone()
            .unwrap_or_else(|| find_python(&c.comfyui_dir));
        let low_memory = self.low_memory.load(Ordering::SeqCst);
        let mut cmd = Command::new(&python);
        cmd.args(arguments(c, low_memory))
            .current_dir(&c.comfyui_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::from(log))
            .stderr(Stdio::from(err_log))
            .env("PYTHONUNBUFFERED", "1")
            // On a Windows with a legacy code page (cp932 and the like) a pack's log line holding a character such
            // as an em dash makes Python's logging fail while custom nodes load, and ComfyUI exits.
            .env("PYTHONUTF8", "1")
            .env("PYTHONIOENCODING", "utf-8");
        for (name, dir) in cache_env(&c.log_file) {
            // Best effort: a cache folder that cannot be made just leaves the tool its default.
            if std::fs::create_dir_all(&dir).is_ok() {
                cmd.env(name, dir);
            }
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let child = cmd
            .spawn()
            .map_err(|e| format!("Cannot start ComfyUI with {}: {e}", python.display()))?;
        #[cfg(windows)]
        crate::child_job::bind(std::os::windows::io::AsRawHandle::as_raw_handle(&child));
        *self.child.lock_safe() = Some(child);
        self.started_low_memory.store(low_memory, Ordering::SeqCst);
        Ok(())
    }

    pub fn stop(&self) {
        if let Some(mut child) = self.child.lock_safe().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for ComfyProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Environment that keeps the caches and temporary files of ComfyUI's Python (Hugging Face, PyTorch, pip, Triton, temp)
/// inside novira's data folder instead of the user profile on the system drive. The data folder is the parent of
/// the folder holding the log file.
fn cache_env(log_file: &Path) -> Vec<(&'static str, PathBuf)> {
    let Some(data_dir) = log_file.parent().and_then(Path::parent) else {
        return Vec::new();
    };
    let cache = data_dir.join("cache");
    vec![
        ("HF_HOME", cache.join("huggingface")),
        ("TORCH_HOME", cache.join("torch")),
        ("XDG_CACHE_HOME", cache.join("xdg")),
        ("PIP_CACHE_DIR", cache.join("pip")),
        ("TRITON_CACHE_DIR", cache.join("triton")),
        ("TEMP", cache.join("temp")),
        ("TMP", cache.join("temp")),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_this_pc_may_be_listened_on() {
        for ok in [
            "127.0.0.1",
            "localhost",
            "LOCALHOST",
            "[::1]",
            "::1",
            "127.8.9.1",
        ] {
            assert!(is_this_pc(ok), "{ok}");
        }
        for no in [
            "0.0.0.0",
            "::",
            "[::]",
            "192.168.0.2",
            "10.0.0.1",
            "example.com",
            "127.0.0.1.evil.example",
            "",
        ] {
            assert!(!is_this_pc(no), "{no}");
        }
    }

    #[test]
    fn caches_stay_inside_the_data_folder() {
        let env = cache_env(Path::new("D:/app/novira-data/logs/comfyui.log"));
        assert!(!env.is_empty());
        for (_, dir) in &env {
            assert!(dir.starts_with("D:/app/novira-data/cache"), "{dir:?}");
        }
        assert!(cache_env(Path::new("comfyui.log")).is_empty());
    }

    #[test]
    fn arguments_bind_loopback_and_point_at_the_model_paths() {
        let c = OwnedProcessConfig {
            comfyui_dir: "C:/ComfyUI".into(),
            python: None,
            host: "127.0.0.1".into(),
            port: 8189,
            extra_model_paths: "D:/data/extra_model_paths.yaml".into(),
            extra_args: vec!["--lowvram".into()],
            log_file: "D:/data/logs/comfyui.log".into(),
        };
        let args = arguments(&c, false).join(" ");
        assert!(args.starts_with("main.py --listen 127.0.0.1 --port 8189 --disable-auto-launch"));
        assert!(args.contains("--extra-model-paths-config D:/data/extra_model_paths.yaml"));
        assert!(args.ends_with("--lowvram"));
    }

    fn config_with(extra_args: &[&str]) -> OwnedProcessConfig {
        OwnedProcessConfig {
            comfyui_dir: "C:/ComfyUI".into(),
            python: None,
            host: "127.0.0.1".into(),
            port: 8189,
            extra_model_paths: "D:/data/extra_model_paths.yaml".into(),
            extra_args: extra_args.iter().map(|a| a.to_string()).collect(),
            log_file: "D:/data/logs/comfyui.log".into(),
        }
    }

    #[test]
    fn low_memory_mode_replaces_the_users_vram_option() {
        let args = arguments(&config_with(&["--fast", "--highvram"]), true);
        assert_eq!(
            args.iter()
                .filter(|a| a.as_str() == LOW_MEMORY_FLAG)
                .count(),
            1
        );
        assert!(args.contains(&"--fast".to_string()));
        assert!(
            !args.contains(&"--highvram".to_string()),
            "argparse refuses two VRAM options"
        );
        let args = arguments(&config_with(&["--novram"]), true);
        assert_eq!(
            args.iter()
                .filter(|a| a.as_str() == LOW_MEMORY_FLAG)
                .count(),
            1
        );
        // Off: the user's arguments go through unchanged.
        let args = arguments(&config_with(&["--highvram"]), false);
        assert!(
            args.contains(&"--highvram".to_string())
                && !args.contains(&LOW_MEMORY_FLAG.to_string())
        );
    }

    #[test]
    fn low_memory_mode_is_left_out_on_the_cpu() {
        let args = arguments(&config_with(&["--cpu"]), true);
        assert!(args.contains(&"--cpu".to_string()));
        assert!(!args.contains(&LOW_MEMORY_FLAG.to_string()));
    }

    #[test]
    fn a_stopped_process_has_no_pending_low_memory_change() {
        let p = ComfyProcess::new(config_with(&[]));
        p.set_low_memory(true);
        assert!(!p.low_memory_pending(), "it starts with the new value");
    }

    #[test]
    fn missing_install_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let p = ComfyProcess::new(OwnedProcessConfig {
            comfyui_dir: dir.path().into(),
            python: None,
            host: "127.0.0.1".into(),
            port: 1,
            extra_model_paths: dir.path().join("x.yaml"),
            extra_args: vec![],
            log_file: dir.path().join("log.txt"),
        });
        assert!(p.start().unwrap_err().contains("not found"));
        assert!(!p.is_running());
    }
}
