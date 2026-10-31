//! A model-based property test of the queue: random sequences of enqueue, cancel, retry, prune and clear run on a paused
//! backend (nothing is picked up, so every step is deterministic) and after each step the queue must equal a plain model.
//! Run: `cargo test -p novira-core --test prop_queue`.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;
mod prop_common;

use common::*;
use novira_core::types::*;
use prop_common::check_up_to;
use proptest::prelude::*;
use std::sync::Arc;

#[derive(Debug, Clone)]
enum Op {
    Enqueue { iterations: u32, prepend: bool },
    Cancel(usize),
    CancelUnknown,
    CancelBatch(usize),
    Retry(usize),
    Prune,
    Clear,
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        4 => (1u32..4, any::<bool>()).prop_map(|(iterations, prepend)| Op::Enqueue { iterations, prepend }),
        3 => (0usize..8).prop_map(Op::Cancel),
        1 => Just(Op::CancelUnknown),
        1 => (0usize..8).prop_map(Op::CancelBatch),
        3 => (0usize..8).prop_map(Op::Retry),
        1 => Just(Op::Prune),
        1 => Just(Op::Clear),
    ]
}

/// What the queue holds, as (id, batch, status), in the order the queue lists it.
type Model = Vec<(u64, String, QueueItemStatus)>;

fn actual(b: &novira_core::Backend) -> Model {
    b.queue_snapshot()
        .items
        .iter()
        .map(|q| (q.id, q.batch_id.clone(), q.status))
        .collect()
}

fn pick(model: &Model, i: usize) -> Option<u64> {
    (!model.is_empty()).then(|| model[i % model.len()].0)
}

#[test]
fn the_queue_follows_a_plain_model_through_any_sequence_of_operations() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .build()
        .unwrap();
    let _guard = rt.enter();
    let dir = tempfile::tempdir().unwrap();
    let (b, _events) = open(dir.path(), Arc::new(FakeEngine::default()));
    b.pause_processor();
    b.clear_queue().unwrap();

    check_up_to(64, prop::collection::vec(op(), 1..25), |ops| {
        b.clear_queue().unwrap();
        let mut model: Model = Vec::new();
        let mut last_id = b.queue_snapshot().items.last().map_or(0, |q| q.id);
        for op in ops {
            match op {
                Op::Enqueue {
                    iterations,
                    prepend,
                } => {
                    let mut req = request("k", "p", iterations);
                    req.prepend = prepend;
                    let items = b.enqueue(req).unwrap();
                    prop_assert_eq!(items.len() as u32, iterations);
                    let batch = items[0].batch_id.clone();
                    for q in &items {
                        // Ids only grow, whatever else happened; a batch shares one id.
                        prop_assert!(q.id > last_id);
                        last_id = q.id;
                        prop_assert_eq!(&q.batch_id, &batch);
                        prop_assert_eq!(q.status, QueueItemStatus::Pending);
                    }
                    let new: Model = items
                        .iter()
                        .map(|q| (q.id, batch.clone(), QueueItemStatus::Pending))
                        .collect();
                    if prepend {
                        model.splice(0..0, new);
                    } else {
                        model.extend(new);
                    }
                }
                Op::Cancel(i) => {
                    if let Some(id) = pick(&model, i) {
                        b.cancel_queue_item(id);
                        for m in model.iter_mut().filter(|m| m.0 == id) {
                            if m.2 == QueueItemStatus::Pending {
                                m.2 = QueueItemStatus::Canceled;
                            }
                        }
                    }
                }
                Op::CancelUnknown => {
                    b.cancel_queue_item(u64::MAX);
                    b.cancel_batch("no-such-batch");
                }
                Op::CancelBatch(i) => {
                    if let Some(id) = pick(&model, i) {
                        let batch = model.iter().find(|m| m.0 == id).unwrap().1.clone();
                        b.cancel_batch(&batch);
                        for m in model.iter_mut().filter(|m| m.1 == batch) {
                            if m.2 == QueueItemStatus::Pending {
                                m.2 = QueueItemStatus::Canceled;
                            }
                        }
                    }
                }
                Op::Retry(i) => {
                    if let Some(id) = pick(&model, i) {
                        let status = model.iter().find(|m| m.0 == id).unwrap().2;
                        let got = b.retry_queue_item(id, None).unwrap();
                        match status {
                            QueueItemStatus::Canceled | QueueItemStatus::Failed => {
                                let q = got.expect("a canceled item can be queued again");
                                prop_assert!(q.id > last_id);
                                last_id = q.id;
                                prop_assert_eq!(q.status, QueueItemStatus::Pending);
                                // A retry is a new item of its own batch; the old one stays as it was.
                                model.push((q.id, q.batch_id.clone(), QueueItemStatus::Pending));
                            }
                            _ => prop_assert!(got.is_none()),
                        }
                    }
                }
                Op::Prune => {
                    b.prune_queue().unwrap();
                    model.retain(|m| {
                        matches!(m.2, QueueItemStatus::Pending | QueueItemStatus::InProgress)
                    });
                }
                Op::Clear => {
                    b.clear_queue().unwrap();
                    model.clear();
                }
            }
            let now = actual(&b);
            let mut sorted = now.clone();
            let mut want = model.clone();
            // `prepend` and a retry may order differently from the model's guess; the contents must match.
            sorted.sort_by_key(|m| m.0);
            want.sort_by_key(|m| m.0);
            prop_assert_eq!(&sorted, &want);
            let ids: std::collections::HashSet<u64> = now.iter().map(|m| m.0).collect();
            prop_assert_eq!(ids.len(), now.len(), "ids are unique");
            let snap = b.queue_snapshot().status;
            let count = |s: QueueItemStatus| now.iter().filter(|m| m.2 == s).count() as u32;
            prop_assert_eq!(snap.total, now.len() as u32);
            prop_assert_eq!(snap.pending, count(QueueItemStatus::Pending));
            prop_assert_eq!(snap.canceled, count(QueueItemStatus::Canceled));
            prop_assert_eq!(snap.in_progress, 0);
            prop_assert!(snap.is_paused);
        }
        Ok(())
    });
}
