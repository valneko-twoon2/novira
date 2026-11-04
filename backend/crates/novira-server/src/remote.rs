//! The remote listener: this computer's own phones away from home, over Tailscale.
//!
//! When this computer's owner turns it on, a third listener opens on this computer's tailnet address, with the
//! certificate Tailscale makes for its MagicDNS name (`tailnet.rs`), and answers only tailnet addresses that name it so.
//! A phone gets in only with a passkey (`passkey.rs`): it makes one once, after pairing on this listener the way a phone
//! pairs at home (a code shown here, a number compared, this computer's approval), and then signs in with it from
//! anywhere on the tailnet, with its face, finger or code, into a session bound to its tailnet address (the pairing's
//! sessions, `pair.rs`). What a signed-in phone may run is what a phone at home may (`LOOPBACK_ONLY`). The passkeys and a
//! log of enrolments and sign-ins are kept in the data folder (`store.rs`), so the listener opens again at every start
//! while it is on; it turns itself off after two weeks unused. The `/remote/*` management routes are this computer's
//! only, like the pairing's.
use super::*;
use chrono::Utc;
use ring::rand::SecureRandom as _;
use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

pub(crate) mod passkey;
pub(crate) mod store;
pub(crate) mod tailnet;
use store::{Happened, Store};
pub use tailnet::{Certified, Problem, Source, Tailnet};

/// The phone's page: enrolment (with a code in the fragment) or signing in.
pub const PAGE_ROUTE: &str = "/remote";
pub const SCRIPT_ROUTE: &str = "/remote.js";
/// Signing in: a challenge, then the passkey's answer (which gives the session).
pub const SIGN_IN_BEGIN_ROUTE: &str = "/remote/sign-in/begin";
pub const SIGN_IN_FINISH_ROUTE: &str = "/remote/sign-in/finish";
/// Making a passkey, with the session of an approved pairing: a challenge, then the new passkey.
pub const ENROL_BEGIN_ROUTE: &str = "/remote/enrol/begin";
pub const ENROL_FINISH_ROUTE: &str = "/remote/enrol/finish";
/// This computer's management.
pub const STATE_ROUTE: &str = "/remote/state";
pub const ENABLE_ROUTE: &str = "/remote/enable";
pub const DISABLE_ROUTE: &str = "/remote/disable";
pub const CODE_ROUTE: &str = "/remote/code";
pub const APPROVE_ROUTE: &str = "/remote/approve";
pub const DENY_ROUTE: &str = "/remote/deny";
pub const REVOKE_ROUTE: &str = "/remote/revoke";
pub const FORGET_ROUTE: &str = "/remote/forget";

/// A certificate older than this is asked for again (Tailscale renews it well before its 90 days end).
const CERT_REFRESH: Duration = Duration::from_secs(24 * 60 * 60);
/// Where the port of the last remote listener is kept (a phone's saved page state is per origin, port included).
const PORT_FILE: &str = "server-remote-port";
/// How long a challenge is good for, and how many may wait at once.
const CHALLENGE_TTL: Duration = Duration::from_secs(120);
const MAX_CHALLENGES: usize = 32;
/// Challenges one address may ask for per window.
const CEREMONIES_PER_WINDOW: u32 = 10;
const RATE_WINDOW: Duration = Duration::from_secs(60);
const MAX_TRACKED: usize = 256;
/// The largest body of a passkey route (a new passkey's client data, authenticator data and key, in base64url).
const MAX_BODY: usize = 4096;
/// How long the phone's browser waits for the passkey, in milliseconds.
const CEREMONY_TIMEOUT_MS: u64 = 120_000;

/// Whether `path` is one of this computer's `/remote/*` routes.
pub fn is_management(path: &str) -> bool {
    matches!(
        path,
        STATE_ROUTE
            | ENABLE_ROUTE
            | DISABLE_ROUTE
            | CODE_ROUTE
            | APPROVE_ROUTE
            | DENY_ROUTE
            | REVOKE_ROUTE
            | FORGET_ROUTE
    )
}

/// Routes the remote listener answers without a session: its page, pairing for enrolment, and signing in.
pub fn is_public(method: &Method, path: &str) -> bool {
    match *method {
        Method::GET => matches!(path, PAGE_ROUTE | SCRIPT_ROUTE),
        Method::POST => matches!(
            path,
            pair::REQUEST_ROUTE | pair::STATUS_ROUTE | SIGN_IN_BEGIN_ROUTE | SIGN_IN_FINISH_ROUTE
        ),
        _ => false,
    }
}

/// What turning the remote listener on needs: the data folder (its passkeys and log) and how to reach Tailscale.
pub struct Control {
    data_dir: PathBuf,
    source: Source,
    store: Mutex<Store>,
    /// Why it is not open although it is on, from the last attempt.
    problem: Mutex<Option<Problem>>,
    /// One look at a time (the half-minute look and a press on this computer), so a look that read "off" cannot close
    /// what a press opened meanwhile.
    looking: tokio::sync::Mutex<()>,
}

impl Control {
    pub fn new(data_dir: PathBuf, source: Source) -> Control {
        let store = Mutex::new(Store::load(&data_dir));
        Control {
            data_dir,
            source,
            store,
            problem: Mutex::new(None),
            looking: tokio::sync::Mutex::new(()),
        }
    }

    fn store(&self) -> std::sync::MutexGuard<'_, Store> {
        self.store.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn set_problem(&self, problem: Option<Problem>) {
        *self.problem.lock().unwrap_or_else(|e| e.into_inner()) = problem;
    }

    fn remembered_port(&self) -> Option<u16> {
        let port: u16 = std::fs::read_to_string(self.data_dir.join(PORT_FILE))
            .ok()?
            .trim()
            .parse()
            .ok()?;
        (port != 0).then_some(port)
    }

    fn remember_port(&self, port: u16) {
        let _ = std::fs::write(self.data_dir.join(PORT_FILE), port.to_string());
    }
}

/// The certificate the listener shows, swapped in place when Tailscale gives a newer one.
#[derive(Debug)]
struct CertSlot(std::sync::RwLock<Arc<CertifiedKey>>);

impl ResolvesServerCert for CertSlot {
    fn resolve(&self, _hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        Some(self.0.read().unwrap_or_else(|e| e.into_inner()).clone())
    }
}

fn certified_key(certified: Certified) -> Result<Arc<CertifiedKey>, Problem> {
    let provider = rustls::crypto::ring::default_provider();
    CertifiedKey::from_der(certified.chain, certified.key, &provider)
        .map(Arc::new)
        .map_err(|e| Problem::Failed(format!("the certificate cannot be used: {e}")))
}

/// TLS 1.2 and 1.3 with the ring provider, HTTP/1.1 only, no client certificates, the certificate from `slot`.
fn server_config(slot: Arc<CertSlot>) -> Result<Arc<rustls::ServerConfig>, Problem> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let mut config = rustls::ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|e| Problem::Failed(e.to_string()))?
        .with_no_client_auth()
        .with_cert_resolver(slot);
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Ok(Arc::new(config))
}

/// The open remote listener.
pub(crate) struct Open {
    tailnet: Tailnet,
    addr: SocketAddr,
    closed: watch::Sender<bool>,
    accept: Accepting,
    cert: Arc<CertSlot>,
    fetched: Instant,
}

/// What a route needs of the open remote listener.
pub(crate) struct View {
    pub name: String,
    pub address: Ipv4Addr,
    pub port: u16,
    pub closed: watch::Receiver<bool>,
}

impl View {
    fn origin(&self) -> String {
        format!("https://{}:{}", self.name, self.port)
    }
}

/// What a challenge was made for.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Purpose {
    SignIn,
    /// Making a passkey, for the session with this digest.
    Enrol([u8; 32]),
}

struct Challenge {
    bytes: [u8; 32],
    peer: IpAddr,
    purpose: Purpose,
    expires: Instant,
}

/// The challenges waiting for a passkey's answer, and how many each address asked for.
#[derive(Default)]
pub(crate) struct Ceremonies {
    waiting: Vec<Challenge>,
    attempts: HashMap<IpAddr, (Instant, u32)>,
}

impl Ceremonies {
    fn prune(&mut self, now: Instant) {
        self.waiting.retain(|c| now < c.expires);
        self.attempts
            .retain(|_, (start, _)| now.saturating_duration_since(*start) < RATE_WINDOW);
    }

    /// A new challenge for `peer`, or `None` when it asked too often (or too many wait).
    fn begin(&mut self, now: Instant, peer: IpAddr, purpose: Purpose) -> Option<[u8; 32]> {
        self.prune(now);
        if !self.attempts.contains_key(&peer) && self.attempts.len() >= MAX_TRACKED {
            return None;
        }
        let (start, count) = self.attempts.entry(peer).or_insert((now, 0));
        if now.saturating_duration_since(*start) >= RATE_WINDOW {
            (*start, *count) = (now, 0);
        }
        *count += 1;
        if *count > CEREMONIES_PER_WINDOW {
            return None;
        }
        if self.waiting.len() >= MAX_CHALLENGES {
            self.waiting.remove(0);
        }
        let mut bytes = [0u8; 32];
        ring::rand::SystemRandom::new().fill(&mut bytes).ok()?;
        self.waiting.push(Challenge {
            bytes,
            peer,
            purpose,
            expires: now + CHALLENGE_TTL,
        });
        Some(bytes)
    }

    /// Uses up the challenge `bytes` that `peer` was given for `purpose`; whether there was one.
    fn take(&mut self, now: Instant, peer: IpAddr, bytes: &[u8], purpose: Purpose) -> bool {
        self.prune(now);
        match self.waiting.iter().position(|c| {
            c.peer == peer && c.purpose == purpose && crate::same_secret_bytes(&c.bytes, bytes)
        }) {
            Some(at) => {
                self.waiting.remove(at);
                true
            }
            None => false,
        }
    }

    fn reset(&mut self) {
        self.waiting.clear();
    }
}

impl AppState {
    pub(crate) fn remote_control(&self) -> Option<Arc<Control>> {
        self.remote_control
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    pub(crate) fn remote_view(&self) -> Option<View> {
        let open = self.remote.lock().unwrap_or_else(|e| e.into_inner());
        open.as_ref().map(|o| View {
            name: o.tailnet.name.clone(),
            address: o.tailnet.address,
            port: o.addr.port(),
            closed: o.closed.subscribe(),
        })
    }

    fn ceremonies(&self) -> std::sync::MutexGuard<'_, Ceremonies> {
        self.ceremonies.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Asks Tailscale on the blocking pool.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, Problem> + Send + 'static,
) -> Result<T, Problem> {
    tokio::task::spawn_blocking(work)
        .await
        .unwrap_or_else(|_| Err(Problem::Failed("the look at Tailscale stopped".into())))
}

/// Opens the remote listener on this computer's tailnet address with a certificate for its name (nothing when it is
/// open already). Only `maintain` calls it, under its lock.
async fn open(state: &Arc<AppState>, control: &Arc<Control>) -> Result<(), Problem> {
    if state.remote_view().is_some() {
        return Ok(());
    }
    let status = control.source.status.clone();
    let tailnet = blocking(move || status()).await?;
    let certify = control.source.certify.clone();
    let name = tailnet.name.clone();
    let key = certified_key(blocking(move || certify(&name)).await?)?;
    let slot = Arc::new(CertSlot(std::sync::RwLock::new(key)));
    let config = server_config(slot.clone())?;
    let bind = control.source.bind.unwrap_or(tailnet.address);
    let listener = match control.remembered_port() {
        Some(port) => match tokio::net::TcpListener::bind((bind, port)).await {
            Ok(l) => Ok(l),
            Err(_) => tokio::net::TcpListener::bind((bind, 0)).await,
        },
        None => tokio::net::TcpListener::bind((bind, 0)).await,
    }
    .map_err(|e| Problem::Failed(format!("cannot listen on the tailnet address: {e}")))?;
    let addr = listener
        .local_addr()
        .map_err(|e| Problem::Failed(e.to_string()))?;
    let (closed, _) = watch::channel(false);
    let accept = accept_loop(
        listener,
        router(state.clone()),
        Some(tokio_rustls::TlsAcceptor::from(config)),
        Some(closed.subscribe()),
        Listener::Remote,
    );
    *state.remote.lock().unwrap_or_else(|e| e.into_inner()) = Some(Open {
        tailnet,
        addr,
        closed,
        accept,
        cert: slot,
        fetched: Instant::now(),
    });
    control.remember_port(addr.port());
    Ok(())
}

/// Closes the remote listener: its port, connections and event sockets, and every session, code and challenge.
pub(crate) async fn close(state: &Arc<AppState>) {
    let open = state
        .remote
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take();
    if let Some(open) = open {
        let _ = open.closed.send(true);
        open.accept.stop().await;
    }
    state.remote_pairing().reset();
    state.ceremonies().reset();
    state.revoked.send_modify(|n| *n += 1);
}

/// One look at the remote listener: turns it off after two weeks unused, opens it when it is on and closed, closes it
/// when Tailscale stopped or this computer's tailnet address or name changed (the next look opens it again), and asks
/// for a fresh certificate once a day.
pub(crate) async fn maintain(state: &Arc<AppState>) {
    let Some(control) = state.remote_control() else {
        return;
    };
    let _one = control.looking.lock().await;
    let (enabled, unused) = {
        let store = control.store();
        (store.enabled, store.unused(Utc::now()))
    };
    if unused {
        let _ = control.store().set_enabled(false, Utc::now());
    }
    if !enabled || unused {
        close(state).await;
        control.set_problem(None);
        return;
    }
    let Some(view) = state.remote_view() else {
        let opened = open(state, &control).await;
        control.set_problem(opened.err());
        return;
    };
    let status = control.source.status.clone();
    match blocking(move || status()).await {
        Ok(now) if now.name == view.name && now.address == view.address => {
            let due = state
                .remote
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .as_ref()
                .is_some_and(|o| o.fetched.elapsed() >= CERT_REFRESH);
            if due {
                refresh_certificate(state, &control, &view.name).await;
            }
        }
        other => {
            close(state).await;
            control.set_problem(other.err().or(Some(Problem::Stopped)));
        }
    }
}

/// Swaps in a fresh certificate from Tailscale; a failure keeps the one shown (tried again at the next look).
async fn refresh_certificate(state: &Arc<AppState>, control: &Control, name: &str) {
    let certify = control.source.certify.clone();
    let name = name.to_string();
    let Ok(key) = blocking(move || certify(&name))
        .await
        .and_then(certified_key)
    else {
        return;
    };
    if let Some(open) = state
        .remote
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_mut()
    {
        *open.cert.0.write().unwrap_or_else(|e| e.into_inner()) = key;
        open.fetched = Instant::now();
    }
}

fn no_control() -> Response {
    failure(
        StatusCode::NOT_FOUND,
        "no_remote_control",
        "the remote listener is not available on this server",
    )
}

fn state_json(state: &Arc<AppState>, control: &Control) -> Value {
    let view = state.remote_view();
    let pairing = state.remote_pairing().view(Instant::now());
    let problem = control
        .problem
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let store = control.store();
    let (passkeys, log) = store.view();
    json!({
        "enabled": store.enabled,
        "open": view.is_some(),
        "problem": problem.as_ref().map(Problem::code),
        "detail": match &problem { Some(Problem::Failed(m)) => Some(m.clone()), _ => None },
        "name": view.as_ref().map(|v| v.name.clone()),
        "address": view.as_ref().map(|v| v.address.to_string()),
        "port": view.as_ref().map(|v| v.port),
        "url": view.as_ref().map(|v| format!("{}/", v.origin())),
        "codes": pairing["codes"],
        "pending": pairing["pending"],
        "devices": pairing["devices"],
        "passkeys": passkeys,
        "log": log,
        "unusedDays": store::UNUSED_DAYS,
    })
}

/// `GET /remote/state` (this computer only): `{ enabled, open, problem, detail, name, address, port, url, codes,
/// pending, devices, passkeys, log, unusedDays }`. No secret and no key material is in it.
pub(crate) async fn state_route(State(state): State<Arc<AppState>>) -> Response {
    let Some(control) = state.remote_control() else {
        return no_control();
    };
    json_response(StatusCode::OK, &state_json(&state, &control))
}

/// `POST /remote/enable` (this computer only): turns it on (kept for the next start) and tries to open it now; the
/// state answers, with `problem` when it could not open (Tailscale missing or stopped, HTTPS off).
pub(crate) async fn enable_route(State(state): State<Arc<AppState>>) -> Response {
    let Some(control) = state.remote_control() else {
        return no_control();
    };
    if let Err(e) = control.store().set_enabled(true, Utc::now()) {
        return failure(StatusCode::INTERNAL_SERVER_ERROR, "failed", &e);
    }
    maintain(&state).await;
    json_response(StatusCode::OK, &state_json(&state, &control))
}

/// `POST /remote/disable` (this computer only): turns it off and closes it; the passkeys stay for when it is on again.
pub(crate) async fn disable_route(State(state): State<Arc<AppState>>) -> Response {
    let Some(control) = state.remote_control() else {
        return no_control();
    };
    if let Err(e) = control.store().set_enabled(false, Utc::now()) {
        return failure(StatusCode::INTERNAL_SERVER_ERROR, "failed", &e);
    }
    maintain(&state).await;
    json_response(StatusCode::OK, &state_json(&state, &control))
}

/// `POST /remote/code` (this computer only): a pairing code for enrolment, `{url, size, modules, expiresIn}` with
/// `https://<name>:<port>/remote#<code>`. 404 `not_open` while the listener is closed.
pub(crate) async fn code_route(State(state): State<Arc<AppState>>) -> Response {
    let Some(view) = state.remote_view() else {
        return failure(
            StatusCode::NOT_FOUND,
            "not_open",
            "the remote listener is not open",
        );
    };
    let code = state.remote_pairing().new_code(Instant::now());
    let url = format!("{}{PAGE_ROUTE}#{code}", view.origin());
    match qr_modules(&url) {
        Some((size, modules)) => json_response(
            StatusCode::OK,
            &json!({ "url": url, "size": size, "modules": modules, "expiresIn": pair::CODE_TTL.as_secs() }),
        ),
        None => failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed",
            "the address does not fit a QR code",
        ),
    }
}

/// The `id` of a management body, or the refusal.
fn id_of(headers: &HeaderMap, body: &Bytes) -> Result<String, Response> {
    let body = pair::read_body(headers, body)?;
    pair::field(&body, "id").map(str::to_string)
}

fn unknown() -> Response {
    failure(
        StatusCode::NOT_FOUND,
        "unknown",
        "no such request, device or passkey",
    )
}

/// `POST /remote/approve`, `/remote/deny` (this computer only): `{id}` of a phone that asks to enrol.
pub(crate) async fn approve_route(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let id = match id_of(&headers, &body) {
        Ok(id) => id,
        Err(refusal) => return refusal,
    };
    if !state.remote_pairing().approve(Instant::now(), &id) {
        return unknown();
    }
    json_response(StatusCode::OK, &json!({ "ok": true }))
}

pub(crate) async fn deny_route(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let id = match id_of(&headers, &body) {
        Ok(id) => id,
        Err(refusal) => return refusal,
    };
    if !state.remote_pairing().deny(Instant::now(), &id) {
        return unknown();
    }
    json_response(StatusCode::OK, &json!({ "ok": true }))
}

/// `POST /remote/revoke` (this computer only): `{id}` of a signed-in phone; its session ends (it can sign in again).
pub(crate) async fn revoke_route(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let id = match id_of(&headers, &body) {
        Ok(id) => id,
        Err(refusal) => return refusal,
    };
    if !state.remote_pairing().revoke(&id) {
        return unknown();
    }
    state.revoked.send_modify(|n| *n += 1);
    json_response(StatusCode::OK, &json!({ "ok": true }))
}

/// `POST /remote/forget` (this computer only): `{id}` of a passkey; it can no longer sign in, and its sessions end.
pub(crate) async fn forget_route(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(control) = state.remote_control() else {
        return no_control();
    };
    let id = match id_of(&headers, &body) {
        Ok(id) => id,
        Err(refusal) => return refusal,
    };
    let removed = control.store().remove(&id);
    match removed {
        Ok(true) => {
            state.remote_pairing().revoke_passkey(&id);
            state.revoked.send_modify(|n| *n += 1);
            json_response(StatusCode::OK, &json!({ "ok": true }))
        }
        Ok(false) => unknown(),
        Err(e) => failure(StatusCode::INTERNAL_SERVER_ERROR, "failed", &e),
    }
}

/// The strings of the phone's page, by language (ja and en; a test keeps their keys equal).
const STRINGS: &str = include_str!("remote/strings.json");

pub fn script_source() -> String {
    include_str!("remote/page.js").replacen("__STRINGS__", STRINGS.trim(), 1)
}

/// `GET /remote`: the phone's page, a small static page apart from the app.
pub(crate) async fn page() -> Response {
    (
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        include_str!("remote/page.html"),
    )
        .into_response()
}

/// `GET /remote.js`: the page's script, on the remote listener only.
pub(crate) async fn script(ConnectInfo(ends): ConnectInfo<Ends>) -> Response {
    if ends.listener != Listener::Remote {
        return text(StatusCode::NOT_FOUND, "not found");
    }
    (
        [
            (header::CONTENT_TYPE, "text/javascript; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        script_source(),
    )
        .into_response()
}

/// The open listener, its control and the requester's tailnet address, for a passkey route on the remote listener.
fn ceremony_ends(
    state: &Arc<AppState>,
    ends: &Ends,
) -> Result<(View, Arc<Control>, IpAddr), Response> {
    let not_found = || text(StatusCode::NOT_FOUND, "not found");
    if ends.listener != Listener::Remote {
        return Err(not_found());
    }
    let (Some(view), Some(control)) = (state.remote_view(), state.remote_control()) else {
        return Err(not_found());
    };
    Ok((view, control, ends.peer.ip()))
}

fn too_many() -> Response {
    failure(
        StatusCode::TOO_MANY_REQUESTS,
        "rate_limited",
        "too many tries; wait a minute",
    )
}

fn refused() -> Response {
    failure(
        StatusCode::FORBIDDEN,
        "refused",
        "the passkey was not accepted",
    )
}

/// The bytes of a base64url field of `body`, or a 400.
fn bytes_field(body: &serde_json::Map<String, Value>, name: &str) -> Result<Vec<u8>, Response> {
    pair::field(body, name).and_then(|text| {
        passkey::decode(text).ok_or_else(|| {
            failure(
                StatusCode::BAD_REQUEST,
                "bad_arguments",
                &format!("{name} must be base64url"),
            )
        })
    })
}

/// `POST /remote/sign-in/begin` (public on the remote listener): `{challenge, rpId, timeout}` for
/// `navigator.credentials.get`. 429 `rate_limited` after ten in a minute from one address.
pub(crate) async fn sign_in_begin(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
) -> Response {
    let (view, _, peer) = match ceremony_ends(&state, &ends) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let Some(challenge) = state
        .ceremonies()
        .begin(Instant::now(), peer, Purpose::SignIn)
    else {
        return too_many();
    };
    json_response(
        StatusCode::OK,
        &json!({ "challenge": passkey::encode(&challenge), "rpId": view.name, "timeout": CEREMONY_TIMEOUT_MS }),
    )
}

/// `POST /remote/sign-in/finish` (public on the remote listener): `{id, clientDataJSON, authenticatorData, signature}`
/// in base64url. A passkey kept here that answers this address's challenge gives a session (the cookie); anything else
/// is 403 `refused`, the same for an unknown passkey, a used challenge and a bad signature.
pub(crate) async fn sign_in_finish(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let (view, control, peer) = match ceremony_ends(&state, &ends) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let body = match pair::read_body_up_to(&headers, &body, MAX_BODY) {
        Ok(b) => b,
        Err(r) => return r,
    };
    let fields = (
        bytes_field(&body, "id"),
        bytes_field(&body, "clientDataJSON"),
        bytes_field(&body, "authenticatorData"),
        bytes_field(&body, "signature"),
    );
    let (id, client_data, auth_data, signature) = match fields {
        (Ok(a), Ok(b), Ok(c), Ok(d)) => (a, b, c, d),
        (Err(r), ..) | (_, Err(r), ..) | (_, _, Err(r), _) | (.., Err(r)) => return r,
    };
    let now = Instant::now();
    let Some(challenge) = passkey::challenge_of(&client_data) else {
        return refused();
    };
    if !state
        .ceremonies()
        .take(now, peer, &challenge, Purpose::SignIn)
    {
        return refused();
    }
    let Some(known) = control.store().by_credential(&id).cloned() else {
        return refused();
    };
    let origin = view.origin();
    let party = passkey::Party {
        rp_id: &view.name,
        origin: &origin,
    };
    let checked = passkey::check_sign_in(
        party,
        &challenge,
        &known.public_key,
        known.sign_count,
        &client_data,
        &auth_data,
        &signature,
    );
    let peer_text = peer.to_string();
    let count = match checked {
        Ok(count) => count,
        Err(_) => {
            control
                .store()
                .note(Happened::Refused, &known.label, &peer_text, Utc::now());
            return refused();
        }
    };
    let Some(secret) = state
        .remote_pairing()
        .grant(now, peer, &known.label, &known.id)
    else {
        return failure(
            StatusCode::SERVICE_UNAVAILABLE,
            "busy",
            "too many phones are signed in",
        );
    };
    {
        let mut store = control.store();
        store.used(&known.id, count, Utc::now());
        store.note(Happened::SignedIn, &known.label, &peer_text, Utc::now());
    }
    let mut response = json_response(StatusCode::OK, &json!({ "ok": true }));
    if let Some(cookie) = pair::session_set_cookie(view.port, &secret) {
        response.headers_mut().insert(header::SET_COOKIE, cookie);
    }
    response
}

/// The session digest of a caller on the remote listener that may still make a passkey, with its name.
fn enrolling(
    state: &Arc<AppState>,
    caller: Option<Caller>,
    peer: IpAddr,
) -> Option<([u8; 32], String)> {
    let Some(Caller::Session(digest)) = caller else {
        return None;
    };
    let label = state
        .remote_pairing()
        .enrolling(Instant::now(), peer, &digest)?;
    Some((digest, label))
}

fn not_enrolling() -> Response {
    failure(
        StatusCode::FORBIDDEN,
        "not_enrolling",
        "this session cannot make a passkey",
    )
}

/// `POST /remote/enrol/begin` (the session of an approved pairing, on the remote listener): `{challenge, rpId,
/// userId, userName, timeout}` for `navigator.credentials.create`. 403 `not_enrolling` for any other session.
pub(crate) async fn enrol_begin(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
    caller: Option<axum::Extension<Caller>>,
) -> Response {
    let (view, _, peer) = match ceremony_ends(&state, &ends) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let Some((digest, label)) = enrolling(&state, caller.map(|c| c.0), peer) else {
        return not_enrolling();
    };
    let Some(challenge) = state
        .ceremonies()
        .begin(Instant::now(), peer, Purpose::Enrol(digest))
    else {
        return too_many();
    };
    let mut user = [0u8; 16];
    if ring::rand::SystemRandom::new().fill(&mut user).is_err() {
        return failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed",
            "no random bytes",
        );
    }
    json_response(
        StatusCode::OK,
        &json!({
            "challenge": passkey::encode(&challenge),
            "rpId": view.name,
            "userId": passkey::encode(&user),
            "userName": format!("novira ({label})"),
            "timeout": CEREMONY_TIMEOUT_MS,
        }),
    )
}

/// `POST /remote/enrol/finish` (the session of an approved pairing): `{id, clientDataJSON, authenticatorData,
/// publicKey, algorithm}` (base64url, the algorithm a number). A passkey that checks out is kept under the pairing's
/// name and the session may make no other; 400 `refused` when it does not check out (it may try again).
pub(crate) async fn enrol_finish(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
    caller: Option<axum::Extension<Caller>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let (view, control, peer) = match ceremony_ends(&state, &ends) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let Some((digest, label)) = enrolling(&state, caller.map(|c| c.0), peer) else {
        return not_enrolling();
    };
    let body = match pair::read_body_up_to(&headers, &body, MAX_BODY) {
        Ok(b) => b,
        Err(r) => return r,
    };
    let fields = (
        bytes_field(&body, "id"),
        bytes_field(&body, "clientDataJSON"),
        bytes_field(&body, "authenticatorData"),
        bytes_field(&body, "publicKey"),
    );
    let (id, client_data, auth_data, spki) = match fields {
        (Ok(a), Ok(b), Ok(c), Ok(d)) => (a, b, c, d),
        (Err(r), ..) | (_, Err(r), ..) | (_, _, Err(r), _) | (.., Err(r)) => return r,
    };
    let Some(algorithm) = body.get("algorithm").and_then(Value::as_i64) else {
        return failure(
            StatusCode::BAD_REQUEST,
            "bad_arguments",
            "the body needs algorithm",
        );
    };
    let now = Instant::now();
    let refused = || {
        failure(
            StatusCode::BAD_REQUEST,
            "refused",
            "the passkey was not accepted",
        )
    };
    let Some(challenge) = passkey::challenge_of(&client_data) else {
        return refused();
    };
    if !state
        .ceremonies()
        .take(now, peer, &challenge, Purpose::Enrol(digest))
    {
        return refused();
    }
    let origin = view.origin();
    let party = passkey::Party {
        rp_id: &view.name,
        origin: &origin,
    };
    let Ok(key) = passkey::check_new(
        party,
        &challenge,
        &client_data,
        &auth_data,
        &id,
        algorithm,
        &spki,
    ) else {
        return refused();
    };
    let mut raw = [0u8; 8];
    if ring::rand::SystemRandom::new().fill(&mut raw).is_err() {
        return failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed",
            "no random bytes",
        );
    }
    let passkey_id: String = raw.iter().map(|b| format!("{b:02x}")).collect();
    let added = control.store().add(store::Passkey {
        id: passkey_id.clone(),
        label: label.clone(),
        credential_id: key.credential_id,
        public_key: key.public_key,
        sign_count: key.sign_count,
        added_at: Utc::now().to_rfc3339(),
        last_used_at: None,
    });
    if let Err(e) = added {
        return failure(StatusCode::CONFLICT, "too_many", &e);
    }
    state
        .remote_pairing()
        .enrolled(now, peer, &digest, &passkey_id);
    control
        .store()
        .note(Happened::Enrolled, &label, &peer.to_string(), Utc::now());
    json_response(StatusCode::OK, &json!({ "ok": true }))
}

#[cfg(test)]
mod tests;
