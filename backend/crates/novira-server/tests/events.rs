//! `/events`: backend events over a WebSocket, behind the same token, `Host` and `Origin` checks as every route.
mod common;
use common::*;
use futures_util::StreamExt;
use novira_server::TOKEN_HEADER;
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

type Socket = tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>;

/// The upgrade request with `headers` (the right `Host` unless one is given).
async fn connect(f: &Fixture, headers: &[(&str, &str)]) -> Result<Socket, u16> {
    let mut request = format!("ws://{}/events", f.host)
        .into_client_request()
        .unwrap();
    for (name, value) in headers {
        request.headers_mut().insert(
            tokio_tungstenite::tungstenite::http::HeaderName::from_bytes(name.as_bytes()).unwrap(),
            value.parse().unwrap(),
        );
    }
    let stream = tokio::net::TcpStream::connect(f.server.addr).await.unwrap();
    match tokio_tungstenite::client_async(request, stream).await {
        Ok((socket, _)) => Ok(socket),
        Err(tokio_tungstenite::tungstenite::Error::Http(response)) => {
            Err(response.status().as_u16())
        }
        Err(other) => panic!("unexpected: {other}"),
    }
}

/// The next event other than a log line: the log is process-wide, so another test opening its backend at the same time
/// can put a line on this socket.
async fn next_event(socket: &mut Socket) -> Value {
    loop {
        let message = tokio::time::timeout(std::time::Duration::from_secs(10), socket.next())
            .await
            .expect("an event arrives")
            .expect("the socket is open")
            .expect("a frame");
        let event: Value = match message {
            Message::Text(text) => serde_json::from_str(text.as_str()).unwrap(),
            other => panic!("not a text message: {other:?}"),
        };
        if event["type"] != "log" {
            return event;
        }
    }
}

#[tokio::test]
async fn backend_events_arrive_as_the_json_the_desktop_sends() {
    let f = Fixture::start().await;
    let mut socket = connect(&f, &[(TOKEN_HEADER, &f.server.token)])
        .await
        .unwrap();
    f.backend.pause_processor();
    assert_eq!(
        next_event(&mut socket).await,
        json!({ "type": "processor_state", "isPaused": true })
    );
    // A command through the HTTP route reaches the same socket (a second page would see it as well).
    let mut other = connect(&f, &[(TOKEN_HEADER, &f.server.token)])
        .await
        .unwrap();
    assert_eq!(f.post("resume_processor", "").await.status, 200);
    for s in [&mut socket, &mut other] {
        assert_eq!(
            next_event(s).await,
            json!({ "type": "processor_state", "isPaused": false })
        );
    }
    // A job queued over HTTP announces itself as a status change.
    let made = f.post("enqueue", &enqueue_body()).await;
    assert_eq!(made.status, 200, "{}", String::from_utf8_lossy(&made.body));
    let event = next_event(&mut socket).await;
    assert_eq!(event["type"], json!("queue_item_status_changed"));
    assert_eq!(event["item"]["status"], json!("pending"));
    f.stop().await;
}

#[tokio::test]
async fn a_saved_screen_state_reaches_every_open_page_with_the_savers_id_and_not_the_state() {
    let f = Fixture::start().await;
    let mut socket = connect(&f, &[(TOKEN_HEADER, &f.server.token)])
        .await
        .unwrap();
    let state = r#"{"novira.params":"{\"positivePrompt\":\"secret prompt\"}"}"#;
    let body = json!({ "state": state, "origin": "page-phone-1" }).to_string();
    let saved = f.post("save_ui_state", &body).await;
    assert_eq!(
        saved.status,
        200,
        "{}",
        String::from_utf8_lossy(&saved.body)
    );
    let event = next_event(&mut socket).await;
    assert_eq!(event["type"], json!("ui_state_changed"));
    assert_eq!(event["origin"], json!("page-phone-1"));
    assert!(event["revision"].as_u64().unwrap() > 0);
    // The state itself is read with a command, never carried by the event.
    assert!(!event.to_string().contains("secret prompt"));
    let read = f.post("adopt_ui_state", r#"{"local":null}"#).await;
    assert!(String::from_utf8_lossy(&read.body).contains("secret prompt"));
    // A save without an id still announces itself, with an empty one.
    let anonymous = json!({ "state": state }).to_string();
    assert_eq!(f.post("save_ui_state", &anonymous).await.status, 200);
    let event = next_event(&mut socket).await;
    assert_eq!(event["origin"], json!(""));
    f.stop().await;
}

#[tokio::test]
async fn the_event_socket_passes_the_same_guards_as_every_route() {
    let f = Fixture::start().await;
    let cookie = format!("{}={}", f.server.cookie(), f.server.token);
    let origin = format!("http://{}", f.host);
    // No token, a wrong token, and the token in the address (accepted only on the page itself).
    assert_eq!(connect(&f, &[]).await.err(), Some(401));
    assert_eq!(
        connect(&f, &[(TOKEN_HEADER, "wrong")]).await.err(),
        Some(401)
    );
    let mut by_query = format!("ws://{}/events?token={}", f.host, f.server.token)
        .into_client_request()
        .unwrap();
    by_query
        .headers_mut()
        .insert("host", f.host.parse().unwrap());
    let stream = tokio::net::TcpStream::connect(f.server.addr).await.unwrap();
    assert!(matches!(
        tokio_tungstenite::client_async(by_query, stream).await,
        Err(tokio_tungstenite::tungstenite::Error::Http(r)) if r.status() == 401
    ));
    // The wrong host (DNS rebinding) and a page of another site, with the right token and with the cookie.
    for headers in [
        vec![
            (TOKEN_HEADER, f.server.token.as_str()),
            ("host", "evil.example"),
        ],
        vec![
            (TOKEN_HEADER, f.server.token.as_str()),
            ("origin", "http://evil.example"),
        ],
        vec![
            ("cookie", cookie.as_str()),
            ("origin", "http://evil.example"),
        ],
        vec![("cookie", cookie.as_str()), ("origin", "null")],
        vec![
            ("cookie", cookie.as_str()),
            ("origin", "http://127.0.0.1:1"),
        ],
        vec![
            ("cookie", cookie.as_str()),
            ("sec-fetch-site", "cross-site"),
        ],
        vec![("cookie", cookie.as_str()), ("sec-fetch-site", "same-site")],
    ] {
        assert_eq!(connect(&f, &headers).await.err(), Some(403), "{headers:?}");
    }
    // What a page of this server sends: its cookie, its own origin.
    assert!(connect(
        &f,
        &[
            ("cookie", &cookie),
            ("origin", &origin),
            ("sec-fetch-site", "same-origin")
        ]
    )
    .await
    .is_ok());
    f.stop().await;
}

#[tokio::test]
async fn the_server_stops_while_a_page_holds_the_event_socket() {
    let f = Fixture::start().await;
    let mut socket = connect(&f, &[(TOKEN_HEADER, &f.server.token)])
        .await
        .unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(10), f.stop())
        .await
        .expect("stop does not wait for the page");
    // The socket ends (a close frame, then nothing).
    let end = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        while let Some(Ok(message)) = socket.next().await {
            if matches!(message, Message::Close(_)) {
                break;
            }
        }
    })
    .await;
    assert!(end.is_ok());
}
