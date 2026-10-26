use super::*;
use serde_json::json;

fn params() -> SearchParams {
    SearchParams {
        query: " cat ".into(),
        kind: "LoRA".into(),
        base_model: "sdxl-compat".into(),
        sort: "newest".into(),
        period: "week".into(),
        include_nsfw: false,
        cursor: Some("abc".into()),
        source: "civitai".into(),
        licenses: Vec::new(),
        checkpoint_type: String::new(),
        safetensors_only: false,
        creator: String::new(),
    }
}

fn model_with(id: &str, downloads: u64, rating: f64) -> CivitaiModel {
    let m = &json!({"id": id.parse::<u64>().unwrap(), "name": id, "type": "LORA", "stats": {"downloadCount": downloads, "rating": rating, "ratingCount": 1}, "modelVersions": [{"id": 1, "baseModel": "Pony", "files": [{"id": 9, "name": "a.safetensors", "sizeKB": 1.0, "metadata": {}}]}]});
    model(m, true).unwrap()
}

#[test]
fn several_base_models_in_a_popularity_sort_are_searched_one_at_a_time() {
    let mut p = params();
    p.base_model = "sdxl-compat".into();
    p.sort = "downloads".into();
    assert!(splits(&p, &bases(&p)));
    p.sort = "rating".into();
    assert!(splits(&p, &bases(&p)));
    p.sort = "newest".into();
    assert!(!splits(&p, &bases(&p)));
    p.sort = "downloads".into();
    p.base_model = "Pony".into();
    assert!(!splits(&p, &bases(&p)));
    p.base_model = "all".into();
    assert!(!splits(&p, &bases(&p)));
    p.kind = "Diffusion".into();
    assert!(splits(&p, &bases(&p)));
}

#[test]
fn the_flux_choice_asks_for_the_names_civitai_knows() {
    let mut p = params();
    p.base_model = "FLUX.1".into();
    p.sort = "downloads".into();
    let asked = bases(&p);
    assert_eq!(asked.len(), FLUX_BASES.len());
    assert!(!asked.iter().any(|b| b == "FLUX.1"));
    assert!(asked.iter().any(|b| b == "Flux.1 D") && asked.iter().any(|b| b == "Flux.2 D"));
    assert!(splits(&p, &asked));
}

#[test]
fn each_request_names_its_own_base_model_page_size_and_cursor() {
    let mut p = params();
    p.base_model = "sdxl-compat".into();
    let q = query_with(&p, &["Pony".to_string()], "6", Some("c1"));
    let all = |k: &str| {
        q.iter()
            .filter(|(a, _)| a == k)
            .map(|(_, v)| v.as_str())
            .collect::<Vec<_>>()
    };
    assert_eq!(all("baseModels"), ["Pony"]);
    assert_eq!(all("limit"), ["6"]);
    assert_eq!(all("cursor"), ["c1"]);
    // The plain query is the same as before: every base model, a whole page and the cursor of the search.
    assert_eq!(
        query(&p).iter().filter(|(k, _)| k == "baseModels").count(),
        SDXL_COMPATIBLE.len()
    );
}

#[test]
fn the_cursor_of_a_split_search_keeps_one_cursor_per_base_model() {
    let bases: Vec<String> = SDXL_COMPATIBLE.iter().map(|b| b.to_string()).collect();
    let first = multi_cursors(None, &bases);
    assert_eq!(first.len(), 4);
    assert!(first.iter().all(|(_, c)| c.is_none()));
    let next = multi_cursors(Some("multi:{\"Pony\":\"p2\",\"NoobAI\":\"n2\"}"), &bases);
    assert_eq!(
        next,
        vec![
            ("NoobAI".to_string(), Some("n2".to_string())),
            ("Pony".to_string(), Some("p2".to_string()))
        ]
    );
    // A cursor from another kind of search, or a broken one, continues nothing.
    assert!(multi_cursors(Some("abc"), &bases).is_empty());
    assert!(multi_cursors(Some("multi:{"), &bases).is_empty());
}

#[test]
fn merged_answers_follow_the_sort_and_drop_repeats() {
    let items = vec![
        model_with("1", 10, 4.0),
        model_with("2", 30, 3.0),
        model_with("1", 10, 4.0),
        model_with("3", 20, 5.0),
    ];
    let by = |sort: &str| {
        merge(items.clone(), sort)
            .into_iter()
            .map(|m| m.id)
            .collect::<Vec<_>>()
    };
    assert_eq!(by("downloads"), ["2", "3", "1"]);
    assert_eq!(by("rating"), ["3", "1", "2"]);
}

#[test]
fn license_creator_and_checkpoint_type_filters_go_to_the_site() {
    let mut p = params();
    p.licenses = vec![
        "sellImages".into(),
        "sellModel".into(),
        "shareMerges".into(),
        "differentLicense".into(),
        "noCredit".into(),
        "bogus".into(),
    ];
    p.checkpoint_type = "Merge".into();
    p.creator = " someone ".into();
    let q = query(&p);
    let all = |k: &str| {
        q.iter()
            .filter(|(a, _)| a == k)
            .map(|(_, v)| v.as_str())
            .collect::<Vec<_>>()
    };
    assert_eq!(all("allowCommercialUse"), ["Image", "Sell"]);
    assert_eq!(all("allowDerivatives"), ["true"]);
    assert_eq!(all("allowDifferentLicense"), ["true"]);
    assert_eq!(all("allowNoCredit"), ["true"]);
    assert_eq!(all("checkpointType"), ["Merge"]);
    assert_eq!(all("username"), ["someone"]);
    // Nothing asked for, nothing sent; a checkpoint type that is not one of the two is not sent.
    let mut none = params();
    none.checkpoint_type = "x".into();
    let q = query(&none);
    for k in [
        "allowCommercialUse",
        "allowDerivatives",
        "allowDifferentLicense",
        "allowNoCredit",
        "checkpointType",
        "username",
    ] {
        assert!(!q.iter().any(|(a, _)| a == k), "{k}");
    }
}

#[test]
fn the_answer_is_cut_to_the_permissions_and_files_asked_for() {
    let mk = |commercial: Value, derivatives: Value, format: &str| {
        let m = &json!({"id": 1, "name": "m", "type": "LORA", "allowCommercialUse": commercial, "allowDerivatives": derivatives,
                "modelVersions": [{"id": 1, "baseModel": "Pony", "files": [{"id": 9, "name": "a", "sizeKB": 1.0, "metadata": {"format": format}}]}]});
        model(m, true).unwrap()
    };
    let mut p = params();
    p.licenses = vec!["sellImages".into(), "shareMerges".into()];
    assert!(keep(
        &mk(json!(["Image", "Rent"]), json!(true), "SafeTensor"),
        &p
    ));
    assert!(
        !keep(&mk(json!(["Image"]), json!(false), "SafeTensor"), &p),
        "no merges"
    );
    assert!(
        !keep(&mk(json!(["Rent"]), json!(true), "SafeTensor"), &p),
        "no image sales"
    );
    assert!(
        !keep(&mk(json!(["Image"]), Value::Null, "SafeTensor"), &p),
        "unknown is not allowed"
    );
    p.licenses.clear();
    assert!(
        keep(&mk(json!([]), Value::Null, "PickleTensor"), &p),
        "no filter keeps everything"
    );
    p.safetensors_only = true;
    assert!(!keep(&mk(json!([]), Value::Null, "PickleTensor"), &p));
    assert!(!keep(&mk(json!([]), Value::Null, "GGUF"), &p));
    assert!(keep(&mk(json!([]), Value::Null, "SafeTensor"), &p));
}

#[test]
fn query_maps_filters_to_api_names() {
    let q = query(&params());
    let has = |k: &str, v: &str| q.iter().any(|(a, b)| a == k && b == v);
    assert!(has("query", "cat"));
    assert!(has("types", "LORA") && has("types", "LoCon"));
    assert!(has("baseModels", "Illustrious") && has("baseModels", "Pony"));
    assert!(
        has("sort", "Newest")
            && has("period", "Week")
            && has("nsfw", "false")
            && has("cursor", "abc")
    );
}

#[test]
fn response_maps_to_the_frontend_shape() {
    let body = json!({
        "items": [{
            "id": 5, "name": "Cat LoRA", "type": "LORA", "nsfw": false, "description": "<p>d</p>",
            "tags": ["cat"], "creator": { "username": "me" },
            "stats": { "downloadCount": 10, "thumbsUpCount": 3, "rating": 4.5, "ratingCount": 2 },
            "allowCommercialUse": ["Image", "Rent"], "allowNoCredit": false,
            "modelVersions": [{
                "id": 77, "name": "v1", "baseModel": "SDXL 1.0", "publishedAt": "2024-01-02T03:04:05.000Z",
                "trainedWords": ["catstyle"], "images": [{"url":"https://image.civitai.com/a.jpeg","type":"image","nsfwLevel":1},{"url":"https://image.civitai.com/b.jpeg","type":"image","nsfwLevel":4},{"url":"https://image.civitai.com/c.mp4","type":"video","nsfwLevel":1}],
                "files": [{ "id": 9, "name": "cat.safetensors", "sizeKB": 1.5, "metadata": { "format": "SafeTensor", "fp": "fp16" } }]
            }]
        }, { "id": 6, "name": "Workflow", "type": "Workflows", "modelVersions": [] }],
        "metadata": { "nextCursor": "next" }
    });
    let r = map_response(&body, false);
    assert_eq!(r.next_cursor.as_deref(), Some("next"));
    assert_eq!(r.items.len(), 1);
    let m = &r.items[0];
    assert_eq!(
        (
            m.kind.as_str(),
            m.base_model.as_str(),
            m.commercial.as_str()
        ),
        ("LoRA", "SDXL 1.0", "limited")
    );
    assert_eq!(m.versions[0].files[0].id, "77-9");
    assert_eq!(m.versions[0].files[0].size_bytes, 1536);
    assert_eq!(m.trigger_words, vec!["catstyle"]);
    assert_eq!(m.image_urls, vec!["https://image.civitai.com/a.jpeg"]);
    assert_eq!(m.image_count, 1);
    assert_eq!(map_response(&body, true).items[0].image_count, 2);
    assert_eq!(m.created_at, 1704164645000);
    assert!(m.license.contains(&"Sell generated images".to_string()));
    assert!(m
        .license
        .contains(&"Use on generation services".to_string()));
    assert!(m.license.contains(&"Credit required".to_string()));
    assert_eq!(m.description, "d");
}

#[test]
fn html_descriptions_become_plain_text() {
    let html = "<p>Hello &amp; welcome</p><h3 id=\"x\"><span style=\"color:red\">Usage</span></h3><ul><li>one</li><li>two</li></ul><br/><br/><br/><p>end</p>";
    assert_eq!(html_to_text(html), "Hello & welcome\nUsage\none\ntwo\nend");
}

#[test]
fn permissions_follow_the_creator_flags() {
    let m = json!({
        "allowCommercialUse": ["Image", "RentCivit"],
        "allowDerivatives": true,
        "allowNoCredit": false
    });
    let got: Vec<(String, Option<bool>)> = permissions(&m)
        .into_iter()
        .map(|p| (p.key, p.allowed))
        .collect();
    let got: Vec<(&str, Option<bool>)> = got.iter().map(|(k, a)| (k.as_str(), *a)).collect();
    assert_eq!(
        got,
        vec![
            ("sellImages", Some(true)),
            ("generationServices", Some(false)),
            ("sellModel", Some(false)),
            ("shareMerges", Some(true)),
            ("differentLicense", None),
            ("noCredit", Some(false)),
        ]
    );
}

#[test]
fn commercial_use_levels() {
    let commercial =
        |allow: Value| commercial_of(&permissions(&json!({ "allowCommercialUse": allow })));
    assert_eq!(
        commercial(json!(["Image", "RentCivit", "Rent", "Sell"])),
        "allowed"
    );
    assert_eq!(commercial(json!(["Image", "Rent", "Sell"])), "allowed");
    assert_eq!(commercial(json!("None")), "denied");
    assert_eq!(commercial(json!([])), "denied");
    // Civitai's own service only is none of the three uses the list shows.
    assert_eq!(commercial(json!(["RentCivit"])), "denied");
    // Some of the three allowed and some not: a condition, never "allowed".
    assert_eq!(commercial(json!("Image")), "limited");
    assert_eq!(commercial(json!(["Image", "Sell"])), "limited");
    assert_eq!(commercial(json!(["Sell"])), "limited");
    assert_eq!(commercial(json!(["Rent", "Sell"])), "limited");
}

#[test]
fn a_summary_with_an_unstated_commercial_use_is_limited() {
    let p = |k: &str, allowed: Option<bool>| Permission {
        key: k.into(),
        allowed,
    };
    let yes = [
        p("sellImages", Some(true)),
        p("generationServices", Some(true)),
    ];
    assert_eq!(commercial_of(&yes), "limited");
    assert_eq!(
        commercial_of(&[yes[0].clone(), yes[1].clone(), p("sellModel", None)]),
        "limited"
    );
    assert_eq!(
        commercial_of(&[yes[0].clone(), yes[1].clone(), p("sellModel", Some(true))]),
        "allowed"
    );
}

#[test]
fn the_diffusion_kind_searches_checkpoints_of_the_video_bases() {
    let mut p = params();
    p.kind = "Diffusion".into();
    p.base_model = "all".into();
    let q = query(&p);
    let has = |k: &str, v: &str| q.iter().any(|(a, b)| a == k && b == v);
    assert!(has("types", "Checkpoint") && !has("types", "LORA"));
    assert!(has("baseModels", "Wan Video 2.2 I2V-A14B") && has("baseModels", "Hunyuan Video"));
    assert!(is_diffusion_base("Wan Video 14B i2v 720p") && !is_diffusion_base("SDXL 1.0"));
}

#[test]
fn a_version_gives_its_first_plain_picture_and_its_trigger_words() {
    let v = serde_json::json!({
        "images": [
            { "type": "video", "url": "https://image.civitai.com/k/u/original=true/0.mp4" },
            { "type": "image", "nsfwLevel": 4, "url": "https://image.civitai.com/k/u/original=true/1.jpeg" },
            { "type": "image", "nsfwLevel": 1, "url": "https://image.civitai.com/k/u/original=true/2.jpeg" }
        ],
        "trainedWords": [" fujita kotone ", "", "idol"]
    });
    assert_eq!(
        cover_of_version(&v).as_deref(),
        Some("https://image.civitai.com/k/u/width=512/2.jpeg")
    );
    assert_eq!(trigger_words(&v), vec!["fujita kotone", "idol"]);
    assert_eq!(cover_of_version(&serde_json::json!({})), None);
    // A version with mature pictures only still gets one, marked as mature; a plain one wins when there is one.
    let mature = serde_json::json!({"images": [
        { "type": "video", "nsfwLevel": 4, "url": "https://image.civitai.com/k/u/original=true/0.mp4" },
        { "type": "image", "nsfwLevel": 4, "url": "https://image.civitai.com/k/u/original=true/1.jpeg" },
        { "type": "image", "nsfwLevel": 16, "url": "https://image.civitai.com/k/u/original=true/2.jpeg" }
    ]});
    assert_eq!(cover_of_version(&mature), None);
    assert_eq!(
        cover_with_maturity(&mature),
        Some((
            "https://image.civitai.com/k/u/width=512/1.jpeg".to_string(),
            true
        ))
    );
    assert_eq!(
        cover_with_maturity(&v),
        Some((
            "https://image.civitai.com/k/u/width=512/2.jpeg".to_string(),
            false
        ))
    );
    assert_eq!(
        cover_with_maturity(&serde_json::json!({"images": []})),
        None
    );
}

#[test]
fn a_version_with_only_videos_is_shown_by_their_first_frames() {
    let only_videos = serde_json::json!({"images": [
        { "type": "video", "nsfwLevel": 4, "url": "https://image.civitai.com/k/u/original=true/0.mp4" },
        { "type": "video", "nsfwLevel": 1, "url": "https://image.civitai.com/k/v/original=true/1.mp4" },
        { "type": "video", "nsfwLevel": 1, "url": "https://image.civitai.com/k/w/0.mp4" }
    ]});
    let frame = "https://image.civitai.com/k/v/anim=false,width=512/1.mp4";
    assert_eq!(image_urls(&only_videos, false), vec![frame.to_string()]);
    assert_eq!(cover_of_version(&only_videos).as_deref(), Some(frame));
    assert_eq!(
        cover_with_maturity(&only_videos),
        Some((frame.to_string(), false))
    );
    // Mature videos count like mature pictures: shown only when asked for, and only as the last resort for a cover.
    let all_mature = serde_json::json!({"images": [
        { "type": "video", "nsfwLevel": 8, "url": "https://image.civitai.com/k/u/original=true/0.mp4" }
    ]});
    assert!(image_urls(&all_mature, false).is_empty());
    assert_eq!(cover_of_version(&all_mature), None);
    assert_eq!(
        cover_with_maturity(&all_mature),
        Some((
            "https://image.civitai.com/k/u/anim=false,width=512/0.mp4".to_string(),
            true
        ))
    );
}

#[test]
fn pictures_come_before_the_frames_of_videos() {
    let v = serde_json::json!({"images": [
        { "type": "video", "url": "https://image.civitai.com/k/u/original=true/0.mp4" },
        { "type": "image", "url": "https://image.civitai.com/k/u/original=true/1.jpeg" }
    ]});
    assert_eq!(
        image_urls(&v, false),
        vec![
            "https://image.civitai.com/k/u/width=512/1.jpeg".to_string(),
            "https://image.civitai.com/k/u/anim=false,width=512/0.mp4".to_string()
        ]
    );
}

#[test]
fn full_size_covers_are_swapped_for_resized_ones() {
    assert_eq!(
        thumbnail_url("https://image.civitai.com/k/u/original=true/1.jpeg"),
        "https://image.civitai.com/k/u/width=512/1.jpeg"
    );
    assert_eq!(
        thumbnail_url("https://image.civitai.com/k/u/width=450/1.jpeg"),
        "https://image.civitai.com/k/u/width=450/1.jpeg"
    );
}

#[test]
fn the_pictures_to_page_through_and_the_model_page_come_from_the_version() {
    let v = serde_json::json!({"id": 22, "modelId": 11, "images": [
        { "type": "image", "nsfwLevel": 1, "url": "https://image.civitai.com/k/u/original=true/0.jpeg" },
        { "type": "image", "nsfwLevel": 4, "url": "https://image.civitai.com/k/u/original=true/1.jpeg" },
        { "type": "image", "nsfwLevel": 2, "url": "https://image.civitai.com/k/u/original=true/2.jpeg" }
    ]});
    // Mature pictures stay out while a plain one exists, and the cover is the first of them.
    assert_eq!(
        cover_set(&v),
        vec![
            "https://image.civitai.com/k/u/width=512/0.jpeg",
            "https://image.civitai.com/k/u/width=512/2.jpeg"
        ]
    );
    assert_eq!(cover_set(&v).first().cloned(), cover_of_version(&v));
    assert_eq!(
        page_url(&v).as_deref(),
        Some("https://civitai.com/models/11?modelVersionId=22")
    );
    // Only mature pictures: all of them, as the cover does; no pictures: none; ids missing: no page.
    let mature = serde_json::json!({"images": [
        { "type": "image", "nsfwLevel": 4, "url": "https://image.civitai.com/k/u/original=true/1.jpeg" },
        { "type": "image", "nsfwLevel": 8, "url": "https://image.civitai.com/k/u/original=true/2.jpeg" }
    ]});
    assert_eq!(cover_set(&mature).len(), 2);
    assert!(cover_set(&serde_json::json!({})).is_empty());
    assert_eq!(page_url(&mature), None);
    // At most eight.
    let many = serde_json::json!({"images": (0..12).map(|i| serde_json::json!(
        { "type": "image", "nsfwLevel": 1, "url": format!("https://image.civitai.com/k/u/original=true/{i}.jpeg") })).collect::<Vec<_>>()});
    assert_eq!(cover_set(&many).len(), 8);
}
