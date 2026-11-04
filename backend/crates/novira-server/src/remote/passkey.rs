//! The relying party's side of a passkey (WebAuthn) for the remote listener: checking a new passkey when a paired phone
//! makes one, and checking a sign-in with it later.
//!
//! Only ES256 (ECDSA P-256 with SHA-256, COSE algorithm -7) is taken: it is what the passkeys of phones (iCloud
//! Keychain, Google Password Manager, the password managers) make. No attestation is asked for or read: the phone that
//! makes the passkey was approved on this computer first, so what vouches for the key is that approval, not a vendor's
//! certificate. The browser hands the public key over as SPKI (`getPublicKey()`), so no CBOR is parsed; the key is still
//! checked against the one in the authenticator data. Both checks require user verification (the phone's face, finger or
//! code), the origin and relying party of this listener, and a challenge this server made for that one use.
use ring::signature::{UnparsedPublicKey, ECDSA_P256_SHA256_ASN1};
use serde_json::Value;

/// The COSE algorithm number of ES256, the only one taken.
pub const ES256: i64 = -7;
/// The longest credential id the WebAuthn specification allows.
pub const MAX_CREDENTIAL_ID: usize = 1023;
/// The DER prefix of a P-256 public key in SPKI form, before its 65-byte uncompressed point.
const P256_SPKI_PREFIX: [u8; 26] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];
/// Authenticator data flags: the user was present, the user was verified, attested credential data follows.
const USER_PRESENT: u8 = 0x01;
const USER_VERIFIED: u8 = 0x04;
const ATTESTED: u8 = 0x40;
/// rpIdHash (32), flags (1), signCount (4).
const AUTH_DATA_HEAD: usize = 37;

/// Why a passkey or a sign-in was refused. The reason goes to this computer's log of the remote listener, never in
/// detail to the phone.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Refusal {
    /// A field is not what the browser sends (not JSON, too short, a length that does not add up).
    Malformed,
    /// The client data is for another ceremony (`webauthn.get` where `webauthn.create` was due, or the reverse).
    WrongType,
    /// The challenge is not the one this server made.
    WrongChallenge,
    /// The page that asked is not this listener's origin, or it was in a frame of another one.
    WrongOrigin,
    /// The authenticator signed for another relying party.
    WrongRelyingParty,
    /// The user did not touch or unlock the phone.
    NotPresent,
    /// The phone did not verify its user (no face, finger or code).
    NotVerified,
    /// The credential id does not match the one in the authenticator data.
    WrongCredential,
    /// Not a P-256 key (another algorithm), or not the key in the authenticator data.
    UnsupportedKey,
    /// The signature does not verify with the stored key.
    BadSignature,
    /// The signature counter went back: a copy of the key may be in use somewhere.
    CounterWentBack,
}

/// Where the ceremony must have happened.
#[derive(Clone, Copy, Debug)]
pub struct Party<'a> {
    /// The relying party id: the listener's tailnet name (`pc.tail1234.ts.net`).
    pub rp_id: &'a str,
    /// The page's origin: `https://<name>:<port>`.
    pub origin: &'a str,
}

/// A passkey that checked out.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewKey {
    pub credential_id: Vec<u8>,
    /// The uncompressed P-256 point (`04 || x || y`).
    pub public_key: [u8; 65],
    pub sign_count: u32,
}

/// The challenge of `client_data` as bytes, when it is JSON with a base64url challenge (to find which challenge of this
/// server it answers before checking the rest).
pub fn challenge_of(client_data: &[u8]) -> Option<Vec<u8>> {
    let value: Value = serde_json::from_slice(client_data).ok()?;
    decode(value.get("challenge")?.as_str()?)
}

/// base64url without padding, as WebAuthn writes its bytes (a padded value is refused: the browser never sends one).
pub fn decode(text: &str) -> Option<Vec<u8>> {
    use base64::Engine as _;
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(text)
        .ok()
}

pub fn encode(bytes: &[u8]) -> String {
    use base64::Engine as _;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn check_client_data(
    client_data: &[u8],
    kind: &str,
    challenge: &[u8],
    party: Party<'_>,
) -> Result<(), Refusal> {
    let value: Value = serde_json::from_slice(client_data).map_err(|_| Refusal::Malformed)?;
    let field = |name: &str| value.get(name).and_then(Value::as_str);
    if field("type") != Some(kind) {
        return Err(Refusal::WrongType);
    }
    let sent = field("challenge")
        .and_then(decode)
        .ok_or(Refusal::WrongChallenge)?;
    if !crate::same_secret_bytes(&sent, challenge) {
        return Err(Refusal::WrongChallenge);
    }
    if field("origin") != Some(party.origin) {
        return Err(Refusal::WrongOrigin);
    }
    // A ceremony inside a frame of another site names that site as its top origin.
    if value.get("crossOrigin").and_then(Value::as_bool) == Some(true)
        || value.get("topOrigin").is_some()
    {
        return Err(Refusal::WrongOrigin);
    }
    Ok(())
}

/// The flags and the signature counter, after checking the relying party and that the user was present and verified.
fn check_auth_data(auth_data: &[u8], party: Party<'_>) -> Result<(u8, u32), Refusal> {
    if auth_data.len() < AUTH_DATA_HEAD {
        return Err(Refusal::Malformed);
    }
    let rp_hash = ring::digest::digest(&ring::digest::SHA256, party.rp_id.as_bytes());
    if auth_data[..32] != *rp_hash.as_ref() {
        return Err(Refusal::WrongRelyingParty);
    }
    let flags = auth_data[32];
    if flags & USER_PRESENT == 0 {
        return Err(Refusal::NotPresent);
    }
    if flags & USER_VERIFIED == 0 {
        return Err(Refusal::NotVerified);
    }
    let count = u32::from_be_bytes([auth_data[33], auth_data[34], auth_data[35], auth_data[36]]);
    Ok((flags, count))
}

/// The P-256 point of an SPKI public key, or `None` for any other key.
fn p256_point(spki: &[u8]) -> Option<[u8; 65]> {
    let point = spki.strip_prefix(&P256_SPKI_PREFIX[..])?;
    (point.len() == 65 && point[0] == 0x04).then(|| {
        let mut out = [0u8; 65];
        out.copy_from_slice(point);
        out
    })
}

/// Whether `haystack` holds `needle`.
fn holds(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

/// Checks a passkey made by `navigator.credentials.create` for `challenge`: the client data, the authenticator data
/// (relying party, user present and verified, the credential's id) and the public key, which must be P-256 and the one
/// the authenticator data carries (its x and y as 32-byte CBOR strings, and the algorithm -7).
pub fn check_new(
    party: Party<'_>,
    challenge: &[u8],
    client_data: &[u8],
    auth_data: &[u8],
    credential_id: &[u8],
    algorithm: i64,
    spki: &[u8],
) -> Result<NewKey, Refusal> {
    check_client_data(client_data, "webauthn.create", challenge, party)?;
    let (flags, sign_count) = check_auth_data(auth_data, party)?;
    if flags & ATTESTED == 0 {
        return Err(Refusal::Malformed);
    }
    // aaguid (16), credentialIdLength (2), credentialId, credentialPublicKey (COSE).
    let at = AUTH_DATA_HEAD + 16;
    let length = auth_data
        .get(at..at + 2)
        .map(|b| usize::from(u16::from_be_bytes([b[0], b[1]])))
        .ok_or(Refusal::Malformed)?;
    let id = auth_data
        .get(at + 2..at + 2 + length)
        .ok_or(Refusal::Malformed)?;
    if id.is_empty() || id.len() > MAX_CREDENTIAL_ID || id != credential_id {
        return Err(Refusal::WrongCredential);
    }
    if algorithm != ES256 {
        return Err(Refusal::UnsupportedKey);
    }
    let public_key = p256_point(spki).ok_or(Refusal::UnsupportedKey)?;
    let cose = &auth_data[at + 2 + length..];
    // In the COSE key: `3: -7` (alg ES256), `-2: bstr(32) x`, `-3: bstr(32) y`.
    let x = [&[0x21, 0x58, 0x20][..], &public_key[1..33]].concat();
    let y = [&[0x22, 0x58, 0x20][..], &public_key[33..]].concat();
    if !(holds(cose, &[0x03, 0x26]) && holds(cose, &x) && holds(cose, &y)) {
        return Err(Refusal::UnsupportedKey);
    }
    Ok(NewKey {
        credential_id: credential_id.to_vec(),
        public_key,
        sign_count,
    })
}

/// Checks a sign-in made by `navigator.credentials.get` for `challenge` with the stored key; the new signature counter
/// comes back. A counter that does not move past a stored one that was counting is refused (a cloned key); phones whose
/// passkeys sync keep it at zero, which passes.
pub fn check_sign_in(
    party: Party<'_>,
    challenge: &[u8],
    public_key: &[u8; 65],
    stored_count: u32,
    client_data: &[u8],
    auth_data: &[u8],
    signature: &[u8],
) -> Result<u32, Refusal> {
    check_client_data(client_data, "webauthn.get", challenge, party)?;
    let (_, count) = check_auth_data(auth_data, party)?;
    let client_hash = ring::digest::digest(&ring::digest::SHA256, client_data);
    let signed = [auth_data, client_hash.as_ref()].concat();
    UnparsedPublicKey::new(&ECDSA_P256_SHA256_ASN1, &public_key[..])
        .verify(&signed, signature)
        .map_err(|_| Refusal::BadSignature)?;
    if (count != 0 || stored_count != 0) && count <= stored_count {
        return Err(Refusal::CounterWentBack);
    }
    Ok(count)
}

#[cfg(test)]
pub(crate) mod tests;
