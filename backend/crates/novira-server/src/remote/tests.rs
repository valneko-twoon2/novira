//! The remote listener seen from a phone on the tailnet: requests run through the real router in process, with the
//! connection's ends set as the accept loop sets them for a phone at `100.88.1.2` that reached this computer's
//! `100.101.102.103`; Tailscale is a pretend one that names this computer and signs its own certificates. The listener
//! itself binds loopback, so no test listens on a network.
use super::passkey::tests::Authenticator;
use super::*;
use crate::lan_tests::{json_of, this_computer, Bench};
use rustls::pki_types::CertificateDer;
use std::sync::atomic::{AtomicUsize, Ordering::SeqCst};

const TAILNET: Ipv4Addr = Ipv4Addr::new(100, 101, 102, 103);
const NAME: &str = "pc.tail1234.ts.net";
const PHONE: Ipv4Addr = Ipv4Addr::new(100, 88, 1, 2);
const OTHER: Ipv4Addr = Ipv4Addr::new(100, 88, 1, 3);

fn here() -> Tailnet {
    Tailnet {
        address: TAILNET,
        name: NAME.into(),
    }
}

/// A certificate for `name` signed by itself, and its DER (for a client that trusts it).
fn self_signed(name: &str) -> (Certified, CertificateDer<'static>) {
    let key = rcgen::KeyPair::generate().unwrap();
    let cert = rcgen::CertificateParams::new(vec![name.to_string()])
        .unwrap()
        .self_signed(&key)
        .unwrap();
    let der = cert.der().clone();
    let certified = Certified {
        chain: vec![der.clone()],
        key: rustls::pki_types::PrivateKeyDer::Pkcs8(key.serialize_der().into()),
    };
    (certified, der)
}

/// A server with the remote listener enabled over a pretend Tailscale.
struct Away {
    bench: Bench,
    status: Arc<Mutex<Result<Tailnet, Problem>>>,
    certs: Arc<AtomicUsize>,
    last_cert: Arc<Mutex<Option<CertificateDer<'static>>>>,
}

impl Away {
    async fn start() -> Away {
        let bench = Bench::start().await;
        let status = Arc::new(Mutex::new(Ok(here())));
        let certs = Arc::new(AtomicUsize::new(0));
        let last_cert = Arc::new(Mutex::new(None));
        let (s, c, l) = (status.clone(), certs.clone(), last_cert.clone());
        let source = Source {
            status: Arc::new(move || s.lock().unwrap().clone()),
            certify: Arc::new(move |name: &str| {
                c.fetch_add(1, SeqCst);
                let (certified, der) = self_signed(name);
                *l.lock().unwrap() = Some(der);
                Ok(certified)
            }),
            bind: Some(Ipv4Addr::LOCALHOST),
        };
        bench
            .server
            .enable_remote(Control::new(bench.data().to_path_buf(), source));
        Away {
            bench,
            status,
            certs,
            last_cert,
        }
    }

    fn state(&self) -> &Arc<AppState> {
        &self.bench.server.state
    }

    async fn manage(&self, path: &str, body: &str) -> (StatusCode, Value) {
        self.bench.manage(path, body).await
    }

    async fn on(&self) -> Value {
        let (status, state) = self.manage(ENABLE_ROUTE, "").await;
        assert_eq!(status, StatusCode::OK, "{state}");
        state
    }

    async fn remote_state(&self) -> Value {
        let token = self.bench.server.token.clone();
        let (_, _, text) = self
            .bench
            .ask(
                this_computer(&self.bench),
                "GET",
                STATE_ROUTE,
                &[(TOKEN_HEADER, &token)],
                "",
            )
            .await;
        json_of(&text)
    }

    fn port(&self) -> u16 {
        self.state()
            .remote_view()
            .expect("the remote listener is open")
            .port
    }

    fn origin(&self) -> String {
        format!("https://{NAME}:{}", self.port())
    }

    /// The ends of a connection from `peer` to this computer's tailnet address on the remote listener.
    fn ends(&self, peer: Ipv4Addr) -> Ends {
        Ends {
            local: Some(SocketAddr::from((TAILNET, self.port()))),
            peer: SocketAddr::from((peer, 50200)),
            mask: None,
            listener: Listener::Remote,
        }
    }

    /// A request from the phone at `peer` with the headers its page's `fetch` sends (and `cookie`, when given).
    async fn phone(
        &self,
        peer: Ipv4Addr,
        method: &str,
        path: &str,
        body: &str,
        cookie: Option<&str>,
    ) -> (StatusCode, HeaderMap, String) {
        let (host, origin) = (format!("{NAME}:{}", self.port()), self.origin());
        let mut headers = vec![
            ("host", host.as_str()),
            ("origin", origin.as_str()),
            ("sec-fetch-site", "same-origin"),
            ("content-type", "application/json"),
        ];
        if let Some(cookie) = cookie {
            headers.push(("cookie", cookie));
        }
        self.bench
            .ask(self.ends(peer), method, path, &headers, body)
            .await
    }

    async fn post(
        &self,
        peer: Ipv4Addr,
        path: &str,
        body: Value,
        cookie: Option<&str>,
    ) -> (StatusCode, Value, Option<String>) {
        let (status, headers, text) = self
            .phone(peer, "POST", path, &body.to_string(), cookie)
            .await;
        let cookie = headers
            .get(header::SET_COOKIE)
            .and_then(|v| v.to_str().ok())
            .map(|c| c.split(';').next().unwrap().to_string());
        (status, json_of(&text), cookie)
    }

    fn party_origin(&self) -> String {
        self.origin()
    }

    /// Pairs the phone at `peer` on the remote listener (a code from this computer, its approval) and returns the
    /// session cookie that may make a passkey.
    async fn pair(&self, peer: Ipv4Addr) -> String {
        let (status, code) = self.manage(CODE_ROUTE, "").await;
        assert_eq!(status, StatusCode::OK, "{code}");
        let url = code["url"].as_str().unwrap();
        assert!(
            url.starts_with(&format!("{}/remote#", self.origin())),
            "{url}"
        );
        let code = url.rsplit_once('#').unwrap().1;
        let (status, ticket, _) = self
            .post(
                peer,
                pair::REQUEST_ROUTE,
                json!({ "code": code, "label": "iPhone" }),
                None,
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{ticket}");
        let pending = self.remote_state().await["pending"].clone();
        let id = pending[0]["id"].as_str().unwrap().to_string();
        let (status, _) = self
            .manage(APPROVE_ROUTE, &json!({ "id": id }).to_string())
            .await;
        assert_eq!(status, StatusCode::OK);
        let (status, _, cookie) = self
            .post(
                peer,
                pair::STATUS_ROUTE,
                json!({ "poll": ticket["poll"] }),
                None,
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        cookie.expect("the session cookie")
    }

    /// Makes a passkey with `phone` in the session `cookie`; the answer of `/remote/enrol/finish`.
    async fn make_passkey(
        &self,
        peer: Ipv4Addr,
        cookie: &str,
        phone: &Authenticator,
    ) -> (StatusCode, Value) {
        let (status, options, _) = self
            .post(peer, ENROL_BEGIN_ROUTE, json!({}), Some(cookie))
            .await;
        if status != StatusCode::OK {
            return (status, options);
        }
        assert_eq!(options["rpId"], NAME);
        assert_eq!(options["userName"], "novira (iPhone)");
        let challenge = passkey::decode(options["challenge"].as_str().unwrap()).unwrap();
        let origin = self.party_origin();
        let made = phone.create(
            passkey::Party {
                rp_id: NAME,
                origin: &origin,
            },
            &challenge,
        );
        let body = json!({
            "id": passkey::encode(&made.id),
            "clientDataJSON": passkey::encode(&made.client_data),
            "authenticatorData": passkey::encode(&made.auth_data),
            "publicKey": passkey::encode(&made.spki),
            "algorithm": passkey::ES256,
        });
        let (status, answer, _) = self
            .post(peer, ENROL_FINISH_ROUTE, body, Some(cookie))
            .await;
        (status, answer)
    }

    /// The body of a sign-in by `phone` for a challenge `peer` asked for now.
    async fn sign_in_body(&self, peer: Ipv4Addr, phone: &mut Authenticator) -> Value {
        let (status, options, _) = self.post(peer, SIGN_IN_BEGIN_ROUTE, json!({}), None).await;
        assert_eq!(status, StatusCode::OK, "{options}");
        assert_eq!(options["rpId"], NAME);
        let challenge = passkey::decode(options["challenge"].as_str().unwrap()).unwrap();
        let origin = self.party_origin();
        let signed = phone.get(
            passkey::Party {
                rp_id: NAME,
                origin: &origin,
            },
            &challenge,
        );
        json!({
            "id": passkey::encode(&phone.id),
            "clientDataJSON": passkey::encode(&signed.client_data),
            "authenticatorData": passkey::encode(&signed.auth_data),
            "signature": passkey::encode(&signed.signature),
        })
    }

    async fn sign_in(
        &self,
        peer: Ipv4Addr,
        phone: &mut Authenticator,
    ) -> (StatusCode, Option<String>) {
        let body = self.sign_in_body(peer, phone).await;
        let (status, _, cookie) = self.post(peer, SIGN_IN_FINISH_ROUTE, body, None).await;
        (status, cookie)
    }

    async fn bootstrap(&self, peer: Ipv4Addr, cookie: &str) -> StatusCode {
        self.phone(peer, "POST", "/api/bootstrap", "", Some(cookie))
            .await
            .0
    }

    /// A phone at `PHONE` enrolled with a passkey, its session revoked: it can only sign in now.
    async fn enrolled(&self) -> Authenticator {
        let phone = Authenticator::new();
        let cookie = self.pair(PHONE).await;
        let (status, answer) = self.make_passkey(PHONE, &cookie, &phone).await;
        assert_eq!(status, StatusCode::OK, "{answer}");
        let devices = self.remote_state().await["devices"].clone();
        for d in devices.as_array().unwrap() {
            self.manage(REVOKE_ROUTE, &json!({ "id": d["id"] }).to_string())
                .await;
        }
        assert_eq!(
            self.bootstrap(PHONE, &cookie).await,
            StatusCode::UNAUTHORIZED
        );
        phone
    }

    async fn stop(self) {
        self.bench.stop().await;
    }
}

mod listener;
mod passkeys;
