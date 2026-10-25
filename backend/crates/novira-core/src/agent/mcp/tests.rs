use super::*;
use std::sync::Mutex;

/// Answers every call with its tool name and remembers the calls it was given.
#[derive(Default)]
struct Echo {
    seen: Mutex<Vec<CheckedCall>>,
}

#[async_trait::async_trait]
impl ToolHandler for Echo {
    async fn call(&self, call: CheckedCall) -> ToolOutcome {
        let text = format!("ran {}", call.tool);
        self.seen.lock().unwrap().push(call);
        ToolOutcome::ok(text)
    }
}

/// Sends one raw HTTP request and returns the status and the body.
async fn raw(server: &McpServer, request: String) -> (u16, String) {
    let mut stream = TcpStream::connect(server.addr).await.unwrap();
    stream.write_all(request.as_bytes()).await.unwrap();
    let mut out = Vec::new();
    let _ = tokio::time::timeout(Duration::from_secs(5), stream.read_to_end(&mut out)).await;
    let text = String::from_utf8_lossy(&out).to_string();
    let status = text.get(9..12).and_then(|s| s.parse().ok()).unwrap_or(0);
    let body = text
        .split_once("\r\n\r\n")
        .map(|(_, b)| b.to_string())
        .unwrap_or_default();
    (status, body)
}

fn post(server: &McpServer, body: &Value, extra: &str) -> String {
    let body = body.to_string();
    format!(
            "POST /mcp HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n{body}",
            server.addr,
            server.token,
            body.len()
        )
}

async fn rpc(server: &McpServer, method: &str, params: Value) -> Value {
    let msg = json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params});
    let (status, body) = raw(server, post(server, &msg, "")).await;
    assert_eq!(status, 200, "{body}");
    serde_json::from_str(&body).unwrap()
}

async fn server(max_calls: usize) -> (McpServer, Arc<Echo>) {
    let echo = Arc::new(Echo::default());
    (start(echo.clone(), max_calls).await.unwrap(), echo)
}

#[tokio::test]
async fn initialize_lists_tools_and_relays_a_checked_call() {
    let (server, echo) = server(10).await;
    assert!(server.url().starts_with("http://127.0.0.1:") && server.url().ends_with("/mcp"));
    assert_eq!(server.token.len(), 64);
    let init = rpc(
        &server,
        "initialize",
        json!({"protocolVersion": "2025-03-26"}),
    )
    .await;
    assert_eq!(init["result"]["protocolVersion"], "2025-03-26");
    assert_eq!(init["result"]["serverInfo"]["name"], "novira");
    let unknown = rpc(
        &server,
        "initialize",
        json!({"protocolVersion": "1999-01-01"}),
    )
    .await;
    assert_eq!(unknown["result"]["protocolVersion"], "2025-06-18");
    let list = rpc(&server, "tools/list", json!({})).await;
    assert_eq!(
        list["result"]["tools"].as_array().unwrap().len(),
        tools::TOOLS.len()
    );
    let call = rpc(
        &server,
        "tools/call",
        json!({"name": "select_model", "arguments": {"key": "m1"}}),
    )
    .await;
    assert_eq!(call["result"]["content"][0]["text"], "ran select_model");
    assert_eq!(call["result"]["isError"], false);
    assert_eq!(echo.seen.lock().unwrap()[0].args, json!({"key": "m1"}));
    assert_eq!(rpc(&server, "ping", json!({})).await["result"], json!({}));
    assert_eq!(
        rpc(&server, "resources/list", json!({})).await["error"]["code"],
        -32601
    );
}

#[tokio::test]
async fn bad_arguments_and_unknown_tools_are_tool_errors_that_never_reach_the_handler() {
    let (server, echo) = server(10).await;
    let bad = rpc(
        &server,
        "tools/call",
        json!({"name": "set_generation_settings", "arguments": {"steps": 9999}}),
    )
    .await;
    assert_eq!(bad["result"]["isError"], true);
    assert!(bad["result"]["content"][0]["text"]
        .as_str()
        .unwrap()
        .contains("at most 150"));
    let unknown = rpc(
        &server,
        "tools/call",
        json!({"name": "delete_images", "arguments": {}}),
    )
    .await;
    assert_eq!(unknown["result"]["isError"], true);
    assert!(echo.seen.lock().unwrap().is_empty());
}

#[tokio::test]
async fn the_read_gated_flag_goes_with_the_call() {
    let (server, echo) = server(10).await;
    rpc(
        &server,
        "tools/call",
        json!({"name": "list_gallery_images", "arguments": {}}),
    )
    .await;
    rpc(
        &server,
        "tools/call",
        json!({"name": "get_generation_settings", "arguments": {}}),
    )
    .await;
    let seen = echo.seen.lock().unwrap();
    assert!(seen[0].read_gated && !seen[1].read_gated);
}

#[tokio::test]
async fn requests_without_the_token_or_from_another_host_or_a_web_page_are_refused() {
    let (server, echo) = server(10).await;
    let msg = json!({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_screen"}});
    let good = post(&server, &msg, "");
    let wrong_token = good.replace(&server.token, &"0".repeat(64));
    assert_eq!(raw(&server, wrong_token).await.0, 401);
    let no_token = good.replace(&format!("Authorization: Bearer {}\r\n", server.token), "");
    assert_eq!(raw(&server, no_token).await.0, 401);
    let short_token = good.replace(&server.token, &server.token[..10]);
    assert_eq!(raw(&server, short_token).await.0, 401);
    let rebinding = good.replace(
        &format!("Host: {}", server.addr),
        &format!("Host: evil.example:{}", server.addr.port()),
    );
    assert_eq!(raw(&server, rebinding).await.0, 403);
    let other_port = good.replace(&format!("Host: {}", server.addr), "Host: 127.0.0.1:1");
    assert_eq!(raw(&server, other_port).await.0, 403);
    assert_eq!(
        raw(&server, post(&server, &msg, "Origin: http://127.0.0.1\r\n"))
            .await
            .0,
        403
    );
    let other_path = good.replace("POST /mcp ", "POST /other ");
    assert_eq!(raw(&server, other_path).await.0, 404);
    assert!(echo.seen.lock().unwrap().is_empty());
    // localhost with the same port is the same server.
    let localhost = good.replace(
        &format!("Host: {}", server.addr),
        &format!("Host: localhost:{}", server.addr.port()),
    );
    assert_eq!(raw(&server, localhost).await.0, 200);
}

#[tokio::test]
async fn bodies_and_heads_are_capped_and_must_be_json_with_a_length() {
    let (server, _) = server(10).await;
    let head = |len: usize, extra: &str| {
        format!(
                "POST /mcp HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\n{extra}Content-Length: {len}\r\n\r\n",
                server.addr, server.token
            )
    };
    assert_eq!(
        raw(
            &server,
            head(MAX_BODY + 1, "Content-Type: application/json\r\n")
        )
        .await
        .0,
        413
    );
    assert_eq!(
        raw(&server, head(2, "Content-Type: text/plain\r\n"))
            .await
            .0,
        415
    );
    let chunked = format!(
            "POST /mcp HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nTransfer-Encoding: chunked\r\n\r\n",
            server.addr, server.token
        );
    assert_eq!(raw(&server, chunked).await.0, 411);
    let huge_head = format!("POST /mcp HTTP/1.1\r\nX: {}\r\n", "a".repeat(MAX_HEAD + 10));
    assert_eq!(raw(&server, huge_head).await.0, 431);
    let not_json = format!("{}{{oops", head(5, "Content-Type: application/json\r\n"));
    assert_eq!(raw(&server, not_json).await.0, 400);
}

#[tokio::test]
async fn notifications_are_accepted_get_is_not_offered_and_batches_are_refused() {
    let (server, _) = server(10).await;
    let note = json!({"jsonrpc": "2.0", "method": "notifications/initialized"});
    assert_eq!(
        raw(&server, post(&server, &note, "")).await,
        (202, String::new())
    );
    let get = format!(
        "GET /mcp HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nConnection: close\r\n\r\n",
        server.addr, server.token
    );
    assert_eq!(raw(&server, get).await.0, 405);
    let batch = json!([{"jsonrpc": "2.0", "id": 1, "method": "ping"}]);
    assert_eq!(raw(&server, post(&server, &batch, "")).await.0, 400);
}

#[tokio::test]
async fn a_request_stops_calling_tools_at_its_cap() {
    let (server, echo) = server(2).await;
    for _ in 0..2 {
        let r = rpc(&server, "tools/call", json!({"name": "get_screen"})).await;
        assert_eq!(r["result"]["isError"], false);
    }
    let over = rpc(&server, "tools/call", json!({"name": "get_screen"})).await;
    assert_eq!(over["result"]["isError"], true);
    assert!(over["result"]["content"][0]["text"]
        .as_str()
        .unwrap()
        .contains("used up"));
    assert_eq!(echo.seen.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn two_requests_on_one_connection_are_both_answered() {
    let (server, _) = server(10).await;
    let msg = json!({"jsonrpc": "2.0", "id": 7, "method": "ping"});
    let keep = post(&server, &msg, "").replace("Connection: close\r\n", "");
    let mut stream = TcpStream::connect(server.addr).await.unwrap();
    stream
        .write_all(format!("{keep}{}", post(&server, &msg, "")).as_bytes())
        .await
        .unwrap();
    let mut out = Vec::new();
    tokio::time::timeout(Duration::from_secs(5), stream.read_to_end(&mut out))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        String::from_utf8_lossy(&out)
            .matches("HTTP/1.1 200 OK")
            .count(),
        2
    );
}

#[tokio::test]
async fn a_dropped_server_stops_listening() {
    let (server, _) = server(10).await;
    let addr = server.addr;
    drop(server);
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(TcpStream::connect(addr).await.is_err());
}

#[test]
fn a_picture_goes_with_the_text_as_image_content() {
    let plain = call_result(ToolOutcome::ok("words"));
    assert_eq!(plain["content"].as_array().unwrap().len(), 1);
    let outcome = ToolOutcome {
        ok: true,
        text: "page 1".into(),
        image: Some(AgentImage {
            jpeg: vec![1, 2, 3],
        }),
    };
    let result = call_result(outcome);
    assert_eq!(result["content"][0]["text"], "page 1");
    assert_eq!(result["content"][1]["type"], "image");
    assert_eq!(result["content"][1]["mimeType"], "image/jpeg");
    assert_eq!(result["content"][1]["data"], "AQID");
    assert_eq!(result["isError"], false);
}
