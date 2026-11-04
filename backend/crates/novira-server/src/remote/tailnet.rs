//! What the remote listener needs from Tailscale: this computer's tailnet address and name (`tailscale status --json`)
//! and a certificate for that name (`tailscale cert`, Let's Encrypt through Tailscale), so a phone's browser trusts the
//! page with nothing installed and a passkey can be bound to the name.
//!
//! Only the `tailscale.exe` of the Tailscale install folder is run (never one found on `PATH`), directly, with fixed
//! arguments and the name it reported itself, checked to be a tailnet name. The certificate's files are written to a new
//! folder under the data folder and removed once read; the key is kept in memory only.
use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use serde_json::Value;
use std::net::Ipv4Addr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

/// This computer on its tailnet.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Tailnet {
    /// Its tailnet IPv4 address (`100.64.0.0/10`).
    pub address: Ipv4Addr,
    /// Its MagicDNS name with no final dot (`pc.tail1234.ts.net`), which the certificate names.
    pub name: String,
}

/// Why the tailnet cannot be used now; the screen names it with the same word.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Problem {
    /// Tailscale is not installed.
    Missing,
    /// It is installed but not connected (stopped, or signed out).
    Stopped,
    /// MagicDNS or HTTPS certificates are off for the tailnet (its admin console turns them on).
    NoHttps,
    /// Something else failed: what it said.
    Failed(String),
}

impl Problem {
    pub fn code(&self) -> &'static str {
        match self {
            Problem::Missing => "tailscale_missing",
            Problem::Stopped => "tailscale_stopped",
            Problem::NoHttps => "https_disabled",
            Problem::Failed(_) => "failed",
        }
    }
}

/// A certificate chain and its key.
pub struct Certified {
    pub chain: Vec<CertificateDer<'static>>,
    pub key: PrivateKeyDer<'static>,
}

/// Asks Tailscale about this computer (it may take a moment: it runs a program).
pub type Status = Arc<dyn Fn() -> Result<Tailnet, Problem> + Send + Sync>;
/// Asks Tailscale for a certificate for the name.
pub type Certify = Arc<dyn Fn(&str) -> Result<Certified, Problem> + Send + Sync>;

/// How the listener reaches Tailscale; tests put a pretend one in.
#[derive(Clone)]
pub struct Source {
    pub status: Status,
    pub certify: Certify,
    /// The address the listener binds: the tailnet address itself (`None`); a test binds loopback.
    pub bind: Option<Ipv4Addr>,
}

/// Whether `ip` is in the tailnet range (`100.64.0.0/10`, the shared address space Tailscale hands out).
pub fn is_tailnet_address(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    a == 100 && (64..128).contains(&b)
}

/// Whether `name` is a MagicDNS name, `host.tailnet.ts.net`: at least two labels before `.ts.net`, each 1 to 63
/// lowercase letters, digits and inner hyphens, 253 characters at most in all.
pub fn is_tailnet_name(name: &str) -> bool {
    let Some(head) = name.strip_suffix(".ts.net") else {
        return false;
    };
    let labels: Vec<&str> = head.split('.').collect();
    name.len() <= 253
        && labels.len() >= 2
        && labels.iter().all(|l| {
            !l.is_empty()
                && l.len() <= 63
                && !l.starts_with('-')
                && !l.ends_with('-')
                && l.bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        })
}

/// This computer as `tailscale status --json` describes it: connected (`BackendState` `Running`), its first tailnet IPv4
/// address and its name, which must be one Tailscale can make a certificate for (`CertDomains`; empty when HTTPS is off).
pub fn parse_status(json: &str) -> Result<Tailnet, Problem> {
    let v: Value = serde_json::from_str(json)
        .map_err(|_| Problem::Failed("tailscale status is not JSON".into()))?;
    if v.get("BackendState").and_then(Value::as_str) != Some("Running") {
        return Err(Problem::Stopped);
    }
    let me = v.get("Self").ok_or(Problem::Stopped)?;
    let address = me
        .get("TailscaleIPs")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|ip| ip.as_str()?.parse::<Ipv4Addr>().ok())
        .find(|ip| is_tailnet_address(*ip))
        .ok_or(Problem::Stopped)?;
    let name = me
        .get("DNSName")
        .and_then(Value::as_str)
        .map(|n| n.trim_end_matches('.').to_ascii_lowercase())
        .filter(|n| is_tailnet_name(n))
        .ok_or(Problem::NoHttps)?;
    let certifiable = v
        .get("CertDomains")
        .and_then(Value::as_array)
        .is_some_and(|d| {
            d.iter()
                .any(|d| d.as_str().is_some_and(|d| d.eq_ignore_ascii_case(&name)))
        });
    if !certifiable {
        return Err(Problem::NoHttps);
    }
    Ok(Tailnet { address, name })
}

/// The chain and key of the PEM files `tailscale cert` wrote.
pub fn parse_certificate(cert_pem: &[u8], key_pem: &[u8]) -> Result<Certified, Problem> {
    let chain: Vec<CertificateDer<'static>> = CertificateDer::pem_slice_iter(cert_pem)
        .collect::<Result<_, _>>()
        .map_err(|_| Problem::Failed("the certificate does not read".into()))?;
    if chain.is_empty() {
        return Err(Problem::Failed("the certificate is empty".into()));
    }
    let key = PrivateKeyDer::from_pem_slice(key_pem)
        .map_err(|_| Problem::Failed("the key does not read".into()))?;
    Ok(Certified { chain, key })
}

/// The Tailscale CLI of the install folder (`%ProgramFiles%\Tailscale\tailscale.exe`), when it is there.
fn program() -> Option<PathBuf> {
    let base = std::env::var_os("ProgramFiles")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Program Files"));
    let exe = base.join("Tailscale").join("tailscale.exe");
    exe.is_file().then_some(exe)
}

/// How long one run of the CLI may take.
const STATUS_TIMEOUT: Duration = Duration::from_secs(15);
const CERT_TIMEOUT: Duration = Duration::from_secs(90);

/// Runs the CLI with `args` (no shell, no window) and answers what it printed, or a problem when it failed or took
/// longer than `timeout` (then it is ended).
fn run(exe: &Path, args: &[&str], timeout: Duration) -> Result<Vec<u8>, Problem> {
    use std::io::Read as _;
    use std::process::{Command, Stdio};
    let mut command = Command::new(exe);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt as _;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = command
        .spawn()
        .map_err(|e| Problem::Failed(format!("cannot run tailscale: {e}")))?;
    // Read on threads so a full pipe cannot stall the program while it is waited for.
    let mut out = child.stdout.take();
    let mut err = child.stderr.take();
    let reading = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(o) = out.as_mut() {
            let _ = o.take(4 * 1024 * 1024).read_to_end(&mut buf);
        }
        buf
    });
    let erring = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(e) = err.as_mut() {
            let _ = e.take(64 * 1024).read_to_end(&mut buf);
        }
        buf
    });
    let deadline = std::time::Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(100))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(Problem::Failed("tailscale did not answer in time".into()));
            }
        }
    };
    let stdout = reading.join().unwrap_or_default();
    let stderr = erring.join().unwrap_or_default();
    if !status.success() {
        let said = String::from_utf8_lossy(&stderr);
        let said: String = said.trim().chars().take(300).collect();
        return Err(Problem::Failed(if said.is_empty() {
            format!("tailscale ended with {status}")
        } else {
            said
        }));
    }
    Ok(stdout)
}

/// The real source: the CLI of the install folder; the certificate's files go to a new folder under `data` and are
/// removed once read.
pub fn system_source(data: PathBuf) -> Source {
    let status: Status = Arc::new(|| {
        let exe = program().ok_or(Problem::Missing)?;
        let out = run(&exe, &["status", "--json"], STATUS_TIMEOUT)?;
        parse_status(&String::from_utf8_lossy(&out))
    });
    let certify: Certify = Arc::new(move |name: &str| {
        if !is_tailnet_name(name) {
            return Err(Problem::NoHttps);
        }
        let exe = program().ok_or(Problem::Missing)?;
        let folder = data
            .join("remote")
            .join(format!("cert-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir_all(&folder).map_err(|e| {
            Problem::Failed(format!("cannot make a folder for the certificate: {e}"))
        })?;
        let (cert, key) = (folder.join("cert.pem"), folder.join("key.pem"));
        let made = (|| {
            let (cert_arg, key_arg) = (
                cert.to_string_lossy().into_owned(),
                key.to_string_lossy().into_owned(),
            );
            run(
                &exe,
                &[
                    "cert",
                    "--cert-file",
                    &cert_arg,
                    "--key-file",
                    &key_arg,
                    name,
                ],
                CERT_TIMEOUT,
            )?;
            let read = |p: &Path| {
                std::fs::read(p)
                    .map_err(|e| Problem::Failed(format!("cannot read the certificate: {e}")))
            };
            parse_certificate(&read(&cert)?, &read(&key)?)
        })();
        let _ = std::fs::remove_dir_all(&folder);
        made
    });
    Source {
        status,
        certify,
        bind: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_tailnet_range_is_100_64_slash_10() {
        for ip in ["100.64.0.1", "100.100.1.2", "100.127.255.254"] {
            assert!(is_tailnet_address(ip.parse().unwrap()), "{ip}");
        }
        for ip in [
            "100.63.255.255",
            "100.128.0.1",
            "192.168.1.5",
            "10.0.0.1",
            "127.0.0.1",
        ] {
            assert!(!is_tailnet_address(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn only_magic_dns_names_are_tailnet_names() {
        for name in [
            "pc.tail1234.ts.net",
            "my-pc.tailnet-name.ts.net",
            "a.b.ts.net",
        ] {
            assert!(is_tailnet_name(name), "{name}");
        }
        for name in [
            "ts.net",
            "pc.ts.net",
            "pc.tail1234.ts.net.evil.example",
            "PC.tail1234.ts.net",
            "-pc.tail1234.ts.net",
            "pc-.tail1234.ts.net",
            "pc..ts.net",
            "pc tail.ts.net",
            "pc.tail1234.ts.net/x",
            "pc_x.tail1234.ts.net",
            "",
        ] {
            assert!(!is_tailnet_name(name), "{name}");
        }
        assert!(!is_tailnet_name(&format!("{}.tail.ts.net", "a".repeat(64))));
    }

    fn status(state: &str, ips: &str, dns: &str, certs: &str) -> String {
        format!(
            r#"{{"BackendState":"{state}","Self":{{"TailscaleIPs":{ips},"DNSName":"{dns}"}},"CertDomains":{certs}}}"#
        )
    }

    #[test]
    fn the_status_names_this_computer_when_connected_with_https_on() {
        let ok = status(
            "Running",
            r#"["fd7a:115c:a1e0::1","100.101.102.103"]"#,
            "pc.tail1234.ts.net.",
            r#"["pc.tail1234.ts.net"]"#,
        );
        assert_eq!(
            parse_status(&ok),
            Ok(Tailnet {
                address: Ipv4Addr::new(100, 101, 102, 103),
                name: "pc.tail1234.ts.net".into()
            })
        );
        for state in ["Stopped", "NeedsLogin", "Starting", "NoState"] {
            let s = status(
                state,
                r#"["100.101.102.103"]"#,
                "pc.tail1234.ts.net.",
                r#"["pc.tail1234.ts.net"]"#,
            );
            assert_eq!(parse_status(&s), Err(Problem::Stopped), "{state}");
        }
        // No tailnet IPv4.
        assert_eq!(
            parse_status(&status(
                "Running",
                r#"["192.168.1.5"]"#,
                "pc.tail1234.ts.net.",
                r#"["pc.tail1234.ts.net"]"#
            )),
            Err(Problem::Stopped)
        );
        // HTTPS off (no cert domains), MagicDNS off (no name), or a name that is not the cert domain.
        assert_eq!(
            parse_status(&status(
                "Running",
                r#"["100.101.102.103"]"#,
                "pc.tail1234.ts.net.",
                "null"
            )),
            Err(Problem::NoHttps)
        );
        assert_eq!(
            parse_status(&status(
                "Running",
                r#"["100.101.102.103"]"#,
                "pc.tail1234.ts.net.",
                "[]"
            )),
            Err(Problem::NoHttps)
        );
        assert_eq!(
            parse_status(&status(
                "Running",
                r#"["100.101.102.103"]"#,
                "",
                r#"["pc.tail1234.ts.net"]"#
            )),
            Err(Problem::NoHttps)
        );
        assert_eq!(
            parse_status(&status(
                "Running",
                r#"["100.101.102.103"]"#,
                "pc.evil.example.",
                r#"["pc.evil.example"]"#
            )),
            Err(Problem::NoHttps)
        );
        assert_eq!(
            parse_status(&status(
                "Running",
                r#"["100.101.102.103"]"#,
                "pc.tail1234.ts.net.",
                r#"["other.tail1234.ts.net"]"#
            )),
            Err(Problem::NoHttps)
        );
        assert!(matches!(parse_status("x"), Err(Problem::Failed(_))));
    }

    #[test]
    fn a_certificate_and_key_read_from_pem() {
        let key = rcgen::KeyPair::generate().unwrap();
        let cert = rcgen::CertificateParams::new(vec!["pc.tail1234.ts.net".into()])
            .unwrap()
            .self_signed(&key)
            .unwrap();
        let certified =
            parse_certificate(cert.pem().as_bytes(), key.serialize_pem().as_bytes()).unwrap();
        assert_eq!(certified.chain.len(), 1);
        assert!(parse_certificate(b"", key.serialize_pem().as_bytes()).is_err());
        assert!(parse_certificate(cert.pem().as_bytes(), b"nope").is_err());
    }

    #[test]
    fn problems_have_the_codes_the_screen_names() {
        assert_eq!(Problem::Missing.code(), "tailscale_missing");
        assert_eq!(Problem::Stopped.code(), "tailscale_stopped");
        assert_eq!(Problem::NoHttps.code(), "https_disabled");
        assert_eq!(Problem::Failed("x".into()).code(), "failed");
    }
}
