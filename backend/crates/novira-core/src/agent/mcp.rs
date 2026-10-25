//! The app's MCP server for its own assistant: Streamable HTTP (JSON answers only) on `127.0.0.1` with a port the OS
//! picks, alive only while one assistant request runs. Only the `claude` / `codex` the app starts for that request is
//! told the address and the request's random bearer token. A request without that token, with a `Host` other than this
//! address, or with an `Origin` header (a web page) is refused before its body is read; bodies and headers are capped.
//!
//! Written by hand rather than with an SDK: it needs four JSON-RPC methods over plain POSTs (`initialize`, `ping`,
//! `tools/list`, `tools/call`; notifications are accepted and ignored), and the SDKs bring a web framework with them.
use super::attach::AgentImage;
use super::tools::{self, CheckedCall};
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_util::sync::CancellationToken;

/// The path the server answers on.
pub const PATH: &str = "/mcp";
/// The largest request body (a tool call's arguments are capped lower, see `tools::MAX_ARGS_BYTES`).
pub const MAX_BODY: usize = 1024 * 1024;
/// The largest request head (request line and headers).
pub const MAX_HEAD: usize = 16 * 1024;
/// How long a connection may stay idle before it is closed.
const IDLE: Duration = Duration::from_secs(60);
/// The protocol versions this server speaks, newest first.
const VERSIONS: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

/// What a tool call came to: text for the model, whether it is an error, and a picture for the model to look at (only
/// the tools of `relay::PICTURE_TOOLS` have one).
#[derive(Debug, Clone, PartialEq)]
pub struct ToolOutcome {
    pub ok: bool,
    pub text: String,
    pub image: Option<AgentImage>,
}

impl ToolOutcome {
    pub fn error(text: impl Into<String>) -> Self {
        Self {
            ok: false,
            text: text.into(),
            image: None,
        }
    }

    pub fn ok(text: impl Into<String>) -> Self {
        Self {
            ok: true,
            text: text.into(),
            image: None,
        }
    }
}

/// Runs a checked tool call (the app relays it to the frontend, a test answers it itself).
#[async_trait::async_trait]
pub trait ToolHandler: Send + Sync {
    async fn call(&self, call: CheckedCall) -> ToolOutcome;
}

/// A running server. Dropping it stops it and closes its connections.
pub struct McpServer {
    pub addr: SocketAddr,
    pub token: String,
    stop: CancellationToken,
}

impl McpServer {
    /// The address the tool is told (`http://127.0.0.1:<port>/mcp`).
    pub fn url(&self) -> String {
        format!("http://{}{PATH}", self.addr)
    }
}

impl Drop for McpServer {
    fn drop(&mut self) {
        self.stop.cancel();
    }
}

struct Shared {
    port: u16,
    token: String,
    handler: Arc<dyn ToolHandler>,
    /// Tool calls so far, and the most one request may make.
    calls: AtomicUsize,
    max_calls: usize,
}

/// A fresh random token (two v4 UUIDs: 244 random bits).
fn new_token() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

/// Starts a server on `127.0.0.1` with a port the OS picks. `max_calls` caps the tool calls of the request.
pub async fn start(handler: Arc<dyn ToolHandler>, max_calls: usize) -> std::io::Result<McpServer> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
    let addr = listener.local_addr()?;
    let token = new_token();
    let stop = CancellationToken::new();
    let shared = Arc::new(Shared {
        port: addr.port(),
        token: token.clone(),
        handler,
        calls: AtomicUsize::new(0),
        max_calls,
    });
    let stopped = stop.clone();
    tokio::spawn(async move {
        loop {
            let accepted = tokio::select! {
                _ = stopped.cancelled() => break,
                a = listener.accept() => a,
            };
            let Ok((stream, peer)) = accepted else {
                continue;
            };
            // Bound to loopback, so every peer is local; anything else is dropped all the same.
            if !peer.ip().is_loopback() {
                continue;
            }
            let shared = shared.clone();
            let stop = stopped.clone();
            tokio::spawn(async move {
                tokio::select! {
                    _ = stop.cancelled() => {}
                    _ = serve(stream, shared) => {}
                }
            });
        }
    });
    Ok(McpServer { addr, token, stop })
}

/// One parsed request head.
struct Head {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
}

impl Head {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }
}

/// Serves the requests of one connection, one after the other (keep-alive).
async fn serve(mut stream: TcpStream, shared: Arc<Shared>) {
    let mut buf: Vec<u8> = Vec::new();
    loop {
        let head = match tokio::time::timeout(IDLE, read_head(&mut stream, &mut buf)).await {
            Ok(Ok(Some(head))) => head,
            Ok(Err(status)) => {
                let _ = respond(&mut stream, status, None, true).await;
                return;
            }
            _ => return,
        };
        let close = head
            .header("connection")
            .is_some_and(|v| v.eq_ignore_ascii_case("close"));
        if let Err(status) = admit(&head, &shared) {
            let _ = respond(&mut stream, status, None, true).await;
            return;
        }
        if head.method != "POST" {
            // No server-sent event stream and no sessions: GET and DELETE are not offered.
            let _ = respond(&mut stream, 405, None, close).await;
            if close {
                return;
            }
            continue;
        }
        let body = match read_body(&mut stream, &mut buf, &head).await {
            Ok(body) => body,
            Err(status) => {
                let _ = respond(&mut stream, status, None, true).await;
                return;
            }
        };
        let (status, answer) = match serde_json::from_slice::<Value>(&body) {
            Ok(message) => handle(message, &shared).await,
            Err(_) => (400, Some(rpc_error(Value::Null, -32700, "parse error"))),
        };
        if respond(&mut stream, status, answer, close).await.is_err() || close {
            return;
        }
    }
}

/// Reads up to the end of the head; `Ok(None)` when the peer closed between requests.
async fn read_head(stream: &mut TcpStream, buf: &mut Vec<u8>) -> Result<Option<Head>, u16> {
    loop {
        if let Some(end) = find(buf, b"\r\n\r\n") {
            let text = std::str::from_utf8(&buf[..end])
                .map_err(|_| 400u16)?
                .to_string();
            buf.drain(..end + 4);
            return parse_head(&text).map(Some);
        }
        if buf.len() > MAX_HEAD {
            return Err(431);
        }
        let mut chunk = [0u8; 4096];
        let n = stream.read(&mut chunk).await.map_err(|_| 400u16)?;
        if n == 0 {
            return if buf.is_empty() { Ok(None) } else { Err(400) };
        }
        buf.extend_from_slice(&chunk[..n]);
    }
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

fn parse_head(text: &str) -> Result<Head, u16> {
    let mut lines = text.split("\r\n");
    let mut first = lines.next().unwrap_or("").split(' ');
    let (method, path, version) = (first.next(), first.next(), first.next());
    let (Some(method), Some(path), Some(version)) = (method, path, version) else {
        return Err(400);
    };
    if !version.starts_with("HTTP/1.") {
        return Err(505);
    }
    let mut headers = Vec::new();
    for line in lines {
        let (k, v) = line.split_once(':').ok_or(400u16)?;
        headers.push((k.trim().to_ascii_lowercase(), v.trim().to_string()));
    }
    Ok(Head {
        method: method.to_string(),
        path: path.to_string(),
        headers,
    })
}

/// The checks every request passes before its body is read.
fn admit(head: &Head, shared: &Shared) -> Result<(), u16> {
    // DNS rebinding: a page that resolves its own name to 127.0.0.1 still sends its own host name, and a browser
    // always sends Origin on such a request; the tool sends neither.
    let host = head.header("host").ok_or(400u16)?;
    let allowed = [
        format!("127.0.0.1:{}", shared.port),
        format!("localhost:{}", shared.port),
    ];
    if !allowed.iter().any(|a| a.eq_ignore_ascii_case(host)) {
        return Err(403);
    }
    if head.header("origin").is_some() {
        return Err(403);
    }
    let path = head.path.split('?').next().unwrap_or("");
    if path != PATH {
        return Err(404);
    }
    let auth = head.header("authorization").unwrap_or("");
    let given = auth.strip_prefix("Bearer ").unwrap_or("");
    if !same(given.as_bytes(), shared.token.as_bytes()) {
        return Err(401);
    }
    Ok(())
}

/// Compares in time that does not depend on where the first difference is.
fn same(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

async fn read_body(stream: &mut TcpStream, buf: &mut Vec<u8>, head: &Head) -> Result<Vec<u8>, u16> {
    if head.header("transfer-encoding").is_some() {
        return Err(411);
    }
    let len: usize = head
        .header("content-length")
        .ok_or(411u16)?
        .parse()
        .map_err(|_| 400u16)?;
    if len > MAX_BODY {
        return Err(413);
    }
    if !head
        .header("content-type")
        .is_some_and(|c| c.to_ascii_lowercase().starts_with("application/json"))
    {
        return Err(415);
    }
    while buf.len() < len {
        let mut chunk = [0u8; 8192];
        let n = stream.read(&mut chunk).await.map_err(|_| 400u16)?;
        if n == 0 {
            return Err(400);
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    Ok(buf.drain(..len).collect())
}

async fn respond(
    stream: &mut TcpStream,
    status: u16,
    body: Option<Value>,
    close: bool,
) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        202 => "Accepted",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        411 => "Length Required",
        413 => "Payload Too Large",
        415 => "Unsupported Media Type",
        431 => "Request Header Fields Too Large",
        _ => "Error",
    };
    let body = body.map(|b| b.to_string()).unwrap_or_default();
    let mut head = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Length: {}\r\n",
        body.len()
    );
    if !body.is_empty() {
        head.push_str("Content-Type: application/json\r\n");
    }
    if status == 405 {
        head.push_str("Allow: POST\r\n");
    }
    head.push_str(if close {
        "Connection: close\r\n\r\n"
    } else {
        "\r\n"
    });
    stream.write_all(head.as_bytes()).await?;
    stream.write_all(body.as_bytes()).await?;
    stream.flush().await
}

fn rpc_error(id: Value, code: i64, message: &str) -> Value {
    json!({"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}})
}

fn rpc_result(id: Value, result: Value) -> Value {
    json!({"jsonrpc": "2.0", "id": id, "result": result})
}

/// Answers one JSON-RPC message: the HTTP status and the body (none for a notification or a response).
async fn handle(message: Value, shared: &Shared) -> (u16, Option<Value>) {
    let Some(object) = message.as_object() else {
        return (
            400,
            Some(rpc_error(Value::Null, -32600, "batches are not supported")),
        );
    };
    let (Some(id), Some(method)) = (
        object.get("id"),
        object.get("method").and_then(Value::as_str),
    ) else {
        // A notification (initialized, cancelled, ...) or a response: nothing to answer.
        return (202, None);
    };
    let id = id.clone();
    let params = object.get("params").cloned().unwrap_or(Value::Null);
    let answer = match method {
        "initialize" => {
            let asked = params["protocolVersion"].as_str().unwrap_or("");
            let version = VERSIONS
                .iter()
                .find(|v| **v == asked)
                .copied()
                .unwrap_or(VERSIONS[1]);
            rpc_result(
                id,
                json!({
                    "protocolVersion": version,
                    "capabilities": {"tools": {"listChanged": false}},
                    "serverInfo": {"name": "novira", "version": env!("CARGO_PKG_VERSION")},
                    "instructions": "Tools of the novira app the user is looking at. Read with the get_ and list_ tools before you change something.",
                }),
            )
        }
        "ping" => rpc_result(id, json!({})),
        "tools/list" => rpc_result(id, tools::list()),
        "tools/call" => rpc_result(id, call_result(call(&params, shared).await)),
        _ => rpc_error(id, -32601, "method not found"),
    };
    (200, Some(answer))
}

async fn call(params: &Value, shared: &Shared) -> ToolOutcome {
    let Some(name) = params["name"].as_str() else {
        return ToolOutcome::error("a tool call needs a name");
    };
    dispatch(
        shared.handler.as_ref(),
        &shared.calls,
        shared.max_calls,
        name,
        params.get("arguments"),
    )
    .await
}

/// The one way a model's tool call reaches the app, whether it came through this server (`claude`, `codex`) or from the
/// app's own loop for a model with no MCP client (`toolloop.rs`): the request's call count against its cap, then the
/// check of the name and the arguments against the tool's schema, then the handler (which asks the user before a read
/// and applies the change). Nothing else decides what a call may do.
pub async fn dispatch(
    handler: &dyn ToolHandler,
    calls: &AtomicUsize,
    max_calls: usize,
    name: &str,
    args: Option<&Value>,
) -> ToolOutcome {
    if calls.fetch_add(1, Ordering::SeqCst) >= max_calls {
        return ToolOutcome::error(
            "This request has used up its tool calls. Stop calling tools and give your answer: say what is done and what is left.",
        );
    }
    match tools::check_call(name, args) {
        Ok(checked) => handler.call(checked).await,
        Err(why) => ToolOutcome::error(why),
    }
}

fn call_result(outcome: ToolOutcome) -> Value {
    let mut content = vec![json!({"type": "text", "text": outcome.text})];
    if let Some(picture) = &outcome.image {
        content.push(
            json!({"type": "image", "data": picture.base64(), "mimeType": AgentImage::MEDIA_TYPE}),
        );
    }
    json!({"content": content, "isError": !outcome.ok})
}

#[cfg(test)]
mod tests;
