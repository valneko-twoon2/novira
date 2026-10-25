//! TLS of the home-network listener: the "novira local CA" and the certificate it signs for this computer's home
//! address.
//!
//! The CA is made once per data folder (ECDSA P-256). Its certificate is public: it is served at `/ca.crt` and kept as
//! `<data>/lan/ca.pem`, and a phone installs it once. Its private key (with the certificate) is a DPAPI secret
//! (`Secret::LanCa`). The CA may only vouch for addresses a home router hands out: its name constraints permit the IP
//! subnets `10/8`, `172.16/12`, `192.168/16` and `100.64/10` and exclude every DNS name, so a copy of its key cannot
//! sign a certificate for a web site, for clients that enforce name constraints. The server's own certificate (the
//! leaf) is made at every start of the listener for the current home address, so a new address needs no new CA.
use novira_core::secret::{self, Secret};
use rcgen::{
    BasicConstraints, CertificateParams, CidrSubnet, DistinguishedName, DnType,
    ExtendedKeyUsagePurpose, GeneralSubtree, IsCa, Issuer, KeyPair, KeyUsagePurpose,
    NameConstraints, SanType, SerialNumber,
};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use std::net::{IpAddr, Ipv4Addr};
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// The CA's common name, as a phone shows it in its certificate settings (lowercase, like every name shown).
pub const CA_NAME: &str = "novira local CA";
/// The organisation named in both certificates.
const ORGANIZATION: &str = "novira";
/// How long the CA is valid, in days (a phone installs it once).
const CA_VALID_DAYS: i64 = 3650;
/// How long a leaf is valid, in days; a new one is made at every start of the listener anyway.
const LEAF_VALID_DAYS: i64 = 90;
/// The only addresses the CA may vouch for: the ranges a home router hands out (`home_network::is_home_range`).
pub const HOME_SUBNETS: [([u8; 4], u8); 4] = [
    ([10, 0, 0, 0], 8),
    ([172, 16, 0, 0], 12),
    ([192, 168, 0, 0], 16),
    ([100, 64, 0, 0], 10),
];

fn err(e: impl std::fmt::Display) -> String {
    format!("cannot make the home-network certificate: {e}")
}

/// A random positive serial number.
fn serial() -> SerialNumber {
    let mut bytes = uuid::Uuid::new_v4().into_bytes().to_vec();
    bytes[0] &= 0x7f;
    bytes[0] |= 0x01;
    SerialNumber::from_slice(&bytes)
}

/// Sets the validity: from yesterday (midnight UTC) for `days` days.
fn set_validity(params: &mut CertificateParams, days: i64) {
    use chrono::Datelike;
    let now = chrono::Utc::now();
    let (a, b) = (
        now - chrono::Duration::days(1),
        now + chrono::Duration::days(days),
    );
    params.not_before = rcgen::date_time_ymd(a.year(), a.month() as u8, a.day() as u8);
    params.not_after = rcgen::date_time_ymd(b.year(), b.month() as u8, b.day() as u8);
}

/// The CA's name constraints: the home subnets permitted, every DNS name excluded (an empty DNS name matches all).
fn home_only() -> NameConstraints {
    NameConstraints {
        permitted_subtrees: HOME_SUBNETS
            .iter()
            .map(|(addr, prefix)| {
                GeneralSubtree::IpAddress(CidrSubnet::from_v4_prefix(*addr, *prefix))
            })
            .collect(),
        excluded_subtrees: vec![GeneralSubtree::DnsName(String::new())],
    }
}

/// The local CA: its certificate and the key that signs the leaf.
pub struct Ca {
    pem: String,
    der: CertificateDer<'static>,
    key: KeyPair,
}

impl std::fmt::Debug for Ca {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Ca { .. }")
    }
}

impl Ca {
    /// A new CA (ECDSA P-256, pathlen 0, keyCertSign/cRLSign, the home-only name constraints).
    pub fn generate() -> Result<Ca, String> {
        Ca::generate_with(home_only())
    }

    fn generate_with(constraints: NameConstraints) -> Result<Ca, String> {
        let key = KeyPair::generate().map_err(err)?;
        let mut params = CertificateParams::new(Vec::<String>::new()).map_err(err)?;
        let mut name = DistinguishedName::new();
        name.push(DnType::CommonName, CA_NAME);
        name.push(DnType::OrganizationName, ORGANIZATION);
        params.distinguished_name = name;
        params.is_ca = IsCa::Ca(BasicConstraints::Constrained(0));
        params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];
        params.name_constraints = Some(constraints);
        params.serial_number = Some(serial());
        set_validity(&mut params, CA_VALID_DAYS);
        let cert = params.self_signed(&key).map_err(err)?;
        Ok(Ca {
            pem: cert.pem(),
            der: cert.der().clone(),
            key,
        })
    }

    /// A CA from its saved certificate and key (PEM), or `None` when they do not read back as a pair.
    fn from_saved(pem: &str, key: &str) -> Option<Ca> {
        let key = KeyPair::from_pem(key).ok()?;
        let der = CertificateDer::from(pem_body(pem)?);
        // The certificate must parse as an issuer, and carry the key's public half.
        Issuer::from_ca_cert_der(&der, &key).ok()?;
        let public = key.public_key_raw();
        if !der.windows(public.len()).any(|w| w == public) {
            return None;
        }
        Some(Ca {
            pem: pem.to_string(),
            der,
            key,
        })
    }

    /// The CA of this data folder: the saved one, else a new one saved now (key and certificate as a DPAPI secret).
    /// Its certificate is (re)written to `<data>/lan/ca.pem`.
    pub fn load_or_create(data: &Path) -> Result<Ca, String> {
        let saved = secret::load_secret(data, Secret::LanCa)
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok())
            .and_then(|v| Ca::from_saved(v.get("cert")?.as_str()?, v.get("key")?.as_str()?));
        let ca = match saved {
            Some(ca) => ca,
            None => {
                let ca = Ca::generate()?;
                let json = serde_json::json!({ "cert": ca.pem, "key": ca.key.serialize_pem() });
                secret::save_secret(data, Secret::LanCa, Some(&json.to_string()))?;
                ca
            }
        };
        let file = ca_file(data);
        if std::fs::read_to_string(&file).ok().as_deref() != Some(ca.pem.as_str()) {
            std::fs::create_dir_all(file.parent().expect("has a parent")).map_err(err)?;
            std::fs::write(&file, &ca.pem).map_err(err)?;
        }
        Ok(ca)
    }

    /// The certificate as PEM (public; what `/ca.crt` serves).
    pub fn pem(&self) -> &str {
        &self.pem
    }

    /// The certificate as DER.
    pub fn der(&self) -> &CertificateDer<'static> {
        &self.der
    }

    /// The SHA-256 fingerprint of the certificate, as a phone's certificate details show it (`AB:CD:...`).
    pub fn fingerprint(&self) -> String {
        let digest = ring::digest::digest(&ring::digest::SHA256, &self.der);
        digest
            .as_ref()
            .iter()
            .map(|b| format!("{b:02X}"))
            .collect::<Vec<_>>()
            .join(":")
    }

    /// A leaf certificate for `san` (serverAuth, 90 days) signed by this CA, with its private key.
    pub fn leaf_for(
        &self,
        san: SanType,
    ) -> Result<(CertificateDer<'static>, PrivateKeyDer<'static>), String> {
        let issuer = Issuer::from_ca_cert_der(&self.der, &self.key).map_err(err)?;
        let key = KeyPair::generate().map_err(err)?;
        let mut params = CertificateParams::new(Vec::<String>::new()).map_err(err)?;
        // No common name: a verifier that still reads one as a host name would meet the CA's DNS exclusion.
        let mut name = DistinguishedName::new();
        name.push(DnType::OrganizationName, ORGANIZATION);
        params.distinguished_name = name;
        params.subject_alt_names = vec![san];
        params.is_ca = IsCa::ExplicitNoCa;
        params.key_usages = vec![KeyUsagePurpose::DigitalSignature];
        params.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];
        params.use_authority_key_identifier_extension = true;
        params.serial_number = Some(serial());
        set_validity(&mut params, LEAF_VALID_DAYS);
        let cert = params.signed_by(&key, &issuer).map_err(err)?;
        Ok((
            cert.der().clone(),
            PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key.serialize_der())),
        ))
    }

    /// The TLS configuration of the listener on `ip`: a fresh leaf for that address, TLS 1.2 and 1.3 with the ring
    /// provider, HTTP/1.1 only, no client certificates.
    pub fn server_config(&self, ip: Ipv4Addr) -> Result<Arc<rustls::ServerConfig>, String> {
        let (leaf, key) = self.leaf_for(SanType::IpAddress(IpAddr::V4(ip)))?;
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let mut config = rustls::ServerConfig::builder_with_provider(provider)
            .with_safe_default_protocol_versions()
            .map_err(err)?
            .with_no_client_auth()
            .with_single_cert(vec![leaf], key)
            .map_err(err)?;
        config.alpn_protocols = vec![b"http/1.1".to_vec()];
        Ok(Arc::new(config))
    }
}

/// Where the CA's certificate is kept in the data folder.
pub fn ca_file(data: &Path) -> PathBuf {
    data.join("lan").join("ca.pem")
}

/// The DER bytes of the first PEM certificate in `pem`.
fn pem_body(pem: &str) -> Option<Vec<u8>> {
    use rustls::pki_types::pem::PemObject;
    CertificateDer::from_pem_slice(pem.as_bytes())
        .ok()
        .map(|der| der.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustls::client::danger::ServerCertVerifier;
    use rustls::pki_types::{ServerName, UnixTime};

    /// Whether a client that trusts `ca` (rustls-webpki, through rustls's own verifier) accepts `leaf` for `name`.
    fn verify(ca: &Ca, leaf: &CertificateDer<'_>, name: &str) -> Result<(), rustls::Error> {
        let mut roots = rustls::RootCertStore::empty();
        roots.add(ca.der().clone()).unwrap();
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let verifier =
            rustls::client::WebPkiServerVerifier::builder_with_provider(Arc::new(roots), provider)
                .build()
                .unwrap();
        verifier
            .verify_server_cert(
                leaf,
                &[],
                &ServerName::try_from(name.to_string()).unwrap(),
                &[],
                UnixTime::now(),
            )
            .map(|_| ())
    }

    fn ip_leaf(ca: &Ca, ip: &str) -> CertificateDer<'static> {
        ca.leaf_for(SanType::IpAddress(ip.parse().unwrap()))
            .unwrap()
            .0
    }

    #[test]
    fn a_leaf_for_a_home_address_verifies() {
        let ca = Ca::generate().unwrap();
        for ip in [
            "192.168.1.5",
            "10.1.2.3",
            "172.16.0.9",
            "172.31.255.1",
            "100.64.1.60",
            "100.127.0.1",
        ] {
            verify(&ca, &ip_leaf(&ca, ip), ip).unwrap_or_else(|e| panic!("{ip}: {e}"));
        }
        // The leaf names one address: another one, even at home, is not it.
        let leaf = ip_leaf(&ca, "192.168.1.5");
        assert!(verify(&ca, &leaf, "192.168.1.6").is_err());
    }

    #[test]
    fn the_ca_cannot_vouch_for_a_public_address_or_any_dns_name() {
        let ca = Ca::generate().unwrap();
        for ip in [
            "8.8.8.8",
            "172.32.0.1",
            "100.128.0.1",
            "127.0.0.1",
            "169.254.1.1",
        ] {
            let e = verify(&ca, &ip_leaf(&ca, ip), ip).expect_err(ip);
            assert!(format!("{e:?}").contains("NameConstraint"), "{ip}: {e:?}");
        }
        // The empty excluded DNS subtree matches every name, a single label and a wildcard included.
        for dns in ["example.com", "localhost", "novira", "a.b.c.example"] {
            let leaf = ca
                .leaf_for(SanType::DnsName(dns.try_into().unwrap()))
                .unwrap()
                .0;
            let e = verify(&ca, &leaf, dns).expect_err(dns);
            assert!(format!("{e:?}").contains("NameConstraint"), "{dns}: {e:?}");
        }
        let wildcard = ca
            .leaf_for(SanType::DnsName("*.example.com".try_into().unwrap()))
            .unwrap()
            .0;
        assert!(verify(&ca, &wildcard, "www.example.com").is_err());
    }

    #[test]
    fn without_the_constraints_the_same_leaves_would_verify() {
        // The control for the test above: the refusals come from the name constraints, not from the leaves.
        let open = Ca::generate_with(NameConstraints {
            permitted_subtrees: vec![],
            excluded_subtrees: vec![GeneralSubtree::Rfc822Name("x@example.invalid".into())],
        })
        .unwrap();
        verify(&open, &ip_leaf(&open, "8.8.8.8"), "8.8.8.8").unwrap();
        let leaf = open
            .leaf_for(SanType::DnsName("example.com".try_into().unwrap()))
            .unwrap()
            .0;
        verify(&open, &leaf, "example.com").unwrap();
    }

    #[test]
    fn another_ca_is_not_trusted() {
        let (ca, other) = (Ca::generate().unwrap(), Ca::generate().unwrap());
        assert!(verify(&other, &ip_leaf(&ca, "192.168.1.5"), "192.168.1.5").is_err());
    }

    #[test]
    fn the_ca_is_named_in_lowercase_and_its_fingerprint_is_sha256() {
        let ca = Ca::generate().unwrap();
        assert_eq!(CA_NAME, "novira local CA");
        let fp = ca.fingerprint();
        assert_eq!(fp.len(), 32 * 3 - 1, "{fp}");
        assert!(fp
            .split(':')
            .all(|b| b.len() == 2 && b.chars().all(|c| c.is_ascii_hexdigit())));
        assert_ne!(fp, Ca::generate().unwrap().fingerprint());
        assert!(ca.pem().starts_with("-----BEGIN CERTIFICATE-----"));
        assert_eq!(pem_body(ca.pem()).as_deref(), Some(ca.der().as_ref()));
    }

    #[test]
    fn the_server_config_offers_http1_only() {
        let ca = Ca::generate().unwrap();
        let config = ca.server_config(Ipv4Addr::new(192, 168, 1, 5)).unwrap();
        assert_eq!(config.alpn_protocols, vec![b"http/1.1".to_vec()]);
    }

    #[cfg(windows)]
    #[test]
    fn the_ca_is_kept_per_data_folder_and_its_key_is_not_in_clear() {
        let dir = tempfile::tempdir().unwrap();
        let first = Ca::load_or_create(dir.path()).unwrap();
        let again = Ca::load_or_create(dir.path()).unwrap();
        assert_eq!(first.pem(), again.pem(), "the same CA comes back");
        assert_eq!(
            std::fs::read_to_string(ca_file(dir.path())).unwrap(),
            first.pem()
        );
        // The key file holds no PEM in clear.
        let raw = std::fs::read(dir.path().join("secrets").join("lan-ca.key")).unwrap();
        assert!(!String::from_utf8_lossy(&raw).contains("PRIVATE KEY"));
        // A leaf signed by the CA that came back verifies against the first one's certificate.
        verify(&first, &ip_leaf(&again, "192.168.1.5"), "192.168.1.5").unwrap();
        // A deleted or tampered public copy is written again from the secret.
        std::fs::write(ca_file(dir.path()), "x").unwrap();
        Ca::load_or_create(dir.path()).unwrap();
        assert_eq!(
            std::fs::read_to_string(ca_file(dir.path())).unwrap(),
            first.pem()
        );
        // An unreadable secret makes a new CA (the phone installs it again) rather than failing the start.
        std::fs::write(dir.path().join("secrets").join("lan-ca.key"), b"garbage").unwrap();
        let fresh = Ca::load_or_create(dir.path()).unwrap();
        assert_ne!(fresh.pem(), first.pem());
    }
}
