//! The OpenAI-compatible server the assistant can be connected to (Ollama, LM Studio, llama.cpp, vLLM, hosted
//! services): its saved settings, the address check, the HTTP calls (`GET /models`, `POST /chat/completions`) and the
//! "test connection" check. Every call is made here, by the backend, never by the window.
//!
//! The address and the key are the user's own data, and what the server answers is data too: it is read as JSON with
//! a size cap, its text is shown or passed to the app's tools only after the checks of `tools::check_call`, and
//! nothing in it is ever treated as an instruction to the app. The key travels only in the `Authorization` header,
//! never in a URL, and never appears in an error text or the log (`Endpoint::redact`).
use super::*;
use reqwest::Url;
use serde_json::json;
use std::net::IpAddr;

/// The preset address of a local Ollama.
pub const OLLAMA_URL: &str = "http://127.0.0.1:11434/v1";
/// The longest address and model name kept.
const MAX_URL_CHARS: usize = 200;
const MAX_MODEL_CHARS: usize = 200;
/// The largest answer of a chat request, of the model list, and of an error body that is read.
pub const MAX_ANSWER_BYTES: usize = 4 * 1024 * 1024;
const MAX_LIST_BYTES: usize = 1024 * 1024;
const MAX_ERROR_BYTES: usize = 64 * 1024;
/// The most models listed, and the longest piece of a server's message shown.
const MAX_LISTED: usize = 500;
const MAX_MESSAGE_CHARS: usize = 300;
/// Time for a model list, for one chat call (a local model may load first), and for the tool check of the test.
pub const LIST_TIMEOUT: Duration = Duration::from_secs(15);
pub const CALL_TIMEOUT: Duration = Duration::from_secs(300);
const TEST_TIMEOUT: Duration = Duration::from_secs(120);
/// Redirects followed (only inside the same host).
const MAX_REDIRECTS: usize = 3;

/// What is known about the model's ability to call the app's tools.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentToolsState {
    /// Not tested yet.
    #[default]
    Unknown,
    /// A test call round trip worked.
    Supported,
    /// The server refused tools, or the model did not make a valid call; `tools_reason` says why.
    Unsupported,
}

/// The saved server: address, model and what is known about its tools. The key is a secret kept apart (`secret.rs`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointConfig {
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub tools: AgentToolsState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools_reason: Option<String>,
}

/// What the window may know about the saved server (never the key itself).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEndpointInfo {
    pub base_url: String,
    pub model: String,
    pub has_key: bool,
    /// The address is not on this PC: the pictures and prompts the assistant reads would leave it.
    pub remote: bool,
    /// The address is `http` and not on this PC: everything, the key included, travels unencrypted.
    pub insecure: bool,
    pub tools: AgentToolsState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools_reason: Option<String>,
}

impl EndpointConfig {
    pub fn info(&self, has_key: bool) -> AgentEndpointInfo {
        let (remote, insecure) = match parse_base_url(&self.base_url) {
            Ok(url) => (
                !is_loopback(&url),
                url.scheme() == "http" && !is_loopback(&url),
            ),
            Err(_) => (true, false),
        };
        AgentEndpointInfo {
            base_url: self.base_url.clone(),
            model: self.model.clone(),
            has_key,
            remote,
            insecure,
            tools: self.tools,
            tools_reason: self.tools_reason.clone(),
        }
    }
}

/// The server's settings as the window sends them. `api_key`: absent keeps the saved key (only for the same address),
/// an empty text removes it, any other text replaces it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEndpointInput {
    pub base_url: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub api_key: Option<String>,
}

/// The result of "test connection".
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEndpointTest {
    /// The server answered at all.
    pub reachable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// The model is among the server's models (none when the server lists none or the model was not asked about).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_found: Option<bool>,
    pub tools: AgentToolsState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools_reason: Option<String>,
}

/// A key that never shows itself: `Debug` hides it, and it leaves only through `expose`.
#[derive(Clone)]
pub struct ApiKey(String);

impl ApiKey {
    pub fn new(key: &str) -> Option<Self> {
        let key = key.trim();
        (!key.is_empty()).then(|| Self(key.to_string()))
    }

    fn expose(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Debug for ApiKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ApiKey(***)")
    }
}

/// Reads an address: `http` or `https` with a host, no user name or password, no query or fragment, no spaces. The
/// trailing slashes are dropped, so `…/v1/` and `…/v1` are the same.
pub fn parse_base_url(text: &str) -> Result<Url, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("Enter the server's address".into());
    }
    if text.chars().count() > MAX_URL_CHARS {
        return Err("The address is too long".into());
    }
    if text.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("The address must not contain spaces".into());
    }
    let mut url = Url::parse(text).map_err(|_| "This is not a valid address".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("The address must start with http:// or https://".into());
    }
    if url.host_str().is_none_or(str::is_empty) {
        return Err("The address needs a host name".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Do not put a user name or password in the address; use the key field".into());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("The address must not have a query or a fragment".into());
    }
    let path = url.path().trim_end_matches('/').to_string();
    url.set_path(&path);
    Ok(url)
}

/// The address as it is saved and compared: checked, without trailing slashes.
pub fn normalize_base_url(text: &str) -> Result<String, String> {
    parse_base_url(text).map(|url| url.as_str().trim_end_matches('/').to_string())
}

/// Whether the address is on this PC (`localhost` or a loopback IP).
pub fn is_loopback(url: &Url) -> bool {
    // The parser has already turned any spelling of an IPv4 address (`127.1`, `0x7f.1`) into dotted form.
    let host = url
        .host_str()
        .unwrap_or("")
        .trim_start_matches('[')
        .trim_end_matches(']');
    host.eq_ignore_ascii_case("localhost")
        || host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
}

/// A model name worth sending: not empty, not long, no control characters.
pub fn valid_model(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Enter or choose the model's name".into());
    }
    if name.chars().count() > MAX_MODEL_CHARS || name.chars().any(char::is_control) {
        return Err("This model name is not valid".into());
    }
    Ok(name.to_string())
}

/// Why a call failed: the HTTP status when the server answered, and a message that is safe to show.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CallError {
    pub status: Option<u16>,
    pub message: String,
}

impl std::fmt::Display for CallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl CallError {
    fn new(status: Option<u16>, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    /// The server refused `tools` (or the model has none): the answer says so in its own words.
    pub fn rejects_tools(&self) -> bool {
        if !matches!(self.status, Some(400 | 404 | 405 | 415 | 422 | 500 | 501)) {
            return false;
        }
        let text = self.message.to_lowercase();
        let about_tools = text.contains("tool") || text.contains("function call");
        about_tools
            && [
                "not support",
                "unsupport",
                "doesn't support",
                "does not support",
                "requires",
                "not enabled",
                "not available",
            ]
            .iter()
            .any(|w| text.contains(w))
    }
}

/// A connection to one server.
#[derive(Debug, Clone)]
pub struct Endpoint {
    base: Url,
    key: Option<ApiKey>,
    http: reqwest::Client,
}

impl Endpoint {
    /// Checks the address and builds the client. A redirect is followed only inside the same host (and from `http` to
    /// `https`), at most three times: the key must not follow a redirect to another host.
    pub fn new(base_url: &str, key: Option<ApiKey>) -> Result<Self, String> {
        let base = parse_base_url(base_url)?;
        let policy = reqwest::redirect::Policy::custom(|attempt| {
            let allowed = attempt.previous().len() <= MAX_REDIRECTS
                && attempt.previous().last().is_some_and(|from| {
                    let to = attempt.url();
                    from.host_str() == to.host_str()
                        && (from.origin() == to.origin()
                            || (from.scheme() == "http" && to.scheme() == "https"))
                });
            if allowed {
                attempt.follow()
            } else {
                attempt.stop()
            }
        });
        let mut builder = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .user_agent("novira")
            .redirect(policy);
        if is_loopback(&base) {
            // A server on this PC is never reached through a proxy.
            builder = builder.no_proxy();
        }
        let http = builder
            .build()
            .map_err(|e| format!("cannot prepare the connection: {e}"))?;
        Ok(Self { base, key, http })
    }

    pub fn base(&self) -> &Url {
        &self.base
    }

    fn url(&self, path: &str) -> String {
        format!("{}/{path}", self.base.as_str().trim_end_matches('/'))
    }

    /// The text with the key taken out, control characters and everything past a few hundred characters dropped.
    fn redact(&self, text: &str) -> String {
        let mut text = text.to_string();
        if let Some(key) = &self.key {
            text = text.replace(key.expose(), "***");
        }
        text.chars()
            .filter(|c| !c.is_control() || *c == '\n')
            .take(MAX_MESSAGE_CHARS)
            .collect::<String>()
            .trim()
            .to_string()
    }

    fn transport(&self, e: reqwest::Error) -> CallError {
        let e = e.without_url();
        let text = if e.is_timeout() {
            "the server did not answer in time".to_string()
        } else if e.is_connect() {
            "cannot connect to the server; is it running, and is the address right?".to_string()
        } else {
            format!("the connection failed: {e}")
        };
        CallError::new(None, self.redact(&text))
    }

    /// Sends the request and reads the answer as JSON, at most `cap` bytes of it.
    async fn send(
        &self,
        request: reqwest::RequestBuilder,
        timeout: Duration,
        cap: usize,
    ) -> Result<Value, CallError> {
        let mut request = request.timeout(timeout);
        if let Some(key) = &self.key {
            request = request.bearer_auth(key.expose());
        }
        let mut response = request.send().await.map_err(|e| self.transport(e))?;
        let status = response.status();
        let limit = if status.is_success() {
            cap
        } else {
            MAX_ERROR_BYTES
        };
        let mut body: Vec<u8> = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|e| self.transport(e))? {
            body.extend_from_slice(&chunk);
            if body.len() > limit {
                if status.is_success() {
                    return Err(CallError::new(
                        Some(status.as_u16()),
                        "the server's answer is too large",
                    ));
                }
                body.truncate(limit);
                break;
            }
        }
        let json: Option<Value> = serde_json::from_slice(&body).ok();
        if !status.is_success() {
            let said = json
                .as_ref()
                .and_then(|j| {
                    j["error"]["message"]
                        .as_str()
                        .or_else(|| j["error"].as_str())
                        .or_else(|| j["message"].as_str())
                })
                .map(str::to_string)
                .unwrap_or_else(|| String::from_utf8_lossy(&body).into_owned());
            let said = self.redact(&said);
            let message = if said.is_empty() {
                format!("the server answered {}", status.as_u16())
            } else {
                format!("the server answered {}: {said}", status.as_u16())
            };
            return Err(CallError::new(Some(status.as_u16()), message));
        }
        let json = json.ok_or_else(|| {
            CallError::new(
                Some(status.as_u16()),
                "the server's answer is not JSON; is this the address of an OpenAI-compatible API (ending in /v1)?",
            )
        })?;
        if let Some(error) = json.get("error").filter(|e| !e.is_null()) {
            let said = error["message"].as_str().or_else(|| error.as_str());
            return Err(CallError::new(
                Some(status.as_u16()),
                self.redact(&format!(
                    "the server reported an error: {}",
                    said.unwrap_or("unknown")
                )),
            ));
        }
        Ok(json)
    }

    /// `POST {base}/chat/completions` with the body.
    pub async fn chat_completions(
        &self,
        body: &Value,
        timeout: Duration,
    ) -> Result<Value, CallError> {
        let request = self.http.post(self.url("chat/completions")).json(body);
        self.send(request, timeout, MAX_ANSWER_BYTES).await
    }

    /// `GET {base}/models`: the names of the models the server offers, sorted. Servers that do not list models answer
    /// with an error; the window then lets the user type the name.
    pub async fn list_models(&self) -> Result<Vec<String>, CallError> {
        let json = self
            .send(
                self.http.get(self.url("models")),
                LIST_TIMEOUT,
                MAX_LIST_BYTES,
            )
            .await?;
        let mut names: Vec<String> = json["data"]
            .as_array()
            .ok_or_else(|| {
                CallError::new(Some(200), "the server's model list has an unexpected shape")
            })?
            .iter()
            .filter_map(|m| m["id"].as_str())
            .filter(|id| valid_model(id).is_ok())
            .map(str::to_string)
            .take(MAX_LISTED)
            .collect();
        names.sort();
        names.dedup();
        Ok(names)
    }

    /// Checks the server, the model and a tool-call round trip with a trivial tool. The tool is not run: the call
    /// the model makes is only checked against the tool's schema.
    pub async fn test(&self, model: &str) -> AgentEndpointTest {
        let mut result = AgentEndpointTest {
            reachable: false,
            error: None,
            model_found: None,
            tools: AgentToolsState::Unknown,
            tools_reason: None,
        };
        match self.list_models().await {
            Ok(names) => {
                result.reachable = true;
                result.model_found = Some(
                    names
                        .iter()
                        .any(|n| n == model || *n == format!("{model}:latest")),
                );
            }
            // The server answered but lists no models (or wants a key): still reachable, the chat call tells more.
            Err(e) if e.status.is_some() => result.reachable = true,
            Err(e) => {
                result.error = Some(e.message);
                return result;
            }
        }
        if valid_model(model).is_err() {
            result.error = Some("No model is chosen".into());
            return result;
        }
        match self.tool_round_trip(model).await {
            Ok(()) => result.tools = AgentToolsState::Supported,
            Err(ToolCheck::Unsupported(reason)) => {
                result.tools = AgentToolsState::Unsupported;
                result.tools_reason = Some(reason);
            }
            Err(ToolCheck::Failed(e)) => {
                if e.status == Some(404) {
                    result.model_found = Some(false);
                }
                result.error = Some(e.message);
            }
        }
        result
    }

    async fn tool_round_trip(&self, model: &str) -> Result<(), ToolCheck> {
        // First: does the server read the whole request the assistant really sends (all the tools and rules)?
        let probe = toolloop::context_probe(model);
        let probed = self
            .chat_completions(&probe, TEST_TIMEOUT)
            .await
            .map_err(|e| {
                if e.rejects_tools() {
                    ToolCheck::Unsupported(e.message)
                } else {
                    ToolCheck::Failed(e)
                }
            })?;
        if let Some(reason) = toolloop::cut_short(&probe, &probed) {
            return Err(ToolCheck::Unsupported(reason));
        }
        let tools = toolloop::tool_specs(Some("get_screen"));
        let mut messages = vec![
            json!({"role": "system", "content": "You are testing a connection. Call the get_screen tool once, then reply with one word."}),
            json!({"role": "user", "content": "Which screen am I on?"}),
        ];
        let first = self
            .chat_completions(
                &json!({"model": model, "messages": messages, "tools": tools, "tool_choice": "auto", "stream": false}),
                TEST_TIMEOUT,
            )
            .await
            .map_err(|e| {
                if e.rejects_tools() {
                    ToolCheck::Unsupported(e.message)
                } else {
                    ToolCheck::Failed(e)
                }
            })?;
        let message = &first["choices"][0]["message"];
        let calls = message["tool_calls"].as_array().filter(|c| !c.is_empty());
        let Some(call) = calls.and_then(|c| c.first()) else {
            return Err(ToolCheck::Unsupported(
                "the model answered in words instead of calling the tool".into(),
            ));
        };
        let parsed = toolloop::read_call(call, 0);
        if parsed.name != "get_screen" {
            return Err(ToolCheck::Unsupported(format!(
                "the model called `{}` instead of the tool it was given",
                parsed.name.chars().take(60).collect::<String>()
            )));
        }
        let args = parsed.args.clone().map_err(|why| {
            ToolCheck::Unsupported(format!("the model's call is not valid: {why}"))
        })?;
        tools::check_call(&parsed.name, Some(&args)).map_err(|why| {
            ToolCheck::Unsupported(format!("the model's call is not valid: {why}"))
        })?;
        messages.push(toolloop::assistant_message(
            message,
            std::slice::from_ref(&parsed),
        ));
        messages.push(toolloop::tool_message(&parsed, r#"{"screen":"generate"}"#));
        self.chat_completions(
            &json!({"model": model, "messages": messages, "tools": tools, "tool_choice": "auto", "stream": false}),
            TEST_TIMEOUT,
        )
        .await
        .map_err(|e| ToolCheck::Unsupported(format!("the model could not take a tool's result: {e}")))?;
        Ok(())
    }
}

/// Why the tool check of the test did not pass.
enum ToolCheck {
    /// The model or the server cannot do tool calls, for this reason.
    Unsupported(String),
    /// The check could not be made (the model is missing, the server failed).
    Failed(CallError),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses_are_http_or_https_with_a_host_and_nothing_secret_in_them() {
        let ok = |t: &str| parse_base_url(t).unwrap().to_string();
        assert_eq!(ok("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1");
        assert_eq!(
            ok(" https://api.example.com/v1/ "),
            "https://api.example.com/v1"
        );
        assert_eq!(ok("http://localhost:1234/v1//"), "http://localhost:1234/v1");
        for bad in [
            "",
            "   ",
            "ftp://x/v1",
            "file:///C:/x",
            "javascript:alert(1)",
            "127.0.0.1:11434/v1",
            "http://",
            "http://user:pass@host/v1",
            "http://user@host/v1",
            "http://host/v1?key=abc",
            "http://host/v1#x",
            "http://ho st/v1",
            "http://host/v1\r\nX: y",
            &format!("http://{}/v1", "a".repeat(300)),
        ] {
            assert!(parse_base_url(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn only_this_pc_counts_as_loopback() {
        let loopback = |t: &str| is_loopback(&parse_base_url(t).unwrap());
        assert!(loopback("http://127.0.0.1:11434/v1"));
        assert!(loopback("http://127.9.9.9/v1"));
        assert!(loopback("http://localhost/v1"));
        assert!(loopback("http://LocalHost:8080/v1"));
        assert!(loopback("http://[::1]:8080/v1"));
        assert!(!loopback("http://192.168.1.5:11434/v1"));
        assert!(!loopback("http://localhost.evil.example/v1"));
        assert!(!loopback("https://api.openai.com/v1"));
        assert!(!loopback("http://0.0.0.0/v1"));
    }

    #[test]
    fn a_remote_http_address_is_flagged_as_unencrypted_and_a_remote_https_is_not() {
        let info = |url: &str| {
            EndpointConfig {
                base_url: url.into(),
                model: "m".into(),
                tools: AgentToolsState::Unknown,
                tools_reason: None,
            }
            .info(true)
        };
        let local = info("http://127.0.0.1:11434/v1");
        assert!(!local.remote && !local.insecure);
        let lan = info("http://192.168.1.5:11434/v1");
        assert!(lan.remote && lan.insecure);
        let hosted = info("https://api.example.com/v1");
        assert!(hosted.remote && !hosted.insecure);
        // An address that cannot be read counts as remote, so a prompt about reading never calls it local.
        assert!(info("nonsense").remote);
    }

    #[test]
    fn the_key_never_shows_in_debug_output_or_in_a_message() {
        let key = ApiKey::new("  sk-secret-123  ").unwrap();
        assert!(!format!("{key:?}").contains("secret"));
        let endpoint = Endpoint::new("http://127.0.0.1:1/v1", Some(key)).unwrap();
        assert!(!format!("{endpoint:?}").contains("sk-secret-123"));
        let shown = endpoint.redact("bad key sk-secret-123 given\u{7}");
        assert_eq!(shown, "bad key *** given");
        assert!(ApiKey::new("   ").is_none());
    }

    #[test]
    fn a_server_that_refuses_tools_is_told_from_other_errors() {
        let err = |status: u16, text: &str| CallError::new(Some(status), text).rejects_tools();
        assert!(err(
            400,
            "registry.ollama.ai/library/gemma:2b does not support tools"
        ));
        assert!(err(400, "tools param requires --jinja flag"));
        assert!(err(
            400,
            "\"auto\" tool choice requires --enable-auto-tool-choice"
        ));
        assert!(err(501, "Function calling is not supported"));
        assert!(!err(400, "invalid JSON in request"));
        assert!(!err(404, "model \"x\" not found"));
        assert!(!err(401, "tools are not supported for this key"));
        assert!(!CallError::new(None, "does not support tools").rejects_tools());
    }
}
