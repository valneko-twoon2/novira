//! The home-network listener: TLS only on its own port, with a certificate from the local CA for the home address, the
//! public `/ca.crt`, and the `https` origin, `wss:` and `Secure` cookie that go with it. The listener binds loopback
//! here (its certificate still names `LAN_ADDRESS`), so nothing listens on the network.
mod common;
use common::*;
use futures_util::StreamExt;
use novira_server::{Ca, LanOptions, TOKEN_HEADER};
use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

fn lan_host(addr: SocketAddr) -> String {
    format!("127.0.0.1:{}", addr.port())
}

#[tokio::test]
async fn the_home_network_listener_speaks_tls_with_a_certificate_for_the_home_address() {
    let f = Fixture::start().await;
    let (lan, ca) = f.open_lan().await;
    assert_ne!(lan.port(), f.server.addr.port(), "a port of its own");
    assert_eq!(f.server.lan_addr(), Some(lan));
    let stream = tls_connect(lan, &ca, &LAN_ADDRESS.to_string())
        .await
        .unwrap();
    assert_eq!(
        stream.get_ref().1.alpn_protocol(),
        Some(&b"http/1.1"[..]),
        "HTTP/1.1 only"
    );
    let host = lan_host(lan);
    let page = exchange(
        stream,
        "GET",
        "/",
        &[("Host", &host), (TOKEN_HEADER, &f.server.token)],
        b"",
    )
    .await;
    assert_eq!(page.status, 200);
    let csp = page.header("content-security-policy").unwrap();
    assert!(
        csp.contains(&format!("connect-src 'self' wss://{host} ")),
        "{csp}"
    );
    assert!(!csp.contains("ws://"), "{csp}");
    // The loopback listener stays plain HTTP with `ws:`.
    let plain = f.get("/", &[]).await;
    let csp = plain.header("content-security-policy").unwrap();
    assert!(csp.contains(&format!("ws://{} ", f.host)), "{csp}");
    f.stop().await;
}

#[tokio::test]
async fn a_client_refuses_the_certificate_for_another_name_or_from_another_ca() {
    let f = Fixture::start().await;
    let (lan, ca) = f.open_lan().await;
    for name in ["192.168.1.6", "127.0.0.1", "localhost", "example.com"] {
        assert!(
            tls_connect(lan, &ca, name).await.is_err(),
            "the certificate is for {LAN_ADDRESS} only, not {name}"
        );
    }
    let stranger = Ca::generate().unwrap();
    assert!(tls_connect(lan, &stranger, &LAN_ADDRESS.to_string())
        .await
        .is_err());
    f.stop().await;
}

#[tokio::test]
async fn plain_http_on_the_tls_port_gets_no_http_answer() {
    let f = Fixture::start().await;
    let (lan, _) = f.open_lan().await;
    let mut stream = tokio::net::TcpStream::connect(lan).await.unwrap();
    let request = format!(
        "GET / HTTP/1.1\r\nHost: {}\r\n{TOKEN_HEADER}: {}\r\nConnection: close\r\n\r\n",
        lan_host(lan),
        f.server.token
    );
    stream.write_all(request.as_bytes()).await.unwrap();
    let mut raw = Vec::new();
    let _ = tokio::time::timeout(Duration::from_secs(20), stream.read_to_end(&mut raw))
        .await
        .expect("the server closes the connection");
    assert!(
        !String::from_utf8_lossy(&raw).contains("HTTP/1.1"),
        "{}",
        String::from_utf8_lossy(&raw)
    );
    f.stop().await;
}

#[tokio::test]
async fn the_ca_certificate_is_public_on_the_tls_listener_only() {
    let f = Fixture::start().await;
    // Closed: nothing to hand out, and the plain listener wants the token as for every route.
    assert_eq!(f.get("/ca.crt", &[]).await.status, 404);
    let (lan, ca) = f.open_lan().await;
    let host = lan_host(lan);
    let r = send_tls(lan, &ca, "GET", "/ca.crt", &[("Host", &host)], b"").await;
    assert_eq!(r.status, 200);
    assert_eq!(String::from_utf8(r.body.clone()).unwrap(), ca.pem());
    assert_eq!(r.header("content-type"), Some("application/x-x509-ca-cert"));
    assert!(r
        .header("content-disposition")
        .unwrap()
        .contains("novira-local-ca.crt"));
    // Only GET of that path is public: another method, another path, or the page itself need the token.
    for (method, path) in [
        ("POST", "/ca.crt"),
        ("GET", "/ca.crt/x"),
        ("GET", "/"),
        ("POST", "/api/bootstrap"),
    ] {
        let r = send_tls(lan, &ca, method, path, &[("Host", &host)], b"").await;
        assert_ne!(r.status, 200, "{method} {path}");
    }
    // The Host and Origin checks still apply to it.
    let r = send_tls(lan, &ca, "GET", "/ca.crt", &[("Host", "evil.example")], b"").await;
    assert_eq!(r.status, 403);
    let plain = send(f.server.addr, "GET", "/ca.crt", &[("Host", &f.host)], b"").await;
    assert_eq!(plain.status, 401);
    f.stop().await;
}

#[tokio::test]
async fn the_origin_is_https_and_the_cookie_secure_on_the_tls_listener() {
    let f = Fixture::start().await;
    let (lan, ca) = f.open_lan().await;
    let host = lan_host(lan);
    let token = f.server.token.as_str();
    let https = format!("https://{host}");
    let http = format!("http://{host}");
    let r = send_tls(
        lan,
        &ca,
        "POST",
        "/api/bootstrap",
        &[("Host", &host), (TOKEN_HEADER, token), ("Origin", &https)],
        b"",
    )
    .await;
    assert_eq!(r.status, 200);
    for origin in [
        http.as_str(),
        "https://evil.example",
        "null",
        "https://192.168.1.5",
    ] {
        let r = send_tls(
            lan,
            &ca,
            "POST",
            "/api/bootstrap",
            &[("Host", &host), (TOKEN_HEADER, token), ("Origin", origin)],
            b"",
        )
        .await;
        assert_eq!(r.status, 403, "origin {origin}");
    }
    // On the plain listener the https origin is another origin.
    let r = send(
        f.server.addr,
        "POST",
        "/api/bootstrap",
        &[
            ("Host", &f.host),
            (TOKEN_HEADER, token),
            ("Origin", &format!("https://{}", f.host)),
        ],
        b"",
    )
    .await;
    assert_eq!(r.status, 403);
    // Doubled headers are refused on TLS as on plain HTTP.
    for headers in [
        vec![("Host", host.as_str()), ("Host", "evil.example")],
        vec![
            ("Host", host.as_str()),
            ("Origin", https.as_str()),
            ("Origin", https.as_str()),
        ],
    ] {
        let mut with_token = headers.clone();
        with_token.push((TOKEN_HEADER, token));
        let r = send_tls(lan, &ca, "POST", "/api/bootstrap", &with_token, b"").await;
        assert_eq!(r.status, 400, "{headers:?}");
    }
    let page = send_tls(
        lan,
        &ca,
        "GET",
        &format!("/?token={token}"),
        &[("Host", &host)],
        b"",
    )
    .await;
    let cookie = page.header("set-cookie").unwrap();
    assert!(cookie.contains("; Secure"), "{cookie}");
    let plain = send(
        f.server.addr,
        "GET",
        &format!("/?token={token}"),
        &[("Host", &f.host)],
        b"",
    )
    .await;
    assert!(!plain.header("set-cookie").unwrap().contains("Secure"));
    f.stop().await;
}

#[tokio::test]
async fn the_listener_opens_once_closes_as_a_unit_and_opens_again() {
    let f = Fixture::start().await;
    let (lan, ca) = f.open_lan().await;
    let again = f
        .server
        .open_lan(
            &ca,
            LanOptions {
                address: LAN_ADDRESS,
                bind: Ipv4Addr::LOCALHOST,
                port: 0,
            },
        )
        .await;
    assert_eq!(
        again.err().map(|e| e.kind()),
        Some(std::io::ErrorKind::AlreadyExists)
    );
    // An event socket over TLS ends when the listener closes, and the port closes.
    let host = lan_host(lan);
    let mut request = format!("wss://{host}/events")
        .into_client_request()
        .unwrap();
    request
        .headers_mut()
        .insert(TOKEN_HEADER, f.server.token.parse().unwrap());
    let stream = tls_connect(lan, &ca, &LAN_ADDRESS.to_string())
        .await
        .unwrap();
    let (mut socket, _) = tokio_tungstenite::client_async(request, stream)
        .await
        .unwrap();
    f.server.close_lan().await;
    let end = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            match socket.next().await {
                None | Some(Err(_)) => break,
                Some(Ok(m)) if m.is_close() => break,
                Some(Ok(_)) => {}
            }
        }
    })
    .await;
    assert!(end.is_ok(), "the event socket ends with the listener");
    assert!(
        tokio::net::TcpStream::connect(lan).await.is_err(),
        "the port is closed"
    );
    assert_eq!(f.server.lan_addr(), None);
    assert!(f.server.pair_code().is_none());
    assert_eq!(f.pair_code().await.status, 404);
    // The loopback listener is untouched, and the home network opens again.
    assert_eq!(f.get("/", &[]).await.status, 200);
    let (lan, ca) = f.open_lan().await;
    let r = send_tls(
        lan,
        &ca,
        "GET",
        "/",
        &[("Host", &lan_host(lan)), (TOKEN_HEADER, &f.server.token)],
        b"",
    )
    .await;
    assert_eq!(r.status, 200);
    // Stopping the server closes it too.
    f.stop().await;
    assert!(tokio::net::TcpStream::connect(lan).await.is_err());
}

#[tokio::test]
async fn this_computer_gets_a_pairing_code_while_the_listener_is_open() {
    let f = Fixture::start().await;
    assert_eq!(f.pair_code().await.status, 404);
    let (lan, ca) = f.open_lan().await;
    let link = f.pair_code().await;
    assert_eq!(link.status, 200);
    let link = link.json();
    let url = link["url"].as_str().unwrap();
    let prefix = format!("https://{LAN_ADDRESS}:{}/pair#", lan.port());
    let code = url.strip_prefix(&prefix).unwrap_or_else(|| panic!("{url}"));
    assert_eq!(code.len(), 32);
    assert!(
        !url.contains(&f.server.token),
        "the start token never leaves this computer"
    );
    assert_eq!(link["expiresIn"], 120);
    let size = link["size"].as_u64().unwrap() as usize;
    assert_eq!(link["modules"].as_str().unwrap().len(), size * size);
    // A GET, no token, or the TLS listener without a session: refused.
    assert_ne!(f.get(novira_server::PAIR_CODE_ROUTE, &[]).await.status, 200);
    let r = send(
        f.server.addr,
        "POST",
        novira_server::PAIR_CODE_ROUTE,
        &[("Host", &f.host)],
        b"",
    )
    .await;
    assert_eq!(r.status, 401);
    let r = send_tls(
        lan,
        &ca,
        "POST",
        novira_server::PAIR_CODE_ROUTE,
        &[("Host", &lan_host(lan))],
        b"",
    )
    .await;
    assert_eq!(r.status, 401);
    f.stop().await;
}

/// The pairing calls over the TLS listener, as the phone page makes them (the client here is on loopback; what a
/// device's address changes is tested in process, `src/lan_tests.rs`).
#[tokio::test]
async fn a_phone_pairs_over_tls_and_receives_a_secure_session_cookie() {
    let f = Fixture::start().await;
    let (lan, ca) = f.open_lan().await;
    let host = lan_host(lan);
    let origin = format!("https://{host}");
    let json = |body: &str| body.to_string();
    let post = |path: &'static str, body: String| {
        let (ca, host, origin) = (&ca, host.clone(), origin.clone());
        async move {
            send_tls(
                lan,
                ca,
                "POST",
                path,
                &[
                    ("Host", &host),
                    ("Origin", &origin),
                    ("Sec-Fetch-Site", "same-origin"),
                    ("Content-Type", "application/json"),
                ],
                body.as_bytes(),
            )
            .await
        }
    };
    // The page and its script are public on the TLS listener.
    let page = send_tls(lan, &ca, "GET", "/pair", &[("Host", &host)], b"").await;
    assert_eq!(page.status, 200);
    assert!(String::from_utf8_lossy(&page.body).contains("/pair.js"));
    let script = send_tls(lan, &ca, "GET", "/pair.js", &[("Host", &host)], b"").await;
    assert_eq!(script.status, 200);
    assert!(script
        .header("content-type")
        .unwrap()
        .starts_with("text/javascript"));
    let code = f.pair_code().await.json()["url"]
        .as_str()
        .unwrap()
        .rsplit_once('#')
        .unwrap()
        .1
        .to_string();
    let asked = post(
        novira_server::PAIR_REQUEST_ROUTE,
        json(&format!(r#"{{"code":"{code}","label":"test phone"}}"#)),
    )
    .await;
    assert_eq!(
        asked.status,
        200,
        "{}",
        String::from_utf8_lossy(&asked.body)
    );
    let ticket = asked.json();
    let poll = ticket["poll"].as_str().unwrap().to_string();
    let status_body = format!(r#"{{"poll":"{poll}"}}"#);
    assert_eq!(
        post(novira_server::PAIR_STATUS_ROUTE, status_body.clone())
            .await
            .json()["state"],
        "pending"
    );
    // This computer sees the request with the same confirmation number, and approves it.
    let state = f.get(novira_server::PAIR_STATE_ROUTE, &[]).await.json();
    assert_eq!(state["pending"][0]["confirm"], ticket["confirm"]);
    assert_eq!(state["pending"][0]["label"], "test phone");
    let id = state["pending"][0]["id"].as_str().unwrap().to_string();
    let approve = send(
        f.server.addr,
        "POST",
        novira_server::PAIR_APPROVE_ROUTE,
        &[
            ("Host", &f.host),
            (TOKEN_HEADER, &f.server.token),
            ("Content-Type", "application/json"),
        ],
        format!(r#"{{"id":"{id}"}}"#).as_bytes(),
    )
    .await;
    assert_eq!(approve.status, 200);
    let approved = post(novira_server::PAIR_STATUS_ROUTE, status_body.clone()).await;
    assert_eq!(approved.json()["state"], "approved");
    let cookie = approved.header("set-cookie").unwrap();
    let name = f.server.session_cookie().unwrap();
    assert!(cookie.starts_with(&format!("{name}=")), "{cookie}");
    for part in ["HttpOnly", "SameSite=Strict", "Secure", "Max-Age=14400"] {
        assert!(cookie.contains(part), "{cookie}");
    }
    // Handed out once; the code is used up.
    assert_eq!(
        post(novira_server::PAIR_STATUS_ROUTE, status_body)
            .await
            .status,
        404
    );
    let again = post(
        novira_server::PAIR_REQUEST_ROUTE,
        json(&format!(r#"{{"code":"{code}","label":"test phone"}}"#)),
    )
    .await;
    assert_eq!(again.status, 403);
    assert_eq!(
        f.get(novira_server::PAIR_STATE_ROUTE, &[]).await.json()["devices"][0]["id"],
        id.as_str()
    );
    f.stop().await;
}

#[cfg(windows)]
#[tokio::test]
async fn the_data_folder_keeps_its_ca_between_openings() {
    let f = Fixture::start().await;
    let ca = Ca::load_or_create(f.data()).unwrap();
    let options = LanOptions {
        address: LAN_ADDRESS,
        bind: Ipv4Addr::LOCALHOST,
        port: 0,
    };
    f.server.open_lan(&ca, options).await.unwrap();
    f.server.close_lan().await;
    // The same CA after a restart: a phone that installed it trusts the new leaf.
    let again = Ca::load_or_create(f.data()).unwrap();
    let lan = f.server.open_lan(&again, options).await.unwrap();
    assert!(tls_connect(lan, &ca, &LAN_ADDRESS.to_string())
        .await
        .is_ok());
    f.stop().await;
}
