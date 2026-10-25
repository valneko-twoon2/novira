//! What the machine can run: the graphics card and its memory, read on request so the screens that offer models can
//! say which ones fit. Nothing here is required to work; an unknown card is reported as such.
//!
//! - NVIDIA: `nvidia-smi` (it ships with the driver) gives the name and the memory in MiB.
//! - Any other card on Windows (AMD, Intel): the display adapter's `HardwareInformation.qwMemorySize` in the registry
//!   (read with `reg query`), which holds the real size as a 64-bit number (WMI's `AdapterRAM` stops at 4 GB).
//! - Otherwise the memory is unknown.
use serde::Serialize;
use std::process::Command;

/// The graphics card the models would run on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareInfo {
    /// The card's name, or empty when none was found.
    pub gpu_name: String,
    /// Its memory in bytes; `None` when it could not be read.
    pub vram_bytes: Option<u64>,
}

impl HardwareInfo {
    pub fn unknown() -> Self {
        Self {
            gpu_name: String::new(),
            vram_bytes: None,
        }
    }
}

/// The card with the most memory in `nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits` output
/// (one `name, MiB` line per card).
pub fn parse_nvidia_smi(out: &str) -> Option<HardwareInfo> {
    out.lines()
        .filter_map(|line| {
            let (name, mib) = line.rsplit_once(',')?;
            let mib: u64 = mib.trim().parse().ok()?;
            Some(HardwareInfo {
                gpu_name: name.trim().to_string(),
                vram_bytes: Some(mib.saturating_mul(1024 * 1024)),
            })
        })
        .max_by_key(|h| h.vram_bytes)
}

/// The value lines of `reg query <key> /s /v <name>` output, as (the adapter's key, the type, the data).
fn reg_values(out: &str) -> Vec<(String, String, String)> {
    let mut key = String::new();
    let mut values = Vec::new();
    for line in out.lines() {
        if line.starts_with("HKEY") {
            key = line.trim().to_string();
        } else if line.starts_with(' ') {
            // "<name>    <type>    <data>", the columns separated by runs of spaces.
            let rest = line
                .trim()
                .split_once(char::is_whitespace)
                .map(|(_, r)| r.trim_start());
            if let Some(rest) = rest {
                let (kind, data) = rest.split_once(char::is_whitespace).unwrap_or((rest, ""));
                values.push((key.clone(), kind.to_string(), data.trim().to_string()));
            }
        }
    }
    values
}

/// The memory size a driver stored: a `REG_QWORD` (`0x2ffa00000`) or eight little-endian bytes as `REG_BINARY`.
fn reg_size(kind: &str, data: &str) -> Option<u64> {
    match kind {
        "REG_QWORD" => u64::from_str_radix(data.trim_start_matches("0x"), 16).ok(),
        "REG_BINARY" if data.len() == 16 => {
            let mut bytes = [0u8; 8];
            for (i, b) in bytes.iter_mut().enumerate() {
                *b = u8::from_str_radix(data.get(i * 2..i * 2 + 2)?, 16).ok()?;
            }
            Some(u64::from_le_bytes(bytes))
        }
        _ => None,
    }
}

/// The adapter with the most memory from the output of the two registry queries (`HardwareInformation.qwMemorySize`
/// and `DriverDesc` under the display adapter class key); adapters without a size are skipped.
pub fn parse_adapters(sizes: &str, names: &str) -> Option<HardwareInfo> {
    let names = reg_values(names);
    reg_values(sizes)
        .into_iter()
        .filter_map(|(key, kind, data)| {
            let bytes = reg_size(&kind, &data).filter(|b| *b > 0)?;
            let name = names
                .iter()
                .find(|(k, ..)| *k == key)
                .map(|(.., n)| n.clone())
                .unwrap_or_default();
            Some(HardwareInfo {
                gpu_name: name,
                vram_bytes: Some(bytes),
            })
        })
        .max_by_key(|h| h.vram_bytes)
}

#[cfg(windows)]
fn run(program: &str, args: &[&str]) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new(program);
    cmd.args(args).creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    let out = cmd.output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg(not(windows))]
fn run(program: &str, args: &[&str]) -> Option<String> {
    let out = Command::new(program).args(args).output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// The display adapter class key; one subkey per adapter.
const ADAPTER_CLASS: &str =
    r"HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";

/// Reads the card; blocking (it starts a short program), so call it from a blocking task.
pub fn detect() -> HardwareInfo {
    if let Some(h) = run(
        "nvidia-smi",
        &[
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ],
    )
    .and_then(|o| parse_nvidia_smi(&o))
    {
        return h;
    }
    if cfg!(windows) {
        let query = |value: &str| run("reg", &["query", ADAPTER_CLASS, "/s", "/v", value]);
        if let Some(h) = query("HardwareInformation.qwMemorySize")
            .and_then(|sizes| parse_adapters(&sizes, &query("DriverDesc").unwrap_or_default()))
        {
            return h;
        }
    }
    HardwareInfo::unknown()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nvidia_smi_gives_the_card_with_the_most_memory() {
        let out = "NVIDIA GeForce RTX 3060, 12288\nNVIDIA GeForce GT 1030, 2048\n";
        let h = parse_nvidia_smi(out).unwrap();
        assert_eq!(h.gpu_name, "NVIDIA GeForce RTX 3060");
        assert_eq!(h.vram_bytes, Some(12288 * 1024 * 1024));
    }

    #[test]
    fn garbage_from_nvidia_smi_is_unknown() {
        assert_eq!(parse_nvidia_smi(""), None);
        assert_eq!(parse_nvidia_smi("No devices were found"), None);
    }

    #[test]
    fn the_adapter_with_the_most_memory_is_found_in_the_registry_output() {
        let key = |n: &str| format!(r"HKEY_LOCAL_MACHINE\SYSTEM\X\{n}");
        let sizes = format!(
            "{}
    HardwareInformation.qwMemorySize    REG_QWORD    0x2ffa00000

{}
    HardwareInformation.qwMemorySize    REG_BINARY    0000008000000000
",
            key("0000"),
            key("0001")
        );
        let names = format!(
            "{}
    DriverDesc    REG_SZ    AMD Radeon RX 7800 XT

{}
    DriverDesc    REG_SZ    Intel(R) UHD Graphics
",
            key("0000"),
            key("0001")
        );
        let h = parse_adapters(&sizes, &names).unwrap();
        assert_eq!(h.gpu_name, "AMD Radeon RX 7800 XT");
        assert_eq!(h.vram_bytes, Some(0x2_ffa0_0000));
    }

    #[test]
    fn a_size_stored_as_bytes_is_read_little_endian() {
        assert_eq!(
            reg_size("REG_BINARY", "0000008000000000"),
            Some(0x8000_0000)
        );
        assert_eq!(reg_size("REG_BINARY", "00"), None);
        assert_eq!(reg_size("REG_SZ", "0x10"), None);
    }

    #[test]
    fn no_adapter_with_a_size_is_unknown() {
        assert_eq!(parse_adapters("", ""), None);
        assert_eq!(
            parse_adapters("End of search: 0 match(es) found.", ""),
            None
        );
    }
}
