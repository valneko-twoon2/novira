//! The checks a tool call passes before it runs: every kind of schema fault gets a sentence the model can act on.
use novira_core::agent::attach::AgentImage;
use novira_core::agent::toolloop::EndpointError;
use novira_core::agent::tools::check_call;
use serde_json::json;

fn refusal(tool: &str, args: serde_json::Value) -> String {
    check_call(tool, Some(&args)).unwrap_err()
}

#[test]
fn a_wrong_type_an_unknown_choice_and_a_missing_field_are_each_named() {
    assert!(refusal("generate", json!({"target": 5})).contains("must be of type string"));
    assert!(refusal("generate", json!({"target": "moon"})).contains("must be one of"));
    assert!(refusal("generate", json!({"scope": "page"})).contains("target is missing"));
    assert!(refusal("generate", json!({"target": "comic", "panel": 0})).contains("at least 1"));
    assert!(
        refusal("generate", json!({"target": "comic", "panel": 5000})).contains("at most 1000")
    );
    assert!(refusal("generate", json!({"target": "comic", "extra": 1})).contains("unknown field"));
    assert!(
        refusal("generate", json!({"target": "comic", "panel": 1.5}))
            .contains("must be of type integer")
    );
}

#[test]
fn arrays_are_checked_for_size_and_for_each_item() {
    let many: Vec<u32> = (0..51).collect();
    assert!(refusal("get_queue_status", json!({"ids": many})).contains("more than 50 items"));
    assert!(refusal("get_queue_status", json!({"ids": [1, -3]})).contains("ids[1]"));
    assert!(refusal("get_queue_status", json!({"ids": "1"})).contains("must be of type array"));
    assert!(refusal("search_extensions", json!({"ids": [""]})).contains("too short"));
    assert!(
        refusal("search_extensions", json!({"ids": ["x".repeat(201)]})).contains("longer than 200")
    );
    assert!(
        refusal("search_extensions", json!({"ids": vec!["a"; 9]})).contains("more than 8 items")
    );
    assert!(refusal("get_image_info", json!({"name": ""})).contains("too short"));
}

#[test]
fn the_text_forms_of_the_tool_errors_and_pictures() {
    assert!(EndpointError::NoTools("template".into())
        .to_string()
        .contains("cannot use the app's tools (template)"));
    assert_eq!(EndpointError::Failed("down".into()).to_string(), "down");
    assert_eq!(
        format!("{:?}", AgentImage { jpeg: vec![0; 3] }),
        "AgentImage(3 bytes)"
    );
}
