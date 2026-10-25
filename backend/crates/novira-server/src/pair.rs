//! Pairing a device with the home-network listener, and the sessions it then uses.
//!
//! This computer (a loopback page with the token) makes a pairing code: 128 random bits, valid for two minutes, good
//! for one request. It travels to the phone in the fragment of `https://<home>:<port>/pair#<code>` (a QR code), which a
//! browser never sends. The phone's `/pair` page posts the code with a name; that makes a pending request with a
//! six-digit confirmation number that both screens show, and a poll secret only the phone holds. This computer approves
//! or denies it; the phone, polling with its secret from the same address, then receives the session cookie. A session
//! is bound to the device's address, ends after 30 minutes without a request or 4 hours after pairing, can be revoked
//! from this computer, and is lost when the server stops or the listener closes. Only SHA-256 digests of the code, the
//! poll secret and the session secret are kept. Every function takes the time, so the tests move it without waiting.
use axum::body::Bytes;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::IpAddr;
use std::time::{Duration, Instant};

/// The phone's page; the only page the home-network listener shows without a session.
pub const PAGE_ROUTE: &str = "/pair";
/// The page's script (a file, so `script-src 'self'` needs no exception).
pub const SCRIPT_ROUTE: &str = "/pair.js";
/// The phone asks to pair: `{code, label}` in, `{poll, confirm}` out.
pub const REQUEST_ROUTE: &str = "/pair/request";
/// The phone waits: `{poll}` in, `{state}` out, and the session cookie once approved.
pub const STATUS_ROUTE: &str = "/pair/status";
/// This computer makes a pairing code: `{url, size, modules, expiresIn}`.
pub const CODE_ROUTE: &str = "/pair/code";
/// This computer reads the pending requests and the paired devices.
pub const STATE_ROUTE: &str = "/pair/state";
/// This computer allows a pending request: `{id}`.
pub const APPROVE_ROUTE: &str = "/pair/approve";
/// This computer refuses a pending request: `{id}`.
pub const DENY_ROUTE: &str = "/pair/deny";
/// This computer ends a device's session: `{id}`.
pub const REVOKE_ROUTE: &str = "/pair/revoke";

/// How long a pairing code is good for.
pub const CODE_TTL: Duration = Duration::from_secs(120);
/// How many codes are good at once (the console's, the page's); a new one beyond drops the oldest.
const MAX_CODES: usize = 4;
/// How long a request waits for this computer, and then for the phone to collect its session.
const PENDING_TTL: Duration = Duration::from_secs(300);
/// How many requests wait at once.
const MAX_PENDING: usize = 8;
/// A session ends after this long without a request.
pub const SESSION_IDLE: Duration = Duration::from_secs(30 * 60);
/// A session ends this long after pairing, whatever its use.
pub const SESSION_MAX: Duration = Duration::from_secs(4 * 60 * 60);
/// How many devices may be paired at once.
const MAX_SESSIONS: usize = 16;
/// Pairing requests one address may make per window.
const REQUESTS_PER_WINDOW: u32 = 5;
const RATE_WINDOW: Duration = Duration::from_secs(60);
/// Addresses the rate limit follows at once; beyond, requests wait until a window ends.
const MAX_TRACKED: usize = 256;
/// The longest device name, in characters.
const LABEL_MAX: usize = 40;
/// The largest body a pairing route reads.
pub const MAX_BODY: usize = 1024;

/// The name of the session cookie of the home-network listener on `port`.
pub fn session_cookie(port: u16) -> String {
    format!("novira_session_{port}")
}

/// Routes the home-network listener answers without a session.
pub fn is_public(method: &axum::http::Method, path: &str) -> bool {
    use axum::http::Method;
    match *method {
        Method::GET => matches!(path, PAGE_ROUTE | SCRIPT_ROUTE | crate::CA_ROUTE),
        Method::POST => matches!(path, REQUEST_ROUTE | STATUS_ROUTE),
        _ => false,
    }
}

/// Routes only this computer may use (a loopback peer with the token).
pub fn is_management(path: &str) -> bool {
    matches!(
        path,
        CODE_ROUTE | STATE_ROUTE | APPROVE_ROUTE | DENY_ROUTE | REVOKE_ROUTE
    )
}

type Digest = [u8; 32];

fn digest(secret: &str) -> Digest {
    let d = ring::digest::digest(&ring::digest::SHA256, secret.as_bytes());
    let mut out = [0u8; 32];
    out.copy_from_slice(d.as_ref());
    out
}

/// `bytes` random bytes from the system's generator, as lowercase hex.
fn random_hex(bytes: usize) -> String {
    use ring::rand::SecureRandom;
    let mut buffer = vec![0u8; bytes];
    ring::rand::SystemRandom::new()
        .fill(&mut buffer)
        .expect("the system's random generator works");
    buffer.iter().map(|b| format!("{b:02x}")).collect()
}

/// Six random digits.
fn confirmation() -> String {
    let n = u64::from_str_radix(&random_hex(8), 16).unwrap_or(0) % 1_000_000;
    format!("{n:06}")
}

struct Code {
    digest: Digest,
    expires: Instant,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Decision {
    Pending,
    Approved,
    Denied,
}

struct Request {
    id: String,
    poll: Digest,
    label: String,
    peer: IpAddr,
    confirm: String,
    created: Instant,
    decision: Decision,
}

struct Session {
    id: String,
    digest: Digest,
    label: String,
    peer: IpAddr,
    created: Instant,
    last: Instant,
}

impl Session {
    fn alive(&self, now: Instant) -> bool {
        now.saturating_duration_since(self.last) < SESSION_IDLE
            && now.saturating_duration_since(self.created) < SESSION_MAX
    }
}

/// Why a pairing request was refused.
#[derive(Debug, PartialEq, Eq)]
pub enum Refused {
    /// Too many requests from this address in the window.
    RateLimited,
    /// The name is empty, too long, or has control or direction characters.
    BadLabel,
    /// No good code matches (wrong, used or expired).
    BadCode,
    /// Too many requests are waiting.
    Busy,
}

/// What the phone holds after asking: the poll secret and the confirmation number.
#[derive(Debug)]
pub struct Ticket {
    pub poll: String,
    pub confirm: String,
}

/// What polling answers.
#[derive(Debug, PartialEq, Eq)]
pub enum Status {
    Pending,
    Denied,
    /// Approved: the session's secret, handed out once.
    Approved(String),
    /// No such request for this address (wrong secret, other address, expired, or already collected).
    Unknown,
}

/// The pairing codes, pending requests, sessions and the rate limit of one server.
#[derive(Default)]
pub struct Pairing {
    codes: Vec<Code>,
    requests: Vec<Request>,
    sessions: Vec<Session>,
    attempts: HashMap<IpAddr, (Instant, u32)>,
}

/// A device name as shown on this computer, or `None` when it is not one.
pub(crate) fn clean_label(label: &str) -> Option<String> {
    let label = label.trim();
    let bidi = |c: char| matches!(c, '\u{200e}' | '\u{200f}' | '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}');
    let ok = !label.is_empty()
        && label.chars().count() <= LABEL_MAX
        && !label.chars().any(|c| c.is_control() || bidi(c));
    ok.then(|| label.to_string())
}

impl Pairing {
    fn prune(&mut self, now: Instant) {
        self.codes.retain(|c| now < c.expires);
        self.requests
            .retain(|r| now.saturating_duration_since(r.created) < PENDING_TTL);
        self.sessions.retain(|s| s.alive(now));
        self.attempts
            .retain(|_, (start, _)| now.saturating_duration_since(*start) < RATE_WINDOW);
    }

    /// Whether a pairing is under way: a code that can still be used, or a request that waits for this computer.
    pub fn busy(&mut self, now: Instant) -> bool {
        self.prune(now);
        !self.codes.is_empty()
            || self
                .requests
                .iter()
                .any(|r| r.decision == Decision::Pending)
    }

    /// A new pairing code, good for `CODE_TTL` and one request.
    pub fn new_code(&mut self, now: Instant) -> String {
        self.prune(now);
        let code = random_hex(16);
        if self.codes.len() >= MAX_CODES {
            self.codes.remove(0);
        }
        self.codes.push(Code {
            digest: digest(&code),
            expires: now + CODE_TTL,
        });
        code
    }

    /// Counts a request from `peer`; false when it is over the limit.
    fn allow(&mut self, now: Instant, peer: IpAddr) -> bool {
        if !self.attempts.contains_key(&peer) && self.attempts.len() >= MAX_TRACKED {
            return false;
        }
        let (start, count) = self.attempts.entry(peer).or_insert((now, 0));
        if now.saturating_duration_since(*start) >= RATE_WINDOW {
            (*start, *count) = (now, 0);
        }
        *count += 1;
        *count <= REQUESTS_PER_WINDOW
    }

    /// A device at `peer` asks to pair with `code` under the name `label`. The code is used up when it matches.
    pub fn request(
        &mut self,
        now: Instant,
        peer: IpAddr,
        code: &str,
        label: &str,
    ) -> Result<Ticket, Refused> {
        self.prune(now);
        if !self.allow(now, peer) {
            return Err(Refused::RateLimited);
        }
        let label = clean_label(label).ok_or(Refused::BadLabel)?;
        let wanted = digest(code);
        let Some(at) = self.codes.iter().position(|c| c.digest == wanted) else {
            return Err(Refused::BadCode);
        };
        if self.requests.len() >= MAX_PENDING {
            return Err(Refused::Busy);
        }
        self.codes.remove(at);
        let poll = random_hex(32);
        let confirm = confirmation();
        self.requests.push(Request {
            id: random_hex(8),
            poll: digest(&poll),
            label,
            peer,
            confirm: confirm.clone(),
            created: now,
            decision: Decision::Pending,
        });
        Ok(Ticket { poll, confirm })
    }

    fn decide(&mut self, now: Instant, id: &str, decision: Decision) -> bool {
        self.prune(now);
        match self
            .requests
            .iter_mut()
            .find(|r| r.id == id && r.decision == Decision::Pending)
        {
            Some(request) => {
                request.decision = decision;
                true
            }
            None => false,
        }
    }

    /// This computer allows the pending request `id`; false when there is none (or it was decided).
    pub fn approve(&mut self, now: Instant, id: &str) -> bool {
        self.prune(now);
        if self.sessions.len() >= MAX_SESSIONS {
            return false;
        }
        self.decide(now, id, Decision::Approved)
    }

    /// This computer refuses the pending request `id`.
    pub fn deny(&mut self, now: Instant, id: &str) -> bool {
        self.decide(now, id, Decision::Denied)
    }

    /// The phone at `peer` asks how its request stands. An approved one becomes a session here, and its secret is
    /// handed out once; a decided one is then forgotten.
    pub fn status(&mut self, now: Instant, peer: IpAddr, poll: &str) -> Status {
        self.prune(now);
        let wanted = digest(poll);
        let Some(at) = self
            .requests
            .iter()
            .position(|r| r.poll == wanted && r.peer == peer)
        else {
            return Status::Unknown;
        };
        match self.requests[at].decision {
            Decision::Pending => Status::Pending,
            Decision::Denied => {
                self.requests.remove(at);
                Status::Denied
            }
            Decision::Approved => {
                let request = self.requests.remove(at);
                // Two approvals collected at once cannot pass the cap either.
                if self.sessions.len() >= MAX_SESSIONS {
                    return Status::Denied;
                }
                let secret = random_hex(32);
                // The same phone pairing again replaces its earlier session instead of listing it twice.
                self.sessions
                    .retain(|s| !(s.peer == peer && s.label == request.label));
                self.sessions.push(Session {
                    id: request.id,
                    digest: digest(&secret),
                    label: request.label,
                    peer,
                    created: now,
                    last: now,
                });
                Status::Approved(secret)
            }
        }
    }

    /// The session whose secret is `secret`, when it is alive and used from the address it was made for; the use
    /// keeps it alive. Its digest comes back (for a socket to check it again).
    pub fn session(&mut self, now: Instant, peer: IpAddr, secret: &str) -> Option<[u8; 32]> {
        let wanted = digest(secret);
        self.touch(now, peer, &wanted).then_some(wanted)
    }

    /// Whether the session with digest `wanted` is alive for `peer`; the check counts as a use.
    pub fn touch(&mut self, now: Instant, peer: IpAddr, wanted: &[u8; 32]) -> bool {
        self.prune(now);
        match self
            .sessions
            .iter_mut()
            .find(|s| &s.digest == wanted && s.peer == peer)
        {
            Some(session) => {
                session.last = now;
                true
            }
            None => false,
        }
    }

    /// Ends the session `id`; false when there is none.
    pub fn revoke(&mut self, id: &str) -> bool {
        let before = self.sessions.len();
        self.sessions.retain(|s| s.id != id);
        self.sessions.len() != before
    }

    /// Ends every session and forgets every code and request (the listener closed).
    pub fn reset(&mut self) {
        self.codes.clear();
        self.requests.clear();
        self.sessions.clear();
    }

    /// What this computer shows: the waiting requests and the paired devices.
    pub fn view(&mut self, now: Instant) -> Value {
        self.prune(now);
        let pending: Vec<Value> = self
            .requests
            .iter()
            .filter(|r| r.decision == Decision::Pending)
            .map(|r| {
                json!({
                    "id": r.id,
                    "label": r.label,
                    "peer": r.peer.to_string(),
                    "confirm": r.confirm,
                    "waitingSecs": now.saturating_duration_since(r.created).as_secs(),
                })
            })
            .collect();
        let devices: Vec<Value> = self
            .sessions
            .iter()
            .map(|s| {
                json!({
                    "id": s.id,
                    "label": s.label,
                    "peer": s.peer.to_string(),
                    "pairedSecs": now.saturating_duration_since(s.created).as_secs(),
                    "idleSecs": now.saturating_duration_since(s.last).as_secs(),
                })
            })
            .collect();
        json!({ "codes": self.codes.len(), "pending": pending, "devices": devices })
    }
}

/// The JSON object of a pairing route's body: `application/json`, at most `MAX_BODY` bytes.
pub fn read_body(
    headers: &HeaderMap,
    body: &Bytes,
) -> Result<serde_json::Map<String, Value>, Response> {
    let json_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v == "application/json" || v.starts_with("application/json;"));
    if !json_type {
        return Err(crate::failure(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "bad_arguments",
            "the body must be application/json",
        ));
    }
    if body.len() > MAX_BODY {
        return Err(crate::failure(
            StatusCode::PAYLOAD_TOO_LARGE,
            "bad_arguments",
            "the body is too large",
        ));
    }
    match serde_json::from_slice::<Value>(body) {
        Ok(Value::Object(map)) => Ok(map),
        _ => Err(crate::failure(
            StatusCode::BAD_REQUEST,
            "bad_arguments",
            "the body must be a JSON object",
        )),
    }
}

/// The string `name` of a body, or a 400.
pub fn field<'a>(
    body: &'a serde_json::Map<String, Value>,
    name: &str,
) -> Result<&'a str, Response> {
    body.get(name).and_then(Value::as_str).ok_or_else(|| {
        crate::failure(
            StatusCode::BAD_REQUEST,
            "bad_arguments",
            &format!("the body needs {name}"),
        )
    })
}

/// The strings of the phone's page, by language (ja and en; a test keeps their keys equal).
const STRINGS: &str = include_str!("pair/strings.json");

/// `GET /pair`: the phone's page, a small static page apart from the app.
pub async fn page() -> Response {
    (
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        include_str!("pair/page.html"),
    )
        .into_response()
}

/// The page's script with its strings put in.
pub fn script_source() -> String {
    include_str!("pair/page.js").replacen("__STRINGS__", STRINGS.trim(), 1)
}

/// `GET /pair.js`: the page's script.
pub fn script() -> Response {
    let source = script_source();
    (
        [
            (header::CONTENT_TYPE, "text/javascript; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        source,
    )
        .into_response()
}

/// The `Set-Cookie` value that gives the phone its session on the listener at `port`.
pub fn session_set_cookie(port: u16, secret: &str) -> Option<HeaderValue> {
    HeaderValue::from_str(&format!(
        "{}={secret}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age={}",
        session_cookie(port),
        SESSION_MAX.as_secs()
    ))
    .ok()
}

#[cfg(test)]
mod tests;
