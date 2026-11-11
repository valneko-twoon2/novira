//! The passkey checks against a pretend authenticator that signs with a real P-256 key, as a phone does.
use super::*;
use ring::rand::SystemRandom;
use ring::signature::{EcdsaKeyPair, KeyPair as _, ECDSA_P256_SHA256_ASN1_SIGNING};

pub(crate) const RP: &str = "pc.tail1234.ts.net";
pub(crate) const ORIGIN: &str = "https://pc.tail1234.ts.net:51500";

pub(crate) fn party() -> Party<'static> {
    Party {
        rp_id: RP,
        origin: ORIGIN,
    }
}

/// What `navigator.credentials.create` hands the page.
pub(crate) struct Made {
    pub client_data: Vec<u8>,
    pub auth_data: Vec<u8>,
    pub id: Vec<u8>,
    pub spki: Vec<u8>,
}

/// What `navigator.credentials.get` hands the page.
pub(crate) struct Signed {
    pub client_data: Vec<u8>,
    pub auth_data: Vec<u8>,
    pub signature: Vec<u8>,
}

/// A phone's passkey: a P-256 key, its credential id and, when `counting`, a signature counter.
pub(crate) struct Authenticator {
    key: EcdsaKeyPair,
    pub id: Vec<u8>,
    pub count: u32,
    pub counting: bool,
    pub flags: u8,
}

impl Authenticator {
    pub fn new() -> Authenticator {
        let rng = SystemRandom::new();
        let pkcs8 = EcdsaKeyPair::generate_pkcs8(&ECDSA_P256_SHA256_ASN1_SIGNING, &rng).unwrap();
        let key = EcdsaKeyPair::from_pkcs8(&ECDSA_P256_SHA256_ASN1_SIGNING, pkcs8.as_ref(), &rng)
            .unwrap();
        let mut id = vec![0u8; 20];
        ring::rand::SecureRandom::fill(&rng, &mut id).unwrap();
        Authenticator {
            key,
            id,
            count: 0,
            counting: false,
            flags: USER_PRESENT | USER_VERIFIED,
        }
    }

    pub fn point(&self) -> [u8; 65] {
        self.key.public_key().as_ref().try_into().unwrap()
    }

    pub fn spki(&self) -> Vec<u8> {
        [&P256_SPKI_PREFIX[..], &self.point()].concat()
    }

    /// The COSE key: `{1: 2, 3: -7, -1: 1, -2: x, -3: y}`.
    pub fn cose(&self) -> Vec<u8> {
        let p = self.point();
        [
            &[0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20][..],
            &p[1..33],
            &[0x22, 0x58, 0x20],
            &p[33..],
        ]
        .concat()
    }

    pub fn auth_data(&self, rp_id: &str, flags: u8, attested: Option<&[u8]>) -> Vec<u8> {
        let mut out = ring::digest::digest(&ring::digest::SHA256, rp_id.as_bytes())
            .as_ref()
            .to_vec();
        out.push(flags);
        out.extend_from_slice(&self.count.to_be_bytes());
        if let Some(cose) = attested {
            out.extend_from_slice(&[0u8; 16]);
            out.extend_from_slice(&(self.id.len() as u16).to_be_bytes());
            out.extend_from_slice(&self.id);
            out.extend_from_slice(cose);
        }
        out
    }

    pub fn create(&self, party: Party<'_>, challenge: &[u8]) -> Made {
        let cose = self.cose();
        Made {
            client_data: client_data("webauthn.create", challenge, party.origin),
            auth_data: self.auth_data(party.rp_id, self.flags | ATTESTED, Some(&cose)),
            id: self.id.clone(),
            spki: self.spki(),
        }
    }

    pub fn sign(&self, auth_data: &[u8], client_data: &[u8]) -> Vec<u8> {
        let hash = ring::digest::digest(&ring::digest::SHA256, client_data);
        let message = [auth_data, hash.as_ref()].concat();
        self.key
            .sign(&SystemRandom::new(), &message)
            .unwrap()
            .as_ref()
            .to_vec()
    }

    pub fn get(&mut self, party: Party<'_>, challenge: &[u8]) -> Signed {
        if self.counting {
            self.count += 1;
        }
        let client_data = client_data("webauthn.get", challenge, party.origin);
        let auth_data = self.auth_data(party.rp_id, self.flags, None);
        let signature = self.sign(&auth_data, &client_data);
        Signed {
            client_data,
            auth_data,
            signature,
        }
    }
}

pub(crate) fn client_data(kind: &str, challenge: &[u8], origin: &str) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({ "type": kind, "challenge": encode(challenge), "origin": origin, "crossOrigin": false })).unwrap()
}

const CHALLENGE: [u8; 32] = [7; 32];

fn new_key(a: &Authenticator, m: &Made) -> Result<NewKey, Refusal> {
    check_new(
        party(),
        &CHALLENGE,
        &m.client_data,
        &m.auth_data,
        &m.id,
        ES256,
        &m.spki,
    )
    .inspect(|k| assert_eq!(k.public_key, a.point()))
}

// tags: equivalence
#[test]
fn a_new_passkey_checks_out_and_its_key_and_id_come_back() {
    let a = Authenticator::new();
    let key = new_key(&a, &a.create(party(), &CHALLENGE)).unwrap();
    assert_eq!(key.credential_id, a.id);
    assert_eq!(key.sign_count, 0);
}

// tags: error-guessing, decision-table
#[test]
fn a_new_passkey_for_another_challenge_origin_party_or_ceremony_is_refused() {
    let a = Authenticator::new();
    let mut m = a.create(party(), &[8; 32]);
    assert_eq!(new_key(&a, &m), Err(Refusal::WrongChallenge));
    for (origin, why) in [
        ("https://pc.tail1234.ts.net:51501", Refusal::WrongOrigin),
        ("http://pc.tail1234.ts.net:51500", Refusal::WrongOrigin),
        ("https://evil.example", Refusal::WrongOrigin),
    ] {
        m.client_data = client_data("webauthn.create", &CHALLENGE, origin);
        assert_eq!(new_key(&a, &m), Err(why), "{origin}");
    }
    m.client_data = client_data("webauthn.get", &CHALLENGE, ORIGIN);
    assert_eq!(new_key(&a, &m), Err(Refusal::WrongType));
    // In a frame of another site.
    m.client_data = serde_json::to_vec(&serde_json::json!({ "type": "webauthn.create", "challenge": encode(&CHALLENGE), "origin": ORIGIN, "crossOrigin": true })).unwrap();
    assert_eq!(new_key(&a, &m), Err(Refusal::WrongOrigin));
    m.client_data = serde_json::to_vec(&serde_json::json!({ "type": "webauthn.create", "challenge": encode(&CHALLENGE), "origin": ORIGIN, "topOrigin": "https://evil.example" })).unwrap();
    assert_eq!(new_key(&a, &m), Err(Refusal::WrongOrigin));
    // Signed for another relying party.
    let other = Authenticator::new();
    let mut m = other.create(
        Party {
            rp_id: "other.tail1234.ts.net",
            origin: ORIGIN,
        },
        &CHALLENGE,
    );
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            &m.id,
            ES256,
            &m.spki
        ),
        Err(Refusal::WrongRelyingParty)
    );
    // Not JSON, or a padded challenge (a browser never sends one).
    m.client_data = b"{".to_vec();
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            &m.id,
            ES256,
            &m.spki
        ),
        Err(Refusal::Malformed)
    );
    let padded = format!("{}=", encode(&CHALLENGE[..31]));
    assert_eq!(decode(&padded), None);
    m.client_data = serde_json::to_vec(
        &serde_json::json!({ "type": "webauthn.create", "challenge": padded, "origin": ORIGIN }),
    )
    .unwrap();
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            &m.id,
            ES256,
            &m.spki
        ),
        Err(Refusal::WrongChallenge)
    );
}

// tags: decision-table, condition
#[test]
fn a_new_passkey_needs_a_present_and_verified_user() {
    let mut a = Authenticator::new();
    a.flags = USER_PRESENT;
    assert_eq!(
        new_key(&a, &a.create(party(), &CHALLENGE)),
        Err(Refusal::NotVerified)
    );
    a.flags = USER_VERIFIED;
    assert_eq!(
        new_key(&a, &a.create(party(), &CHALLENGE)),
        Err(Refusal::NotPresent)
    );
}

// tags: error-guessing
#[test]
fn a_new_passkey_must_be_p256_and_the_key_the_authenticator_named() {
    let a = Authenticator::new();
    let m = a.create(party(), &CHALLENGE);
    // RS256 or Ed25519.
    for alg in [-257, -8] {
        assert_eq!(
            check_new(
                party(),
                &CHALLENGE,
                &m.client_data,
                &m.auth_data,
                &m.id,
                alg,
                &m.spki
            ),
            Err(Refusal::UnsupportedKey)
        );
    }
    // Another phone's key in place of this one's.
    let other = Authenticator::new();
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            &m.id,
            ES256,
            &other.spki()
        ),
        Err(Refusal::UnsupportedKey)
    );
    // A key that is not P-256 SPKI, or a compressed point.
    let mut bad = m.spki.clone();
    bad[5] ^= 1;
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            &m.id,
            ES256,
            &bad
        ),
        Err(Refusal::UnsupportedKey)
    );
    let mut compressed = m.spki.clone();
    compressed[26] = 0x02;
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            &m.id,
            ES256,
            &compressed
        ),
        Err(Refusal::UnsupportedKey)
    );
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            &m.id,
            ES256,
            &m.spki[..90]
        ),
        Err(Refusal::UnsupportedKey)
    );
}

// tags: error-guessing, boundary
#[test]
fn a_new_passkey_must_carry_its_own_id_and_attested_data() {
    let a = Authenticator::new();
    let m = a.create(party(), &CHALLENGE);
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &m.auth_data,
            b"another",
            ES256,
            &m.spki
        ),
        Err(Refusal::WrongCredential)
    );
    // No attested credential data.
    let plain = a.auth_data(RP, USER_PRESENT | USER_VERIFIED, None);
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &plain,
            &m.id,
            ES256,
            &m.spki
        ),
        Err(Refusal::Malformed)
    );
    // A length longer than the data, and data cut short.
    let mut long = m.auth_data.clone();
    long[53] = 0xff;
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &m.client_data,
            &long,
            &m.id,
            ES256,
            &m.spki
        ),
        Err(Refusal::Malformed)
    );
    for cut in [0, 10, 36, 54] {
        assert_eq!(
            check_new(
                party(),
                &CHALLENGE,
                &m.client_data,
                &m.auth_data[..cut],
                &m.id,
                ES256,
                &m.spki
            ),
            Err(Refusal::Malformed),
            "{cut}"
        );
    }
}

// tags: equivalence
#[test]
fn a_sign_in_verifies_with_the_stored_key() {
    let mut a = Authenticator::new();
    let s = a.get(party(), &CHALLENGE);
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            0,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Ok(0)
    );
}

// tags: error-guessing
#[test]
fn a_sign_in_with_another_key_a_changed_message_or_another_challenge_is_refused() {
    let mut a = Authenticator::new();
    let other = Authenticator::new();
    let s = a.get(party(), &CHALLENGE);
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &other.point(),
            0,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Err(Refusal::BadSignature)
    );
    // The flags changed after signing (claiming a verification that did not happen is caught by the signature).
    let mut flipped = s.auth_data.clone();
    flipped[36] ^= 1;
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            0,
            &s.client_data,
            &flipped,
            &s.signature
        ),
        Err(Refusal::BadSignature)
    );
    let mut sig = s.signature.clone();
    let last = sig.len() - 1;
    sig[last] ^= 1;
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            0,
            &s.client_data,
            &s.auth_data,
            &sig
        ),
        Err(Refusal::BadSignature)
    );
    assert_eq!(
        check_sign_in(
            party(),
            &[9; 32],
            &a.point(),
            0,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Err(Refusal::WrongChallenge)
    );
    // A creation's client data is not a sign-in.
    let made = a.create(party(), &CHALLENGE);
    let signature = a.sign(&s.auth_data, &made.client_data);
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            0,
            &made.client_data,
            &s.auth_data,
            &signature
        ),
        Err(Refusal::WrongType)
    );
}

// tags: condition
#[test]
fn a_sign_in_needs_a_verified_user_even_when_signed() {
    let mut a = Authenticator::new();
    a.flags = USER_PRESENT;
    let s = a.get(party(), &CHALLENGE);
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            0,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Err(Refusal::NotVerified)
    );
}

// tags: boundary, state-transition
#[test]
fn a_counter_that_does_not_move_on_is_refused_and_zero_always_passes() {
    let mut a = Authenticator::new();
    a.counting = true;
    let s = a.get(party(), &CHALLENGE);
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            0,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Ok(1)
    );
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            1,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Err(Refusal::CounterWentBack)
    );
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &a.point(),
            5,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Err(Refusal::CounterWentBack)
    );
    // A passkey that syncs keeps zero; a stored count with a zero now means the counter was reset (a copy).
    let mut synced = Authenticator::new();
    let s = synced.get(party(), &CHALLENGE);
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &synced.point(),
            0,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Ok(0)
    );
    assert_eq!(
        check_sign_in(
            party(),
            &CHALLENGE,
            &synced.point(),
            3,
            &s.client_data,
            &s.auth_data,
            &s.signature
        ),
        Err(Refusal::CounterWentBack)
    );
}

// tags: equivalence, error-guessing
#[test]
fn the_challenge_is_read_from_the_client_data() {
    assert_eq!(
        challenge_of(&client_data("webauthn.get", &CHALLENGE, ORIGIN)),
        Some(CHALLENGE.to_vec())
    );
    assert_eq!(challenge_of(b"{}"), None);
    assert_eq!(challenge_of(b"x"), None);
    assert_eq!(challenge_of(br#"{"challenge":"***"}"#), None);
    assert_eq!(decode(&encode(b"\xff\xfe")), Some(b"\xff\xfe".to_vec()));
}

/// A new passkey's parts with `id` as its credential id and `cose` after it (for the shapes a phone never sends).
fn made_with(a: &Authenticator, flags: u8, id: Vec<u8>, cose: &[u8]) -> Result<NewKey, Refusal> {
    let mut phone = Authenticator::new();
    phone.id = id.clone();
    let auth_data = [
        &a.auth_data(RP, flags, None)[..],
        &[0u8; 16],
        &(id.len() as u16).to_be_bytes(),
        &id,
        cose,
    ]
    .concat();
    let client_data = client_data("webauthn.create", &CHALLENGE, ORIGIN);
    check_new(
        party(),
        &CHALLENGE,
        &client_data,
        &auth_data,
        &id,
        ES256,
        &a.spki(),
    )
}

const VERIFIED: u8 = USER_PRESENT | USER_VERIFIED;

// tags: equivalence
#[test]
fn es256_is_cose_algorithm_minus_7_as_the_browser_reports_it() {
    let a = Authenticator::new();
    let m = a.create(party(), &CHALLENGE);
    assert_eq!(ES256, -7);
    assert!(check_new(
        party(),
        &CHALLENGE,
        &m.client_data,
        &m.auth_data,
        &m.id,
        -7,
        &m.spki
    )
    .is_ok());
}

// tags: condition, error-guessing
#[test]
fn attested_data_without_the_attested_flag_is_refused() {
    let a = Authenticator::new();
    assert!(made_with(&a, VERIFIED | ATTESTED, vec![5; 16], &a.cose()).is_ok());
    assert_eq!(
        made_with(&a, VERIFIED, vec![5; 16], &a.cose()),
        Err(Refusal::Malformed)
    );
}

// tags: boundary
#[test]
fn the_credential_id_is_1_to_1023_bytes() {
    let a = Authenticator::new();
    assert!(made_with(&a, VERIFIED | ATTESTED, vec![5; 1], &a.cose()).is_ok());
    assert!(made_with(
        &a,
        VERIFIED | ATTESTED,
        vec![5; MAX_CREDENTIAL_ID],
        &a.cose()
    )
    .is_ok());
    assert_eq!(
        made_with(
            &a,
            VERIFIED | ATTESTED,
            vec![5; MAX_CREDENTIAL_ID + 1],
            &a.cose()
        ),
        Err(Refusal::WrongCredential)
    );
    assert_eq!(
        made_with(&a, VERIFIED | ATTESTED, vec![], &a.cose()),
        Err(Refusal::WrongCredential)
    );
    // A short one that is not the one named: the id is read where it is, and found wrong.
    let mut short = a.auth_data(RP, VERIFIED | ATTESTED, None);
    short.extend_from_slice(&[0u8; 16]);
    short.extend_from_slice(&1u16.to_be_bytes());
    short.push(9);
    let client_data = client_data("webauthn.create", &CHALLENGE, ORIGIN);
    assert_eq!(
        check_new(
            party(),
            &CHALLENGE,
            &client_data,
            &short,
            &[8],
            ES256,
            &a.spki()
        ),
        Err(Refusal::WrongCredential)
    );
}

// tags: error-guessing
#[test]
fn the_cose_key_must_name_es256_and_hold_x_and_y() {
    let a = Authenticator::new();
    let cose = a.cose();
    let p = a.point();
    let alg = [0x03, 0x26];
    let x = [&[0x21, 0x58, 0x20][..], &p[1..33]].concat();
    let y = [&[0x22, 0x58, 0x20][..], &p[33..]].concat();
    for (missing, part) in [("alg", &alg[..]), ("x", &x[..]), ("y", &y[..])] {
        let at = cose.windows(part.len()).position(|w| w == part).unwrap();
        let mut without = cose.clone();
        without[at] ^= 0xff;
        assert_eq!(
            made_with(&a, VERIFIED | ATTESTED, vec![5; 16], &without),
            Err(Refusal::UnsupportedKey),
            "{missing}"
        );
    }
}

// tags: error-guessing
#[test]
fn the_key_is_read_after_the_credential_id_not_inside_it() {
    let a = Authenticator::new();
    let other = Authenticator::new();
    let p = a.point();
    let x = [&[0x21, 0x58, 0x20][..], &p[1..33]].concat();
    let y = [&[0x22, 0x58, 0x20][..], &p[33..]].concat();
    // An id that carries this key's x and y, before another phone's COSE key.
    let id = [&x[..], &y[..], &[0x03, 0x26]].concat();
    assert_eq!(
        made_with(&a, VERIFIED | ATTESTED, id, &other.cose()),
        Err(Refusal::UnsupportedKey)
    );
    // An id that ends with the first bytes of x, before a key that has the rest: x is not whole in the key.
    let mut id = vec![5; 12];
    id.extend_from_slice(&x[..4]);
    let cose = [&x[4..], &y[..], &[0x03, 0x26]].concat();
    assert_eq!(
        made_with(&a, VERIFIED | ATTESTED, id, &cose),
        Err(Refusal::UnsupportedKey)
    );
}
