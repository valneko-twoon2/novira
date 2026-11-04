use super::*;
use serde_json::json;

fn image(id: u64, meta: Value) -> Value {
    json!({"id": id, "url": format!("https://image.civitai.com/x/abc/original=true/{id}.jpeg"), "type": "image", "nsfwLevel": "None", "meta": meta})
}

#[test]
fn a_picture_made_on_a_site_with_civitai_resources_gives_every_setting() {
    // The shape Civitai answers for a picture of a LoRA (taken from the live API).
    let body = json!({"items": [image(94080991, json!({
        "Size": "512x768", "seed": 746810293, "steps": 25, "prompt": "a hiker", "sampler": "DPM++ 2M Karras",
        "cfgScale": 7, "clipSkip": 2, "resources": [], "negativePrompt": "blurry",
        "civitaiResources": [
            {"type": "checkpoint", "modelVersionId": 128713, "modelVersionName": "8"},
            {"type": "lora", "weight": 0.65, "modelVersionId": 249861}
        ]
    }))]});
    let s = &map_samples(&body)[0];
    assert_eq!(s.id, "94080991");
    assert_eq!(
        s.image_url,
        "https://image.civitai.com/x/abc/width=512/94080991.jpeg"
    );
    assert_eq!(s.prompt, "a hiker");
    assert_eq!(s.negative_prompt.as_deref(), Some("blurry"));
    assert_eq!(
        (s.seed, s.steps, s.cfg_scale, s.clip_skip),
        (Some(746810293), Some(25), Some(7.0), Some(2))
    );
    assert_eq!((s.width, s.height), (Some(512), Some(768)));
    assert_eq!(s.sampler.as_deref(), Some("DPM++ 2M Karras"));
    assert_eq!(s.resources.len(), 2);
    assert_eq!(s.resources[0].kind, "checkpoint");
    assert_eq!(s.resources[0].version_id.as_deref(), Some("128713"));
    assert_eq!(s.resources[1].kind, "lora");
    assert_eq!(s.resources[1].weight, Some(0.65));
}

#[test]
fn a_picture_made_on_civitai_names_its_checkpoint_as_an_air_address_and_its_size_as_numbers() {
    let body = json!({"items": [image(91402089, json!({
        "Model": "urn:air:sd1:checkpoint:civitai:4384@128713", "width": 512, "height": 640, "prompt": "p", "steps": 27,
        "models": ["urn:air:sd1:checkpoint:civitai:4384@128713"], "civitaiResources": []
    }))]});
    let s = &map_samples(&body)[0];
    assert_eq!((s.width, s.height), (Some(512), Some(640)));
    assert_eq!(s.resources.len(), 1);
    assert_eq!(s.resources[0].kind, "checkpoint");
    assert_eq!(s.resources[0].version_id.as_deref(), Some("128713"));
}

#[test]
fn older_pictures_list_resources_by_name() {
    let body = json!({"items": [image(1, json!({
        "prompt": "p", "Model": "Some Merge v2",
        "resources": [{"name": "detail-lora", "type": "lora", "weight": 0.8}, {"type": "lora"}]
    }))]});
    let s = &map_samples(&body)[0];
    // The nameless entry is dropped, and the plain model name becomes the checkpoint.
    assert_eq!(s.resources.len(), 2);
    assert_eq!(s.resources[0].kind, "checkpoint");
    assert_eq!(s.resources[0].name.as_deref(), Some("Some Merge v2"));
    assert_eq!(s.resources[1].name.as_deref(), Some("detail-lora"));
    assert_eq!(s.resources[1].weight, Some(0.8));
}

#[test]
fn a_picture_without_meta_or_a_prompt_is_left_out() {
    let body = json!({"items": [
        {"id": 1, "url": "https://image.civitai.com/a/original=true/1.jpeg", "type": "image", "meta": null},
        image(2, json!({"prompt": "   ", "steps": 20})),
        image(3, json!({"steps": 20})),
        image(4, json!({"prompt": "ok"})),
    ]});
    let ids: Vec<_> = map_samples(&body).into_iter().map(|s| s.id).collect();
    assert_eq!(ids, ["4"]);
}

#[test]
fn a_video_and_a_repeated_picture_are_left_out() {
    let mut video = image(5, json!({"prompt": "p"}));
    video["type"] = json!("video");
    let body = json!({"items": [video, image(6, json!({"prompt": "p"})), image(6, json!({"prompt": "again"}))]});
    let found = map_samples(&body);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].prompt, "p");
}

#[test]
fn values_out_of_range_or_of_the_wrong_kind_are_dropped_not_trusted() {
    let body = json!({"items": [image(7, json!({
        "prompt": "p", "steps": 100000, "cfgScale": 1000, "clipSkip": 99, "seed": -5,
        "Size": "99999x10", "sampler": "  ", "negativePrompt": ""
    }))]});
    let s = &map_samples(&body)[0];
    assert_eq!(
        (s.steps, s.cfg_scale, s.clip_skip, s.seed),
        (None, None, None, None)
    );
    assert_eq!((s.width, s.height), (None, None));
    assert_eq!(
        (s.sampler.as_deref(), s.negative_prompt.as_deref()),
        (None, None)
    );
}

#[test]
fn numbers_written_as_text_are_read() {
    let body = json!({"items": [image(8, json!({"prompt": "p", "steps": "30", "cfgScale": "4.5", "seed": "123", "Size": " 832 x 1216 "}))]});
    let s = &map_samples(&body)[0];
    assert_eq!(
        (s.steps, s.cfg_scale, s.seed),
        (Some(30), Some(4.5), Some(123))
    );
    assert_eq!((s.width, s.height), (Some(832), Some(1216)));
}

#[test]
fn a_size_with_only_one_side_is_dropped() {
    let body = json!({"items": [image(9, json!({"prompt": "p", "width": 512}))]});
    let s = &map_samples(&body)[0];
    assert_eq!((s.width, s.height), (None, None));
}

#[test]
fn the_resources_of_one_picture_are_capped() {
    let many: Vec<Value> = (1..=40)
        .map(|i| json!({"type": "lora", "modelVersionId": i, "weight": 1}))
        .collect();
    let body = json!({"items": [image(10, json!({"prompt": "p", "civitaiResources": many}))]});
    assert_eq!(map_samples(&body)[0].resources.len(), 16);
}

#[test]
fn air_addresses_give_their_kind_and_version() {
    assert_eq!(
        air("urn:air:sdxl:lora:civitai:1234@5678"),
        Some(("lora".into(), "5678".into()))
    );
    assert_eq!(
        air("urn:air:sd1:checkpoint:civitai:4384@128713"),
        Some(("checkpoint".into(), "128713".into()))
    );
    assert_eq!(air("urn:air:sd1:checkpoint:civitai:4384"), None);
    assert_eq!(air("urn:air:sd1:checkpoint:civitai:4384@12ab"), None);
    assert_eq!(air("Some Model"), None);
}

#[test]
fn the_query_asks_for_the_plain_examples_and_the_mature_ones_only_when_allowed() {
    let plain = queries("128713", false);
    assert_eq!(plain.len(), 1);
    let get =
        |q: &Vec<(String, String)>, k: &str| q.iter().find(|(n, _)| n == k).map(|(_, v)| v.clone());
    assert_eq!(get(&plain[0], "modelVersionId").as_deref(), Some("128713"));
    assert_eq!(get(&plain[0], "withMeta").as_deref(), Some("true"));
    assert_eq!(get(&plain[0], "nsfw").as_deref(), Some("None"));
    let both = queries("128713", true);
    assert_eq!(both.len(), 2);
    assert_eq!(get(&both[1], "nsfw").as_deref(), Some("true"));
}

#[test]
fn a_version_id_is_digits_only_and_short() {
    assert!(is_version_id("128713"));
    assert!(is_version_id("123456789012"));
    for bad in [
        "",
        "1234567890123",
        "12a",
        "1 2",
        "../1",
        "1&nsfw=true",
        "-1",
        "１２",
    ] {
        assert!(!is_version_id(bad), "{bad:?}");
    }
}
