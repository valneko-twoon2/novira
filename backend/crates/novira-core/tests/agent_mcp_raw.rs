//! The MCP server spoken to with hand-written bytes: broken request lines, a body cut short, GET with and without
//! `Connection: close`, a tool call with no name.
use novira_core::agent::mcp::{self, ToolHandler, ToolOutcome};
use novira_core::agent::tools::CheckedCall;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

struct Nothing;

#[async_trait::async_trait]
impl ToolHandler for Nothing {
    async fn call(&self, _call: CheckedCall) -> ToolOutcome {
        ToolOutcome::error("not called")
    }
}

/// Sends the bytes, then optionally half-closes, and reads until the server hangs up (or a short wait passes).
async fn exchange(addr: std::net::SocketAddr, bytes: &[u8], hang_up: bool) -> String {
    let mut stream = TcpStream::connect(addr).await.unwrap();
    stream.write_all(bytes).await.unwrap();
    if hang_up {
        stream.shutdown().await.unwrap();
    }
    let mut out = Vec::new();
    let _ = tokio::time::timeout(
        std::time::Duration::from_secs(3),
        stream.read_to_end(&mut out),
    )
    .await;
    String::from_utf8_lossy(&out).into_owned()
}

fn head(port: u16, token: &str, method: &str, extra: &str) -> String {
    format!(
        "{method} /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {token}\r\n{extra}\r\n"
    )
}

#[tokio::test]
async fn a_request_line_without_a_version_is_a_bad_request() {
    let server = mcp::start(Arc::new(Nothing), 5).await.unwrap();
    let answer = exchange(server.addr, b"GET /mcp\r\n\r\n", false).await;
    assert!(answer.starts_with("HTTP/1.1 400 Bad Request"), "{answer}");
}

#[tokio::test]
async fn another_http_major_version_is_refused_with_a_plain_status_text() {
    let server = mcp::start(Arc::new(Nothing), 5).await.unwrap();
    let answer = exchange(server.addr, b"GET /mcp HTTP/2.0\r\n\r\n", false).await;
    assert!(answer.starts_with("HTTP/1.1 505 Error"), "{answer}");
}

#[tokio::test]
async fn get_is_refused_and_connection_close_ends_the_connection() {
    let server = mcp::start(Arc::new(Nothing), 5).await.unwrap();
    let port = server.addr.port();
    let request = head(port, &server.token, "GET", "Connection: close\r\n");
    let answer = exchange(server.addr, request.as_bytes(), false).await;
    assert!(answer.starts_with("HTTP/1.1 405"), "{answer}");
    assert!(answer.contains("Connection: close"), "{answer}");
}

#[tokio::test]
async fn a_body_the_client_never_finishes_is_a_bad_request() {
    let server = mcp::start(Arc::new(Nothing), 5).await.unwrap();
    let port = server.addr.port();
    let mut request = head(
        port,
        &server.token,
        "POST",
        "Content-Type: application/json\r\nContent-Length: 500\r\n",
    );
    request.push_str("{\"jsonrpc\":");
    let answer = exchange(server.addr, request.as_bytes(), true).await;
    assert!(answer.starts_with("HTTP/1.1 400 Bad Request"), "{answer}");
}

#[tokio::test]
async fn a_tool_call_without_a_name_is_a_tool_error() {
    let server = mcp::start(Arc::new(Nothing), 5).await.unwrap();
    let port = server.addr.port();
    let body = r#"{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{}}"#;
    let mut request = head(
        port,
        &server.token,
        "POST",
        &format!(
            "Content-Type: application/json\r\nConnection: close\r\nContent-Length: {}\r\n",
            body.len()
        ),
    );
    request.push_str(body);
    let answer = exchange(server.addr, request.as_bytes(), false).await;
    assert!(answer.contains("a tool call needs a name"), "{answer}");
    assert!(answer.contains("\"isError\":true"), "{answer}");
}

#[tokio::test]
async fn get_without_connection_close_keeps_the_connection_for_the_next_request() {
    let server = mcp::start(Arc::new(Nothing), 5).await.unwrap();
    let port = server.addr.port();
    let one = head(port, &server.token, "GET", "");
    let both = format!("{one}{one}");
    let answer = exchange(server.addr, both.as_bytes(), true).await;
    assert_eq!(answer.matches("HTTP/1.1 405").count(), 2, "{answer}");
}
