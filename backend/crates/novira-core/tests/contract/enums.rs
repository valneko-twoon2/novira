//! Plain enums: the fixture lists every value once, as the TS union has it.
use crate::{assert_wire, keys, parse};
use novira_core::agent::{AgentProvider, AgentToolsState};
use novira_core::packs::PackKind;
use novira_core::types::*;
use serde_json::Value;

/// Checks the list `fixture[<enum name>]` and returns the enum name. The `match` is exhaustive, so a variant added in
/// Rust fails to compile until it is listed here (and in the TS union, the sample and the fixture).
macro_rules! check_enum {
    ($fixture:expr, $ty:ident, [$($variant:ident),+ $(,)?]) => {{
        let json = &$fixture[stringify!($ty)];
        let values: Vec<$ty> = parse(json);
        assert_wire(&values, json, stringify!($ty));
        let name = |v: &$ty| match v {
            $($ty::$variant => stringify!($variant)),+
        };
        let mut seen: Vec<&str> = values.iter().map(name).collect();
        seen.sort();
        seen.dedup();
        assert_eq!(
            (seen.len(), values.len()),
            ([$(stringify!($variant)),+].len(), seen.len()),
            "{} must list every variant once",
            stringify!($ty)
        );
        stringify!($ty).to_string()
    }};
}

pub fn enums(v: &Value) {
    let mut checked = vec![
        check_enum!(
            v,
            BaseModel,
            [
                Sd1,
                Sd2,
                Sdxl,
                Sd3,
                Flux,
                Flux2,
                Anima,
                Chroma,
                QwenImage,
                ZImage,
                Hidream,
                Auraflow,
                HunyuanImage,
                HunyuanDit,
                Wan,
                HunyuanVideo,
                HunyuanVideo15,
                LtxVideo,
                Ltx2,
                Any
            ]
        ),
        check_enum!(
            v,
            ModelType,
            [
                Main,
                Vae,
                Lora,
                Controlnet,
                T2iAdapter,
                IpAdapter,
                ClipVision,
                SpandrelImageToImage,
                T5Encoder,
                ClipEmbed,
                DiffusionModel,
                TextEncoder,
                ModelPatch
            ]
        ),
        check_enum!(
            v,
            ModelFormat,
            [Checkpoint, Diffusers, Lycoris, Invokeai, Gguf, BnbQuantized]
        ),
        check_enum!(
            v,
            ModelInstallStatus,
            [Waiting, Downloading, Running, Completed, Error, Cancelled]
        ),
        check_enum!(
            v,
            GenerationMode,
            [
                Txt2img, Img2img, Inpaint, Outpaint, Upscale, Workflow, Graph, Video, Music, Voice,
                Logo
            ]
        ),
        check_enum!(v, VoiceMode, [Preset, Design]),
        check_enum!(v, ImageCategory, [General, User, Mask, Control, Other]),
        check_enum!(v, MediaType, [Image, Video, Audio]),
        check_enum!(
            v,
            QueueItemStatus,
            [Pending, InProgress, Completed, Failed, Canceled]
        ),
        check_enum!(v, QueueOrigin, [Generate, Canvas, Upscaling, Workflows]),
        check_enum!(v, QueueDestination, [Gallery, Canvas, Intermediate]),
        check_enum!(v, QueueErrorKind, [OutOfMemory]),
        check_enum!(v, ControlMode, [Balanced, MorePrompt, MoreControl]),
        check_enum!(
            v,
            RefImageMethod,
            [Full, Style, Composition, StyleStrong, StylePrecise]
        ),
        check_enum!(v, ClipVisionModel, [VitH, VitG, VitL]),
        check_enum!(v, PackKind, [Video, Turbo, Music, Voice, Inpaint, Logo]),
        check_enum!(v, AgentProvider, [Claude, Codex, Openai]),
        check_enum!(v, AgentToolsState, [Unknown, Supported, Unsupported]),
        check_enum!(v, ComfyuiMode, [Owned, Url, Folder]),
        check_enum!(v, ComfyuiPackage, [Nvidia, Amd]),
    ];
    checked.sort();
    assert_eq!(keys(v), checked, "every enum in the fixture is checked");
}
