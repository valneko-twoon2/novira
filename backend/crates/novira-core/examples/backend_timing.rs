//! Start-up and command timings of the backend on a copy of a real data folder, to compare a change against the code
//! before it. Nothing here starts ComfyUI or uses the GPU.
//!
//! `cargo run --release -p novira-core --example backend_timing -- <source data folder> <scratch folder> [--runs N] [--json <file>]`
//!
//! Each start opens a fresh copy of the source's top-level files (`novira.sqlite`, `settings.json`, ...) in the scratch
//! folder, so a run that writes (meta rows, the WAL, corrected models) never changes the next one; the source is only
//! read. The copy is opened once before the timed start, as an app that ran before (its folders made, its one-time
//! corrections done); `--first` times that first open instead. Model folders named in its `settings.json`
//! (`modelRoots`) are read, never written. Prints the steps of
//! `Backend::open` and, for the commands the screens call at start and often, the median time of the call, of turning
//! its answer into JSON bytes, and of the browser server's path (`api::dispatch`, then bytes), with the size of the JSON.
//! `--json` also writes every sample (ms) to a file, for `tools/perf.mjs`.
use novira_core::api::{self, call, Res};
use novira_core::models::{classify, layout};
use novira_core::startup;
use novira_core::types::{ImagePatch, ModelType};
use novira_core::{Backend, BackendConfig, Settings};
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (Some(source), Some(scratch)) = (args.first(), args.get(1)) else {
        eprintln!(
            "usage: backend_timing <source data folder> <scratch folder> [--runs N] [--first] [--json <file>]"
        );
        std::process::exit(2);
    };
    let runs: usize = args
        .iter()
        .position(|a| a == "--runs")
        .and_then(|i| args.get(i + 1))
        .and_then(|n| n.parse().ok())
        .unwrap_or(7);
    let first = args.iter().any(|a| a == "--first");
    let json_file = args
        .iter()
        .position(|a| a == "--json")
        .and_then(|i| args.get(i + 1))
        .map(PathBuf::from);
    let (source, scratch) = (PathBuf::from(source), PathBuf::from(scratch));
    assert!(
        source.canonicalize().ok() != scratch.canonicalize().ok(),
        "the scratch folder must not be the source"
    );

    let which = if first {
        "the first open"
    } else {
        "opened once before"
    };
    println!("## Start-up ({runs} opens, each on a fresh copy, {which})\n");
    let mut totals = Vec::new();
    let mut phases: Vec<(&'static str, Vec<Duration>)> = Vec::new();
    let mut backend = None;
    for run in 0..runs {
        let dir = scratch.join(format!("run-{run}"));
        fresh_copy(&source, &dir);
        if !first {
            // Without the lock: the timed open below takes it.
            let settings = Settings::load(&dir).expect("settings");
            drop(
                Backend::open(BackendConfig {
                    data_dir: dir.clone(),
                    image_url_base: "/novira-image".into(),
                    settings,
                })
                .expect("the first open"),
            );
        }
        let started = Instant::now();
        let opened = startup::open_backend(&dir, "/novira-image".into())
            .unwrap_or_else(|_| panic!("cannot open {}", dir.display()));
        totals.push(started.elapsed());
        for (i, (name, d)) in opened.open_timings().phases.iter().enumerate() {
            if phases.len() <= i {
                phases.push((name, Vec::new()));
            }
            phases[i].1.push(*d);
        }
        backend = Some(opened);
    }
    println!("| step | first ms | median ms |\n|---|---:|---:|");
    for (name, ds) in &phases {
        println!("| {name} | {:.2} | {:.2} |", ms(ds[0]), ms(median(ds)));
    }
    println!(
        "| **open_backend total** (lock, settings, open) | {:.2} | {:.2} |\n",
        ms(totals[0]),
        ms(median(&totals))
    );

    // In an app whose models folder holds the checkpoints (not a model root), every start reads their headers to find
    // misfiled ones. The copy's own models folder is empty, so the same reads are timed here on the model roots, read-only.
    let b = backend.expect("at least one run");
    for root in b.model_roots().iter().skip(1) {
        let started = Instant::now();
        let mut files = 0;
        for alias in layout::category_for_kind(ModelType::Main)
            .expect("main category")
            .aliases
        {
            for file in layout::walk(&root.join(alias)) {
                files += 1;
                std::hint::black_box(
                    classify::read_header(&file)
                        .as_ref()
                        .and_then(classify::detect_kind),
                );
            }
        }
        println!(
            "Checkpoint headers read in {} (what the misfiled check reads when it is the models folder): {files} files, {:.2} ms\n",
            root.display(),
            ms(started.elapsed())
        );
    }
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    let mut out = Map::new();
    let n = 20;
    println!("## Commands (median of {n})\n");
    println!("| command | call ms | to JSON ms | bytes | dispatch + bytes ms |\n|---|---:|---:|---:|---:|");
    measure(&mut out, &rt, &b, n, "bootstrap", || call::bootstrap(&b));
    measure(&mut out, &rt, &b, n, "queue_snapshot", || {
        call::queue_snapshot(&b)
    });
    measure(&mut out, &rt, &b, n, "list_starter_models", || {
        call::list_starter_models(&b)
    });
    measure(&mut out, &rt, &b, n, "node_packs", || call::node_packs(&b));
    measure(&mut out, &rt, &b, n, "low_memory_mode", || {
        call::low_memory_mode(&b)
    });
    measure(&mut out, &rt, &b, n, "engine_settings", || {
        call::engine_settings(&b)
    });
    measure(&mut out, &rt, &b, n, "has_civitai_key", || {
        call::has_civitai_key(&b)
    });
    measure(&mut out, &rt, &b, n, "has_hf_token", || {
        call::has_hf_token(&b)
    });
    measure(&mut out, &rt, &b, n, "watermark_status", || {
        call::watermark_status(&b)
    });
    measure(&mut out, &rt, &b, n, "load_canvas", || {
        call::load_canvas(&b)
    });
    measure(&mut out, &rt, &b, n, "list_comics", || {
        call::list_comics(&b)
    });
    measure(&mut out, &rt, &b, n, "take_restored_ui_state", || {
        call::take_restored_ui_state(&b)
    });
    measure(&mut out, &rt, &b, n, "list_unfinished_downloads", || {
        rt.block_on(call::list_unfinished_downloads(&b))
    });
    measure(&mut out, &rt, &b, n, "list_fonts", || {
        rt.block_on(call::list_fonts(&b))
    });
    // It runs the assistant CLIs (their sign-in status), so it takes many samples too.
    measure(&mut out, &rt, &b, n, "agent_status", || {
        rt.block_on(call::agent_status(&b))
    });

    // Changes the screens make often, on the last copy: star one picture (and back), move a hundred to no board.
    let names: Vec<String> = call::bootstrap(&b)
        .expect("bootstrap")
        .images
        .iter()
        .map(|i| i.name.clone())
        .collect();
    let star = |on: bool| ImagePatch {
        starred: Some(on),
        ..ImagePatch::default()
    };
    let one = vec![names[0].clone()];
    let mut flip = false;
    measure_no_dispatch(&mut out, n, "update_images (1, star)", || {
        flip = !flip;
        call::update_images(&b, one.clone(), star(flip))
    });
    let hundred: Vec<String> = names.iter().take(100).cloned().collect();
    measure_no_dispatch(&mut out, n, "update_images (100, star)", || {
        flip = !flip;
        call::update_images(&b, hundred.clone(), star(flip))
    });
    measure_no_dispatch(
        &mut out,
        7,
        &format!("update_images ({}, star)", names.len()),
        || {
            flip = !flip;
            call::update_images(&b, names.clone(), star(flip))
        },
    );

    if let Some(file) = json_file {
        let samples = |ds: &[Duration]| ds.iter().map(|d| ms(*d)).collect::<Vec<_>>();
        let open: Map<String, Value> = phases
            .iter()
            .map(|(name, ds)| (name.to_string(), json!(samples(ds))))
            .collect();
        let report =
            json!({ "runs": runs, "open": open, "openTotal": samples(&totals), "commands": out });
        std::fs::write(&file, serde_json::to_vec_pretty(&report).expect("json"))
            .unwrap_or_else(|e| panic!("cannot write {}: {e}", file.display()));
    }
}

/// Times a command's call and its JSON bytes, then the same command through `api::dispatch` (the browser server's path).
fn measure<T: Serialize>(
    out: &mut Map<String, Value>,
    rt: &tokio::runtime::Runtime,
    b: &Backend,
    n: usize,
    name: &str,
    mut f: impl FnMut() -> Res<T>,
) {
    let (calls, encodes, bytes) = time_call(n, &mut f);
    let dispatched: Vec<Duration> = (0..n)
        .map(|_| {
            let started = Instant::now();
            let body = rt
                .block_on(api::dispatch(b, name, Value::Null))
                .unwrap_or_else(|e| panic!("{name}: {e}"));
            std::hint::black_box(body);
            started.elapsed()
        })
        .collect();
    record(out, name, &calls, &encodes, Some(&dispatched), bytes);
    println!(
        "| {name} | {:.3} | {:.3} | {bytes} | {:.3} |",
        ms(median(&calls)),
        ms(median(&encodes)),
        ms(median(&dispatched))
    );
}

fn measure_no_dispatch<T: Serialize>(
    out: &mut Map<String, Value>,
    n: usize,
    name: &str,
    mut f: impl FnMut() -> Res<T>,
) {
    let (calls, encodes, bytes) = time_call(n, &mut f);
    record(out, name, &calls, &encodes, None, bytes);
    println!(
        "| {name} | {:.3} | {:.3} | {bytes} | - |",
        ms(median(&calls)),
        ms(median(&encodes))
    );
}

/// Every sample of one command, in ms, for `--json`.
fn record(
    out: &mut Map<String, Value>,
    name: &str,
    calls: &[Duration],
    encodes: &[Duration],
    dispatched: Option<&[Duration]>,
    bytes: usize,
) {
    let samples = |ds: &[Duration]| ds.iter().map(|d| ms(*d)).collect::<Vec<_>>();
    out.insert(
        name.to_string(),
        json!({ "call": samples(calls), "json": samples(encodes), "dispatch": dispatched.map(samples), "bytes": bytes }),
    );
}

fn time_call<T: Serialize>(
    n: usize,
    f: &mut impl FnMut() -> Res<T>,
) -> (Vec<Duration>, Vec<Duration>, usize) {
    let (mut calls, mut encodes, mut bytes) = (Vec::new(), Vec::new(), 0);
    for _ in 0..n {
        let started = Instant::now();
        let value = f().unwrap_or_else(|e| panic!("{e}"));
        calls.push(started.elapsed());
        let started = Instant::now();
        let body = serde_json::to_vec(&value).expect("json");
        encodes.push(started.elapsed());
        bytes = body.len();
    }
    (calls, encodes, bytes)
}

/// Replaces `dir` with a copy of the files at the top of `source` (folders such as thumbnails are left out: opening
/// does not read them).
fn fresh_copy(source: &Path, dir: &Path) {
    if dir.exists() {
        std::fs::remove_dir_all(dir).expect("remove the previous copy");
    }
    std::fs::create_dir_all(dir).expect("create the copy");
    for entry in std::fs::read_dir(source)
        .expect("read the source")
        .flatten()
    {
        if entry.file_type().is_ok_and(|t| t.is_file())
            && entry.file_name() != startup::LOCK_FILE_NAME
        {
            std::fs::copy(entry.path(), dir.join(entry.file_name())).expect("copy a file");
        }
    }
}

fn median(ds: &[Duration]) -> Duration {
    let mut sorted = ds.to_vec();
    sorted.sort();
    sorted[sorted.len() / 2]
}

fn ms(d: Duration) -> f64 {
    d.as_secs_f64() * 1000.0
}
