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
use std::collections::HashSet;
use std::net::Ipv4Addr;

const DEFAULT_SEED: u64 = 0x4E6F_7669_7261_0002;
const MAX_OPS: usize = 60;
const PEERS: u8 = 3;

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

fn peer_addr(k: u8) -> IpAddr {
    IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10 + k))
}

/// Device names and what a store must make of them (written out, not computed with `clean_label`).
const LABELS: &[(&str, Option<&str>)] = &[
    ("phone", Some("phone")),
    ("tablet", Some("tablet")),
    ("  padded  ", Some("padded")),
    ("", None),
    ("   ", None),
    ("a\nb", None),
    ("\u{202e}x", None),
    ("日本語の端末", Some("日本語の端末")),
];

fn label_text(i: u8) -> String {
    match i as usize % (LABELS.len() + 2) {
        n if n < LABELS.len() => LABELS[n].0.to_string(),
        n if n == LABELS.len() => "x".repeat(40),
        _ => "x".repeat(41),
    }
}

fn label_expected(i: u8) -> Option<String> {
    match i as usize % (LABELS.len() + 2) {
        n if n < LABELS.len() => LABELS[n].1.map(str::to_string),
        n if n == LABELS.len() => Some("x".repeat(40)),
        _ => None,
    }
}

#[derive(Clone, Copy, Debug)]
enum Which {
    /// The n-th one ever made (modulo how many there are; live, used, expired or dead alike).
    Known(u8),
    /// A value nobody was given.
    Garbage,
}

#[derive(Clone, Copy, Debug)]
enum Target {
    Waiting,
    Decided,
    Bogus,
}

#[derive(Clone, Debug)]
enum Op {
    Advance(u64),
    NewCode,
    Request {
        peer: u8,
        code: Which,
        label: u8,
    },
    Status {
        peer: u8,
        poll: Which,
    },
    /// The n-th waiting request, the n-th already decided one, or a made-up id.
    Approve {
        n: u8,
        target: Target,
    },
    Deny {
        n: u8,
        target: Target,
    },
    Grant {
        peer: u8,
        passkey: u8,
        label: u8,
    },
    Session {
        peer: u8,
        secret: Which,
    },
    Touch {
        peer: u8,
        secret: Which,
    },
    Enrolling {
        peer: u8,
        secret: Which,
    },
    Enrolled {
        peer: u8,
        secret: Which,
        passkey: u8,
    },
    Revoke {
        n: u8,
        bogus: bool,
    },
    RevokePasskey(u8),
    Reset,
    Busy,
    View,
}

fn which() -> impl Strategy<Value = Which> {
    prop_oneof![5 => any::<u8>().prop_map(Which::Known), 1 => Just(Which::Garbage)]
}

fn target() -> impl Strategy<Value = Target> {
    prop_oneof![4 => Just(Target::Waiting), 2 => Just(Target::Decided), 1 => Just(Target::Bogus)]
}

fn op() -> impl Strategy<Value = Op> {
    let peer = 0..PEERS;
    // The edges of the 120 s code life, 60 s rate window, 300 s request life, 30 min idle and 4 h session limits.
    let secs = prop::sample::select(vec![
        0u64, 0, 1, 5, 59, 60, 61, 119, 120, 121, 299, 300, 301, 1799, 1800, 1801, 14399, 14400,
        14401,
    ]);
    prop_oneof![
        4 => secs.prop_map(Op::Advance),
        3 => Just(Op::NewCode),
        8 => (peer.clone(), which(), any::<u8>()).prop_map(|(peer, code, label)| Op::Request { peer, code, label }),
        6 => (peer.clone(), which()).prop_map(|(peer, poll)| Op::Status { peer, poll }),
        4 => (any::<u8>(), target()).prop_map(|(n, target)| Op::Approve { n, target }),
        2 => (any::<u8>(), target()).prop_map(|(n, target)| Op::Deny { n, target }),
        2 => (peer.clone(), 0u8..2, any::<u8>()).prop_map(|(peer, passkey, label)| Op::Grant { peer, passkey, label }),
        4 => (peer.clone(), which()).prop_map(|(peer, secret)| Op::Session { peer, secret }),
        2 => (peer.clone(), which()).prop_map(|(peer, secret)| Op::Touch { peer, secret }),
        2 => (peer.clone(), which()).prop_map(|(peer, secret)| Op::Enrolling { peer, secret }),
        2 => (peer, which(), 0u8..2).prop_map(|(peer, secret, passkey)| Op::Enrolled { peer, secret, passkey }),
        2 => (any::<u8>(), any::<bool>()).prop_map(|(n, bogus)| Op::Revoke { n, bogus }),
        1 => (0u8..2).prop_map(Op::RevokePasskey),
        1 => Just(Op::Reset),
        1 => Just(Op::Busy),
        1 => Just(Op::View),
    ]
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Decided {
    Pending,
    Approved,
    Denied,
}

struct MCode {
    code: String,
    expires: u64,
}

struct MRequest {
    id: String,
    poll: String,
    peer: IpAddr,
    label: String,
    confirm: String,
    created: u64,
    decision: Decided,
}

struct MSession {
    id: String,
    secret: String,
    peer: IpAddr,
    label: String,
    created: u64,
    last: u64,
    may_enrol: bool,
    passkey: Option<String>,
}

/// The whole expected state, in seconds on the virtual clock. Limits are written as numbers on purpose.
#[derive(Default)]
struct Model {
    codes: Vec<MCode>,
    requests: Vec<MRequest>,
    sessions: Vec<MSession>,
    attempts: HashMap<IpAddr, (u64, u32)>,
}

impl Model {
    /// Expiry happens when an operation looks at the store, as in the store itself (`revoke` and `reset` do not look).
    fn prune(&mut self, now: u64) {
        self.codes.retain(|c| now < c.expires);
        self.requests.retain(|r| now - r.created < 300);
        self.sessions
            .retain(|s| now - s.last < 30 * 60 && now - s.created < 4 * 60 * 60);
        self.attempts.retain(|_, (start, _)| now - *start < 60);
    }

    fn allow(&mut self, now: u64, peer: IpAddr) -> bool {
        let (start, count) = self.attempts.entry(peer).or_insert((now, 0));
        if now - *start >= 60 {
            (*start, *count) = (now, 0);
        }
        *count += 1;
        *count <= 5
    }
}

/// One run: the store, the model and what the run has seen that the oracle needs.
struct Run {
    p: Pairing,
    m: Model,
    t0: Instant,
    now: u64,
    /// Every code, poll secret and session secret ever handed out (a poll or session with the address it belongs to).
    codes: Vec<String>,
    polls: Vec<(IpAddr, String)>,
    secrets: Vec<(IpAddr, String)>,
    /// Secrets of sessions that ended; they must never pass again.
    dead: Vec<(IpAddr, String)>,
    /// Ids of requests this computer approved or denied, and ids of sessions made by `grant` (no approval: a passkey
    /// vouches for it).
    approved: HashSet<String>,
    granted: HashSet<String>,
    denied: HashSet<String>,
    /// Times of requests from an address that got past the rate limit.
    admitted: HashMap<IpAddr, Vec<u64>>,
}

fn pick<T: Clone>(items: &[T], n: u8) -> Option<T> {
    (!items.is_empty()).then(|| items[n as usize % items.len()].clone())
}

impl Run {
    fn new() -> Run {
        Run {
            p: Pairing::default(),
            m: Model::default(),
            t0: Instant::now(),
            now: 0,
            codes: vec![],
            polls: vec![],
            secrets: vec![],
            dead: vec![],
            approved: HashSet::new(),
            granted: HashSet::new(),
            denied: HashSet::new(),
            admitted: HashMap::new(),
        }
    }

    fn at(&self) -> Instant {
        self.t0 + Duration::from_secs(self.now)
    }

    /// The store's waiting requests and devices as shown; the store prunes, so the model does too.
    fn shown(&mut self) -> (Vec<Value>, Vec<Value>) {
        let v = self.p.view(self.at());
        self.m.prune(self.now);
        let list = |key: &str| v[key].as_array().cloned().unwrap_or_default();
        (list("pending"), list("devices"))
    }

    fn code_arg(&self, w: Which) -> String {
        match w {
            Which::Known(n) => pick(&self.codes, n).unwrap_or_else(|| "0".repeat(32)),
            Which::Garbage => "f".repeat(32),
        }
    }

    fn secret_arg(&self, w: Which, peer: IpAddr) -> (IpAddr, String) {
        match w {
            Which::Known(n) => pick(&self.secrets, n).unwrap_or((peer, "0".repeat(64))),
            Which::Garbage => (peer, "e".repeat(64)),
        }
    }

    fn request_id(&self, n: u8, t: Target) -> String {
        let of = |want_pending: bool| -> Vec<String> {
            self.m
                .requests
                .iter()
                .filter(|r| (r.decision == Decided::Pending) == want_pending)
                .map(|r| r.id.clone())
                .collect()
        };
        let found = match t {
            Target::Waiting => pick(&of(true), n),
            Target::Decided => pick(&of(false), n),
            Target::Bogus => None,
        };
        found.unwrap_or_else(|| "0123456789abcdef".to_string())
    }

    fn apply(&mut self, op: &Op) -> Result<(), TestCaseError> {
        let now = self.at();
        match *op {
            Op::Advance(secs) => self.now += secs,
            Op::NewCode => {
                let code = self.p.new_code(now);
                prop_assert_eq!(code.len(), 32);
                prop_assert!(!self.codes.contains(&code), "a code repeated");
                self.m.prune(self.now);
                if self.m.codes.len() >= 4 {
                    self.m.codes.remove(0);
                }
                self.m.codes.push(MCode {
                    code: code.clone(),
                    expires: self.now + 120,
                });
                self.codes.push(code);
            }
            Op::Request { peer, code, label } => {
                let peer = peer_addr(peer);
                let code = self.code_arg(code);
                let got = self.p.request(now, peer, &code, &label_text(label));
                self.m.prune(self.now);
                let expected = if !self.m.allow(self.now, peer) {
                    Err(Refused::RateLimited)
                } else {
                    self.admitted.entry(peer).or_default().push(self.now);
                    match label_expected(label) {
                        None => Err(Refused::BadLabel),
                        Some(clean) => match self.m.codes.iter().position(|c| c.code == code) {
                            None => Err(Refused::BadCode),
                            Some(_) if self.m.requests.len() >= 8 => Err(Refused::Busy),
                            Some(at) => {
                                self.m.codes.remove(at);
                                Ok(clean)
                            }
                        },
                    }
                };
                match (got, expected) {
                    (Err(g), Err(e)) => prop_assert_eq!(g, e),
                    (Ok(ticket), Ok(clean)) => {
                        let (pending, _) = self.shown();
                        let last = pending.last().cloned().unwrap_or(Value::Null);
                        prop_assert_eq!(last["confirm"].as_str(), Some(ticket.confirm.as_str()));
                        let id = last["id"].as_str().unwrap_or_default().to_string();
                        self.polls.push((peer, ticket.poll.clone()));
                        self.m.requests.push(MRequest {
                            id,
                            poll: ticket.poll,
                            peer,
                            label: clean,
                            confirm: ticket.confirm,
                            created: self.now,
                            decision: Decided::Pending,
                        });
                    }
                    (g, e) => prop_assert!(false, "request: store {:?}, model {:?}", g, e),
                }
            }
            Op::Status { peer, poll } => {
                let peer = peer_addr(peer);
                let (_, poll) = match poll {
                    Which::Known(n) => pick(&self.polls, n).unwrap_or((peer, "1".repeat(64))),
                    Which::Garbage => (peer, "d".repeat(64)),
                };
                let got = self.p.status(now, peer, &poll);
                self.m.prune(self.now);
                let at = self
                    .m
                    .requests
                    .iter()
                    .position(|r| r.poll == poll && r.peer == peer);
                let Some(at) = at else {
                    prop_assert_eq!(got, Status::Unknown);
                    return self.finish();
                };
                match self.m.requests[at].decision {
                    Decided::Pending => prop_assert_eq!(got, Status::Pending),
                    Decided::Denied => {
                        self.m.requests.remove(at);
                        prop_assert_eq!(got, Status::Denied);
                    }
                    Decided::Approved => {
                        let request = self.m.requests.remove(at);
                        if self.m.sessions.len() >= 16 {
                            prop_assert_eq!(got, Status::Denied);
                        } else {
                            let Status::Approved(secret) = got else {
                                return Err(TestCaseError::fail(format!(
                                    "approved request gave {got:?}"
                                )));
                            };
                            prop_assert!(
                                self.approved.contains(&request.id),
                                "a session without an approval"
                            );
                            prop_assert!(
                                !self.denied.contains(&request.id),
                                "a denied request became a session"
                            );
                            self.m
                                .sessions
                                .retain(|s| !(s.peer == peer && s.label == request.label));
                            self.secrets.push((peer, secret.clone()));
                            self.m.sessions.push(MSession {
                                id: request.id,
                                secret,
                                peer,
                                label: request.label,
                                created: self.now,
                                last: self.now,
                                may_enrol: true,
                                passkey: None,
                            });
                        }
                    }
                }
            }
            Op::Approve { n, target } | Op::Deny { n, target } => {
                let approving = matches!(op, Op::Approve { .. });
                let id = self.request_id(n, target);
                let got = if approving {
                    self.p.approve(now, &id)
                } else {
                    self.p.deny(now, &id)
                };
                self.m.prune(self.now);
                let waiting = self
                    .m
                    .requests
                    .iter()
                    .position(|r| r.id == id && r.decision == Decided::Pending);
                let capped = approving && self.m.sessions.len() >= 16;
                prop_assert_eq!(got, waiting.is_some() && !capped);
                if let (Some(i), false) = (waiting, capped) {
                    if approving {
                        self.m.requests[i].decision = Decided::Approved;
                        self.approved.insert(id);
                    } else {
                        self.m.requests[i].decision = Decided::Denied;
                        self.denied.insert(id);
                    }
                }
            }
            Op::Grant {
                peer,
                passkey,
                label,
            } => {
                let peer = peer_addr(peer);
                let passkey = format!("key{passkey}");
                let name = label_text(label);
                let got = self.p.grant(now, peer, &name, &passkey);
                self.m.prune(self.now);
                self.m.sessions.retain(|s| {
                    !(s.peer == peer && s.passkey.as_deref() == Some(passkey.as_str()))
                });
                if self.m.sessions.len() >= 16 {
                    prop_assert_eq!(got, None);
                } else {
                    let Some(secret) = got else {
                        return Err(TestCaseError::fail(
                            "grant refused below the cap".to_string(),
                        ));
                    };
                    let (_, devices) = self.shown();
                    let id = devices
                        .last()
                        .and_then(|d| d["id"].as_str())
                        .unwrap_or_default()
                        .to_string();
                    self.granted.insert(id.clone());
                    self.secrets.push((peer, secret.clone()));
                    self.m.sessions.push(MSession {
                        id,
                        secret,
                        peer,
                        label: name,
                        created: self.now,
                        last: self.now,
                        may_enrol: false,
                        passkey: Some(passkey),
                    });
                }
            }
            Op::Session { peer, secret } | Op::Touch { peer, secret } => {
                let peer = peer_addr(peer);
                // A known secret is tried from its own address, or from the one named when the operation is `Session`.
                let (own, secret) = self.secret_arg(secret, peer);
                let touching = matches!(op, Op::Touch { .. });
                let from = if !touching && peer != own { peer } else { own };
                let got = if touching {
                    self.p.touch(now, from, &digest(&secret))
                } else {
                    self.p.session(now, from, &secret).is_some()
                };
                self.m.prune(self.now);
                let found = self
                    .m
                    .sessions
                    .iter_mut()
                    .find(|s| s.secret == secret && s.peer == from);
                prop_assert_eq!(got, found.is_some());
                if let Some(s) = found {
                    // Independent of the model's own pruning: a session passes only while it is young and in use.
                    prop_assert!(self.now - s.last < 1800, "an idle session passed");
                    prop_assert!(self.now - s.created < 14400, "an old session passed");
                    s.last = self.now;
                }
            }
            Op::Enrolling { peer, secret } | Op::Enrolled { peer, secret, .. } => {
                let peer = peer_addr(peer);
                let (own, secret) = self.secret_arg(secret, peer);
                let from = if self.now.is_multiple_of(2) {
                    own
                } else {
                    peer
                };
                let wanted = digest(&secret);
                if let Op::Enrolled { passkey, .. } = *op {
                    let passkey = format!("key{passkey}");
                    let got = self.p.enrolled(now, from, &wanted, &passkey);
                    self.m.prune(self.now);
                    let found = self
                        .m
                        .sessions
                        .iter_mut()
                        .find(|s| s.secret == secret && s.peer == from && s.may_enrol);
                    prop_assert_eq!(got, found.is_some());
                    if let Some(s) = found {
                        s.may_enrol = false;
                        s.passkey = Some(passkey);
                    }
                } else {
                    let got = self.p.enrolling(now, from, &wanted);
                    self.m.prune(self.now);
                    let found = self
                        .m
                        .sessions
                        .iter()
                        .find(|s| s.secret == secret && s.peer == from && s.may_enrol);
                    prop_assert_eq!(got, found.map(|s| s.label.clone()));
                }
            }
            Op::Revoke { n, bogus } => {
                // The ids come from the model: the store's own view would prune first.
                let ids: Vec<String> = self.m.sessions.iter().map(|s| s.id.clone()).collect();
                let id = match (bogus, pick(&ids, n)) {
                    (false, Some(id)) => id,
                    _ => "00000000deadbeef".to_string(),
                };
                let got = self.p.revoke(&id);
                let before = self.m.sessions.len();
                self.m.sessions.retain(|s| s.id != id);
                prop_assert_eq!(got, self.m.sessions.len() != before);
            }
            Op::RevokePasskey(k) => {
                let passkey = format!("key{k}");
                let got = self.p.revoke_passkey(&passkey);
                let before = self.m.sessions.len();
                self.m
                    .sessions
                    .retain(|s| s.passkey.as_deref() != Some(passkey.as_str()));
                prop_assert_eq!(got, self.m.sessions.len() != before);
            }
            Op::Reset => {
                self.p.reset();
                self.m.codes.clear();
                self.m.requests.clear();
                self.m.sessions.clear();
            }
            Op::Busy => {
                let got = self.p.busy(now);
                self.m.prune(self.now);
                let expected = !self.m.codes.is_empty()
                    || self
                        .m
                        .requests
                        .iter()
                        .any(|r| r.decision == Decided::Pending);
                prop_assert_eq!(got, expected);
            }
            Op::View => {
                self.shown();
            }
        }
        self.finish()
    }

    /// After every operation: the store's own view equals the model, the tables are bounded, the rate limit holds,
    /// and no ended session passes.
    fn finish(&mut self) -> Result<(), TestCaseError> {
        // Sessions that left the model are dead for good (expired, revoked, replaced or reset).
        for (peer, secret) in self.secrets.clone() {
            let alive = self.m.sessions.iter().any(|s| s.secret == secret);
            if !alive && !self.dead.iter().any(|(_, d)| *d == secret) {
                self.dead.push((peer, secret));
            }
        }
        let now = self.at();
        for (peer, secret) in self.dead.clone() {
            prop_assert!(
                self.p.session(now, peer, &secret).is_none(),
                "an ended session passed again"
            );
            prop_assert!(
                !self.p.touch(now, peer, &digest(&secret)),
                "an ended session passed touch"
            );
            prop_assert!(
                self.p.enrolling(now, peer, &digest(&secret)).is_none(),
                "an ended session may enrol"
            );
        }
        self.m.prune(self.now);

        let v = self.p.view(now);
        prop_assert_eq!(v["codes"].as_u64(), Some(self.m.codes.len() as u64));
        let waiting: Vec<&MRequest> = self
            .m
            .requests
            .iter()
            .filter(|r| r.decision == Decided::Pending)
            .collect();
        let pending = v["pending"].as_array().cloned().unwrap_or_default();
        prop_assert_eq!(pending.len(), waiting.len());
        for (shown, r) in pending.iter().zip(&waiting) {
            prop_assert_eq!(shown["id"].as_str(), Some(r.id.as_str()));
            prop_assert_eq!(shown["label"].as_str(), Some(r.label.as_str()));
            prop_assert_eq!(shown["peer"].as_str().unwrap_or(""), peer_text(r.peer));
            prop_assert_eq!(shown["confirm"].as_str(), Some(r.confirm.as_str()));
            prop_assert_eq!(shown["waitingSecs"].as_u64(), Some(self.now - r.created));
        }
        let devices = v["devices"].as_array().cloned().unwrap_or_default();
        prop_assert_eq!(devices.len(), self.m.sessions.len());
        let mut ids = HashSet::new();
        for (shown, s) in devices.iter().zip(&self.m.sessions) {
            prop_assert_eq!(shown["id"].as_str(), Some(s.id.as_str()));
            prop_assert_eq!(shown["label"].as_str(), Some(s.label.as_str()));
            prop_assert_eq!(shown["peer"].as_str().unwrap_or(""), peer_text(s.peer));
            prop_assert_eq!(shown["pairedSecs"].as_u64(), Some(self.now - s.created));
            prop_assert_eq!(shown["idleSecs"].as_u64(), Some(self.now - s.last));
            prop_assert!(ids.insert(s.id.clone()), "two sessions share an id");
            prop_assert!(
                self.approved.contains(&s.id) || self.granted.contains(&s.id),
                "a session without an approval or a grant"
            );
            prop_assert!(
                !self.denied.contains(&s.id),
                "a denied request has a session"
            );
        }
        prop_assert!(
            self.m.codes.len() <= 4 && self.m.requests.len() <= 8 && self.m.sessions.len() <= 16
        );
        // At most 5 requests per address pass the limit in one window, so at most 10 in any 60 s (two windows).
        for times in self.admitted.values() {
            for &t in times {
                let inside = times.iter().filter(|&&u| u >= t && u < t + 60).count();
                prop_assert!(
                    inside <= 10,
                    "{} requests of one address passed the limit within 60 s",
                    inside
                );
            }
        }
        Ok(())
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
