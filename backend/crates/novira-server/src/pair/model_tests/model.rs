//! The plain model of the pairing store, in seconds on the virtual clock.
use super::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(super) enum Decided {
    Pending,
    Approved,
    Denied,
}

pub(super) struct MCode {
    pub(super) code: String,
    pub(super) expires: u64,
}

pub(super) struct MRequest {
    pub(super) id: String,
    pub(super) poll: String,
    pub(super) peer: IpAddr,
    pub(super) label: String,
    pub(super) confirm: String,
    pub(super) created: u64,
    pub(super) decision: Decided,
}

pub(super) struct MSession {
    pub(super) id: String,
    pub(super) secret: String,
    pub(super) peer: IpAddr,
    pub(super) label: String,
    pub(super) created: u64,
    pub(super) last: u64,
    pub(super) may_enrol: bool,
    pub(super) passkey: Option<String>,
}

/// The whole expected state, in seconds on the virtual clock. Limits are written as numbers on purpose.
#[derive(Default)]
pub(super) struct Model {
    pub(super) codes: Vec<MCode>,
    pub(super) requests: Vec<MRequest>,
    pub(super) sessions: Vec<MSession>,
    pub(super) attempts: HashMap<IpAddr, (u64, u32)>,
}

impl Model {
    /// Expiry happens when an operation looks at the store, as in the store itself (`revoke` and `reset` do not look).
    pub(super) fn prune(&mut self, now: u64) {
        self.codes.retain(|c| now < c.expires);
        self.requests.retain(|r| now - r.created < 300);
        self.sessions
            .retain(|s| now - s.last < 30 * 60 && now - s.created < 4 * 60 * 60);
        self.attempts.retain(|_, (start, _)| now - *start < 60);
    }

    pub(super) fn allow(&mut self, now: u64, peer: IpAddr) -> bool {
        let (start, count) = self.attempts.entry(peer).or_insert((now, 0));
        if now - *start >= 60 {
            (*start, *count) = (now, 0);
        }
        *count += 1;
        *count <= 5
    }
}
