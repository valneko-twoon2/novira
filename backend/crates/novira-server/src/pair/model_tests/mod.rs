//! A seeded model-based test of the pairing store: random operations on a virtual clock are run on `Pairing` and on a
//! small plain model, and the two are compared after every operation, together with the safety properties that must
//! hold whatever the model says (no session without an approval, a dead session never passes again, a code is used
//! once and expires, a denied request is never approved, the per-peer request count and the table sizes are bounded).
//!
//! Seed policy (as in novira-core's `prop_common`): every run starts from the same seed; `PROPTEST_SEED=<n>` explores
//! other sequences, `PROPTEST_CASES=<n>` changes the case count (default 256, at most 4096). A minimal failing
//! sequence is pinned as a plain `#[test]` with the operations written out, not kept as a regression file.
//!
//! The model writes the limits as plain numbers (not the crate's constants) so a changed limit fails here; the test
//! `the_documented_limits_are_the_ones_the_model_uses` says so first.
use super::*;
use proptest::prelude::*;
use proptest::test_runner::{Config, RngAlgorithm, TestCaseError, TestRng, TestRunner};

mod apply;
mod model;
mod ops;
mod run;

use ops::{op, Op};
use run::Run;

const DEFAULT_SEED: u64 = 0x4E6F_7669_7261_0002;
const MAX_OPS: usize = 60;

fn env_number(name: &str) -> Option<u64> {
    std::env::var(name).ok()?.trim().parse().ok()
}

fn seed() -> u64 {
    env_number("PROPTEST_SEED").unwrap_or(DEFAULT_SEED)
}

fn cases() -> u32 {
    env_number("PROPTEST_CASES").map_or(256, |n| n.clamp(1, 4096) as u32)
}

fn rng() -> TestRng {
    let mut bytes = [0u8; 32];
    for (i, chunk) in bytes.chunks_mut(8).enumerate() {
        chunk.copy_from_slice(&seed().wrapping_add(i as u64).to_le_bytes());
    }
    TestRng::from_seed(RngAlgorithm::ChaCha, &bytes)
}

fn check<S: Strategy>(strategy: S, test: impl Fn(S::Value) -> Result<(), TestCaseError>)
where
    S::Value: std::fmt::Debug,
{
    let config = Config {
        cases: cases(),
        max_shrink_iters: 4000,
        failure_persistence: None,
        ..Config::default()
    };
    let mut runner = TestRunner::new_with_rng(config, rng());
    if let Err(e) = runner.run(&strategy, test) {
        panic!("seed {} ({} cases): {e}", seed(), cases());
    }
}

fn run_ops(ops: &[Op]) -> Result<(), TestCaseError> {
    let mut run = Run::new();
    for op in ops.iter().take(MAX_OPS) {
        run.apply(op)?;
    }
    Ok(())
}

#[test]
fn the_documented_limits_are_the_ones_the_model_uses() {
    assert_eq!(CODE_TTL, Duration::from_secs(120));
    assert_eq!(PENDING_TTL, Duration::from_secs(300));
    assert_eq!(SESSION_IDLE, Duration::from_secs(1800));
    assert_eq!(SESSION_MAX, Duration::from_secs(14400));
    assert_eq!(RATE_WINDOW, Duration::from_secs(60));
    assert_eq!(
        (MAX_CODES, MAX_PENDING, MAX_SESSIONS, REQUESTS_PER_WINDOW),
        (4, 8, 16, 5)
    );
    assert_eq!(LABEL_MAX, 40);
}

#[test]
fn the_store_follows_the_model_over_random_operation_sequences() {
    check(prop::collection::vec(op(), 1..=MAX_OPS), |ops| {
        run_ops(&ops)
    });
}

fn peer_text(peer: IpAddr) -> String {
    peer.to_string()
}
