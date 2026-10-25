//! Shared by the server tests: the server in process on a free port, against a temporary data folder and a small stand-in for
//! `frontend/dist`. The client is raw HTTP over a socket, so a test controls every header (`Host`, `Origin`, the token) exactly.
#![allow(dead_code)]
use novira_core::Backend;
use novira_server::{Ca, LanOptions, Server, TOKEN_HEADER};
use serde_json::Value;
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

/// The home address the tests' certificate names. The listener itself binds loopback, so no test listens on the
/// network (which would make Windows ask about the firewall).
pub const LAN_ADDRESS: Ipv4Addr = Ipv4Addr::new(192, 168, 1, 5);

pub struct Reply {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Reply {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }
    pub fn json(&self) -> Value {
        serde_json::from_slice(&self.body)
            .unwrap_or_else(|e| panic!("not JSON ({e}): {}", String::from_utf8_lossy(&self.body)))
    }
}

pub async fn send(
    addr: SocketAddr,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: &[u8],
) -> Reply {
    let stream = tokio::net::TcpStream::connect(addr).await.unwrap();
    exchange(stream, method, path, headers, body).await
}

/// A TLS client that trusts only `ca` and checks the server's certificate for `name` (an IP address or a DNS name),
/// whatever address it connects to.
pub async fn tls_connect(
    addr: SocketAddr,
    ca: &Ca,
    name: &str,
) -> std::io::Result<tokio_rustls::client::TlsStream<tokio::net::TcpStream>> {
    let mut roots = rustls::RootCertStore::empty();
    roots.add(ca.der().clone()).unwrap();
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let mut config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_root_certificates(roots)
        .with_no_client_auth();
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    let stream = tokio::net::TcpStream::connect(addr).await?;
    let name = rustls::pki_types::ServerName::try_from(name.to_string()).unwrap();
    connector.connect(name, stream).await
}

/// `send` over TLS to the home-network listener, trusting `ca` and checking the certificate for `LAN_ADDRESS`.
pub async fn send_tls(
    addr: SocketAddr,
    ca: &Ca,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: &[u8],
) -> Reply {
    let stream = tls_connect(addr, ca, &LAN_ADDRESS.to_string())
        .await
        .expect("the TLS handshake succeeds");
    exchange(stream, method, path, headers, body).await
}

/// One request on `stream` and its whole reply (the server closes after it: `Connection: close`).
pub async fn exchange<S: AsyncRead + AsyncWrite + Unpin>(
    mut stream: S,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: &[u8],
) -> Reply {
    let mut request = format!(
        "{method} {path} HTTP/1.1\r\nConnection: close\r\nContent-Length: {}\r\n",
        body.len()
    );
    for (name, value) in headers {
        request.push_str(&format!("{name}: {value}\r\n"));
    }
    request.push_str("\r\n");
    stream.write_all(request.as_bytes()).await.unwrap();
    stream.write_all(body).await.unwrap();
    let mut raw = Vec::new();
    // A TLS peer may close without a close_notify after `Connection: close`; what arrived is the reply.
    let _ = stream.read_to_end(&mut raw).await;
    let split = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .expect("a complete reply");
    let head = String::from_utf8_lossy(&raw[..split]).to_string();
    let mut lines = head.lines();
    let status = lines
        .next()
        .unwrap()
        .split_whitespace()
        .nth(1)
        .unwrap()
        .parse()
        .unwrap();
    let headers = lines
        .filter_map(|l| l.split_once(':'))
        .map(|(n, v)| (n.trim().to_string(), v.trim().to_string()))
        .collect();
    Reply {
        status,
        headers,
        body: raw[split + 4..].to_vec(),
    }
}

pub struct Fixture {
    pub server: Server,
    pub backend: Backend,
    pub host: String,
    _data: tempfile::TempDir,
    _site: tempfile::TempDir,
}

impl Fixture {
    pub async fn start() -> Fixture {
        let data = tempfile::tempdir().unwrap();
        let site = tempfile::tempdir().unwrap();
        let dist = site.path().join("dist");
        std::fs::create_dir_all(dist.join("assets")).unwrap();
        std::fs::write(
            dist.join("index.html"),
            "<!doctype html><html><head><title>t</title></head><body>app</body></html>",
        )
        .unwrap();
        std::fs::write(dist.join("assets").join("app.js"), "console.log(1)").unwrap();
        std::fs::write(dist.join("assets").join("data.bin"), "x").unwrap();
        std::fs::write(site.path().join("secret.txt"), "secret").unwrap();
        let backend = novira_server::open_backend(data.path()).expect("the data folder opens");
        let server = novira_server::start(backend.clone(), dist, 0)
            .await
            .unwrap();
        let host = format!("127.0.0.1:{}", server.addr.port());
        Fixture {
            server,
            backend,
            host,
            _data: data,
            _site: site,
        }
    }

    /// A request with the right `Host` and the token header, plus `extra` headers.
    pub async fn get(&self, path: &str, extra: &[(&str, &str)]) -> Reply {
        let mut headers = vec![
            ("Host", self.host.as_str()),
            (TOKEN_HEADER, self.server.token.as_str()),
        ];
        headers.extend_from_slice(extra);
        send(self.server.addr, "GET", path, &headers, b"").await
    }

    pub async fn post(&self, command: &str, body: &str) -> Reply {
        let headers = [
            ("Host", self.host.as_str()),
            (TOKEN_HEADER, self.server.token.as_str()),
            ("Content-Type", "application/json"),
        ];
        send(
            self.server.addr,
            "POST",
            &format!("/api/{command}"),
            &headers,
            body.as_bytes(),
        )
        .await
    }

    /// `POST /pair/code` from this computer with the token.
    pub async fn pair_code(&self) -> Reply {
        send(
            self.server.addr,
            "POST",
            novira_server::PAIR_CODE_ROUTE,
            &[
                ("Host", self.host.as_str()),
                (TOKEN_HEADER, self.server.token.as_str()),
            ],
            b"",
        )
        .await
    }

    /// The data folder of this server.
    pub fn data(&self) -> &std::path::Path {
        self._data.path()
    }

    /// Opens the home-network listener on loopback with a certificate for `LAN_ADDRESS` from a new CA; the CA comes
    /// back for the client to trust.
    pub async fn open_lan(&self) -> (SocketAddr, Ca) {
        let ca = Ca::generate().unwrap();
        let addr = self
            .server
            .open_lan(
                &ca,
                LanOptions {
                    address: LAN_ADDRESS,
                    bind: Ipv4Addr::LOCALHOST,
                    port: 0,
                },
            )
            .await
            .unwrap();
        (addr, ca)
    }

    pub async fn stop(self) {
        self.server.stop().await;
    }
}

pub fn png() -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(4, 4)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

/// The body of `enqueue`: the contract sample as a plain text-to-image job (no pictures, mask or layers).
pub fn enqueue_body() -> String {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../contract/enqueue-request.json");
    let mut request: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    request["params"]["generationMode"] = "txt2img".into();
    request["iterations"] = 1.into();
    for key in ["initImageUrl", "maskImageUrl", "workflow", "comfyGraph"] {
        request[key] = Value::Null;
    }
    for key in [
        "controlLayers",
        "regionalLayers",
        "refImages",
        "referencePictures",
    ] {
        request[key] = serde_json::json!([]);
    }
    for key in [
        "controlLayers",
        "regionalLayers",
        "refImages",
        "referencePictures",
    ] {
        request["params"][key] = serde_json::json!([]);
    }
    for key in [
        "refImageCount",
        "controlLayerCount",
        "regionalGuidanceCount",
    ] {
        request["params"][key] = 0.into();
    }
    serde_json::json!({ "request": request }).to_string()
}
