//! The novira backend over HTTP, for a plain web browser on the same computer, or with [`Server::open_lan`] on a phone
//! or another computer of the home network (tests and checks drive the real `novira-core` from Chromium through it). It is a second shell next to `backend/src-tauri`: both call the backend
//! through `novira_core::api`, so a command's checks are the same in both.
//!
//! What it serves: the built frontend (`index.html` with one script added), `POST /api/<command>` with JSON arguments,
//! pictures by name at `/novira-image/<full|thumb>/<name>`, a picture upload, an export download, `/events`, a
//! WebSocket of the backend's events, and with the home network the local CA's certificate at `/ca.crt` and the pairing
//! of a phone under `/pair` (`pair.rs`). Everything else is refused.
//!
//! Boundary (`docs/design/browser-server.md`, `docs/design/browser-server-lan.md`,
//! `docs/design/browser-server-pairing.md`): it listens on `127.0.0.1` over plain HTTP, and for the home network on a
//! second port of the home address over TLS only, answering there only its own subnet. Every request must carry a
//! `Host` (and `Origin`, when sent) that is the address the connection came in on, so a web page on another site, or a
//! DNS name pointed at this computer, cannot use it; and this computer's requests the token of this start (a header, or
//! the cookie the first page load sets), a device's the session this computer approved.
use axum::body::{Body, Bytes};
use axum::extract::connect_info::ConnectInfo;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{DefaultBodyLimit, Path, Request, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use novira_core::api::{self, CallError};
use novira_core::media::export::ExportOptions;
use novira_core::startup::Refusal;
use novira_core::types::ImageOptions;
use novira_core::Backend;
use serde_json::{json, Value};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, oneshot, watch, Semaphore};
use tower::ServiceExt as _;

mod home_network;
mod lan;
#[cfg(test)]
mod lan_tests;
mod pair;
mod tls;
mod trusted;
pub use home_network::{home_address, network_is_public};
pub use lan::{system_probe, Control, NetworkInfo, OpenError, Probe, LAN_IDLE};
pub use pair::{
    session_cookie, APPROVE_ROUTE as PAIR_APPROVE_ROUTE, CODE_ROUTE as PAIR_CODE_ROUTE,
    DENY_ROUTE as PAIR_DENY_ROUTE, PAGE_ROUTE as PAIR_PAGE_ROUTE,
    REQUEST_ROUTE as PAIR_REQUEST_ROUTE, REVOKE_ROUTE as PAIR_REVOKE_ROUTE,
    SCRIPT_ROUTE as PAIR_SCRIPT_ROUTE, STATE_ROUTE as PAIR_STATE_ROUTE,
    STATUS_ROUTE as PAIR_STATUS_ROUTE,
};
pub use tls::{Ca, CA_NAME};
pub use trusted::{mac_text, Mac};

/// Base of the picture URLs the backend hands out here. Relative, so a page opened as `localhost` or `127.0.0.1` loads
/// them from the origin it came from.
pub const IMAGE_URL_BASE: &str = "/novira-image";
/// The name of the cookie the first page load sets; `HttpOnly` and `SameSite=Strict`, so a script and another site
/// never see it. A browser keeps one cookie jar per host, whatever the port, so the name carries the port: two servers
/// on the same computer (two data folders) do not overwrite each other's token.
pub fn token_cookie(port: u16) -> String {
    format!("novira_token_{port}")
}
/// The header a non-browser client may send the token in.
pub const TOKEN_HEADER: &str = "x-novira-token";
/// The route a picture is posted to (the browser's replacement for the desktop's raw `upload_image` body).
pub const UPLOAD_ROUTE: &str = "/upload/image";
/// The header that carries the upload's options as JSON (the name the desktop client uses).
pub const UPLOAD_OPTIONS_HEADER: &str = "x-novira-options";
/// The route an export for sharing is downloaded from (the browser's replacement for the desktop's folder dialog).
pub const EXPORT_ROUTE: &str = "/export/images";
/// The header of an export download that carries what it holds (`ExportResult` as JSON).
pub const EXPORT_RESULT_HEADER: &str = "x-novira-export";
/// The script the served `index.html` loads first; it tells the frontend that it runs against this server.
pub const SERVER_SCRIPT: &str = "/novira-server.js";
/// The route of the local CA's certificate (public), which a phone installs once to trust the home-network listener.
pub const CA_ROUTE: &str = "/ca.crt";
/// Largest request body (a comic or a canvas document is the biggest thing a command takes).
const MAX_BODY_BYTES: usize = 32 * 1024 * 1024;
/// The most connections open at once; a page opens a handful, so this only bounds a flood (a device on the network, or
/// a local program, opening sockets to exhaust the computer). Extra ones are dropped at once.
const MAX_CONNECTIONS: usize = 512;
/// How long a connection has to send a whole request head. A trickle of bytes, or none (a kept-open idle socket), is
/// dropped, so a slow sender cannot hold a slot; a WebSocket is not held to it once it has upgraded.
const HEADER_READ_TIMEOUT: Duration = Duration::from_secs(15);

/// Commands answered now. The rest of the shared layer, and the commands only the desktop shell implements, answer
/// "not available in the browser yet". Why each group is served or left out: `docs/design/browser-server.md`.
pub const SERVED: &[&str] = &[
    // Reads.
    "bootstrap",
    "queue_snapshot",
    "list_starter_models",
    "model_parts",
    "node_packs",
    "pack_status",
    "low_memory_mode",
    "engine_settings",
    "has_hf_token",
    "has_civitai_key",
    "agent_status",
    "hardware_info",
    "list_fonts",
    "list_comics",
    "load_canvas",
    "list_unfinished_downloads",
    "watermark_status",
    // Answered once at the start: "no restore happened" while restores are not available in the browser.
    "take_restored_ui_state",
    "check_watermark_image",
    "comfy_ui_locale",
    "node_defs",
    "face_rig_library",
    // Writes of the user's own data, without a process, a download or a secret.
    "create_board",
    "update_board",
    "delete_board",
    "update_images",
    "delete_images",
    "restore_images",
    "save_comic",
    "delete_comic",
    "save_canvas",
    "adopt_ui_state",
    "save_ui_state",
    "save_workflow",
    "delete_workflow",
    // The queue: start a job and control it.
    "enqueue",
    "cancel_queue_item",
    "cancel_batch",
    "clear_queue",
    "prune_queue",
    "pause_processor",
    "resume_processor",
    "retry_queue_item",
    // Pages outside the app: answered with the address `api::page_url` checked, which the page opens in a new tab.
    "open_civitai_page",
    "open_huggingface_page",
    "open_source_page",
    // Installs and downloads, model and pack changes. `install_model` is answered by
    // `api::install_model_remote`: a local file path is refused.
    "install_model",
    "cancel_install",
    "update_model",
    "delete_model",
    "install_pack",
    "cancel_pack",
    "install_node_pack",
    "cancel_node_pack",
    "remove_node_pack",
    "switch_comfy_version",
    "delete_unfinished_downloads",
    // The watermark's pinned files, from the fixed hosts in `endpoints.rs`; started here and followed by its status.
    "prepare_watermark",
    // Reads of the model sites, the pack registry and ComfyUI's releases (addresses fixed in the backend).
    "list_hugging_face_files",
    "search_civitai",
    "comfy_versions",
    "node_pack_versions",
    "registry_nodes",
    "node_pack_info",
    "face_rig_preview",
    // Engine settings and restarts (each value is checked by the backend before it is written).
    "restart_engine",
    "set_low_memory_mode",
    "set_engine_settings",
    "remove_model_root",
    // Keys: write-only, stored with DPAPI, never returned.
    "set_hf_token",
    "set_civitai_key",
    // The assistant.
    "agent_login",
    "agent_endpoint_save",
    "agent_endpoint_models",
    "agent_endpoint_test",
    "agent_chat",
    "agent_tool_result",
    "agent_cancel",
    "lookup_reference",
];

/// Commands answered only to this computer (a loopback peer), never to a device on the home network, even with the
/// token. They install or run software, change what the engine or the machine will run and read, hold a secret, or
/// set the assistant up (sign in, or name a server it reaches). A home-network device gets generation, the queue, the
/// gallery, boards, workflows, the screen state, the reads and a chat with the assistant already set up here (its
/// `claude`/`codex` runs with its own tools off and acts only through the app's tools, none of which installs or
/// deletes); anything that changes this computer, installs or leaks stays at its keyboard. Why:
/// `docs/design/browser-server-lan.md`.
pub const LOOPBACK_ONLY: &[&str] = &[
    // Installs, downloads, packs, the engine's version and restart: code runs here, or a large download starts.
    "install_model",
    "cancel_install",
    "update_model",
    "delete_model",
    "install_pack",
    "cancel_pack",
    "install_node_pack",
    "cancel_node_pack",
    "remove_node_pack",
    "switch_comfy_version",
    "delete_unfinished_downloads",
    "restart_engine",
    // Engine and model-folder settings: what the machine runs and reads at its next start.
    "set_low_memory_mode",
    "set_engine_settings",
    "remove_model_root",
    // Secrets: write-only here, but a device could overwrite or clear the owner's key.
    "set_hf_token",
    "set_civitai_key",
    // The assistant's setup: signing in opens a browser on this computer, and a server address is one the backend
    // then reaches (a device could point it anywhere on the network).
    "agent_login",
    "agent_endpoint_save",
    "agent_endpoint_models",
    "agent_endpoint_test",
];

/// How many backend events wait for a slow page before it is dropped (it reconnects and reads the queue again).
const EVENT_BACKLOG: usize = 1024;
/// How often a device's open event socket checks that its session is still alive.
const SESSION_RECHECK: Duration = Duration::from_secs(60);

/// The `Content-Security-Policy` of every answer: the app's own, with the page's origin in place of the desktop schemes.
/// `connect-src` names this server's own WebSocket address (`host`, the checked `Host` of the request; `wss:` on the
/// TLS listener) next to `'self'`, because not every browser lets `'self'` cover `ws:`/`wss:`.
fn csp(host: &str, tls: bool) -> String {
    let ws = if tls { "wss" } else { "ws" };
    format!("default-src 'self'; img-src 'self' data: blob: https://*.civitai.com https://huggingface.co https://*.hf.co https://raw.githubusercontent.com https://avatars.githubusercontent.com; connect-src 'self' {ws}://{host} data: blob:; style-src 'self' 'unsafe-inline'; media-src 'self' blob: https://*.civitai.com; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'")
}

/// Both ends of a connection: the address it came in on decides the `Host` it may name, the far end whether it is
/// answered. The subnet mask of the address it came in on is looked up once per connection, only for a non-loopback
/// one; `tls` is whether it came in on the home-network (TLS) listener.
#[derive(Clone, Copy, Debug)]
struct Ends {
    local: Option<SocketAddr>,
    peer: SocketAddr,
    mask: Option<Ipv4Addr>,
    tls: bool,
}

impl Ends {
    /// The ends of a freshly accepted connection: the address it came in on (for the `Host` it may name) and the far
    /// end (for whether it is answered). The subnet mask is looked up once here, only for a non-loopback local address.
    fn of(stream: &tokio::net::TcpStream, peer: SocketAddr, tls: bool) -> Ends {
        let local = stream.local_addr().ok();
        let mask = match local.map(|l| l.ip()) {
            Some(IpAddr::V4(ip)) if !ip.is_loopback() => home_network::subnet_mask_of(ip),
            _ => None,
        };
        Ends {
            local,
            peer,
            mask,
            tls,
        }
    }

    /// The scheme of the page's own origin on this connection.
    fn scheme(&self) -> &'static str {
        if self.tls {
            "https"
        } else {
            "http"
        }
    }
}

/// Whether a connection is answered at all: from this computer when it came in on loopback, from the home network only
/// on the TLS listener and only from the subnet of the address it came in on. The plain HTTP listener never answers
/// another device.
fn answers(ends: &Ends) -> bool {
    let Some(local) = ends.local else {
        return false;
    };
    let peer = ends.peer.ip();
    if peer.is_loopback() {
        return local.ip().is_loopback();
    }
    ends.tls && home_network::is_home_peer(peer, local.ip(), ends.mask)
}

/// The `Host` values a request on this connection may carry: the address it came in on, plus `localhost` on loopback.
/// A name other than these (a DNS name pointed at this computer) is refused.
fn hosts_of(local: SocketAddr) -> Vec<String> {
    let port = local.port();
    match local.ip() {
        IpAddr::V4(ip) if ip.is_loopback() => {
            vec![format!("127.0.0.1:{port}"), format!("localhost:{port}")]
        }
        IpAddr::V4(ip) => vec![format!("{ip}:{port}")],
        IpAddr::V6(_) => Vec::new(),
    }
}

struct AppState {
    backend: Backend,
    token: String,
    dist: PathBuf,
    /// Every backend event as the JSON the desktop sends on `novira://event`.
    events: broadcast::Sender<String>,
    /// Set when the server stops, so open event connections end (the graceful shutdown waits for them).
    shutdown: watch::Sender<bool>,
    /// The home-network listener while it is open.
    lan: std::sync::Mutex<Option<Lan>>,
    /// Pairing codes, waiting requests and the devices' sessions (`pair.rs`).
    pairing: std::sync::Mutex<pair::Pairing>,
    /// Counts revocations, so an open event socket of a device checks its session again at once.
    revoked: watch::Sender<u64>,
    /// What opening the home network on demand needs (`lan.rs`); set by `novira-server` at every start.
    control: std::sync::Mutex<Option<Arc<lan::Control>>>,
    /// When a paired device was last heard from, or the listener opened (`lan.rs`: the idle close).
    lan_activity: std::sync::Mutex<std::time::Instant>,
}

/// Who a request was let in as, for a route that keeps a connection open (the event socket).
#[derive(Clone, Copy, Debug)]
enum Caller {
    /// This computer, with the token.
    Token,
    /// A paired device: the digest of its session secret.
    Session([u8; 32]),
    /// A public route of the home-network listener (no credential).
    Public,
}

impl AppState {
    fn pairing(&self) -> std::sync::MutexGuard<'_, pair::Pairing> {
        self.pairing.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// A new pairing code and the address that carries it, while the home-network listener is open.
    fn pair_code(&self) -> Option<PairCode> {
        let lan = self.lan_view()?;
        let code = self.pairing().new_code(std::time::Instant::now());
        Some(PairCode {
            url: format!(
                "https://{}:{}{}#{code}",
                lan.address,
                lan.port,
                pair::PAGE_ROUTE
            ),
            expires_in: pair::CODE_TTL,
        })
    }

    /// The open home-network listener's address, certificate and close signal, or `None` when it is closed.
    fn lan_view(&self) -> Option<LanView> {
        let lan = self.lan.lock().unwrap_or_else(|e| e.into_inner());
        lan.as_ref().map(|l| LanView {
            address: l.address,
            port: l.addr.port(),
            ca_pem: l.ca_pem.clone(),
            closed: l.closed.subscribe(),
        })
    }
}

/// What a route needs of the open home-network listener.
struct LanView {
    address: Ipv4Addr,
    port: u16,
    ca_pem: Arc<str>,
    closed: watch::Receiver<bool>,
}

/// A pairing code as a phone receives it.
#[derive(Clone, Debug)]
pub struct PairCode {
    /// `https://<home address>:<port>/pair#<code>`: the code is in the fragment, which a browser never sends.
    pub url: String,
    /// How long the code is good for (one request).
    pub expires_in: Duration,
}

/// Where the home-network listener listens and what its certificate names.
#[derive(Clone, Copy, Debug)]
pub struct LanOptions {
    /// This computer's home address: the certificate is made for it, and a phone's address names it.
    pub address: Ipv4Addr,
    /// The address the listener binds: `address` itself in use (only that interface listens); a test binds loopback
    /// to stay off the network.
    pub bind: Ipv4Addr,
    /// The port (0 picks a free one).
    pub port: u16,
}

/// The open home-network listener.
struct Lan {
    address: Ipv4Addr,
    addr: SocketAddr,
    ca_pem: Arc<str>,
    /// Set when it closes: its connections and event sockets end.
    closed: watch::Sender<bool>,
    accept: Accepting,
}

/// A running accept loop.
struct Accepting {
    stop: oneshot::Sender<()>,
    task: tokio::task::JoinHandle<()>,
}

impl Accepting {
    /// Stops accepting (the port closes) and waits until the loop has ended.
    async fn stop(self) {
        let _ = self.stop.send(());
        let _ = self.task.await;
    }
}

/// A running server. Dropping it does not stop it; call [`Server::stop`].
pub struct Server {
    pub addr: SocketAddr,
    /// The token of this start, required on every request of this computer.
    pub token: String,
    state: Arc<AppState>,
    accept: Accepting,
    /// Looks at the idle time and the network every half minute (`lan::watch`).
    watcher: tokio::task::JoinHandle<()>,
}

impl Server {
    /// The port it listens on.
    pub fn port(&self) -> u16 {
        self.addr.port()
    }

    /// The address to open: the page sets the cookie from the token and then drops it from the address bar.
    pub fn url(&self) -> String {
        page_url("http", Ipv4Addr::LOCALHOST, self.addr.port(), &self.token)
    }

    /// The name of the token cookie of this server.
    pub fn cookie(&self) -> String {
        token_cookie(self.addr.port())
    }

    /// Opens the home-network listener: TLS only, with a certificate `ca` makes now for `options.address`, on
    /// `options.bind`:`options.port`. It answers only its own subnet. Fails when it is already open or the port is taken.
    pub async fn open_lan(&self, ca: &Ca, options: LanOptions) -> std::io::Result<SocketAddr> {
        open_lan(&self.state, ca, options).await
    }

    /// Enables the home network for this server: with `control` the listener opens on demand (`open_lan_trusted`, or
    /// `POST /lan/open` from this computer) on a trusted network, and the `/lan/*` routes answer. Without it they
    /// answer 404.
    pub fn enable_lan(&self, control: lan::Control) {
        *self.state.control.lock().unwrap_or_else(|e| e.into_inner()) = Some(Arc::new(control));
    }

    /// Opens the home-network listener on this computer's home address when the network is a trusted one.
    pub async fn open_lan_trusted(&self) -> Result<SocketAddr, lan::OpenError> {
        lan::open_trusted(&self.state).await
    }

    /// Closes the home-network listener, when open: the port closes and its open connections and event sockets end.
    pub async fn close_lan(&self) {
        close_lan(&self.state).await;
    }

    /// Where the home-network listener listens, while it is open.
    pub fn lan_addr(&self) -> Option<SocketAddr> {
        let lan = self.state.lan.lock().unwrap_or_else(|e| e.into_inner());
        lan.as_ref().map(|l| l.addr)
    }

    /// A new pairing code and the address that carries it to a phone, while the home-network listener is open.
    pub fn pair_code(&self) -> Option<PairCode> {
        self.state.pair_code()
    }

    /// The session cookie's name on the open home-network listener.
    pub fn session_cookie(&self) -> Option<String> {
        self.state
            .lan_view()
            .map(|lan| pair::session_cookie(lan.port))
    }

    /// Stops accepting on both listeners and waits until the server's tasks have ended.
    pub async fn stop(self) {
        close_lan(&self.state).await;
        let _ = self.state.shutdown.send(true);
        self.accept.stop().await;
        let _ = self.watcher.await;
    }
}

/// The page's address with the token, which the page turns into its cookie.
fn page_url(scheme: &str, ip: Ipv4Addr, port: u16, token: &str) -> String {
    format!("{scheme}://{ip}:{port}/?token={token}")
}

/// Opens the data folder under its lock, for this server: the same refusal as the desktop app when another process
/// holds it. Pictures are addressed relative to the page.
pub fn open_backend(data_dir: &FsPath) -> Result<Backend, Refusal> {
    novira_core::startup::open_backend(data_dir, IMAGE_URL_BASE.into())
}

/// Starts serving `backend` and the frontend in `dist` on `127.0.0.1:port` (0 picks a free port), over plain HTTP. The
/// home network is opened on its own port with [`Server::open_lan`].
pub async fn start(backend: Backend, dist: PathBuf, port: u16) -> std::io::Result<Server> {
    if !dist.join("index.html").is_file() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!(
                "{} has no index.html (build the frontend first)",
                dist.display()
            ),
        ));
    }
    let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, port)).await?;
    let addr = listener.local_addr()?;
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let (events, _) = broadcast::channel::<String>(EVENT_BACKLOG);
    let (shutdown, _) = watch::channel(false);
    // The backend's events (queue, progress, installs, log lines) go to every open `/events` connection.
    let feed = events.clone();
    backend.set_event_sink(Arc::new(move |event| {
        if let Ok(json) = serde_json::to_string(&event) {
            // No receiver is not an error: nobody has the page open.
            let _ = feed.send(json);
        }
    }));
    let state = Arc::new(AppState {
        backend,
        events,
        shutdown,
        token: token.clone(),
        dist,
        lan: std::sync::Mutex::new(None),
        pairing: std::sync::Mutex::new(pair::Pairing::default()),
        revoked: watch::channel(0).0,
        control: std::sync::Mutex::new(None),
        lan_activity: std::sync::Mutex::new(std::time::Instant::now()),
    });
    // Open connections of this listener end on their own: the event sockets when the shutdown watch fires
    // (`Server::stop` sends it), others when they finish.
    let accept = accept_loop(listener, router(state.clone()), None, None);
    let watcher = tokio::spawn(lan::watch(state.clone(), state.shutdown.subscribe()));
    Ok(Server {
        addr,
        token,
        state,
        accept,
        watcher,
    })
}

async fn open_lan(
    state: &Arc<AppState>,
    ca: &Ca,
    options: LanOptions,
) -> std::io::Result<SocketAddr> {
    let refuse = |m: String| std::io::Error::other(m);
    if state
        .lan
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .is_some()
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            "the home-network listener is already open",
        ));
    }
    let config = ca.server_config(options.address).map_err(refuse)?;
    let listener = tokio::net::TcpListener::bind((options.bind, options.port)).await?;
    let addr = listener.local_addr()?;
    let (closed, _) = watch::channel(false);
    let accept = accept_loop(
        listener,
        router(state.clone()),
        Some(tokio_rustls::TlsAcceptor::from(config)),
        Some(closed.subscribe()),
    );
    let lan = Lan {
        address: options.address,
        addr,
        ca_pem: Arc::from(ca.pem()),
        closed,
        accept,
    };
    // Another open may have won the race while this one bound its port; then this one is the loser and stops.
    let lost = {
        let mut slot = state.lan.lock().unwrap_or_else(|e| e.into_inner());
        if slot.is_some() {
            Some(lan)
        } else {
            *slot = Some(lan);
            None
        }
    };
    if let Some(lan) = lost {
        lan.accept.stop().await;
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            "the home-network listener is already open",
        ));
    }
    Ok(addr)
}

/// Closes the home-network listener. Every session, code and waiting request ends with it: a device pairs again.
async fn close_lan(state: &Arc<AppState>) {
    let lan = state.lan.lock().unwrap_or_else(|e| e.into_inner()).take();
    if let Some(lan) = lan {
        let _ = lan.closed.send(true);
        lan.accept.stop().await;
    }
    state.pairing().reset();
    state.revoked.send_modify(|n| *n += 1);
}

/// Accepts connections until stopped and serves each with `app`. `tls` makes it the home-network listener: every
/// connection must complete a TLS handshake within the header timeout (plain HTTP there gets no answer), and `closed`
/// ends its open connections at once.
fn accept_loop(
    listener: tokio::net::TcpListener,
    app: Router,
    tls: Option<tokio_rustls::TlsAcceptor>,
    closed: Option<watch::Receiver<bool>>,
) -> Accepting {
    let (stop, stopped) = oneshot::channel::<()>();
    let task = tokio::spawn(async move {
        let connections = Arc::new(Semaphore::new(MAX_CONNECTIONS));
        let mut stopped = stopped;
        loop {
            let (stream, peer) = tokio::select! {
                _ = &mut stopped => break,
                accepted = listener.accept() => match accepted {
                    Ok(pair) => pair,
                    // A failed accept (a connection reset before it was taken) is not fatal.
                    Err(_) => continue,
                },
            };
            // Too many open at once: drop this one rather than let a flood exhaust the computer.
            let Ok(permit) = connections.clone().try_acquire_owned() else {
                continue;
            };
            let ends = Ends::of(&stream, peer, tls.is_some());
            let (app, tls, mut closed) = (app.clone(), tls.clone(), closed.clone());
            tokio::spawn(async move {
                // Dropped when the connection ends; this is the slot the semaphore counted.
                let _permit = permit;
                let work = async move {
                    match tls {
                        None => serve_connection(stream, app, ends).await,
                        Some(acceptor) => {
                            // A handshake that does not finish in time (or plain HTTP, which is no handshake) is
                            // dropped, so it cannot hold a slot.
                            let handshake =
                                tokio::time::timeout(HEADER_READ_TIMEOUT, acceptor.accept(stream));
                            if let Ok(Ok(stream)) = handshake.await {
                                serve_connection(stream, app, ends).await;
                            }
                        }
                    }
                };
                match closed.as_mut() {
                    None => work.await,
                    Some(closed) => {
                        tokio::select! {
                            _ = work => {}
                            _ = closed.wait_for(|c| *c) => {}
                        }
                    }
                }
            });
        }
        // The listener drops here, so no new connection is accepted and the port closes.
    });
    Accepting { stop, task }
}

/// Serves the HTTP/1 requests of one connection (plain or TLS) with `app`; each request learns its connection's ends.
async fn serve_connection<I>(io: I, app: Router, ends: Ends)
where
    I: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    // Each request learns its connection's ends (the `Host`/`Origin`/token checks and `LOOPBACK_ONLY` read them).
    let service = hyper_util::service::TowerToHyperService::new(tower::service_fn(
        move |mut request: hyper::Request<hyper::body::Incoming>| {
            request.extensions_mut().insert(ConnectInfo(ends));
            app.clone().oneshot(request)
        },
    ));
    // `header_read_timeout` ends a connection that does not send a whole request head in time, so a slow or silent
    // sender cannot hold a slot; `with_upgrades` keeps the `/events` WebSocket working.
    let connection = hyper::server::conn::http1::Builder::new()
        // `header_read_timeout` needs a timer to arm; without one hyper panics when it sets the deadline.
        .timer(hyper_util::rt::TokioTimer::new())
        .header_read_timeout(HEADER_READ_TIMEOUT)
        .serve_connection(hyper_util::rt::TokioIo::new(io), service)
        .with_upgrades();
    let _ = connection.await;
}

fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/index.html", get(index))
        .route(SERVER_SCRIPT, get(server_script))
        .route(CA_ROUTE, get(ca_certificate))
        .route(pair::PAGE_ROUTE, get(pair::page))
        .route(pair::SCRIPT_ROUTE, get(pair_script))
        .route(pair::REQUEST_ROUTE, post(pair_request))
        .route(pair::STATUS_ROUTE, post(pair_status))
        .route(pair::CODE_ROUTE, post(pair_code))
        .route(pair::STATE_ROUTE, get(pair_state))
        .route(pair::APPROVE_ROUTE, post(pair_approve))
        .route(pair::DENY_ROUTE, post(pair_deny))
        .route(pair::REVOKE_ROUTE, post(pair_revoke))
        .route("/lan/state", get(lan::state_route))
        .route("/lan/open", post(lan::open_route))
        .route("/lan/close", post(lan::close_route))
        .route("/lan/trust", post(lan::trust_route))
        .route("/lan/untrust", post(lan::untrust_route))
        .route("/api/{command}", post(command))
        .route("/events", get(events))
        .route(UPLOAD_ROUTE, post(upload_image))
        .route(EXPORT_ROUTE, post(export_images))
        .route("/novira-image/{variant}/{name}", get(image))
        .fallback(get(static_file))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(middleware::from_fn_with_state(state.clone(), check_request))
        .with_state(state)
}

fn text(status: StatusCode, message: &str) -> Response {
    (
        status,
        [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        message.to_string(),
    )
        .into_response()
}

/// Compares without stopping at the first difference.
fn same_secret(a: &str, b: &str) -> bool {
    a.len() == b.len()
        && a.bytes()
            .zip(b.bytes())
            .fold(0u8, |acc, (x, y)| acc | (x ^ y))
            == 0
}

fn cookie_token<'a>(headers: &'a HeaderMap, cookie: &str) -> Option<&'a str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .find_map(|pair| {
            let (name, value) = pair.trim().split_once('=')?;
            (name == cookie).then_some(value)
        })
}

fn query_token(query: Option<&str>) -> Option<&str> {
    query?
        .split('&')
        .find_map(|pair| pair.strip_prefix("token="))
}

/// The checks every request passes before a route runs: who connected, `Host`, `Origin` and fetch metadata (the
/// DNS-rebinding and cross-site defence), then the credential: the token for this computer (in the address only on the
/// page itself, which turns it into the cookie), a session for a device, none for the public pairing routes.
async fn check_request(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let Some(ConnectInfo(ends)) = request.extensions().get::<ConnectInfo<Ends>>().copied() else {
        return text(StatusCode::FORBIDDEN, "this connection is not served");
    };
    if !answers(&ends) {
        return text(StatusCode::FORBIDDEN, "this connection is not served");
    }
    let Some(local) = ends.local else {
        return text(StatusCode::FORBIDDEN, "this connection is not served");
    };
    let headers = request.headers();
    // Exactly one `Host` and at most one `Origin`: with two, which one a check reads and which one a later reader
    // trusts could differ.
    if headers.get_all(header::HOST).iter().count() != 1
        || headers.get_all(header::ORIGIN).iter().count() > 1
    {
        return text(
            StatusCode::BAD_REQUEST,
            "a request names one host and one origin",
        );
    }
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if !hosts_of(local).contains(&host) {
        return text(StatusCode::FORBIDDEN, "this address is not served");
    }
    if let Some(origin) = headers.get(header::ORIGIN) {
        if origin.to_str().ok() != Some(format!("{}://{host}", ends.scheme()).as_str()) {
            return text(StatusCode::FORBIDDEN, "this origin is not served");
        }
    }
    if let Some(site) = headers.get("sec-fetch-site") {
        // A scanned QR code opens the pairing page from the camera app, which a browser calls cross-site. That one
        // static, credential-free page may be reached by a top-level navigation; nothing else may.
        let pairing_page_opened = request.method() == Method::GET
            && request.uri().path() == pair::PAGE_ROUTE
            && headers
                .get("sec-fetch-mode")
                .is_some_and(|mode| mode == "navigate");
        if !pairing_page_opened && !matches!(site.to_str(), Ok("same-origin" | "none")) {
            return text(StatusCode::FORBIDDEN, "cross-site requests are not served");
        }
    }
    let path = request.uri().path().to_string();
    let get_page = request.method() == Method::GET && path == "/";
    let loopback = ends.peer.ip().is_loopback();
    // The pairing's management (codes, decisions, revocations) stays at this computer's keyboard.
    if (pair::is_management(&path) || lan::is_management(&path)) && !loopback {
        return text(
            StatusCode::FORBIDDEN,
            "pairing and the home network are managed on this computer only",
        );
    }
    // Public on the home-network listener: the CA's certificate, the pairing page and its two calls, which a phone
    // uses before it has anything to prove.
    let public = ends.tls && pair::is_public(request.method(), &path);
    // This computer proves itself with the token of this start; a device only with the session it was given when this
    // computer approved its pairing, from the address it paired from (the token is no credential there).
    let caller = if public {
        Some(Caller::Public)
    } else if loopback {
        headers
            .get(TOKEN_HEADER)
            .and_then(|v| v.to_str().ok())
            .or_else(|| cookie_token(headers, &token_cookie(local.port())))
            .is_some_and(|t| same_secret(t, &state.token))
            .then_some(Caller::Token)
    } else {
        cookie_token(headers, &pair::session_cookie(local.port()))
            .and_then(|secret| {
                state
                    .pairing()
                    .session(std::time::Instant::now(), ends.peer.ip(), secret)
            })
            .map(|digest| {
                // A paired device in use keeps the home network open.
                state.note_lan_activity();
                Caller::Session(digest)
            })
    };
    let query_ok = loopback
        && get_page
        && query_token(request.uri().query()).is_some_and(|t| same_secret(t, &state.token));
    let mut request = request;
    let mut response = if let Some(caller) = caller {
        request.extensions_mut().insert(caller);
        next.run(request).await
    } else if !loopback && get_page {
        // A device without a session opening the app is sent to pair.
        Response::builder()
            .status(StatusCode::SEE_OTHER)
            .header(header::LOCATION, pair::PAGE_ROUTE)
            .body(Body::empty())
            .unwrap_or_else(|_| text(StatusCode::UNAUTHORIZED, "this device is not paired"))
    } else if !loopback {
        text(StatusCode::UNAUTHORIZED, "this device is not paired")
    } else if query_ok {
        request.extensions_mut().insert(Caller::Token);
        // The address keeps its token in the response (no redirect to a bare `/`): the page itself drops it from the
        // address bar once loaded (`hideToken` in the frontend), and the cookie keeps a reload working.
        let secure = if ends.tls { "; Secure" } else { "" };
        let cookie = format!(
            "{}={}; Path=/; HttpOnly; SameSite=Strict{secure}",
            token_cookie(local.port()),
            state.token
        );
        let mut page = next.run(request).await;
        if let Ok(value) = HeaderValue::from_str(&cookie) {
            page.headers_mut().insert(header::SET_COOKIE, value);
        }
        page
    } else {
        text(StatusCode::UNAUTHORIZED, "the token is missing or wrong")
    };
    let h = response.headers_mut();
    if let Ok(policy) = HeaderValue::from_str(&csp(&host, ends.tls)) {
        h.insert(header::CONTENT_SECURITY_POLICY, policy);
    }
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    // With `frame-ancestors 'none'` in the policy: no other page may show this one in a frame (for a browser that
    // reads only the older header).
    h.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    h.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    h.insert(
        "cross-origin-resource-policy",
        HeaderValue::from_static("same-origin"),
    );
    response
}

/// `index.html` with the script that marks the page as served by this server, placed before the app's own script.
async fn index(State(state): State<Arc<AppState>>) -> Response {
    let Ok(html) = tokio::fs::read_to_string(state.dist.join("index.html")).await else {
        return text(
            StatusCode::INTERNAL_SERVER_ERROR,
            "index.html cannot be read",
        );
    };
    let tag = format!("<script src=\"{SERVER_SCRIPT}\"></script>");
    let html = match html.find("<head>") {
        Some(i) => format!("{}{tag}{}", &html[..i + 6], &html[i + 6..]),
        None => {
            return text(
                StatusCode::INTERNAL_SERVER_ERROR,
                "index.html has no <head>",
            )
        }
    };
    (
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        html,
    )
        .into_response()
}

async fn server_script() -> Response {
    (
        [
            (header::CONTENT_TYPE, "text/javascript; charset=utf-8"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        "window.__NOVIRA_SERVER__ = true;\n",
    )
        .into_response()
}

/// The QR code of `url`: the number of modules on a side, and the modules row by row, `1` dark and `0` light (no quiet
/// zone). `None` when the text is too long for a QR code.
pub fn qr_modules(url: &str) -> Option<(usize, String)> {
    let code = qrcode::QrCode::new(url.as_bytes()).ok()?;
    let modules = code
        .to_colors()
        .into_iter()
        .map(|c| if c == qrcode::Color::Dark { '1' } else { '0' })
        .collect();
    Some((code.width(), modules))
}

/// `POST /pair/code` (this computer only, with the token): a new pairing code as `{ url, size, modules, expiresIn }`,
/// the address a phone opens and its QR code. 404 while the home-network listener is closed.
async fn pair_code(State(state): State<Arc<AppState>>) -> Response {
    let Some(code) = state.pair_code() else {
        return failure(
            StatusCode::NOT_FOUND,
            "no_home_network",
            "not answering the home network",
        );
    };
    match qr_modules(&code.url) {
        Some((size, modules)) => json_response(
            StatusCode::OK,
            &json!({
                "url": code.url,
                "size": size,
                "modules": modules,
                "expiresIn": code.expires_in.as_secs(),
            }),
        ),
        None => failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed",
            "the address does not fit a QR code",
        ),
    }
}

/// `GET /pair/state` (this computer only): `{ open, codes, pending: [{id, label, peer, confirm, waitingSecs}], devices:
/// [{id, label, peer, pairedSecs, idleSecs}] }`. No secret is in it.
async fn pair_state(State(state): State<Arc<AppState>>) -> Response {
    let mut view = state.pairing().view(std::time::Instant::now());
    view["open"] = state.lan_view().is_some().into();
    json_response(StatusCode::OK, &view)
}

/// What this computer does with an `{id}`.
#[derive(Clone, Copy)]
enum Decide {
    Approve,
    Deny,
    Revoke,
}

/// `POST /pair/approve`, `/pair/deny`, `/pair/revoke` (this computer only): `{id}` of a waiting request or a paired
/// device; `{ok: true}`, or 404 `unknown` when there is none (or it was decided already).
async fn pair_decide(
    state: Arc<AppState>,
    headers: HeaderMap,
    body: Bytes,
    what: Decide,
) -> Response {
    let body = match pair::read_body(&headers, &body) {
        Ok(body) => body,
        Err(refusal) => return refusal,
    };
    let id = match pair::field(&body, "id") {
        Ok(id) => id,
        Err(refusal) => return refusal,
    };
    let now = std::time::Instant::now();
    let done = {
        let mut pairing = state.pairing();
        match what {
            Decide::Approve => pairing.approve(now, id),
            Decide::Deny => pairing.deny(now, id),
            Decide::Revoke => pairing.revoke(id),
        }
    };
    if !done {
        return failure(
            StatusCode::NOT_FOUND,
            "unknown",
            "no such request or device",
        );
    }
    if matches!(what, Decide::Revoke) {
        // An open event socket of that device checks its session again now.
        state.revoked.send_modify(|n| *n += 1);
    }
    json_response(StatusCode::OK, &json!({ "ok": true }))
}

async fn pair_approve(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    pair_decide(state, headers, body, Decide::Approve).await
}

async fn pair_deny(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    pair_decide(state, headers, body, Decide::Deny).await
}

async fn pair_revoke(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    pair_decide(state, headers, body, Decide::Revoke).await
}

/// `POST /pair/request` (a device on the home-network listener, no credential): `{code, label}`; `{poll, confirm}`
/// back. 403 `bad_code` (wrong, used or expired), 400 `bad_label`, 429 `rate_limited`, 503 `busy`.
async fn pair_request(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if !ends.tls {
        return text(StatusCode::NOT_FOUND, "not found");
    }
    let body = match pair::read_body(&headers, &body) {
        Ok(body) => body,
        Err(refusal) => return refusal,
    };
    let (code, label) = match (pair::field(&body, "code"), pair::field(&body, "label")) {
        (Ok(code), Ok(label)) => (code, label),
        (Err(refusal), _) | (_, Err(refusal)) => return refusal,
    };
    let asked = state
        .pairing()
        .request(std::time::Instant::now(), ends.peer.ip(), code, label);
    match asked {
        Ok(ticket) => json_response(
            StatusCode::OK,
            &json!({ "poll": ticket.poll, "confirm": ticket.confirm }),
        ),
        Err(pair::Refused::RateLimited) => failure(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limited",
            "too many pairing requests; wait a minute",
        ),
        Err(pair::Refused::BadLabel) => failure(
            StatusCode::BAD_REQUEST,
            "bad_label",
            "the name must be 1 to 40 plain characters",
        ),
        Err(pair::Refused::BadCode) => failure(
            StatusCode::FORBIDDEN,
            "bad_code",
            "the pairing code is wrong or has expired",
        ),
        Err(pair::Refused::Busy) => failure(
            StatusCode::SERVICE_UNAVAILABLE,
            "busy",
            "too many pairing requests are waiting",
        ),
    }
}

/// `POST /pair/status` (the device that asked, no credential but its poll secret): `{poll}`; `{state: "pending" |
/// "denied" | "approved"}`, with the session cookie once approved (handed out once). 404 `unknown` for a wrong secret,
/// another address, or a request that expired or was collected.
async fn pair_status(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let (true, Some(local)) = (ends.tls, ends.local) else {
        return text(StatusCode::NOT_FOUND, "not found");
    };
    let body = match pair::read_body(&headers, &body) {
        Ok(body) => body,
        Err(refusal) => return refusal,
    };
    let poll = match pair::field(&body, "poll") {
        Ok(poll) => poll,
        Err(refusal) => return refusal,
    };
    let status = state
        .pairing()
        .status(std::time::Instant::now(), ends.peer.ip(), poll);
    match status {
        pair::Status::Pending => json_response(StatusCode::OK, &json!({ "state": "pending" })),
        pair::Status::Denied => json_response(StatusCode::OK, &json!({ "state": "denied" })),
        pair::Status::Unknown => json_response(
            StatusCode::NOT_FOUND,
            &json!({ "state": "unknown", "code": "unknown", "error": "no such pairing request" }),
        ),
        pair::Status::Approved(secret) => {
            let mut response = json_response(StatusCode::OK, &json!({ "state": "approved" }));
            if let Some(cookie) = pair::session_set_cookie(local.port(), &secret) {
                response.headers_mut().insert(header::SET_COOKIE, cookie);
            }
            response
        }
    }
}

/// `GET /pair.js`: the phone page's script.
async fn pair_script(State(state): State<Arc<AppState>>) -> Response {
    match state.lan_view() {
        Some(_) => pair::script(),
        None => text(StatusCode::NOT_FOUND, "not answering the home network"),
    }
}

/// `GET /ca.crt`: the local CA's certificate (PEM), which a phone installs to trust the home-network listener. Public on
/// that listener; 404 while it is closed.
async fn ca_certificate(State(state): State<Arc<AppState>>) -> Response {
    let Some(lan) = state.lan_view() else {
        return text(StatusCode::NOT_FOUND, "not answering the home network");
    };
    (
        [
            (header::CONTENT_TYPE, "application/x-x509-ca-cert"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"novira-local-ca.crt\"",
            ),
            (header::CACHE_CONTROL, "no-store"),
        ],
        lan.ca_pem.to_string(),
    )
        .into_response()
}

fn json_response(status: StatusCode, value: &Value) -> Response {
    json_text_response(status, serde_json::to_string(value).unwrap_or_default())
}

fn json_text_response(status: StatusCode, body: String) -> Response {
    (
        status,
        [
            (header::CONTENT_TYPE, "application/json"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        body,
    )
        .into_response()
}

fn failure(status: StatusCode, code: &str, message: &str) -> Response {
    json_response(status, &json!({ "error": message, "code": code }))
}

/// `POST /api/<command>`: the JSON arguments in the body (an empty body is no arguments), the JSON result back.
async fn command(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
    Path(name): Path<String>,
    body: Bytes,
) -> Response {
    // A device on the home network gets the safe subset; what changes, runs or leaks on this computer stays at its
    // keyboard (`LOOPBACK_ONLY`). On loopback (this computer) nothing is held back.
    if !ends.peer.ip().is_loopback() && LOOPBACK_ONLY.contains(&name.as_str()) {
        return failure(
            StatusCode::FORBIDDEN,
            "not_available_over_network",
            &format!("not available from another device: {name}"),
        );
    }
    // An empty body is no arguments; anything else must be one JSON value (so bad JSON is a 400, not "no arguments").
    let args: Value = if body.iter().all(u8::is_ascii_whitespace) {
        Value::Null
    } else {
        match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(_) => {
                return failure(
                    StatusCode::BAD_REQUEST,
                    "bad_arguments",
                    "the body must be JSON",
                )
            }
        }
    };
    if !SERVED.contains(&name.as_str()) {
        return if api::NAMES.contains(&name.as_str()) || api::SHELL_ONLY.contains(&name.as_str()) {
            failure(
                StatusCode::NOT_IMPLEMENTED,
                "not_available_in_browser",
                &format!("not available in the browser yet: {name}"),
            )
        } else {
            failure(
                StatusCode::NOT_FOUND,
                "unknown_command",
                &format!("unknown command: {name}"),
            )
        };
    }
    let result = if name == "install_model" {
        api::install_model_remote(&state.backend, args).await
    } else if name == "prepare_watermark" {
        if !(args.is_null() || args.as_object().is_some_and(|m| m.is_empty())) {
            Err(CallError::BadArguments(
                "prepare_watermark takes no arguments".into(),
            ))
        } else {
            // As the desktop shell does: the download runs on, and the page asks for the status.
            let backend = state.backend.clone();
            tokio::spawn(async move { backend.prepare_watermark().await });
            Ok("null".to_string())
        }
    } else if api::PAGE_COMMANDS.contains(&name.as_str()) {
        api::page_url(&name, args)
    } else {
        api::dispatch(&state.backend, &name, args).await
    };
    match result {
        Ok(text) => json_text_response(StatusCode::OK, text),
        Err(CallError::UnknownCommand) => failure(
            StatusCode::NOT_FOUND,
            "unknown_command",
            &format!("unknown command: {name}"),
        ),
        Err(CallError::BadArguments(m)) => failure(StatusCode::BAD_REQUEST, "bad_arguments", &m),
        Err(CallError::Failed(m)) => failure(StatusCode::UNPROCESSABLE_ENTITY, "failed", &m),
    }
}

/// `POST /upload/image`: the bytes of a picture as the body (`application/octet-stream`) and the options
/// (`boardId`, `isIntermediate`, `category`) as JSON in `x-novira-options`; the answer is the stored picture. The backend
/// decodes and re-encodes it (size and shape limits are the backend's), so what is stored is a PNG it made.
async fn upload_image(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    // A fixed content type keeps a cross-site form or a plain `fetch` from posting here without a preflight.
    if headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        != Some("application/octet-stream")
    {
        return failure(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "bad_arguments",
            "the body must be application/octet-stream",
        );
    }
    let options: ImageOptions = match headers.get(UPLOAD_OPTIONS_HEADER) {
        None => ImageOptions::default(),
        Some(value) => {
            match value
                .to_str()
                .ok()
                .and_then(|text| serde_json::from_str(text).ok())
            {
                Some(options) => options,
                None => {
                    return failure(
                        StatusCode::BAD_REQUEST,
                        "bad_arguments",
                        "the upload options must be JSON",
                    )
                }
            }
        }
    };
    match state.backend.upload_image(body.to_vec(), options).await {
        Ok(image) => json_response(
            StatusCode::OK,
            &serde_json::to_value(image).unwrap_or(Value::Null),
        ),
        Err(e) => failure(StatusCode::UNPROCESSABLE_ENTITY, "failed", &e.to_string()),
    }
}

/// `POST /export/images`: `{ "names": [...], "options": {...} }` as JSON (the arguments of `export_images`); the answer
/// is the download itself, one picture or a zip, with what it holds as JSON in `x-novira-export`. The backend checks
/// the names and options as for the desktop; no path is sent either way.
async fn export_images(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    // As for the upload: a fixed content type keeps a cross-site form from posting here without a preflight.
    if headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        != Some("application/json")
    {
        return failure(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "bad_arguments",
            "the body must be application/json",
        );
    }
    let parsed = serde_json::from_slice::<Value>(&body)
        .ok()
        .and_then(|mut v| {
            let names = serde_json::from_value::<Vec<String>>(v.get_mut("names")?.take()).ok()?;
            let options =
                serde_json::from_value::<ExportOptions>(v.get_mut("options")?.take()).ok()?;
            Some((names, options))
        });
    let Some((names, options)) = parsed else {
        return failure(
            StatusCode::BAD_REQUEST,
            "bad_arguments",
            "the body must be { names, options }",
        );
    };
    match state.backend.export_download(names, options).await {
        Ok(download) => {
            let result = serde_json::to_string(&download.result).unwrap_or_default();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, download.content_type)
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{}\"", download.file_name),
                )
                .header(header::CACHE_CONTROL, "no-store")
                .header(EXPORT_RESULT_HEADER, result)
                .body(Body::from(download.bytes))
                .unwrap_or_else(|_| text(StatusCode::INTERNAL_SERVER_ERROR, "error"))
        }
        Err(e) => failure(StatusCode::UNPROCESSABLE_ENTITY, "failed", &e.to_string()),
    }
}

/// `GET /events`: a WebSocket that carries each backend event as one JSON text message (what the desktop sends on
/// `novira://event`). It passes the same token, `Host` and `Origin` checks as every request, and only sends: what the
/// page says on it is ignored. A page that falls behind is dropped; it reconnects and reads the queue again.
async fn events(
    State(state): State<Arc<AppState>>,
    ConnectInfo(ends): ConnectInfo<Ends>,
    caller: Option<axum::Extension<Caller>>,
    upgrade: WebSocketUpgrade,
) -> Response {
    let mut feed = state.events.subscribe();
    let mut stopped = state.shutdown.subscribe();
    // On the home-network listener the socket also ends when that listener closes (an upgraded socket outlives the
    // connection task the close ends).
    let mut lan_closed = None;
    if ends.tls {
        let Some(lan) = state.lan_view() else {
            return text(StatusCode::NOT_FOUND, "not answering the home network");
        };
        lan_closed = Some(lan.closed);
    }
    // A device's socket lives only as long as its session: it is checked again when this computer revokes one, and
    // every minute (an open socket counts as use, up to the session's four hours).
    let session = match caller.map(|c| c.0) {
        Some(Caller::Session(digest)) => Some(digest),
        Some(Caller::Token) => None,
        _ => return text(StatusCode::UNAUTHORIZED, "the token is missing or wrong"),
    };
    let mut revoked = state.revoked.subscribe();
    let peer = ends.peer.ip();
    let checker = state.clone();
    let session_ended = async move {
        let Some(digest) = session else {
            return std::future::pending::<()>().await;
        };
        let mut every = tokio::time::interval(SESSION_RECHECK);
        loop {
            tokio::select! {
                _ = every.tick() => {}
                changed = revoked.changed() => if changed.is_err() { return; },
            }
            if !checker
                .pairing()
                .touch(std::time::Instant::now(), peer, &digest)
            {
                return;
            }
            // An open socket of a paired device is a device in use.
            checker.note_lan_activity();
        }
    };
    upgrade.on_upgrade(move |mut socket: WebSocket| async move {
        tokio::pin!(session_ended);
        let lan_closed = async move {
            match lan_closed {
                Some(mut closed) => {
                    let _ = closed.wait_for(|c| *c).await;
                }
                None => std::future::pending::<()>().await,
            }
        };
        tokio::pin!(lan_closed);
        loop {
            tokio::select! {
                event = feed.recv() => match event {
                    Ok(json) => {
                        if socket.send(Message::text(json)).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                },
                incoming = socket.recv() => match incoming {
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => {}
                },
                _ = stopped.changed() => break,
                _ = &mut lan_closed => break,
                _ = &mut session_ended => break,
            }
        }
        let _ = socket.send(Message::Close(None)).await;
    })
}

/// `GET /novira-image/<full|thumb>/<name>`: the same decision as the desktop app's picture scheme (names only).
async fn image(
    State(state): State<Arc<AppState>>,
    Path((variant, name)): Path<(String, String)>,
    headers: HeaderMap,
) -> Response {
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let backend = state.backend.clone();
    let served = tokio::task::spawn_blocking(move || {
        novira_core::image_serve::serve(&backend, &format!("/{variant}/{name}"), range.as_deref())
    })
    .await;
    let Ok(served) = served else {
        return text(StatusCode::INTERNAL_SERVER_ERROR, "error");
    };
    let mut response = Response::builder()
        .status(served.status)
        .header(header::CONTENT_TYPE, served.content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(
            header::CACHE_CONTROL,
            "private, max-age=31536000, immutable",
        );
    if let Some(range) = &served.content_range {
        response = response.header(header::CONTENT_RANGE, range.as_str());
    }
    response
        .body(Body::from(served.body))
        .unwrap_or_else(|_| text(StatusCode::INTERNAL_SERVER_ERROR, "error"))
}

/// The segments of a request path, or `None` when one could leave the folder or name something other than a file:
/// empty, `.`, `..`, a separator, a drive colon, a control character, a Windows device name.
fn safe_segments(path: &str) -> Option<Vec<String>> {
    let rest = path.strip_prefix('/')?;
    let mut out = Vec::new();
    for raw in rest.split('/') {
        let segment = percent_decode(raw)?;
        let bad = segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment
                .chars()
                .any(|c| matches!(c, '/' | '\\' | ':') || c.is_control())
            || segment.ends_with(['.', ' '])
            || novira_core::is_reserved_device_name(&segment);
        if bad {
            return None;
        }
        out.push(segment);
    }
    Some(out)
}

fn percent_decode(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

fn content_type(path: &FsPath) -> Option<&'static str> {
    Some(
        match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
            "html" => "text/html; charset=utf-8",
            "js" | "mjs" => "text/javascript; charset=utf-8",
            "css" => "text/css; charset=utf-8",
            "json" | "map" => "application/json",
            "webmanifest" => "application/manifest+json",
            "svg" => "image/svg+xml",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "gif" => "image/gif",
            "ico" => "image/x-icon",
            "woff2" => "font/woff2",
            "woff" => "font/woff",
            "ttf" => "font/ttf",
            "otf" => "font/otf",
            "txt" => "text/plain; charset=utf-8",
            "mp3" => "audio/mpeg",
            "wav" => "audio/wav",
            "mp4" => "video/mp4",
            "wasm" => "application/wasm",
            _ => return None,
        },
    )
}

/// A file of the built frontend. Only files of a known type inside the folder; no listing, no fallback to the page.
async fn static_file(State(state): State<Arc<AppState>>, request: Request) -> Response {
    let not_found = || text(StatusCode::NOT_FOUND, "not found");
    let Some(segments) = safe_segments(request.uri().path()) else {
        return not_found();
    };
    let path = segments.iter().fold(state.dist.clone(), |p, s| p.join(s));
    let Some(kind) = content_type(&path) else {
        return not_found();
    };
    // Resolved paths must stay inside the folder (a link inside it could point out).
    let (Ok(root), Ok(real)) = (state.dist.canonicalize(), path.canonicalize()) else {
        return not_found();
    };
    if !real.starts_with(&root) || !real.is_file() {
        return not_found();
    }
    match tokio::fs::read(&real).await {
        Ok(bytes) => (
            [
                (header::CONTENT_TYPE, kind),
                (header::CACHE_CONTROL, "no-cache"),
            ],
            bytes,
        )
            .into_response(),
        Err(_) => not_found(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_paths_that_could_leave_the_folder_are_refused() {
        assert_eq!(
            safe_segments("/assets/app.js"),
            Some(vec!["assets".into(), "app.js".into()])
        );
        assert_eq!(safe_segments("/a%20b.png"), Some(vec!["a b.png".into()]));
        for bad in [
            "/../x",
            "/a/../x",
            "/%2e%2e/x",
            "/%2E%2E%5Cx",
            "/a%2Fb",
            "/a%5Cb",
            "/c:/x",
            "/C%3A",
            "//x",
            "/a//b",
            "/a/",
            "/",
            "/nul",
            "/con.js",
            "/x%00",
            "/%zz",
            "/a.",
            "/a ",
            "/%ff",
            "x",
        ] {
            assert_eq!(safe_segments(bad), None, "{bad}");
        }
    }

    #[test]
    fn the_qr_code_is_a_square_of_dark_and_light_modules() {
        let url = page_url(
            "https",
            Ipv4Addr::new(192, 168, 1, 5),
            51234,
            &"0123456789abcdef".repeat(4),
        );
        let (size, modules) = qr_modules(&url).unwrap();
        // A QR code is 21 modules on a side plus 4 per version, and has the three finder squares (corners dark).
        assert!(size >= 21 && (size - 21) % 4 == 0, "{size}");
        assert_eq!(modules.len(), size * size);
        assert!(modules.chars().all(|c| c == '0' || c == '1'));
        let at = |x: usize, y: usize| modules.as_bytes()[y * size + x] == b'1';
        assert!(at(0, 0) && at(size - 1, 0) && at(0, size - 1));
        // Too long for any QR code.
        assert_eq!(qr_modules(&"x".repeat(8000)), None);
    }

    #[test]
    fn the_token_is_found_in_a_cookie_among_others_and_compared_whole() {
        let mut h = HeaderMap::new();
        h.insert(
            header::COOKIE,
            HeaderValue::from_static("a=1; novira_token_9=old; novira_token_8123=abc; b=2"),
        );
        // Only the cookie of this server's port counts; another server's on the same host is not this token.
        assert_eq!(cookie_token(&h, &token_cookie(8123)), Some("abc"));
        assert_eq!(cookie_token(&h, &token_cookie(9)), Some("old"));
        assert_eq!(cookie_token(&h, &token_cookie(1)), None);
        assert_eq!(cookie_token(&HeaderMap::new(), &token_cookie(8123)), None);
        assert_eq!(query_token(Some("x=1&token=abc")), Some("abc"));
        assert_eq!(query_token(None), None);
        assert!(same_secret("abc", "abc"));
        assert!(!same_secret("abc", "abd"));
        assert!(!same_secret("abc", "abcd"));
        assert!(!same_secret("", "a"));
    }

    #[test]
    fn every_served_command_is_in_the_shared_layer_and_none_twice() {
        for name in SERVED {
            assert!(
                api::NAMES.contains(name)
                    || *name == "install_model"
                    || *name == "prepare_watermark"
                    || api::PAGE_COMMANDS.contains(name),
                "{name} is not a command of the shared layer"
            );
        }
        let mut sorted = SERVED.to_vec();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), SERVED.len());
    }

    #[test]
    fn loopback_only_is_a_served_subset_of_the_changing_commands() {
        // Every loopback-only name is a served one (a home-network device gets a subset of what this computer does).
        for name in LOOPBACK_ONLY {
            assert!(
                SERVED.contains(name),
                "{name} is loopback-only but not served"
            );
        }
        let mut sorted = LOOPBACK_ONLY.to_vec();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), LOOPBACK_ONLY.len(), "a name is listed twice");
        // The reads and the user's own data a phone needs are reachable from the home network.
        for name in [
            "bootstrap",
            "queue_snapshot",
            "enqueue",
            "cancel_queue_item",
            "update_images",
            "delete_images",
            "create_board",
            "save_comic",
            "save_canvas",
            "save_ui_state",
            "agent_chat",
            "agent_tool_result",
            "agent_cancel",
            "lookup_reference",
        ] {
            assert!(
                !LOOPBACK_ONLY.contains(&name),
                "{name} should reach a phone"
            );
        }
        // Installing or running software, changing the engine, a key, and the assistant's setup stay on this computer.
        for name in [
            "install_node_pack",
            "switch_comfy_version",
            "install_model",
            "delete_model",
            "restart_engine",
            "set_engine_settings",
            "set_hf_token",
            "set_civitai_key",
            "agent_login",
            "agent_endpoint_save",
            "agent_endpoint_test",
        ] {
            assert!(
                LOOPBACK_ONLY.contains(&name),
                "{name} must be loopback-only"
            );
        }
    }
}
