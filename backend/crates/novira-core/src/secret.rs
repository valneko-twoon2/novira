//! Secrets (the Civitai API key, the Hugging Face token, the key that signs content credentials, the assistant server's API key,
//! the key of the browser server's home-network CA) are stored encrypted with the Windows user's own key (DPAPI), so the file is
//! useless on another account or machine. They never travel to the frontend; it only learns whether one is set.
use std::path::{Path, PathBuf};

const SECRETS_DIR: &str = "secrets";
const ENTROPY: &[u8] = b"novira/civitai-key/v1";

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

/// Saves the secret encrypted; `None` or a blank value removes it.
pub fn save_secret(data_dir: &Path, which: Secret, value: Option<&str>) -> Result<(), String> {
    let path = secret_path(data_dir, which);
    match value.map(str::trim).filter(|k| !k.is_empty()) {
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

pub fn load_civitai_key(data_dir: &Path) -> Result<Option<String>, String> {
    load_secret(data_dir, Secret::Civitai)
}

pub fn save_civitai_key(data_dir: &Path, key: Option<&str>) -> Result<(), String> {
    save_secret(data_dir, Secret::Civitai, key)
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
    .map_err(|_| "Windows could not encrypt the Civitai key".into())
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
    .map_err(|_| {
        "the saved Civitai key cannot be read by this Windows account; enter it again".into()
    })
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
    Err("Saving the Civitai key needs Windows".into())
}

#[cfg(not(windows))]
fn unprotect(_: &[u8]) -> Result<Vec<u8>, String> {
    Err("Reading the saved Civitai key needs Windows".into())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn key_round_trips_and_is_not_stored_in_clear() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load_civitai_key(dir.path()).unwrap(), None);
        save_civitai_key(dir.path(), Some("  abc123SECRET ")).unwrap();
        let raw = std::fs::read(secret_path(dir.path(), Secret::Civitai)).unwrap();
        assert!(!String::from_utf8_lossy(&raw).contains("abc123SECRET"));
        assert_eq!(
            load_civitai_key(dir.path()).unwrap().as_deref(),
            Some("abc123SECRET")
        );
    }

    #[test]
    fn each_secret_has_its_own_file() {
        let dir = tempfile::tempdir().unwrap();
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
        assert_eq!(
            load_secret(dir.path(), Secret::HuggingFace)
                .unwrap()
                .as_deref(),
            Some("b")
        );
    }

    #[test]
    fn blank_key_removes_the_file() {
        let dir = tempfile::tempdir().unwrap();
        save_civitai_key(dir.path(), Some("k")).unwrap();
        save_civitai_key(dir.path(), Some("  ")).unwrap();
        assert_eq!(load_civitai_key(dir.path()).unwrap(), None);
        save_civitai_key(dir.path(), None).unwrap();
    }

    #[test]
    fn tampered_file_is_an_error_not_a_key() {
        let dir = tempfile::tempdir().unwrap();
        save_civitai_key(dir.path(), Some("k")).unwrap();
        std::fs::write(secret_path(dir.path(), Secret::Civitai), b"garbage").unwrap();
        assert!(load_civitai_key(dir.path()).is_err());
    }
}
