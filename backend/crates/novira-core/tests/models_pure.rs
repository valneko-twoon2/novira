//! The model helpers that need no network: search request building, response mapping, licenses, source parsing,
//! header-based classification and record keys.
use novira_core::models::civitai::{self, SearchParams};
use novira_core::models::classify::{self, Header};
use novira_core::models::huggingface;
use novira_core::models::install::{self, InstallError, Source};
use novira_core::models::layout::FoundModel;
use novira_core::models::registry;
use novira_core::types::{BaseModel, ModelFormat, ModelType};
use serde_json::{json, Value};
use std::collections::HashSet;
use tokio_util::sync::CancellationToken;

fn params(kind: &str, base: &str) -> SearchParams {
    serde_json::from_value(json!({
        "query": " cat ", "kind": kind, "baseModel": base, "sort": "newest", "period": "week",
        "includeNsfw": true
    }))
    .unwrap()
}

fn has(q: &[(String, String)], k: &str, v: &str) -> bool {
    q.iter().any(|(a, b)| a == k && b == v)
}

fn header(keys: &[&str], meta: Value) -> Header {
    Header {
        keys: keys.iter().map(|k| k.to_string()).collect(),
        metadata: meta.as_object().cloned().unwrap_or_default(),
        shapes: Default::default(),
    }
}

#[test]
fn civitai_requests_follow_the_filters() {
    let p = params("LoRA", "sdxl-compat");
    assert_eq!(p.source, "civitai");
    let q = civitai::query(&p);
    assert!(has(&q, "query", "cat") && has(&q, "types", "LoCon") && has(&q, "baseModels", "Pony"));
    assert!(has(&q, "sort", "Newest") && has(&q, "period", "Week") && has(&q, "nsfw", "true"));
    for (kind, ty) in [
        ("ControlNet", "Controlnet"),
        ("VAE", "VAE"),
        ("Checkpoint", "Checkpoint"),
        ("Diffusion", "Checkpoint"),
        ("anything", "Controlnet"),
    ] {
        assert!(has(&civitai::query(&params(kind, "all")), "types", ty));
    }
    let diffusion = civitai::query(&params("Diffusion", "all"));
    assert!(diffusion.iter().any(|(k, _)| k == "baseModels"));
    assert!(has(
        &civitai::query(&params("LoRA", "Flux.1 D")),
        "baseModels",
        "Flux.1 D"
    ));
    assert!(!civitai::query(&params("LoRA", ""))
        .iter()
        .any(|(k, _)| k == "baseModels"));
    for (sort, period, s, per) in [
        ("rating", "year", "Highest Rated", "Year"),
        ("downloads", "month", "Most Downloaded", "Month"),
        ("x", "day", "Most Downloaded", "Day"),
        ("x", "all", "Most Downloaded", "AllTime"),
    ] {
        let mut p = params("LoRA", "all");
        p.sort = sort.into();
        p.period = period.into();
        let q = civitai::query(&p);
        assert!(has(&q, "sort", s) && has(&q, "period", per));
    }
}

#[test]
fn civitai_licenses_and_models_are_mapped() {
    let m = json!({
        "id": 7, "name": "Cat", "type": "Checkpoint", "nsfw": false,
        "allowCommercialUse": ["Image", "Rent", "Sell"], "allowDerivatives": true, "allowNoCredit": false,
        "description": "<p>Hello<br>world</p>", "tags": ["cat"],
        "creator": {"username": "me"}, "stats": {"downloadCount": 3, "rating": 4.5},
        "modelVersions": [{
            "id": 70, "name": "v1", "baseModel": "Wan Video 14B t2v", "createdAt": "2024-01-01T00:00:00Z",
            "trainedWords": ["meow"],
            "files": [
                {"id": 1, "name": "a.gguf", "sizeKB": 2.0, "metadata": {"format": "GGUF", "fp": "fp8_e4m3"}},
                {"id": 2, "name": "b.ckpt", "metadata": {"format": "PickleTensor", "fp": "fp32"}},
                {"id": 3, "name": "c.safetensors", "metadata": {"fp": "bf16"}},
                {"name": "no id"}
            ],
            "images": [{"url": "https://x/original=true/a.png", "type": "image", "nsfwLevel": 1}]
        }, {"id": 71, "files": []}]
    });
    let r = civitai::map_response(
        &json!({"items": [m, {"id": 1}], "metadata": {"nextCursor": 5}}),
        true,
    );
    assert_eq!(r.next_cursor.as_deref(), Some("5"));
    assert_eq!(r.items.len(), 1);
    let model = &r.items[0];
    assert_eq!(model.kind, "Diffusion");
    assert_eq!(model.commercial, "allowed");
    assert!(model.license.contains(&"Sell this model".to_string()));
    assert!(model.license.contains(&"Credit required".to_string()));
    assert_eq!(model.versions.len(), 1);
    assert_eq!(model.versions[0].files.len(), 3);
    assert_eq!(model.versions[0].files[0].precision, "fp8");
    assert_eq!(model.versions[0].files[1].format, "PickleTensor");
    let text = civitai::map_response(
        &json!({"items": [], "metadata": {"nextCursor": "abc"}}),
        false,
    );
    assert_eq!(text.next_cursor.as_deref(), Some("abc"));
    assert!(civitai::map_response(&json!({}), false)
        .next_cursor
        .is_none());
    // Without a creator permission the use is "denied" and every flag is unknown.
    let none = civitai::license_of_model(&json!({"allowCommercialUse": "None"}));
    assert_eq!(
        (none.site.as_str(), none.commercial.as_str()),
        ("civitai", "denied")
    );
    // Selling the pictures only is some of the commercial uses, not all of them.
    let some = civitai::license_of_model(&json!({"allowCommercialUse": ["Image"]}));
    assert_eq!(some.commercial, "limited");
    let bare = json!({"modelVersions": [{"id": 1, "publishedAt": "2024-02-03T00:00:00Z",
        "files": [{"id": 1, "name": "a.safetensors"}]}], "id": 2, "name": "n", "type": "LORA"});
    let mapped = civitai::map_response(&json!({"items": [bare]}), false);
    assert_eq!(
        mapped.items[0].license,
        vec!["No commercial use".to_string()]
    );
    assert!(mapped.items[0].created_at > 0);
}

#[test]
fn civitai_covers_skip_mature_pictures() {
    let v = json!({"images": [
        {"url": "https://x/a/original=true/v.mp4", "type": "video"},
        {"url": "https://x/a/original=true/m.png", "type": "image", "nsfwLevel": 8},
        {"url": "https://x/a/original=true/ok.png", "nsfwLevel": 2}
    ], "trainedWords": [" a ", "", 3]});
    assert_eq!(
        civitai::cover_of_version(&v).as_deref(),
        Some("https://x/a/width=512/ok.png")
    );
    assert_eq!(civitai::trigger_words(&v), vec!["a".to_string()]);
    assert!(civitai::cover_of_version(&json!({})).is_none());
}

#[test]
fn hugging_face_requests_follow_the_filters() {
    let q = huggingface::query(&params("LoRA", "sdxl-compat"));
    assert!(has(&q, "filter", "lora") && has(&q, "filter", "stable-diffusion-xl"));
    assert!(has(&q, "sort", "createdAt") && has(&q, "search", "cat"));
    for (kind, filter) in [
        ("Checkpoint", "text-to-image"),
        ("ControlNet", "controlnet"),
    ] {
        assert!(has(
            &huggingface::query(&params(kind, "SD 1.5")),
            "filter",
            filter
        ));
    }
    assert!(has(
        &huggingface::query(&params("Checkpoint", "SD 1.5")),
        "filter",
        "stable-diffusion"
    ));
    assert!(has(
        &huggingface::query(&params("Checkpoint", "FLUX.1")),
        "filter",
        "flux"
    ));
    assert!(!huggingface::query(&params("Diffusion", "all"))
        .iter()
        .any(|(k, _)| k == "filter"));
    let mut vae = params("VAE", "all");
    vae.query = String::new();
    vae.sort = "rating".into();
    vae.cursor = Some("c1".into());
    let q = huggingface::query(&vae);
    assert!(has(&q, "search", "vae") && has(&q, "sort", "likes") && has(&q, "cursor", "c1"));
    let mut dl = params("VAE", "all");
    dl.sort = "downloads".into();
    dl.query = "my VAE".into();
    let q = huggingface::query(&dl);
    assert!(has(&q, "search", "my VAE") && has(&q, "sort", "downloads"));
}

#[test]
fn hugging_face_files_licenses_and_cursors() {
    let siblings = json!([
        {"rfilename": "unet/diffusion.safetensors"},
        {"rfilename": "weights/model-fp8.gguf", "size": 5},
        {"rfilename": "a.ckpt"}, {"rfilename": "readme.md"}, {"nope": 1}
    ]);
    let files = huggingface::model_files(&siblings);
    assert_eq!(files.len(), 2);
    assert_eq!(
        (files[0].format.as_str(), files[0].precision.as_str()),
        ("GGUF", "fp8")
    );
    assert_eq!(files[1].format, "PickleTensor");
    let many: Vec<Value> = (0..20)
        .map(|i| json!({"rfilename": format!("f{i}.safetensors")}))
        .collect();
    assert_eq!(huggingface::model_files(&Value::Array(many)).len(), 12);

    for (lic, commercial) in [
        (Some("mit"), "allowed"),
        (Some("cc-by-nc-4.0"), "denied"),
        (Some("other"), "limited"),
        (None, "limited"),
    ] {
        assert_eq!(
            civitai::commercial_of(&huggingface::permissions(lic)),
            commercial
        );
    }
    for lic in [
        "cc0-1.0",
        "mit",
        "cc-by-sa-4.0",
        "flux-1-dev-non-commercial-license",
        "creativeml-openrail-m",
        "cc-by-nc-4.0",
        "cc-by-nc-nd-4.0",
        "weird",
    ] {
        assert_eq!(huggingface::permissions(Some(lic)).len(), 6);
    }
    assert!(huggingface::permissions(None)
        .iter()
        .all(|p| p.allowed.is_none()));
    let l = huggingface::license_of_tag(Some("apache-2.0"));
    assert_eq!(
        (l.site.as_str(), l.name.as_deref()),
        ("huggingface", Some("apache-2.0"))
    );

    let link = r#"<https://huggingface.co/api/models?limit=24&cursor=abc%3D>; rel="next", <x>; rel="prev""#;
    assert_eq!(
        huggingface::next_cursor(Some(link)).as_deref(),
        Some("abc=")
    );
    assert!(huggingface::next_cursor(None).is_none());
    assert!(huggingface::next_cursor(Some(r#"<https://h/?cursor=1>; rel="prev""#)).is_none());
    assert!(huggingface::next_cursor(Some(r#"<not a url>; rel="next""#)).is_none());
}

#[test]
fn hugging_face_repositories_are_mapped_by_what_they_hold() {
    let repo = |id: &str, tags: Value, extra: Value| {
        let mut m = json!({
            "id": id, "tags": tags, "downloads": 5, "likes": 2, "createdAt": "2024-05-01T00:00:00Z",
            "lastModified": "2024-06-01T00:00:00Z",
            "siblings": [{"rfilename": "model.safetensors"}, {"rfilename": "images/a.png"}, {"rfilename": "b.jpg"}]
        });
        for (k, v) in extra.as_object().unwrap() {
            m[k] = v.clone();
        }
        m
    };
    let body = json!([
        repo(
            "o/lora",
            json!(["lora", "sdxl", "license:mit", "base_model:a/b", "cute"]),
            json!({"cardData": {"instance_prompt": "zap, , boom"}, "gated": "auto", "author": "me"})
        ),
        repo("o/video", json!(["text-to-video", "flux"]), json!({})),
        repo("o/cn", json!(["controlnet", "stable-diffusion"]), json!({})),
        repo(
            "o/vae",
            json!(["vae", "base_model:finetune:x", "base_model:z/y"]),
            json!({})
        ),
        repo(
            "o/ckpt",
            json!(["base_model:quantized:x"]),
            json!({"siblings": [{"rfilename": "unet.safetensors"}]})
        ),
        repo("o/private", json!([]), json!({"private": true})),
        repo("o/empty", json!([]), json!({"siblings": []})),
        repo("o/adult", json!(["nsfw"]), json!({})),
        json!({"nope": 1}),
    ]);
    let all = huggingface::map_response(&body, true);
    let safe = huggingface::map_response(&body, false);
    assert!(all.len() > safe.len());
    let by = |id: &str| safe.iter().find(|m| m.id == id).unwrap();
    let lora = by("o/lora");
    assert_eq!(
        (lora.kind.as_str(), lora.base_model.as_str()),
        ("LoRA", "SDXL 1.0")
    );
    assert_eq!(
        lora.trigger_words,
        vec!["zap".to_string(), "boom".to_string()]
    );
    assert_eq!(lora.image_urls.len(), 2);
    assert!(lora.image_urls[0].ends_with("images/a.png"));
    assert!(lora.description.contains("Gated"));
    assert_eq!(lora.tags, vec!["cute".to_string()]);
    assert_eq!(by("o/video").kind, "Diffusion");
    assert_eq!(by("o/cn").kind, "ControlNet");
    assert_eq!(by("o/vae").kind, "VAE");
    assert_eq!(by("o/vae").base_model, "—");
    assert_eq!(by("o/ckpt").kind, "Checkpoint");
    assert_eq!(by("o/ckpt").base_model, "—");
}

#[test]
fn install_sources_are_parsed_strictly() {
    assert!(matches!(
        install::parse_source("civitai:1/22-333"),
        Ok(Source::CivitaiFile {
            version_id: 22,
            file_id: 333
        })
    ));
    for bad in [
        "civitai:1",
        "civitai:1/22",
        "civitai:1/x-3",
        "civitai:1/2-y",
        "",
        "  ",
        "foo",
        "a/b::../c",
        "a::b",
        "a/b",
    ] {
        assert!(install::parse_source(bad).is_err(), "{bad}");
    }
    assert!(matches!(
        install::parse_source("https://civitai.com/models/9?modelVersionId=4"),
        Ok(Source::CivitaiPage {
            model_id: 9,
            version_id: Some(4)
        })
    ));
    assert!(matches!(
        install::parse_source("https://civitai.com/models/x"),
        Ok(Source::Url(_))
    ));
    assert!(install::parse_source("http://example.com/a.safetensors").is_err());
    assert!(install::parse_source("http://localhost:1/a.safetensors").is_ok());
    assert!(install::parse_source("https://").is_err());
    assert!(matches!(
        install::parse_source("owner/repo::dir/file.safetensors"),
        Ok(Source::HuggingFace { .. })
    ));
    assert!(install::is_hugging_face_repo("a/b") && !install::is_hugging_face_repo("a/b/c"));
    assert!(install::is_repo_file_path("a/b.safetensors") && !install::is_repo_file_path("../x"));
    assert!(install::is_source_page("https://huggingface.co/a/b"));
    assert!(!install::is_source_page("http://huggingface.co/a/b"));
    assert!(!install::is_source_page(
        "https://huggingface.co.evil.example/a"
    ));
    assert!(!install::is_source_page("https://u:p@civitai.com/a"));
    assert!(install::safe_file_name(" a.safetensors ").is_some());
    for bad in ["", ".hidden.safetensors", "a/b.safetensors", "a.txt"] {
        assert!(install::safe_file_name(bad).is_none(), "{bad}");
    }
    assert_eq!(install::civitai_kind("LoCon"), Some(ModelType::Lora));
    assert_eq!(
        install::civitai_kind("Upscaler"),
        Some(ModelType::SpandrelImageToImage)
    );
    assert_eq!(install::civitai_kind("VAE"), Some(ModelType::Vae));
    assert_eq!(install::civitai_kind("Checkpoint"), Some(ModelType::Main));
    assert_eq!(
        install::civitai_kind("Controlnet"),
        Some(ModelType::Controlnet)
    );
    assert_eq!(install::civitai_kind("Poses"), None);
    assert!(install::target_dir(std::path::Path::new("m"), ModelType::T5Encoder).is_err());
    assert!(install::target_dir(std::path::Path::new("m"), ModelType::Lora).is_ok());
}

#[tokio::test]
async fn sources_without_an_api_resolve_without_asking_one() {
    let http = reqwest::Client::new();
    let hf = install::resolve(
        &http,
        &Source::HuggingFace {
            repo: "o/r".into(),
            file: "dir/x.safetensors".into(),
        },
        None,
    )
    .await
    .unwrap();
    assert!(hf.hugging_face && !hf.civitai && hf.file_name == "x.safetensors");
    let civ = install::resolve(
        &http,
        &Source::Url("https://civitai.com/api/download/models/1".into()),
        None,
    )
    .await
    .unwrap();
    assert!(civ.civitai && civ.file_name == "1");
    let plain = install::resolve(&http, &Source::Url("http://127.0.0.1:1/".into()), None)
        .await
        .unwrap();
    assert!(!plain.civitai && !plain.hugging_face && plain.file_name == "model.safetensors");
    assert!(install::resolve(&http, &Source::Local("x".into()), None)
        .await
        .is_err());
}

#[tokio::test]
async fn a_download_to_a_blocked_path_or_cancelled_early_leaves_nothing() {
    let http = reqwest::Client::new();
    let dir = tempfile::tempdir().unwrap();
    let cancel = CancellationToken::new();
    cancel.cancel();
    let dest = dir.path().join("sub").join("a.bin");
    let r = install::download(
        &http,
        "http://127.0.0.1:1/a",
        Some("k"),
        &dest,
        &cancel,
        |_, _| {},
    )
    .await;
    assert_eq!(r, Err(InstallError::Cancelled));
    assert!(!dest.exists());
    // Link or copy puts the file in place, creating folders.
    let src = dir.path().join("src.safetensors");
    std::fs::write(&src, b"abc").unwrap();
    let to = dir.path().join("x").join("y").join("z.safetensors");
    install::link_or_copy(&src, &to).unwrap();
    assert_eq!(std::fs::read(&to).unwrap(), b"abc");
}

#[test]
fn model_kinds_and_bases_are_read_from_tensor_names() {
    let kinds = [
        (vec!["lora_unet_x"], ModelType::Lora),
        (vec!["control_model.a"], ModelType::Controlnet),
        (vec!["controlnet_cond"], ModelType::Controlnet),
        (vec!["image_proj.a"], ModelType::IpAdapter),
        (vec!["ip_adapter.a"], ModelType::IpAdapter),
        // A Flux transformer on its own is a diffusion model; with the VAE and encoders beside it, a checkpoint.
        (
            vec!["double_blocks.0.x", "single_blocks.0.x"],
            ModelType::DiffusionModel,
        ),
        (
            vec![
                "model.diffusion_model.double_blocks.0.x",
                "vae.decoder.up.0",
            ],
            ModelType::Main,
        ),
        (
            vec!["net.blocks.0.q", "net.llm_adapter.embed"],
            ModelType::DiffusionModel,
        ),
        (vec!["blocks.0.self_attn.q"], ModelType::DiffusionModel),
        (vec!["vision_model.a"], ModelType::ClipVision),
        (vec!["encoder.down.0", "decoder.up.0"], ModelType::Vae),
    ];
    for (keys, kind) in kinds {
        assert_eq!(
            classify::detect_kind(&header(&keys, json!({}))),
            Some(kind),
            "{keys:?}"
        );
    }
    assert_eq!(classify::detect_kind(&header(&["zzz"], json!({}))), None);

    let base = |kind, keys: &[&str], meta| {
        classify::detect_base(kind, Some(&header(keys, meta)), "file.safetensors")
    };
    assert_eq!(
        base(ModelType::Main, &["conditioner.embedders.1.x"], json!({})),
        BaseModel::Sdxl
    );
    assert_eq!(
        base(ModelType::Main, &["joint_blocks.0"], json!({})),
        BaseModel::Sd3
    );
    assert_eq!(
        base(ModelType::Main, &["double_blocks.0"], json!({})),
        BaseModel::Flux
    );
    assert_eq!(
        base(
            ModelType::Main,
            &["cond_stage_model.model.transformer.a"],
            json!({})
        ),
        BaseModel::Sd2
    );
    assert_eq!(
        base(
            ModelType::Main,
            &["cond_stage_model.transformer.a"],
            json!({})
        ),
        BaseModel::Sd1
    );
    assert_eq!(base(ModelType::Main, &["zzz"], json!({})), BaseModel::Any);
    assert_eq!(
        base(ModelType::Lora, &["single_blocks.1"], json!({})),
        BaseModel::Flux
    );
    assert_eq!(
        base(ModelType::Lora, &["lora_te2_a"], json!({})),
        BaseModel::Sdxl
    );
    assert_eq!(
        base(ModelType::Lora, &["lora_te_a"], json!({})),
        BaseModel::Sd1
    );
    assert_eq!(base(ModelType::Lora, &["zzz"], json!({})), BaseModel::Any);
    assert_eq!(
        base(ModelType::Controlnet, &["add_embedding.x"], json!({})),
        BaseModel::Sdxl
    );
    assert_eq!(
        base(ModelType::Controlnet, &["zzz"], json!({})),
        BaseModel::Any
    );
    assert_eq!(base(ModelType::Vae, &["zzz"], json!({})), BaseModel::Any);
    for (arch, expected) in [
        ("stable-diffusion-xl-v1-base", BaseModel::Sdxl),
        ("stable-diffusion-v1", BaseModel::Sd1),
        ("stable-diffusion-v2-768", BaseModel::Sd2),
        ("stable-diffusion-v3-medium", BaseModel::Sd3),
        ("flux-1-dev", BaseModel::Flux),
    ] {
        assert_eq!(
            base(
                ModelType::Main,
                &[],
                json!({"modelspec.architecture": arch})
            ),
            expected
        );
    }
    for (v, expected) in [
        ("SDXL_1", BaseModel::Sdxl),
        ("sd_v1", BaseModel::Sd1),
        ("sd_v2", BaseModel::Sd2),
        ("flux1", BaseModel::Flux),
        ("other", BaseModel::Any),
    ] {
        assert_eq!(
            base(ModelType::Lora, &[], json!({"ss_base_model_version": v})),
            expected
        );
    }
    // File names decide when there is no header.
    for (name, expected) in [
        ("flux-dev.sft", BaseModel::Flux),
        ("pony_v6.safetensors", BaseModel::Sdxl),
        ("model-sd1.5.ckpt", BaseModel::Sd1),
        ("plain.ckpt", BaseModel::Any),
    ] {
        assert_eq!(classify::detect_base(ModelType::Main, None, name), expected);
    }
    assert_eq!(
        classify::detect_base(ModelType::ClipVision, None, "xl.pth"),
        BaseModel::Any
    );
    assert_eq!(
        classify::kind_from_name("A.PTH"),
        Some(ModelType::SpandrelImageToImage)
    );
    assert_eq!(classify::kind_from_name("a.bin"), None);
    let p = std::path::Path::new("a.gguf");
    assert_eq!(
        classify::detect_format(ModelType::Main, p),
        ModelFormat::Gguf
    );
    assert_eq!(
        classify::detect_format(ModelType::Lora, std::path::Path::new("a.pt")),
        ModelFormat::Lycoris
    );
    assert_eq!(
        classify::detect_format(ModelType::Main, std::path::Path::new("a.pt")),
        ModelFormat::Checkpoint
    );
}

#[test]
fn safetensors_headers_are_read_with_limits() {
    let dir = tempfile::tempdir().unwrap();
    let body =
        br#"{"__metadata__":{"a":"b"},"t":{"dtype":"F16","shape":[1],"data_offsets":[0,2]}}"#;
    let mut ok = (body.len() as u64).to_le_bytes().to_vec();
    ok.extend_from_slice(body);
    let path = dir.path().join("a.safetensors");
    std::fs::write(&path, &ok).unwrap();
    let h = classify::read_header(&path).unwrap();
    assert_eq!((h.keys, h.metadata.len()), (vec!["t".to_string()], 1));
    // Wrong extension, missing file, zero or huge length, short file, bad JSON.
    let ckpt = dir.path().join("a.ckpt");
    std::fs::write(&ckpt, &ok).unwrap();
    assert!(classify::read_header(&ckpt).is_none());
    assert!(classify::read_header_unchecked(&ckpt).is_some());
    assert!(classify::read_header(&dir.path().join("none.safetensors")).is_none());
    for (name, bytes) in [
        ("zero.safetensors", 0u64.to_le_bytes().to_vec()),
        ("huge.safetensors", u64::MAX.to_le_bytes().to_vec()),
        ("short.safetensors", vec![1, 2]),
        (
            "cut.safetensors",
            [10u64.to_le_bytes().to_vec(), vec![b'{']].concat(),
        ),
        (
            "bad.safetensors",
            [3u64.to_le_bytes().to_vec(), b"abc".to_vec()].concat(),
        ),
    ] {
        let p = dir.path().join(name);
        std::fs::write(&p, bytes).unwrap();
        assert!(classify::read_header(&p).is_none(), "{name}");
    }
    assert!(classify::parse_header(b"[]").is_none());
}

#[test]
fn record_keys_are_stable_and_phrases_come_from_the_header() {
    let kinds = [
        ModelType::Main,
        ModelType::Vae,
        ModelType::Lora,
        ModelType::Controlnet,
        ModelType::T2iAdapter,
        ModelType::IpAdapter,
        ModelType::ClipVision,
        ModelType::SpandrelImageToImage,
        ModelType::T5Encoder,
        ModelType::ClipEmbed,
        ModelType::DiffusionModel,
    ];
    let keys: HashSet<String> = kinds
        .iter()
        .map(|k| registry::key_for(*k, "f", "a\\b.safetensors"))
        .collect();
    assert_eq!(keys.len(), kinds.len());
    assert_eq!(
        registry::key_for(ModelType::Lora, "f", "a\\b.safetensors"),
        registry::key_for(ModelType::Lora, "f", "a/b.safetensors")
    );
    let dir = tempfile::tempdir().unwrap();
    let body = br#"{"__metadata__":{"modelspec.trigger_phrase":" one, ,two "},"t":{"dtype":"F16","shape":[1],"data_offsets":[0,2]}}"#;
    let mut bytes = (body.len() as u64).to_le_bytes().to_vec();
    bytes.extend_from_slice(body);
    let path = dir.path().join("x.v2.safetensors");
    std::fs::write(&path, bytes).unwrap();
    let found = FoundModel {
        path: path.clone(),
        comfy_name: "sub/x.v2.safetensors".into(),
        folder: "loras",
        kind: ModelType::Lora,
        size: 3,
    };
    let rec = registry::new_record(&found, None, None);
    assert_eq!(rec.name, "x.v2");
    assert_eq!(
        rec.trigger_phrases,
        Some(vec!["one".to_string(), "two".to_string()])
    );
    assert_eq!(rec.source, path.to_string_lossy());
    let named = registry::new_record(&found, Some("src"), Some("Shown.safetensors"));
    assert_eq!(
        (named.name.as_str(), named.source.as_str()),
        ("Shown", "src")
    );
    assert_eq!(
        registry::new_record(&found, None, Some(".hidden")).name,
        ".hidden"
    );
}
