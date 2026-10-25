//! The networks the home-network listener may open on. A network is told by the hardware address (MAC) of the gateway
//! of the interface that has the home address; this computer's owner confirms a network once and it is kept in
//! `<data>/lan-trusted.json` as `[{gatewayMac, label, addedAt}]`. A file that cannot be read trusts nothing.
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// Where the trusted networks are kept in the data folder.
pub const FILE: &str = "lan-trusted.json";
/// The most networks that can be trusted.
pub const MAX_ENTRIES: usize = 32;

/// A hardware address.
pub type Mac = [u8; 6];

/// `aa:bb:cc:dd:ee:ff`, lowercase.
pub fn mac_text(mac: &Mac) -> String {
    mac.iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(":")
}

/// Whether `mac` can name a gateway (not all zeros, not the broadcast address).
pub fn usable(mac: &Mac) -> bool {
    mac != &[0; 6] && mac != &[0xff; 6]
}

/// A hardware address written `aa:bb:cc:dd:ee:ff` (either case). The all-zero and the broadcast address name no
/// gateway, so they are not accepted.
pub fn parse_mac(text: &str) -> Option<Mac> {
    let parts: Vec<&str> = text.split(':').collect();
    if parts.len() != 6 {
        return None;
    }
    let mut mac = [0u8; 6];
    for (slot, part) in mac.iter_mut().zip(parts) {
        if part.len() != 2 || !part.bytes().all(|b| b.is_ascii_hexdigit()) {
            return None;
        }
        *slot = u8::from_str_radix(part, 16).ok()?;
    }
    usable(&mac).then_some(mac)
}

/// One trusted network.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub gateway_mac: Mac,
    pub label: String,
    /// When it was trusted, RFC 3339.
    pub added_at: String,
}

/// The trusted networks and the file they live in.
#[derive(Debug)]
pub struct Trusted {
    path: PathBuf,
    entries: Vec<Entry>,
}

impl Trusted {
    /// The networks saved in `data`. A missing file trusts nothing; so does one that is not an array, and an entry
    /// that is not well formed is dropped (a hand-edited file can only trust less than it says, never more).
    pub fn load(data: &Path) -> Trusted {
        let path = data.join(FILE);
        let entries = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default()
            .iter()
            .filter_map(|v| {
                Some(Entry {
                    gateway_mac: parse_mac(v.get("gatewayMac")?.as_str()?)?,
                    label: v.get("label")?.as_str()?.to_string(),
                    added_at: v.get("addedAt")?.as_str()?.to_string(),
                })
            })
            .take(MAX_ENTRIES)
            .collect();
        Trusted { path, entries }
    }

    pub fn entry(&self, mac: &Mac) -> Option<&Entry> {
        self.entries.iter().find(|e| &e.gateway_mac == mac)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_trusted(&self, mac: &Mac) -> bool {
        self.entry(mac).is_some()
    }

    /// Trusts `mac` under `label` (kept as it is when already trusted) and saves. `Err` names why not.
    pub fn add(&mut self, mac: Mac, label: &str, added_at: String) -> Result<(), String> {
        if self.is_trusted(&mac) {
            return Ok(());
        }
        if self.entries.len() >= MAX_ENTRIES {
            return Err("too many trusted networks".into());
        }
        self.entries.push(Entry {
            gateway_mac: mac,
            label: label.to_string(),
            added_at,
        });
        self.save().inspect_err(|_| {
            self.entries.pop();
        })
    }

    /// Stops trusting `mac` and saves; false when it was not trusted.
    pub fn remove(&mut self, mac: &Mac) -> Result<bool, String> {
        let Some(at) = self.entries.iter().position(|e| &e.gateway_mac == mac) else {
            return Ok(false);
        };
        let gone = self.entries.remove(at);
        match self.save() {
            Ok(()) => Ok(true),
            Err(e) => {
                self.entries.insert(at, gone);
                Err(e)
            }
        }
    }

    /// The entries as the JSON the file and `/lan/state` carry.
    pub fn to_json(&self) -> Value {
        Value::Array(
            self.entries
                .iter()
                .map(|e| {
                    json!({
                        "gatewayMac": mac_text(&e.gateway_mac),
                        "label": e.label,
                        "addedAt": e.added_at,
                    })
                })
                .collect(),
        )
    }

    /// Writes the file whole through a temporary name, so a crash never leaves half of it.
    fn save(&self) -> Result<(), String> {
        let temp = self.path.with_extension("json.tmp");
        let text = serde_json::to_string_pretty(&self.to_json()).map_err(|e| e.to_string())?;
        std::fs::write(&temp, text)
            .and_then(|()| std::fs::rename(&temp, &self.path))
            .map_err(|e| format!("cannot save the trusted networks: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: Mac = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];
    const B: Mac = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];

    #[test]
    fn a_mac_is_six_hex_pairs_and_names_a_real_gateway() {
        assert_eq!(mac_text(&B), "aa:bb:cc:dd:ee:ff");
        assert_eq!(parse_mac("AA:bb:cc:DD:ee:ff"), Some(B));
        assert_eq!(parse_mac(&mac_text(&A)), Some(A));
        for bad in [
            "",
            "aa:bb:cc:dd:ee",
            "aa:bb:cc:dd:ee:ff:00",
            "aa-bb-cc-dd-ee-ff",
            "aabbccddeeff",
            "aa:bb:cc:dd:ee:f",
            "aa:bb:cc:dd:ee:fff",
            "aa:bb:cc:dd:ee:gg",
            "+a:bb:cc:dd:ee:ff",
            " a:bb:cc:dd:ee:ff",
            "00:00:00:00:00:00",
            "ff:ff:ff:ff:ff:ff",
            "aa:bb:cc:dd:ee:ff\n",
        ] {
            assert_eq!(parse_mac(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn trusting_is_kept_in_the_file_and_comes_back() {
        let dir = tempfile::tempdir().unwrap();
        let mut t = Trusted::load(dir.path());
        assert!(!t.is_trusted(&A));
        t.add(A, "home", "2026-10-24T00:00:00+00:00".into())
            .unwrap();
        // Trusting again keeps the first label.
        t.add(A, "other", "2026-10-25T00:00:00+00:00".into())
            .unwrap();
        let again = Trusted::load(dir.path());
        assert!(again.is_trusted(&A) && !again.is_trusted(&B));
        assert_eq!(again.entry(&A).unwrap().label, "home");
        let text = std::fs::read_to_string(dir.path().join(FILE)).unwrap();
        let file: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(file[0]["gatewayMac"], "00:11:22:33:44:55");
        assert_eq!(file[0]["label"], "home");
        assert!(file[0]["addedAt"].is_string());
        assert!(!dir.path().join("lan-trusted.json.tmp").exists());
        let mut t = again;
        assert!(t.remove(&A).unwrap());
        assert!(!t.remove(&A).unwrap());
        assert!(!Trusted::load(dir.path()).is_trusted(&A));
    }

    #[test]
    fn a_file_that_cannot_be_read_trusts_nothing_and_a_bad_entry_only_itself() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(FILE);
        for junk in [
            "",
            "{",
            "{\"gatewayMac\":\"aa:bb:cc:dd:ee:ff\"}",
            "null",
            "[1,2]",
        ] {
            std::fs::write(&path, junk).unwrap();
            assert!(!Trusted::load(dir.path()).is_trusted(&B), "{junk:?}");
        }
        let mixed = r#"[
            {"gatewayMac":"00:00:00:00:00:00","label":"zero","addedAt":"x"},
            {"gatewayMac":"aa:bb:cc:dd:ee:ff","label":"ok","addedAt":"x"},
            {"gatewayMac":"00:11:22:33:44:55","label":7,"addedAt":"x"},
            {"gatewayMac":"00:11:22:33:44:55","addedAt":"x"}
        ]"#;
        std::fs::write(&path, mixed).unwrap();
        let t = Trusted::load(dir.path());
        assert!(t.is_trusted(&B) && !t.is_trusted(&A) && !t.is_trusted(&[0; 6]));
    }

    #[test]
    fn the_number_of_trusted_networks_is_capped() {
        let dir = tempfile::tempdir().unwrap();
        let mut t = Trusted::load(dir.path());
        for i in 0..MAX_ENTRIES as u8 {
            t.add([2, 0, 0, 0, 0, i], "n", "x".into()).unwrap();
        }
        assert!(t.add([2, 0, 0, 0, 1, 0], "n", "x".into()).is_err());
        assert!(!t.is_trusted(&[2, 0, 0, 0, 1, 0]));
        assert_eq!(
            Trusted::load(dir.path())
                .to_json()
                .as_array()
                .unwrap()
                .len(),
            MAX_ENTRIES
        );
    }

    #[test]
    fn a_failed_save_does_not_trust() {
        let dir = tempfile::tempdir().unwrap();
        // A folder where the file belongs makes the rename fail.
        std::fs::create_dir(dir.path().join(FILE)).unwrap();
        let mut t = Trusted::load(dir.path());
        assert!(t.add(A, "home", "x".into()).is_err());
        assert!(!t.is_trusted(&A));
    }
}
