//! The home network of the desktop app: the server of `novira-server` runs inside the app (`novira_server::embed`),
//! with no listener on this computer, and opens its TLS listener for the phones only when the side bar's QR item asks.
//! The window drives it through the commands below, each one fixed route of the server's management (`/lan/*`, the
//! pairing's codes and decisions), so the checks are the ones the browser page of `novira-server` gets.
use novira_core::{Backend, EventSink};
use novira_server::{Embedded, Frontend, Managed};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::http::Method;
use tauri::Manager;

/// The longest id, gateway address or device name a command takes (the routes check the exact shapes).
const MAX_ARG_LEN: usize = 128;

/// The app's server, managed by Tauri once the backend is open.
pub struct HomeNetwork(pub Embedded);

/// Makes the app's server over `backend` and lets it open the home network; the sink it returns carries the backend's
/// events to the paired phones. A CA that cannot be made leaves the home network off (the routes answer 404).
pub fn start(
    app: &tauri::App,
    backend: Backend,
    data: std::path::PathBuf,
    image_base: String,
) -> (HomeNetwork, EventSink) {
    let (server, sink) = tauri::async_runtime::block_on(async {
        novira_server::embed(backend, built_in_files(app.handle().clone()), image_base)
    });
    match novira_server::Ca::load_or_create(&data) {
        Ok(ca) => server.enable_lan(novira_server::Control::new(
            data.clone(),
            ca,
            novira_server::system_probe(),
        )),
        Err(e) => eprintln!("novira: {e}; the home network stays off"),
    }
    // Inside the runtime, so a remote listener that is on opens at once.
    tauri::async_runtime::block_on(async {
        server.enable_remote(novira_server::RemoteControl::new(
            data.clone(),
            novira_server::tailnet_source(data),
        ))
    });
    (HomeNetwork(server), sink)
}

/// The frontend built into the app, for the phones' page. Only a file the build has: the asset resolver itself would
/// answer `index.html` for any other path.
fn built_in_files(handle: tauri::AppHandle) -> Frontend {
    Frontend::Embedded(Arc::new(move |path: &str| {
        let resolver = handle.asset_resolver();
        if !resolver
            .iter()
            .any(|(key, _)| key.trim_start_matches('/') == path)
        {
            return None;
        }
        resolver.get(path.to_string()).map(|asset| asset.bytes)
    }))
}

/// Events for the window and for the phones: a backend has one sink.
pub fn both(window: EventSink, phones: EventSink) -> EventSink {
    Arc::new(move |event| {
        phones(event.clone());
        window(event);
    })
}

fn answer(managed: Managed) -> Value {
    json!({ "status": managed.status, "body": managed.body })
}

fn checked(name: &str, value: &str) -> Result<(), String> {
    if value.len() > MAX_ARG_LEN {
        return Err(format!("{name} is too long"));
    }
    Ok(())
}

/// Runs one management route; before the backend is open there is no server and the answer is 404.
async fn manage(app: &tauri::AppHandle, method: Method, path: &str, body: Option<Value>) -> Value {
    let Some(lan) = app.try_state::<HomeNetwork>() else {
        return json!({ "status": 404, "body": { "code": "no_lan_control", "error": "not started" } });
    };
    answer(lan.0.manage(method, path, body).await)
}

/// `GET /lan/state`: open or closed, the network, the codes, the phones asking and the paired ones.
#[tauri::command]
pub async fn lan_state(app: tauri::AppHandle) -> Value {
    manage(&app, Method::GET, "/lan/state", None).await
}

/// Opens the listener on a trusted network.
#[tauri::command]
pub async fn lan_open(app: tauri::AppHandle) -> Value {
    manage(&app, Method::POST, "/lan/open", None).await
}

#[tauri::command]
pub async fn lan_close(app: tauri::AppHandle) -> Value {
    manage(&app, Method::POST, "/lan/close", None).await
}

/// Trusts the network this computer is on, which the owner saw as `gateway_mac`.
#[tauri::command]
pub async fn lan_trust(
    app: tauri::AppHandle,
    gateway_mac: String,
    label: String,
) -> Result<Value, String> {
    checked("gatewayMac", &gateway_mac)?;
    checked("label", &label)?;
    let body = json!({ "gatewayMac": gateway_mac, "label": label });
    Ok(manage(&app, Method::POST, "/lan/trust", Some(body)).await)
}

#[tauri::command]
pub async fn lan_untrust(app: tauri::AppHandle, gateway_mac: String) -> Result<Value, String> {
    checked("gatewayMac", &gateway_mac)?;
    let body = json!({ "gatewayMac": gateway_mac });
    Ok(manage(&app, Method::POST, "/lan/untrust", Some(body)).await)
}

/// A new pairing code and its QR modules, while the listener is open.
#[tauri::command]
pub async fn lan_pair_code(app: tauri::AppHandle) -> Value {
    manage(&app, Method::POST, novira_server::PAIR_CODE_ROUTE, None).await
}

#[tauri::command]
pub async fn lan_approve(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    decide(&app, novira_server::PAIR_APPROVE_ROUTE, id).await
}

#[tauri::command]
pub async fn lan_deny(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    decide(&app, novira_server::PAIR_DENY_ROUTE, id).await
}

/// Ends a paired phone's session.
#[tauri::command]
pub async fn lan_revoke(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    decide(&app, novira_server::PAIR_REVOKE_ROUTE, id).await
}

async fn decide(app: &tauri::AppHandle, route: &str, id: String) -> Result<Value, String> {
    checked("id", &id)?;
    Ok(manage(app, Method::POST, route, Some(json!({ "id": id }))).await)
}

/// `GET /remote/state`: on or off, open or why not, the tailnet name, the phones asking to enrol, the signed-in ones,
/// the passkeys and the log.
#[tauri::command]
pub async fn remote_state(app: tauri::AppHandle) -> Value {
    manage(&app, Method::GET, novira_server::REMOTE_STATE_ROUTE, None).await
}

/// Turns the remote listener on (kept for the next start) and opens it when Tailscale allows.
#[tauri::command]
pub async fn remote_enable(app: tauri::AppHandle) -> Value {
    manage(&app, Method::POST, novira_server::REMOTE_ENABLE_ROUTE, None).await
}

#[tauri::command]
pub async fn remote_disable(app: tauri::AppHandle) -> Value {
    manage(
        &app,
        Method::POST,
        novira_server::REMOTE_DISABLE_ROUTE,
        None,
    )
    .await
}

/// A pairing code for enrolling a phone, while the remote listener is open.
#[tauri::command]
pub async fn remote_code(app: tauri::AppHandle) -> Value {
    manage(&app, Method::POST, novira_server::REMOTE_CODE_ROUTE, None).await
}

#[tauri::command]
pub async fn remote_approve(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    decide(&app, novira_server::REMOTE_APPROVE_ROUTE, id).await
}

#[tauri::command]
pub async fn remote_deny(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    decide(&app, novira_server::REMOTE_DENY_ROUTE, id).await
}

/// Ends a signed-in phone's session.
#[tauri::command]
pub async fn remote_revoke(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    decide(&app, novira_server::REMOTE_REVOKE_ROUTE, id).await
}

/// Forgets a passkey: that phone can no longer sign in.
#[tauri::command]
pub async fn remote_forget(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    decide(&app, novira_server::REMOTE_FORGET_ROUTE, id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    // tags: boundary
    #[test]
    fn long_arguments_are_refused_at_the_entry() {
        assert!(checked("id", &"a".repeat(MAX_ARG_LEN)).is_ok());
        assert!(checked("id", &"a".repeat(MAX_ARG_LEN + 1)).is_err());
        assert!(checked("id", "").is_ok());
    }

    // tags: condition
    #[test]
    fn both_sinks_get_every_event() {
        use std::sync::atomic::{AtomicUsize, Ordering::SeqCst};
        let (a, b) = (Arc::new(AtomicUsize::new(0)), Arc::new(AtomicUsize::new(0)));
        let (a2, b2) = (a.clone(), b.clone());
        let sink = both(
            Arc::new(move |_| {
                a2.fetch_add(1, SeqCst);
            }),
            Arc::new(move |_| {
                b2.fetch_add(1, SeqCst);
            }),
        );
        sink(novira_core::types::BackendEvent::ProcessorState { is_paused: false });
        assert_eq!((a.load(SeqCst), b.load(SeqCst)), (1, 1));
    }
}
