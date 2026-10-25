//! Types only sent to the frontend (`Serialize` only): each value is rebuilt from the fixture's fields with an
//! exhaustive struct literal and must serialize to exactly the fixture.
use crate::{assert_wire, get, keys};
use novira_core::agent::{
    AgentEndpointInfo, AgentEndpointTest, AgentReply, AgentStatus, AgentToolCall,
};
use novira_core::comfy::ui_locale::{ComfyUiFieldText, ComfyUiLocale, ComfyUiNodeText};
use novira_core::engine::EngineStatus;
use novira_core::hardware::HardwareInfo;
use novira_core::models::civitai::{CivitaiFile, CivitaiModel, CivitaiVersion, SearchResult};
use novira_core::packs::{PackStatus, Packs};
use novira_core::types::*;
use novira_core::unfinished::UnfinishedDownload;
use serde_json::Value;
use std::collections::BTreeMap;

/// The name of each variant of a Rust enum (an exhaustive `match`, so a new variant fails to compile until it is
/// listed) and the list of all of them.
macro_rules! variants {
    ($ty:ident, [$($variant:ident),+ $(,)?]) => {
        (
            |v: &$ty| match v {
                $($ty::$variant { .. } => stringify!($variant)),+
            },
            [$(stringify!($variant)),+],
        )
    };
}

/// Requires `built` to hold every variant of the enum at least once.
fn assert_every_variant<T>(built: &[T], name: impl Fn(&T) -> &'static str, all: &[&str]) {
    let mut seen: Vec<&str> = built.iter().map(name).collect();
    let mut all = all.to_vec();
    seen.sort();
    seen.dedup();
    all.sort();
    assert_eq!(seen, all, "the fixture has one sample per Rust variant");
}

/// `queue_snapshot`'s reply.
fn snapshot(v: &Value) -> QueueSnapshot {
    QueueSnapshot {
        items: get(v, "items"),
        status: get(v, "status"),
    }
}

pub fn queue_snapshot(v: &Value) {
    assert_wire(&snapshot(v), v, "QueueSnapshot");
}

/// One entry of `scan_folder`'s reply.
pub fn scanned_file(v: &Value) {
    let file = ScannedFile {
        path: get(v, "path"),
        installed: get(v, "installed"),
    };
    assert_wire(&file, v, "ScannedFile");
}

fn civitai_file(v: &Value) -> CivitaiFile {
    CivitaiFile {
        id: get(v, "id"),
        name: get(v, "name"),
        size_bytes: get(v, "sizeBytes"),
        format: get(v, "format"),
        precision: get(v, "precision"),
    }
}

fn civitai_version(v: &Value) -> CivitaiVersion {
    CivitaiVersion {
        id: get(v, "id"),
        name: get(v, "name"),
        base_model: get(v, "baseModel"),
        created_at: get(v, "createdAt"),
        trigger_words: get(v, "triggerWords"),
        files: get::<Vec<Value>>(v, "files")
            .iter()
            .map(civitai_file)
            .collect(),
    }
}

fn civitai_model(v: &Value) -> CivitaiModel {
    CivitaiModel {
        id: get(v, "id"),
        name: get(v, "name"),
        kind: get(v, "kind"),
        base_model: get(v, "baseModel"),
        creator: get(v, "creator"),
        downloads: get(v, "downloads"),
        likes: get(v, "likes"),
        rating: get(v, "rating"),
        rating_count: get(v, "ratingCount"),
        created_at: get(v, "createdAt"),
        nsfw: get(v, "nsfw"),
        image_count: get(v, "imageCount"),
        image_urls: get(v, "imageUrls"),
        tags: get(v, "tags"),
        description: get(v, "description"),
        license: get(v, "license"),
        commercial: get(v, "commercial"),
        permissions: get(v, "permissions"),
        trigger_words: get(v, "triggerWords"),
        source: get(v, "source"),
        versions: get::<Vec<Value>>(v, "versions")
            .iter()
            .map(civitai_version)
            .collect(),
    }
}

pub fn civitai_search_result(v: &Value) {
    let result = SearchResult {
        items: get::<Vec<Value>>(v, "items")
            .iter()
            .map(civitai_model)
            .collect(),
        next_cursor: get(v, "nextCursor"),
    };
    assert_wire(&result, v, "SearchResult");
}

/// One language with words for each part and one with none.
pub fn comfy_ui_locale(v: &Value) {
    let field = |f: &Value| ComfyUiFieldText {
        name: get(f, "name"),
        tooltip: get(f, "tooltip"),
    };
    let fields = |m: &Value| -> BTreeMap<String, ComfyUiFieldText> {
        keys(m)
            .into_iter()
            .map(|k| (k.clone(), field(&m[&k])))
            .collect()
    };
    for k in keys(v) {
        let l = &v[&k];
        let nodes = &l["nodes"];
        let locale = ComfyUiLocale {
            categories: get(l, "categories"),
            comfy_nodes_heading: get(l, "comfyNodesHeading"),
            extensions_heading: get(l, "extensionsHeading"),
            nodes: keys(nodes)
                .into_iter()
                .map(|c| {
                    let n = &nodes[&c];
                    let text = ComfyUiNodeText {
                        name: get(n, "name"),
                        description: get(n, "description"),
                        inputs: fields(&n["inputs"]),
                        outputs: fields(&n["outputs"]),
                    };
                    (c.clone(), text)
                })
                .collect(),
        };
        assert_wire(&locale, l, &k);
    }
}

pub fn node_packs(v: &Value) {
    let packs = NodePacks {
        available: get(v, "available"),
        installed: get(v, "installed"),
        comfy_version: get(v, "comfyVersion"),
        restart_needed: get(v, "restartNeeded"),
    };
    assert_wire(&packs, v, "NodePacks");
}

pub fn low_memory_mode(v: &Value) {
    let mode = LowMemoryMode {
        enabled: get(v, "enabled"),
        owned_engine: get(v, "ownedEngine"),
        pending_restart: get(v, "pendingRestart"),
    };
    assert_wire(&mode, v, "LowMemoryMode");
}

/// One entry of `list_unfinished_downloads`, and of the reply of `delete_unfinished_downloads`.
pub fn unfinished_download(v: &Value) {
    let item = UnfinishedDownload {
        path: get(v, "path"),
        name: get(v, "name"),
        bytes: get(v, "bytes"),
    };
    assert_wire(&item, v, "UnfinishedDownload");
}

/// `engine_settings`' reply (also of `set_engine_settings`, `add_model_root` and `remove_model_root`).
pub fn engine_settings(v: &Value) {
    let settings = EngineSettings {
        data_dir: get(v, "dataDir"),
        comfyui_mode: get(v, "comfyuiMode"),
        comfyui_url: get(v, "comfyuiUrl"),
        comfyui_dir: get(v, "comfyuiDir"),
        comfyui_package: get(v, "comfyuiPackage"),
        comfyui_installed: get(v, "comfyuiInstalled"),
        installed_comfyui_package: get(v, "installedComfyuiPackage"),
        comfyui_start_timeout_secs: get(v, "comfyuiStartTimeoutSecs"),
        model_roots: get(v, "modelRoots"),
        civitai_lookup: get(v, "civitaiLookup"),
        restart_needed: get(v, "restartNeeded"),
    };
    assert_wire(&settings, v, "EngineSettings");
}

fn engine(v: &Value) -> EngineStatus {
    match get::<String>(v, "state").as_str() {
        "idle" => EngineStatus::Idle,
        "downloading" => EngineStatus::Downloading {
            bytes: get(v, "bytes"),
            total_bytes: get(v, "totalBytes"),
        },
        "extracting" => EngineStatus::Extracting,
        "starting" => EngineStatus::Starting,
        "ready" => EngineStatus::Ready,
        "error" => EngineStatus::Error {
            message: get(v, "message"),
        },
        other => panic!("EngineStatus has no state `{other}`"),
    }
}

/// One sample per state, keyed by the state.
pub fn engine_status(v: &Value) {
    let built: Vec<EngineStatus> = keys(v).iter().map(|k| engine(&v[k])).collect();
    for (k, status) in keys(v).iter().zip(&built) {
        assert_wire(status, &v[k], k);
    }
    let (name, all) = variants!(
        EngineStatus,
        [Idle, Downloading, Extracting, Starting, Ready, Error]
    );
    assert_every_variant(&built, name, &all);
}

fn pack(v: &Value) -> PackStatus {
    match get::<String>(v, "state").as_str() {
        "missing" => PackStatus::Missing {
            total_bytes: get(v, "totalBytes"),
        },
        "downloading" => PackStatus::Downloading {
            file: get(v, "file"),
            index: get(v, "index"),
            count: get(v, "count"),
            bytes: get(v, "bytes"),
            total_bytes: get(v, "totalBytes"),
        },
        "installing" => PackStatus::Installing {
            step: get(v, "step"),
        },
        "ready" => PackStatus::Ready,
        "error" => PackStatus::Error {
            message: get(v, "message"),
        },
        other => panic!("PackStatus has no state `{other}`"),
    }
}

/// One sample per state, keyed by the state.
pub fn pack_status(v: &Value) {
    let built: Vec<PackStatus> = keys(v).iter().map(|k| pack(&v[k])).collect();
    for (k, status) in keys(v).iter().zip(&built) {
        assert_wire(status, &v[k], k);
    }
    let (name, all) = variants!(PackStatus, [Missing, Downloading, Installing, Ready, Error]);
    assert_every_variant(&built, name, &all);
}

/// One sample with a card whose memory is known and one without.
pub fn hardware_info(v: &Value) {
    for k in keys(v) {
        let info = HardwareInfo {
            gpu_name: get(&v[&k], "gpuName"),
            vram_bytes: get(&v[&k], "vramBytes"),
        };
        assert_wire(&info, &v[&k], &k);
    }
}

pub fn bootstrap(v: &Value) {
    let packs = &v["packs"];
    let boot = Bootstrap {
        models: get(v, "models"),
        boards: get(v, "boards"),
        images: get(v, "images"),
        workflows: get(v, "workflows"),
        queue: snapshot(&v["queue"]),
        engine: engine(&v["engine"]),
        packs: Packs {
            video: pack(&packs["video"]),
            turbo: pack(&packs["turbo"]),
            music: pack(&packs["music"]),
            voice: pack(&packs["voice"]),
            inpaint: pack(&packs["inpaint"]),
            logo: pack(&packs["logo"]),
        },
    };
    assert_wire(&boot, v, "Bootstrap");
}

fn event(v: &Value) -> BackendEvent {
    match get::<String>(v, "type").as_str() {
        "queue_item_status_changed" => BackendEvent::QueueItemStatusChanged {
            item: get(v, "item"),
        },
        "queue_cleared" => BackendEvent::QueueCleared {
            items: get(v, "items"),
        },
        "processor_state" => BackendEvent::ProcessorState {
            is_paused: get(v, "isPaused"),
        },
        "invocation_progress" => BackendEvent::InvocationProgress {
            progress: get(v, "progress"),
        },
        "engine_status" => BackendEvent::EngineStatus {
            status: engine(&v["status"]),
        },
        "pack" => BackendEvent::Pack {
            kind: get(v, "kind"),
            status: pack(&v["status"]),
        },
        "node_pack" => BackendEvent::NodePack {
            url: get(v, "url"),
            status: pack(&v["status"]),
        },
        "image_added" => BackendEvent::ImageAdded {
            image: get(v, "image"),
            item: get(v, "item"),
        },
        "model_install" => BackendEvent::ModelInstall { job: get(v, "job") },
        "model_added" => BackendEvent::ModelAdded {
            model: get(v, "model"),
        },
        "log" => BackendEvent::Log {
            entry: get(v, "entry"),
        },
        "backup" => BackendEvent::Backup {
            progress: get(v, "progress"),
        },
        "agent_tool_call" => {
            let c = &v["call"];
            BackendEvent::AgentToolCall {
                call: AgentToolCall {
                    call_id: get(c, "callId"),
                    tool: get(c, "tool"),
                    args: get(c, "args"),
                    read_gated: get(c, "readGated"),
                },
            }
        }
        "ui_state_changed" => BackendEvent::UiStateChanged {
            origin: get(v, "origin"),
            revision: get(v, "revision"),
        },
        other => panic!("BackendEvent has no type `{other}`"),
    }
}

/// One sample per event, keyed by its `type`, as the shell emits it on `novira://event`.
pub fn backend_events(v: &Value) {
    let built: Vec<BackendEvent> = keys(v).iter().map(|k| event(&v[k])).collect();
    for (k, e) in keys(v).iter().zip(&built) {
        assert_wire(e, &v[k], k);
    }
    let (name, all) = variants!(
        BackendEvent,
        [
            QueueItemStatusChanged,
            QueueCleared,
            ProcessorState,
            InvocationProgress,
            EngineStatus,
            Pack,
            NodePack,
            ImageAdded,
            ModelInstall,
            ModelAdded,
            Log,
            Backup,
            AgentToolCall,
            UiStateChanged
        ]
    );
    assert_every_variant(&built, name, &all);
}

pub fn agent_status(v: &Value) {
    let status = AgentStatus {
        provider: get(v, "provider"),
        installed: get(v, "installed"),
        logged_in: get(v, "loggedIn"),
        models: get(v, "models"),
        endpoint: get(v, "endpoint"),
    };
    assert_wire(&status, v, "AgentStatus");
    let e = &v["endpoint"];
    let info = AgentEndpointInfo {
        base_url: get(e, "baseUrl"),
        model: get(e, "model"),
        has_key: get(e, "hasKey"),
        remote: get(e, "remote"),
        insecure: get(e, "insecure"),
        tools: get(e, "tools"),
        tools_reason: get(e, "toolsReason"),
    };
    assert_wire(&info, e, "AgentEndpointInfo");
}

pub fn agent_endpoint_test(v: &Value) {
    let test = AgentEndpointTest {
        reachable: get(v, "reachable"),
        error: get(v, "error"),
        model_found: get(v, "modelFound"),
        tools: get(v, "tools"),
        tools_reason: get(v, "toolsReason"),
    };
    assert_wire(&test, v, "AgentEndpointTest");
}

pub fn agent_reply(v: &Value) {
    let reply = AgentReply {
        thoughts: get(v, "thoughts"),
        text: get(v, "text"),
    };
    assert_wire(&reply, v, "AgentReply");
}
