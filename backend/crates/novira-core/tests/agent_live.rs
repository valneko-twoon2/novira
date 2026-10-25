//! Talks to the real `claude` / `codex` tools you are signed in to, through the app's MCP server, with a fake frontend
//! that answers the tool calls. Run on purpose:
//! `cargo test -p novira-core --test agent_live -- --ignored --nocapture`.
use novira_core::agent::mcp::{ToolHandler, ToolOutcome};
use novira_core::agent::tools::CheckedCall;
use novira_core::agent::{chat, status_of, AgentProvider, AgentRequest};
use serde_json::json;
use std::sync::{Arc, Mutex};

/// A frontend with one model and empty prompt boxes; it records every call and declines reading the prompts.
#[derive(Default)]
struct FakeFrontend {
    calls: Mutex<Vec<CheckedCall>>,
}

#[async_trait::async_trait]
impl ToolHandler for FakeFrontend {
    async fn call(&self, call: CheckedCall) -> ToolOutcome {
        println!(
            "  tool call: {} {} (read gated: {})",
            call.tool, call.args, call.read_gated
        );
        self.calls.lock().unwrap().push(call.clone());
        // The picture a tool returns: a plain red one, so only looking at it tells the colour.
        if call.tool == "view_comic_page" {
            let red = image::RgbImage::from_pixel(64, 64, image::Rgb([220, 20, 20]));
            let mut png = std::io::Cursor::new(Vec::new());
            image::DynamicImage::ImageRgb8(red)
                .write_to(&mut png, image::ImageFormat::Png)
                .unwrap();
            return ToolOutcome {
                ok: true,
                text: json!({"page": 1}).to_string(),
                image: Some(novira_core::agent::attach::prepare(png.get_ref()).unwrap()),
            };
        }
        if call.read_gated {
            return ToolOutcome::error(
                "The user declined: the assistant may not read pictures or prompts.",
            );
        }
        let text = match call.tool {
            "get_screen" => json!({"screen": "generate", "name": "Generate"}),
            "list_models" => {
                json!({"models": [{"key": "m1", "name": "Anime XL", "base": "sdxl", "type": "main"}], "selected": {"modelKey": null, "loras": []}})
            }
            "get_generation_settings" => {
                json!({"modelKey": null, "steps": 20, "cfgScale": 7, "width": 1024, "height": 1024})
            }
            _ => json!({"ok": true}),
        };
        ToolOutcome {
            ok: true,
            text: text.to_string(),
            image: None,
        }
    }
}

fn request(message: &str) -> AgentRequest {
    serde_json::from_value(json!({"message": message, "locale": "en", "screen": "generate"}))
        .unwrap()
}

#[tokio::test]
#[ignore = "uses your Claude / Codex login"]
async fn both_tools_set_the_prompt_through_the_apps_mcp_server() {
    for provider in [AgentProvider::Claude, AgentProvider::Codex] {
        let st = status_of(provider, None).await;
        println!("{provider:?}: {st:?}");
        if !st.logged_in {
            continue;
        }
        let frontend = Arc::new(FakeFrontend::default());
        let reply = chat(
            provider,
            None,
            &request(
                "Set the positive prompt to exactly: a red apple on a table. Change nothing else.",
            ),
            frontend.clone(),
        )
        .await
        .unwrap();
        println!("{provider:?}: {:?} / {}", reply.thoughts, reply.text);
        let calls = frontend.calls.lock().unwrap();
        let set = calls
            .iter()
            .find(|c| c.tool == "set_generation_settings")
            .unwrap_or_else(|| panic!("{provider:?} did not set the prompt: {calls:?}"));
        // The request ends with a full stop, which a model may keep.
        let prompt = set.args["positivePrompt"].as_str().unwrap_or("");
        assert_eq!(prompt.trim_end_matches('.'), "a red apple on a table");
        assert!(!reply.text.is_empty());
    }
}

#[tokio::test]
#[ignore = "uses your Claude / Codex login"]
async fn both_tools_go_on_when_reading_the_prompts_is_declined() {
    for provider in [AgentProvider::Claude, AgentProvider::Codex] {
        if !status_of(provider, None).await.logged_in {
            continue;
        }
        let frontend = Arc::new(FakeFrontend::default());
        let reply = chat(
            provider,
            None,
            &request("Read my current prompt (get_generation_settings with includePrompts) and tell me what it says."),
            frontend.clone(),
        )
        .await
        .unwrap();
        println!("{provider:?}: {}", reply.text);
        let calls = frontend.calls.lock().unwrap();
        let gated = calls.iter().filter(|c| c.read_gated).count();
        assert!(gated >= 1, "{provider:?} never tried to read: {calls:?}");
        assert!(
            gated <= 2,
            "{provider:?} kept asking after a decline: {calls:?}"
        );
    }
}

#[tokio::test]
#[ignore = "uses your Claude / Codex login"]
async fn both_tools_see_an_attached_picture_and_write_a_prompt_from_it() {
    // A plain red picture: the model can only know the colour by looking at it.
    let red = image::RgbImage::from_pixel(64, 64, image::Rgb([220, 20, 20]));
    let mut png = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(red)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    let picture = novira_core::agent::attach::prepare(png.get_ref()).unwrap();
    for provider in [AgentProvider::Claude, AgentProvider::Codex] {
        if !status_of(provider, None).await.logged_in {
            continue;
        }
        let frontend = Arc::new(FakeFrontend::default());
        let mut req = request(
            "Set the positive prompt to one lowercase English word: the colour of the attached picture. Change nothing else.",
        );
        req.attached = vec![picture.clone()];
        let reply = chat(provider, None, &req, frontend.clone()).await.unwrap();
        println!("{provider:?}: {:?} / {}", reply.thoughts, reply.text);
        let calls = frontend.calls.lock().unwrap();
        let set = calls
            .iter()
            .find(|c| c.tool == "set_generation_settings")
            .unwrap_or_else(|| panic!("{provider:?} did not set the prompt: {calls:?}"));
        let prompt = set.args["positivePrompt"].as_str().unwrap_or("");
        assert!(
            prompt.to_lowercase().contains("red"),
            "{provider:?}: {prompt}"
        );
    }
}

#[tokio::test]
#[ignore = "uses your Claude / Codex login"]
async fn both_tools_see_the_picture_a_tool_returns() {
    for provider in [AgentProvider::Claude, AgentProvider::Codex] {
        if !status_of(provider, None).await.logged_in {
            continue;
        }
        let frontend = Arc::new(FakeFrontend::default());
        let reply = chat(
            provider,
            None,
            &request(
                "Call view_comic_page for page 1, look at the picture it returns, then set the positive prompt to one lowercase English word: the colour of that picture. Change nothing else.",
            ),
            frontend.clone(),
        )
        .await
        .unwrap();
        println!("{provider:?}: {:?} / {}", reply.thoughts, reply.text);
        let calls = frontend.calls.lock().unwrap();
        assert!(
            calls.iter().any(|c| c.tool == "view_comic_page"),
            "{provider:?} did not look at the page: {calls:?}"
        );
        let set = calls
            .iter()
            .find(|c| c.tool == "set_generation_settings")
            .unwrap_or_else(|| panic!("{provider:?} did not set the prompt: {calls:?}"));
        let prompt = set.args["positivePrompt"].as_str().unwrap_or("");
        assert!(
            prompt.to_lowercase().contains("red"),
            "{provider:?} could not see the returned picture: {prompt}"
        );
    }
}
