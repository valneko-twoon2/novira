//! Request fuzzing of the browser server: whole HTTP requests built from the server's own routes and then damaged at
//! every layer a browser or another program on this computer controls (the method, the path and its query, `Host`,
//! `Origin`, fetch metadata, the token and the cookie, `Range`, the content type, the options header, the body) and sent
//! over a raw socket. The server must answer every one in reasonable time without an internal error, keep answering,
//! never serve a file outside what it serves, and never let a request through that lacks one of its checks: the token
//! (or the cookie, or on the page the token in the address), exactly one served `Host`, a matching `Origin` and
//! same-origin fetch metadata. A request let through is the only kind that may change anything.
//!
//! Left out: the home-network routes (they open a listener and trust a certificate), the export (it writes outside the
//! data folder by design) and every command that reaches a website or starts a program.
//!
//! Fixed seed, 300 requests in the ordinary run; longer: `NOVIRA_FUZZ_ITERATIONS=5000 NOVIRA_FUZZ_SEED=<n>`. A failing
//! request is saved to `novira-data/work/fuzz/http-<seed>-<case>.txt`.
mod common;
use common::*;
use novira_server::TOKEN_HEADER;
use serde_json::json;
use std::net::SocketAddr;
use std::path::Path;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const SLOWEST: Duration = Duration::from_secs(10);

fn setting(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

/// xorshift64*, as `novira-core/tests/fuzz_inputs.rs`.
struct Rng(u64);

impl Rng {
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

/// Commands that stay on this machine, with arguments they accept.
const COMMANDS: &[(&str, &str)] = &[
    ("bootstrap", "{}"),
    ("create_board", r#"{"name":"Trip"}"#),
    ("update_board", r#"{"id":"board-1","patch":{"name":"x"}}"#),
    ("delete_board", r#"{"id":"board-1","deleteImages":false}"#),
    (
        "update_images",
        r#"{"names":["a.png"],"patch":{"starred":true}}"#,
    ),
    ("delete_images", r#"{"names":["a.png"]}"#),
    ("restore_images", r#"{"names":["a.png"]}"#),
    ("list_comics", "{}"),
    ("save_comic", r#"{"id":"c1","document":{"pages":[]}}"#),
    ("delete_comic", r#"{"id":"c1"}"#),
    ("save_canvas", r#"{"document":"{\"version\":1}"}"#),
    ("load_canvas", "{}"),
    (
        "save_ui_state",
        r#"{"state":"{\"novira.theme\":\"light\"}","origin":null}"#,
    ),
    ("adopt_ui_state", r#"{"local":null}"#),
    ("queue_snapshot", "{}"),
    ("cancel_queue_item", r#"{"id":1}"#),
    ("engine_settings", "{}"),
    (
        "delete_unfinished_downloads",
        r#"{"paths":["models/x.part"]}"#,
    ),
    ("check_watermark_image", r#"{"name":"a.png"}"#),
    ("remove_node_pack", r#"{"folder":"x"}"#),
    ("take_restored_ui_state", "{}"),
    ("nope", "{}"),
    ("", "{}"),
    ("..%2fbootstrap", "{}"),
    ("BOOTSTRAP", "{}"),
];

const PATH_DAMAGE: &[&str] = &[
    "/../secret.txt",
    "/..%2fsecret.txt",
    "/%2e%2e/secret.txt",
    "/..\\secret.txt",
    "/..%5csecret.txt",
    "/%00",
    "//",
    "/./",
    "?x=1",
    "?token=",
    "#frag",
    "/a%zz",
    "/\u{e9}",
    "/CON",
    "/x.png:stream",
];

const STRINGS: &[&str] = &[
    "",
    " ",
    "../outside",
    "C:\\Windows\\win.ini",
    "\\\\?\\C:\\x",
    "a\u{0}b",
    "\u{202e}x",
    "🙂",
    "x.png",
    "{",
    "null",
];

const RANGES: &[&str] = &[
    "bytes=0-1",
    "bytes=-5",
    "bytes=5-",
    "bytes=1-0",
    "bytes=0-1,2-3",
    "bytes=abc",
    "bytes=-0",
    "bytes=999999999999-",
    "bytes=18446744073709551615-18446744073709551616",
    "items=0-1",
    "bytes=",
];

/// One request as sent: every header in order, duplicates allowed.
struct Request {
    method: String,
    target: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl Request {
    fn raw(&self) -> Vec<u8> {
        let mut out = format!(
            "{} {} HTTP/1.1\r\nConnection: close\r\n",
            self.method, self.target
        );
        for (n, v) in &self.headers {
            out.push_str(&format!("{n}: {v}\r\n"));
        }
        out.push_str(&format!("Content-Length: {}\r\n\r\n", self.body.len()));
        let mut raw = out.into_bytes();
        raw.extend_from_slice(&self.body);
        raw
    }

    fn all(&self, name: &str) -> Vec<&str> {
        self.headers
            .iter()
            .filter(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
            .collect()
    }
}

/// The server's own idea of a request it lets through on loopback (`check_request` in `src/lib.rs`), from what was sent.
fn passes_the_checks(r: &Request, f: &Fixture) -> bool {
    let port = f.server.addr.port();
    let hosts = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
    let host = r.all("host");
    let origin = r.all("origin");
    if host.len() != 1 || !hosts.iter().any(|h| h == host[0]) || origin.len() > 1 {
        return false;
    }
    if origin
        .first()
        .is_some_and(|o| *o != format!("http://{}", host[0]))
    {
        return false;
    }
    let site = r.all("sec-fetch-site");
    if site.len() > 1 || site.iter().any(|s| !matches!(*s, "same-origin" | "none")) {
        return false;
    }
    let token = &f.server.token;
    let by_header = r.all(TOKEN_HEADER).first().is_some_and(|t| t == token);
    let cookie = f.server.cookie();
    let by_cookie = r
        .all("cookie")
        .iter()
        .flat_map(|c| c.split(';'))
        .any(|pair| {
            pair.trim()
                .split_once('=')
                .is_some_and(|(n, v)| n == cookie && v == token)
        });
    let (path, query) = r.target.split_once('?').unwrap_or((&r.target, ""));
    let by_address = r.method == "GET"
        && path == "/"
        && query
            .split('&')
            .find_map(|pair| pair.strip_prefix("token="))
            .is_some_and(|t| t == token);
    by_header || by_cookie || by_address
}

fn build(rng: &mut Rng, f: &Fixture, picture: &str, png: &[u8]) -> Request {
    let token = f.server.token.clone();
    let mut headers: Vec<(String, String)> = vec![("Host".into(), f.host.clone())];
    // Mostly with the credential, so the routes behind the checks are reached too.
    match rng.below(10) {
        0 => {}
        1 => headers.push((
            TOKEN_HEADER.into(),
            format!("{}x", &token[..token.len() - 1]),
        )),
        2 => headers.push(("Cookie".into(), format!("{}={token}", f.server.cookie()))),
        3 => headers.push(("Cookie".into(), format!("{}={token}x", f.server.cookie()))),
        _ => headers.push((TOKEN_HEADER.into(), token.clone())),
    }
    let (method, target, body) = match rng.below(6) {
        0 | 1 => {
            let (name, args) = *rng.pick(COMMANDS);
            ("POST", format!("/api/{name}"), args.as_bytes().to_vec())
        }
        2 => {
            let variant = *rng.pick(&["full", "thumb", "x", "", "..", "full/.."]);
            let name = if rng.chance(50) {
                picture
            } else {
                *rng.pick(STRINGS)
            };
            if rng.chance(50) {
                headers.push(("Range".into(), rng.pick(RANGES).to_string()));
            }
            ("GET", format!("/novira-image/{variant}/{name}"), Vec::new())
        }
        3 => {
            let options =
                json!({ "boardId": null, "isIntermediate": false, "category": "user" }).to_string();
            if rng.chance(80) {
                headers.push(("x-novira-options".into(), options));
            }
            headers.push(("Content-Type".into(), "application/octet-stream".into()));
            (
                "POST",
                novira_server::UPLOAD_ROUTE.to_string(),
                png.to_vec(),
            )
        }
        4 => {
            let path = *rng.pick(&[
                "/",
                "/index.html",
                "/assets/app.js",
                "/assets/data.bin",
                "/novira-server.js",
                "/ca.crt",
                "/pair",
                "/pair.js",
                "/pair/state",
                "/events",
                "/nothing",
            ]);
            let target = if path == "/" && rng.chance(30) {
                format!("/?token={token}")
            } else {
                path.to_string()
            };
            ("GET", target, Vec::new())
        }
        _ => {
            let path = *rng.pick(&[
                "/pair/request",
                "/pair/status",
                "/pair/code",
                "/pair/deny",
                "/pair/revoke",
            ]);
            ("POST", path.to_string(), b"{}".to_vec())
        }
    };
    let mut request = Request {
        method: method.into(),
        target,
        headers,
        body,
    };
    for _ in 0..rng.below(4) {
        damage(rng, &mut request, f);
    }
    request
}

fn damage(rng: &mut Rng, r: &mut Request, f: &Fixture) {
    match rng.below(14) {
        0 => {
            r.method = rng
                .pick(&[
                    "GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH", "get",
                ])
                .to_string()
        }
        1 => r.target.push_str(rng.pick(PATH_DAMAGE)),
        2 => {
            r.target = format!(
                "/{}",
                r.target[1.min(r.target.len())..].replacen('/', "/../", 1)
            )
        }
        3 => r.headers.retain(|(n, _)| !n.eq_ignore_ascii_case("host")),
        4 => {
            let host = rng
                .pick(&[
                    "evil.example",
                    "127.0.0.1",
                    "localhost",
                    "127.0.0.1:1",
                    "[::1]",
                    "",
                ])
                .to_string();
            if rng.chance(50) {
                r.headers.retain(|(n, _)| !n.eq_ignore_ascii_case("host"));
            }
            r.headers.push(("Host".into(), host));
        }
        5 => {
            let host = f.host.clone();
            let origin = rng
                .pick(&["http://evil.example", "null", "", "https://127.0.0.1"])
                .to_string();
            r.headers.push((
                "Origin".into(),
                if rng.chance(40) {
                    format!("http://{host}")
                } else {
                    origin
                },
            ));
        }
        6 => r.headers.push((
            "Sec-Fetch-Site".into(),
            rng.pick(&["same-origin", "none", "cross-site", "same-site", ""])
                .to_string(),
        )),
        7 => r.headers.push((
            "Content-Type".into(),
            rng.pick(&[
                "application/json",
                "text/plain",
                "multipart/form-data; boundary=x",
                "",
                "application/json; charset=utf-16",
            ])
            .to_string(),
        )),
        8 => r
            .headers
            .push(("x-novira-options".into(), rng.pick(STRINGS).to_string())),
        9 => r
            .headers
            .push(("Range".into(), rng.pick(RANGES).to_string())),
        10 if !r.body.is_empty() => {
            let at = rng.below(r.body.len());
            r.body.truncate(at);
        }
        11 if !r.body.is_empty() => {
            let at = rng.below(r.body.len());
            r.body[at] ^= 1 << rng.below(8);
        }
        12 => {
            let extra = rng.pick(STRINGS).as_bytes().to_vec();
            let at = rng.below(r.body.len() + 1);
            r.body.splice(at..at, extra);
        }
        _ => r.headers.push((
            format!("X-{}", rng.below(1000)),
            "y".repeat([1, 100, 8000][rng.below(3)]),
        )),
    }
}

/// The status of the reply, or why there was none.
async fn exchange_raw(addr: SocketAddr, raw: &[u8]) -> Result<(u16, Vec<u8>), String> {
    let work = async {
        let mut stream = tokio::net::TcpStream::connect(addr)
            .await
            .map_err(|e| e.to_string())?;
        stream.write_all(raw).await.map_err(|e| e.to_string())?;
        let mut reply = Vec::new();
        let _ = stream.read_to_end(&mut reply).await;
        let head_end = reply
            .windows(4)
            .position(|w| w == b"\r\n\r\n")
            .ok_or_else(|| format!("no complete reply: {:?}", String::from_utf8_lossy(&reply)))?;
        let status = String::from_utf8_lossy(&reply[..head_end])
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse().ok())
            .ok_or("no status")?;
        Ok((status, reply[head_end + 4..].to_vec()))
    };
    tokio::time::timeout(SLOWEST, work)
        .await
        .unwrap_or_else(|_| Err(format!("no reply in {SLOWEST:?}")))
}

fn fail(seed: u64, case: u64, request: &Request, what: String) -> ! {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../novira-data/work/fuzz");
    let _ = std::fs::create_dir_all(&dir);
    let file = dir.join(format!("http-{seed}-{case}.txt"));
    let _ = std::fs::write(&file, request.raw());
    panic!(
        "{what} on case {case} of seed {seed}; the request is {}",
        file.display()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn damaged_requests_are_answered_and_none_gets_past_a_check() {
    let cases = setting("NOVIRA_FUZZ_ITERATIONS", 300);
    let seed = setting("NOVIRA_FUZZ_SEED", 0x6e6f_7669_7261);
    let mut rng = Rng(seed | 1);
    let f = Fixture::start().await;
    let png = png();
    // A picture to read whole and in ranges.
    let stored = send(
        f.server.addr,
        "POST",
        novira_server::UPLOAD_ROUTE,
        &[
            ("Host", f.host.as_str()),
            (TOKEN_HEADER, f.server.token.as_str()),
            ("Content-Type", "application/octet-stream"),
            (
                "x-novira-options",
                r#"{"boardId":null,"isIntermediate":false,"category":"user"}"#,
            ),
        ],
        &png,
    )
    .await;
    assert_eq!(
        stored.status,
        200,
        "{}",
        String::from_utf8_lossy(&stored.body)
    );
    let picture = stored.json()["name"].as_str().unwrap().to_string();
    let mut tally = [0u64; 3];
    for case in 0..cases {
        let request = build(&mut rng, &f, &picture, &png);
        let raw = request.raw();
        let (status, body) = match exchange_raw(f.server.addr, &raw).await {
            Ok(reply) => reply,
            Err(why) => fail(seed, case, &request, why),
        };
        if status >= 500 {
            fail(seed, case, &request, format!("answered {status}"));
        }
        // Anything but a refusal for who is asking (400 for two hosts, 401, 403) means the request got past the checks.
        let past = !matches!(status, 400 | 401 | 403);
        if past && !passes_the_checks(&request, &f) {
            fail(
                seed,
                case,
                &request,
                format!("answered {status} to a request that fails a check"),
            );
        }
        // And the other way: a request that passes every check is not turned away as unknown or unwelcome.
        if matches!(status, 401 | 403) && passes_the_checks(&request, &f) {
            fail(
                seed,
                case,
                &request,
                format!("answered {status} to a request that passes every check"),
            );
        }
        if body.windows(6).any(|w| w == b"secret") {
            fail(
                seed,
                case,
                &request,
                "served the file next to the site".into(),
            );
        }
        if !passes_the_checks(&request, &f)
            && body
                .windows(f.server.token.len())
                .any(|w| w == f.server.token.as_bytes())
        {
            fail(
                seed,
                case,
                &request,
                "showed the token to a request without it".into(),
            );
        }
        tally[if status < 300 {
            0
        } else if past {
            1
        } else {
            2
        }] += 1;
    }
    eprintln!(
        "http fuzz: {} answered, {} refused by a route, {} refused by the checks",
        tally[0], tally[1], tally[2]
    );
    // Still serving.
    assert_eq!(f.post("bootstrap", "{}").await.status, 200);
    f.stop().await;
}
