//! What the remote listener keeps in the data folder, in `<data>/remote.json`: whether this computer's owner turned it
//! on, the passkeys of the phones that may sign in, and a short log of enrolments and sign-ins.
//!
//! A passkey's public key is not a secret, but the file decides who gets in: it is written whole through a temporary
//! name, and a file or an entry that is not well formed is dropped (a damaged file can only let fewer phones in, never
//! more). It turns itself off after [`UNUSED_DAYS`] without an enrolment or a sign-in.
use super::passkey;
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// Where it is kept in the data folder.
pub const FILE: &str = "remote.json";
/// The most passkeys kept.
pub const MAX_PASSKEYS: usize = 16;
/// The most log lines kept (the oldest go first).
pub const MAX_LOG: usize = 50;
/// Unused for this many days, it turns itself off.
pub const UNUSED_DAYS: i64 = 14;

/// A phone that may sign in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Passkey {
    pub id: String,
    pub label: String,
    pub credential_id: Vec<u8>,
    pub public_key: [u8; 65],
    pub sign_count: u32,
    /// RFC 3339.
    pub added_at: String,
    pub last_used_at: Option<String>,
}

/// What a log line says happened.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Happened {
    /// A paired phone made a passkey.
    Enrolled,
    /// A phone signed in with its passkey.
    SignedIn,
    /// A sign-in with a known passkey failed its check (a wrong signature, a counter that went back).
    Refused,
}

impl Happened {
    fn name(self) -> &'static str {
        match self {
            Happened::Enrolled => "enrolled",
            Happened::SignedIn => "signedIn",
            Happened::Refused => "refused",
        }
    }

    fn from_name(name: &str) -> Option<Happened> {
        Some(match name {
            "enrolled" => Happened::Enrolled,
            "signedIn" => Happened::SignedIn,
            "refused" => Happened::Refused,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Line {
    pub at: String,
    pub what: Happened,
    pub label: String,
    pub peer: String,
}

#[derive(Debug)]
pub struct Store {
    path: PathBuf,
    pub enabled: bool,
    /// When it was turned on, RFC 3339.
    pub enabled_at: Option<String>,
    pub passkeys: Vec<Passkey>,
    pub log: Vec<Line>,
}

fn text(v: &Value, name: &str) -> Option<String> {
    v.get(name)?.as_str().map(str::to_string)
}

fn parse_passkey(v: &Value) -> Option<Passkey> {
    let credential_id = passkey::decode(v.get("credentialId")?.as_str()?)?;
    if credential_id.is_empty() || credential_id.len() > passkey::MAX_CREDENTIAL_ID {
        return None;
    }
    let public_key: [u8; 65] = passkey::decode(v.get("publicKey")?.as_str()?)?
        .try_into()
        .ok()?;
    if public_key[0] != 0x04 {
        return None;
    }
    let label = crate::pair::clean_label(v.get("label")?.as_str()?)?;
    let id = text(v, "id").filter(|id| {
        !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_hexdigit())
    })?;
    Some(Passkey {
        id,
        label,
        credential_id,
        public_key,
        sign_count: u32::try_from(v.get("signCount")?.as_u64()?).ok()?,
        added_at: text(v, "addedAt")?,
        last_used_at: text(v, "lastUsedAt"),
    })
}

fn parse_line(v: &Value) -> Option<Line> {
    Some(Line {
        at: text(v, "at")?,
        what: Happened::from_name(v.get("what")?.as_str()?)?,
        label: text(v, "label")?,
        peer: text(v, "peer")?,
    })
}

fn time(text: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(text)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}

impl Store {
    /// What is kept in `data`; a missing or damaged file is off with no passkeys.
    pub fn load(data: &Path) -> Store {
        let path = data.join(FILE);
        let value = std::fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str::<Value>(&t).ok())
            .unwrap_or(Value::Null);
        let list = |name: &str| {
            value
                .get(name)
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default()
        };
        let mut passkeys: Vec<Passkey> = Vec::new();
        for p in list("passkeys").iter().filter_map(parse_passkey) {
            // Two entries with one id or one credential: the first is kept.
            if passkeys.len() < MAX_PASSKEYS
                && !passkeys
                    .iter()
                    .any(|q| q.id == p.id || q.credential_id == p.credential_id)
            {
                passkeys.push(p);
            }
        }
        let mut log: Vec<Line> = list("log").iter().filter_map(parse_line).collect();
        let extra = log.len().saturating_sub(MAX_LOG);
        log.drain(..extra);
        Store {
            path,
            enabled: value.get("enabled").and_then(Value::as_bool) == Some(true),
            enabled_at: text(&value, "enabledAt"),
            passkeys,
            log,
        }
    }

    fn to_file(&self) -> Value {
        json!({
            "enabled": self.enabled,
            "enabledAt": self.enabled_at,
            "passkeys": self.passkeys.iter().map(|p| json!({
                "id": p.id,
                "label": p.label,
                "credentialId": passkey::encode(&p.credential_id),
                "publicKey": passkey::encode(&p.public_key),
                "signCount": p.sign_count,
                "addedAt": p.added_at,
                "lastUsedAt": p.last_used_at,
            })).collect::<Vec<_>>(),
            "log": self.log.iter().map(|l| json!({ "at": l.at, "what": l.what.name(), "label": l.label, "peer": l.peer })).collect::<Vec<_>>(),
        })
    }

    /// Writes the whole file through a temporary name.
    pub fn save(&self) -> Result<(), String> {
        let text = serde_json::to_string_pretty(&self.to_file()).map_err(|e| e.to_string())?;
        let temporary = self.path.with_extension("json.tmp");
        std::fs::write(&temporary, text)
            .and_then(|()| std::fs::rename(&temporary, &self.path))
            .map_err(|e| format!("cannot save {}: {e}", FILE))
    }

    /// Turns it on or off and saves; turning it on starts the unused time again.
    pub fn set_enabled(&mut self, on: bool, now: DateTime<Utc>) -> Result<(), String> {
        let before = (self.enabled, self.enabled_at.clone());
        self.enabled = on;
        if on {
            self.enabled_at = Some(now.to_rfc3339());
        }
        self.save()
            .inspect_err(|_| (self.enabled, self.enabled_at) = before)
    }

    /// Whether it is on and nothing has used it for [`UNUSED_DAYS`]: no enrolment, no sign-in, since it was turned on.
    pub fn unused(&self, now: DateTime<Utc>) -> bool {
        if !self.enabled {
            return false;
        }
        let last = self
            .passkeys
            .iter()
            .flat_map(|p| [Some(p.added_at.as_str()), p.last_used_at.as_deref()])
            .chain([self.enabled_at.as_deref()])
            .flatten()
            .filter_map(time)
            .max();
        // On with no time to count from (a hand-edited file): counted from now on, by turning it on again.
        last.is_some_and(|last| {
            now.signed_duration_since(last) >= chrono::Duration::days(UNUSED_DAYS)
        })
    }

    pub fn by_credential(&self, credential_id: &[u8]) -> Option<&Passkey> {
        self.passkeys
            .iter()
            .find(|p| p.credential_id == credential_id)
    }

    /// Keeps a new passkey and saves; `Err` when there are too many or it cannot be saved.
    pub fn add(&mut self, passkey: Passkey) -> Result<(), String> {
        if self.passkeys.len() >= MAX_PASSKEYS {
            return Err("too many passkeys".into());
        }
        if self.by_credential(&passkey.credential_id).is_some() {
            return Err("that passkey is kept already".into());
        }
        self.passkeys.push(passkey);
        self.save().inspect_err(|_| {
            self.passkeys.pop();
        })
    }

    /// Forgets a passkey and saves; false when there was none.
    pub fn remove(&mut self, id: &str) -> Result<bool, String> {
        let Some(at) = self.passkeys.iter().position(|p| p.id == id) else {
            return Ok(false);
        };
        let gone = self.passkeys.remove(at);
        self.save()
            .map(|()| true)
            .inspect_err(|_| self.passkeys.insert(at, gone))
    }

    /// A sign-in with `id`: its counter and last use; saved with the log line.
    pub fn used(&mut self, id: &str, sign_count: u32, now: DateTime<Utc>) {
        if let Some(p) = self.passkeys.iter_mut().find(|p| p.id == id) {
            p.sign_count = sign_count;
            p.last_used_at = Some(now.to_rfc3339());
        }
    }

    /// Adds a log line and saves (a failure to save loses only the line and the counter).
    pub fn note(&mut self, what: Happened, label: &str, peer: &str, now: DateTime<Utc>) {
        self.log.push(Line {
            at: now.to_rfc3339(),
            what,
            label: label.to_string(),
            peer: peer.to_string(),
        });
        let extra = self.log.len().saturating_sub(MAX_LOG);
        self.log.drain(..extra);
        let _ = self.save();
    }

    /// The passkeys (no key material) and the log, newest first, as this computer's screen shows them.
    pub fn view(&self) -> (Value, Value) {
        let passkeys = self
            .passkeys
            .iter()
            .map(|p| json!({ "id": p.id, "label": p.label, "addedAt": p.added_at, "lastUsedAt": p.last_used_at }))
            .collect();
        let log = self
            .log
            .iter()
            .rev()
            .map(|l| json!({ "at": l.at, "what": l.what.name(), "label": l.label, "peer": l.peer }))
            .collect();
        (Value::Array(passkeys), Value::Array(log))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(day: u32) -> DateTime<Utc> {
        time(&format!("2026-11-{day:02}T09:00:00+00:00")).unwrap()
    }

    fn key(id: &str, credential: u8) -> Passkey {
        let mut public_key = [credential; 65];
        public_key[0] = 0x04;
        Passkey {
            id: id.into(),
            label: "iPhone".into(),
            credential_id: vec![credential; 16],
            public_key,
            sign_count: 0,
            added_at: at(1).to_rfc3339(),
            last_used_at: None,
        }
    }

    // tags: condition, error-guessing
    #[test]
    fn what_is_kept_comes_back_and_a_missing_file_is_off() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::load(dir.path());
        assert!(!s.enabled && s.passkeys.is_empty() && s.log.is_empty());
        s.set_enabled(true, at(1)).unwrap();
        s.add(key("a1", 1)).unwrap();
        s.used("a1", 3, at(2));
        s.note(Happened::SignedIn, "iPhone", "100.64.0.9", at(2));
        let again = Store::load(dir.path());
        assert!(again.enabled);
        assert_eq!(again.passkeys, s.passkeys);
        assert_eq!(again.passkeys[0].sign_count, 3);
        assert_eq!(again.log, s.log);
        // The screen's view has no key material.
        let (passkeys, log) = again.view();
        assert!(
            !passkeys.to_string().contains("publicKey")
                && !passkeys.to_string().contains("credentialId")
        );
        assert_eq!(log[0]["what"], "signedIn");
    }

    // tags: error-guessing
    #[test]
    fn a_damaged_file_or_entry_lets_fewer_in_never_more() {
        let dir = tempfile::tempdir().unwrap();
        for bad in ["", "x", "[]", "{\"enabled\":\"yes\"}"] {
            std::fs::write(dir.path().join(FILE), bad).unwrap();
            let s = Store::load(dir.path());
            assert!(!s.enabled && s.passkeys.is_empty(), "{bad:?}");
        }
        let mut s = Store::load(dir.path());
        s.add(key("a1", 1)).unwrap();
        let mut file: Value =
            serde_json::from_str(&std::fs::read_to_string(dir.path().join(FILE)).unwrap()).unwrap();
        let good = file["passkeys"][0].clone();
        let mutate = |f: &dyn Fn(&mut Value)| {
            let mut v = good.clone();
            f(&mut v);
            v
        };
        file["passkeys"] = json!([
            mutate(&|v| v["publicKey"] = json!("AAAA")),
            mutate(&|v| v["credentialId"] = json!("")),
            mutate(&|v| v["credentialId"] = json!(passkey::encode(&[1; 1024]))),
            mutate(&|v| v["label"] = json!("\u{202e}x")),
            mutate(&|v| v["id"] = json!("../x")),
            mutate(&|v| v["signCount"] = json!(-1)),
            good.clone(),
            // The same credential again under another id.
            mutate(&|v| v["id"] = json!("b2")),
        ]);
        std::fs::write(dir.path().join(FILE), file.to_string()).unwrap();
        let s = Store::load(dir.path());
        assert_eq!(s.passkeys.len(), 1);
        assert_eq!(s.passkeys[0].id, "a1");
    }

    // tags: boundary, state-transition
    #[test]
    fn passkeys_are_capped_kept_once_and_forgotten() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::load(dir.path());
        for i in 0..MAX_PASSKEYS {
            s.add(key(&format!("{i:02x}"), i as u8 + 1)).unwrap();
        }
        assert!(s.add(key("ff", 200)).is_err());
        assert_eq!(s.passkeys.len(), MAX_PASSKEYS);
        assert!(s.remove("00").unwrap());
        assert!(!s.remove("00").unwrap());
        assert!(s.add(key("aa", 2)).is_err(), "a credential kept already");
        assert_eq!(Store::load(dir.path()).passkeys.len(), MAX_PASSKEYS - 1);
    }

    // tags: boundary
    #[test]
    fn the_log_keeps_the_newest_lines() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::load(dir.path());
        for i in 0..MAX_LOG + 5 {
            s.note(Happened::Refused, &format!("p{i}"), "100.64.0.9", at(1));
        }
        assert_eq!(s.log.len(), MAX_LOG);
        assert_eq!(s.log[0].label, "p5");
        assert_eq!(Store::load(dir.path()).log.len(), MAX_LOG);
    }

    // tags: boundary
    #[test]
    fn it_counts_as_unused_after_two_weeks_without_an_enrolment_or_a_sign_in() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::load(dir.path());
        assert!(!s.unused(at(30)), "off is never unused");
        s.set_enabled(true, at(1)).unwrap();
        assert!(!s.unused(at(14)));
        assert!(s.unused(at(15)), "exactly 14 days");
        s.add(key("a1", 1)).unwrap(); // added on the 1st
        s.used("a1", 0, at(10));
        assert!(!s.unused(at(23)));
        assert!(s.unused(at(24)));
        s.set_enabled(true, at(25)).unwrap();
        assert!(!s.unused(at(26)), "turning it on again starts again");
        s.enabled_at = None;
        s.passkeys.clear();
        assert!(!s.unused(at(30)), "no time to count from");
    }
}
