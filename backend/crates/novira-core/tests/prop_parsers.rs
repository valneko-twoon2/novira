//! Fuzz-style property tests for every parser that reads data from outside the process: Civitai and Hugging Face
//! answers, model headers, ComfyUI messages, picture and audio bytes, saved settings and secrets, the assistant's
//! answer and tool calls, hardware reports. Generated strings, bytes and JSON go in; the result must be a value or an error, never
//! a panic, and where a rule is stated (limits, checked tool arguments, monotonic filter) it must hold.
//! In process only; the files are in temporary folders. Run: `cargo test -p novira-core --test prop_parsers`.
mod prop_common;

use novira_core::agent::parse_reply;
use novira_core::agent::tools::{check_call, TOOLS};
use novira_core::backup::check_ui_state;
use novira_core::comfy::client::{output_text, parse_preview, parse_ws_text, prompt_error_text};
use novira_core::comfy::node_packs::{constraints, parse_gitmodules};
use novira_core::hardware::{parse_adapters, parse_nvidia_smi};
use novira_core::media::audio;
use novira_core::media::export::{target_size, validate, ExportOptions, MAX_SIDE, MIN_SIDE};
use novira_core::media::images::{
    check_limits, read_text, sniff_content_type, to_png, with_text, MAX_IMAGE_PIXELS,
    MAX_IMAGE_SIDE,
};
use novira_core::models::civitai::{self, SearchParams};
use novira_core::models::classify::{
    detect_base, detect_format, detect_kind, kind_from_name, parse_header, read_header_unchecked,
    Header,
};
use novira_core::models::content_filter::looks_adult;
use novira_core::models::huggingface;
use novira_core::models::registry::key_for;
use novira_core::secret::{load_civitai_key, save_civitai_key};
use novira_core::settings::Settings;
use novira_core::types::{ModelType, SavedWorkflow};
use novira_core::voice::{libraries_from_report, wanted_files};
use prop_common::{any_text, bytes, check, check_up_to, json_object, json_value};
use proptest::prelude::*;
use serde_json::{json, Map, Value};

fn search_params() -> impl Strategy<Value = SearchParams> {
    (any_text(), any_text(), any_text(), any_text(), any_text(), any::<bool>(), prop::option::of(any_text()), any_text()).prop_map(
        |(query, kind, base_model, sort, period, include_nsfw, cursor, source)| {
            serde_json::from_value(json!({
                "query": query, "kind": kind, "baseModel": base_model, "sort": sort, "period": period,
                "includeNsfw": include_nsfw, "cursor": cursor, "source": source
            }))
            .unwrap()
        },
    )
}

#[test]
fn civitai_answers_of_any_shape_are_mapped_or_ignored() {
    check((json_object(), any::<bool>()), |(body, nsfw)| {
        let result = civitai::map_response(&body, nsfw);
        let offered = body["items"].as_array().map_or(0, Vec::len);
        prop_assert!(result.items.len() <= offered);
        Ok(())
    });
}

#[test]
fn civitai_pieces_of_any_shape_never_panic() {
    check(
        (json_value(), any_text(), search_params()),
        |(v, text, params)| {
            let _ = civitai::permissions(&v);
            let _ = civitai::license_of_model(&v);
            let _ = civitai::commercial_of(&civitai::permissions(&v));
            let _ = civitai::cover_of_version(&v);
            let _ = civitai::trigger_words(&v);
            let _ = civitai::html_to_text(&text);
            let _ = civitai::is_diffusion_base(&text);
            let q = civitai::query(&params);
            prop_assert!(q.iter().all(|(k, _)| !k.is_empty()));
            Ok(())
        },
    );
}

#[test]
fn hugging_face_answers_of_any_shape_are_mapped_or_ignored() {
    check(
        (
            json_value(),
            any::<bool>(),
            any_text(),
            prop::option::of(any_text()),
            search_params(),
        ),
        |(body, nsfw, text, link, params)| {
            let models = huggingface::map_response(&body, nsfw);
            prop_assert!(models.len() <= body.as_array().map_or(0, Vec::len));
            let _ = huggingface::model_files(&body);
            let _ = huggingface::next_cursor(link.as_deref());
            let _ = huggingface::next_cursor(Some(&text));
            let _ = huggingface::license_of_tag(Some(&text));
            let _ = huggingface::permissions(Some(&text));
            let _ = civitai::commercial_of(&huggingface::permissions(Some(&text)));
            let _ = huggingface::query(&params);
            Ok(())
        },
    );
}

#[test]
fn an_adult_judgement_never_turns_off_when_more_evidence_is_added() {
    fn tags() -> impl Strategy<Value = Vec<String>> {
        prop::collection::vec(any_text(), 0..4)
    }
    check(
        (any_text(), tags(), json_object(), tags(), any_text()),
        |(id, tags, card, more, extra)| {
            let before = looks_adult(&id, &tags, &card);
            let mut all = tags.clone();
            all.extend(more);
            let with_tags = looks_adult(&id, &all, &card);
            prop_assert!(
                !before || with_tags,
                "adding tags turned it off: {:?} {:?}",
                id,
                tags
            );
            // The author-set tag always decides, whatever else is there.
            let mut flagged = tags;
            flagged.push("not-for-all-audiences".into());
            let longer = format!("{}{}", id, extra);
            prop_assert!(looks_adult(&longer, &flagged, &card));
            Ok(())
        },
    );
}

/// What `parse_header` must give: the header parsed as one `serde_json::Map`, `__metadata__` removed from it (how it
/// was read before the one-pass reader).
fn header_through_a_map(bytes: &[u8]) -> Option<Header> {
    let mut map: Map<String, Value> = serde_json::from_slice(bytes).ok()?;
    let metadata = match map.remove("__metadata__") {
        Some(Value::Object(m)) => m,
        _ => Map::new(),
    };
    let shapes = map
        .iter()
        .filter(|(k, _)| {
            ["patch_embedding.weight", "img_in.proj.weight"]
                .iter()
                .any(|end| k.ends_with(end))
                || [
                    "",
                    "model.diffusion_model.",
                    "diffusion_model.",
                    "transformer.",
                ]
                .iter()
                .any(|p| [format!("{p}img_in.weight"), format!("{p}txt_in.weight")].contains(k))
        })
        .filter_map(|(k, v)| {
            let dims = v["shape"].as_array()?;
            Some((k.clone(), dims.iter().filter_map(Value::as_u64).collect()))
        })
        .collect();
    Some(Header {
        keys: map.into_iter().map(|(k, _)| k).collect(),
        metadata,
        shapes,
    })
}

/// A header's JSON text written entry by entry, so a name can come twice, with names that `parse_header` treats apart.
fn header_text() -> impl Strategy<Value = String> {
    let name = prop_oneof![
        Just("__metadata__".to_string()),
        Just("blocks.0.patch_embedding.weight".to_string()),
        Just("model.diffusion_model.img_in.weight".to_string()),
        Just("txt_in.weight".to_string()),
        "[a-z._]{0,6}",
        any_text(),
    ];
    let tensor = prop::collection::vec(any::<u64>(), 0..4)
        .prop_map(|shape| json!({ "dtype": "BF16", "shape": shape, "data_offsets": [0, 2] }));
    let value = prop_oneof![2 => tensor, 1 => json_value()];
    prop::collection::vec((name, value), 0..8).prop_map(|entries| {
        let body: Vec<String> = entries
            .iter()
            .map(|(k, v)| format!("{}:{}", Value::String(k.clone()), v))
            .collect();
        format!("{{{}}}", body.join(","))
    })
}

#[test]
fn a_model_header_reads_as_it_does_through_a_json_map() {
    // The text as written, and with one byte changed (broken JSON, broken UTF-8) at a generated place.
    check(
        (header_text(), any::<usize>(), any::<u8>()),
        |(text, at, byte)| {
            let bytes = text.as_bytes();
            prop_assert_eq!(parse_header(bytes), header_through_a_map(bytes));
            let mut changed = bytes.to_vec();
            if !changed.is_empty() {
                let at = at % changed.len();
                changed[at] = byte;
            }
            prop_assert_eq!(parse_header(&changed), header_through_a_map(&changed));
            Ok(())
        },
    );
}

#[test]
fn a_model_header_of_any_bytes_is_read_or_refused() {
    check((bytes(512), any_text()), |(data, name)| {
        if let Some(h) = parse_header(&data) {
            prop_assert!(!h.keys.iter().any(|k| k == "__metadata__"));
            let kind = detect_kind(&h);
            if let Some(kind) = kind {
                let _ = detect_base(kind, Some(&h), &name);
            }
        }
        let _ = kind_from_name(&name);
        for kind in [
            ModelType::Main,
            ModelType::Lora,
            ModelType::Vae,
            ModelType::Controlnet,
        ] {
            let _ = detect_base(kind, None, &name);
            let _ = detect_format(kind, std::path::Path::new(&name));
        }
        Ok(())
    });
}

#[test]
fn a_safetensors_file_of_any_bytes_is_read_or_refused() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("m.safetensors");
    // The first eight bytes are the header length: mostly small, sometimes huge or wrong.
    let length = prop_oneof![
        0u64..64,
        Just(u64::MAX),
        Just(64 * 1024 * 1024 + 1),
        any::<u64>()
    ];
    check((length, bytes(300)), |(len, body)| {
        let mut file = len.to_le_bytes().to_vec();
        file.extend_from_slice(&body);
        std::fs::write(&path, file).unwrap();
        let _ = read_header_unchecked(&path);
        let _ = novira_core::models::classify::read_header(&path);
        Ok(())
    });
}

#[test]
fn model_keys_do_not_depend_on_the_path_separator() {
    check((any_text(), any_text()), |(folder, name)| {
        let a = key_for(ModelType::Lora, &folder, &name);
        prop_assert_eq!(
            &a,
            &key_for(ModelType::Lora, &folder, &name.replace('\\', "/"))
        );
        prop_assert!(
            a.starts_with("lora-") && a.len() == "lora-".len() + 12,
            "{a}"
        );
        Ok(())
    });
}

#[test]
fn engine_messages_of_any_shape_are_understood_or_ignored() {
    check(
        (any_text(), any_text(), bytes(64), json_value(), any_text()),
        |(text, id, frame, v, node)| {
            let _ = parse_ws_text(&text, &id);
            let _ = parse_preview(&frame);
            let _ = prompt_error_text(&v);
            let _ = output_text(&v, &node);
            let as_message = json!({ "type": "progress", "data": { "prompt_id": id, "node": node, "value": v.clone(), "max": v } });
            let _ = parse_ws_text(&as_message.to_string(), &id);
            Ok(())
        },
    );
}

#[test]
fn a_preview_frame_is_a_data_url_or_nothing() {
    check(bytes(200), |frame| {
        if let Some(url) = parse_preview(&frame) {
            prop_assert!(url.starts_with("data:image/"), "{url}");
        }
        Ok(())
    });
}

#[test]
fn hardware_reports_of_any_text_are_read_or_refused() {
    check(
        (any_text(), any_text(), any_text()),
        |(out, sizes, names)| {
            let _ = parse_adapters(&sizes, &names);
            let _ = parse_nvidia_smi(&out);
            let _ = parse_nvidia_smi(&format!("{names}, {}", out.len()));
            Ok(())
        },
    );
}

#[test]
fn text_and_json_reports_of_any_shape_never_panic() {
    check(
        (any_text(), json_value(), json_value()),
        |(text, report, tree)| {
            let _ = constraints(&text);
            let _ = parse_gitmodules(&text);
            let _ = libraries_from_report(&report);
            let _ = wanted_files(&tree);
            let _ = check_ui_state(&text);
            Ok(())
        },
    );
}

#[test]
fn a_saved_screen_state_is_accepted_only_as_prefixed_keys() {
    check(
        prop::collection::vec((any_text(), any_text()), 0..5),
        |entries| {
            let map: serde_json::Map<String, Value> = entries
                .into_iter()
                .map(|(k, v)| (k, Value::String(v)))
                .collect();
            let text = Value::Object(map.clone()).to_string();
            if check_ui_state(&text).is_ok() {
                prop_assert!(map.keys().all(|k| k.starts_with("novira")), "{map:?}");
            }
            Ok(())
        },
    );
}

#[test]
fn an_assistant_answer_becomes_bounded_text_and_thoughts() {
    check(any_text(), |text| {
        let wrapped = format!("<thoughts>{text}</thoughts>{text}");
        for answer in [text.as_str(), wrapped.as_str()] {
            let reply = parse_reply(answer);
            prop_assert!(reply.thoughts.len() <= 8);
            prop_assert!(reply
                .thoughts
                .iter()
                .all(|t| !t.is_empty() && t.chars().count() <= 300));
            prop_assert!(reply.text.chars().count() <= 20_000);
        }
        Ok(())
    });
}

/// A call: a known or unknown tool name with arguments of any shape, often near the tools' own fields.
fn tool_call() -> impl Strategy<Value = (String, Value)> {
    let names: Vec<String> = TOOLS
        .iter()
        .map(|t| t.name.to_string())
        .chain(["delete_images".to_string()])
        .collect();
    let near = prop_oneof![
        json_value(),
        (json_value(), json_value()).prop_map(|(a, b)| json!({"key": a, "weight": b})),
        (json_value(), json_value()).prop_map(|(a, b)| json!({"steps": a, "width": b})),
        prop::collection::vec(json_value(), 0..5).prop_map(|ops| json!({ "ops": ops })),
    ];
    (prop::sample::select(names), near)
}

#[test]
fn a_tool_call_is_accepted_only_with_arguments_its_schema_allows() {
    check(tool_call(), |(name, args)| {
        let Ok(call) = check_call(&name, Some(&args)) else {
            return Ok(());
        };
        prop_assert!(call.args.is_object(), "{}", call.args);
        prop_assert_ne!(call.tool, "delete_images");
        match call.tool {
            "add_lora" => {
                let w = call.args["weight"].as_f64().unwrap_or(1.0);
                prop_assert!((-1.0..=2.0).contains(&w), "{w}");
            }
            "set_generation_settings" => {
                let steps = call.args["steps"].as_i64().unwrap_or(1);
                prop_assert!((1..=150).contains(&steps), "{steps}");
                let width = call.args["width"].as_i64().unwrap_or(64);
                prop_assert!((64..=4096).contains(&width), "{width}");
            }
            "edit_comic" | "edit_text" | "edit_workflow" => {
                let ops = call.args["ops"].as_array().unwrap();
                prop_assert!(!ops.is_empty() && ops.len() <= 400);
                prop_assert!(ops
                    .iter()
                    .all(|o| o["op"].as_str().is_some_and(|n| !n.is_empty())));
            }
            _ => {}
        }
        Ok(())
    });
}

/// A small valid PNG; the property tests damage or enlarge it.
fn tiny_png(w: u32, h: u32) -> Vec<u8> {
    let img = image::RgbImage::from_pixel(w, h, image::Rgb([10, 20, 30]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

/// The PNG with its IHDR rewritten to claim another size (and a matching CRC), pixels left as they are.
fn png_claiming(w: u32, h: u32) -> Vec<u8> {
    let mut png = tiny_png(2, 2);
    png[16..20].copy_from_slice(&w.to_be_bytes());
    png[20..24].copy_from_slice(&h.to_be_bytes());
    let mut crc = crc32fast::Hasher::new();
    crc.update(&png[12..29]);
    png[29..33].copy_from_slice(&crc.finalize().to_be_bytes());
    png
}

#[test]
fn a_picture_that_declares_a_huge_canvas_is_refused_before_decoding() {
    check(
        (any::<u32>(), any::<u32>(), 0u32..40_000),
        |(w, h, small)| {
            for (w, h) in [(w, h), (small, small), (w, 1), (1, h)] {
                let result = check_limits(&png_claiming(w, h));
                let too_big = w > MAX_IMAGE_SIDE
                    || h > MAX_IMAGE_SIDE
                    || u64::from(w) * u64::from(h) > MAX_IMAGE_PIXELS;
                if too_big {
                    prop_assert!(result.is_err(), "{w}x{h} was accepted");
                    prop_assert!(to_png(&png_claiming(w, h)).is_err());
                }
            }
            Ok(())
        },
    );
}

#[test]
fn damaged_picture_bytes_are_read_or_refused() {
    let flip = prop::collection::vec((any::<prop::sample::Index>(), any::<u8>()), 0..6);
    check(
        (flip, any::<prop::sample::Index>(), bytes(64), any_text()),
        |(flips, cut, noise, key)| {
            let mut png = tiny_png(5, 4);
            for (at, value) in flips {
                let i = at.index(png.len());
                png[i] = value;
            }
            png.truncate(cut.index(png.len() + 1));
            png.extend_from_slice(&noise);
            let _ = check_limits(&png);
            let _ = to_png(&png);
            let _ = read_text(&png, &key);
            let _ = with_text(&png, &key, "value");
            prop_assert!(sniff_content_type(&png).contains('/'));
            let _ = audio::sniff(&png);
            Ok(())
        },
    );
}

#[test]
fn arbitrary_bytes_are_not_a_picture_the_app_keeps() {
    check(bytes(300), |data| {
        if let Ok(png) = to_png(&data) {
            prop_assert!(image::load_from_memory(&png).is_ok());
        }
        let _ = check_limits(&data);
        let _ = audio::sniff(&data);
        Ok(())
    });
}

#[test]
fn a_text_chunk_written_into_a_png_reads_back_and_the_picture_still_decodes() {
    let png = tiny_png(4, 3);
    check(
        ("[A-Za-z0-9_.-]{1,24}", any::<String>(), any::<String>()),
        |(key, value, other)| {
            let written = with_text(&png, &key, &value).expect("a valid PNG takes a text chunk");
            prop_assert_eq!(read_text(&written, &key), Some(value.clone()));
            let again = with_text(&written, &key, &other).unwrap();
            prop_assert_eq!(read_text(&again, &key), Some(other));
            let decoded = image::load_from_memory(&again).unwrap();
            prop_assert_eq!((decoded.width(), decoded.height()), (4, 3));
            Ok(())
        },
    );
}

#[test]
fn audio_of_any_bytes_gets_a_waveform_picture() {
    check(bytes(400), |data| {
        let png = audio::waveform_png(&data);
        prop_assert!(png.starts_with(&[0x89, b'P', b'N', b'G']));
        Ok(())
    });
}

#[test]
fn export_options_are_checked_and_the_copy_never_grows() {
    check(
        (
            any::<u8>(),
            prop::option::of(any::<u32>()),
            1u32..20_000,
            1u32..20_000,
        ),
        |(quality, max_side, w, h)| {
            let options: ExportOptions = serde_json::from_value(json!({ "format": "png", "quality": quality, "maxSide": max_side, "removeInfo": false })).unwrap();
            let valid = (1..=100).contains(&quality)
                && max_side.is_none_or(|s| (MIN_SIDE..=MAX_SIDE).contains(&s));
            prop_assert_eq!(validate(&options).is_ok(), valid);
            if valid {
                let (tw, th) = target_size(w, h, max_side);
                prop_assert!(tw >= 1 && th >= 1 && tw <= w.max(MAX_SIDE) && th <= h.max(MAX_SIDE));
                prop_assert!(
                    tw.max(th) <= w.max(h),
                    "the copy grew: {w}x{h} -> {tw}x{th}"
                );
                if let Some(max) = max_side {
                    prop_assert!(tw.max(th) <= max.max(w.max(h).min(max)));
                }
            }
            Ok(())
        },
    );
}

#[test]
fn settings_of_any_bytes_are_loaded_or_refused_and_saving_a_key_keeps_the_others() {
    let dir = tempfile::tempdir().unwrap();
    check(
        (bytes(200), "[a-zA-Z]{1,8}", json_value()),
        |(data, key, value)| {
            std::fs::write(dir.path().join("settings.json"), &data).unwrap();
            let _ = Settings::load(dir.path());
            let saved = Settings::save_key(dir.path(), &key, value.clone());
            if saved.is_ok() {
                let doc: Value = serde_json::from_slice(
                    &std::fs::read(dir.path().join("settings.json")).unwrap(),
                )
                .unwrap();
                prop_assert_eq!(&doc[&key], &value);
            } else {
                // A broken file is left untouched.
                prop_assert_eq!(
                    std::fs::read(dir.path().join("settings.json")).unwrap(),
                    data
                );
            }
            Ok(())
        },
    );
}

#[test]
fn a_saved_secret_of_any_bytes_is_read_or_refused_and_a_saved_key_reads_back() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("secrets");
    check_up_to(64, (bytes(120), any_text()), |(data, key)| {
        std::fs::create_dir_all(&file).unwrap();
        // Whatever an earlier version's file holds, loading it answers; it never takes the process down.
        std::fs::write(file.join("civitai.key"), &data).unwrap();
        let _ = load_civitai_key(dir.path());
        // A real round trip: the trimmed key comes back, a blank one removes it.
        save_civitai_key(dir.path(), Some(&key)).unwrap();
        let back = load_civitai_key(dir.path()).unwrap();
        if key.trim().is_empty() {
            prop_assert_eq!(back, None);
        } else {
            prop_assert_eq!(back.as_deref(), Some(key.trim()));
        }
        Ok(())
    });
    // The keys of the folder leave the Credential Manager with it.
    save_civitai_key(dir.path(), None).unwrap();
}

#[test]
fn a_saved_workflow_of_any_shape_is_read_or_refused() {
    check(json_value(), |v| {
        if let Ok(w) = serde_json::from_value::<SavedWorkflow>(v) {
            let again: SavedWorkflow =
                serde_json::from_value(serde_json::to_value(&w).unwrap()).unwrap();
            prop_assert_eq!(again, w);
        }
        Ok(())
    });
}

/// Found by probing the numeric parsers with the extremes of their types and fixed: these overflowed `u64`/`u32` arithmetic
/// (a panic in a debug build, a silently wrong number in a release build). Each is pinned with its smallest input.
#[test]
fn a_graphics_card_reporting_an_enormous_memory_size_does_not_overflow() {
    let card = parse_nvidia_smi("GPU, 17592186044416").unwrap();
    assert_eq!(card.vram_bytes, Some(u64::MAX));
    let card = parse_nvidia_smi("GPU, 24576").unwrap();
    assert_eq!(card.vram_bytes, Some(24576 * 1024 * 1024));
}

#[test]
fn a_progress_message_with_an_enormous_step_does_not_overflow() {
    let passes = vec![("3".to_string(), 10u32)];
    let shown =
        novira_core::comfy::client::shown_progress(&passes, 20, 0, Some("3"), u32::MAX, u32::MAX);
    assert_eq!(shown, (20, 20));
}
