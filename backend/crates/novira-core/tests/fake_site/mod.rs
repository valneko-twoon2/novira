//! A fake outside site for the download tests: one HTTP server on a loopback port that stands in for Civitai, Hugging
//! Face, GitHub and the other fixed hosts at once. Debug builds of `novira-core` let `NOVIRA_TEST_<SERVICE>_BASE` point a
//! service at such a server (see `src/endpoints.rs`), so no request leaves this PC.
//!
//! The server and the variables are set up once per test binary (the variables are process-wide). Tests register
//! routes under paths of their own (a model id or a repository name nobody else uses), so they can share the server.
#![allow(dead_code)]
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex, OnceLock};

/// What a route answers.
#[derive(Clone)]
pub struct Route {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    /// Announce this many bytes in `Content-Length` although fewer are sent (the connection then ends early).
    pub announced: Option<usize>,
}

impl Route {
    pub fn bytes(body: impl Into<Vec<u8>>) -> Route {
        Route {
            status: 200,
            headers: Vec::new(),
            body: body.into(),
            announced: None,
        }
    }

    pub fn json(value: &serde_json::Value) -> Route {
        Route::bytes(serde_json::to_vec(value).unwrap())
    }

    pub fn status(code: u16) -> Route {
        Route {
            status: code,
            headers: Vec::new(),
            body: Vec::new(),
            announced: None,
        }
    }

    pub fn announcing(mut self, length: usize) -> Route {
        self.announced = Some(length);
        self
    }

    pub fn with_header(mut self, name: &str, value: &str) -> Route {
        self.headers.push((name.into(), value.into()));
        self
    }
}

/// A request the server saw.
#[derive(Clone, Debug)]
pub struct Seen {
    /// Path and query, as sent.
    pub target: String,
    pub authorization: Option<String>,
    pub accept_encoding: Option<String>,
    /// The `Range` header, as sent (a resumed download asks for `bytes=<n>-`).
    pub range: Option<String>,
}

pub struct Site {
    /// `http://127.0.0.1:<port>`
    pub base: String,
    routes: Mutex<HashMap<String, Route>>,
    seen: Mutex<Vec<Seen>>,
}

impl Site {
    /// Answers `path` (without a query) with `route`.
    pub fn put(&self, path: &str, route: Route) {
        self.routes.lock().unwrap().insert(path.into(), route);
    }

    pub fn put_json(&self, path: &str, value: &serde_json::Value) {
        self.put(path, Route::json(value));
    }

    /// The requests made for `path` (without a query), in order.
    pub fn requests(&self, path: &str) -> Vec<Seen> {
        self.seen
            .lock()
            .unwrap()
            .iter()
            .filter(|s| s.target.split('?').next() == Some(path))
            .cloned()
            .collect()
    }
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        _ => "Status",
    }
}

fn handle(mut stream: TcpStream, site: &Site) {
    let mut head = Vec::new();
    let mut buf = [0u8; 2048];
    while !head.windows(4).any(|w| w == b"\r\n\r\n") {
        match stream.read(&mut buf) {
            Ok(0) | Err(_) => return,
            Ok(n) => head.extend_from_slice(&buf[..n]),
        }
    }
    let text = String::from_utf8_lossy(&head).into_owned();
    let target = text.split_whitespace().nth(1).unwrap_or("/").to_string();
    let authorization = text.lines().find_map(|l| {
        let (k, v) = l.split_once(':')?;
        k.eq_ignore_ascii_case("authorization")
            .then(|| v.trim().to_string())
    });
    let accept_encoding = text.lines().find_map(|l| {
        let (k, v) = l.split_once(':')?;
        k.eq_ignore_ascii_case("accept-encoding")
            .then(|| v.trim().to_string())
    });
    let header = |name: &str| {
        text.lines().find_map(|l| {
            let (k, v) = l.split_once(':')?;
            k.eq_ignore_ascii_case(name).then(|| v.trim().to_string())
        })
    };
    let range = header("range");
    site.seen.lock().unwrap().push(Seen {
        target: target.clone(),
        authorization,
        accept_encoding,
        range: range.clone(),
    });
    let path = target.split('?').next().unwrap_or("/");
    let route = site
        .routes
        .lock()
        .unwrap()
        .get(path)
        .cloned()
        .unwrap_or_else(|| Route::status(404));
    // A route with an ETag honours `Range: bytes=<n>-` when `If-Range` names that ETag (or is absent), like a file server.
    let etag = route
        .headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("etag"))
        .map(|(_, v)| v.clone());
    let start = range
        .as_deref()
        .and_then(|r| r.strip_prefix("bytes="))
        .and_then(|r| r.strip_suffix('-'))
        .and_then(|n| n.parse::<usize>().ok());
    let if_range = header("if-range");
    let ranged = match start {
        Some(from)
            if etag.is_some()
                && route.status == 200
                && from < route.body.len()
                && (if_range.is_none() || if_range == etag) =>
        {
            Some(from)
        }
        _ => None,
    };
    let body = match ranged {
        Some(from) => route.body[from..].to_vec(),
        None => route.body.clone(),
    };
    let mut out = format!(
        "HTTP/1.1 {} {}\r\nContent-Length: {}\r\nConnection: close\r\n",
        if ranged.is_some() { 206 } else { route.status },
        if ranged.is_some() {
            "Partial Content"
        } else {
            reason(route.status)
        },
        route
            .announced
            .filter(|_| ranged.is_none())
            .unwrap_or(body.len())
    );
    if let Some(from) = ranged {
        out.push_str(&format!(
            "Content-Range: bytes {from}-{}/{}\r\n",
            route.body.len() - 1,
            route.body.len()
        ));
    }
    for (k, v) in &route.headers {
        out.push_str(&format!("{k}: {v}\r\n"));
    }
    out.push_str("\r\n");
    let _ = stream.write_all(out.as_bytes());
    // Two pieces, so a download reports progress more than once.
    let mid = body.len() / 2;
    let _ = stream.write_all(&body[..mid]);
    let _ = stream.flush();
    let _ = stream.write_all(&body[mid..]);
}

/// The server of this test binary. The first call starts it and points every service at it.
pub fn site() -> &'static Site {
    static SITE: OnceLock<Arc<Site>> = OnceLock::new();
    SITE.get_or_init(|| {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port());
        let site = Arc::new(Site {
            base: base.clone(),
            routes: Mutex::new(HashMap::new()),
            seen: Mutex::new(Vec::new()),
        });
        let served = site.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let site = served.clone();
                std::thread::spawn(move || handle(stream, &site));
            }
        });
        for name in [
            "NOVIRA_TEST_CIVITAI_BASE",
            "NOVIRA_TEST_HUGGINGFACE_BASE",
            "NOVIRA_TEST_GITHUB_BASE",
            "NOVIRA_TEST_CODELOAD_BASE",
            "NOVIRA_TEST_GITHUB_API_BASE",
            "NOVIRA_TEST_COMFY_REGISTRY_BASE",
            "NOVIRA_TEST_SEVENZIP_BASE",
            "NOVIRA_TEST_TRUSTMARK_BASE",
            "NOVIRA_TEST_WIKIPEDIA_JA_BASE",
            "NOVIRA_TEST_WIKIPEDIA_EN_BASE",
        ] {
            std::env::set_var(name, &base);
        }
        site
    })
}

/// An HTTP client that never uses a proxy, so a system proxy cannot get in the way of loopback.
pub fn client() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap()
}
