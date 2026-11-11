//! Fuzzing of the server inside the desktop app: what only the app adds to the browser server.
//!
//! - The management calls of the window (`Embedded::manage`): damaged paths, methods and bodies. Every call ends in
//!   time, a path that is not a management route never reaches the router, nothing answers 500 unless the request
//!   cannot be built, and the listener opens, and a network is trusted, only by the call meant for it.
//! - The rewriting of picture URLs (`to_page`, `from_page`): generated JSON. Only a string that starts with the base is
//!   written, the shape stays, and the two ways undo each other.
//! - The files built into the app as a paired phone reaches them: damaged paths. The app's reader (the asset resolver
//!   in the desktop app) is only ever asked for a clean relative path, and only a file it has is answered.
//!
//! Fixed seed, 300 cases each in the ordinary run; longer: `NOVIRA_FUZZ_ITERATIONS=5000 NOVIRA_FUZZ_SEED=<n>`.
use super::*;
use crate::lan_tests::{ask_router, json_of, phone_headers, Bench, HOME, PHONE};
use crate::{Ca, Control, NetworkInfo};
use axum::http::{StatusCode, Uri};
use serde_json::json;
use std::sync::Mutex as StdMutex;
use std::time::Duration;

const APP_BASE: &str = "http://novira-image.localhost";
const MAC: crate::Mac = [0x02, 0x11, 0x22, 0x33, 0x44, 0x55];
const SLOWEST: Duration = Duration::from_secs(10);

fn setting(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn cases() -> u64 {
    setting("NOVIRA_FUZZ_ITERATIONS", 300)
}

/// xorshift64*, as `tests/http_fuzz.rs`.
struct Rng(u64);

impl Rng {
    fn seeded(salt: u64) -> Rng {
        Rng((setting("NOVIRA_FUZZ_SEED", 0x6e6f_7669_7261) ^ salt) | 1)
    }

    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn below(&mut self, n: usize) -> usize {
        (self.next() % n.max(1) as u64) as usize
    }

    fn chance(&mut self, percent: usize) -> bool {
        self.below(100) < percent
    }

    fn pick<'a, T>(&mut self, list: &'a [T]) -> &'a T {
        &list[self.below(list.len())]
    }
}

/// Text made of pieces that sit near the edges of the checks.
fn text(rng: &mut Rng, pieces: &[&str]) -> String {
    (0..rng.below(5)).map(|_| *rng.pick(pieces)).collect()
}

const STRING_PIECES: &[&str] = &[
    "",
    "/novira-image/",
    "/novira-image",
    "http://novira-image.localhost/",
    "http://novira-image.localhost",
    "HTTP://NOVIRA-IMAGE.LOCALHOST/",
    "full/",
    "thumb/",
    "a.png",
    "../",
    "%2e%2e/",
    "\\",
    "\"",
    " ",
    "\u{0}",
    "é",
    "🙂",
    "/",
    "x",
];

fn value(rng: &mut Rng, depth: usize) -> Value {
    match rng.below(if depth == 0 { 4 } else { 6 }) {
        0 => Value::Null,
        1 => json!(rng.chance(50)),
        2 => json!(rng.next() as i64),
        3 => Value::String(text(rng, STRING_PIECES)),
        4 => Value::Array((0..rng.below(4)).map(|_| value(rng, depth - 1)).collect()),
        _ => Value::Object(
            (0..rng.below(4))
                .map(|_| (text(rng, STRING_PIECES), value(rng, depth - 1)))
                .collect(),
        ),
    }
}

/// Walks `before` and `after` together: the same shape, and each string of `after` is what `expect` makes of the one
/// in `before`.
fn same_shape(before: &Value, after: &Value, expect: &dyn Fn(&str) -> String) -> bool {
    match (before, after) {
        (Value::String(a), Value::String(b)) => expect(a) == *b,
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(x, y)| same_shape(x, y, expect))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .zip(b)
                    .all(|((ka, va), (kb, vb))| ka == kb && same_shape(va, vb, expect))
        }
        (a, b) => a == b,
    }
}

fn any_string(value: &Value, test: &dyn Fn(&str) -> bool) -> bool {
    match value {
        Value::String(s) => test(s),
        Value::Array(items) => items.iter().any(|v| any_string(v, test)),
        Value::Object(map) => map.values().any(|v| any_string(v, test)),
        _ => false,
    }
}

// tags: error-guessing
#[test]
fn picture_urls_are_rewritten_only_from_their_start_and_both_ways_undo_each_other() {
    let data = tempfile::tempdir().unwrap();
    let rt = tokio::runtime::Runtime::new().unwrap();
    let _inside = rt.enter();
    let backend = novira_core::startup::open_backend(data.path(), APP_BASE.into()).unwrap();
    let (server, _) = embed(
        backend,
        Frontend::Embedded(Arc::new(|_| None)),
        APP_BASE.into(),
    );
    let state = &server.state;
    let (app, page) = (format!("{APP_BASE}/"), format!("{IMAGE_URL_BASE}/"));
    let mut rng = Rng::seeded(1);
    for case in 0..cases() {
        let before = value(&mut rng, 4);
        let mut out = before.clone();
        to_page(state, &mut out);
        let written = |s: &str| match s.strip_prefix(&app) {
            Some(rest) => format!("{page}{rest}"),
            None => s.to_string(),
        };
        assert!(
            same_shape(&before, &out, &written),
            "to_page, case {case}: {before} -> {out}"
        );
        let mut back = before.clone();
        from_page(state, &mut back);
        let read = |s: &str| match s.strip_prefix(&page) {
            Some(rest) => format!("{app}{rest}"),
            None => s.to_string(),
        };
        assert!(
            same_shape(&before, &back, &read),
            "from_page, case {case}: {before} -> {back}"
        );
        // A value with no string of this server's form comes back as it was.
        if !any_string(&before, &|s| s.starts_with(&page)) {
            let mut round = out.clone();
            from_page(state, &mut round);
            assert_eq!(round, before, "round trip, case {case}");
        }
        // As text: the same as on the value, and text that is not JSON is passed through.
        let as_text = serde_json::to_string(&before).unwrap();
        assert_eq!(
            json_of(&text_to_page(state, as_text)),
            out,
            "text, case {case}"
        );
        let broken = text(&mut rng, STRING_PIECES) + "{";
        assert_eq!(
            text_to_page(state, broken.clone()),
            broken,
            "broken text, case {case}"
        );
    }
}

const ROUTES: &[&str] = &[
    "/lan/state",
    "/lan/open",
    "/lan/close",
    "/lan/trust",
    "/lan/untrust",
    "/pair/code",
    "/pair/state",
    "/pair/approve",
    "/pair/deny",
    "/pair/revoke",
];

const OTHER_PATHS: &[&str] = &[
    "/api/bootstrap",
    "/api/set_hf_token",
    "/",
    "/index.html",
    "/events",
    "/ca.crt",
    "/pair",
    "/pair.js",
    "/pair/request",
    "/pair/status",
    "/upload/image",
    "/novira-image/full/a.png",
    "/lanx",
    "/pairing/code",
    "lan/state",
    "",
];

/// A path near the management routes: one of them or another route, damaged.
fn path(rng: &mut Rng) -> String {
    let base = if rng.chance(70) {
        rng.pick(ROUTES)
    } else {
        rng.pick(OTHER_PATHS)
    }
    .to_string();
    match rng.below(12) {
        0 => format!("{base}/"),
        1 => base.to_uppercase(),
        2 => base.replacen('/', "//", 1),
        3 => format!("{base}?token=x&a=%00"),
        4 => format!("{base}#frag"),
        5 => format!("{base}/../../api/bootstrap"),
        6 => base.replace('/', "/%2e%2e/"),
        7 => format!("{base} HTTP/1.1\r\nHost: evil"),
        8 => format!("{base}{}", "a".repeat(rng.below(5000))),
        9 => format!("{base}\u{0}é"),
        _ => base,
    }
}

const FIELDS: &[&str] = &["id", "gatewayMac", "label", "code", "poll", "", "ID"];

/// A body: none, an object with fields of the routes holding any kind of value, or another JSON value.
fn body(rng: &mut Rng) -> Option<Value> {
    match rng.below(5) {
        0 => None,
        1 => Some(value(rng, 3)),
        _ => {
            let mac = crate::mac_text(&MAC);
            let mut map = serde_json::Map::new();
            for _ in 0..rng.below(4) {
                let field = rng.pick(FIELDS).to_string();
                let v = match rng.below(7) {
                    0 => json!(mac),
                    1 => json!("home"),
                    2 => json!("x".repeat(rng.below(3000))),
                    3 => json!("\u{202e}\u{7}label"),
                    4 => value(rng, 2),
                    5 => json!(""),
                    _ => json!(text(rng, STRING_PIECES)),
                };
                map.insert(field, v);
            }
            Some(Value::Object(map))
        }
    }
}

const METHODS: &[&str] = &["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

/// The app's server over a home network on loopback that is not trusted yet.
fn app_server(data: &std::path::Path) -> (Embedded, Backend) {
    let backend = novira_core::startup::open_backend(data, APP_BASE.into()).unwrap();
    let (server, sink) = embed(
        backend.clone(),
        Frontend::Embedded(Arc::new(|_| None)),
        APP_BASE.into(),
    );
    backend.set_event_sink(sink);
    let probe: crate::Probe = Arc::new(|| {
        Some(NetworkInfo {
            address: HOME,
            bind: Ipv4Addr::LOCALHOST,
            gateway_mac: Some(MAC),
            windows_public: Some(false),
        })
    });
    server.enable_lan(Control::new(
        data.to_path_buf(),
        Ca::generate().unwrap(),
        probe,
    ));
    (server, backend)
}

// tags: error-guessing
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn damaged_management_calls_end_in_time_and_open_nothing_they_should_not() {
    let data = tempfile::tempdir().unwrap();
    let (server, backend) = app_server(data.path());
    let mut rng = Rng::seeded(2);
    for case in 0..cases() {
        let before = server.manage(Method::GET, "/lan/state", None).await.body;
        let (method, path, sent) = (
            rng.pick(METHODS).to_string(),
            path(&mut rng),
            body(&mut rng),
        );
        let call = server.manage(
            Method::from_bytes(method.as_bytes()).unwrap(),
            &path,
            sent.clone(),
        );
        let Ok(answer) = tokio::time::timeout(SLOWEST, call).await else {
            panic!("case {case}: {method} {path:?} took longer than {SLOWEST:?}");
        };
        let what = format!("case {case}: {method} {path:?} {sent:?} -> {answer:?}");
        let management = lan::is_management(&path) || pair::is_management(&path);
        if !management {
            assert_eq!(answer.status, 404, "{what}");
            assert_eq!(answer.body["code"], "unknown", "{what}");
        }
        if answer.status == 500 {
            assert!(path.parse::<Uri>().is_err(), "an internal error: {what}");
        }
        let after = server.manage(Method::GET, "/lan/state", None).await.body;
        let post = method == "POST";
        if after["open"] == true && before["open"] != true {
            assert!(post && path == "/lan/open", "opened by {what}");
        }
        if after["network"]["trusted"] == true && before["network"]["trusted"] != true {
            assert!(post && path == "/lan/trust", "trusted by {what}");
        }
        if after["open"] != true && before["open"] == true {
            assert!(
                post && matches!(path.as_str(), "/lan/close" | "/lan/untrust"),
                "closed by {what}"
            );
        }
    }
    server.stop().await;
    backend.shutdown();
}

/// Whether a path handed to the app's reader is a clean, decoded relative path inside the build.
fn clean(path: &str) -> bool {
    !path.is_empty()
        && !path.starts_with('/')
        && !path.contains('\\')
        && !path.contains(':')
        && !path.contains('\0')
        // Decoded: the reader gets the file's name, never an escape the request carried.
        && !path.contains('%')
        && path
            .split('/')
            .all(|s| !s.is_empty() && s != "." && s != "..")
}

const FILE_PIECES: &[&str] = &[
    "assets",
    "app.js",
    "index.html",
    "..",
    ".",
    "%2e%2e",
    "%2E%2E",
    "%2f",
    "%5c",
    "\\",
    "C:",
    "%00",
    "a b.png",
    "%20",
    "",
    "app.js%00.png",
    "font.woff2",
    "x.exe",
    "~",
    "?a=1",
    "#x",
    "é",
];

// tags: error-guessing
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_paired_phone_reaches_only_clean_paths_of_the_built_in_files() {
    let data = tempfile::tempdir().unwrap();
    let asked: Arc<StdMutex<Vec<String>>> = Arc::default();
    let log = asked.clone();
    let backend = novira_core::startup::open_backend(data.path(), APP_BASE.into()).unwrap();
    let (server, sink) = embed(
        backend.clone(),
        Frontend::Embedded(Arc::new(move |path| {
            log.lock()
                .unwrap_or_else(|e| e.into_inner())
                .push(path.to_string());
            match path {
                "index.html" => Some(b"<html><head></head></html>".to_vec()),
                "assets/app.js" => Some(b"console.log(1)".to_vec()),
                _ => None,
            }
        })),
        APP_BASE.into(),
    );
    backend.set_event_sink(sink);
    let ca = Ca::generate().unwrap();
    let port = crate::open_lan(
        &server.state,
        &ca,
        crate::LanOptions {
            address: HOME,
            bind: Ipv4Addr::LOCALHOST,
            port: 0,
        },
    )
    .await
    .unwrap()
    .port();
    // Paired as in `tests.rs`, through the window's calls.
    let code = server.manage(Method::POST, "/pair/code", None).await.body;
    let secret = code["url"]
        .as_str()
        .unwrap()
        .rsplit_once('#')
        .unwrap()
        .1
        .to_string();
    let headers = phone_headers(port);
    let headers: Vec<(&str, &str)> = headers.iter().map(|(n, v)| (*n, v.as_str())).collect();
    let device = || Bench::device(PHONE, port, true);
    let request = json!({ "code": secret, "label": "phone" }).to_string();
    let (_, _, ticket) = ask_router(
        &server.state,
        device(),
        "POST",
        crate::PAIR_REQUEST_ROUTE,
        &headers,
        &request,
    )
    .await;
    let pending = server.manage(Method::GET, "/pair/state", None).await.body;
    let id = pending["pending"][0]["id"].clone();
    server
        .manage(Method::POST, "/pair/approve", Some(json!({ "id": id })))
        .await;
    let poll = json!({ "poll": json_of(&ticket)["poll"] }).to_string();
    let (_, answer, _) = ask_router(
        &server.state,
        device(),
        "POST",
        crate::PAIR_STATUS_ROUTE,
        &headers,
        &poll,
    )
    .await;
    let cookie = answer[header::SET_COOKIE]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();
    let with = [("cookie", cookie.as_str())];
    let mut rng = Rng::seeded(3);
    for case in 0..cases() {
        let path: String = if rng.chance(30) {
            // A real file, as it is or written another way.
            rng.pick(&[
                "/assets/app.js",
                "/assets/%61pp.js",
                "/assets//app.js",
                "/assets/./app.js",
                "/x/../assets/app.js",
                "/assets/app.js/",
                "/ASSETS/app.js",
                "/index.html",
            ])
            .to_string()
        } else {
            std::iter::once("/".to_string())
                .chain(
                    (0..1 + rng.below(4))
                        .map(|_| *rng.pick(FILE_PIECES))
                        .map(|p| p.to_string()),
                )
                .collect::<Vec<_>>()
                .join(if rng.chance(80) { "/" } else { "" })
                .replacen("//", "/", 1)
        };
        if path.parse::<Uri>().is_err() {
            continue;
        }
        let (status, _, body) = ask_router(&server.state, device(), "GET", &path, &with, "").await;
        assert_ne!(
            status,
            StatusCode::INTERNAL_SERVER_ERROR,
            "case {case}: {path:?}"
        );
        if status == StatusCode::OK {
            assert!(
                body.contains("console.log(1)")
                    || body.contains("<html>")
                    || body.contains("__NOVIRA_SERVER__"),
                "case {case}: {path:?} answered {body:?}"
            );
        }
    }
    let asked = asked.lock().unwrap_or_else(|e| e.into_inner()).clone();
    assert!(
        asked.iter().any(|p| p == "assets/app.js"),
        "the fuzzing never reached a real file"
    );
    for path in asked.iter() {
        assert!(clean(path), "the app's reader was asked for {path:?}");
    }
    server.stop().await;
    backend.shutdown();
}
