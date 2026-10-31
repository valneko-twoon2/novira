//! Resuming and stalled downloads (`models::install::download_with_stall`). A partial file continues with a Range request
//! that carries the validator of the first answer (If-Range); a file that changed on the server comes back whole; a part
//! without its record is not resumed; a server that refuses the range starts the file again; a stalled connection is
//! given up and keeps its part. The shared fake site does not answer Range requests, so this file has its own small server.
use novira_core::models::install::{download_with_stall, InstallError};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

/// What the server does for the next request.
#[derive(Clone, Copy)]
enum Next {
    /// Answer with the file, and close the connection after this many body bytes (`None`: send all of it).
    Serve { cut_after: Option<usize> },
    /// Send the headers, then nothing.
    Stall,
    /// Answer 200 with the whole file and no length: the end of the connection ends the file.
    NoLength,
    /// Answer a range request with 206 for the file's real size but only the first 200 bytes of the rest.
    ShortPartial,
}

#[derive(Default)]
struct Shared {
    body: Vec<u8>,
    etag: String,
    /// Consumed from the front; once empty, every request is served in full.
    script: Vec<Next>,
    /// (Range, If-Range) of every request, in order.
    seen: Vec<(Option<String>, Option<String>)>,
}

/// A loopback server for one file. `url` is the file's address.
struct Site {
    url: String,
    shared: Arc<Mutex<Shared>>,
}

impl Site {
    fn start(body: Vec<u8>, etag: &str) -> Site {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/file.bin", listener.local_addr().unwrap());
        let shared = Arc::new(Mutex::new(Shared {
            body,
            etag: etag.into(),
            ..Shared::default()
        }));
        let served = shared.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let shared = served.clone();
                std::thread::spawn(move || answer(stream, &shared));
            }
        });
        Site { url, shared }
    }

    /// Replaces the file (a new version on the server).
    fn change(&self, body: Vec<u8>, etag: &str) {
        let mut s = self.shared.lock().unwrap();
        s.body = body;
        s.etag = etag.into();
    }

    fn script(&self, next: Vec<Next>) {
        self.shared.lock().unwrap().script = next;
    }

    fn seen(&self) -> Vec<(Option<String>, Option<String>)> {
        self.shared.lock().unwrap().seen.clone()
    }
}

fn answer(mut stream: TcpStream, shared: &Mutex<Shared>) {
    let mut head = Vec::new();
    let mut buf = [0u8; 1024];
    while !head.windows(4).any(|w| w == b"\r\n\r\n") {
        match stream.read(&mut buf) {
            Ok(0) | Err(_) => return,
            Ok(n) => head.extend_from_slice(&buf[..n]),
        }
    }
    let text = String::from_utf8_lossy(&head).into_owned();
    let header = |name: &str| {
        text.lines().find_map(|l| {
            let (k, v) = l.split_once(':')?;
            k.eq_ignore_ascii_case(name).then(|| v.trim().to_string())
        })
    };
    let range = header("range");
    let if_range = header("if-range");
    let (next, body, etag) = {
        let mut s = shared.lock().unwrap();
        s.seen.push((range.clone(), if_range.clone()));
        let next = if s.script.is_empty() {
            Next::Serve { cut_after: None }
        } else {
            s.script.remove(0)
        };
        (next, s.body.clone(), s.etag.clone())
    };
    let validator = format!("\"{etag}\"");
    match next {
        Next::Stall => {
            let head = format!(
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nETag: {validator}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = stream.write_all(head.as_bytes());
            std::thread::sleep(Duration::from_secs(3));
        }
        Next::NoLength => {
            let head = format!(
                "HTTP/1.1 200 OK
ETag: {validator}
Connection: close

"
            );
            let _ = stream.write_all(head.as_bytes());
            let _ = stream.write_all(&body);
            let _ = stream.flush();
        }
        Next::ShortPartial => {
            let start = range
                .as_deref()
                .and_then(|r| r.strip_prefix("bytes="))
                .and_then(|r| r.strip_suffix('-'))
                .and_then(|n| n.parse::<usize>().ok())
                .unwrap_or(0);
            let end = (start + 200).min(body.len());
            let head = format!(
                "HTTP/1.1 206 Partial Content
Content-Range: bytes {start}-{}/{}
Content-Length: {}
ETag: {validator}
Connection: close

",
                body.len() - 1,
                body.len(),
                end - start
            );
            let _ = stream.write_all(head.as_bytes());
            let _ = stream.write_all(&body[start..end]);
            let _ = stream.flush();
        }
        Next::Serve { cut_after } => {
            // The range counts only when If-Range names the file as it is now; otherwise the whole file is sent.
            let from = match (&range, &if_range) {
                (Some(r), Some(v)) if *v == validator => r
                    .strip_prefix("bytes=")
                    .and_then(|r| r.strip_suffix('-'))
                    .and_then(|n| n.parse::<usize>().ok()),
                _ => None,
            };
            let (head, payload) = match from {
                Some(start) if start >= body.len() => (
                    format!(
                        "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                        body.len()
                    ),
                    Vec::new(),
                ),
                Some(start) => (
                    format!(
                        "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {start}-{}/{}\r\nContent-Length: {}\r\nETag: {validator}\r\nConnection: close\r\n\r\n",
                        body.len() - 1,
                        body.len(),
                        body.len() - start
                    ),
                    body[start..].to_vec(),
                ),
                None => (
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nETag: {validator}\r\nConnection: close\r\n\r\n",
                        body.len()
                    ),
                    body.clone(),
                ),
            };
            let _ = stream.write_all(head.as_bytes());
            let sent = cut_after.map_or(payload.len(), |k| k.min(payload.len()));
            let _ = stream.write_all(&payload[..sent]);
            let _ = stream.flush();
        }
    }
}

fn client() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap()
}

/// A file of `len` bytes that differs from `seed` to `seed`.
fn bytes(len: usize, seed: u8) -> Vec<u8> {
    (0..len)
        .map(|i| (i as u8).wrapping_mul(7).wrapping_add(seed))
        .collect()
}

/// The record a partial download keeps beside it (`<file>.resume`): the whole size and the validator.
fn write_record(dest: &std::path::Path, total: u64, validator: &str) {
    let mut name = dest.file_name().unwrap().to_os_string();
    name.push(".resume");
    let record = serde_json::json!({ "total": total, "validator": validator });
    std::fs::write(dest.with_file_name(name), record.to_string()).unwrap();
}

fn record_path(dest: &std::path::Path) -> std::path::PathBuf {
    let mut name = dest.file_name().unwrap().to_os_string();
    name.push(".resume");
    dest.with_file_name(name)
}

#[tokio::test]
async fn an_interrupted_download_continues_from_its_part_with_the_validator_of_the_first_answer() {
    let body = bytes(1000, 1);
    let site = Site::start(body.clone(), "v1");
    site.script(vec![Next::Serve {
        cut_after: Some(400),
    }]);
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("model.safetensors");
    let cancel = CancellationToken::new();

    let first = download_with_stall(
        &client(),
        &site.url,
        None,
        &dest,
        &cancel,
        Duration::from_secs(5),
        |_, _| {},
    )
    .await;
    assert!(
        matches!(first, Err(InstallError::Failed(ref m)) if m.contains("interrupted") || m.contains("ended early")),
        "{first:?}"
    );
    assert_eq!(
        std::fs::read(&dest).unwrap(),
        body[..400],
        "the part keeps what arrived"
    );
    assert!(record_path(&dest).is_file(), "the part keeps its record");

    let second = download_with_stall(
        &client(),
        &site.url,
        None,
        &dest,
        &cancel,
        Duration::from_secs(5),
        |_, _| {},
    )
    .await;
    assert!(second.is_ok(), "{second:?}");
    assert_eq!(
        std::fs::read(&dest).unwrap(),
        body,
        "the rest is appended, not fetched again"
    );
    assert!(
        !record_path(&dest).exists(),
        "a finished file has no record"
    );
    assert_eq!(
        site.seen()[1],
        (Some("bytes=400-".into()), Some("\"v1\"".into())),
        "the second request asks for the rest, only while the file is the same"
    );
}

#[tokio::test]
async fn a_file_that_changed_on_the_server_comes_back_whole_and_is_not_joined_to_the_old_part() {
    let old = bytes(1000, 1);
    let new = bytes(1000, 9);
    let site = Site::start(old.clone(), "v1");
    site.script(vec![Next::Serve {
        cut_after: Some(400),
    }]);
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("comfyui.part");
    let cancel = CancellationToken::new();
    let _ = download_with_stall(
        &client(),
        &site.url,
        None,
        &dest,
        &cancel,
        Duration::from_secs(5),
        |_, _| {},
    )
    .await;

    site.change(new.clone(), "v2");
    let again = download_with_stall(
        &client(),
        &site.url,
        None,
        &dest,
        &cancel,
        Duration::from_secs(5),
        |_, _| {},
    )
    .await;
    assert!(again.is_ok(), "{again:?}");
    assert_eq!(
        std::fs::read(&dest).unwrap(),
        new,
        "the whole new file, not the old part with the new rest"
    );
}

#[tokio::test]
async fn a_part_without_its_record_is_not_resumed() {
    let body = bytes(1000, 3);
    let site = Site::start(body.clone(), "v1");
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("orphan.part");
    std::fs::write(&dest, &body[..300]).unwrap();
    let cancel = CancellationToken::new();

    let result = download_with_stall(
        &client(),
        &site.url,
        None,
        &dest,
        &cancel,
        Duration::from_secs(5),
        |_, _| {},
    )
    .await;
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(
        site.seen()[0],
        (None, None),
        "no range is asked for a part of unknown origin"
    );
    assert_eq!(std::fs::read(&dest).unwrap(), body);
}

#[tokio::test]
async fn a_server_that_refuses_the_range_starts_the_file_again() {
    let body = bytes(1000, 4);
    let site = Site::start(body.clone(), "v1");
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("full.part");
    // A part that already has every byte, but whose download never finished (the record says so).
    std::fs::write(&dest, &body).unwrap();
    write_record(&dest, 1000, "\"v1\"");
    let cancel = CancellationToken::new();

    let result = download_with_stall(
        &client(),
        &site.url,
        None,
        &dest,
        &cancel,
        Duration::from_secs(5),
        |_, _| {},
    )
    .await;
    assert!(result.is_ok(), "{result:?}");
    let seen = site.seen();
    assert_eq!(seen[0], (Some("bytes=1000-".into()), Some("\"v1\"".into())));
    assert_eq!(
        seen[1],
        (None, None),
        "after the 416 the file is asked for whole"
    );
    assert_eq!(std::fs::read(&dest).unwrap(), body);
}

#[tokio::test]
async fn a_stalled_connection_is_given_up_in_time_and_keeps_its_part() {
    let site = Site::start(bytes(1000, 5), "v1");
    site.script(vec![Next::Stall]);
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("stuck.part");
    let cancel = CancellationToken::new();

    let started = Instant::now();
    let result = download_with_stall(
        &client(),
        &site.url,
        None,
        &dest,
        &cancel,
        Duration::from_millis(300),
        |_, _| {},
    )
    .await;
    assert!(
        matches!(result, Err(InstallError::Failed(ref m)) if m.contains("stalled")),
        "{result:?}"
    );
    assert!(
        started.elapsed() < Duration::from_secs(2),
        "given up after the stall time, not after the server's pause"
    );
    assert!(
        record_path(&dest).is_file(),
        "the record stays, so the next attempt can continue"
    );
}

#[tokio::test]
async fn a_part_being_downloaded_is_kept_by_a_delete_until_the_download_ends() {
    let site = Site::start(bytes(1000, 6), "v1");
    site.script(vec![Next::Stall]);
    let dir = tempfile::tempdir().unwrap();
    let dest = dir
        .path()
        .join("models")
        .join(".downloads")
        .join("held.part");
    let (url, task_dest) = (site.url.clone(), dest.clone());
    let download = tokio::spawn(async move {
        let cancel = CancellationToken::new();
        download_with_stall(
            &client(),
            &url,
            None,
            &task_dest,
            &cancel,
            Duration::from_secs(2),
            |_, _| {},
        )
        .await
    });
    // The server sends its headers and then stalls for 3 seconds: the partial file is there by then.
    for _ in 0..100 {
        if dest.is_file() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert!(dest.is_file(), "the partial file was not created");

    let picked = ["models/.downloads/held.part".to_string()];
    let left = novira_core::unfinished::delete(dir.path(), &picked);
    assert_eq!(left.len(), 1, "the list still holds the download");
    assert!(dest.is_file(), "a download running now keeps its part");

    let result = download.await.unwrap();
    assert!(
        matches!(result, Err(InstallError::Failed(ref m)) if m.contains("stalled")),
        "{result:?}"
    );
    assert!(
        novira_core::unfinished::delete(dir.path(), &picked).is_empty(),
        "once the download has ended, the delete removes the part"
    );
    assert!(!dest.exists());
    assert!(!record_path(&dest).exists(), "and its record");
}

async fn fetch(site: &Site, dest: &std::path::Path) -> Result<(), InstallError> {
    download_with_stall(
        &client(),
        &site.url,
        None,
        dest,
        &CancellationToken::new(),
        Duration::from_secs(5),
        |_, _| {},
    )
    .await
}

#[tokio::test]
async fn a_file_sent_without_a_length_is_whole_when_the_connection_ends() {
    let body = bytes(500, 3);
    let site = Site::start(body.clone(), "v1");
    site.script(vec![Next::NoLength]);
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("model.safetensors");
    fetch(&site, &dest).await.unwrap();
    assert_eq!(std::fs::read(&dest).unwrap(), body);
}

#[tokio::test]
async fn a_resumed_file_is_checked_against_the_size_the_server_names_for_the_whole_file() {
    let body = bytes(1000, 1);
    let site = Site::start(body.clone(), "v1");
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("model.safetensors");
    // A part of 400 bytes whose record remembers a size that is out of date: the answer's own Content-Range wins.
    std::fs::write(&dest, &body[..400]).unwrap();
    write_record(&dest, 700, "\"v1\"");
    fetch(&site, &dest).await.unwrap();
    assert_eq!(std::fs::read(&dest).unwrap(), body);

    // The server names the whole size but sends only a piece: the file is not complete, and the part is kept.
    let dest = dir.path().join("short.safetensors");
    std::fs::write(&dest, &body[..400]).unwrap();
    write_record(&dest, 1000, "\"v1\"");
    site.script(vec![Next::ShortPartial]);
    let err = fetch(&site, &dest).await.unwrap_err().to_string();
    assert!(err.contains("ended early"), "{err}");
    assert!(record_path(&dest).is_file());
}

#[tokio::test]
async fn an_empty_part_is_fetched_without_a_range() {
    let body = bytes(300, 2);
    let site = Site::start(body.clone(), "v1");
    let dir = tempfile::tempdir().unwrap();
    let dest = dir.path().join("model.safetensors");
    std::fs::write(&dest, b"").unwrap();
    write_record(&dest, 300, "\"v1\"");
    fetch(&site, &dest).await.unwrap();
    assert_eq!(std::fs::read(&dest).unwrap(), body);
    assert_eq!(site.seen()[0], (None, None), "nothing to continue from");
}
