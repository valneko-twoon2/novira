//! A fake OpenAI-compatible server on a loopback port: scripted answers for `POST /v1/chat/completions`, a model
//! list for `GET /v1/models`, and a record of every request (path, `Authorization`, JSON body).
#![allow(dead_code)]
use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Router;
use novira_core::agent::mcp::{ToolHandler, ToolOutcome};
use novira_core::agent::tools::CheckedCall;
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// What the fake answers.
#[derive(Clone)]
pub enum Reply {
    Json(u16, Value),
    Raw(u16, Vec<u8>),
    /// A redirect to this absolute address.
    Redirect(String),
    /// Waits, then answers with the JSON.
    Slow(Duration, Value),
    /// A JSON body of about this many bytes.
    Big(usize),
}

/// A request the server saw.
#[derive(Clone, Debug)]
pub struct Seen {
    pub method: String,
    pub path: String,
    pub authorization: Option<String>,
    pub body: Value,
}

#[derive(Default)]
struct Inner {
    chats: Mutex<VecDeque<Reply>>,
    models: Mutex<Option<Reply>>,
    probe: Mutex<Option<Reply>>,
    seen: Mutex<Vec<Seen>>,
}

pub struct Fake {
    /// `http://127.0.0.1:<port>/v1`
    pub base: String,
    /// `http://127.0.0.1:<port>`
    pub origin: String,
    inner: Arc<Inner>,
}

impl Fake {
    pub async fn start() -> Fake {
        let inner = Arc::new(Inner::default());
        let app = Router::new().fallback(handle).with_state(inner.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        Fake {
            base: format!("http://127.0.0.1:{port}/v1"),
            origin: format!("http://127.0.0.1:{port}"),
            inner,
        }
    }

    /// The next chat answer.
    pub fn queue(&self, reply: Reply) {
        self.inner.chats.lock().unwrap().push_back(reply);
    }

    /// The answer to the context probe (by default: the server read 100000 tokens, which is all of it).
    pub fn set_probe(&self, reply: Reply) {
        *self.inner.probe.lock().unwrap() = Some(reply);
    }

    pub fn set_models(&self, reply: Reply) {
        *self.inner.models.lock().unwrap() = Some(reply);
    }

    pub fn seen(&self) -> Vec<Seen> {
        self.inner.seen.lock().unwrap().clone()
    }

    /// The chat requests, without the context probes.
    pub fn chats(&self) -> Vec<Seen> {
        self.seen()
            .into_iter()
            .filter(|s| s.path.ends_with("/chat/completions") && s.body["max_tokens"] != 1)
            .collect()
    }

    /// The context probes of "test connection".
    pub fn probes(&self) -> Vec<Seen> {
        self.seen()
            .into_iter()
            .filter(|s| s.path.ends_with("/chat/completions") && s.body["max_tokens"] == 1)
            .collect()
    }
}

async fn handle(State(inner): State<Arc<Inner>>, request: Request<Body>) -> Response {
    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    let authorization = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let bytes = axum::body::to_bytes(request.into_body(), usize::MAX)
        .await
        .unwrap_or_default();
    let body: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    // The context probe of "test connection" (a one-token answer) has its own scripted reply, so scripts of the other
    // chat answers do not have to count it.
    let probe = body["max_tokens"] == 1;
    inner.seen.lock().unwrap().push(Seen {
        method: method.clone(),
        path: path.clone(),
        authorization,
        body,
    });
    let reply = if method == "POST" && path == "/v1/chat/completions" && probe {
        Some(
            inner
                .probe
                .lock()
                .unwrap()
                .clone()
                .unwrap_or_else(|| read_tokens(100_000)),
        )
    } else if method == "POST" && path == "/v1/chat/completions" {
        inner.chats.lock().unwrap().pop_front()
    } else if method == "GET" && path == "/v1/models" {
        Some(inner.models.lock().unwrap().clone().unwrap_or_else(|| {
            Reply::Json(
                200,
                json!({"object": "list", "data": [{"id": "llama3.2:latest"}, {"id": "qwen3:8b"}]}),
            )
        }))
    } else if path == "/elsewhere" {
        Some(Reply::Json(200, json!({"data": []})))
    } else {
        None
    };
    match reply {
        Some(reply) => answer(reply).await,
        None => (StatusCode::NOT_FOUND, "nothing scripted").into_response(),
    }
}

async fn answer(reply: Reply) -> Response {
    match reply {
        Reply::Json(status, value) => (
            StatusCode::from_u16(status).unwrap(),
            [("content-type", "application/json")],
            value.to_string(),
        )
            .into_response(),
        Reply::Raw(status, bytes) => (StatusCode::from_u16(status).unwrap(), bytes).into_response(),
        Reply::Redirect(to) => (StatusCode::TEMPORARY_REDIRECT, [("location", to)]).into_response(),
        Reply::Slow(wait, value) => {
            tokio::time::sleep(wait).await;
            ([("content-type", "application/json")], value.to_string()).into_response()
        }
        Reply::Big(n) => (
            [("content-type", "application/json")],
            json!({"choices": [{"message": {"content": "x".repeat(n)}}]}).to_string(),
        )
            .into_response(),
    }
}

/// A chat answer with tool calls: `(id, name, arguments as the server sends them: text)`.
pub fn calls(list: &[(&str, &str, Value)]) -> Reply {
    let tool_calls: Vec<Value> = list
        .iter()
        .map(|(id, name, args)| {
            json!({"id": id, "type": "function", "function": {"name": name, "arguments": args.to_string()}})
        })
        .collect();
    Reply::Json(
        200,
        json!({"choices": [{"index": 0, "finish_reason": "tool_calls", "message": {"role": "assistant", "content": null, "tool_calls": tool_calls}}]}),
    )
}

/// A chat answer with words only.
pub fn says(text: &str) -> Reply {
    Reply::Json(
        200,
        json!({"choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": text}}]}),
    )
}

/// The answer to the context probe of "test connection": the server reports it read this many tokens of the request.
pub fn read_tokens(tokens: u64) -> Reply {
    Reply::Json(
        200,
        json!({"choices": [{"index": 0, "finish_reason": "length", "message": {"role": "assistant", "content": "h"}}],
               "usage": {"prompt_tokens": tokens, "completion_tokens": 1, "total_tokens": tokens + 1}}),
    )
}

/// A chat answer with words that also reports how many tokens of the request the server read.
pub fn says_after_reading(text: &str, tokens: u64) -> Reply {
    Reply::Json(
        200,
        json!({"choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": text}}],
               "usage": {"prompt_tokens": tokens, "completion_tokens": 5, "total_tokens": tokens + 5}}),
    )
}

/// The error body Ollama sends for a model without tools.
pub fn no_tools(model: &str) -> Reply {
    Reply::Json(
        400,
        json!({"error": {"message": format!("registry.ollama.ai/library/{model} does not support tools"), "type": "api_error"}}),
    )
}

/// A tool handler that records the calls it is given and answers from a table (or with "ok").
#[derive(Default)]
pub struct Scripted {
    pub seen: Mutex<Vec<CheckedCall>>,
    answers: Mutex<HashMap<&'static str, ToolOutcome>>,
}

impl Scripted {
    pub fn answering(tool: &'static str, outcome: ToolOutcome) -> Self {
        let s = Self::default();
        s.answers.lock().unwrap().insert(tool, outcome);
        s
    }

    pub fn tools_seen(&self) -> Vec<&'static str> {
        self.seen.lock().unwrap().iter().map(|c| c.tool).collect()
    }
}

#[async_trait::async_trait]
impl ToolHandler for Scripted {
    async fn call(&self, call: CheckedCall) -> ToolOutcome {
        let outcome = self
            .answers
            .lock()
            .unwrap()
            .get(call.tool)
            .cloned()
            .unwrap_or(ToolOutcome {
                ok: true,
                text: format!("ran {}", call.tool),
                image: None,
            });
        self.seen.lock().unwrap().push(call);
        outcome
    }
}
