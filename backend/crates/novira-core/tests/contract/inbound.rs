//! Types only received from the frontend (`Deserialize` only): each value is destructured exhaustively, written back
//! with the wire names and compared with the fixture. A field the fixture has but Rust ignores is missing from the
//! rebuilt JSON; a field Rust renamed reads as its default and differs.
use crate::parse;
use novira_core::agent::{AgentEndpointInput, AgentRequest, AgentToolAnswer, AgentTurn};
use novira_core::models::civitai::SearchParams;
use novira_core::types::EngineSettingsPatch;
use serde_json::{json, Value};

/// `set_engine_settings`' patch.
pub fn engine_settings_patch(v: &Value) {
    let EngineSettingsPatch {
        comfyui_package,
        comfyui_start_timeout_secs,
        civitai_lookup,
    } = parse(v);
    let wire = json!({
        "comfyuiPackage": comfyui_package,
        "comfyuiStartTimeoutSecs": comfyui_start_timeout_secs,
        "civitaiLookup": civitai_lookup,
    });
    assert_eq!(wire, *v, "EngineSettingsPatch");
}

/// `search_civitai`'s parameters.
pub fn civitai_search_params(v: &Value) {
    let SearchParams {
        query,
        kind,
        base_model,
        sort,
        period,
        include_nsfw,
        cursor,
        source,
        licenses,
        checkpoint_type,
        safetensors_only,
        creator,
    } = parse(v);
    let wire = json!({
        "query": query,
        "kind": kind,
        "baseModel": base_model,
        "sort": sort,
        "period": period,
        "includeNsfw": include_nsfw,
        "cursor": cursor,
        "source": source,
        "licenses": licenses,
        "checkpointType": checkpoint_type,
        "safetensorsOnly": safetensors_only,
        "creator": creator,
    });
    assert_eq!(wire, *v, "SearchParams");
}

pub fn agent_request(v: &Value) {
    let AgentRequest {
        message,
        locale,
        history,
        screen,
        focus,
        agent_model,
        effort,
        images,
        attached,
    } = parse(v);
    assert!(
        attached.is_empty(),
        "the prepared pictures are never read from the wire"
    );
    let history: Vec<Value> = history
        .into_iter()
        .map(|t| {
            let AgentTurn { role, text } = t;
            json!({ "role": role, "text": text })
        })
        .collect();
    let wire = json!({
        "message": message,
        "locale": locale,
        "history": history,
        "screen": screen,
        "focus": focus,
        "agentModel": agent_model,
        "effort": effort,
        "images": images,
    });
    assert_eq!(wire, *v, "AgentRequest");
}

pub fn agent_endpoint_input(v: &Value) {
    let AgentEndpointInput {
        base_url,
        model,
        api_key,
    } = parse(v);
    let wire = json!({ "baseUrl": base_url, "model": model, "apiKey": api_key });
    assert_eq!(wire, *v, "AgentEndpointInput");
}

pub fn agent_tool_answer(v: &Value) {
    let AgentToolAnswer {
        call_id,
        ok,
        content,
    } = parse(v);
    let wire = json!({ "callId": call_id, "ok": ok, "content": content });
    assert_eq!(wire, *v, "AgentToolAnswer");
}
