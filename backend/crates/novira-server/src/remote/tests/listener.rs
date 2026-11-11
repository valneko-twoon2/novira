//! The remote listener itself: turning it on and off, Tailscale's problems, who is answered, its management, the
//! unused days, the daily certificate and a real TLS handshake.
use super::*;

// tags: state-transition
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

// tags: state-transition, error-guessing
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

// tags: decision-table, condition
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

// tags: condition, equivalence
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

// tags: condition
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

// tags: boundary, state-transition
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

// tags: boundary
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

// tags: equivalence
#[test]
fn the_phone_page_has_the_same_strings_in_japanese_and_english() {
    crate::pair::tests::check_page_strings(STRINGS, include_str!("../page.js"));
    let page = include_str!("../page.html");
    assert!(page.contains("<script src=\"/remote.js\"></script>"));
    assert_eq!(script_source().matches("__STRINGS__").count(), 0);
}

/// A real TLS client on loopback: the listener shows the certificate Tailscale gave for its name, and answers its page.
// tags: scenario
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
