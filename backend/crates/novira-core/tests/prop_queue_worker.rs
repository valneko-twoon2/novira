//! A model-based property test of the queue together with its worker. Unlike `prop_queue.rs` (worker paused), the worker
//! runs here and the test decides how every job ends through the fake engine's gate: finish, fail, or cancel while it
//! runs. A restart (a graceful close, or a crash that drops the worker mid-job) reopens the same data folder.
//! After every operation the queue must equal a plain model, and the events of each item must be the legal path of the
//! state machine: pending, in progress, then one terminal status, nothing after it, nothing twice, and the last event
//! is the final status. Most operations wait for the queue to settle; the burst operations do not, they fire several
//! moves back to back while the worker is picking up or finishing a job, where the model still predicts the result.
//! Waiting uses the backend's events with a deadline; there is no sleep.
//! Run: `cargo test -p novira-core --test prop_queue_worker`.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;
mod prop_common;

use common::*;
use novira_core::types::*;
use novira_core::Backend;
use prop_common::check_up_to;
use proptest::prelude::*;
use proptest::test_runner::TestCaseError;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::watch;
use tokio::task::JoinHandle;
use tokio::time::Instant;

use QueueItemStatus::{Canceled, Completed, Failed, InProgress, Pending};

/// How long one step may take to reach the state the model expects. Short, so a shrinking run stays quick.
const DEADLINE: Duration = Duration::from_secs(3);

#[derive(Debug, Clone)]
enum Op {
    Enqueue {
        iterations: u32,
        prepend: bool,
    },
    Cancel(usize),
    CancelRunning,
    CancelBatch(usize),
    CancelUnknown,
    Retry(usize),
    Prune,
    Clear,
    Pause,
    Resume,
    Finish,
    Fail,
    /// Moves fired back to back, without waiting for the worker in between (it may be picking up the first pending item
    /// at that moment). `resume` starts with a resume, so the cancels race the worker's start of a job.
    Burst {
        resume: bool,
        moves: Vec<Op>,
    },
    /// The running job ends and the queue is cleared at once: the worker's save of the end races the clear.
    FinishThenClear {
        finish: bool,
    },
    /// Close the backend on the same folder again; `graceful` shuts the worker down, otherwise it is dropped mid-job.
    Restart {
        graceful: bool,
    },
}

/// The moves a burst may hold: every one has the same end state whether or not the worker got in first.
fn quick_op() -> impl Strategy<Value = Op> {
    prop_oneof![
        3 => (0usize..8).prop_map(Op::Cancel),
        2 => Just(Op::CancelRunning),
        3 => (0usize..8).prop_map(Op::CancelBatch),
        1 => Just(Op::Prune),
        1 => Just(Op::Clear),
    ]
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        3 => (any::<bool>(), prop::collection::vec(quick_op(), 1..4))
            .prop_map(|(resume, moves)| Op::Burst { resume, moves }),
        2 => any::<bool>().prop_map(|finish| Op::FinishThenClear { finish }),
        4 => (1u32..4, any::<bool>()).prop_map(|(iterations, prepend)| Op::Enqueue { iterations, prepend }),
        2 => (0usize..8).prop_map(Op::Cancel),
        2 => Just(Op::CancelRunning),
        1 => (0usize..8).prop_map(Op::CancelBatch),
        1 => Just(Op::CancelUnknown),
        3 => (0usize..8).prop_map(Op::Retry),
        1 => Just(Op::Prune),
        1 => Just(Op::Clear),
        2 => Just(Op::Pause),
        3 => Just(Op::Resume),
        4 => Just(Op::Finish),
        3 => Just(Op::Fail),
        2 => any::<bool>().prop_map(|graceful| Op::Restart { graceful }),
    ]
}

#[derive(Debug, Clone, PartialEq)]
struct Item {
    id: u64,
    batch: String,
    status: QueueItemStatus,
    seed: u64,
}

/// What the queue and its worker should hold, written without any of the code's own branches.
#[derive(Debug, Clone)]
struct Model {
    items: Vec<Item>,
    paused: bool,
}

impl Model {
    fn running(&self) -> Option<u64> {
        self.items
            .iter()
            .find(|m| m.status == InProgress)
            .map(|m| m.id)
    }

    /// The worker takes the first pending item when it is not paused and nothing runs.
    fn kick(&mut self) {
        if self.paused || self.running().is_some() {
            return;
        }
        if let Some(m) = self.items.iter_mut().find(|m| m.status == Pending) {
            m.status = InProgress;
        }
    }

    fn pick(&self, i: usize) -> Option<usize> {
        (!self.items.is_empty()).then(|| i % self.items.len())
    }

    fn end_running(&mut self, to: QueueItemStatus) {
        for m in self.items.iter_mut().filter(|m| m.status == InProgress) {
            m.status = to;
        }
    }

    fn stop(&mut self, id: u64) {
        for m in self.items.iter_mut().filter(|m| m.id == id) {
            if matches!(m.status, Pending | InProgress) {
                m.status = Canceled;
            }
        }
    }
}

enum Ev {
    Item(u64, QueueItemStatus),
}

/// One opened backend with its worker, its gate and the log of its events.
struct Run {
    b: Backend,
    worker: JoinHandle<()>,
    gate: Arc<Gate>,
    log: Arc<Mutex<Vec<Ev>>>,
    tick: watch::Receiver<u64>,
    key: String,
}

fn start(dir: &std::path::Path) -> Run {
    let gate = Arc::new(Gate::default());
    let engine = Arc::new(FakeEngine {
        gate: Some(gate.clone()),
        ..Default::default()
    });
    let (b, _) = open(dir, engine);
    let log = Arc::new(Mutex::new(Vec::new()));
    let (tx, tick) = watch::channel(0u64);
    let sink = log.clone();
    b.set_event_sink(Arc::new(move |e| {
        if let BackendEvent::QueueItemStatusChanged { item } = e {
            sink.lock().unwrap().push(Ev::Item(item.id, item.status));
        }
        tx.send_modify(|n| *n += 1);
    }));
    let key = main_key(&b);
    let worker = tokio::spawn(b.clone().run_worker());
    Run {
        b,
        worker,
        gate,
        log,
        tick,
        key,
    }
}

fn actual(b: &Backend) -> Vec<Item> {
    b.queue_snapshot()
        .items
        .iter()
        .map(|q| Item {
            id: q.id,
            batch: q.batch_id.clone(),
            status: q.status,
            seed: q.params.seed,
        })
        .collect()
}

/// What the events seen so far allow for one item: pending, in progress, then one terminal status, and nothing after
/// that. The events of different items are not checked against each other (a cancel of one item and the start of the
/// next may be announced in either order); "at most one in progress" is checked on the snapshots, which are taken
/// under the queue's lock. A retry is a new item, so it starts its own path.
#[derive(Default)]
struct Events {
    last: HashMap<u64, QueueItemStatus>,
}

impl Events {
    fn drain(&mut self, log: &Mutex<Vec<Ev>>) -> Result<(), TestCaseError> {
        let events: Vec<Ev> = std::mem::take(&mut *log.lock().unwrap());
        for e in events {
            let Ev::Item(id, st) = e;
            let prev = self.last.insert(id, st);
            let legal = matches!(
                (prev, st),
                (None, Pending)
                    | (Some(Pending), InProgress | Canceled)
                    | (Some(InProgress), Completed | Failed | Canceled)
            );
            prop_assert!(legal, "item {id} moved {prev:?} -> {st:?}");
        }
        Ok(())
    }
}

/// Waits (on events, with a deadline) until the queue equals the model, then checks the derived numbers.
async fn settle(
    run: &mut Run,
    model: &Model,
    seen: &mut Events,
    step: &str,
) -> Result<(), TestCaseError> {
    let deadline = Instant::now() + DEADLINE;
    loop {
        run.tick.borrow_and_update();
        let now = actual(&run.b);
        seen.drain(&run.log)?;
        let in_progress = now.iter().filter(|m| m.status == InProgress).count();
        prop_assert!(in_progress <= 1, "{step}: {in_progress} items in progress");
        // A move shows in the state a moment before its event; the last event of every item must be its final status.
        let announced = model
            .items
            .iter()
            .all(|m| seen.last.get(&m.id) == Some(&m.status));
        if now == model.items && announced {
            let snap = run.b.queue_snapshot().status;
            let count = |s: QueueItemStatus| now.iter().filter(|m| m.status == s).count() as u32;
            prop_assert_eq!(snap.total, now.len() as u32);
            prop_assert_eq!(snap.pending, count(Pending));
            prop_assert_eq!(snap.in_progress, count(InProgress));
            prop_assert_eq!(snap.completed, count(Completed));
            prop_assert_eq!(snap.failed, count(Failed));
            prop_assert_eq!(snap.canceled, count(Canceled));
            prop_assert_eq!(snap.is_paused, model.paused);
            return Ok(());
        }
        if tokio::time::timeout_at(deadline, run.tick.changed())
            .await
            .is_err()
        {
            return Err(TestCaseError::fail(format!(
                "{step}: the queue did not reach the model\n  model:  {:?}\n  actual: {:?}
  last event of each item: {:?}",
                model.items, now, seen.last
            )));
        }
    }
}

async fn one_case(ops: Vec<Op>) -> Result<(), TestCaseError> {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let mut run = start(dir.path());
    run.b.pause_processor();
    let mut model = Model {
        items: Vec::new(),
        paused: true,
    };
    let mut seen = Events::default();
    let mut last_id = 0u64;
    let mut result = Ok(());
    for (n, op) in ops.iter().enumerate() {
        let step = format!("step {n} {op:?}");
        result = if let Op::Restart { graceful } = *op {
            match restart(
                run,
                &mut model,
                &mut seen,
                &mut last_id,
                dir.path(),
                graceful,
            )
            .await
            {
                Ok(fresh) => {
                    run = fresh;
                    Ok(())
                }
                Err(e) => return Err(e),
            }
        } else {
            apply(&mut run, &mut model, &mut last_id, op).await
        };
        if result.is_ok() {
            model.kick();
            result = settle(&mut run, &model, &mut seen, &step).await;
        }
        if result.is_err() {
            break;
        }
    }
    run.b.shutdown();
    let _ = run.worker.await;
    if result.is_ok() {
        // The close may end a running job; whatever it announces must still be a legal move.
        result = seen.drain(&run.log);
    }
    result
}

/// Closes the backend (`graceful`, or by dropping the worker mid-job as a crash would) and opens the folder again.
async fn restart(
    mut run: Run,
    model: &mut Model,
    seen: &mut Events,
    last_id: &mut u64,
    dir: &std::path::Path,
    graceful: bool,
) -> Result<Run, TestCaseError> {
    if graceful {
        run.b.shutdown();
        let _ = (&mut run.worker).await;
        // A job running at close is interrupted, which is a cancel.
        model.end_running(Canceled);
    } else {
        run.worker.abort();
        let _ = (&mut run.worker).await;
        // A job running at a crash is found in progress at the next start and is failed then.
        model.end_running(Failed);
    }
    seen.drain(&run.log)?;
    // The old backend must be gone before the same folder is opened again.
    drop(run);
    // The new backend knows the items as they were saved: terminal ones stay as they are, pending ones are next to run.
    *seen = Events::default();
    for m in &model.items {
        seen.last.insert(m.id, m.status);
    }
    // The order of a prepended item is not saved (see state-machines.md), so a reopened queue lists (and runs) the items by id.
    model.items.sort_by_key(|m| m.id);
    // Pending items wait for an explicit resume; with none left the worker is not held back.
    model.paused = model.items.iter().any(|m| m.status == Pending);
    *last_id = model.items.iter().map(|m| m.id).max().unwrap_or(0);
    Ok(start(dir))
}

/// The moves that act on the queue at once and whose result does not depend on what the worker does meanwhile.
fn quick(run: &Run, model: &mut Model, op: &Op) {
    match *op {
        Op::Cancel(i) => {
            if let Some(at) = model.pick(i) {
                let id = model.items[at].id;
                run.b.cancel_queue_item(id);
                model.stop(id);
            }
        }
        Op::CancelRunning => {
            if let Some(id) = model.running() {
                run.b.cancel_queue_item(id);
                model.stop(id);
            }
        }
        Op::CancelBatch(i) => {
            if let Some(at) = model.pick(i) {
                let batch = model.items[at].batch.clone();
                run.b.cancel_batch(&batch);
                let ids: Vec<u64> = model
                    .items
                    .iter()
                    .filter(|m| m.batch == batch)
                    .map(|m| m.id)
                    .collect();
                for id in ids {
                    model.stop(id);
                }
            }
        }
        Op::Prune => {
            run.b.prune_queue().unwrap();
            model
                .items
                .retain(|m| matches!(m.status, Pending | InProgress));
        }
        Op::Clear => {
            run.b.clear_queue().unwrap();
            model.items.clear();
        }
        _ => unreachable!("not a quick move"),
    }
}

async fn apply(
    run: &mut Run,
    model: &mut Model,
    last_id: &mut u64,
    op: &Op,
) -> Result<(), TestCaseError> {
    match *op {
        Op::Enqueue {
            iterations,
            prepend,
        } => {
            let mut req = request(&run.key, "p", iterations);
            req.prepend = prepend;
            let items = run.b.enqueue(req).unwrap();
            let batch = items[0].batch_id.clone();
            let new: Vec<Item> = items
                .iter()
                .map(|q| Item {
                    id: q.id,
                    batch: batch.clone(),
                    status: Pending,
                    seed: q.params.seed,
                })
                .collect();
            for q in &new {
                prop_assert!(q.id > *last_id, "ids only grow");
                *last_id = q.id;
            }
            let at = if prepend {
                model
                    .items
                    .iter()
                    .position(|m| m.status == Pending)
                    .unwrap_or(model.items.len())
            } else {
                model.items.len()
            };
            model.items.splice(at..at, new);
        }
        Op::Cancel(_) | Op::CancelRunning | Op::CancelBatch(_) | Op::Prune | Op::Clear => {
            quick(run, model, op)
        }
        Op::CancelUnknown => {
            run.b.cancel_queue_item(u64::MAX);
            run.b.cancel_batch("no-such-batch");
        }
        Op::Retry(i) => {
            if let Some(at) = model.pick(i) {
                let old = model.items[at].clone();
                let got = run.b.retry_queue_item(old.id, None).unwrap();
                if matches!(old.status, Failed | Canceled) {
                    let q = got.expect("a failed or canceled item can be queued again");
                    prop_assert!(q.id > *last_id, "ids only grow");
                    *last_id = q.id;
                    prop_assert_eq!(q.status, Pending);
                    prop_assert_eq!(q.params.seed, old.seed, "a retry keeps the seed");
                    model.items.push(Item {
                        id: q.id,
                        batch: q.batch_id.clone(),
                        status: Pending,
                        seed: old.seed,
                    });
                } else {
                    prop_assert!(got.is_none(), "{:?} is not retried", old.status);
                }
            }
        }
        Op::Pause => {
            run.b.pause_processor();
            model.paused = true;
        }
        Op::Resume => {
            run.b.resume_processor();
            model.paused = false;
        }
        Op::Finish | Op::Fail => {
            if model.running().is_some() {
                let finish = matches!(op, Op::Finish);
                *run.gate.outcome.lock().unwrap() = Some(finish);
                run.gate.wake.notify_one();
                model.end_running(if finish { Completed } else { Failed });
            }
        }
        Op::Burst { resume, ref moves } => {
            if resume {
                run.b.resume_processor();
                model.paused = false;
                model.kick();
            }
            for m in moves {
                quick(run, model, m);
                model.kick();
            }
        }
        Op::FinishThenClear { finish } => {
            if model.running().is_some() {
                *run.gate.outcome.lock().unwrap() = Some(finish);
                run.gate.wake.notify_one();
                // Clear only once the engine has taken the outcome, so the job is on its way to being saved and the clear
                // races that save; an outcome the job never took would be handed to the next job.
                let deadline = Instant::now() + DEADLINE;
                while run.gate.outcome.lock().unwrap().is_some() {
                    if Instant::now() > deadline {
                        return Err(TestCaseError::fail("the engine did not take the outcome"));
                    }
                    tokio::task::yield_now().await; // no sleep: the engine is on another thread
                }
            }
            quick(run, model, &Op::Clear);
        }
        Op::Restart { .. } => unreachable!("a restart replaces the whole run, see `restart`"),
    }
    Ok(())
}

// tags: model-based, state-transition
#[test]
fn the_queue_and_its_worker_follow_a_plain_model_through_any_sequence_of_moves() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    check_up_to(128, prop::collection::vec(op(), 1..20), |ops| {
        rt.block_on(one_case(ops))
    });
}
