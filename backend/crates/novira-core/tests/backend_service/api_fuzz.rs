//! Structure-aware fuzzing of the command layer: the arguments of every local command, as the screens send them (the
//! samples in `contract/` where there is one), are damaged as JSON trees, not as bytes (a value of another type, an edge
//! number, an odd string, a key taken out or put in, a list emptied or made long, a value nested deep) and sent through
//! `api::dispatch`, the entry both shells use. Strings are now and then the ids of what earlier calls made, so the calls
//! reach real boards, pictures, workflows and queue items, not only the checks at the door.
//!
//! Every call must answer or refuse, never panic (a panic of a synchronous command comes back as "Internal error"), in
//! reasonable time; the backend must still answer `bootstrap` after it; nothing may appear outside the data folder;
//! and at the end a valid job still runs through the queue. Only commands that stay on this machine are sent: none that
//! reaches a website, starts a program or touches the Windows Credential Manager.
//!
//! Fixed seed, 300 calls in the ordinary run; longer: `NOVIRA_FUZZ_ITERATIONS=5000 NOVIRA_FUZZ_SEED=<n>`. An input that
//! fails is saved to `novira-data/work/fuzz/api-<seed>-<case>.json`; a finding is pinned as an ordinary test.
use super::common::*;
use novira_core::api::{self, CallError};
use novira_core::types::QueueItemStatus;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

const SLOWEST: Duration = Duration::from_secs(10);

fn setting(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

/// xorshift64*, as `tests/fuzz_inputs.rs`: a run is repeated exactly from its seed.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn below(&mut self, n: usize) -> usize {
        if n == 0 {
            0
        } else {
            (self.next() % n as u64) as usize
        }
    }

    fn pick<'a, T>(&mut self, list: &'a [T]) -> &'a T {
        &list[self.below(list.len())]
    }
}

fn sample(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../contract")
        .join(format!("{name}.json"));
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

/// Every command sent, with arguments it accepts. Left out: what reaches a website (Civitai, Hugging Face, GitHub, the
/// ComfyUI Registry, Wikipedia, pack downloads), what starts a program (the assistant's CLIs, a ComfyUI restart, the
/// hardware probe, the font list) and the site keys in the Credential Manager.
fn commands(model: &str) -> Vec<(&'static str, Value)> {
    let mut enqueue = serde_json::to_value(request(model, "a cat", 1)).unwrap();
    enqueue["params"]["steps"] = json!(1);
    vec![
        ("bootstrap", json!({})),
        ("create_board", json!({"name": "Trip"})),
        (
            "update_board",
            json!({"id": "board-1", "patch": sample("board-patch")}),
        ),
        (
            "delete_board",
            json!({"id": "board-1", "deleteImages": false}),
        ),
        (
            "update_images",
            json!({"names": ["a.png"], "patch": sample("image-patch")}),
        ),
        ("delete_images", json!({"names": ["a.png"]})),
        ("restore_images", json!({"names": ["a.png"]})),
        ("enqueue", json!({ "request": enqueue })),
        ("cancel_queue_item", json!({"id": 1})),
        ("cancel_batch", json!({"batchId": "b"})),
        ("clear_queue", json!({})),
        ("prune_queue", json!({})),
        ("pause_processor", json!({})),
        ("resume_processor", json!({})),
        (
            "retry_queue_item",
            json!({"id": 1, "size": sample("retry-size")}),
        ),
        ("queue_snapshot", json!({})),
        ("list_starter_models", json!({})),
        ("model_parts", json!({"modelKey": model})),
        ("cancel_install", json!({"jobId": "job-1"})),
        (
            "update_model",
            json!({"key": model, "patch": {"name": "Renamed", "description": "d"}}),
        ),
        ("delete_model", json!({"key": "lora-none"})),
        ("node_packs", json!({})),
        ("cancel_node_pack", json!({"url": "https://github.com/a/b"})),
        ("remove_node_pack", json!({"folder": "some-pack"})),
        ("low_memory_mode", json!({})),
        ("engine_settings", json!({})),
        (
            "set_engine_settings",
            json!({"patch": sample("engine-settings-patch")}),
        ),
        ("remove_model_root", json!({"index": 0})),
        (
            "agent_tool_result",
            json!({"answer": sample("agent-tool-answer")}),
        ),
        ("agent_cancel", json!({})),
        ("pack_status", json!({"kind": "video"})),
        ("cancel_pack", json!({"kind": "video"})),
        (
            "save_workflow",
            json!({"workflow": sample("workflow-input")}),
        ),
        ("delete_workflow", json!({"id": "wf-1"})),
        ("list_comics", json!({})),
        (
            "save_comic",
            json!({"id": "c1", "document": {"title": "T", "pages": []}}),
        ),
        ("delete_comic", json!({"id": "c1"})),
        ("load_canvas", json!({})),
        (
            "save_canvas",
            json!({"document": "{\"version\":1,\"entities\":[]}"}),
        ),
        (
            "adopt_ui_state",
            json!({"local": "{\"novira.theme\":\"dark\"}"}),
        ),
        (
            "save_ui_state",
            json!({"state": "{\"novira.theme\":\"light\"}", "origin": null}),
        ),
        ("list_unfinished_downloads", json!({})),
        (
            "delete_unfinished_downloads",
            json!({"paths": ["models/x.part"]}),
        ),
        ("watermark_status", json!({})),
        ("check_watermark_image", json!({"name": "a.png"})),
        ("discard_restore", json!({})),
        ("take_restored_ui_state", json!({})),
    ]
}

const STRINGS: &[&str] = &[
    "",
    " ",
    "..",
    "../outside/x",
    "..\\outside\\x",
    "%2e%2e/x",
    "C:\\Windows\\win.ini",
    "\\\\?\\C:\\x",
    "\\\\server\\share",
    "/etc/passwd",
    "CON",
    "nul.png",
    "a\u{0}b",
    "a\nb",
    "\u{202e}gnp.exe",
    "🙂",
    "日本語",
    "x.png",
    "https://civitai.com.evil.example/",
    "javascript:alert(1)",
    "{\"novira.x\":1}",
    "[1]",
    "nvidia",
    "amd",
    "video",
    "txt2img",
];

/// Numbers at and around the edges a field is checked against (counts, sizes, ids, seconds).
fn edge_number(rng: &mut Rng) -> Value {
    match rng.below(12) {
        0 => json!(0),
        1 => json!(-1),
        2 => json!(1),
        3 => json!(i64::MAX),
        4 => json!(i64::MIN),
        5 => json!(u64::MAX),
        6 => json!(1e308),
        7 => json!(-0.5),
        8 => json!(65535),
        9 => json!(4_294_967_296u64),
        10 => json!(16384),
        _ => json!(rng.below(5000)),
    }
}

fn odd_string(rng: &mut Rng, ids: &[String]) -> Value {
    match rng.below(10) {
        0..=2 if !ids.is_empty() => json!(rng.pick(ids)),
        3 => json!("x".repeat([64, 65, 200, 256, 513, 100_000][rng.below(6)])),
        _ => json!(rng.pick(STRINGS)),
    }
}

/// Any value, mostly small.
fn any_value(rng: &mut Rng, ids: &[String], depth: usize) -> Value {
    match rng.below(if depth > 2 { 4 } else { 6 }) {
        0 => Value::Null,
        1 => json!(rng.below(2) == 0),
        2 => edge_number(rng),
        3 => odd_string(rng, ids),
        4 => Value::Array(
            (0..rng.below(3))
                .map(|_| any_value(rng, ids, depth + 1))
                .collect(),
        ),
        _ => {
            let mut map = Map::new();
            for _ in 0..rng.below(3) {
                map.insert(
                    odd_string(rng, &[]).as_str().unwrap().to_string(),
                    any_value(rng, ids, depth + 1),
                );
            }
            Value::Object(map)
        }
    }
}

/// A node of the tree chosen at random (the root included), to damage in place.
fn some_node<'a>(rng: &mut Rng, v: &'a mut Value) -> &'a mut Value {
    let children = match v {
        Value::Array(a) => a.len(),
        Value::Object(m) => m.len(),
        _ => 0,
    };
    if children == 0 || rng.below(3) == 0 {
        return v;
    }
    let at = rng.below(children);
    match v {
        Value::Array(a) => some_node(rng, &mut a[at]),
        Value::Object(m) => {
            let child = m.values_mut().nth(at).unwrap();
            some_node(rng, child)
        }
        _ => unreachable!(),
    }
}

/// `args` damaged one to three times.
fn mutate(rng: &mut Rng, args: &mut Value, ids: &[String]) {
    for _ in 0..1 + rng.below(3) {
        let node = some_node(rng, args);
        match rng.below(10) {
            0 => *node = any_value(rng, ids, 0),
            1 => *node = edge_number(rng),
            2 => *node = odd_string(rng, ids),
            3 => {
                if let Value::Object(m) = node {
                    if let Some(key) = m.keys().nth(rng.below(m.len().max(1))).cloned() {
                        m.remove(&key);
                    }
                }
            }
            4 => {
                if let Value::Object(m) = node {
                    let key = odd_string(rng, &[]).as_str().unwrap().to_string();
                    m.insert(key, any_value(rng, ids, 0));
                }
            }
            5 => {
                if let Value::Array(a) = node {
                    if let Some(first) = a.first().cloned() {
                        let times = [2, 100, 1001, 5000][rng.below(4)];
                        a.resize(times, first);
                    } else {
                        a.push(any_value(rng, ids, 0));
                    }
                }
            }
            6 => {
                if let Value::Array(a) = node {
                    a.clear();
                }
            }
            7 => {
                // Nested deeper than any screen sends; the server's JSON reader stops past 128 levels.
                let mut deep = node.take();
                for _ in 0..[10, 60, 127][rng.below(3)] {
                    deep = json!([deep]);
                }
                *node = deep;
            }
            8 => *node = json!(rng.pick(ids_or_none(ids))),
            _ => *node = Value::Null,
        }
    }
}

fn ids_or_none(ids: &[String]) -> &[String] {
    static NONE: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
    if ids.is_empty() {
        NONE.get_or_init(|| vec!["none".into()])
    } else {
        ids
    }
}

/// The ids and names that exist now, for the damaged arguments to name.
fn known_ids(boot: &Value) -> Vec<String> {
    let mut ids = Vec::new();
    for (list, field) in [
        ("boards", "id"),
        ("images", "name"),
        ("workflows", "id"),
        ("models", "key"),
    ] {
        for item in boot[list].as_array().into_iter().flatten() {
            if let Some(id) = item[field].as_str() {
                ids.push(id.to_string());
            }
        }
    }
    for item in boot["queue"]["items"].as_array().into_iter().flatten() {
        if let Some(batch) = item["batchId"].as_str() {
            ids.push(batch.to_string());
        }
    }
    ids
}

/// Every path under `dir` (files and folders), relative to it.
fn tree(dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let rel = PathBuf::from(entry.file_name());
        out.push(rel.clone());
        if entry.path().is_dir() {
            out.extend(tree(&entry.path()).into_iter().map(|p| rel.join(p)));
        }
    }
    out.sort();
    out
}

fn fail(seed: u64, case: u64, name: &str, args: &Value, what: String) -> ! {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../novira-data/work/fuzz");
    let _ = std::fs::create_dir_all(&dir);
    let file = dir.join(format!("api-{seed}-{case}.json"));
    let _ = std::fs::write(
        &file,
        serde_json::to_string_pretty(&json!({"command": name, "args": args})).unwrap(),
    );
    panic!(
        "{name} {what} on case {case} of seed {seed}; the input is {}",
        file.display()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn damaged_arguments_of_every_local_command_are_answered_or_refused() {
    let cases = setting("NOVIRA_FUZZ_ITERATIONS", 300);
    let seed = setting("NOVIRA_FUZZ_SEED", 0x6e6f_7669_7261);
    let mut rng = Rng(seed | 1);
    let root = tempfile::tempdir().unwrap();
    let data = root.path().join("data");
    // Something of the user's next to the data folder: a path that escapes would reach it.
    let outside = root.path().join("outside");
    std::fs::create_dir_all(&outside).unwrap();
    std::fs::write(outside.join("x"), b"keep").unwrap();
    write_lora_and_checkpoint(&data.join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(&data, engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let model = main_key(&backend);
    let commands = commands(&model);
    // Every seed is accepted as it is, so the damage starts from what reaches the backend.
    for (name, args) in &commands {
        if let Err(e) = api::dispatch(&backend, name, args.clone()).await {
            assert!(
                !matches!(e, CallError::UnknownCommand | CallError::BadArguments(_)),
                "the seed of {name} is not accepted: {e}"
            );
        }
    }
    // How far the damaged calls got: answered, refused at the door (arguments), refused by the backend.
    let mut tally = [0u64; 3];
    let mut ids = known_ids(&serde_json::from_str(&backend_boot(&backend).await).unwrap());
    for case in 0..cases {
        let (name, seed_args) = rng.pick(&commands);
        let name: &'static str = name;
        let mut args = seed_args.clone();
        mutate(&mut rng, &mut args, &ids);
        // What a shell can receive: the server reads JSON text, which stops past 128 levels.
        let Ok(args) = serde_json::from_str::<Value>(&args.to_string()) else {
            continue;
        };
        let started = Instant::now();
        let call = {
            let backend = backend.clone();
            let args = args.clone();
            tokio::spawn(async move { api::dispatch(&backend, name, args).await })
        };
        let outcome = match tokio::time::timeout(SLOWEST, call).await {
            Err(_) => fail(seed, case, name, &args, format!("took over {SLOWEST:?}")),
            Ok(Err(join)) => fail(seed, case, name, &args, format!("panicked: {join}")),
            Ok(Ok(outcome)) => outcome,
        };
        tally[match &outcome {
            Ok(_) => 0,
            Err(CallError::Failed(_)) => 2,
            Err(_) => 1,
        }] += 1;
        if let Err(CallError::Failed(message)) = &outcome {
            if message.starts_with("Internal error") {
                fail(seed, case, name, &args, format!("failed inside: {message}"));
            }
        }
        if started.elapsed() > SLOWEST {
            fail(
                seed,
                case,
                name,
                &args,
                format!("took {:?}", started.elapsed()),
            );
        }
        let boot = backend_boot(&backend).await;
        if case % 10 == 0 {
            ids = known_ids(&serde_json::from_str(&boot).unwrap());
        }
        let outside_now = tree(&outside);
        let root_now = tree(root.path())
            .into_iter()
            .filter(|p| !p.starts_with("data"))
            .collect::<Vec<_>>();
        let expected = [PathBuf::from("outside"), PathBuf::from("outside").join("x")];
        if outside_now != [PathBuf::from("x")] || root_now != expected {
            fail(
                seed,
                case,
                name,
                &args,
                format!("wrote outside the data folder: {root_now:?}"),
            );
        }
    }
    eprintln!(
        "api fuzz: {} answered, {} refused for their arguments, {} refused by the backend",
        tally[0], tally[1], tally[2]
    );
    assert_eq!(std::fs::read(outside.join("x")).unwrap(), b"keep");
    // The worker survived whatever the queue was sent: a valid job still runs to the end.
    api::dispatch(&backend, "resume_processor", json!({}))
        .await
        .unwrap();
    api::dispatch(&backend, "clear_queue", json!({}))
        .await
        .unwrap();
    let mut job = serde_json::to_value(request(&model, "after the fuzzing", 1)).unwrap();
    job["params"]["steps"] = json!(1);
    api::dispatch(&backend, "enqueue", json!({ "request": job }))
        .await
        .unwrap();
    // A damaged call may have deleted the model (`delete_model` is sent the ids that exist): then the job fails for
    // that, and still has to be taken and ended by the worker.
    let model_left = backend.bootstrap().models.iter().any(|m| m.key == model);
    for _ in 0..200 {
        match statuses(&backend).as_slice() {
            [QueueItemStatus::Completed] => return,
            [QueueItemStatus::Failed] if !model_left => return,
            _ => {}
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let last = engine.jobs.lock().unwrap().last().map(|j| {
        format!(
            "{}x{} steps {} mode {:?}",
            j.params.width, j.params.height, j.params.steps, j.params.generation_mode
        )
    });
    panic!(
        "the job after the fuzzing did not finish: {}; the engine's last job: {last:?}",
        serde_json::to_string(&backend.queue_snapshot()).unwrap()
    );
}

async fn backend_boot(backend: &novira_core::Backend) -> String {
    api::dispatch(backend, "bootstrap", json!({}))
        .await
        .expect("bootstrap answers after every call")
}
