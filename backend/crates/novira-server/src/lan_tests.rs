//! The home-network rules seen from a device: requests run through the real router in process, with the connection's
//! ends set as the accept loop sets them for a phone at `192.168.1.20` that reached this computer's `192.168.1.5`. No
//! socket is opened for the device, so no test listens on the network.
use super::*;
use axum::http::Request as HttpRequest;

pub(crate) const HOME: Ipv4Addr = Ipv4Addr::new(192, 168, 1, 5);
pub(crate) const PHONE: Ipv4Addr = Ipv4Addr::new(192, 168, 1, 20);

/// A server on loopback (its own state is what the router reads) with its data and site folders.
pub(crate) struct Bench {
    pub server: Server,
    _data: tempfile::TempDir,
    _site: tempfile::TempDir,
}

impl Bench {
    pub async fn start() -> Bench {
        let data = tempfile::tempdir().unwrap();
        let site = tempfile::tempdir().unwrap();
        let dist = site.path().join("dist");
        std::fs::create_dir_all(&dist).unwrap();
        std::fs::write(dist.join("index.html"), "<html><head></head></html>").unwrap();
        let backend = open_backend(data.path()).unwrap();
        let server = start(backend, dist, 0).await.unwrap();
        Bench {
            server,
            _data: data,
            _site: site,
        }
    }

    /// The data folder.
    pub fn data(&self) -> &std::path::Path {
        self._data.path()
    }

    /// Opens the home-network listener (bound to loopback, its certificate for `HOME`); its port comes back.
    pub async fn open_lan(&self) -> u16 {
        let ca = Ca::generate().unwrap();
        let options = LanOptions {
            address: HOME,
            bind: Ipv4Addr::LOCALHOST,
            port: 0,
        };
        self.server.open_lan(&ca, options).await.unwrap().port()
    }

    /// The ends of a connection from `peer` to `HOME:port` (`tls`: on the home-network listener).
    pub fn device(peer: Ipv4Addr, port: u16, tls: bool) -> Ends {
        Ends {
            local: Some(SocketAddr::from((HOME, port))),
            peer: SocketAddr::from((peer, 50123)),
            mask: Some(Ipv4Addr::new(255, 255, 255, 0)),
            tls,
        }
    }

    /// One request through the router as if it came on a connection with `ends`; `Host` is the local address.
    pub async fn ask(
        &self,
        ends: Ends,
        method: &str,
        path: &str,
        headers: &[(&str, &str)],
        body: &str,
    ) -> (StatusCode, HeaderMap, String) {
        let host = ends.local.unwrap().to_string();
        let mut request = HttpRequest::builder().method(method).uri(path);
        if !headers.iter().any(|(n, _)| n.eq_ignore_ascii_case("host")) {
            request = request.header(header::HOST, host);
        }
        for (name, value) in headers {
            request = request.header(*name, *value);
        }
        let mut request = request.body(Body::from(body.to_string())).unwrap();
        request.extensions_mut().insert(ConnectInfo(ends));
        let response = router(self.server.state.clone())
            .oneshot(request)
            .await
            .unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = axum::body::to_bytes(response.into_body(), 1 << 20)
            .await
            .unwrap();
        (
            status,
            headers,
            String::from_utf8_lossy(&bytes).into_owned(),
        )
    }

    pub async fn stop(self) {
        self.server.stop().await;
    }
}

#[tokio::test]
async fn a_device_is_answered_only_on_the_tls_listener_and_only_from_the_subnet() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let token = b.server.token.clone();
    let with_token = [(TOKEN_HEADER, token.as_str())];
    // The plain listener never answers another device, whatever it carries.
    let (status, _, _) = b
        .ask(
            Bench::device(PHONE, port, false),
            "GET",
            "/",
            &with_token,
            "",
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    // Another subnet, or a public address, is not the home network.
    for peer in [Ipv4Addr::new(192, 168, 2, 20), Ipv4Addr::new(8, 8, 8, 8)] {
        let (status, _, _) = b
            .ask(Bench::device(peer, port, true), "GET", "/ca.crt", &[], "")
            .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{peer}");
    }
    // A device on the subnet gets the public certificate on the TLS listener.
    let (status, _, body) = b
        .ask(Bench::device(PHONE, port, true), "GET", "/ca.crt", &[], "")
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.starts_with("-----BEGIN CERTIFICATE-----"));
    b.stop().await;
}

#[tokio::test]
async fn a_scanned_qr_code_may_open_only_the_pairing_page_from_another_site() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let device = || Bench::device(PHONE, port, true);
    let navigate = [
        ("sec-fetch-site", "cross-site"),
        ("sec-fetch-mode", "navigate"),
    ];
    let (status, _, _) = b.ask(device(), "GET", "/pair", &navigate, "").await;
    assert_eq!(status, StatusCode::OK);
    // Not a navigation, another route, or another method: still refused.
    let fetch = [("sec-fetch-site", "cross-site"), ("sec-fetch-mode", "cors")];
    for (method, path, headers) in [
        ("GET", "/pair", &fetch),
        ("GET", "/ca.crt", &navigate),
        ("GET", "/pair.js", &navigate),
        ("GET", "/", &navigate),
        ("POST", "/pair", &navigate),
    ] {
        let (status, _, _) = b.ask(device(), method, path, headers, "").await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{method} {path}");
    }
    b.stop().await;
}

/// The ends of this computer's own page on the loopback listener.
pub(crate) fn this_computer(b: &Bench) -> Ends {
    Ends {
        local: Some(b.server.addr),
        peer: SocketAddr::from((Ipv4Addr::LOCALHOST, 50124)),
        mask: None,
        tls: false,
    }
}

/// The headers the phone page's `fetch` sends to the listener on `port`.
fn phone_headers(port: u16) -> Vec<(&'static str, String)> {
    vec![
        ("origin", format!("https://{HOME}:{port}")),
        ("sec-fetch-site", "same-origin".into()),
        ("content-type", "application/json".into()),
    ]
}

pub(crate) fn json_of(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or(Value::Null)
}

impl Bench {
    /// A POST from this computer with the token.
    pub(crate) async fn manage(&self, path: &str, body: &str) -> (StatusCode, Value) {
        let token = self.server.token.clone();
        let (status, _, text) = self
            .ask(
                this_computer(self),
                "POST",
                path,
                &[(TOKEN_HEADER, &token), ("content-type", "application/json")],
                body,
            )
            .await;
        (status, json_of(&text))
    }

    /// What this computer sees of the pairing.
    pub(crate) async fn pair_state(&self) -> Value {
        let token = self.server.token.clone();
        let (_, _, text) = self
            .ask(
                this_computer(self),
                "GET",
                pair::STATE_ROUTE,
                &[(TOKEN_HEADER, &token)],
                "",
            )
            .await;
        json_of(&text)
    }

    /// A new pairing code, as this computer's page gets it.
    pub(crate) async fn code(&self) -> String {
        let (status, link) = self.manage(pair::CODE_ROUTE, "").await;
        assert_eq!(status, StatusCode::OK, "{link}");
        let url = link["url"].as_str().unwrap();
        url.rsplit_once('#').unwrap().1.to_string()
    }

    /// A pairing call from the device at `peer`, with the headers of the phone page.
    pub(crate) async fn phone(
        &self,
        peer: Ipv4Addr,
        port: u16,
        path: &str,
        body: &str,
    ) -> (StatusCode, HeaderMap, String) {
        let headers = phone_headers(port);
        let headers: Vec<(&str, &str)> = headers.iter().map(|(n, v)| (*n, v.as_str())).collect();
        self.ask(
            Bench::device(peer, port, true),
            "POST",
            path,
            &headers,
            body,
        )
        .await
    }

    /// Pairs the device at `peer` all the way and returns its `Cookie` header.
    pub(crate) async fn pair(&self, peer: Ipv4Addr, port: u16) -> String {
        let code = self.code().await;
        let body = json!({ "code": code, "label": "phone" }).to_string();
        let (status, _, ticket) = self.phone(peer, port, pair::REQUEST_ROUTE, &body).await;
        assert_eq!(status, StatusCode::OK, "{ticket}");
        let poll = json_of(&ticket)["poll"].as_str().unwrap().to_string();
        let state = self.pair_state().await;
        let pending = state["pending"].as_array().unwrap();
        let id = pending.last().unwrap()["id"].as_str().unwrap().to_string();
        let (status, _) = self
            .manage(pair::APPROVE_ROUTE, &json!({ "id": id }).to_string())
            .await;
        assert_eq!(status, StatusCode::OK);
        let body = json!({ "poll": poll }).to_string();
        let (status, headers, _) = self.phone(peer, port, pair::STATUS_ROUTE, &body).await;
        assert_eq!(status, StatusCode::OK);
        let cookie = headers[header::SET_COOKIE].to_str().unwrap();
        cookie.split(';').next().unwrap().to_string()
    }

    /// `POST /api/bootstrap` from the device at `peer` with `cookie`.
    pub(crate) async fn bootstrap(&self, peer: Ipv4Addr, port: u16, cookie: &str) -> StatusCode {
        self.ask(
            Bench::device(peer, port, true),
            "POST",
            "/api/bootstrap",
            &[("cookie", cookie)],
            "",
        )
        .await
        .0
    }
}

pub(crate) const OTHER: Ipv4Addr = Ipv4Addr::new(192, 168, 1, 21);

/// A hostile request: its headers, its body, the status it must get.
type Case<'a> = (Vec<(&'a str, &'a str)>, &'a str, StatusCode);

#[tokio::test]
async fn a_device_reaches_the_app_only_with_a_session_never_with_the_token() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let token = b.server.token.clone();
    let device = Bench::device(PHONE, port, true);
    // The start token is no credential from a device, in a header or a cookie.
    let token_cookie_header = format!("{}={token}", token_cookie(port));
    for headers in [
        vec![(TOKEN_HEADER, token.as_str())],
        vec![("cookie", token_cookie_header.as_str())],
    ] {
        let (status, _, _) = b.ask(device, "POST", "/api/bootstrap", &headers, "").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{headers:?}");
    }
    // Opening the app without a session leads to the pairing page, the token in the address too.
    for path in ["/".to_string(), format!("/?token={token}")] {
        let (status, headers, _) = b.ask(device, "GET", &path, &[], "").await;
        assert_eq!(status, StatusCode::SEE_OTHER, "{path}");
        assert_eq!(headers[header::LOCATION], "/pair");
        assert!(headers.get(header::SET_COOKIE).is_none());
    }
    for path in [
        "/index.html",
        "/events",
        "/novira-server.js",
        "/assets/x.js",
    ] {
        let (status, _, _) = b.ask(device, "GET", path, &[], "").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{path}");
    }
    // The public routes need nothing.
    for path in ["/ca.crt", "/pair", "/pair.js"] {
        let (status, _, _) = b.ask(device, "GET", path, &[], "").await;
        assert_eq!(status, StatusCode::OK, "{path}");
    }
    // With a session: the app and the safe commands, and still not the loopback-only ones.
    let cookie = b.pair(PHONE, port).await;
    assert!(cookie.starts_with(&format!("novira_session_{port}=")));
    let with_session = [("cookie", cookie.as_str())];
    let (status, _, _) = b.ask(device, "GET", "/", &with_session, "").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(b.bootstrap(PHONE, port, &cookie).await, StatusCode::OK);
    let (status, _, body) = b
        .ask(device, "POST", "/api/set_hf_token", &with_session, "")
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body.contains("not_available_over_network"), "{body}");
    b.stop().await;
}

#[tokio::test]
async fn a_session_works_only_from_its_address_with_its_exact_secret() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let cookie = b.pair(PHONE, port).await;
    let (name, secret) = cookie.split_once('=').unwrap();
    assert_eq!(b.bootstrap(PHONE, port, &cookie).await, StatusCode::OK);
    // Another device on the same network with the copied cookie.
    assert_eq!(
        b.bootstrap(OTHER, port, &cookie).await,
        StatusCode::UNAUTHORIZED
    );
    // A changed secret, an empty one, the token cookie's name, another port's name.
    let mut near = secret.to_string().into_bytes();
    near[10] = if near[10] == b'0' { b'1' } else { b'0' };
    for bad in [
        format!("{name}={}", String::from_utf8(near).unwrap()),
        format!("{name}="),
        format!("{}={secret}", token_cookie(port)),
        format!("{}={secret}", pair::session_cookie(port ^ 1)),
    ] {
        assert_eq!(
            b.bootstrap(PHONE, port, &bad).await,
            StatusCode::UNAUTHORIZED,
            "{bad}"
        );
    }
    // The session is not the token on this computer either.
    let (status, _, _) = b
        .ask(
            this_computer(&b),
            "POST",
            "/api/bootstrap",
            &[("cookie", &cookie)],
            "",
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    b.stop().await;
}

#[tokio::test]
async fn a_device_cannot_manage_pairing_even_when_paired() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let cookie = b.pair(PHONE, port).await;
    let token = b.server.token.clone();
    let device = Bench::device(PHONE, port, true);
    for (method, path) in [
        ("POST", pair::CODE_ROUTE),
        ("GET", pair::STATE_ROUTE),
        ("POST", pair::APPROVE_ROUTE),
        ("POST", pair::DENY_ROUTE),
        ("POST", pair::REVOKE_ROUTE),
    ] {
        for headers in [
            vec![("cookie", cookie.as_str())],
            vec![(TOKEN_HEADER, token.as_str())],
            vec![],
        ] {
            let (status, _, _) = b.ask(device, method, path, &headers, r#"{"id":"x"}"#).await;
            assert_eq!(status, StatusCode::FORBIDDEN, "{method} {path} {headers:?}");
        }
    }
    // A device's request waits for this computer; it cannot approve itself.
    let code = b.code().await;
    let body = json!({ "code": code, "label": "x" }).to_string();
    let (status, _, _) = b.phone(OTHER, port, pair::REQUEST_ROUTE, &body).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(b.pair_state().await["pending"].as_array().unwrap().len(), 1);
    b.stop().await;
}

#[tokio::test]
async fn pairing_calls_refuse_hostile_requests() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let device = Bench::device(PHONE, port, true);
    let code = b.code().await;
    let good = json!({ "code": code, "label": "phone" }).to_string();
    let own = format!("https://{HOME}:{port}");
    let json_type = ("content-type", "application/json");
    let cases: Vec<Case> = vec![
        // Another origin, the plain scheme, another site's fetch.
        (
            vec![("origin", "https://evil.example"), json_type],
            &good,
            StatusCode::FORBIDDEN,
        ),
        (
            vec![("origin", "http://192.168.1.5"), json_type],
            &good,
            StatusCode::FORBIDDEN,
        ),
        (
            vec![("sec-fetch-site", "cross-site"), json_type],
            &good,
            StatusCode::FORBIDDEN,
        ),
        // A form post, or a body that is not a JSON object with strings.
        (
            vec![("origin", &own), ("content-type", "text/plain")],
            &good,
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
        ),
        (
            vec![("content-type", "application/x-www-form-urlencoded")],
            "code=x",
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
        ),
        (vec![json_type], "[1]", StatusCode::BAD_REQUEST),
        (vec![json_type], "{", StatusCode::BAD_REQUEST),
        (
            vec![json_type],
            r#"{"code":1,"label":"x"}"#,
            StatusCode::BAD_REQUEST,
        ),
        (vec![json_type], r#"{"label":"x"}"#, StatusCode::BAD_REQUEST),
        // Another Host, two Origins.
        (
            vec![("host", "192.168.1.5:1"), json_type],
            &good,
            StatusCode::FORBIDDEN,
        ),
        (
            vec![("origin", &own), ("origin", &own), json_type],
            &good,
            StatusCode::BAD_REQUEST,
        ),
    ];
    for (headers, body, want) in &cases {
        let (status, _, text) = b
            .ask(device, "POST", pair::REQUEST_ROUTE, headers, body)
            .await;
        assert_eq!(status, *want, "{headers:?} {body}: {text}");
    }
    let big = json!({ "code": code, "label": "x".repeat(pair::MAX_BODY) }).to_string();
    let (status, _, _) = b.phone(PHONE, port, pair::REQUEST_ROUTE, &big).await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    // None of that used the code up; once used, another phone gets nothing from it.
    let (status, _, _) = b.phone(PHONE, port, pair::REQUEST_ROUTE, &good).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, text) = b.phone(OTHER, port, pair::REQUEST_ROUTE, &good).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(text.contains("bad_code"), "{text}");
    // The pairing calls are not served on the plain listener, whoever asks.
    let token = b.server.token.clone();
    let (status, _, _) = b
        .ask(
            this_computer(&b),
            "POST",
            pair::REQUEST_ROUTE,
            &[(TOKEN_HEADER, &token), json_type],
            &good,
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    b.stop().await;
}

#[tokio::test]
async fn a_device_gets_five_pairing_requests_a_minute() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let wrong = json!({ "code": "0123", "label": "x" }).to_string();
    for _ in 0..5 {
        let (status, _, _) = b.phone(PHONE, port, pair::REQUEST_ROUTE, &wrong).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
    }
    let code = b.code().await;
    let good = json!({ "code": code, "label": "x" }).to_string();
    let (status, _, text) = b.phone(PHONE, port, pair::REQUEST_ROUTE, &good).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS, "{text}");
    // Another device is not held back.
    let (status, _, _) = b.phone(OTHER, port, pair::REQUEST_ROUTE, &good).await;
    assert_eq!(status, StatusCode::OK);
    b.stop().await;
}

#[tokio::test]
async fn only_the_asking_device_learns_the_outcome_and_a_denial_gives_nothing() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let code = b.code().await;
    let body = json!({ "code": code, "label": "x" }).to_string();
    let (_, _, ticket) = b.phone(PHONE, port, pair::REQUEST_ROUTE, &body).await;
    let poll = json_of(&ticket)["poll"].as_str().unwrap().to_string();
    let status_body = json!({ "poll": poll }).to_string();
    let (status, _, _) = b.phone(OTHER, port, pair::STATUS_ROUTE, &status_body).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "another address");
    let (status, _, _) = b
        .phone(PHONE, port, pair::STATUS_ROUTE, r#"{"poll":"nope"}"#)
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "a wrong secret");
    let id = b.pair_state().await["pending"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let decide = json!({ "id": id }).to_string();
    assert_eq!(b.manage(pair::DENY_ROUTE, &decide).await.0, StatusCode::OK);
    assert_eq!(
        b.manage(pair::APPROVE_ROUTE, &decide).await.0,
        StatusCode::NOT_FOUND,
        "decided once"
    );
    let (status, headers, text) = b.phone(PHONE, port, pair::STATUS_ROUTE, &status_body).await;
    assert_eq!(status, StatusCode::OK);
    assert!(text.contains("denied"), "{text}");
    assert!(headers.get(header::SET_COOKIE).is_none());
    assert_eq!(
        b.manage(pair::APPROVE_ROUTE, r#"{"id":"unknown"}"#).await.0,
        StatusCode::NOT_FOUND
    );
    b.stop().await;
}

#[tokio::test]
async fn revoking_or_closing_ends_a_devices_session() {
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let cookie = b.pair(PHONE, port).await;
    let other = b.pair(OTHER, port).await;
    let id = b.pair_state().await["devices"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let revoke = json!({ "id": id }).to_string();
    assert_eq!(
        b.manage(pair::REVOKE_ROUTE, &revoke).await.0,
        StatusCode::OK
    );
    assert_eq!(
        b.bootstrap(PHONE, port, &cookie).await,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(b.bootstrap(OTHER, port, &other).await, StatusCode::OK);
    assert_eq!(
        b.manage(pair::REVOKE_ROUTE, &revoke).await.0,
        StatusCode::NOT_FOUND
    );
    // Closing the listener ends every session: a device pairs again.
    b.server.close_lan().await;
    assert!(b.pair_state().await["devices"]
        .as_array()
        .unwrap()
        .is_empty());
    assert_eq!(
        b.bootstrap(OTHER, port, &other).await,
        StatusCode::UNAUTHORIZED
    );
    b.stop().await;
}

/// A device's open event socket ends when this computer revokes its session. The connection runs over an in-memory
/// stream with the device's ends, through the same HTTP serving as a real one.
#[tokio::test]
async fn a_revoked_device_loses_its_open_event_socket() {
    use futures_util::StreamExt;
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    let b = Bench::start().await;
    let port = b.open_lan().await;
    let cookie = b.pair(PHONE, port).await;
    let (client, server) = tokio::io::duplex(64 * 1024);
    let app = router(b.server.state.clone());
    tokio::spawn(serve_connection(
        server,
        app,
        Bench::device(PHONE, port, true),
    ));
    let mut request = format!("ws://{HOME}:{port}/events")
        .into_client_request()
        .unwrap();
    request
        .headers_mut()
        .insert("cookie", cookie.parse().unwrap());
    let (mut socket, _) = tokio_tungstenite::client_async(request, client)
        .await
        .unwrap();
    // Open while the session lives (event messages may pass; it does not close).
    let open = tokio::time::timeout(Duration::from_millis(500), async {
        loop {
            match socket.next().await {
                Some(Ok(m)) if !m.is_close() => {}
                other => return other,
            }
        }
    })
    .await;
    assert!(open.is_err(), "the socket stays open: {open:?}");
    let id = b.pair_state().await["devices"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let revoke = json!({ "id": id }).to_string();
    assert_eq!(
        b.manage(pair::REVOKE_ROUTE, &revoke).await.0,
        StatusCode::OK
    );
    let ended = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            match socket.next().await {
                None | Some(Err(_)) => break,
                Some(Ok(m)) if m.is_close() => break,
                Some(Ok(_)) => {}
            }
        }
    })
    .await;
    assert!(ended.is_ok(), "the socket ends at the revocation");
    b.stop().await;
}
