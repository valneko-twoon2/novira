//! Property tests for the names, paths and addresses the backend accepts from outside: generated hostile strings must
//! never be accepted as something that leaves its folder, names a Windows device, or points at another host.
//! Pure functions and temporary folders only; no network. Run: `cargo test -p novira-core --test prop_paths`.
mod prop_common;

use novira_core::backup::{classify, Entry};
use novira_core::comfy::node_packs::{parse_github, remove, route_allowed};
use novira_core::media::images::{is_valid_name, new_audio_name, new_name, new_video_name};
use novira_core::models::install::{
    host_is, is_hugging_face_repo, is_repo_file_path, is_source_page, parse_source, safe_file_name,
    Source,
};
use prop_common::{any_text, check, nasty_string};
use proptest::prelude::*;
use std::path::{Component, Path};

/// An independent statement of the Windows rule: the part of a name before its first dot, without trailing spaces,
/// names a device (`CON.png` is the console, not a file).
fn is_device(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").trim_end_matches(' ');
    let up = stem.to_ascii_uppercase();
    matches!(
        up.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ((up.starts_with("COM") || up.starts_with("LPT"))
        && up.len() == 4
        && matches!(up.as_bytes()[3], b'1'..=b'9'))
}

fn is_one_plain_component(name: &str) -> bool {
    let mut parts = Path::new(name).components();
    matches!((parts.next(), parts.next()), (Some(Component::Normal(n)), None) if n == name)
}

/// Reserved names in every case mix, with a stem that may be followed by spaces or more dots.
fn device_name(ext: &'static [&'static str]) -> impl Strategy<Value = String> {
    (
        prop::sample::select(
            &[
                "con", "prn", "aux", "nul", "com1", "com9", "lpt1", "lpt9", "conin$", "conout$",
            ][..],
        ),
        prop::collection::vec(any::<bool>(), 6),
        prop::sample::select(&["", ".", ".x.", " "][..]),
        prop::sample::select(ext),
    )
        .prop_map(|(stem, upper, mid, ext)| {
            let cased: String = stem
                .chars()
                .zip(upper.iter().cycle())
                .map(|(c, u)| if *u { c.to_ascii_uppercase() } else { c })
                .collect();
            format!("{cased}{mid}{ext}")
        })
}

const IMAGE_EXT: &[&str] = &[".png", ".mp4", ".wav", ".mp3", ".flac", ".ogg"];
const MODEL_EXT: &[&str] = &[".safetensors", ".gguf", ".ckpt", ".pt", ".pth"];

#[test]
fn an_accepted_gallery_name_is_one_plain_file_name() {
    check(any_text(), |name| {
        if is_valid_name(&name) {
            prop_assert!(is_one_plain_component(&name), "{name:?}");
            prop_assert!(name.len() <= 80);
            prop_assert!(!name.starts_with('.'));
            prop_assert!(name
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b)));
            prop_assert!(!is_device(&name), "a device name was accepted: {name:?}");
            let base = Path::new("base");
            prop_assert!(base.join(&name).starts_with(base));
        }
        Ok(())
    });
}

#[test]
fn names_the_app_generates_are_valid() {
    for name in [
        new_name(),
        new_video_name(),
        new_audio_name("wav"),
        new_audio_name("flac"),
    ] {
        assert!(is_valid_name(&name), "{name}");
    }
}

#[test]
fn a_gallery_name_that_is_a_windows_device_is_refused() {
    for name in [
        "nul.png",
        "CON.png",
        "Aux.mp4",
        "com1.wav",
        "LPT9.png",
        "con.x.png",
        "NUL..png",
    ] {
        assert!(!is_valid_name(name), "{name}");
    }
    check(device_name(IMAGE_EXT), |name| {
        prop_assert!(!is_valid_name(&name), "{name:?}");
        Ok(())
    });
}

#[test]
fn an_accepted_model_file_name_is_plain_and_normalising_it_again_changes_nothing() {
    check(any_text(), |name| {
        if let Some(n) = safe_file_name(&name) {
            let again = safe_file_name(&n);
            prop_assert_eq!(again.as_deref(), Some(n.as_str()));
            prop_assert!(is_one_plain_component(&n), "{n:?}");
            prop_assert!(n.len() <= 200 && !n.starts_with('.'));
            prop_assert!(
                !n.chars().any(char::is_control),
                "a control character was accepted: {n:?}"
            );
            prop_assert!(!n.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']));
            prop_assert!(!is_device(&n), "a device name was accepted: {n:?}");
            prop_assert!(!n.ends_with(['.', ' ']));
        }
        Ok(())
    });
}

#[test]
fn a_model_file_name_with_a_device_name_or_a_control_character_is_refused() {
    for name in [
        "nul.safetensors",
        "CON.gguf",
        "Prn.ckpt",
        "lpt1.safetensors",
        "a\u{1}.safetensors",
        "a\n.gguf",
        "a\0.safetensors",
        "a\u{7f}.safetensors",
        "\u{1b}[0m.gguf",
    ] {
        assert!(safe_file_name(name).is_none(), "{name:?}");
    }
    check(device_name(MODEL_EXT), |name| {
        prop_assert!(safe_file_name(&name).is_none(), "{name:?}");
        Ok(())
    });
    assert_eq!(
        safe_file_name("  model-v1.safetensors ").as_deref(),
        Some("model-v1.safetensors")
    );
    assert_eq!(
        safe_file_name("console.safetensors").as_deref(),
        Some("console.safetensors")
    );
}

#[test]
fn a_backup_entry_is_only_a_gallery_file_when_its_name_is_valid() {
    check(
        prop_oneof![
            any_text().prop_map(|n| format!("outputs/{n}")),
            any_text().prop_map(|n| format!("thumbnails/{n}")),
            any_text()
        ],
        |name| {
            match classify(&name) {
                Some(Entry::Original(n)) => {
                    prop_assert!(is_valid_name(&n), "{n:?}");
                    prop_assert_eq!(name, format!("outputs/{n}"));
                }
                Some(Entry::Thumbnail(n)) => {
                    let stem = n.strip_suffix(".thumb");
                    prop_assert!(
                        stem.is_some_and(|s| is_valid_name(&format!("{s}.png"))),
                        "{n:?}"
                    );
                    prop_assert!(!is_device(&n), "{n:?}");
                }
                _ => {}
            }
            Ok(())
        },
    );
}

#[test]
fn a_backup_entry_named_like_a_device_is_not_extracted() {
    for name in [
        "outputs/nul.png",
        "outputs/CON.mp4",
        "thumbnails/aux.thumb",
        "thumbnails/Com1.thumb",
        "outputs/lpt2.wav",
    ] {
        assert_eq!(classify(name), None, "{name}");
    }
}

#[test]
fn a_hostile_backup_leaves_nothing_outside_the_staging_folder() {
    use std::io::Write;
    let dir = tempfile::tempdir().unwrap();
    let data = dir.path().join("data");
    std::fs::create_dir_all(&data).unwrap();
    let canary = dir.path().join("canary.txt");
    std::fs::write(&canary, "keep").unwrap();
    check(
        prop::collection::vec(
            (any_text(), prop::collection::vec(any::<u8>(), 0..32)),
            0..6,
        ),
        |entries| {
            let zip_path = dir.path().join("hostile.zip");
            {
                let mut zip = zip::ZipWriter::new(std::fs::File::create(&zip_path).unwrap());
                for (name, body) in &entries {
                    let options = zip::write::SimpleFileOptions::default();
                    if zip.start_file(name.as_str(), options).is_ok() {
                        zip.write_all(body).unwrap();
                    }
                }
                zip.finish().unwrap();
            }
            let result = novira_core::backup::restore::stage(&zip_path, &data, |_, _| {});
            prop_assert!(result.is_err());
            let left: Vec<_> = std::fs::read_dir(&data)
                .unwrap()
                .flatten()
                .map(|e| e.file_name())
                .collect();
            prop_assert!(left.is_empty(), "left behind: {left:?}");
            prop_assert_eq!(std::fs::read_to_string(&canary).unwrap(), "keep");
            Ok(())
        },
    );
}

#[test]
fn a_pack_route_stays_inside_the_listed_prefix_and_carries_no_encoding() {
    let route = prop_oneof![
        any_text(),
        any_text().prop_map(|t| format!("nkd/facerig/{t}"))
    ];
    check(route, |route| {
        if route_allowed(&route) {
            prop_assert!(route.starts_with("nkd/facerig/"));
            prop_assert!(!route.contains(".."));
            prop_assert!(!route.contains("//"));
            prop_assert!(
                !route.contains('%'),
                "an encoded character was accepted: {route:?}"
            );
            prop_assert!(!route.chars().any(char::is_control), "{route:?}");
            prop_assert!(!route.contains(['?', '#', '\\']));
        }
        Ok(())
    });
}

#[test]
fn an_encoded_traversal_is_not_a_pack_route() {
    for bad in [
        "nkd/facerig/%2e%2e/prompt",
        "nkd/facerig/%2E%2E/prompt",
        "nkd/facerig/.%2e/prompt",
        "nkd/facerig/%2e./prompt",
        "nkd/facerig/..%2fprompt",
        "nkd/facerig/%2f%2e%2e",
        "nkd/facerig/a%5cb",
        "nkd/facerig/a%5Cb",
        "nkd/facerig/%252e%252e/prompt",
        "nkd/facerig/%00",
        "nkd/facerig/a\nb",
        "nkd/facerig/a\0b",
    ] {
        assert!(!route_allowed(bad), "{bad:?}");
    }
    assert!(route_allowed("nkd/facerig/preview"));
}

#[test]
fn removing_a_pack_never_touches_anything_but_a_direct_child_folder() {
    let dir = tempfile::tempdir().unwrap();
    let nodes = dir.path().join("custom_nodes");
    let victim = dir.path().join("victim");
    std::fs::create_dir_all(&nodes).unwrap();
    std::fs::create_dir_all(&victim).unwrap();
    std::fs::write(victim.join("f.txt"), "keep").unwrap();
    check(any_text(), |name| {
        std::fs::create_dir_all(nodes.join("pack")).unwrap();
        let result = remove(&nodes, &name);
        prop_assert!(
            victim.join("f.txt").is_file(),
            "removed outside custom_nodes with {name:?}"
        );
        prop_assert!(nodes.is_dir());
        if result.is_ok() {
            prop_assert_eq!(name.as_str(), "pack");
        }
        Ok(())
    });
}

#[test]
fn a_github_address_parses_to_plain_names_and_round_trips() {
    let url = prop_oneof![
        any_text(),
        (nasty_string(), nasty_string()).prop_map(|(o, r)| format!("https://github.com/{o}/{r}")),
        (
            "[A-Za-z0-9._-]{0,12}",
            "[A-Za-z0-9._-]{0,12}",
            prop::sample::select(&["", "/", ".git", ".git/"][..])
        )
            .prop_map(|(o, r, tail)| format!("https://github.com/{o}/{r}{tail}")),
    ];
    check(url, |url| {
        if let Ok(repo) = parse_github(&url) {
            for part in [&repo.owner, &repo.repo] {
                prop_assert!(!part.is_empty() && part != "." && part != "..");
                prop_assert!(part
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c)));
            }
            prop_assert_eq!(parse_github(&repo.url()), Ok(repo.clone()));
            let tail = format!("/{}/{}/zip/HEAD", repo.owner, repo.repo);
            prop_assert!(repo.archive_url().contains(&tail));
        }
        Ok(())
    });
}

#[test]
fn a_model_source_is_one_of_the_forms_the_app_accepts() {
    let source = prop_oneof![
        any_text(),
        (any_text(), any_text()).prop_map(|(a, b)| format!("{a}::{b}")),
        any_text().prop_map(|t| format!("https://{t}")),
        any_text().prop_map(|t| format!("http://{t}")),
        any_text().prop_map(|t| format!("civitai:{t}")),
        (any::<u64>(), any::<u64>(), any::<u64>())
            .prop_map(|(m, v, f)| format!("civitai:{m}/{v}-{f}")),
    ];
    check(source, |source| {
        match parse_source(&source) {
            Ok(Source::HuggingFace { repo, file }) => {
                prop_assert!(is_hugging_face_repo(&repo) && is_repo_file_path(&file));
                prop_assert!(file.split('/').all(|p| p != ".." && p != "."));
                prop_assert!(!repo.contains(['\\', ':']) && !file.contains(['\\', ':']));
            }
            Ok(Source::Local(path)) => prop_assert!(path.is_absolute()),
            Ok(Source::Url(url)) => {
                let parsed = reqwest::Url::parse(&url).unwrap();
                let local = matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
                prop_assert!(parsed.scheme() == "https" || local, "{url:?}");
            }
            Ok(Source::CivitaiFile { .. } | Source::CivitaiPage { .. }) | Err(_) => {}
        }
        Ok(())
    });
}

#[test]
fn a_repository_path_never_climbs_or_names_a_drive() {
    check(any_text(), |file| {
        if is_repo_file_path(&file) {
            prop_assert!(file.len() <= 300);
            prop_assert!(file
                .split('/')
                .all(|p| !p.is_empty() && p.bytes().any(|b| b != b'.')));
            prop_assert!(!file.contains(['\\', ':', '%']));
        }
        if is_hugging_face_repo(&file) {
            prop_assert_eq!(file.matches('/').count(), 1);
            prop_assert!(!file.contains(['\\', ':', '%']));
        }
        Ok(())
    });
}

/// URLs from parts that matter: scheme, credentials, look-alike hosts, ports and paths.
fn url_text() -> impl Strategy<Value = String> {
    (
        prop::sample::select(&["https://", "http://", "ftp://", "//", "", "HTTPS://"][..]),
        prop::sample::select(&["", "user@", "user:pw@", "civitai.com@", "civitai.com:443@"][..]),
        prop::sample::select(
            &[
                "civitai.com",
                "www.civitai.com",
                "CIVITAI.COM",
                "xcivitai.com",
                "civitai.com.evil.example",
                "evil.example",
                "civitai.com.",
                "huggingface.co",
                "cdn.huggingface.co",
                "huggingface.co.evil.example",
                "127.0.0.1",
                "localhost",
                "[::1]",
                "civitai.com\\.evil.example",
            ][..],
        ),
        prop::sample::select(&["", ":443", ":80", ":0", ":99999"][..]),
        any_text(),
    )
        .prop_map(|(scheme, user, host, port, rest)| format!("{scheme}{user}{host}{port}/{rest}"))
}

#[test]
fn only_an_https_address_on_a_model_site_without_credentials_is_a_source_page() {
    check(prop_oneof![url_text(), any_text()], |text| {
        if is_source_page(&text) {
            let url = reqwest::Url::parse(&text).unwrap();
            prop_assert_eq!(url.scheme(), "https");
            prop_assert!(url.username().is_empty());
            let host = url.host_str().unwrap().to_ascii_lowercase();
            prop_assert!(
                ["civitai.com", "huggingface.co"]
                    .iter()
                    .any(|d| host == *d || host.ends_with(&format!(".{d}"))),
                "{text:?}"
            );
        }
        Ok(())
    });
}

#[test]
fn host_is_compares_the_whole_host() {
    check(url_text(), |text| {
        if let Ok(url) = reqwest::Url::parse(&text) {
            for domain in ["civitai.com", "huggingface.co"] {
                let host = url.host_str().unwrap_or("").to_ascii_lowercase();
                let expected = host == domain || host.ends_with(&format!(".{domain}"));
                prop_assert_eq!(host_is(&url, domain), expected, "{}", text);
            }
        }
        Ok(())
    });
}
