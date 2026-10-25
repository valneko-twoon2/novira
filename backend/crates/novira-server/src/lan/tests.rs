//! Opening the home network on demand: trusted networks, `/lan/*`, closing (by this computer, by idleness, by a change of
//! network). The network is a stand-in the test moves (`Net`); the clock is moved by handing a later instant to
//! `maintain`, so nothing waits. The `/lan/*` calls run through the real router in process.
use super::*;
use crate::lan_tests::{json_of, this_computer, Bench, HOME, OTHER, PHONE};
use std::sync::Mutex as StdMutex;

const MAC: Mac = [0x02, 0x11, 0x22, 0x33, 0x44, 0x55];
const MAC_B: Mac = [0x02, 0xaa, 0xbb, 0xcc, 0xdd, 0xee];

fn info(address: Ipv4Addr, mac: Option<Mac>) -> NetworkInfo {
    NetworkInfo {
        address,
        bind: Ipv4Addr::LOCALHOST,
        gateway_mac: mac,
        windows_public: Some(false),
    }
}

/// The network the server looks at, which a test can change under it.
#[derive(Clone)]
struct Net(Arc<StdMutex<Option<NetworkInfo>>>);

impl Net {
    fn at(mac: Option<Mac>) -> Net {
        Net(Arc::new(StdMutex::new(Some(info(HOME, mac)))))
    }

    fn set(&self, now: Option<NetworkInfo>) {
        *self.0.lock().unwrap() = now;
    }

    fn probe(&self) -> Probe {
        let net = self.0.clone();
        Arc::new(move || net.lock().unwrap().clone())
    }
}

/// A server whose home network is `net`, with its own CA.
async fn bench(net: &Net) -> Bench {
    let b = Bench::start().await;
    b.server.enable_lan(Control::new(
        b.data().to_path_buf(),
        Ca::generate().unwrap(),
        net.probe(),
    ));
    b
}

impl Bench {
    async fn lan_get(&self, path: &str) -> (StatusCode, Value) {
        let token = self.server.token.clone();
        let (status, _, text) = self
            .ask(
                this_computer(self),
                "GET",
                path,
                &[(crate::TOKEN_HEADER, &token)],
                "",
            )
            .await;
        (status, json_of(&text))
    }

    /// Trusts the network the server is on now.
    async fn trust(&self, mac: Mac, label: &str) {
        let body = json!({ "gatewayMac": trusted::mac_text(&mac), "label": label }).to_string();
        let (status, answer) = self.manage("/lan/trust", &body).await;
        assert_eq!(status, StatusCode::OK, "{answer}");
    }

    fn lan_port(&self) -> Option<u16> {
        self.server.lan_addr().map(|a| a.port())
    }

    fn trusted_file(&self) -> PathBuf {
        self.data().join(trusted::FILE)
    }
}

fn ago(by: Duration) -> Instant {
    Instant::now()
        .checked_sub(by)
        .expect("a clock that has run that long")
}

#[tokio::test]
async fn without_the_home_network_the_lan_routes_do_not_exist() {
    let b = Bench::start().await;
    assert_eq!(b.lan_get("/lan/state").await.0, StatusCode::NOT_FOUND);
    for path in ["/lan/open", "/lan/close", "/lan/trust", "/lan/untrust"] {
        let body = r#"{"gatewayMac":"02:11:22:33:44:55","label":"x"}"#;
        let (status, answer) = b.manage(path, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(answer["code"], "no_lan_control");
    }
    assert!(matches!(
        b.server.open_lan_trusted().await,
        Err(OpenError::NotEnabled)
    ));
    b.stop().await;
}

#[tokio::test]
async fn a_network_that_is_unknown_or_untrusted_never_opens() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    // A gateway nobody confirmed.
    let (status, answer) = b.manage("/lan/open", "").await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(answer["code"], "untrusted_network");
    assert_eq!(answer["gatewayMac"], "02:11:22:33:44:55");
    // A gateway that cannot be told (not Windows, no route, no answer).
    net.set(Some(info(HOME, None)));
    let (status, answer) = b.manage("/lan/open", "").await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::CONFLICT, Some("unknown_network"))
    );
    // No home address at all.
    net.set(None);
    let (status, answer) = b.manage("/lan/open", "").await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::CONFLICT, Some("no_home_network"))
    );
    assert!(b.server.lan_addr().is_none(), "none of them opened");
    assert!(matches!(
        b.server.open_lan_trusted().await,
        Err(OpenError::NoNetwork)
    ));
    // The state says why.
    net.set(Some(info(HOME, Some(MAC))));
    let (status, state) = b.lan_get("/lan/state").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(state["open"], false);
    assert_eq!(state["network"]["gatewayMac"], "02:11:22:33:44:55");
    assert_eq!(state["network"]["trusted"], false);
    assert_eq!(state["windowsPublic"], false);
    assert_eq!(state["address"], "192.168.1.5");
    assert!(state["port"].is_null());
    b.stop().await;
}

#[tokio::test]
async fn windows_calling_the_network_public_is_a_flag_not_a_gate() {
    let net = Net::at(Some(MAC));
    net.set(Some(NetworkInfo {
        windows_public: Some(true),
        ..info(HOME, Some(MAC))
    }));
    let b = bench(&net).await;
    b.trust(MAC, "home").await;
    let (status, state) = b.manage("/lan/open", "").await;
    assert_eq!(status, StatusCode::OK, "{state}");
    assert_eq!(state["open"], true);
    assert_eq!(state["windowsPublic"], true);
    b.stop().await;
}

#[tokio::test]
async fn trusting_is_for_the_network_this_computers_owner_was_shown() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    let good = json!({ "gatewayMac": "02:11:22:33:44:55", "label": "home" });
    let with = |change: Value| {
        let mut body = good.clone();
        for (k, v) in change.as_object().unwrap() {
            body[k] = v.clone();
        }
        body.to_string()
    };
    for (body, want, code) in [
        // Not a gateway address, or not a string.
        (
            with(json!({"gatewayMac": "02-11-22-33-44-55"})),
            400,
            "bad_arguments",
        ),
        (
            with(json!({"gatewayMac": "00:00:00:00:00:00"})),
            400,
            "bad_arguments",
        ),
        (
            with(json!({"gatewayMac": "ff:ff:ff:ff:ff:ff"})),
            400,
            "bad_arguments",
        ),
        (with(json!({"gatewayMac": 7})), 400, "bad_arguments"),
        // A name that is empty, long, or has control or direction characters.
        (with(json!({"label": ""})), 400, "bad_label"),
        (with(json!({"label": "x".repeat(41)})), 400, "bad_label"),
        (with(json!({"label": "a\u{0}b"})), 400, "bad_label"),
        (with(json!({"label": "a\u{202e}b"})), 400, "bad_label"),
        (
            "{\"gatewayMac\":\"02:11:22:33:44:55\"}".to_string(),
            400,
            "bad_arguments",
        ),
        ("[1]".to_string(), 400, "bad_arguments"),
        // Another network than the one shown.
        (
            with(json!({"gatewayMac": "02:aa:bb:cc:dd:ee"})),
            409,
            "network_changed",
        ),
    ] {
        let (status, answer) = b.manage("/lan/trust", &body).await;
        assert_eq!(status.as_u16(), want, "{body}: {answer}");
        assert_eq!(answer["code"], code, "{body}");
    }
    // Not a JSON body.
    let token = b.server.token.clone();
    let (status, _, _) = b
        .ask(
            this_computer(&b),
            "POST",
            "/lan/trust",
            &[
                (crate::TOKEN_HEADER, &token),
                ("content-type", "text/plain"),
            ],
            &good.to_string(),
        )
        .await;
    assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    // A network whose gateway cannot be told, or none.
    net.set(Some(info(HOME, None)));
    let answer = b.manage("/lan/trust", &good.to_string()).await.1;
    assert_eq!(answer["code"], "unknown_network");
    net.set(None);
    let answer = b.manage("/lan/trust", &good.to_string()).await.1;
    assert_eq!(answer["code"], "no_home_network");
    assert!(!b.trusted_file().exists(), "none of them trusted anything");
    // The one shown: trusted, kept in the file, and the state says so.
    net.set(Some(info(HOME, Some(MAC))));
    let (status, answer) = b.manage("/lan/trust", &good.to_string()).await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert_eq!(answer["network"]["trusted"], true);
    let text = std::fs::read_to_string(b.trusted_file()).unwrap();
    let file: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(file[0]["gatewayMac"], "02:11:22:33:44:55");
    assert_eq!(file[0]["label"], "home");
    let (_, state) = b.lan_get("/lan/state").await;
    assert_eq!(state["network"]["trusted"], true);
    assert_eq!(state["network"]["label"], "home");
    assert_eq!(
        state["trustedNetworks"][0]["gatewayMac"],
        "02:11:22:33:44:55"
    );
    // A restart keeps it (a new Control reads the file).
    assert!(Trusted::load(b.data()).is_trusted(&MAC));
    b.stop().await;
}

#[tokio::test]
async fn a_trusted_network_opens_on_demand_and_the_state_tells_what_is_going_on() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    b.trust(MAC, "home").await;
    let (status, state) = b.manage("/lan/open", "").await;
    assert_eq!(status, StatusCode::OK, "{state}");
    assert_eq!(state["open"], true);
    let port = b.lan_port().expect("it listens");
    assert_eq!(state["port"], port);
    assert_eq!(state["address"], "192.168.1.5");
    assert_eq!(state["idleLimitSecs"], 1800);
    // Opening an open listener changes nothing; the port is kept for the next time.
    let (status, again) = b.manage("/lan/open", "").await;
    assert_eq!(
        (status, again["port"].as_u64()),
        (StatusCode::OK, Some(port as u64))
    );
    assert_eq!(
        std::fs::read_to_string(b.data().join("server-lan-port")).unwrap(),
        port.to_string()
    );
    // A paired device and a waiting request show, without any secret.
    let cookie = b.pair(PHONE, port).await;
    let code = b.code().await;
    let body = json!({ "code": code, "label": "tablet" }).to_string();
    let (status, _, _) = b
        .phone(OTHER, port, crate::pair::REQUEST_ROUTE, &body)
        .await;
    assert_eq!(status, StatusCode::OK);
    let (_, state) = b.lan_get("/lan/state").await;
    assert_eq!(state["devices"].as_array().unwrap().len(), 1);
    assert_eq!(state["devices"][0]["label"], "phone");
    assert_eq!(state["pending"][0]["label"], "tablet");
    let shown = state.to_string();
    let secret = cookie.split_once('=').unwrap().1;
    assert!(!shown.contains(secret) && !shown.contains(&b.server.token));
    // Close, and open again on the same port.
    let (status, _) = b.manage("/lan/close", "").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        b.manage("/lan/close", "").await.0,
        StatusCode::OK,
        "closing twice is fine"
    );
    assert!(b.server.lan_addr().is_none());
    assert_eq!(b.manage("/lan/open", "").await.0, StatusCode::OK);
    assert_eq!(b.lan_port(), Some(port));
    b.stop().await;
}

#[tokio::test]
async fn closing_ends_every_session_and_forgets_every_code() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    b.trust(MAC, "home").await;
    b.manage("/lan/open", "").await;
    let port = b.lan_port().unwrap();
    let cookie = b.pair(PHONE, port).await;
    let code = b.code().await;
    assert_eq!(b.bootstrap(PHONE, port, &cookie).await, StatusCode::OK);
    b.manage("/lan/close", "").await;
    b.manage("/lan/open", "").await;
    let port = b.lan_port().unwrap();
    assert_eq!(
        b.bootstrap(PHONE, port, &cookie).await,
        StatusCode::UNAUTHORIZED,
        "the old session is gone"
    );
    let body = json!({ "code": code, "label": "phone" }).to_string();
    let (status, _, _) = b
        .phone(PHONE, port, crate::pair::REQUEST_ROUTE, &body)
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "the old code is gone");
    let state = b.lan_get("/lan/state").await.1;
    assert!(state["devices"].as_array().unwrap().is_empty());
    b.stop().await;
}

#[tokio::test]
async fn the_lan_routes_are_for_this_computer_with_its_token_only() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    // The listener is open without the network being trusted (as a test can only do from inside): a device has a
    // session and still gets nowhere near the routes that open, close and trust.
    let port = b.open_lan().await;
    let cookie = b.pair(PHONE, port).await;
    let cookie_header = [("cookie", cookie.as_str())];
    let token = b.server.token.clone();
    let token_header = [(crate::TOKEN_HEADER, token.as_str())];
    let device = Bench::device(PHONE, port, true);
    let plain_device = Bench::device(PHONE, port, false);
    let body = json!({ "gatewayMac": "02:11:22:33:44:55", "label": "mine" }).to_string();
    for (method, path) in [
        ("GET", "/lan/state"),
        ("POST", "/lan/open"),
        ("POST", "/lan/close"),
        ("POST", "/lan/trust"),
        ("POST", "/lan/untrust"),
        ("GET", "/lan/nothing"),
        ("GET", "/lan/"),
        ("GET", "/lan"),
    ] {
        for ends in [device, plain_device] {
            for headers in [&cookie_header[..], &token_header[..], &[][..]] {
                let (status, _, _) = b.ask(ends, method, path, headers, &body).await;
                assert_eq!(
                    status,
                    StatusCode::FORBIDDEN,
                    "{method} {path} tls={} {headers:?}",
                    ends.tls
                );
            }
        }
        // This computer without the token is not let in either.
        let (status, _, _) = b.ask(this_computer(&b), method, path, &[], &body).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{method} {path}");
    }
    assert!(!b.trusted_file().exists(), "nothing was trusted");
    assert_eq!(b.lan_port(), Some(port), "nothing was closed");
    assert_eq!(b.bootstrap(PHONE, port, &cookie).await, StatusCode::OK);
    // A cross-site page in this computer's browser is refused by the fetch checks like every route.
    let (status, _, _) = b
        .ask(
            this_computer(&b),
            "POST",
            "/lan/trust",
            &[
                (crate::TOKEN_HEADER, token.as_str()),
                ("origin", "http://evil.example"),
                ("content-type", "application/json"),
            ],
            &body,
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(!b.trusted_file().exists());
    b.stop().await;
}

#[tokio::test]
async fn an_unused_listener_closes_after_half_an_hour() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    b.trust(MAC, "home").await;
    b.manage("/lan/open", "").await;
    let state = b.server.state.clone();
    let opened = Instant::now();
    maintain(&state, opened + LAN_IDLE - Duration::from_secs(60)).await;
    assert!(b.server.lan_addr().is_some(), "29 minutes");
    maintain(&state, opened + LAN_IDLE + Duration::from_secs(60)).await;
    assert!(b.server.lan_addr().is_none(), "31 minutes");
    b.stop().await;
}

#[tokio::test]
async fn a_live_code_or_a_waiting_request_keeps_it_open_but_nothing_else_does() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    b.trust(MAC, "home").await;
    b.manage("/lan/open", "").await;
    let port = b.lan_port().unwrap();
    let state = b.server.state.clone();
    let stale = || *state.lan_activity.lock().unwrap() = ago(LAN_IDLE + Duration::from_secs(1));
    // A code that can still be used.
    stale();
    let code = b.code().await;
    maintain(&state, Instant::now() + Duration::from_secs(30)).await;
    assert!(b.server.lan_addr().is_some(), "a live code");
    // The same code, used: a request waits for this computer.
    let body = json!({ "code": code, "label": "phone" }).to_string();
    b.phone(PHONE, port, crate::pair::REQUEST_ROUTE, &body)
        .await;
    maintain(&state, Instant::now() + crate::pair::CODE_TTL * 2).await;
    assert!(b.server.lan_addr().is_some(), "a waiting request");
    // Once it is decided and the code time has passed, nothing keeps it.
    let id = b.pair_state().await["pending"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    b.manage(crate::pair::DENY_ROUTE, &json!({ "id": id }).to_string())
        .await;
    maintain(&state, Instant::now() + crate::pair::CODE_TTL * 2).await;
    assert!(b.server.lan_addr().is_none());
    b.stop().await;
}

#[tokio::test]
async fn only_a_paired_device_in_use_counts_as_use() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    b.trust(MAC, "home").await;
    b.manage("/lan/open", "").await;
    let port = b.lan_port().unwrap();
    let state = b.server.state.clone();
    let cookie = b.pair(PHONE, port).await;
    let stale = || *state.lan_activity.lock().unwrap() = ago(LAN_IDLE + Duration::from_secs(1));
    // A paired device's request starts the time again.
    stale();
    assert_eq!(b.bootstrap(PHONE, port, &cookie).await, StatusCode::OK);
    maintain(&state, Instant::now() + Duration::from_secs(60)).await;
    assert!(b.server.lan_addr().is_some(), "a device in use");
    // Anyone else, however much, does not: a stranger's requests, public routes, wrong cookies, wrong codes.
    stale();
    let device = Bench::device(OTHER, port, true);
    for _ in 0..3 {
        b.ask(device, "GET", "/ca.crt", &[], "").await;
        b.ask(device, "GET", "/pair", &[], "").await;
        let wrong = [("cookie", "novira_session_1=x")];
        b.ask(device, "POST", "/api/bootstrap", &wrong, "").await;
        b.bootstrap(OTHER, port, &cookie).await;
        let guess = r#"{"code":"0123","label":"x"}"#;
        b.phone(OTHER, port, crate::pair::REQUEST_ROUTE, guess)
            .await;
    }
    maintain(&state, Instant::now() + Duration::from_secs(60)).await;
    assert!(
        b.server.lan_addr().is_none(),
        "nobody paired was heard from"
    );
    b.stop().await;
}

#[tokio::test]
async fn the_listener_closes_when_its_network_goes_away_or_stops_being_trusted() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    b.trust(MAC, "home").await;
    let state = b.server.state.clone();
    let now = || Instant::now() + Duration::from_secs(1);
    let reopen = || async {
        assert_eq!(b.manage("/lan/open", "").await.0, StatusCode::OK);
        assert!(b.server.lan_addr().is_some());
    };
    reopen().await;
    // Nothing changed, or the gateway just cannot be told for a moment: it stays.
    maintain(&state, now()).await;
    assert!(b.server.lan_addr().is_some());
    net.set(Some(info(HOME, None)));
    maintain(&state, now()).await;
    assert!(
        b.server.lan_addr().is_some(),
        "an unknown gateway does not close it"
    );
    // Another home address: the listener's is gone.
    net.set(Some(info(Ipv4Addr::new(192, 168, 1, 9), Some(MAC))));
    maintain(&state, now()).await;
    assert!(b.server.lan_addr().is_none());
    // The home address is gone altogether.
    net.set(Some(info(HOME, Some(MAC))));
    reopen().await;
    net.set(None);
    maintain(&state, now()).await;
    assert!(b.server.lan_addr().is_none());
    // Another gateway that is not trusted: closed; once trusted too, it stays.
    net.set(Some(info(HOME, Some(MAC))));
    reopen().await;
    net.set(Some(info(HOME, Some(MAC_B))));
    maintain(&state, now()).await;
    assert!(b.server.lan_addr().is_none());
    net.set(Some(info(HOME, Some(MAC))));
    reopen().await;
    net.set(Some(info(HOME, Some(MAC_B))));
    b.trust(MAC_B, "office").await;
    maintain(&state, now()).await;
    assert!(b.server.lan_addr().is_some(), "both are trusted");
    // Untrusting a network it is not on leaves it open; untrusting the one it is on closes it at once.
    let (status, _) = b
        .manage("/lan/untrust", r#"{"gatewayMac":"02:11:22:33:44:55"}"#)
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(b.server.lan_addr().is_some());
    let (status, answer) = b
        .manage("/lan/untrust", r#"{"gatewayMac":"02:aa:bb:cc:dd:ee"}"#)
        .await;
    assert_eq!(status, StatusCode::OK, "{answer}");
    assert!(b.server.lan_addr().is_none());
    // A network that is not trusted is not untrusted twice, and a bad address is refused.
    let (status, answer) = b
        .manage("/lan/untrust", r#"{"gatewayMac":"02:aa:bb:cc:dd:ee"}"#)
        .await;
    assert_eq!(
        (status, answer["code"].as_str()),
        (StatusCode::NOT_FOUND, Some("unknown"))
    );
    let bad = b.manage("/lan/untrust", r#"{"gatewayMac":"nope"}"#).await;
    assert_eq!(bad.0, StatusCode::BAD_REQUEST);
    assert_eq!(
        b.manage("/lan/untrust", "{}").await.0,
        StatusCode::BAD_REQUEST
    );
    assert!(Trusted::load(b.data()).entry(&MAC).is_none());
    b.stop().await;
}

#[tokio::test]
async fn the_library_opens_on_a_trusted_network_and_reports_why_not() {
    let net = Net::at(Some(MAC));
    let b = bench(&net).await;
    match b.server.open_lan_trusted().await {
        Err(OpenError::Untrusted { gateway_mac }) => assert_eq!(gateway_mac, MAC),
        other => panic!("{other:?}"),
    }
    b.trust(MAC, "home").await;
    let addr = b.server.open_lan_trusted().await.unwrap();
    assert_eq!(Some(addr), b.server.lan_addr());
    assert!(matches!(
        b.server.open_lan_trusted().await,
        Err(OpenError::AlreadyOpen)
    ));
    assert!(b.server.pair_code().is_some());
    b.stop().await;
}
