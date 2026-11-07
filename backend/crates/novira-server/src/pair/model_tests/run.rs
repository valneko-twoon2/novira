//! One run: the store, the model and what the run has seen, with the checks made after every operation.
use super::model::*;
use super::ops::*;
use super::*;
use std::collections::HashSet;

/// One run: the store, the model and what the run has seen that the oracle needs.
pub(super) struct Run {
    pub(super) p: Pairing,
    pub(super) m: Model,
    t0: Instant,
    pub(super) now: u64,
    /// Every code, poll secret and session secret ever handed out (a poll or session with the address it belongs to).
    pub(super) codes: Vec<String>,
    pub(super) polls: Vec<(IpAddr, String)>,
    pub(super) secrets: Vec<(IpAddr, String)>,
    /// Secrets of sessions that ended; they must never pass again.
    pub(super) dead: Vec<(IpAddr, String)>,
    /// Ids of requests this computer approved or denied, and ids of sessions made by `grant` (no approval: a passkey
    /// vouches for it).
    pub(super) approved: HashSet<String>,
    pub(super) granted: HashSet<String>,
    pub(super) denied: HashSet<String>,
    /// Times of requests from an address that got past the rate limit.
    pub(super) admitted: HashMap<IpAddr, Vec<u64>>,
}

pub(super) fn pick<T: Clone>(items: &[T], n: u8) -> Option<T> {
    (!items.is_empty()).then(|| items[n as usize % items.len()].clone())
}

impl Run {
    pub(super) fn new() -> Run {
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

    pub(super) fn at(&self) -> Instant {
        self.t0 + Duration::from_secs(self.now)
    }

    /// The store's waiting requests and devices as shown; the store prunes, so the model does too.
    pub(super) fn shown(&mut self) -> (Vec<Value>, Vec<Value>) {
        let v = self.p.view(self.at());
        self.m.prune(self.now);
        let list = |key: &str| v[key].as_array().cloned().unwrap_or_default();
        (list("pending"), list("devices"))
    }

    pub(super) fn code_arg(&self, w: Which) -> String {
        match w {
            Which::Known(n) => pick(&self.codes, n).unwrap_or_else(|| "0".repeat(32)),
            Which::Garbage => "f".repeat(32),
        }
    }

    pub(super) fn secret_arg(&self, w: Which, peer: IpAddr) -> (IpAddr, String) {
        match w {
            Which::Known(n) => pick(&self.secrets, n).unwrap_or((peer, "0".repeat(64))),
            Which::Garbage => (peer, "e".repeat(64)),
        }
    }

    pub(super) fn request_id(&self, n: u8, t: Target) -> String {
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

    /// After every operation: the store's own view equals the model, the tables are bounded, the rate limit holds,
    /// and no ended session passes.
    pub(super) fn finish(&mut self) -> Result<(), TestCaseError> {
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
