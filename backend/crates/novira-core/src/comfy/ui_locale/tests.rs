use super::*;
use serde_json::json;

/// Shaped like ComfyUI's minified locale files, with made-up words.
const MAIN: &str = "var e={dock:`Dock here`,n:{a:1}},t={nodeLibraryTab:{sections:{comfyNodes:`Core`,extensions:`Add-ons`},other:!0}},\
n={\"\":``,model:`Modèle`,\"background removal\":`Fond`,\"3d\":`3d`},j=JSON.parse(`{\"allModels\":\"Every model\",\"n\":[1,null]}`),r={title:\"A \\\"quoted\\\" \\u00e9 \\u{1F600} line\"};\
export{e as actionbar,n as nodeCategories,t as sideToolbar,r as misc,j as models};";

const NODES: &str = "var e={display_name:`Échantillonneur`,description:`Two\nlines`,inputs:{seed:{name:`Graine`,tooltip:`Random`},cfg:{name:`cfg`}},\
outputs:{\"0\":{tooltip:`Latent out`}}},t={display_name:`Charger`},n={APG:e,KSampler:e,Load:t};export{e as APG,t as Load,n as default};";

#[test]
fn reads_a_module_of_data_as_its_named_exports() {
    let v = parse_module(MAIN).unwrap();
    assert_eq!(
        v["actionbar"],
        json!({ "dock": "Dock here", "n": { "a": 1.0 } })
    );
    assert_eq!(v["sideToolbar"]["nodeLibraryTab"]["other"], json!(true));
    // `JSON.parse` of a text is read as that JSON.
    assert_eq!(
        v["models"],
        json!({ "allModels": "Every model", "n": [1, null] })
    );
    assert_eq!(v["misc"]["title"], json!("A \"quoted\" é 😀 line"));
}

#[test]
fn reads_the_default_export_when_there_is_one() {
    let v = parse_module(NODES).unwrap();
    assert_eq!(v.as_object().unwrap().len(), 3);
    assert_eq!(v["KSampler"]["display_name"], json!("Échantillonneur"));
    assert_eq!(v["KSampler"]["description"], json!("Two\nlines"));
}

#[test]
fn gathers_the_words_of_a_language() {
    let l = read_locale(MAIN, NODES).unwrap();
    assert_eq!(l.comfy_nodes_heading.as_deref(), Some("Core"));
    assert_eq!(l.extensions_heading.as_deref(), Some("Add-ons"));
    assert_eq!(
        l.categories.get("model").map(String::as_str),
        Some("Modèle")
    );
    assert_eq!(
        l.categories.get("background removal").map(String::as_str),
        Some("Fond")
    );
    // An empty word is no word.
    assert!(!l.categories.contains_key(""));
    let k = &l.nodes["KSampler"];
    assert_eq!(k.name.as_deref(), Some("Échantillonneur"));
    assert_eq!(
        k.inputs["seed"],
        ComfyUiFieldText {
            name: Some("Graine".into()),
            tooltip: Some("Random".into())
        }
    );
    assert_eq!(
        k.outputs["0"],
        ComfyUiFieldText {
            name: None,
            tooltip: Some("Latent out".into())
        }
    );
    assert_eq!(l.nodes["Load"].name.as_deref(), Some("Charger"));
    assert!(l.nodes["Load"].inputs.is_empty());
}

#[test]
fn a_file_with_anything_but_data_is_not_read() {
    for bad in [
        "var e={a:`x`};alert(1);export{e as default};",
        "var e={a:f()};export{e as default};",
        "var e={a:`${x}`};export{e as default};",
        "var e={a:`never closed};export{e as default};",
        "var e={a:t};export{e as default};",
        "import x from './y.js';var e={};export{e as default};",
        "var e={...t};export{e as default};",
        "var e=JSON.stringify(`{}`);export{e as default};",
        "var e=JSON.parse(t);export{e as default};",
        "var e=JSON.parse(`{bad`);export{e as default};",
    ] {
        assert!(parse_module(bad).is_err(), "{bad}");
    }
}

#[test]
fn a_loop_of_names_or_a_deep_value_stops() {
    assert!(parse_module("var e={a:t},t={b:e};export{e as default};").is_err());
    let deep = format!(
        "var e={}{};export{{e as default}};",
        "[".repeat(100),
        "]".repeat(100)
    );
    assert!(parse_module(&deep).is_err());
    let huge = format!(
        "var e=`{}`;export{{e as default}};",
        "x".repeat(MAX_SCRIPT_BYTES)
    );
    assert!(parse_module(&huge).is_err());
}

#[test]
fn finds_the_scripts_from_the_page() {
    let html = r#"<script type="module" crossorigin src="./assets/index-D6MF_nPRO.js"></script>"#;
    assert_eq!(entry_script(html).as_deref(), Some("index-D6MF_nPRO.js"));
    assert_eq!(
        entry_script(r#"<script src="./assets/index-../../x.js">"#),
        None
    );
    let entry = "import(`./vendor-i18n-DiB45wr9.js`);import(`./i18n-BmUMyLMV.js`)";
    assert_eq!(i18n_script(entry).as_deref(), Some("i18n-BmUMyLMV.js"));
    let map = "\"./ja/main.json\":()=>e(()=>import(`./main-JN_op.js`),[],import.meta.url),\
\"./ja/nodeDefs.json\":()=>e(()=>import(`./nodeDefs-VEM.js`),[],import.meta.url),\
\"./de/main.json\":()=>e(()=>import(`./main-x/../y.js`),[],import.meta.url),\
\"./de/nodeDefs.json\":()=>e(()=>import(`./nodeDefs-z.js`),[],import.meta.url)";
    assert_eq!(
        locale_scripts(map, "ja"),
        Some(("main-JN_op.js".into(), "nodeDefs-VEM.js".into()))
    );
    // A name that would leave the assets folder is refused.
    assert_eq!(locale_scripts(map, "de"), None);
    assert_eq!(locale_scripts(map, "ko"), None);
}

#[test]
fn maps_the_app_languages_to_comfyui_s() {
    assert_eq!(comfy_language("zh-CN"), Some("zh"));
    assert_eq!(comfy_language("ja"), Some("ja"));
    assert_eq!(comfy_language("../ja"), None);
    assert_eq!(comfy_language("xx"), None);
}

#[test]
fn comments_arrays_escapes_and_short_forms_are_read() {
    let src = r#"// a line comment
/* a block
comment */ const a=[1,"x",[!1,void 0]],b={a,"k":'v\x41\n\t\r\b\f\v\0\q\
end'};
export{a as list,b as default}; /* unclosed"#;
    let v = parse_module(src).unwrap();
    assert_eq!(v["a"], json!([1.0, "x", [false, null]]));
    assert_eq!(v["k"], json!("vA\n\t\r\u{8}\u{c}\u{b}\0qend"));
    // A line comment on the last line is skipped, and a list that never closes is an error.
    assert!(parse_module("var a=1; // end").is_ok());
    assert!(parse_module("var a=[1,2 export{a};").is_err());
    // A surrogate pair, a signed number and a list without a trailing comma.
    let pair = parse_module(r#"var a="😀A",b=[-1.5,2];export{a,b};"#).unwrap();
    assert_eq!(pair["a"], json!("\u{1F600}A"));
    assert_eq!(pair["b"], json!([-1.5, 2.0]));
    for bad in [
        r#"var a=!2;export{a};"#,
        r#"var a="\x4";export{a};"#,
        r#"var a="\xzz";export{a};"#,
        r#"var a="\u00";export{a};"#,
        r#"var a="\ud83d\u00";export{a};"#,
        r#"var a="\ud83d\uzzzz";export{a};"#,
        r#"var a="\ud83d";export{a};"#,
        r#"var a="\uzzzz";export{a};"#,
        r#"var a="\u{110000}";export{a};"#,
        r#"var a="\u{41";export{a};"#,
        r#"var a="abc"#,
        "var a=\"line\nbreak\";export{a};",
        "var a=`x${y}`;export{a};",
        "var a=[1 2];export{a};",
        "var a={b:1 c:2};export{a};",
        "var a=void x;export{a};",
        "var a=JSON.stringify(`{}`);export{a};",
        "var a=JSON.parse(5);export{a};",
        "var a=JSON.parse(`{`);export{a};",
        "export{a",
        "var a=nowhere;export{a};",
        "var a=[nowhere];export{a};",
    ] {
        assert!(parse_module(bad).is_err(), "{bad}");
    }
}
