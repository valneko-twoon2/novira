//! C2PA content credentials on exported copies: a manifest that says the picture was made by a trained
//! model (`c2pa.created` with IPTC `trainedAlgorithmicMedia`), that a watermark was added, and which TrustMark id the
//! watermark carries (a `c2pa.soft-binding` assertion).
//!
//! The manifest is signed with a certificate made on this PC the first time it is needed: a small local CA signs a
//! leaf certificate, the CA's private key is thrown away, and the leaf's key and the chain are kept encrypted with
//! DPAPI in `<data folder>/secrets/`. Nobody's trust list knows that CA, so viewers show the signer as unknown: the
//! credentials prove that the file is unchanged since this app signed it, not who signed it. No name, account or PC
//! name goes into the certificate.
use crate::secret::{self, Secret};
use c2pa::assertions::DigitalSourceType;
use c2pa::{Builder, BuilderIntent, ClaimGeneratorInfo, Context, Reader, ValidationState};
use rcgen::{
    BasicConstraints, CertificateParams, DistinguishedName, DnType, ExtendedKeyUsagePurpose, IsCa,
    Issuer, KeyPair, KeyUsagePurpose, SerialNumber,
};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::Path;

/// The name the certificate and the manifest give as the maker.
pub const SIGNER_NAME: &str = "novira";
/// How long the certificate is valid, in days.
const VALID_DAYS: i64 = 3650;

/// The key and certificate chain that sign this installation's manifests.
#[derive(Clone, Serialize, Deserialize)]
pub struct Identity {
    /// The leaf certificate, then the local CA's, as PEM.
    chain: String,
    /// The leaf's private key (PKCS#8 PEM).
    key: String,
}

impl std::fmt::Debug for Identity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Identity { .. }")
    }
}

fn err(e: impl std::fmt::Display) -> String {
    format!("cannot make the content credentials: {e}")
}

fn name(cn: &str) -> DistinguishedName {
    let mut dn = DistinguishedName::new();
    dn.push(DnType::CommonName, cn);
    dn.push(DnType::OrganizationName, SIGNER_NAME);
    dn
}

/// A random positive serial number.
fn serial() -> SerialNumber {
    let mut bytes = uuid::Uuid::new_v4().into_bytes().to_vec();
    bytes[0] &= 0x7f;
    bytes[0] |= 0x01;
    SerialNumber::from_slice(&bytes)
}

impl Identity {
    /// A new local CA and a leaf certificate it signs (ES256). The CA's key is dropped here.
    pub fn generate() -> Result<Self, String> {
        // Validity runs from yesterday (midnight UTC) for ten years.
        use chrono::Datelike;
        let now = chrono::Utc::now();
        let (a, b) = (
            now - chrono::Duration::days(1),
            now + chrono::Duration::days(VALID_DAYS),
        );
        let start = rcgen::date_time_ymd(a.year(), a.month() as u8, a.day() as u8);
        let end = rcgen::date_time_ymd(b.year(), b.month() as u8, b.day() as u8);
        let ca_key = KeyPair::generate().map_err(err)?;
        let mut ca = CertificateParams::new(Vec::<String>::new()).map_err(err)?;
        ca.distinguished_name = name("novira local signing CA");
        ca.is_ca = IsCa::Ca(BasicConstraints::Constrained(0));
        ca.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];
        ca.serial_number = Some(serial());
        (ca.not_before, ca.not_after) = (start, end);
        let ca_cert = ca.self_signed(&ca_key).map_err(err)?;
        let issuer = Issuer::new(ca, ca_key);

        let key = KeyPair::generate().map_err(err)?;
        let mut leaf = CertificateParams::new(Vec::<String>::new()).map_err(err)?;
        leaf.distinguished_name = name(SIGNER_NAME);
        leaf.is_ca = IsCa::ExplicitNoCa;
        leaf.key_usages = vec![KeyUsagePurpose::DigitalSignature];
        leaf.extended_key_usages = vec![ExtendedKeyUsagePurpose::EmailProtection];
        leaf.use_authority_key_identifier_extension = true;
        leaf.serial_number = Some(serial());
        (leaf.not_before, leaf.not_after) = (start, end);
        let leaf_cert = leaf.signed_by(&key, &issuer).map_err(err)?;
        Ok(Self {
            chain: format!("{}{}", leaf_cert.pem(), ca_cert.pem()),
            key: key.serialize_pem(),
        })
    }

    /// The saved identity of this installation, or a new one saved now (encrypted with DPAPI).
    pub fn load_or_create(data_dir: &Path) -> Result<Self, String> {
        if let Some(saved) = secret::load_secret(data_dir, Secret::C2paSigning)? {
            if let Ok(identity) = serde_json::from_str::<Self>(&saved) {
                return Ok(identity);
            }
            crate::applog::warn(
                "credentials",
                "the saved signing key was unreadable; made a new one",
            );
        }
        let identity = Self::generate()?;
        let json = serde_json::to_string(&identity).map_err(err)?;
        secret::save_secret(data_dir, Secret::C2paSigning, Some(&json))?;
        Ok(identity)
    }

    /// The DER bytes of the leaf certificate.
    fn leaf_der(&self) -> Option<Vec<u8>> {
        first_pem(&self.chain)
    }
}

/// The DER bytes of the first PEM certificate in `pem`.
fn first_pem(pem: &str) -> Option<Vec<u8>> {
    use base64::Engine;
    let start = pem.find("-----BEGIN CERTIFICATE-----")? + "-----BEGIN CERTIFICATE-----".len();
    let end = start + pem[start..].find("-----END CERTIFICATE-----")?;
    let body: String = pem[start..end]
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    base64::engine::general_purpose::STANDARD.decode(body).ok()
}

/// The CBOR shape of a soft-binding assertion (the value is a byte string, as the C2PA schema says).
#[derive(Serialize)]
struct SoftBinding<'a> {
    alg: &'a str,
    blocks: Vec<SoftBindingBlock>,
}

#[derive(Serialize)]
struct SoftBindingBlock {
    scope: Scope,
    value: serde_bytes::ByteBuf,
}

#[derive(Serialize)]
struct Scope {}

fn context(settings: &str) -> Result<Context, String> {
    Context::new().with_settings(settings).map_err(err)
}

/// The encoded copy with a signed manifest embedded. `mime` is `image/png`, `image/jpeg` or `image/webp`;
/// `soft_binding` is the watermark's algorithm and value when the copy carries one.
pub fn sign(
    bytes: &[u8],
    mime: &str,
    identity: &Identity,
    soft_binding: Option<(&str, &str)>,
) -> Result<Vec<u8>, String> {
    let signer = c2pa::create_signer::from_keys(
        identity.chain.as_bytes(),
        identity.key.as_bytes(),
        c2pa::SigningAlg::Es256,
        None,
    )
    .map_err(err)?;
    let ctx = context(
        r#"{"verify": {"verify_after_sign": false}, "builder": {"thumbnail": {"enabled": false}}}"#,
    )?;
    let mut builder = Builder::from_context(ctx);
    builder.set_intent(BuilderIntent::Create(
        DigitalSourceType::TrainedAlgorithmicMedia,
    ));
    builder.set_claim_generator_info(ClaimGeneratorInfo::new(SIGNER_NAME));
    if let Some((alg, value)) = soft_binding {
        builder
            .add_assertion(
                "c2pa.soft-binding",
                &SoftBinding {
                    alg,
                    blocks: vec![SoftBindingBlock {
                        scope: Scope {},
                        value: serde_bytes::ByteBuf::from(value.as_bytes().to_vec()),
                    }],
                },
            )
            .map_err(err)?;
        builder
            .add_action(serde_json::json!({ "action": "c2pa.watermarked" }))
            .map_err(err)?;
    }
    let mut source = Cursor::new(bytes);
    let mut dest = Cursor::new(Vec::with_capacity(bytes.len() + 16 * 1024));
    builder
        .sign(signer.as_ref(), mime, &mut source, &mut dest)
        .map_err(err)?;
    Ok(dest.into_inner())
}

/// What the C2PA manifest of a file says.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Found {
    /// The file carries a manifest.
    pub present: bool,
    /// Its signature and hashes check out (the signer may still be unknown).
    pub valid: bool,
    /// The signer is on a trust list.
    pub trusted: bool,
    /// An action names IPTC `trainedAlgorithmicMedia` (or a composite with it) as the source.
    pub ai: bool,
    /// The certificate's common name (or issuer), as the file states it.
    pub signer: Option<String>,
    /// Signed with this installation's certificate.
    pub this_app: bool,
    /// The value of a TrustMark soft-binding assertion, as text.
    pub soft_binding: Option<String>,
}

/// Reads the manifest of a file (outside data; c2pa checks its structure). `identity` is this installation's, to
/// recognise its own signature.
pub fn read(bytes: &[u8], mime: &str, identity: Option<&Identity>) -> Found {
    let Ok(ctx) = context(r#"{"verify": {"verify_trust": true}}"#) else {
        return Found::default();
    };
    let Ok(reader) = Reader::from_context(ctx).with_stream(mime, Cursor::new(bytes)) else {
        return Found::default();
    };
    let Some(manifest) = reader.active_manifest() else {
        return Found::default();
    };
    let state = reader.validation_state();
    let signature = manifest.signature_info();
    let mut found = Found {
        present: true,
        valid: matches!(state, ValidationState::Valid | ValidationState::Trusted),
        trusted: state == ValidationState::Trusted,
        signer: signature.and_then(|s| s.common_name.clone().or_else(|| s.issuer.clone())),
        this_app: match (identity.and_then(Identity::leaf_der), signature) {
            (Some(ours), Some(sig)) => first_pem(sig.cert_chain()).as_deref() == Some(&ours[..]),
            _ => false,
        },
        ..Found::default()
    };
    for assertion in manifest.assertions() {
        let Ok(value) = assertion.value() else {
            continue;
        };
        if assertion.label().starts_with("c2pa.actions") {
            let actions = value["actions"].as_array().cloned().unwrap_or_default();
            found.ai |= actions.iter().any(|a| {
                a["digitalSourceType"]
                    .as_str()
                    .is_some_and(|t| t.rsplit('/').next().is_some_and(super::xmp::is_ai_source))
            });
        } else if assertion.label() == "c2pa.soft-binding" {
            let block = &value["blocks"][0]["value"];
            found.soft_binding = block.as_array().map(|bytes| {
                bytes
                    .iter()
                    .filter_map(|b| b.as_u64().and_then(|b| u8::try_from(b).ok()))
                    .map(char::from)
                    .take(256)
                    .collect()
            });
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageFormat, RgbImage};

    fn picture(format: ImageFormat) -> Vec<u8> {
        let img = RgbImage::from_fn(64, 48, |x, y| image::Rgb([x as u8 * 4, y as u8 * 5, 77]));
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(img)
            .write_to(&mut out, format)
            .unwrap();
        out.into_inner()
    }

    fn mime(format: ImageFormat) -> &'static str {
        format.to_mime_type()
    }

    #[test]
    fn every_export_format_gets_a_valid_manifest_that_says_ai_and_carries_the_soft_binding() {
        let me = Identity::generate().unwrap();
        for format in [ImageFormat::Png, ImageFormat::Jpeg, ImageFormat::WebP] {
            let plain = picture(format);
            assert_eq!(read(&plain, mime(format), Some(&me)), Found::default());
            let signed = sign(
                &plain,
                mime(format),
                &me,
                Some(("com.adobe.trustmark.P", "1*0101")),
            )
            .unwrap();
            let found = read(&signed, mime(format), Some(&me));
            assert!(
                found.present && found.valid && found.ai,
                "{format:?} {found:?}"
            );
            assert!(!found.trusted, "a self-made CA is on nobody's trust list");
            assert!(found.this_app);
            assert_eq!(found.signer.as_deref(), Some(SIGNER_NAME));
            assert_eq!(found.soft_binding.as_deref(), Some("1*0101"));
            // The pixels are untouched.
            let a = image::load_from_memory(&plain).unwrap().to_rgb8();
            let b = image::load_from_memory_with_format(&signed, format)
                .unwrap()
                .to_rgb8();
            assert_eq!(a, b, "{format:?}");
        }
    }

    #[test]
    fn another_installation_s_signature_is_not_this_app_and_a_change_breaks_validity() {
        let (me, other) = (Identity::generate().unwrap(), Identity::generate().unwrap());
        let signed = sign(&picture(ImageFormat::Png), "image/png", &other, None).unwrap();
        let found = read(&signed, "image/png", Some(&me));
        assert!(found.present && found.valid && found.ai && !found.this_app);
        assert_eq!(found.soft_binding, None);
        // Flip one byte of the pixel data: the hash in the manifest no longer matches.
        let mut tampered = signed.clone();
        let idat = tampered.windows(4).position(|w| w == b"IDAT").unwrap();
        tampered[idat + 10] ^= 0xff;
        let found = read(&tampered, "image/png", Some(&me));
        assert!(found.present && !found.valid, "{found:?}");
    }

    #[test]
    fn the_leaf_certificate_is_not_a_ca_and_carries_no_personal_name() {
        let me = Identity::generate().unwrap();
        assert_eq!(me.chain.matches("-----BEGIN CERTIFICATE-----").count(), 2);
        assert!(me.key.contains("PRIVATE KEY"));
        let der = me.leaf_der().unwrap();
        assert!(der.len() > 100);
        let text = String::from_utf8_lossy(&der);
        assert!(text.contains(SIGNER_NAME));
        if let Ok(user) = std::env::var("USERNAME") {
            if user.len() > 3 {
                assert!(!text.contains(&user));
            }
        }
        assert!(
            format!("{me:?}").find("PRIVATE").is_none(),
            "Debug hides the key"
        );
    }

    #[test]
    fn garbage_has_no_manifest() {
        assert_eq!(read(b"not a picture", "image/png", None), Found::default());
        assert_eq!(read(&[], "image/jpeg", None), Found::default());
        assert_eq!(first_pem("no pem here"), None);
    }

    #[cfg(windows)]
    #[test]
    fn the_identity_is_saved_encrypted_and_reused() {
        let dir = tempfile::tempdir().unwrap();
        let a = Identity::load_or_create(dir.path()).unwrap();
        let b = Identity::load_or_create(dir.path()).unwrap();
        assert_eq!(a.chain, b.chain);
        let raw = std::fs::read(dir.path().join("secrets").join("c2pa-signing.key")).unwrap();
        assert!(!String::from_utf8_lossy(&raw).contains("PRIVATE KEY"));
    }
}
