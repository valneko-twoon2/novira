use super::*;

#[test]
fn the_tensors_outrank_the_sites_label_and_the_users_own_choice_outranks_both() {
    use ModelType::*;
    // An IP-Adapter the uploader filed as a checkpoint.
    assert_eq!(
        pick_kind(None, Some(IpAdapter), Some(Main)),
        Some(IpAdapter)
    );
    assert_eq!(
        pick_kind(Some(Lora), Some(IpAdapter), Some(Main)),
        Some(Lora)
    );
    assert_eq!(pick_kind(None, None, Some(Main)), Some(Main));
    assert_eq!(pick_kind(None, None, None), None);
}

#[test]
fn a_civitai_install_of_a_version_with_mature_pictures_only_keeps_one_marked_as_mature() {
    let v = serde_json::json!({
        "files": [{ "id": 1, "name": "a.safetensors", "primary": true, "sizeKB": 1.0, "downloadUrl": "https://civitai.com/api/download/models/9" }],
        "images": [{ "type": "image", "nsfwLevel": 8, "url": "https://image.civitai.com/k/u/original=true/1.jpeg" }],
        "model": { "type": "LORA" }
    });
    let r = civitai_file(&v, None, None).unwrap();
    assert_eq!(
        r.cover.as_deref(),
        Some("https://image.civitai.com/k/u/width=512/1.jpeg")
    );
    assert!(r.cover_mature);
    let plain = serde_json::json!({
        "files": [{ "id": 1, "name": "a.safetensors", "primary": true, "sizeKB": 1.0, "downloadUrl": "https://civitai.com/api/download/models/9" }],
        "images": [{ "type": "image", "nsfwLevel": 1, "url": "https://image.civitai.com/k/u/original=true/2.jpeg" }],
        "model": { "type": "LORA" }
    });
    assert!(!civitai_file(&plain, None, None).unwrap().cover_mature);
}

#[test]
fn a_civitai_install_keeps_the_versions_cover_and_trigger_words() {
    let v = serde_json::json!({
        "files": [{ "id": 1, "name": "a.safetensors", "primary": true, "sizeKB": 1.0, "downloadUrl": "https://civitai.com/api/download/models/9" }],
        "images": [{ "type": "image", "nsfwLevel": 1, "url": "https://image.civitai.com/k/u/original=true/1.jpeg" }],
        "trainedWords": ["girl"],
        "model": { "type": "LORA" }
    });
    let r = civitai_file(&v, None, None).unwrap();
    assert_eq!(
        r.cover.as_deref(),
        Some("https://image.civitai.com/k/u/width=512/1.jpeg")
    );
    assert_eq!(r.trigger_words, vec!["girl".to_string()]);
}

#[test]
fn video_models_and_gguf_files_from_civitai_go_to_the_diffusion_folder() {
    let version = |base: &str, file: &str| {
        serde_json::json!({
            "baseModel": base,
            "files": [{ "id": 1, "name": file, "primary": true, "sizeKB": 1.0, "downloadUrl": "https://civitai.com/api/download/models/9" }],
            "model": { "type": "Checkpoint" }
        })
    };
    let kind = |base, file| civitai_file(&version(base, file), None, None).unwrap().kind;
    assert_eq!(
        kind("Wan Video 14B t2v", "wan.safetensors"),
        Some(ModelType::DiffusionModel)
    );
    assert_eq!(
        kind("SDXL 1.0", "model-Q4.gguf"),
        Some(ModelType::DiffusionModel)
    );
    assert_eq!(kind("SDXL 1.0", "model.safetensors"), Some(ModelType::Main));
}

#[test]
fn sources_are_parsed() {
    assert_eq!(
        parse_source("civitai:133005/348913-280000").unwrap(),
        Source::CivitaiFile {
            version_id: 348913,
            file_id: 280000
        }
    );
    assert_eq!(
        parse_source("https://civitai.com/models/133005?modelVersionId=7").unwrap(),
        Source::CivitaiPage {
            model_id: 133005,
            version_id: Some(7)
        }
    );
    assert_eq!(
        parse_source("lokCX/4x-Ultrasharp::4x-UltraSharp.pth").unwrap(),
        Source::HuggingFace {
            repo: "lokCX/4x-Ultrasharp".into(),
            file: "4x-UltraSharp.pth".into()
        }
    );
    assert!(matches!(
        parse_source("https://example.com/a.safetensors").unwrap(),
        Source::Url(_)
    ));
    assert!(parse_source("Lykon/dreamshaper-8")
        .unwrap_err()
        .contains("diffusers"));
    assert!(parse_source("").is_err());
    assert!(parse_source("civitai:1/x").is_err());
    assert!(parse_source("a/b::../../x").is_err());
}

#[test]
fn civitai_versions_resolve_to_the_requested_file() {
    let v = serde_json::json!({
        "model": { "type": "LORA" },
        "files": [
            { "id": 1, "name": "a.safetensors", "sizeKB": 2.0, "downloadUrl": "https://civitai.com/api/download/models/9", "primary": true },
            { "id": 2, "name": "vae.safetensors", "type": "VAE", "sizeKB": 1.0, "downloadUrl": "https://civitai.com/api/download/models/9?type=VAE" }
        ]
    });
    let r = civitai_file(&v, None, Some(1)).unwrap();
    assert_eq!(
        (r.file_name.as_str(), r.kind, r.total_bytes),
        ("a.safetensors", Some(ModelType::Lora), 2048)
    );
    assert_eq!(
        civitai_file(&v, None, Some(2)).unwrap().kind,
        Some(ModelType::Vae)
    );
    assert_eq!(
        civitai_file(&v, Some("Checkpoint"), None).unwrap().kind,
        Some(ModelType::Main)
    );
    assert!(civitai_file(&v, None, Some(3)).is_err());
}

#[test]
fn only_model_site_pages_may_be_opened() {
    assert!(is_source_page("https://civitai.com/models/12345"));
    assert!(is_source_page("https://huggingface.co/owner/repo"));
    assert!(is_source_page("https://www.civitai.com/models/1"));
    assert!(is_source_page("https://github.com/owner/repo"));
    // The homepages of the open-source software in the about dialog.
    assert!(is_source_page("https://gitlab.com/owner/repo"));
    assert!(is_source_page("https://codeberg.org/owner/repo"));
    assert!(is_source_page("https://www.python.org/"));
    assert!(is_source_page("https://www.7-zip.org/"));
    for bad in [
        "http://www.python.org/",
        "https://gitlab.com.evil.example/owner/repo",
        "https://not7-zip.org/",
        "http://civitai.com/models/1",
        "https://civitai.com.evil.example/models/1",
        "https://evil.example/civitai.com",
        "https://github.com.evil.example/owner/repo",
        "http://github.com/owner/repo",
        "https://gist.github.io/x",
        "https://civitai.com@evil.example/x",
        "file:///C:/Windows/System32/calc.exe",
        "javascript:alert(1)",
        "ms-settings:",
        "civitai:1/2-3",
        "",
    ] {
        assert!(!is_source_page(bad), "{bad}");
    }
}

/// Every homepage in the about dialog's open-source list opens (the dialog turns a plain `http` link into `https`).
#[test]
fn every_open_source_homepage_may_be_opened() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../frontend/src/features/settings/ossLicenses.json"
    );
    let list: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let blocked: Vec<String> = list
        .as_object()
        .unwrap()
        .values()
        .flat_map(|part| part.as_array().unwrap())
        .map(|e| {
            e["url"]
                .as_str()
                .unwrap()
                .replacen("http://", "https://", 1)
        })
        .filter(|url| !is_source_page(url))
        .collect();
    assert!(blocked.is_empty(), "{blocked:?}");
}

#[test]
fn host_matching_compares_the_whole_host() {
    let u = |s: &str| reqwest::Url::parse(s).unwrap();
    assert!(host_is(
        &u("https://civitai.com/api/download/models/1"),
        "civitai.com"
    ));
    assert!(host_is(&u("https://WWW.Civitai.com/x"), "civitai.com"));
    for evil in [
        "https://civitai.com.evil.example/x",
        "https://evil.example/civitai.com/x",
        "https://evil.example/?u=civitai.com",
        "https://notcivitai.com/x",
        "https://civitai.com@evil.example/x",
    ] {
        assert!(!host_is(&u(evil), "civitai.com"), "{evil}");
    }
}

#[test]
fn a_civitai_file_is_downloaded_only_from_civitai_over_https() {
    let version = |url: &str| {
        serde_json::json!({
            "files": [{ "id": 1, "name": "a.safetensors", "primary": true, "sizeKB": 1.0, "downloadUrl": url }],
            "model": { "type": "Checkpoint" }
        })
    };
    let own = civitai_file(
        &version("https://civitai.com/api/download/models/9"),
        None,
        None,
    )
    .unwrap();
    assert!(own.civitai);
    for url in [
        "http://civitai.com/api/download/models/9",
        "https://civitai.com.evil.example/api/download/models/9",
        "https://evil.example/civitai.com/api/download/models/9",
        "https://civitai.com@evil.example/x",
        "http://127.0.0.1:9/api/download/models/9",
        "ftp://civitai.com/x",
        "/api/download/models/9",
        "",
    ] {
        let err = civitai_file(&version(url), None, None).unwrap_err();
        assert!(err.contains("unexpected download address"), "{url}: {err}");
    }
}

#[tokio::test]
async fn keys_are_sent_only_to_their_own_site_over_https() {
    let http = reqwest::Client::new();
    let resolve = |url: &str| {
        let http = http.clone();
        let url = url.to_string();
        async move { resolve(&http, &Source::Url(url), None).await.unwrap() }
    };
    let own = resolve("https://huggingface.co/a/b/resolve/main/x.safetensors").await;
    assert!(own.hugging_face && !own.civitai);
    for url in [
        "https://evil.example/huggingface.co/x.safetensors",
        "https://huggingface.co.evil.example/x.safetensors",
        "https://evil.example/civitai.com/x.safetensors",
        "http://localhost:9/civitai.com/x.safetensors",
    ] {
        let r = resolve(url).await;
        assert!(!r.hugging_face && !r.civitai, "{url}");
    }
}

#[test]
fn plain_http_and_odd_repository_paths_are_refused() {
    assert!(parse_source("http://example.com/x.safetensors").is_err());
    assert!(parse_source("http://localhost:8000/x.safetensors").is_ok());
    assert!(parse_source("https://example.com/x.safetensors").is_ok());
    for bad in [
        "a/b::x.safetensors?download=true",
        "a/b::x#frag",
        "a/b::dir/../x.safetensors",
        "a/b::/abs/x.safetensors",
        "a/b::dir//x.safetensors",
        "a b/c::x.safetensors",
        "a/b/c::x.safetensors",
        "../b::x.safetensors",
        "a/..::x.safetensors",
    ] {
        assert!(parse_source(bad).is_err(), "{bad}");
    }
    assert!(parse_source("owner/repo::sub/dir/model.v2.safetensors").is_ok());
}

#[test]
fn file_names_are_checked() {
    assert_eq!(
        safe_file_name("x.safetensors").as_deref(),
        Some("x.safetensors")
    );
    for bad in ["../x.safetensors", "a\\b.pth", "x.exe", ".x.pth", "c:x.pth"] {
        assert!(safe_file_name(bad).is_none(), "{bad}");
    }
    assert_eq!(
        file_name_of_url("https://h/x/RealESRGAN_x4plus.pth?download=1"),
        "RealESRGAN_x4plus.pth"
    );
}

#[test]
fn a_part_is_named_by_its_source_so_the_same_install_finds_it() {
    let name = part_name("civitai:701/7001-9");
    assert_eq!(name, part_name("civitai:701/7001-9"));
    assert_ne!(name, part_name("civitai:701/7001-10"));
    let hex = name.strip_suffix(".part").expect("a .part name");
    assert_eq!(hex.len(), 16);
    assert!(hex.bytes().all(|b| b.is_ascii_hexdigit()));
}
