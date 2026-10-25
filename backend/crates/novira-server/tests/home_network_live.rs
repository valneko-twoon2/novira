//! The home-network listener on this computer's real home address: TLS there, that address as the only `Host`, a device
//! (this computer reaching its own home address counts as one) let in only after pairing, and the commands that change
//! this computer refused to it. It runs where this computer has a home address (it says so and checks nothing more where
//! it has none), and only with `--ignored` (its reason says why).
mod common;
use common::*;
use novira_server::{home_address, Ca, LanOptions, TOKEN_HEADER};
use std::net::{Ipv4Addr, SocketAddr};

/// The listener opened on the real home address, with a certificate for it from a new CA.
struct Real {
    addr: SocketAddr,
    ca: Ca,
    ip: Ipv4Addr,
}

impl Real {
    async fn open(f: &Fixture) -> Option<Real> {
        let Some(ip) = home_address() else {
            eprintln!("no home-network address on this computer: nothing was checked");
            return None;
        };
        let ca = Ca::generate().unwrap();
        let options = LanOptions {
            address: ip,
            bind: ip,
            port: 0,
        };
        let addr = f.server.open_lan(&ca, options).await.unwrap();
        Some(Real { addr, ca, ip })
    }

    fn host(&self) -> String {
        format!("{}:{}", self.ip, self.addr.port())
    }

    /// One request over TLS from the home address, as a device.
    async fn ask(&self, method: &str, path: &str, headers: &[(&str, &str)], body: &str) -> Reply {
        let stream = tls_connect(self.addr, &self.ca, &self.ip.to_string())
            .await
            .unwrap();
        exchange(stream, method, path, headers, body.as_bytes()).await
    }

    /// Pairs as a device through the real network and returns the session's `Cookie` header.
    async fn pair(&self, f: &Fixture) -> String {
        let host = self.host();
        let origin = format!("https://{host}");
        let headers = [
            ("Host", host.as_str()),
            ("Origin", origin.as_str()),
            ("Content-Type", "application/json"),
        ];
        let code = f.pair_code().await.json()["url"]
            .as_str()
            .unwrap()
            .rsplit_once('#')
            .unwrap()
            .1
            .to_string();
        let body = format!(r#"{{"code":"{code}","label":"live test"}}"#);
        let ticket = self.ask("POST", "/pair/request", &headers, &body).await;
        assert_eq!(ticket.status, 200);
        let poll = ticket.json()["poll"].as_str().unwrap().to_string();
        let state = f.get(novira_server::PAIR_STATE_ROUTE, &[]).await.json();
        let id = state["pending"][0]["id"].as_str().unwrap().to_string();
        let approved = send(
            f.server.addr,
            "POST",
            novira_server::PAIR_APPROVE_ROUTE,
            &[
                ("Host", &f.host),
                (TOKEN_HEADER, &f.server.token),
                ("Content-Type", "application/json"),
            ],
            format!(r#"{{"id":"{id}"}}"#).as_bytes(),
        )
        .await;
        assert_eq!(approved.status, 200);
        let status = self
            .ask(
                "POST",
                "/pair/status",
                &headers,
                &format!(r#"{{"poll":"{poll}"}}"#),
            )
            .await;
        let cookie = status.header("set-cookie").expect("the session cookie");
        cookie.split(';').next().unwrap().to_string()
    }
}

#[tokio::test]
#[ignore = "listens on the home address, which makes Windows ask about the firewall for each new test build; run with --ignored"]
async fn the_home_address_is_served_over_tls_with_its_own_host_only_after_pairing() {
    let f = Fixture::start().await;
    let Some(real) = Real::open(&f).await else {
        f.stop().await;
        return;
    };
    let own = real.host();
    // The start token is no credential from the network: the app sends it to pair.
    let token = f.server.token.clone();
    let r = real
        .ask("GET", "/", &[("Host", &own), (TOKEN_HEADER, &token)], "")
        .await;
    assert_eq!(r.status, 303);
    let cookie = real.pair(&f).await;
    let with = |host: &str| vec![("Host", host.to_string()), ("Cookie", cookie.clone())];
    let ask = |host: String| {
        let (real, headers) = (&real, with(&host));
        async move {
            let headers: Vec<(&str, &str)> =
                headers.iter().map(|(n, v)| (*n, v.as_str())).collect();
            real.ask("GET", "/", &headers, "").await.status
        }
    };
    assert_eq!(ask(own.clone()).await, 200);
    // Only that interface listens: the port is not open on loopback.
    assert!(
        tokio::net::TcpStream::connect(("127.0.0.1", real.addr.port()))
            .await
            .is_err()
    );
    // A loopback name, a DNS name, another port and a bare address are refused there.
    for host in [
        format!("127.0.0.1:{}", real.addr.port()),
        format!("localhost:{}", real.addr.port()),
        format!("evil.example:{}", real.addr.port()),
        format!("{}:{}", real.ip, f.server.addr.port()),
        real.ip.to_string(),
    ] {
        assert_eq!(ask(host.clone()).await, 403, "{host}");
    }
    // Plain HTTP to the home address is not answered at all.
    assert!(
        tokio::net::TcpStream::connect((real.ip, f.server.addr.port()))
            .await
            .is_err(),
        "the plain listener is loopback only"
    );
    f.stop().await;
}

#[tokio::test]
#[ignore = "listens on the home address (firewall prompt); run with --ignored"]
async fn a_home_network_device_is_refused_the_commands_that_change_this_computer() {
    let f = Fixture::start().await;
    let Some(real) = Real::open(&f).await else {
        f.stop().await;
        return;
    };
    let cookie = real.pair(&f).await;
    let own = real.host();
    let post = |command: &'static str| {
        let (real, own, cookie) = (&real, own.clone(), cookie.clone());
        async move {
            real.ask(
                "POST",
                &format!("/api/{command}"),
                &[("Host", &own), ("Cookie", &cookie)],
                "",
            )
            .await
        }
    };
    assert_eq!(post("bootstrap").await.status, 200, "a read a phone needs");
    for command in [
        "install_node_pack",
        "switch_comfy_version",
        "install_model",
        "delete_model",
        "set_engine_settings",
        "set_hf_token",
        "set_civitai_key",
        "agent_login",
        "agent_endpoint_save",
    ] {
        let r = post(command).await;
        assert_eq!(r.status, 403, "{command} from a home-network device");
        assert_eq!(
            r.json()["code"].as_str(),
            Some("not_available_over_network"),
            "{command}"
        );
    }
    f.stop().await;
}
