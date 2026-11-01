//! The server inside the desktop app: its management calls, the page it serves a paired device from the app's own
//! files, and the picture URLs written between the app's scheme and this server's base. Requests of a device run
//! through the real router in process, as in `lan_tests.rs`; the home network is a stand-in on loopback.
use super::*;
use crate::lan_tests::{ask_router, json_of, phone_headers, Bench, HOME, PHONE};
use crate::{Ca, Control, NetworkInfo};
use axum::http::{Request as HttpRequest, StatusCode};
use serde_json::json;

const APP_BASE: &str = "http://novira-image.localhost";
const MAC: crate::Mac = [0x02, 0x11, 0x22, 0x33, 0x44, 0x55];

/// The app's built files: an `index.html` and one script.
fn files() -> Frontend {
    Frontend::Embedded(Arc::new(|path| match path {
        "index.html" => Some(b"<html><head></head><body>app</body></html>".to_vec()),
        "assets/app.js" => Some(b"console.log(1)".to_vec()),
        _ => None,
    }))
}

/// Runs a request built by the test through the router, as if it came on a connection with `ends`.
async fn run(state: &Arc<AppState>, ends: Ends, mut request: Request<Body>) -> (StatusCode, Value) {
    request.extensions_mut().insert(ConnectInfo(ends));
    let response = crate::router(state.clone()).oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), 1 << 20)
        .await
        .unwrap();
    (status, json_of(&String::from_utf8_lossy(&bytes)))
}

struct App {
    server: Embedded,
    backend: Backend,
    _data: tempfile::TempDir,
}

/// The desktop app's server over a backend with the app's picture scheme, its home network on loopback and trusted.
async fn app() -> App {
    let data = tempfile::tempdir().unwrap();
    let backend = novira_core::startup::open_backend(data.path(), APP_BASE.into()).unwrap();
    let (server, sink) = embed(backend.clone(), files(), APP_BASE.into());
    backend.set_event_sink(sink);
    let probe: crate::Probe = Arc::new(|| {
        Some(NetworkInfo {
            address: HOME,
            bind: Ipv4Addr::LOCALHOST,
            gateway_mac: Some(MAC),
            windows_public: Some(false),
        })
    });
    server.enable_lan(Control::new(
        data.path().to_path_buf(),
        Ca::generate().unwrap(),
        probe,
    ));
    App {
        server,
        backend,
        _data: data,
    }
}

impl App {
    async fn post(&self, path: &str, body: Value) -> Managed {
        self.server.manage(Method::POST, path, Some(body)).await
    }

    /// Trusts the network and opens the listener; its port comes back.
    async fn open(&self) -> u16 {
        let trusted = self
            .post(
                "/lan/trust",
                json!({ "gatewayMac": crate::mac_text(&MAC), "label": "home" }),
            )
            .await;
        assert_eq!(trusted.status, 200, "{:?}", trusted.body);
        let opened = self.server.manage(Method::POST, "/lan/open", None).await;
        assert_eq!(opened.status, 200, "{:?}", opened.body);
        let state = self.server.manage(Method::GET, "/lan/state", None).await;
        state.body["port"].as_u64().unwrap() as u16
    }

    async fn device(
        &self,
        port: u16,
        method: &str,
        path: &str,
        headers: &[(&str, &str)],
        body: &str,
    ) -> (StatusCode, axum::http::HeaderMap, String) {
        let ends = Bench::device(PHONE, port, true);
        ask_router(&self.server.state, ends, method, path, headers, body).await
    }

    /// Pairs the phone with a code from `manage` and this computer's approval; its `Cookie` header comes back.
    async fn pair(&self, port: u16) -> String {
        let code = self.post("/pair/code", json!({})).await;
        assert_eq!(code.status, 200, "{:?}", code.body);
        assert_eq!(
            code.body["modules"].as_str().unwrap().len(),
            (code.body["size"].as_u64().unwrap().pow(2)) as usize
        );
        let url = code.body["url"].as_str().unwrap();
        assert!(
            url.starts_with(&format!("https://{HOME}:{port}/pair#")),
            "{url}"
        );
        let secret = url.rsplit_once('#').unwrap().1;
        let headers = phone_headers(port);
        let headers: Vec<(&str, &str)> = headers.iter().map(|(n, v)| (*n, v.as_str())).collect();
        let body = json!({ "code": secret, "label": "phone" }).to_string();
        let (status, _, ticket) = self
            .device(port, "POST", crate::PAIR_REQUEST_ROUTE, &headers, &body)
            .await;
        assert_eq!(status, StatusCode::OK, "{ticket}");
        let state = self.server.manage(Method::GET, "/pair/state", None).await;
        let id = state.body["pending"][0]["id"].as_str().unwrap().to_string();
        assert_eq!(
            self.post("/pair/approve", json!({ "id": id })).await.status,
            200
        );
        let poll = json!({ "poll": json_of(&ticket)["poll"] }).to_string();
        let (_, answer, _) = self
            .device(port, "POST", crate::PAIR_STATUS_ROUTE, &headers, &poll)
            .await;
        let cookie = answer[header::SET_COOKIE].to_str().unwrap();
        cookie.split(';').next().unwrap().to_string()
    }
}

#[tokio::test]
async fn only_the_management_routes_are_run_and_the_listener_waits_for_them() {
    let a = app().await;
    // Nothing listens until the window opens it.
    let state = a.server.manage(Method::GET, "/lan/state", None).await;
    assert_eq!(state.status, 200, "{:?}", state.body);
    assert_eq!(state.body["open"], false);
    assert_eq!(a.post("/pair/code", json!({})).await.status, 404);
    // Anything outside the management routes never reaches the router, whatever it is.
    for path in [
        "/api/bootstrap",
        "/",
        "/events",
        "/ca.crt",
        "/pair",
        "/pair/request",
        "/lanx",
    ] {
        let answer = a.server.manage(Method::POST, path, None).await;
        assert_eq!(answer.status, 404, "{path}");
    }
    // The router's own checks still run: a bad body is refused there.
    let bad = a.post("/pair/approve", json!({ "id": 5 })).await;
    assert_eq!(bad.status, 400, "{:?}", bad.body);
    a.server.stop().await;
}

#[tokio::test]
async fn without_a_control_the_home_network_cannot_be_opened() {
    let data = tempfile::tempdir().unwrap();
    let backend = novira_core::startup::open_backend(data.path(), APP_BASE.into()).unwrap();
    let (server, _) = embed(backend, files(), APP_BASE.into());
    let state = server.manage(Method::GET, "/lan/state", None).await;
    assert_eq!(
        (state.status, state.body["code"].as_str()),
        (404, Some("no_lan_control"))
    );
    server.stop().await;
}

#[tokio::test]
async fn a_paired_phone_gets_the_app_from_the_built_in_files() {
    let a = app().await;
    let port = a.open().await;
    // Unpaired, the app is not shown.
    let (status, _, _) = a.device(port, "GET", "/assets/app.js", &[], "").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let cookie = a.pair(port).await;
    let with = [("cookie", cookie.as_str())];
    let (status, _, page) = a.device(port, "GET", "/", &with, "").await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        page.starts_with("<html><head><script src=\"/novira-server.js\"></script></head>"),
        "{page}"
    );
    let (status, headers, script) = a.device(port, "GET", "/assets/app.js", &with, "").await;
    assert_eq!(
        (status, script.as_str()),
        (StatusCode::OK, "console.log(1)")
    );
    assert!(headers[header::CONTENT_TYPE]
        .to_str()
        .unwrap()
        .starts_with("text/javascript"));
    // No fallback to the page for a file that is not there, and no file of an unknown type.
    for missing in ["/assets/none.js", "/assets/app.exe", "/../index.html"] {
        let (status, _, _) = a.device(port, "GET", missing, &with, "").await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{missing}");
    }
    // The phone's commands run on the app's backend, with this server's picture base.
    let (status, _, boot) = a.device(port, "POST", "/api/bootstrap", &with, "").await;
    assert_eq!(status, StatusCode::OK, "{boot}");
    assert!(!boot.contains(APP_BASE), "{boot}");
    let mut png = Vec::new();
    image::RgbImage::new(8, 8)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .unwrap();
    let ends = Bench::device(PHONE, port, true);
    let upload = HttpRequest::builder()
        .method("POST")
        .uri(crate::UPLOAD_ROUTE)
        .header(header::HOST, format!("{HOME}:{port}"))
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header("cookie", &cookie)
        .body(Body::from(png))
        .unwrap();
    let (status, stored) = run(&a.server.state, ends, upload).await;
    assert_eq!(status, StatusCode::OK, "{stored}");
    let name = stored["name"].as_str().unwrap();
    assert_eq!(stored["url"], format!("/novira-image/full/{name}"));
    a.server.stop().await;
    a.backend.shutdown();
}

#[tokio::test]
async fn closing_from_the_window_ends_the_phone_session() {
    let a = app().await;
    let port = a.open().await;
    let cookie = a.pair(port).await;
    assert_eq!(
        a.server
            .manage(Method::POST, "/lan/close", None)
            .await
            .status,
        200
    );
    let state = a.server.manage(Method::GET, "/lan/state", None).await;
    assert_eq!(state.body["open"], false);
    assert!(state.body["devices"].as_array().unwrap().is_empty());
    let (status, _, _) = a
        .device(
            port,
            "POST",
            "/api/bootstrap",
            &[("cookie", cookie.as_str())],
            "",
        )
        .await;
    assert_ne!(status, StatusCode::OK);
    a.server.stop().await;
}

#[test]
fn picture_urls_are_written_between_the_two_bases() {
    let data = tempfile::tempdir().unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let _inside = rt.enter();
    let backend = novira_core::startup::open_backend(data.path(), APP_BASE.into()).unwrap();
    let (server, _) = embed(backend, files(), format!("{APP_BASE}/"));
    let state = &server.state;
    let mut out = json!({
        "url": format!("{APP_BASE}/full/a.png"),
        "items": [{ "thumbnailUrl": format!("{APP_BASE}/thumb/a.png") }, 3, null],
        "prompt": format!("see {APP_BASE}/full/a.png"),
        "other": "http://novira-image.localhostx/full/a.png",
    });
    to_page(state, &mut out);
    assert_eq!(
        out,
        json!({
            "url": "/novira-image/full/a.png",
            "items": [{ "thumbnailUrl": "/novira-image/thumb/a.png" }, 3, null],
            // Only a string that is a picture URL from its start is written, not text that names one.
            "prompt": format!("see {APP_BASE}/full/a.png"),
            "other": "http://novira-image.localhostx/full/a.png",
        })
    );
    let mut back = json!({ "request": { "initImageUrl": "/novira-image/full/a.png", "x": "/novira-imagex/a" } });
    from_page(state, &mut back);
    assert_eq!(
        back,
        json!({ "request": { "initImageUrl": format!("{APP_BASE}/full/a.png"), "x": "/novira-imagex/a" } })
    );
    let text = format!("[\"{APP_BASE}/full/b.png\"]");
    assert_eq!(text_to_page(state, text), "[\"/novira-image/full/b.png\"]");
    assert_eq!(text_to_page(state, "not json".into()), "not json");
}

#[test]
fn a_backend_with_this_servers_base_is_left_as_it_is() {
    let data = tempfile::tempdir().unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let _inside = rt.enter();
    let backend = crate::open_backend(data.path()).unwrap();
    let (server, _) = embed(backend, files(), IMAGE_URL_BASE.into());
    assert!(server.state.image_base.is_none());
    let mut value = json!({ "url": "/novira-image/full/a.png" });
    from_page(&server.state, &mut value);
    to_page(&server.state, &mut value);
    assert_eq!(value, json!({ "url": "/novira-image/full/a.png" }));
}
