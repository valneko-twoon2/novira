//! Secrets (the Civitai API key, the Hugging Face token, the key that signs content credentials, the assistant server's API key,
//! the key of the browser server's home-network CA) are stored encrypted with the Windows user's own key (DPAPI), so the file is
//! useless on another account or machine. They never travel to the frontend; it only learns whether one is set.
//!
//! The two site keys (Civitai, Hugging Face) live in the Windows Credential Manager instead of a file in the data folder. Each
//! data folder has its own id (`secrets/store-id`, which moves with the folder), so a second data folder (a test, an isolated
//! run) never reads or removes the keys of another. A key an earlier version saved as a file is moved into the Credential
//! Manager the first time it is read.
use std::path::{Path, PathBuf};

const SECRETS_DIR: &str = "secrets";
const ENTROPY: &[u8] = b"novira/civitai-key/v1";
const STORE_ID_FILE: &str = "store-id";

/// The secrets novira keeps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Secret {
    Civitai,
    HuggingFace,
    /// The private key and certificate chain that sign C2PA content credentials on exports.
    C2paSigning,
    /// The API key of the OpenAI-compatible server the assistant is connected to.
    AssistantEndpoint,
    /// The private key and certificate of the "novira local CA", which signs the browser server's home-network
    /// (TLS) certificate.
    LanCa,
}

impl Secret {
    fn file(self) -> &'static str {
        match self {
            Self::Civitai => "civitai.key",
            Self::HuggingFace => "huggingface.key",
            Self::C2paSigning => "c2pa-signing.key",
            Self::AssistantEndpoint => "assistant-endpoint.key",
            Self::LanCa => "lan-ca.key",
        }
    }

    /// The name of the entry in the Credential Manager, for the secrets kept there.
    fn credential_name(self) -> Option<&'static str> {
        match self {
            Self::Civitai => Some("civitai"),
            Self::HuggingFace => Some("huggingface"),
            _ => None,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Civitai => "Civitai key",
            Self::HuggingFace => "Hugging Face token",
            Self::C2paSigning => "signing key",
            Self::AssistantEndpoint => "assistant server key",
            Self::LanCa => "home-network certificate key",
        }
    }
}

fn secret_path(data_dir: &Path, which: Secret) -> PathBuf {
    data_dir.join(SECRETS_DIR).join(which.file())
}

/// The stored secret, or `None` when none is saved. A file that cannot be decrypted is an error.
pub fn load_secret(data_dir: &Path, which: Secret) -> Result<Option<String>, String> {
    let Some(name) = which.credential_name() else {
        return load_file(data_dir, which);
    };
    if let Some(target) = existing_target(data_dir, name) {
        if let Some(value) = credential::read(&target)? {
            return Ok(Some(value));
        }
    }
    // A key saved as a file by an earlier version: move it into the Credential Manager.
    let Some(value) = load_file(data_dir, which)? else {
        return Ok(None);
    };
    if store_credential(data_dir, name, &value).is_ok() {
        let _ = std::fs::remove_file(secret_path(data_dir, which));
    }
    Ok(Some(value))
}

fn load_file(data_dir: &Path, which: Secret) -> Result<Option<String>, String> {
    let bytes = match std::fs::read(secret_path(data_dir, which)) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("cannot read the saved {}: {e}", which.label())),
    };
    let plain = unprotect(&bytes)?;
    String::from_utf8(plain)
        .map(Some)
        .map_err(|_| format!("the saved {} is damaged", which.label()))
}

/// Saves the secret; `None` or a blank value removes it.
pub fn save_secret(data_dir: &Path, which: Secret, value: Option<&str>) -> Result<(), String> {
    let value = value.map(str::trim).filter(|k| !k.is_empty());
    if let Some(name) = which.credential_name() {
        match value {
            None => {
                if let Some(target) = existing_target(data_dir, name) {
                    credential::delete(&target)?;
                }
            }
            Some(k) => store_credential(data_dir, name, k)?,
        }
        // The file of an earlier version goes either way. One that cannot be removed no longer matters: the
        // Credential Manager is read first.
        let _ = std::fs::remove_file(secret_path(data_dir, which));
        return Ok(());
    }
    let path = secret_path(data_dir, which);
    match value {
        None => match std::fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("cannot remove the saved {}: {e}", which.label())),
        },
        Some(k) => {
            let sealed = protect(k.as_bytes())?;
            std::fs::create_dir_all(path.parent().expect("has a parent"))
                .map_err(|e| format!("cannot create the secrets folder: {e}"))?;
            std::fs::write(&path, sealed)
                .map_err(|e| format!("cannot save the {}: {e}", which.label()))
        }
    }
}

fn store_credential(data_dir: &Path, name: &str, value: &str) -> Result<(), String> {
    let target = target_for(data_dir, name, true)?.expect("created");
    credential::write(&target, value)
}

fn existing_target(data_dir: &Path, name: &str) -> Option<String> {
    target_for(data_dir, name, false).ok().flatten()
}

/// The Credential Manager entry name of one secret: `novira/<id of this data folder>/<name>`. Only a save makes the id.
fn target_for(data_dir: &Path, name: &str, create: bool) -> Result<Option<String>, String> {
    let file = data_dir.join(SECRETS_DIR).join(STORE_ID_FILE);
    let id = match std::fs::read_to_string(&file) {
        Ok(text) if is_store_id(text.trim()) => text.trim().to_string(),
        _ if !create => return Ok(None),
        _ => {
            let id = new_store_id();
            std::fs::create_dir_all(data_dir.join(SECRETS_DIR))
                .map_err(|e| format!("cannot create the secrets folder: {e}"))?;
            std::fs::write(&file, &id)
                .map_err(|e| format!("cannot save the secrets folder id: {e}"))?;
            id
        }
    };
    Ok(Some(format!("novira/{id}/{name}")))
}

fn is_store_id(text: &str) -> bool {
    text.len() == 32 && text.bytes().all(|b| b.is_ascii_hexdigit())
}

/// 128 random bits as hex, from the system's generator.
fn new_store_id() -> String {
    let mut bytes = [0u8; 16];
    credential::fill_random(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn load_civitai_key(data_dir: &Path) -> Result<Option<String>, String> {
    load_secret(data_dir, Secret::Civitai)
}

pub fn save_civitai_key(data_dir: &Path, key: Option<&str>) -> Result<(), String> {
    save_secret(data_dir, Secret::Civitai, key)
}

/// The Windows Credential Manager (generic credentials of the current user, kept on this PC only).
#[cfg(windows)]
mod credential {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND};
    use windows_sys::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
        CRED_TYPE_GENERIC,
    };

    /// The Credential Manager keeps at most 2560 bytes of secret per entry.
    const MAX_BLOB: usize = 2560;

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn read(target: &str) -> Result<Option<String>, String> {
        let name = wide(target);
        let mut found: *mut CREDENTIALW = std::ptr::null_mut();
        // SAFETY: `name` is NUL-terminated; on success Windows allocates `found`, which is freed with CredFree below.
        let ok = unsafe { CredReadW(name.as_ptr(), CRED_TYPE_GENERIC, 0, &mut found) };
        if ok == 0 {
            // SAFETY: reads the thread's last error right after the failed call.
            return match unsafe { GetLastError() } {
                ERROR_NOT_FOUND => Ok(None),
                code => Err(format!(
                    "cannot read the Windows Credential Manager (error {code})"
                )),
            };
        }
        // SAFETY: `found` points to a credential whose blob holds `CredentialBlobSize` bytes.
        let text = unsafe {
            let c = &*found;
            let bytes = if c.CredentialBlob.is_null() {
                &[][..]
            } else {
                std::slice::from_raw_parts(c.CredentialBlob, c.CredentialBlobSize as usize)
            };
            let units: Vec<u16> = bytes
                .as_chunks::<2>()
                .0
                .iter()
                .map(|p| u16::from_le_bytes(*p))
                .collect();
            let text = String::from_utf16(&units);
            CredFree(found as *const _);
            text
        };
        text.map(Some)
            .map_err(|_| "the key in the Windows Credential Manager is damaged".into())
    }

    pub fn write(target: &str, value: &str) -> Result<(), String> {
        // UTF-16 is what the Credential Manager's own screen shows as text.
        let blob: Vec<u8> = value.encode_utf16().flat_map(u16::to_le_bytes).collect();
        if blob.len() > MAX_BLOB {
            return Err("the key is too long for the Windows Credential Manager".into());
        }
        let mut name = wide(target);
        let mut user = wide("novira");
        // SAFETY: CREDENTIALW is plain data; zero is a valid empty value for every field.
        let mut credential: CREDENTIALW = unsafe { std::mem::zeroed() };
        credential.Type = CRED_TYPE_GENERIC;
        credential.TargetName = name.as_mut_ptr();
        credential.UserName = user.as_mut_ptr();
        credential.CredentialBlobSize = blob.len() as u32;
        credential.CredentialBlob = blob.as_ptr() as *mut u8;
        credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
        // SAFETY: every pointer in `credential` stays alive for the call; Windows copies what it needs.
        if unsafe { CredWriteW(&credential, 0) } == 0 {
            let code = unsafe { GetLastError() };
            return Err(format!(
                "cannot save to the Windows Credential Manager (error {code})"
            ));
        }
        Ok(())
    }

    pub fn delete(target: &str) -> Result<(), String> {
        let name = wide(target);
        // SAFETY: `name` is NUL-terminated.
        if unsafe { CredDeleteW(name.as_ptr(), CRED_TYPE_GENERIC, 0) } == 0 {
            return match unsafe { GetLastError() } {
                ERROR_NOT_FOUND => Ok(()),
                code => Err(format!(
                    "cannot remove from the Windows Credential Manager (error {code})"
                )),
            };
        }
        Ok(())
    }

    /// Fills `out` with random bytes from the system's generator.
    pub fn fill_random(out: &mut [u8]) {
        use windows_sys::Win32::Security::Cryptography::{
            BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        };
        // SAFETY: `out` is valid for its length.
        unsafe {
            BCryptGenRandom(
                std::ptr::null_mut(),
                out.as_mut_ptr(),
                out.len() as u32,
                BCRYPT_USE_SYSTEM_PREFERRED_RNG,
            );
        }
    }
}

#[cfg(not(windows))]
mod credential {
    pub fn read(_: &str) -> Result<Option<String>, String> {
        Err("Reading the saved key needs Windows".into())
    }
    pub fn write(_: &str, _: &str) -> Result<(), String> {
        Err("Saving the key needs Windows".into())
    }
    pub fn delete(_: &str) -> Result<(), String> {
        Err("Removing the saved key needs Windows".into())
    }
    pub fn fill_random(out: &mut [u8]) {
        for (i, b) in out.iter_mut().enumerate() {
            *b = (std::process::id() as usize).wrapping_mul(i + 31) as u8;
        }
    }
}

#[cfg(windows)]
fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Security::Cryptography::CryptProtectData;
    transform(plain, |input, entropy, out| unsafe {
        CryptProtectData(
            input,
            std::ptr::null(),
            entropy,
            std::ptr::null(),
            std::ptr::null(),
            0,
            out,
        )
    })
    .map_err(|_| "Windows could not encrypt the secret".into())
}

#[cfg(windows)]
fn unprotect(sealed: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Security::Cryptography::CryptUnprotectData;
    transform(sealed, |input, entropy, out| unsafe {
        CryptUnprotectData(
            input,
            std::ptr::null_mut(),
            entropy,
            std::ptr::null(),
            std::ptr::null(),
            0,
            out,
        )
    })
    .map_err(|_| "the saved secret cannot be read by this Windows account; enter it again".into())
}

/// Runs one DPAPI call over `data` and copies the result out of the buffer Windows allocated.
#[cfg(windows)]
fn transform(
    data: &[u8],
    call: impl FnOnce(
        *const windows_sys::Win32::Security::Cryptography::CRYPT_INTEGER_BLOB,
        *const windows_sys::Win32::Security::Cryptography::CRYPT_INTEGER_BLOB,
        *mut windows_sys::Win32::Security::Cryptography::CRYPT_INTEGER_BLOB,
    ) -> i32,
) -> Result<Vec<u8>, ()> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::CRYPT_INTEGER_BLOB;
    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let entropy = CRYPT_INTEGER_BLOB {
        cbData: ENTROPY.len() as u32,
        pbData: ENTROPY.as_ptr() as *mut u8,
    };
    let mut out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    if call(&input, &entropy, &mut out) == 0 || out.pbData.is_null() {
        return Err(());
    }
    // SAFETY: Windows allocated `cbData` bytes at `pbData`; they are copied and then released with LocalFree.
    let copy = unsafe { std::slice::from_raw_parts(out.pbData, out.cbData as usize) }.to_vec();
    unsafe { LocalFree(out.pbData as _) };
    Ok(copy)
}

#[cfg(not(windows))]
fn protect(_: &[u8]) -> Result<Vec<u8>, String> {
    Err("Saving a secret needs Windows".into())
}

#[cfg(not(windows))]
fn unprotect(_: &[u8]) -> Result<Vec<u8>, String> {
    Err("Reading a saved secret needs Windows".into())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// The Credential Manager is one store for the whole user, and a save followed by a read of it came back empty when
    /// several tests used it at once (about one full run in five, 2026-10-29): the tests that use it take turns.
    fn serial() -> std::sync::MutexGuard<'static, ()> {
        static TURN: std::sync::Mutex<()> = std::sync::Mutex::new(());
        TURN.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Removes what a test saved, so the Credential Manager of the machine running the tests stays clean.
    struct Cleanup<'a>(&'a Path);
    impl Drop for Cleanup<'_> {
        fn drop(&mut self) {
            for which in [Secret::Civitai, Secret::HuggingFace] {
                let _ = save_secret(self.0, which, None);
            }
        }
    }

    fn entry(dir: &Path, name: &str) -> Option<String> {
        credential::read(&existing_target(dir, name)?).unwrap()
    }

    #[test]
    fn key_round_trips_through_the_credential_manager_and_leaves_no_file() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        let _clean = Cleanup(dir.path());
        assert_eq!(load_civitai_key(dir.path()).unwrap(), None);
        save_civitai_key(dir.path(), Some("  abc123SECRET ")).unwrap();
        assert!(!secret_path(dir.path(), Secret::Civitai).exists());
        assert_eq!(
            entry(dir.path(), "civitai").as_deref(),
            Some("abc123SECRET")
        );
        assert_eq!(
            load_civitai_key(dir.path()).unwrap().as_deref(),
            Some("abc123SECRET")
        );
    }

    #[test]
    fn each_secret_has_its_own_entry_or_file() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        let _clean = Cleanup(dir.path());
        save_secret(dir.path(), Secret::Civitai, Some("a")).unwrap();
        save_secret(dir.path(), Secret::HuggingFace, Some("b")).unwrap();
        save_secret(dir.path(), Secret::LanCa, Some("c")).unwrap();
        assert_eq!(
            load_secret(dir.path(), Secret::LanCa).unwrap().as_deref(),
            Some("c")
        );
        assert_eq!(
            load_secret(dir.path(), Secret::Civitai).unwrap().as_deref(),
            Some("a")
        );
        assert_eq!(
            load_secret(dir.path(), Secret::HuggingFace)
                .unwrap()
                .as_deref(),
            Some("b")
        );
        save_secret(dir.path(), Secret::Civitai, None).unwrap();
        assert_eq!(load_secret(dir.path(), Secret::Civitai).unwrap(), None);
        assert_eq!(
            load_secret(dir.path(), Secret::HuggingFace)
                .unwrap()
                .as_deref(),
            Some("b")
        );
    }

    #[test]
    fn blank_key_removes_the_entry() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        let _clean = Cleanup(dir.path());
        save_civitai_key(dir.path(), Some("k")).unwrap();
        save_civitai_key(dir.path(), Some("  ")).unwrap();
        assert_eq!(load_civitai_key(dir.path()).unwrap(), None);
        assert_eq!(entry(dir.path(), "civitai"), None);
        save_civitai_key(dir.path(), None).unwrap();
    }

    #[test]
    fn two_data_folders_do_not_share_keys() {
        let _serial = serial();
        let (a, b) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        let (_ca, _cb) = (Cleanup(a.path()), Cleanup(b.path()));
        save_civitai_key(a.path(), Some("of-a")).unwrap();
        assert_eq!(load_civitai_key(b.path()).unwrap(), None);
        save_civitai_key(b.path(), None).unwrap();
        assert_eq!(load_civitai_key(a.path()).unwrap().as_deref(), Some("of-a"));
    }

    #[test]
    fn a_key_in_a_moved_data_folder_is_still_found() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        let _clean = Cleanup(dir.path());
        save_civitai_key(dir.path(), Some("kept")).unwrap();
        let moved = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(moved.path().join(SECRETS_DIR)).unwrap();
        std::fs::copy(
            dir.path().join(SECRETS_DIR).join(STORE_ID_FILE),
            moved.path().join(SECRETS_DIR).join(STORE_ID_FILE),
        )
        .unwrap();
        assert_eq!(
            load_civitai_key(moved.path()).unwrap().as_deref(),
            Some("kept")
        );
    }

    #[test]
    fn a_long_unicode_key_reads_back_and_one_over_the_limit_is_refused() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        let _clean = Cleanup(dir.path());
        let long = "鍵".repeat(1280);
        save_civitai_key(dir.path(), Some(&long)).unwrap();
        assert_eq!(
            load_civitai_key(dir.path()).unwrap().as_deref(),
            Some(long.as_str())
        );
        let err = save_civitai_key(dir.path(), Some(&"x".repeat(1281))).unwrap_err();
        assert!(err.contains("too long"), "{err}");
        assert_eq!(
            load_civitai_key(dir.path()).unwrap().as_deref(),
            Some(long.as_str()),
            "a refused key leaves the saved one"
        );
    }

    #[test]
    fn a_key_saved_as_a_file_by_an_earlier_version_moves_into_the_credential_manager() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        let _clean = Cleanup(dir.path());
        let sealed = protect(b"old-key").unwrap();
        std::fs::create_dir_all(dir.path().join(SECRETS_DIR)).unwrap();
        std::fs::write(secret_path(dir.path(), Secret::Civitai), sealed).unwrap();
        assert_eq!(
            load_civitai_key(dir.path()).unwrap().as_deref(),
            Some("old-key")
        );
        assert!(!secret_path(dir.path(), Secret::Civitai).exists());
        assert_eq!(entry(dir.path(), "civitai").as_deref(), Some("old-key"));
        assert_eq!(
            load_civitai_key(dir.path()).unwrap().as_deref(),
            Some("old-key")
        );
    }

    #[test]
    fn tampered_old_file_is_an_error_not_a_key() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        let _clean = Cleanup(dir.path());
        std::fs::create_dir_all(dir.path().join(SECRETS_DIR)).unwrap();
        std::fs::write(secret_path(dir.path(), Secret::Civitai), b"garbage").unwrap();
        assert!(load_civitai_key(dir.path()).is_err());
    }

    #[test]
    fn other_secrets_stay_encrypted_files() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        save_secret(dir.path(), Secret::AssistantEndpoint, Some("abc123SECRET")).unwrap();
        let raw = std::fs::read(secret_path(dir.path(), Secret::AssistantEndpoint)).unwrap();
        assert!(!String::from_utf8_lossy(&raw).contains("abc123SECRET"));
        assert!(!dir.path().join(SECRETS_DIR).join(STORE_ID_FILE).exists());
    }

    #[test]
    fn the_credential_manager_reports_what_it_refuses_and_reads_an_empty_value() {
        let _serial = serial();
        // An empty target name is refused by every call.
        assert!(credential::read("").unwrap_err().contains("cannot read"));
        assert!(credential::write("", "x")
            .unwrap_err()
            .contains("cannot save"));
        assert!(credential::delete("")
            .unwrap_err()
            .contains("cannot remove"));
        // An entry with no value at all reads back as an empty string.
        let target = format!("novira/test-{}/empty", new_store_id());
        credential::write(&target, "").unwrap();
        assert_eq!(credential::read(&target).unwrap().as_deref(), Some(""));
        credential::delete(&target).unwrap();
        assert_eq!(credential::read(&target).unwrap(), None);
    }

    #[test]
    fn an_unreadable_or_damaged_file_names_the_secret_it_belongs_to() {
        let _serial = serial();
        let dir = tempfile::tempdir().unwrap();
        // A folder where the file should be cannot be read.
        std::fs::create_dir_all(secret_path(dir.path(), Secret::C2paSigning)).unwrap();
        let err = load_secret(dir.path(), Secret::C2paSigning).unwrap_err();
        assert!(err.contains("saved signing key"), "{err}");
        // A file that decrypts to bytes that are not text is damaged.
        std::fs::write(
            secret_path(dir.path(), Secret::LanCa),
            protect(&[0xff, 0xfe, 0xfd]).unwrap(),
        )
        .unwrap();
        let err = load_secret(dir.path(), Secret::LanCa).unwrap_err();
        assert!(
            err.contains("home-network certificate key is damaged"),
            "{err}"
        );
    }
}
