//! The home-network listener on demand: which networks it may open on, opening and closing it from this computer, and
//! closing it by itself.
//!
//! Opening is allowed only on a network this computer's owner confirmed: the network is told by the hardware address of
//! the gateway of the interface that has the home address (`home_network::gateway_mac`), confirmed networks are kept in
//! `<data>/lan-trusted.json` (`trusted.rs`), and an address that cannot be tied to a gateway (not Windows, no gateway,
//! no answer) never opens. Windows calling the network public is only a flag in the state. The listener closes by
//! itself after `LAN_IDLE` with no request from a paired device and no live pairing code or waiting request, and when
//! the network it opened on is gone or no longer trusted; closing ends every connection, event socket and session.
//! This computer reaches it through the `/lan/*` routes (loopback with the token only, like the pairing's management).
use super::*;
use crate::trusted::{self, Mac, Trusted};
use std::sync::Mutex;
use std::time::Instant;

/// How long the listener stays open with nobody using it and nothing being paired.
pub const LAN_IDLE: Duration = Duration::from_secs(30 * 60);
/// How often the server looks at the idle time and at the network.
const MAINTENANCE_EVERY: Duration = Duration::from_secs(30);
/// Where the port of the last listener is kept (a phone's saved page state is per address, port included).
const LAN_PORT_FILE: &str = "server-lan-port";

/// Whether `path` is one of this computer's `/lan/*` routes.
pub fn is_management(path: &str) -> bool {
    path == "/lan" || path.starts_with("/lan/")
}

/// What is known of the network the home address is on.
#[derive(Clone, Debug)]
pub struct NetworkInfo {
    /// This computer's home address.
    pub address: Ipv4Addr,
    /// The address the listener binds (the home address itself; a test binds loopback to stay off the network).
    pub bind: Ipv4Addr,
    /// The hardware address of the gateway, when it could be told.
    pub gateway_mac: Option<Mac>,
    /// Whether Windows calls the network public, when it could be told. A flag for the screen, not a gate.
    pub windows_public: Option<bool>,
}

/// Looks at the network now (it may take a moment: it asks the system and, for a gateway not yet known, the network).
/// `None` when this computer has no home address.
pub type Probe = Arc<dyn Fn() -> Option<NetworkInfo> + Send + Sync>;

/// The real probe: the home address the routing table picks, the gateway behind it, and Windows' view of the network.
pub fn system_probe() -> Probe {
    Arc::new(|| {
        let address = home_network::home_address()?;
        Some(NetworkInfo {
            address,
            bind: address,
            gateway_mac: home_network::gateway_mac(address),
            windows_public: home_network::network_is_public(),
        })
    })
}

/// What opening the listener on demand needs: where the data is, the CA that signs its certificate, how to look at the
/// network, and the networks this computer's owner trusts.
pub struct Control {
    data_dir: PathBuf,
    ca: Ca,
    probe: Probe,
    trusted: Mutex<Trusted>,
}

impl Control {
    pub fn new(data_dir: PathBuf, ca: Ca, probe: Probe) -> Control {
        let trusted = Mutex::new(Trusted::load(&data_dir));
        Control {
            data_dir,
            ca,
            probe,
            trusted,
        }
    }

    pub fn ca(&self) -> &Ca {
        &self.ca
    }

    fn trusted(&self) -> std::sync::MutexGuard<'_, Trusted> {
        self.trusted.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// The port of the last listener of this data folder, if it left one.
    fn remembered_port(&self) -> Option<u16> {
        let port: u16 = std::fs::read_to_string(self.data_dir.join(LAN_PORT_FILE))
            .ok()?
            .trim()
            .parse()
            .ok()?;
        (port != 0).then_some(port)
    }

    /// A failure to write it only loses that sameness.
    fn remember_port(&self, port: u16) {
        let _ = std::fs::write(self.data_dir.join(LAN_PORT_FILE), port.to_string());
    }
}

/// Why the listener did not open.
#[derive(Debug)]
pub enum OpenError {
    /// The server was not started with the home network (`Server::enable_lan`).
    NotEnabled,
    /// This computer has no home address.
    NoNetwork,
    /// The gateway of the network could not be told, so the network cannot be trusted.
    UnknownNetwork,
    /// The network is not one this computer's owner trusts.
    Untrusted { gateway_mac: Mac },
    /// The listener is open already.
    AlreadyOpen,
    /// The listener could not be started.
    Io(std::io::Error),
}

impl std::fmt::Display for OpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpenError::NotEnabled => f.write_str("the home network is not enabled for this server"),
            OpenError::NoNetwork => f.write_str("this computer has no home-network address"),
            OpenError::UnknownNetwork => f.write_str(
                "the gateway of this network could not be told, so it cannot be trusted",
            ),
            OpenError::Untrusted { gateway_mac } => write!(
                f,
                "this network (gateway {}) is not trusted yet",
                trusted::mac_text(gateway_mac)
            ),
            OpenError::AlreadyOpen => f.write_str("the home network is open already"),
            OpenError::Io(e) => write!(f, "cannot open the home network: {e}"),
        }
    }
}

impl AppState {
    pub(crate) fn control(&self) -> Option<Arc<Control>> {
        self.control
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    /// A paired device was heard from (or the listener just opened): the idle time starts again.
    pub(crate) fn note_lan_activity(&self) {
        *self.lan_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
    }

    /// Whether the listener is open and has been unused for `LAN_IDLE`, with no live code or waiting request.
    pub(crate) fn idle_expired(&self, now: Instant) -> bool {
        if self.lan_view().is_none() {
            return false;
        }
        let last = *self.lan_activity.lock().unwrap_or_else(|e| e.into_inner());
        now.saturating_duration_since(last) >= LAN_IDLE && !self.pairing().busy(now)
    }
}

/// Looks at the network on the blocking pool.
async fn probe(control: &Control) -> Option<NetworkInfo> {
    let probe = control.probe.clone();
    tokio::task::spawn_blocking(move || probe())
        .await
        .ok()
        .flatten()
}

/// Opens the listener on the home address when the network it is on is trusted.
pub(crate) async fn open_trusted(state: &Arc<AppState>) -> Result<SocketAddr, OpenError> {
    let control = state.control().ok_or(OpenError::NotEnabled)?;
    let info = probe(&control).await.ok_or(OpenError::NoNetwork)?;
    let mac = info.gateway_mac.ok_or(OpenError::UnknownNetwork)?;
    if !control.trusted().is_trusted(&mac) {
        return Err(OpenError::Untrusted { gateway_mac: mac });
    }
    let preferred = control.remembered_port();
    let options = |port| LanOptions {
        address: info.address,
        bind: info.bind,
        port,
    };
    let mut opened = open_lan(state, control.ca(), options(preferred.unwrap_or(0))).await;
    let taken = |e: &std::io::Error| e.kind() != std::io::ErrorKind::AlreadyExists;
    if preferred.is_some() && opened.as_ref().is_err_and(taken) {
        opened = open_lan(state, control.ca(), options(0)).await;
    }
    match opened {
        Ok(addr) => {
            control.remember_port(addr.port());
            state.note_lan_activity();
            Ok(addr)
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Err(OpenError::AlreadyOpen),
        Err(e) => Err(OpenError::Io(e)),
    }
}

/// Closes the listener when the network it opened on is gone or no longer trusted: the home address changed, or the
/// gateway is known and not trusted. A gateway that cannot be told right now (the neighbour cache expired) does not
/// close it.
pub(crate) async fn recheck_network(state: &Arc<AppState>) {
    let (Some(open), Some(control)) = (state.lan_view(), state.control()) else {
        return;
    };
    let keep = match probe(&control).await {
        None => false,
        Some(info) => {
            info.address == open.address
                && info
                    .gateway_mac
                    .is_none_or(|mac| control.trusted().is_trusted(&mac))
        }
    };
    if !keep {
        close_lan(state).await;
    }
}

/// One look at the listener: closes it when it is idle, or when its network is gone or no longer trusted.
pub(crate) async fn maintain(state: &Arc<AppState>, now: Instant) {
    if state.idle_expired(now) {
        close_lan(state).await;
    } else {
        recheck_network(state).await;
    }
}

/// Runs `maintain` every half minute until the server stops.
pub(crate) async fn watch(state: Arc<AppState>, mut stopped: watch::Receiver<bool>) {
    let mut every = tokio::time::interval(MAINTENANCE_EVERY);
    every.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    every.tick().await;
    loop {
        tokio::select! {
            _ = every.tick() => maintain(&state, Instant::now()).await,
            // Subscribed before the task ran, and waiting for the value itself: a stop that comes first is still seen.
            _ = async { let _ = stopped.wait_for(|stopped| *stopped).await; } => break,
        }
    }
}

fn no_control() -> Response {
    failure(
        StatusCode::NOT_FOUND,
        "no_lan_control",
        "the home network is not enabled for this server",
    )
}

/// The network as `/lan/state` and the answers to `/lan/trust` show it.
fn network_json(control: &Control, info: Option<&NetworkInfo>) -> Value {
    let mac = info.and_then(|i| i.gateway_mac);
    let entry = mac.and_then(|m| control.trusted().entry(&m).cloned());
    json!({
        "gatewayMac": mac.map(|m| trusted::mac_text(&m)),
        "trusted": entry.is_some(),
        "label": entry.map(|e| e.label),
    })
}

/// `GET /lan/state` (this computer only): `{ open, address, port, network: {gatewayMac, trusted, label},
/// windowsPublic, idleSecs, idleLimitSecs, codes, devices, pending, trustedNetworks }`. `address` is the open
/// listener's, else the one it would open on; `gatewayMac` is null when it cannot be told. No secret is in it.
pub(crate) async fn state_route(State(state): State<Arc<AppState>>) -> Response {
    let Some(control) = state.control() else {
        return no_control();
    };
    json_response(StatusCode::OK, &state_json(&state, &control).await)
}

async fn state_json(state: &Arc<AppState>, control: &Control) -> Value {
    let info = probe(control).await;
    let open = state.lan_view();
    let now = Instant::now();
    let idle = open.as_ref().map(|_| {
        let last = *state.lan_activity.lock().unwrap_or_else(|e| e.into_inner());
        now.saturating_duration_since(last).as_secs()
    });
    let pairing = state.pairing().view(now);
    json!({
        "open": open.is_some(),
        "address": open
            .as_ref()
            .map(|o| o.address)
            .or(info.as_ref().map(|i| i.address))
            .map(|a| a.to_string()),
        "port": open.as_ref().map(|o| o.port),
        "network": network_json(control, info.as_ref()),
        "windowsPublic": info.as_ref().and_then(|i| i.windows_public),
        "idleSecs": idle,
        "idleLimitSecs": LAN_IDLE.as_secs(),
        "codes": pairing["codes"],
        "devices": pairing["devices"],
        "pending": pairing["pending"],
        "trustedNetworks": control.trusted().to_json(),
    })
}

/// `POST /lan/open` (this computer only): opens the listener when the network is trusted; answers the state. 409 with
/// `no_home_network`, `unknown_network` or `untrusted_network` (which names the gateway to confirm) otherwise. Opening
/// an open listener changes nothing.
pub(crate) async fn open_route(State(state): State<Arc<AppState>>) -> Response {
    let Some(control) = state.control() else {
        return no_control();
    };
    match open_trusted(&state).await {
        Ok(_) | Err(OpenError::AlreadyOpen) => {
            json_response(StatusCode::OK, &state_json(&state, &control).await)
        }
        Err(OpenError::NotEnabled) => no_control(),
        Err(OpenError::NoNetwork) => failure(
            StatusCode::CONFLICT,
            "no_home_network",
            "this computer has no home-network address",
        ),
        Err(OpenError::UnknownNetwork) => failure(
            StatusCode::CONFLICT,
            "unknown_network",
            "the gateway of this network could not be told, so it cannot be trusted",
        ),
        Err(OpenError::Untrusted { gateway_mac }) => json_response(
            StatusCode::CONFLICT,
            &json!({
                "error": "this network is not trusted yet",
                "code": "untrusted_network",
                "gatewayMac": trusted::mac_text(&gateway_mac),
            }),
        ),
        Err(OpenError::Io(e)) => failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed",
            &format!("cannot open the home network: {e}"),
        ),
    }
}

/// `POST /lan/close` (this computer only): closes the listener; every connection, event socket and session ends and
/// every pairing code is forgotten. Closing a closed listener changes nothing.
pub(crate) async fn close_route(State(state): State<Arc<AppState>>) -> Response {
    if state.control().is_none() {
        return no_control();
    }
    close_lan(&state).await;
    json_response(StatusCode::OK, &json!({ "ok": true, "open": false }))
}

/// `POST /lan/trust` (this computer only): `{gatewayMac, label}`. Trusts the network this computer is on now, which
/// the owner saw as `gatewayMac`; 409 `network_changed` when it is another one by now.
pub(crate) async fn trust_route(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(control) = state.control() else {
        return no_control();
    };
    let body = match pair::read_body(&headers, &body) {
        Ok(body) => body,
        Err(refusal) => return refusal,
    };
    let (mac, label) = match (
        pair::field(&body, "gatewayMac"),
        pair::field(&body, "label"),
    ) {
        (Ok(mac), Ok(label)) => (mac, label),
        (Err(refusal), _) | (_, Err(refusal)) => return refusal,
    };
    let Some(want) = trusted::parse_mac(mac) else {
        return failure(
            StatusCode::BAD_REQUEST,
            "bad_arguments",
            "gatewayMac must be six hex pairs like aa:bb:cc:dd:ee:ff",
        );
    };
    let Some(label) = pair::clean_label(label) else {
        return failure(
            StatusCode::BAD_REQUEST,
            "bad_label",
            "the name must be 1 to 40 plain characters",
        );
    };
    let info = probe(&control).await;
    let Some(info) = info.as_ref() else {
        return failure(
            StatusCode::CONFLICT,
            "no_home_network",
            "this computer has no home-network address",
        );
    };
    match info.gateway_mac {
        None => {
            return failure(
                StatusCode::CONFLICT,
                "unknown_network",
                "the gateway of this network could not be told",
            )
        }
        Some(now) if now != want => {
            return json_response(
                StatusCode::CONFLICT,
                &json!({
                    "error": "the network is not the one that was shown",
                    "code": "network_changed",
                    "gatewayMac": trusted::mac_text(&now),
                }),
            )
        }
        Some(_) => {}
    }
    let saved = {
        let mut trusted = control.trusted();
        if !trusted.is_trusted(&want) && trusted.len() >= trusted::MAX_ENTRIES {
            return failure(
                StatusCode::CONFLICT,
                "too_many",
                "too many trusted networks; remove one first",
            );
        }
        trusted.add(want, &label, chrono::Utc::now().to_rfc3339())
    };
    match saved {
        Ok(()) => json_response(
            StatusCode::OK,
            &json!({ "ok": true, "network": network_json(&control, Some(info)) }),
        ),
        Err(e) => failure(StatusCode::INTERNAL_SERVER_ERROR, "failed", &e),
    }
}

/// `POST /lan/untrust` (this computer only): `{gatewayMac}`. Stops trusting a network; the listener closes at once
/// when it is open on it. 404 `unknown` when it was not trusted.
pub(crate) async fn untrust_route(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(control) = state.control() else {
        return no_control();
    };
    let body = match pair::read_body(&headers, &body) {
        Ok(body) => body,
        Err(refusal) => return refusal,
    };
    let mac = match pair::field(&body, "gatewayMac") {
        Ok(mac) => mac,
        Err(refusal) => return refusal,
    };
    let Some(mac) = trusted::parse_mac(mac) else {
        return failure(
            StatusCode::BAD_REQUEST,
            "bad_arguments",
            "gatewayMac must be six hex pairs like aa:bb:cc:dd:ee:ff",
        );
    };
    let removed = control.trusted().remove(&mac);
    match removed {
        Ok(true) => {
            recheck_network(&state).await;
            json_response(StatusCode::OK, &json!({ "ok": true }))
        }
        Ok(false) => failure(
            StatusCode::NOT_FOUND,
            "unknown",
            "that network is not trusted",
        ),
        Err(e) => failure(StatusCode::INTERNAL_SERVER_ERROR, "failed", &e),
    }
}

#[cfg(test)]
mod tests;
