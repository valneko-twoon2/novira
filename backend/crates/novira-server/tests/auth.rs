//! Token, cookie, Host and Origin checks: who may talk to the server at all.
mod common;
use common::*;
use novira_server::TOKEN_HEADER;

#[tokio::test]
async fn every_route_needs_the_token() {
    let f = Fixture::start().await;
    let host = f.host.clone();
    for (method, path) in [
        ("GET", "/"),
        ("GET", "/index.html"),
        ("GET", "/assets/app.js"),
        ("GET", "/novira-server.js"),
        ("GET", "/novira-image/full/a.png"),
        ("POST", "/api/bootstrap"),
        ("POST", "/api/nope"),
        ("POST", "/upload/image"),
        ("POST", "/export/images"),
        ("GET", "/events"),
        ("GET", "/nothing-here"),
    ] {
        let none = send(f.server.addr, method, path, &[("Host", &host)], b"").await;
        assert_eq!(none.status, 401, "{method} {path} without a token");
        let wrong = send(
            f.server.addr,
            method,
            path,
            &[("Host", &host), (TOKEN_HEADER, "0000")],
            b"",
        )
        .await;
        assert_eq!(wrong.status, 401, "{method} {path} with a wrong token");
        let near = format!("{}x", &f.server.token[..63]);
        let almost = send(
            f.server.addr,
            method,
            path,
            &[("Host", &host), (TOKEN_HEADER, &near)],
            b"",
        )
        .await;
        assert_eq!(
            almost.status, 401,
            "{method} {path} with a token one letter off"
        );
        let cookie = send(
            f.server.addr,
            method,
            path,
            &[
                ("Host", &host),
                ("Cookie", &format!("{}=nope", f.server.cookie())),
            ],
            b"",
        )
        .await;
        assert_eq!(cookie.status, 401, "{method} {path} with a wrong cookie");
    }
    // The token in the address works on the page only; elsewhere it is not a credential.
    let query = send(
        f.server.addr,
        "POST",
        &format!("/api/bootstrap?token={}", f.server.token),
        &[("Host", &host)],
        b"",
    )
    .await;
    assert_eq!(query.status, 401);
    let asset = send(
        f.server.addr,
        "GET",
        &format!("/assets/app.js?token={}", f.server.token),
        &[("Host", &host)],
        b"",
    )
    .await;
    assert_eq!(asset.status, 401);
    f.stop().await;
}

#[tokio::test]
async fn the_page_turns_the_token_into_a_cookie_and_carries_the_marker_script() {
    let f = Fixture::start().await;
    let first = send(
        f.server.addr,
        "GET",
        &format!("/?token={}", f.server.token),
        &[("Host", &f.host)],
        b"",
    )
    .await;
    // The page itself answers at the address with the token (it stays in the address for another browser).
    assert_eq!(first.status, 200);
    let cookie = first.header("set-cookie").expect("a cookie");
    assert!(
        cookie.starts_with(&format!("{}={}", f.server.cookie(), f.server.token)),
        "{cookie}"
    );
    assert!(
        cookie.contains("HttpOnly") && cookie.contains("SameSite=Strict"),
        "{cookie}"
    );
    let pair = cookie.split(';').next().unwrap().to_string();
    let page = send(
        f.server.addr,
        "GET",
        "/",
        &[("Host", &f.host), ("Cookie", &pair)],
        b"",
    )
    .await;
    assert_eq!(page.status, 200);
    let html = String::from_utf8(page.body.clone()).unwrap();
    assert!(
        html.contains("<head><script src=\"/novira-server.js\"></script><title>"),
        "{html}"
    );
    let script = send(
        f.server.addr,
        "GET",
        "/novira-server.js",
        &[("Host", &f.host), ("Cookie", &pair)],
        b"",
    )
    .await;
    assert_eq!(script.status, 200);
    assert!(String::from_utf8(script.body)
        .unwrap()
        .contains("__NOVIRA_SERVER__"));
    // A wrong token in the address gets no cookie.
    let bad = send(
        f.server.addr,
        "GET",
        "/?token=abc",
        &[("Host", &f.host)],
        b"",
    )
    .await;
    assert_eq!((bad.status, bad.header("set-cookie")), (401, None));
    // Answers carry the policy headers.
    let csp = page
        .headers
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case("content-security-policy"))
        .map(|(_, v)| v.clone())
        .unwrap();
    assert!(
        csp.contains("default-src 'self'") && !csp.contains("unsafe-eval") && !csp.contains(" * "),
        "{csp}"
    );
    assert_eq!(page.header("x-content-type-options"), Some("nosniff"));
    // No other page may frame this one.
    assert!(csp.contains("frame-ancestors 'none'"), "{csp}");
    assert_eq!(page.header("x-frame-options"), Some("DENY"));
    // The cookie is named for this server's port; the bare old name, or another port's, is not this token.
    assert_eq!(
        f.server.cookie(),
        format!("novira_token_{}", f.server.addr.port())
    );
    for other in [
        "novira_token".to_string(),
        format!("novira_token_{}", f.server.addr.port() ^ 1),
    ] {
        let r = send(
            f.server.addr,
            "GET",
            "/",
            &[
                ("Host", &f.host),
                ("Cookie", &format!("{other}={}", f.server.token)),
            ],
            b"",
        )
        .await;
        assert_eq!(r.status, 401, "{other}");
    }
    f.stop().await;
}

#[tokio::test]
async fn a_wrong_host_or_origin_is_refused_even_with_the_token() {
    let f = Fixture::start().await;
    let token = f.server.token.as_str();
    let port = f.server.addr.port();
    let ok_host = f.host.as_str();
    // The two own spellings work.
    let localhost = format!("localhost:{port}");
    for host in [ok_host, localhost.as_str()] {
        let r = send(
            f.server.addr,
            "GET",
            "/",
            &[("Host", host), (TOKEN_HEADER, token)],
            b"",
        )
        .await;
        assert_eq!(r.status, 200, "{host}");
    }
    // A DNS name pointed at 127.0.0.1, another port, no port, an empty or a missing host.
    let other_port = format!("127.0.0.1:{}", if port == 1 { 2 } else { port - 1 });
    for host in [
        "evil.example",
        "evil.example:80",
        &format!("evil.example:{port}"),
        "127.0.0.1",
        "localhost",
        &other_port,
        "[::1]",
        "",
    ] {
        let r = send(
            f.server.addr,
            "GET",
            "/",
            &[("Host", host), (TOKEN_HEADER, token)],
            b"",
        )
        .await;
        assert_eq!(r.status, 403, "host {host:?}");
        let r = send(
            f.server.addr,
            "POST",
            "/api/bootstrap",
            &[("Host", host), (TOKEN_HEADER, token)],
            b"",
        )
        .await;
        assert_eq!(r.status, 403, "host {host:?} on the api");
    }
    let no_host = send(f.server.addr, "GET", "/", &[(TOKEN_HEADER, token)], b"").await;
    assert_ne!(no_host.status, 200, "no Host header");
    // Two Hosts or two Origins are refused, whichever comes first.
    let own = format!("http://{ok_host}");
    for headers in [
        vec![("Host", ok_host), ("Host", "evil.example")],
        vec![("Host", "evil.example"), ("Host", ok_host)],
        vec![("Host", ok_host), ("Host", ok_host)],
        vec![
            ("Host", ok_host),
            ("Origin", own.as_str()),
            ("Origin", "http://evil.example"),
        ],
    ] {
        let mut with_token = headers.clone();
        with_token.push((TOKEN_HEADER, token));
        let r = send(f.server.addr, "POST", "/api/bootstrap", &with_token, b"").await;
        assert_eq!(r.status, 400, "{headers:?}");
    }
    // Origin, when a browser sends one, must be the server's own.
    let own = format!("http://{ok_host}");
    let own_localhost = format!("http://{localhost}");
    let r = send(
        f.server.addr,
        "POST",
        "/api/bootstrap",
        &[("Host", ok_host), (TOKEN_HEADER, token), ("Origin", &own)],
        b"",
    )
    .await;
    assert_eq!(r.status, 200);
    // `localhost` as the Host with the 127.0.0.1 origin is another origin.
    let r = send(
        f.server.addr,
        "POST",
        "/api/bootstrap",
        &[
            ("Host", &localhost),
            (TOKEN_HEADER, token),
            ("Origin", &own),
        ],
        b"",
    )
    .await;
    assert_eq!(r.status, 403);
    let r = send(
        f.server.addr,
        "POST",
        "/api/bootstrap",
        &[
            ("Host", &localhost),
            (TOKEN_HEADER, token),
            ("Origin", &own_localhost),
        ],
        b"",
    )
    .await;
    assert_eq!(r.status, 200);
    for origin in [
        "http://evil.example",
        "https://evil.example",
        "null",
        "http://127.0.0.1",
        "https://127.0.0.1:1",
        "",
        &format!("http://evil.example:{port}"),
    ] {
        let r = send(
            f.server.addr,
            "POST",
            "/api/create_board",
            &[("Host", ok_host), (TOKEN_HEADER, token), ("Origin", origin)],
            br#"{"name":"x"}"#,
        )
        .await;
        assert_eq!(r.status, 403, "origin {origin:?}");
    }
    assert_eq!(
        f.backend.bootstrap().boards.len(),
        0,
        "a refused request changed nothing"
    );
    // Fetch metadata from the browser: another site is refused, the page itself and the address bar are not.
    for (site, status) in [
        ("cross-site", 403),
        ("same-site", 403),
        ("same-origin", 200),
        ("none", 200),
    ] {
        let r = f.get("/", &[("Sec-Fetch-Site", site)]).await;
        assert_eq!(r.status, status, "Sec-Fetch-Site: {site}");
    }
    // The cookie does not let a request through with the wrong host either.
    let r = send(
        f.server.addr,
        "GET",
        "/",
        &[
            ("Host", "evil.example"),
            ("Cookie", &format!("{}={token}", f.server.cookie())),
        ],
        b"",
    )
    .await;
    assert_eq!(r.status, 403);
    f.stop().await;
}

#[tokio::test]
async fn without_the_home_network_only_loopback_listens() {
    let f = Fixture::start().await;
    let port = f.server.addr.port();
    assert!(f.server.addr.ip().is_loopback());
    // No home network, no pairing code to show a phone; and like every route it needs the token.
    let link = send(
        f.server.addr,
        "POST",
        novira_server::PAIR_CODE_ROUTE,
        &[("Host", &f.host), (TOKEN_HEADER, &f.server.token)],
        b"",
    )
    .await;
    assert_eq!(
        (link.status, link.json()["code"].as_str()),
        (404, Some("no_home_network"))
    );
    let anonymous = send(
        f.server.addr,
        "POST",
        novira_server::PAIR_CODE_ROUTE,
        &[("Host", &f.host)],
        b"",
    )
    .await;
    assert_eq!(anonymous.status, 401);
    // The pairing page and its calls are public only on the home-network listener: here they want the token.
    for (method, path) in [
        ("GET", novira_server::PAIR_PAGE_ROUTE),
        ("GET", novira_server::PAIR_SCRIPT_ROUTE),
        ("POST", novira_server::PAIR_REQUEST_ROUTE),
        ("POST", novira_server::PAIR_STATUS_ROUTE),
    ] {
        let r = send(f.server.addr, method, path, &[("Host", &f.host)], b"").await;
        assert_eq!(r.status, 401, "{method} {path}");
    }
    if let Some(ip) = novira_server::home_address() {
        assert!(
            tokio::net::TcpStream::connect((ip, port)).await.is_err(),
            "nothing listens on the home address"
        );
    }
    f.stop().await;
}
