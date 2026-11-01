//! The server inside the desktop app: no listener on this computer (the window talks to the backend over IPC), only
//! the home-network listener, opened on demand from the window's QR item. The window drives the home network through
//! [`Embedded::manage`], which runs a request of the management routes (`/lan/*` and the pairing's) through the same
//! router and checks as this computer's page of `novira-server` would, so both shells keep one implementation.
//!
//! The app's backend hands out picture URLs of its own scheme, which a phone's browser cannot load: here they are
//! written with this server's base ([`IMAGE_URL_BASE`]) on the way out, and back on the way in.
use crate::{event_feed, lan, new_state, pair, AppState, Ends, Frontend, IMAGE_URL_BASE};
use crate::{MAX_BODY_BYTES, TOKEN_HEADER};
use axum::body::Body;
use axum::extract::connect_info::ConnectInfo;
use axum::http::{header, Method, Request};
use novira_core::{Backend, EventSink};
use serde_json::Value;
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;
use tower::ServiceExt as _;

/// The server of the desktop app. Dropping it does not stop it; call [`Embedded::stop`].
pub struct Embedded {
    state: Arc<AppState>,
}

/// What a management route answered: the HTTP status and its JSON body (`null` when it had none).
#[derive(Clone, Debug, PartialEq)]
pub struct Managed {
    pub status: u16,
    pub body: Value,
}

/// Makes the server of the desktop app over `backend`, whose picture URLs start with `image_base`, serving the page
/// from `frontend` to paired devices. Nothing listens until the home network opens. The returned sink carries the
/// backend's events to the devices' `/events`; the shell calls it beside its own (a backend has one sink). Must run
/// inside the async runtime.
pub fn embed(backend: Backend, frontend: Frontend, image_base: String) -> (Embedded, EventSink) {
    let image_base = image_base.trim_end_matches('/').to_string();
    let image_base = (image_base != IMAGE_URL_BASE).then_some(image_base);
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let state = new_state(backend, frontend, image_base, token);
    let sink = event_feed(&state);
    // Looks at the idle time and the network every half minute; it ends with `stop`.
    tokio::spawn(lan::watch(state.clone(), state.shutdown.subscribe()));
    (Embedded { state }, sink)
}

/// The loopback ends a management request is run with: this computer, as the page of `novira-server` would be.
const HERE: SocketAddr = SocketAddr::new(std::net::IpAddr::V4(Ipv4Addr::LOCALHOST), 0);

impl Embedded {
    /// Enables the home network: with `control` the listener opens on demand on a trusted network (see
    /// [`crate::Server::enable_lan`]).
    pub fn enable_lan(&self, control: lan::Control) {
        *self.state.control.lock().unwrap_or_else(|e| e.into_inner()) = Some(Arc::new(control));
    }

    /// Runs `method path` of the management routes (`/lan/*`, `/pair/code`, `/pair/state`, `/pair/approve`,
    /// `/pair/deny`, `/pair/revoke`) with `body` as its JSON body, as this computer. Any other path answers 404 without
    /// reaching the router.
    pub async fn manage(&self, method: Method, path: &str, body: Option<Value>) -> Managed {
        if !(lan::is_management(path) || pair::is_management(path)) {
            return Managed {
                status: 404,
                body: serde_json::json!({ "error": "not a management route", "code": "unknown" }),
            };
        }
        let mut request = Request::builder()
            .method(method)
            .uri(path)
            .header(header::HOST, format!("{}", HERE))
            .header(TOKEN_HEADER, &self.state.token);
        let body = match body {
            Some(value) => {
                request = request.header(header::CONTENT_TYPE, "application/json");
                Body::from(serde_json::to_vec(&value).unwrap_or_default())
            }
            None => Body::empty(),
        };
        let Ok(mut request) = request.body(body) else {
            return failed("the request could not be built");
        };
        request.extensions_mut().insert(ConnectInfo(Ends {
            local: Some(HERE),
            peer: HERE,
            mask: None,
            tls: false,
        }));
        let Ok(response) = crate::router(self.state.clone()).oneshot(request).await;
        let status = response.status().as_u16();
        let Ok(bytes) = axum::body::to_bytes(response.into_body(), MAX_BODY_BYTES).await else {
            return failed("the answer could not be read");
        };
        Managed {
            status,
            body: serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        }
    }

    /// Closes the home-network listener, when open, and ends the server's tasks.
    pub async fn stop(&self) {
        crate::close_lan(&self.state).await;
        let _ = self.state.shutdown.send(true);
    }
}

fn failed(message: &str) -> Managed {
    Managed {
        status: 500,
        body: serde_json::json!({ "error": message, "code": "failed" }),
    }
}

/// Writes every picture URL of the backend in `value` with this server's base.
pub(crate) fn to_page(state: &AppState, value: &mut Value) {
    if let Some(base) = &state.image_base {
        rebase(value, &format!("{base}/"), &format!("{IMAGE_URL_BASE}/"));
    }
}

/// Writes every picture URL of this server in what a page sent with the backend's base.
pub(crate) fn from_page(state: &AppState, value: &mut Value) {
    if let Some(base) = &state.image_base {
        rebase(value, &format!("{IMAGE_URL_BASE}/"), &format!("{base}/"));
    }
}

/// [`to_page`] on a command's JSON answer.
pub(crate) fn text_to_page(state: &AppState, text: String) -> String {
    if state.image_base.is_none() {
        return text;
    }
    match serde_json::from_str::<Value>(&text) {
        Ok(mut value) => {
            to_page(state, &mut value);
            serde_json::to_string(&value).unwrap_or(text)
        }
        Err(_) => text,
    }
}

/// Replaces the prefix `from` with `to` in every string of `value` that starts with it.
fn rebase(value: &mut Value, from: &str, to: &str) {
    match value {
        Value::String(s) => {
            if let Some(rest) = s.strip_prefix(from) {
                *s = format!("{to}{rest}");
            }
        }
        Value::Array(items) => items.iter_mut().for_each(|v| rebase(v, from, to)),
        Value::Object(map) => map.values_mut().for_each(|v| rebase(v, from, to)),
        _ => {}
    }
}

#[cfg(test)]
mod tests;
