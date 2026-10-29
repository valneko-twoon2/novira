//! Property tests for the reader of ComfyUI's own interface scripts (`comfy::ui_locale`): the text comes from a
//! downloaded web page and its scripts, so it is untrusted. Whatever it holds, the finders may only return names of
//! files inside the assets folder, and the reader of the data modules must refuse or read, never panic.
//! In process only. Run: `cargo test -p novira-core --test prop_ui_locale`.
mod prop_common;

use novira_core::comfy::ui_locale::{
    comfy_language, entry_script, i18n_script, locale_scripts, parse_module, read_locale,
};
use prop_common::{any_text, check, json_value};
use proptest::prelude::*;
use serde_json::{Map, Value};

/// An independent statement of the rule: letters, digits, `-`, `_`, `.`; ends in `.js`; no leading dot.
fn is_plain_script_name(name: &str) -> bool {
    name.ends_with(".js")
        && !name.starts_with('.')
        && !name.is_empty()
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
}

fn assert_asset_name(name: &str) -> Result<(), TestCaseError> {
    prop_assert!(
        is_plain_script_name(name),
        "not a plain script name: {name:?}"
    );
    prop_assert!(!name.contains('/') && !name.contains('\\'));
    prop_assert!(!name.starts_with(".."));
    Ok(())
}

/// Text made of the pieces the finders look for, in any order, mixed with hostile words.
fn script_soup() -> impl Strategy<Value = String> {
    prop::collection::vec(
        prop_oneof![
            4 => prop::sample::select(&[
                "src=\"./assets/", "src=\"./assets/index-", "index-", "i18n-", "vendor-i18n-", "vendor-", ".js", "\"",
                "\"./ja/main.json\"", "\"./ja/nodeDefs.json\"", "\"./en/main.json\"", "import(`./", "`", "../", "..", "/",
                "\\", "%2e%2e", "ja", "en", "main", "nodeDefs", "<script>", "</script>", " ", "\n", "abc", "X1_-",
            ][..]).prop_map(str::to_string),
            1 => any_text(),
        ],
        0..14,
    )
    .prop_map(|parts| parts.concat())
}

fn language() -> impl Strategy<Value = String> {
    prop_oneof![
        prop::sample::select(
            &["ja", "en", "zh", "zh-TW", "pt-BR", "fr", "de", "ko", "ru", "es"][..]
        )
        .prop_map(str::to_string),
        any_text(),
    ]
}

#[test]
fn the_finders_only_return_plain_script_names_whatever_the_text() {
    check(
        (script_soup(), script_soup(), language()),
        |(html, js, lang)| {
            if let Some(name) = entry_script(&html) {
                assert_asset_name(&name)?;
                prop_assert!(name.starts_with("index-"));
            }
            if let Some(name) = i18n_script(&js) {
                assert_asset_name(&name)?;
                prop_assert!(name.starts_with("i18n-"));
            }
            if let Some((main, nodes)) = locale_scripts(&js, &lang) {
                assert_asset_name(&main)?;
                assert_asset_name(&nodes)?;
            }
            Ok(())
        },
    );
}

#[test]
fn a_script_the_page_names_is_found_through_any_surrounding_text() {
    check(
        (
            "[a-z <>=\\n]{0,40}",
            "[A-Za-z0-9_-]{1,12}",
            "[a-z <>=\\n]{0,40}",
        ),
        |(before, id, after)| {
            let html = format!("{before}<script src=\"./assets/index-{id}.js\"></script>{after}");
            let found = entry_script(&html);
            prop_assert_eq!(found, Some(format!("index-{id}.js")));
            // The vendor library of the same name is passed over for the real map.
            let js = format!(
                "import\"./vendor-i18n-{id}.js\";{before}import(\"./i18n-{id}.js\"){after}"
            );
            let found = i18n_script(&js);
            prop_assert_eq!(found, Some(format!("i18n-{id}.js")));
            Ok(())
        },
    );
}

#[test]
fn a_path_in_the_page_is_never_taken_for_a_script_name() {
    check(
        (
            prop::sample::select(&["../", "..\\", "a/", "/", "\\", "%2e%2e/", "x/../"][..]),
            "[A-Za-z0-9_-]{1,8}",
        ),
        |(prefix, id)| {
            let html = format!("<script src=\"./assets/index-{prefix}{id}.js\"></script>");
            prop_assert_eq!(entry_script(&html), None);
            let js = format!("\"./ja/main.json\":()=>import(`./{prefix}{id}.js`),\"./ja/nodeDefs.json\":()=>import(`./nodeDefs-{id}.js`)");
            prop_assert_eq!(locale_scripts(&js, "ja"), None);
            Ok(())
        },
    );
}

#[test]
fn only_the_ten_languages_of_the_app_have_a_comfy_name() {
    check(any_text(), |locale| {
        if let Some(name) = comfy_language(&locale) {
            prop_assert!(
                ["ja", "en", "zh-CN", "zh-TW", "ko", "ru", "es", "pt-BR", "fr", "de"]
                    .contains(&locale.as_str()),
                "{locale:?} -> {name}"
            );
            prop_assert!(!name.is_empty());
        }
        Ok(())
    });
}

/// JSON of strings, booleans and null only (numbers are read as floats, which a plain comparison would not show).
fn plain_json() -> impl Strategy<Value = Value> {
    let leaf = prop_oneof![
        Just(Value::Null),
        any::<bool>().prop_map(Value::Bool),
        any_text().prop_map(Value::String),
    ];
    leaf.prop_recursive(3, 24, 4, |inner| {
        prop_oneof![
            prop::collection::vec(inner.clone(), 0..4).prop_map(Value::Array),
            prop::collection::vec((any_text(), inner), 0..4)
                .prop_map(|kv| Value::Object(kv.into_iter().collect::<Map<_, _>>())),
        ]
    })
}

#[test]
fn a_data_module_written_from_json_reads_back_as_that_json() {
    check(plain_json(), |value| {
        let json = serde_json::to_string(&value).unwrap();
        let module = format!("var e={json};export{{e as default}};");
        prop_assert_eq!(
            parse_module(&module),
            Ok(value.clone()),
            "module {}",
            module
        );
        // The same value as text handed to `JSON.parse` in a template.
        let escaped = json
            .replace('\\', "\\\\")
            .replace('`', "\\`")
            .replace("${", "\\${");
        let module = format!("var e=JSON.parse(`{escaped}`);export{{e as default}};");
        prop_assert_eq!(parse_module(&module), Ok(value), "module {}", module);
        Ok(())
    });
}

#[test]
fn a_module_of_any_text_or_cut_short_is_read_or_refused() {
    check(
        (any_text(), json_value(), any::<prop::sample::Index>()),
        |(text, value, cut)| {
            let _ = parse_module(&text);
            let module = format!(
                "const a={},b=[1,2];export{{a as default,b as list}};",
                serde_json::to_string(&value).unwrap()
            );
            // Cut at any character: an unfinished module is an error or a smaller one, never a panic.
            let chars: Vec<usize> = module.char_indices().map(|(i, _)| i).collect();
            let at = chars[cut.index(chars.len())];
            let _ = parse_module(&module[..at]);
            Ok(())
        },
    );
}

#[test]
fn the_words_read_from_any_two_modules_are_never_empty() {
    check((json_value(), json_value()), |(main, nodes)| {
        let module = |v: &Value| {
            format!(
                "var e={};export{{e as default}};",
                serde_json::to_string(v).unwrap()
            )
        };
        if let Ok(locale) = read_locale(&module(&main), &module(&nodes)) {
            prop_assert!(locale.categories.values().all(|v| !v.is_empty()));
            prop_assert!(locale.comfy_nodes_heading.is_none_or(|v| !v.is_empty()));
            prop_assert!(locale.extensions_heading.is_none_or(|v| !v.is_empty()));
            for node in locale.nodes.values() {
                prop_assert!(node.name.as_ref().is_none_or(|v| !v.is_empty()));
                prop_assert!(node.description.as_ref().is_none_or(|v| !v.is_empty()));
                for field in node.inputs.values().chain(node.outputs.values()) {
                    prop_assert!(field.name.as_ref().is_none_or(|v| !v.is_empty()));
                    prop_assert!(field.tooltip.as_ref().is_none_or(|v| !v.is_empty()));
                }
            }
        }
        Ok(())
    });
}
