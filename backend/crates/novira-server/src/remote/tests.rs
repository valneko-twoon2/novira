//! The remote listener seen from a phone on the tailnet: requests run through the real router in process, with the
//! connection's ends set as the accept loop sets them for a phone at `100.88.1.2` that reached this computer's
//! `100.101.102.103`; Tailscale is a pretend one that names this computer and signs its own certificates. The listener
//! itself binds loopback, so no test listens on a network.
use super::passkey::tests::Authenticator;
use super::*;
use crate::lan_tests::{json_of, this_computer, Bench};
use rustls::pki_types::CertificateDer;
use std::sync::atomic::{AtomicUsize, Ordering::SeqCst};

const TAILNET: Ipv4Addr = Ipv4Addr::new(100, 101, 102, 103);
const NAME: &str = "pc.tail1234.ts.net";
const PHONE: Ipv4Addr = Ipv4Addr::new(100, 88, 1, 2);
const OTHER: Ipv4Addr = Ipv4Addr::new(100, 88, 1, 3);

fn here() -> Tailnet {
    Tailnet {
        address: TAILNET,
        name: NAME.into(),
    }
}

/// A certificate for `name` signed by itself, and its DER (for a client that trusts it).
fn self_signed(name: &str) -> (Certified, CertificateDer<'static>) {
    let key = rcgen::KeyPair::generate().unwrap();
    let cert = rcgen::CertificateParams::new(vec![name.to_string()])
        .unwrap()
        .self_signed(&key)
        .unwrap();
    let der = cert.der().clone();
    let certified = Certified {
        chain: vec![der.clone()],
        key: rustls::pki_types::PrivateKeyDer::Pkcs8(key.serialize_der().into()),
    };
    (certified, der)
}

/// A server with the remote listener enabled over a pretend Tailscale.
struct Away {
    bench: Bench,
    status: Arc<Mutex<Result<Tailnet, Problem>>>,
    certs: Arc<AtomicUsize>,
    last_cert: Arc<Mutex<Option<CertificateDer<'static>>>>,
}

impl Away {
    async fn start() -> Away {
        let bench = Bench::start().await;
        let status = Arc::new(Mutex::new(Ok(here())));
        let certs = Arc::new(AtomicUsize::new(0));
        let last_cert = Arc::new(Mutex::new(None));
        let (s, c, l) = (status.clone(), certs.clone(), last_cert.clone());
        let source = Source {
            status: Arc::new(move || s.lock().unwrap().clone()),
            certify: Arc::new(move |name: &str| {
                c.fetch_add(1, SeqCst);
                let (certified, der) = self_signed(name);
                *l.lock().unwrap() = Some(der);
                Ok(certified)
            }),
            bind: Some(Ipv4Addr::LOCALHOST),
        };
        bench
            .server
            .enable_remote(Control::new(bench.data().to_path_buf(), source));
        Away {
            bench,
            status,
            certs,
            last_cert,
        }
    }

    fn state(&self) -> &Arc<AppState> {
        &self.bench.server.state
    }

    async fn manage(&self, path: &str, body: &str) -> (StatusCode, Value) {
        self.bench.manage(path, body).await
    }

    async fn on(&self) -> Value {
        let (status, state) = self.manage(ENABLE_ROUTE, "").await;
        assert_eq!(status, StatusCode::OK, "{state}");
        state
    }

    async fn remote_state(&self) -> Value {
        let token = self.bench.server.token.clone();
        let (_, _, text) = self
            .bench
            .ask(
                this_computer(&self.bench),
                "GET",
                STATE_ROUTE,
                &[(TOKEN_HEADER, &token)],
                "",
            )
            .await;
        json_of(&text)
    }

    fn port(&self) -> u16 {
        self.state()
            .remote_view()
            .expect("the remote listener is open")
            .port
    }

    fn origin(&self) -> String {
        format!("https://{NAME}:{}", self.port())
    }

    /// The ends of a connection from `peer` to this computer's tailnet address on the remote listener.
    fn ends(&self, peer: Ipv4Addr) -> Ends {
        Ends {
            local: Some(SocketAddr::from((TAILNET, self.port()))),
            peer: SocketAddr::from((peer, 50200)),
            mask: None,
            listener: Listener::Remote,
        }
    }

    /// A request from the phone at `peer` with the headers its page's `fetch` sends (and `cookie`, when given).
    async fn phone(
        &self,
        peer: Ipv4Addr,
        method: &str,
        path: &str,
        body: &str,
        cookie: Option<&str>,
    ) -> (StatusCode, HeaderMap, String) {
        let (host, origin) = (format!("{NAME}:{}", self.port()), self.origin());
        let mut headers = vec![
            ("host", host.as_str()),
            ("origin", origin.as_str()),
            ("sec-fetch-site", "same-origin"),
            ("content-type", "application/json"),
        ];
        if let Some(cookie) = cookie {
            headers.push(("cookie", cookie));
        }
        self.bench
            .ask(self.ends(peer), method, path, &headers, body)
            .await
    }

    async fn post(
        &self,
        peer: Ipv4Addr,
        path: &str,
        body: Value,
        cookie: Option<&str>,
    ) -> (StatusCode, Value, Option<String>) {
        let (status, headers, text) = self
            .phone(peer, "POST", path, &body.to_string(), cookie)
            .await;
        let cookie = headers
            .get(header::SET_COOKIE)
            .and_then(|v| v.to_str().ok())
            .map(|c| c.split(';').next().unwrap().to_string());
        (status, json_of(&text), cookie)
    }

    fn party_origin(&self) -> String {
        self.origin()
    }

    /// Pairs the phone at `peer` on the remote listener (a code from this computer, its approval) and returns the
    /// session cookie that may make a passkey.
    async fn pair(&self, peer: Ipv4Addr) -> String {
        let (status, code) = self.manage(CODE_ROUTE, "").await;
        assert_eq!(status, StatusCode::OK, "{code}");
        let url = code["url"].as_str().unwrap();
        assert!(
            url.starts_with(&format!("{}/remote#", self.origin())),
            "{url}"
        );
        let code = url.rsplit_once('#').unwrap().1;
        let (status, ticket, _) = self
            .post(
                peer,
                pair::REQUEST_ROUTE,
                json!({ "code": code, "label": "iPhone" }),
                None,
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{ticket}");
        let pending = self.remote_state().await["pending"].clone();
        let id = pending[0]["id"].as_str().unwrap().to_string();
        let (status, _) = self
            .manage(APPROVE_ROUTE, &json!({ "id": id }).to_string())
            .await;
        assert_eq!(status, StatusCode::OK);
        let (status, _, cookie) = self
            .post(
                peer,
                pair::STATUS_ROUTE,
                json!({ "poll": ticket["poll"] }),
                None,
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        cookie.expect("the session cookie")
    }

    /// Makes a passkey with `phone` in the session `cookie`; the answer of `/remote/enrol/finish`.
    async fn make_passkey(
        &self,
        peer: Ipv4Addr,
        cookie: &str,
        phone: &Authenticator,
    ) -> (StatusCode, Value) {
        let (status, options, _) = self
            .post(peer, ENROL_BEGIN_ROUTE, json!({}), Some(cookie))
            .await;
        if status != StatusCode::OK {
            return (status, options);
        }
        assert_eq!(options["rpId"], NAME);
        assert_eq!(options["userName"], "novira (iPhone)");
        let challenge = passkey::decode(options["challenge"].as_str().unwrap()).unwrap();
        let origin = self.party_origin();
        let made = phone.create(
            passkey::Party {
                rp_id: NAME,
                origin: &origin,
            },
            &challenge,
        );
        let body = json!({
            "id": passkey::encode(&made.id),
            "clientDataJSON": passkey::encode(&made.client_data),
            "authenticatorData": passkey::encode(&made.auth_data),
            "publicKey": passkey::encode(&made.spki),
            "algorithm": passkey::ES256,
        });
        let (status, answer, _) = self
            .post(peer, ENROL_FINISH_ROUTE, body, Some(cookie))
            .await;
        (status, answer)
    }

    /// The body of a sign-in by `phone` for a challenge `peer` asked for now.
    async fn sign_in_body(&self, peer: Ipv4Addr, phone: &mut Authenticator) -> Value {
        let (status, options, _) = self.post(peer, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
        assert_eq!(status, StatusCode::OK, "{options}");
        assert_eq!(options["rpId"], NAME);
        let challenge = passkey::decode(options["challenge"].as_str().unwrap()).unwrap();
        let origin = self.party_origin();
        let signed = phone.get(
            passkey::Party {
                rp_id: NAME,
                origin: &origin,
            },
            &challenge,
        );
        json!({
            "id": passkey::encode(&phone.id),
            "clientDataJSON": passkey::encode(&signed.client_data),
            "authenticatorData": passkey::encode(&signed.auth_data),
            "signature": passkey::encode(&signed.signature),
        })
    }

    async fn sign_in(
        &self,
        peer: Ipv4Addr,
        phone: &mut Authenticator,
    ) -> (StatusCode, Option<String>) {
        let body = self.sign_in_body(peer, phone).await;
        let (status, _, cookie) = self.post(peer, SIGN_IN_FINISH_ROUTE, body, None).await;
        (status, cookie)
    }

    async fn bootstrap(&self, peer: Ipv4Addr, cookie: &str) -> StatusCode {
        self.phone(peer, "POST", "/api/bootstrap", "", Some(cookie))
            .await
            .0
    }

    /// A phone at `PHONE` enrolled with a passkey, its session revoked: it can only sign in now.
    async fn enrolled(&self) -> Authenticator {
        let phone = Authenticator::new();
        let cookie = self.pair(PHONE).await;
        let (status, answer) = self.make_passkey(PHONE, &cookie, &phone).await;
        assert_eq!(status, StatusCode::OK, "{answer}");
        let devices = self.remote_state().await["devices"].clone();
        for d in devices.as_array().unwrap() {
            self.manage(REVOKE_ROUTE, &json!({ "id": d["id"] }).to_string())
                .await;
        }
        assert_eq!(
            self.bootstrap(PHONE, &cookie).await,
            StatusCode::UNAUTHORIZED
        );
        phone
    }

    async fn stop(self) {
        self.bench.stop().await;
    }
}

#[tokio::test]
async fn turning_it_on_opens_it_on_the_tailnet_and_off_closes_it() {
    let a = Away::start().await;
    let off = a.remote_state().await;
    assert_eq!(
        (off["enabled"].as_bool(), off["open"].as_bool()),
        (Some(false), Some(false))
    );
    let on = a.on().await;
    assert_eq!(on["open"], true, "{on}");
    assert_eq!(on["name"], NAME);
    assert_eq!(on["url"], format!("https://{NAME}:{}/", a.port()));
    assert_eq!(on["problem"], Value::Null);
    assert_eq!(a.certs.load(SeqCst), 1);
    // Kept for the next start.
    assert!(store::Store::load(a.bench.data()).enabled);
    let port = a.port();
    let (status, off) = a.manage(DISABLE_ROUTE, "").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        (off["enabled"].as_bool(), off["open"].as_bool()),
        (Some(false), Some(false))
    );
    assert!(!store::Store::load(a.bench.data()).enabled);
    // The port is free again.
    tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, port))
        .await
        .unwrap();
    a.stop().await;
}

#[tokio::test]
async fn a_problem_with_tailscale_is_named_and_it_opens_once_fixed() {
    let a = Away::start().await;
    for (problem, code) in [
        (Problem::Missing, "tailscale_missing"),
        (Problem::Stopped, "tailscale_stopped"),
        (Problem::NoHttps, "https_disabled"),
    ] {
        *a.status.lock().unwrap() = Err(problem);
        let on = a.on().await;
        assert_eq!(
            (on["open"].as_bool(), on["problem"].as_str()),
            (Some(false), Some(code))
        );
    }
    *a.status.lock().unwrap() = Err(Problem::Failed("it broke".into()));
    let on = a.on().await;
    assert_eq!(
        (on["problem"].as_str(), on["detail"].as_str()),
        (Some("failed"), Some("it broke"))
    );
    // Fixed: the next look opens it.
    *a.status.lock().unwrap() = Ok(here());
    maintain(a.state()).await;
    let state = a.remote_state().await;
    assert_eq!(
        (state["open"].as_bool(), &state["problem"]),
        (Some(true), &Value::Null)
    );
    // Tailscale stops, or this computer's name changes: it closes, and opens again on the next look once it is back.
    *a.status.lock().unwrap() = Err(Problem::Stopped);
    maintain(a.state()).await;
    let state = a.remote_state().await;
    assert_eq!(
        (state["open"].as_bool(), state["problem"].as_str()),
        (Some(false), Some("tailscale_stopped"))
    );
    *a.status.lock().unwrap() = Ok(here());
    maintain(a.state()).await;
    assert!(a.state().remote_view().is_some());
    *a.status.lock().unwrap() = Ok(Tailnet {
        address: TAILNET,
        name: "renamed.tail1234.ts.net".into(),
    });
    maintain(a.state()).await;
    assert!(a.state().remote_view().is_none());
    maintain(a.state()).await;
    assert_eq!(
        a.state().remote_view().unwrap().name,
        "renamed.tail1234.ts.net"
    );
    a.stop().await;
}

#[tokio::test]
async fn only_tailnet_addresses_that_name_the_listener_are_answered() {
    let a = Away::start().await;
    a.on().await;
    let port = a.port();
    let (status, _, page) = a.phone(PHONE, "GET", PAGE_ROUTE, "", None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(page.contains("/remote.js"));
    let (status, _, script) = a.phone(PHONE, "GET", SCRIPT_ROUTE, "", None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(!script.contains("__STRINGS__"));
    // A peer off the tailnet, or this listener reached on another address.
    for peer in [
        Ipv4Addr::new(192, 168, 1, 20),
        Ipv4Addr::new(8, 8, 8, 8),
        Ipv4Addr::new(100, 128, 0, 1),
    ] {
        let (status, _, _) = a.phone(peer, "GET", PAGE_ROUTE, "", None).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{peer}");
    }
    let mut lan_side = a.ends(PHONE);
    lan_side.local = Some(SocketAddr::from((Ipv4Addr::new(192, 168, 1, 5), port)));
    let host = format!("{NAME}:{port}");
    let (status, _, _) = a
        .bench
        .ask(lan_side, "GET", PAGE_ROUTE, &[("host", &host)], "")
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    // Another name, the bare address, another port.
    for host in [
        format!("{TAILNET}:{port}"),
        format!("evil.example:{port}"),
        format!("{NAME}:{}", port + 1),
        NAME.to_string(),
    ] {
        let (status, _, _) = a
            .bench
            .ask(a.ends(PHONE), "GET", PAGE_ROUTE, &[("host", &host)], "")
            .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{host}");
    }
    // Another origin.
    let origin = format!("http://{NAME}:{port}");
    let (status, _, _) = a
        .bench
        .ask(
            a.ends(PHONE),
            "POST",
            SIGN_IN_BEGIN_ROUTE,
            &[("host", &host), ("origin", &origin)],
            "",
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    // A scanned QR code may open the page from another site; nothing else may.
    let navigate = [
        ("host", host.as_str()),
        ("sec-fetch-site", "cross-site"),
        ("sec-fetch-mode", "navigate"),
    ];
    let (status, _, _) = a
        .bench
        .ask(a.ends(PHONE), "GET", PAGE_ROUTE, &navigate, "")
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, _) = a.bench.ask(a.ends(PHONE), "GET", "/", &navigate, "").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    a.stop().await;
}

#[tokio::test]
async fn a_phone_without_a_session_is_sent_to_sign_in_and_gets_nothing_else() {
    let a = Away::start().await;
    a.on().await;
    let (status, headers, _) = a.phone(PHONE, "GET", "/", "", None).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    assert_eq!(headers[header::LOCATION], PAGE_ROUTE);
    for (method, path) in [
        ("POST", "/api/bootstrap"),
        ("GET", "/events"),
        ("GET", "/ca.crt"),
        ("GET", "/pair"),
        ("GET", "/pair.js"),
        ("POST", ENROL_BEGIN_ROUTE),
        ("POST", ENROL_FINISH_ROUTE),
        ("GET", "/novira-image/full/x.png"),
    ] {
        let (status, _, _) = a.phone(PHONE, method, path, "{}", None).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{method} {path}");
    }
    // The start token is no credential here.
    let token = a.bench.server.token.clone();
    let (status, _, _) = a
        .phone(
            PHONE,
            "POST",
            "/api/bootstrap",
            "",
            Some(&format!("{}={token}", token_cookie(a.port()))),
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    a.stop().await;
}

#[tokio::test]
async fn its_management_is_this_computers_only() {
    let a = Away::start().await;
    a.on().await;
    let cookie = a.pair(PHONE).await;
    let token = a.bench.server.token.clone();
    let token_cookie = format!("{}={token}", token_cookie(a.port()));
    for path in [
        STATE_ROUTE,
        ENABLE_ROUTE,
        DISABLE_ROUTE,
        CODE_ROUTE,
        APPROVE_ROUTE,
        DENY_ROUTE,
        REVOKE_ROUTE,
        FORGET_ROUTE,
    ] {
        for cookie in [Some(cookie.as_str()), Some(token_cookie.as_str()), None] {
            let (status, _, _) = a.phone(PHONE, "POST", path, "{\"id\":\"x\"}", cookie).await;
            assert_eq!(status, StatusCode::FORBIDDEN, "{path} {cookie:?}");
        }
    }
    // This computer without the token is not let in either.
    let (status, _, _) = a
        .bench
        .ask(this_computer(&a.bench), "GET", STATE_ROUTE, &[], "")
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    a.stop().await;
}

#[tokio::test]
async fn a_paired_phone_makes_one_passkey_and_signs_in_with_it_later() {
    let a = Away::start().await;
    a.on().await;
    let phone = Authenticator::new();
    let cookie = a.pair(PHONE).await;
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::OK);
    let (status, answer) = a.make_passkey(PHONE, &cookie, &phone).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    // One passkey per approval.
    let (status, answer) = a.make_passkey(PHONE, &cookie, &Authenticator::new()).await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::FORBIDDEN, Some("not_enrolling"))
    );
    let state = a.remote_state().await;
    let passkeys = state["passkeys"].as_array().unwrap();
    assert_eq!(passkeys.len(), 1);
    assert_eq!(passkeys[0]["label"], "iPhone");
    assert_eq!(state["log"][0]["what"], "enrolled");
    assert!(
        !state.to_string().contains(&passkey::encode(&phone.point())),
        "no key material on the screen"
    );
    // Later, from the same phone: its passkey signs it in.
    let mut phone = phone;
    for d in state["devices"].as_array().unwrap() {
        a.manage(REVOKE_ROUTE, &json!({ "id": d["id"] }).to_string())
            .await;
    }
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::UNAUTHORIZED);
    let (status, signed_in) = a.sign_in(PHONE, &mut phone).await;
    assert_eq!(status, StatusCode::OK);
    let signed_in = signed_in.expect("a session cookie");
    assert_eq!(a.bootstrap(PHONE, &signed_in).await, StatusCode::OK);
    let state = a.remote_state().await;
    assert_eq!(state["log"][0]["what"], "signedIn");
    assert_eq!(state["log"][0]["peer"], PHONE.to_string());
    assert!(state["passkeys"][0]["lastUsedAt"].is_string());
    assert_eq!(state["devices"].as_array().unwrap().len(), 1);
    // A session that signed in may not make a passkey.
    let (status, _) = a
        .make_passkey(PHONE, &signed_in, &Authenticator::new())
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    a.stop().await;
}

#[tokio::test]
async fn a_passkey_that_does_not_check_out_is_not_kept_and_the_session_may_try_again() {
    let a = Away::start().await;
    a.on().await;
    let cookie = a.pair(PHONE).await;
    let (_, options, _) = a
        .post(PHONE, ENROL_BEGIN_ROUTE, json!({}), Some(&cookie))
        .await;
    let challenge = passkey::decode(options["challenge"].as_str().unwrap()).unwrap();
    let phone = Authenticator::new();
    // Made for another origin.
    let made = phone.create(
        passkey::Party {
            rp_id: NAME,
            origin: "https://evil.example",
        },
        &challenge,
    );
    let body = json!({
        "id": passkey::encode(&made.id),
        "clientDataJSON": passkey::encode(&made.client_data),
        "authenticatorData": passkey::encode(&made.auth_data),
        "publicKey": passkey::encode(&made.spki),
        "algorithm": passkey::ES256,
    });
    let (status, answer, _) = a
        .post(PHONE, ENROL_FINISH_ROUTE, body.clone(), Some(&cookie))
        .await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::BAD_REQUEST, Some("refused"))
    );
    // The challenge is used up either way.
    let (status, _, _) = a.post(PHONE, ENROL_FINISH_ROUTE, body, Some(&cookie)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    // Hostile bodies.
    for bad in [
        json!({}),
        json!({ "id": "***", "clientDataJSON": "", "authenticatorData": "", "publicKey": "" }),
        json!({ "id": "", "clientDataJSON": "", "authenticatorData": "", "publicKey": "" }),
    ] {
        let (status, _, _) = a
            .post(PHONE, ENROL_FINISH_ROUTE, bad.clone(), Some(&cookie))
            .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");
    }
    let (status, _, _) = a
        .phone(
            PHONE,
            "POST",
            ENROL_FINISH_ROUTE,
            &"x".repeat(MAX_BODY + 1),
            Some(&cookie),
        )
        .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert!(a.remote_state().await["passkeys"]
        .as_array()
        .unwrap()
        .is_empty());
    // The session can still make one.
    let (status, answer) = a.make_passkey(PHONE, &cookie, &phone).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    a.stop().await;
}

#[tokio::test]
async fn a_sign_in_is_refused_for_an_unknown_passkey_another_address_a_used_challenge_or_a_bad_signature(
) {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    // A passkey this computer never kept.
    let mut stranger = Authenticator::new();
    assert_eq!(
        a.sign_in(PHONE, &mut stranger).await,
        (StatusCode::FORBIDDEN, None)
    );
    // The challenge was given to another address: refused there, and still good for the address that asked.
    let body = a.sign_in_body(PHONE, &mut phone).await;
    let (status, _, _) = a
        .post(OTHER, SIGN_IN_FINISH_ROUTE, body.clone(), None)
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _, _) = a
        .post(PHONE, SIGN_IN_FINISH_ROUTE, body.clone(), None)
        .await;
    assert_eq!(status, StatusCode::OK);
    // A good sign-in, replayed.
    let (status, _, cookie) = a.post(PHONE, SIGN_IN_FINISH_ROUTE, body, None).await;
    assert_eq!((status, cookie), (StatusCode::FORBIDDEN, None));
    // A signature that does not verify is logged.
    let mut body = a.sign_in_body(PHONE, &mut phone).await;
    let mut signature = passkey::decode(body["signature"].as_str().unwrap()).unwrap();
    let last = signature.len() - 1;
    signature[last] ^= 1;
    body["signature"] = passkey::encode(&signature).into();
    let (status, _, _) = a.post(PHONE, SIGN_IN_FINISH_ROUTE, body, None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(a.remote_state().await["log"][0]["what"], "refused");
    a.stop().await;
}

#[tokio::test]
async fn a_session_works_only_from_the_address_that_signed_in() {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    let cookie = cookie.unwrap();
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::OK);
    assert_eq!(a.bootstrap(OTHER, &cookie).await, StatusCode::UNAUTHORIZED);
    a.stop().await;
}

#[tokio::test]
async fn forgetting_a_passkey_ends_its_sessions_and_it_cannot_sign_in_again() {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    let cookie = cookie.unwrap();
    let id = a.remote_state().await["passkeys"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let (status, _) = a
        .manage(FORGET_ROUTE, &json!({ "id": id }).to_string())
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(a.bootstrap(PHONE, &cookie).await, StatusCode::UNAUTHORIZED);
    assert_eq!(a.sign_in(PHONE, &mut phone).await.0, StatusCode::FORBIDDEN);
    let (status, _) = a
        .manage(FORGET_ROUTE, &json!({ "id": id }).to_string())
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(store::Store::load(a.bench.data()).passkeys.is_empty());
    a.stop().await;
}

#[tokio::test]
async fn a_signed_in_phone_runs_what_a_phone_at_home_runs_and_nothing_more() {
    let a = Away::start().await;
    a.on().await;
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    let cookie = cookie.unwrap();
    for name in [
        "set_hf_token",
        "install_node_pack",
        "restart_engine",
        "agent_login",
    ] {
        let (status, _, text) = a
            .phone(PHONE, "POST", &format!("/api/{name}"), "{}", Some(&cookie))
            .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{name}");
        assert_eq!(json_of(&text)["code"], "not_available_over_network");
    }
    let (status, _, _) = a
        .phone(PHONE, "POST", "/api/queue_snapshot", "", Some(&cookie))
        .await;
    assert_eq!(status, StatusCode::OK);
    a.stop().await;
}

#[tokio::test]
async fn asking_for_challenges_too_often_is_refused() {
    let a = Away::start().await;
    a.on().await;
    for i in 0..CEREMONIES_PER_WINDOW {
        let (status, _, _) = a.post(PHONE, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
        assert_eq!(status, StatusCode::OK, "{i}");
    }
    let (status, answer, _) = a.post(PHONE, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::TOO_MANY_REQUESTS, Some("rate_limited"))
    );
    // Another address has its own count.
    let (status, _, _) = a.post(OTHER, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
    assert_eq!(status, StatusCode::OK);
    a.stop().await;
}

#[tokio::test]
async fn pairing_at_home_and_away_are_apart() {
    let a = Away::start().await;
    a.on().await;
    a.bench.open_lan().await;
    // A home-network code is no use on the remote listener.
    let home_code = a.bench.code().await;
    let (status, answer, _) = a
        .post(
            PHONE,
            pair::REQUEST_ROUTE,
            json!({ "code": home_code, "label": "x" }),
            None,
        )
        .await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::FORBIDDEN, Some("bad_code"))
    );
    // Closing the home network leaves a remote session alone.
    let mut phone = a.enrolled().await;
    let (_, cookie) = a.sign_in(PHONE, &mut phone).await;
    a.bench.server.close_lan().await;
    assert_eq!(a.bootstrap(PHONE, &cookie.unwrap()).await, StatusCode::OK);
    a.stop().await;
}

#[tokio::test]
async fn it_turns_itself_off_after_two_weeks_unused() {
    let a = Away::start().await;
    a.on().await;
    let control = a.state().remote_control().unwrap();
    control.store().enabled_at =
        Some((Utc::now() - chrono::Duration::days(store::UNUSED_DAYS)).to_rfc3339());
    maintain(a.state()).await;
    let state = a.remote_state().await;
    assert_eq!(
        (state["enabled"].as_bool(), state["open"].as_bool()),
        (Some(false), Some(false))
    );
    assert!(!store::Store::load(a.bench.data()).enabled);
    a.stop().await;
}

#[tokio::test]
async fn a_fresh_certificate_is_asked_for_once_a_day() {
    let a = Away::start().await;
    a.on().await;
    maintain(a.state()).await;
    assert_eq!(a.certs.load(SeqCst), 1, "not before a day");
    if let Some(open) = a.state().remote.lock().unwrap().as_mut() {
        open.fetched = Instant::now().checked_sub(CERT_REFRESH).unwrap();
    }
    maintain(a.state()).await;
    assert_eq!(a.certs.load(SeqCst), 2);
    assert!(a.state().remote_view().is_some(), "it stays open");
    a.stop().await;
}

#[test]
fn the_phone_page_has_the_same_strings_in_japanese_and_english() {
    crate::pair::tests::check_page_strings(STRINGS, include_str!("page.js"));
    let page = include_str!("page.html");
    assert!(page.contains("<script src=\"/remote.js\"></script>"));
    assert_eq!(script_source().matches("__STRINGS__").count(), 0);
}

/// A real TLS client on loopback: the listener shows the certificate Tailscale gave for its name, and answers its page.
#[tokio::test]
async fn the_listener_speaks_tls_with_the_tailnet_certificate() {
    use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};
    let a = Away::start().await;
    a.on().await;
    let port = a.port();
    let mut roots = rustls::RootCertStore::empty();
    roots
        .add(a.last_cert.lock().unwrap().clone().unwrap())
        .unwrap();
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_root_certificates(roots)
        .with_no_client_auth();
    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    let tcp = tokio::net::TcpStream::connect((Ipv4Addr::LOCALHOST, port))
        .await
        .unwrap();
    let name = rustls::pki_types::ServerName::try_from(NAME).unwrap();
    let mut tls = connector
        .connect(name, tcp)
        .await
        .expect("the handshake for the tailnet name");
    tls.write_all(
        format!("GET /remote HTTP/1.1\r\nHost: {NAME}:{port}\r\nConnection: close\r\n\r\n")
            .as_bytes(),
    )
    .await
    .unwrap();
    let mut answer = Vec::new();
    let _ = tls.read_to_end(&mut answer).await;
    let answer = String::from_utf8_lossy(&answer);
    assert!(answer.starts_with("HTTP/1.1 200"), "{answer}");
    // Plain HTTP on the same port gets no answer.
    let mut plain = tokio::net::TcpStream::connect((Ipv4Addr::LOCALHOST, port))
        .await
        .unwrap();
    plain
        .write_all(b"GET /remote HTTP/1.1\r\nHost: x\r\n\r\n")
        .await
        .unwrap();
    let mut buf = Vec::new();
    let _ = tokio::time::timeout(Duration::from_secs(20), plain.read_to_end(&mut buf)).await;
    assert!(!String::from_utf8_lossy(&buf).contains("HTTP/1.1 200"));
    a.stop().await;
}
