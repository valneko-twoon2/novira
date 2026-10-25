//! Downloads ComfyUI into novira's own folder: the official Windows portable package (ComfyUI, its embedded
//! Python and the Python libraries including PyTorch), unpacked with the 7-Zip console tool that is fetched the
//! same way. Nothing from a global Python or ComfyUI is used. A half-finished install is never mistaken for a
//! complete one: files are unpacked in a temporary folder and moved into place last.
use super::node_packs::valid_tag;
use crate::engine::{EngineError, EngineStatus};
use crate::models::install::{download, InstallError};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

const RELEASES_PATH: &str = "/comfyanonymous/ComfyUI/releases/latest/download";
const RELEASES_BY_TAG: &str = "/comfyanonymous/ComfyUI/releases/download";
pub const SEVENZIP_URL: &str = "https://www.7-zip.org/a/7zr.exe";

/// Where `7zr.exe` is fetched from: `SEVENZIP_URL`, or a loopback server in a debug build when overridden (`endpoints`).
pub fn sevenzip_url() -> String {
    crate::endpoints::url(crate::endpoints::Service::SevenZip, "/a/7zr.exe")
}
/// Folder under the install root that holds the unpacked package (`ComfyUI/`, `python_embeded/`, ...).
pub const PORTABLE_DIR: &str = "portable";

/// The release package of `package` at the release `tag` (checked with `valid_tag`), or the latest release.
pub fn package_url_for(package: &str, tag: Option<&str>) -> Result<String, String> {
    let file = match package {
        "nvidia" => "ComfyUI_windows_portable_nvidia.7z",
        "amd" => "ComfyUI_windows_portable_amd.7z",
        other => {
            return Err(format!(
                "Unknown comfyuiPackage '{other}' (use \"nvidia\" or \"amd\")"
            ))
        }
    };
    let path = match tag {
        Some(t) if valid_tag(t) => format!("{RELEASES_BY_TAG}/{t}/{file}"),
        Some(t) => return Err(format!("Not a ComfyUI version: {t}")),
        None => format!("{RELEASES_PATH}/{file}"),
    };
    Ok(crate::endpoints::url(
        crate::endpoints::Service::GitHub,
        &path,
    ))
}

pub fn package_url(package: &str) -> Result<String, String> {
    package_url_for(package, None)
}

/// The release tags in a GitHub `releases` answer (newest first, as given): drafts, pre-releases and names that are not
/// plain tags are left out.
pub fn parse_release_tags(body: &[u8]) -> Vec<String> {
    serde_json::from_slice::<Vec<serde_json::Value>>(body)
        .unwrap_or_default()
        .iter()
        .filter(|r| {
            !r["draft"].as_bool().unwrap_or(false) && !r["prerelease"].as_bool().unwrap_or(false)
        })
        .filter_map(|r| r["tag_name"].as_str())
        .filter(|n| valid_tag(n))
        .map(str::to_string)
        .collect()
}

/// The latest 50 ComfyUI releases, newest first (GitHub's answer is capped at 1 MB here).
pub async fn release_tags(http: &reqwest::Client) -> Result<Vec<String>, String> {
    let url = crate::endpoints::url(
        crate::endpoints::Service::GitHubApi,
        "/repos/comfyanonymous/ComfyUI/releases?per_page=50",
    );
    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Cannot reach GitHub: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "GitHub did not list the ComfyUI versions (HTTP {})",
            resp.status().as_u16()
        ));
    }
    let body = resp.bytes().await.map_err(|e| e.to_string())?;
    if body.len() > 1_000_000 {
        return Err("GitHub's list of ComfyUI versions is unexpectedly large".into());
    }
    Ok(parse_release_tags(&body))
}

/// The ComfyUI folder (holding `main.py`) of an install under `root`.
pub fn comfyui_dir(root: &Path) -> PathBuf {
    root.join(PORTABLE_DIR).join("ComfyUI")
}

pub fn is_installed(root: &Path) -> bool {
    comfyui_dir(root).join("main.py").is_file()
}

/// The file in `portable/` that names the package an install was made from (`nvidia` or `amd`). It sits beside the
/// package, so a package kept for a version switch carries its own record back when it is restored.
const PACKAGE_RECORD: &str = "novira-package.txt";

/// The package the ComfyUI in `root` was installed from, or `None` when there is no record (an install made before
/// the record was written).
pub fn installed_package(root: &Path) -> Option<String> {
    let text = std::fs::read_to_string(root.join(PORTABLE_DIR).join(PACKAGE_RECORD)).ok()?;
    Some(text.trim().to_string())
}

/// Writes the record of the package in `root`.
fn record_package(root: &Path, package: &str) -> std::io::Result<()> {
    std::fs::write(root.join(PORTABLE_DIR).join(PACKAGE_RECORD), package)
}

/// Writes the record of an install that has none, as `package`: the package the settings name at that moment is the
/// best guess of where it came from. Nothing is written when there is no install.
pub fn adopt_package(root: &Path, package: &str) -> std::io::Result<()> {
    if is_installed(root) && installed_package(root).is_none() {
        record_package(root, package)?;
    }
    Ok(())
}

/// Whether the install in `root` was made from another package than `package`. An install without a record is adopted
/// as `package` first, so it is not reinstalled by mistake.
pub fn package_changed(root: &Path, package: &str) -> std::io::Result<bool> {
    adopt_package(root, package)?;
    Ok(installed_package(root).is_some_and(|installed| installed != package))
}

/// The ComfyUI version of the install in `root` as a release tag (`v0.38.0`), read from its `comfyui_version.py`.
pub fn installed_version_tag(root: &Path) -> Option<String> {
    let text = std::fs::read_to_string(comfyui_dir(root).join("comfyui_version.py")).ok()?;
    let version = text
        .lines()
        .find_map(|line| line.trim().strip_prefix("__version__"))?
        .split('"')
        .nth(1)?;
    let tag = format!("v{version}");
    valid_tag(&tag).then_some(tag)
}

/// The folder in an unpacked archive that holds `ComfyUI/main.py` (the archive has one top-level folder).
pub fn find_package_root(unpacked: &Path) -> Option<PathBuf> {
    if unpacked.join("ComfyUI").join("main.py").is_file() {
        return Some(unpacked.to_path_buf());
    }
    std::fs::read_dir(unpacked)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .find(|p| p.join("ComfyUI").join("main.py").is_file())
}

fn fail(e: impl std::fmt::Display) -> EngineError {
    EngineError::Failed(e.to_string())
}

/// Renames, retrying while Windows refuses access. Antivirus scanners lock freshly written files (a 2 GB archive, or a
/// package of tens of thousands of unpacked files) for a while, and a rename in that window fails with "access denied".
async fn rename_when_free(from: &Path, to: &Path) -> Result<(), EngineError> {
    const ATTEMPTS: u32 = 60;
    for attempt in 1..=ATTEMPTS {
        match std::fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied && attempt < ATTEMPTS => {
                tokio::time::sleep(crate::test_timing::retry_pause(Duration::from_secs(1))).await;
            }
            Err(e) => {
                return Err(fail(format!(
                    "Cannot move {} to {}: {e}",
                    from.display(),
                    to.display()
                )))
            }
        }
    }
    unreachable!("the last attempt returns")
}

fn map_download(e: InstallError) -> EngineError {
    match e {
        InstallError::Cancelled => EngineError::Cancelled,
        InstallError::Failed(m) => EngineError::Failed(m),
    }
}

/// Where the package that was in use is kept while another version replaces it.
pub fn previous_dir(root: &Path) -> PathBuf {
    root.join(".previous")
}

/// Moves the pack folders of `from` (a ComfyUI folder) into `to`'s `custom_nodes`, leaving what `to` already has. The
/// folders are renamed, not copied, so this is quick and nothing is duplicated.
pub fn carry_over_custom_nodes(from: &Path, to: &Path) -> std::io::Result<()> {
    let source = from.join("custom_nodes");
    let target = to.join("custom_nodes");
    std::fs::create_dir_all(&target)?;
    for entry in std::fs::read_dir(&source)?.flatten() {
        let name = entry.file_name();
        let dest = target.join(&name);
        if dest.exists() || name.to_string_lossy() == "__pycache__" {
            continue;
        }
        std::fs::rename(entry.path(), dest)?;
    }
    Ok(())
}

/// Puts the kept package back in place of the one that replaced it (after a failed switch). Nothing happens when no
/// package is kept.
pub fn restore_previous(root: &Path) -> std::io::Result<()> {
    let previous = previous_dir(root);
    if !previous.is_dir() {
        return Ok(());
    }
    let target = root.join(PORTABLE_DIR);
    let _ = std::fs::remove_dir_all(&target);
    std::fs::rename(previous, target)
}

/// Deletes the kept package once the new one works.
pub fn discard_previous(root: &Path) {
    let _ = std::fs::remove_dir_all(previous_dir(root));
}

/// Downloads and unpacks the package into `root`. `status` is called as the work moves along.
pub async fn install(
    http: &reqwest::Client,
    root: &Path,
    package: &str,
    cancel: &CancellationToken,
    status: &(dyn Fn(EngineStatus) + Send + Sync),
) -> Result<(), EngineError> {
    install_version(http, root, package, None, false, cancel, status).await
}

/// `install` at a release (`tag`, or the latest when none). With `keep_previous` the package in place is kept in
/// `.previous` (see `restore_previous`) and its pack folders move into the new one, instead of being deleted.
pub async fn install_version(
    http: &reqwest::Client,
    root: &Path,
    package: &str,
    tag: Option<&str>,
    keep_previous: bool,
    cancel: &CancellationToken,
    status: &(dyn Fn(EngineStatus) + Send + Sync),
) -> Result<(), EngineError> {
    if !cfg!(windows) {
        return Err(EngineError::Failed(
            "Automatic ComfyUI install is only available on Windows; set comfyuiDir to an existing install"
                .into(),
        ));
    }
    let url = package_url_for(package, tag).map_err(EngineError::Failed)?;
    let downloads = root.join(".downloads");
    let tool = root.join(".tools").join("7zr.exe");
    let archive = downloads.join(match tag {
        Some(t) => format!("comfyui-{t}.7z"),
        None => "comfyui.7z".to_string(),
    });
    let unpacking = root.join(".unpacking");
    std::fs::create_dir_all(&downloads).map_err(fail)?;
    std::fs::create_dir_all(root.join(".tools")).map_err(fail)?;
    let _ = std::fs::remove_dir_all(&unpacking);

    if !tool.is_file() {
        status(EngineStatus::Downloading {
            bytes: 0,
            total_bytes: 0,
        });
        let part = tool.with_extension("part");
        download(http, &sevenzip_url(), None, &part, cancel, |_, _| {})
            .await
            .map_err(map_download)?;
        rename_when_free(&part, &tool).await?;
    }

    // The archive only gets its final name once it is complete, so one that exists is reused after a failed unpack.
    if !archive.is_file() {
        let part = archive.with_extension("part");
        let mut last = Instant::now() - Duration::from_secs(1);
        download(http, &url, None, &part, cancel, |bytes, total| {
            if last.elapsed() >= Duration::from_millis(500) {
                last = Instant::now();
                status(EngineStatus::Downloading {
                    bytes,
                    total_bytes: total,
                });
            }
        })
        .await
        .map_err(map_download)?;
        rename_when_free(&part, &archive).await?;
    }

    status(EngineStatus::Extracting);
    let mut cmd = tokio::process::Command::new(&tool);
    cmd.arg("x")
        .arg("-y")
        .arg("-bso0")
        .arg("-bsp0")
        .arg(format!("-o{}", unpacking.display()))
        .arg(&archive);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    let child = cmd
        .spawn()
        .map_err(|e| fail(format!("Cannot run 7zr.exe: {e}")))?;
    let output = tokio::select! {
        _ = cancel.cancelled() => {
            let _ = std::fs::remove_dir_all(&unpacking);
            return Err(EngineError::Cancelled);
        }
        o = child.wait_with_output() => o.map_err(fail)?,
    };
    if !output.status.success() {
        let _ = std::fs::remove_dir_all(&unpacking);
        let msg = String::from_utf8_lossy(&output.stderr);
        // A damaged archive would fail the same way every time, so it is fetched again next time. Any other failure (no
        // room on the disk, a file in use) keeps the archive: the next attempt unpacks it again without a new download.
        if archive_is_damaged(&msg) {
            let _ = std::fs::remove_file(&archive);
        }
        return Err(fail(format!("Unpacking ComfyUI failed: {}", msg.trim())));
    }
    let package_root = find_package_root(&unpacking)
        .ok_or_else(|| fail("The ComfyUI package has an unexpected layout"))?;
    let target = root.join(PORTABLE_DIR);
    if keep_previous && target.is_dir() {
        let previous = previous_dir(root);
        let _ = std::fs::remove_dir_all(&previous);
        rename_when_free(&target, &previous).await?;
        if let Err(e) = rename_when_free(&package_root, &target).await {
            let _ = restore_previous(root);
            return Err(e);
        }
        let carried = carry_over_custom_nodes(&previous.join("ComfyUI"), &comfyui_dir(root));
        if let Err(e) = carried {
            let _ = restore_previous(root);
            return Err(fail(format!(
                "Cannot move the extensions to the new ComfyUI: {e}"
            )));
        }
    } else {
        let _ = std::fs::remove_dir_all(&target);
        rename_when_free(&package_root, &target).await?;
    }
    record_package(root, package).map_err(fail)?;
    let _ = std::fs::remove_dir_all(&unpacking);
    let _ = std::fs::remove_file(&archive);
    Ok(())
}

/// Whether 7-Zip's message says the archive itself is bad (its data, its checksums or its headers), rather than the disk
/// or the folder it unpacks into.
fn archive_is_damaged(message: &str) -> bool {
    const DAMAGE: &[&str] = &[
        "Data Error",
        "CRC Failed",
        "Unexpected end of archive",
        "Headers Error",
        "Can not open the file as archive",
    ];
    DAMAGE.iter().any(|m| message.contains(m))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A ComfyUI folder that counts as installed (its `main.py` is there), with its `portable/` folder.
    fn fake_install(root: &Path) {
        std::fs::create_dir_all(comfyui_dir(root)).unwrap();
        std::fs::write(comfyui_dir(root).join("main.py"), "").unwrap();
    }

    #[test]
    fn an_install_without_a_record_is_adopted_and_a_different_package_is_a_change() {
        let dir = tempfile::tempdir().unwrap();
        fake_install(dir.path());
        assert_eq!(installed_package(dir.path()), None);
        assert!(
            !package_changed(dir.path(), "amd").unwrap(),
            "adopted, not changed"
        );
        assert_eq!(installed_package(dir.path()).as_deref(), Some("amd"));
        assert!(package_changed(dir.path(), "nvidia").unwrap());
        assert!(!package_changed(dir.path(), "amd").unwrap());
    }

    #[test]
    fn nothing_is_adopted_without_an_install() {
        let dir = tempfile::tempdir().unwrap();
        adopt_package(dir.path(), "amd").unwrap();
        assert_eq!(installed_package(dir.path()), None);
    }

    #[test]
    fn the_version_tag_comes_from_the_installed_comfyui() {
        let dir = tempfile::tempdir().unwrap();
        fake_install(dir.path());
        std::fs::write(
            comfyui_dir(dir.path()).join("comfyui_version.py"),
            "# generated\n__version__ = \"0.38.0\"\n",
        )
        .unwrap();
        assert_eq!(
            installed_version_tag(dir.path()).as_deref(),
            Some("v0.38.0")
        );
        std::fs::write(
            comfyui_dir(dir.path()).join("comfyui_version.py"),
            "__version__ = \"0.38.0/../x\"\n",
        )
        .unwrap();
        assert_eq!(installed_version_tag(dir.path()), None);
    }

    #[test]
    fn only_a_message_about_the_archive_itself_marks_it_damaged() {
        assert!(archive_is_damaged("ERROR: Data Error : comfyui.7z"));
        assert!(archive_is_damaged("CRC Failed in ComfyUI/main.py"));
        assert!(archive_is_damaged("Unexpected end of archive"));
        assert!(archive_is_damaged("Can not open the file as archive"));
        // The disk or the folder: the archive is fine and is kept.
        assert!(!archive_is_damaged("ERROR: Can not write output file"));
        assert!(!archive_is_damaged("There is not enough space on the disk"));
        assert!(!archive_is_damaged(""));
    }

    #[test]
    fn a_release_package_is_addressed_by_its_tag_and_a_tag_that_is_not_plain_is_refused() {
        assert!(package_url_for("nvidia", Some("v0.3.50"))
            .unwrap()
            .ends_with("/releases/download/v0.3.50/ComfyUI_windows_portable_nvidia.7z"));
        assert!(package_url_for("nvidia", None)
            .unwrap()
            .contains("/releases/latest/download/"));
        for bad in ["../x", "a/b", "v1 2", "", "-v"] {
            assert!(package_url_for("nvidia", Some(bad)).is_err(), "{bad}");
        }
        assert!(package_url_for("cuda", Some("v1")).is_err());
    }

    #[test]
    fn release_tags_skip_drafts_prereleases_and_names_that_are_not_plain() {
        let body = br#"[
            {"tag_name":"v0.3.60"},
            {"tag_name":"v0.3.59","prerelease":true},
            {"tag_name":"v0.3.58","draft":true},
            {"tag_name":"../evil"},
            {"tag_name":"v0.3.50"}
        ]"#;
        assert_eq!(parse_release_tags(body), vec!["v0.3.60", "v0.3.50"]);
        assert!(parse_release_tags(b"nope").is_empty());
    }

    #[test]
    fn pack_folders_move_into_the_new_package_without_replacing_its_own() {
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old");
        let new = dir.path().join("new");
        for (root, packs) in [
            (&old, ["mine", "shared", "__pycache__"].as_slice()),
            (&new, ["shared"].as_slice()),
        ] {
            for p in packs {
                std::fs::create_dir_all(root.join("custom_nodes").join(p)).unwrap();
                std::fs::write(
                    root.join("custom_nodes").join(p).join("who.txt"),
                    root.to_string_lossy().as_bytes(),
                )
                .unwrap();
            }
        }
        carry_over_custom_nodes(&old, &new).unwrap();
        assert!(new.join("custom_nodes/mine/who.txt").is_file());
        // The new package keeps its own copy of a folder both have, and a cache folder is not carried.
        let shared = std::fs::read_to_string(new.join("custom_nodes/shared/who.txt")).unwrap();
        assert!(shared.contains("new"));
        assert!(!new.join("custom_nodes/__pycache__").exists());
    }

    #[test]
    fn a_kept_package_is_put_back_or_dropped() {
        let root = tempfile::tempdir().unwrap();
        // Nothing kept: nothing happens.
        restore_previous(root.path()).unwrap();
        std::fs::create_dir_all(root.path().join(PORTABLE_DIR)).unwrap();
        std::fs::write(root.path().join(PORTABLE_DIR).join("new.txt"), "n").unwrap();
        std::fs::create_dir_all(previous_dir(root.path())).unwrap();
        std::fs::write(previous_dir(root.path()).join("old.txt"), "o").unwrap();
        restore_previous(root.path()).unwrap();
        assert!(root.path().join(PORTABLE_DIR).join("old.txt").is_file());
        assert!(!root.path().join(PORTABLE_DIR).join("new.txt").exists());
        assert!(!previous_dir(root.path()).exists());
        std::fs::create_dir_all(previous_dir(root.path())).unwrap();
        discard_previous(root.path());
        assert!(!previous_dir(root.path()).exists());
    }

    #[test]
    fn packages_resolve_and_unknown_ones_are_refused() {
        assert!(package_url("nvidia")
            .unwrap()
            .ends_with("ComfyUI_windows_portable_nvidia.7z"));
        assert!(package_url("amd").unwrap().ends_with("_amd.7z"));
        assert!(package_url("cuda").is_err());
    }

    #[test]
    fn package_root_is_found_with_or_without_the_top_folder() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(find_package_root(dir.path()), None);
        let nested = dir.path().join("ComfyUI_windows_portable");
        std::fs::create_dir_all(nested.join("ComfyUI")).unwrap();
        std::fs::write(nested.join("ComfyUI").join("main.py"), "").unwrap();
        assert_eq!(find_package_root(dir.path()), Some(nested.clone()));
        assert_eq!(find_package_root(&nested), Some(nested));
    }

    #[test]
    fn installed_means_main_py_in_the_portable_folder() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_installed(dir.path()));
        std::fs::create_dir_all(comfyui_dir(dir.path())).unwrap();
        assert!(!is_installed(dir.path()));
        std::fs::write(comfyui_dir(dir.path()).join("main.py"), "").unwrap();
        assert!(is_installed(dir.path()));
    }
}
