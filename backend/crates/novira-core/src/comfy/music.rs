//! The music graph: ACE-Step 1.5 (turbo), one all-in-one checkpoint that makes a song from style tags and lyrics.
//! Only core ComfyUI nodes are used (TextEncodeAceStepAudio1.5, EmptyAceStep1.5LatentAudio, KSampler, VAEDecodeAudio,
//! SaveAudioAdvanced). The checkpoint comes from novira's music pack (`crate::packs`).
use super::graph::{Builder, BuiltGraph, GraphInput};
use crate::types::MusicParams;
use serde_json::json;

pub const MIN_SECONDS: u32 = 10;
pub const MAX_SECONDS: u32 = 240;
/// What the model is told when the song has no singing.
const INSTRUMENTAL_LYRICS: &str = "[Instrumental]";
/// Languages of lyrics the model knows, as the node lists them.
const LANGUAGES: &[&str] = &[
    "ar", "az", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "he", "hi",
    "hr", "ht", "hu", "id", "is", "it", "ja", "ko", "la", "lt", "ms", "ne", "nl", "no", "pa", "pl",
    "pt", "ro", "ru", "sa", "sk", "sr", "sv", "sw", "ta", "te", "th", "tl", "tr", "uk", "ur", "vi",
    "yue", "zh", "unknown",
];

fn link(node: &str, slot: u32) -> serde_json::Value {
    json!([node, slot])
}

/// Length the model accepts.
pub fn seconds_for(m: &MusicParams) -> u32 {
    m.seconds.clamp(MIN_SECONDS, MAX_SECONDS)
}

/// A key the node lists (`C major`, `F# minor`, `Bb major`); anything else becomes C major.
pub fn key_for(key: &str) -> String {
    let mut parts = key.split_whitespace();
    let (root, quality) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
    let root_ok = matches!(
        root,
        "C" | "C#"
            | "Db"
            | "D"
            | "D#"
            | "Eb"
            | "E"
            | "F"
            | "F#"
            | "Gb"
            | "G"
            | "G#"
            | "Ab"
            | "A"
            | "A#"
            | "Bb"
            | "B"
    );
    if root_ok && matches!(quality, "major" | "minor") && parts.next().is_none() {
        format!("{root} {quality}")
    } else {
        "C major".into()
    }
}

fn language_for(code: &str) -> &'static str {
    LANGUAGES
        .iter()
        .copied()
        .find(|l| *l == code)
        .unwrap_or("unknown")
}

fn signature_for(n: u32) -> &'static str {
    match n {
        2 => "2",
        3 => "3",
        6 => "6",
        _ => "4",
    }
}

pub fn build(input: &GraphInput<'_>) -> Result<BuiltGraph, String> {
    let p = input.params;
    let m = p.music.as_ref().ok_or("The music settings are missing")?;
    if p.positive_prompt.trim().is_empty() {
        return Err("Describe the music first (genre, mood, instruments)".into());
    }
    if p.steps == 0 {
        return Err("Steps must be at least 1".into());
    }
    let lyrics = if m.instrumental || m.lyrics.trim().is_empty() {
        INSTRUMENTAL_LYRICS
    } else {
        m.lyrics.trim()
    };
    let seconds = seconds_for(m);
    let mut g = Builder::default();
    let ckpt = g.add(
        "CheckpointLoaderSimple",
        json!({ "ckpt_name": input.checkpoint.name }),
    );
    let encoded = g.add(
        "TextEncodeAceStepAudio1.5",
        json!({
            "clip": link(&ckpt, 1),
            "tags": p.positive_prompt.trim(),
            "lyrics": lyrics,
            "seed": p.seed,
            "bpm": m.bpm.clamp(10, 300),
            "duration": f64::from(seconds),
            "timesignature": signature_for(m.time_signature),
            "language": language_for(&m.language),
            "keyscale": key_for(&m.key),
            "generate_audio_codes": true,
            "cfg_scale": 2.0,
            "temperature": 0.85,
            "top_p": 0.9,
            "top_k": 0,
            "min_p": 0.0,
        }),
    );
    let negative = g.add(
        "ConditioningZeroOut",
        json!({ "conditioning": link(&encoded, 0) }),
    );
    let model = g.add(
        "ModelSamplingAuraFlow",
        json!({ "model": link(&ckpt, 0), "shift": 3.0 }),
    );
    let latent = g.add(
        "EmptyAceStep1.5LatentAudio",
        json!({ "seconds": f64::from(seconds), "batch_size": 1 }),
    );
    let sampled = g.add(
        "KSampler",
        json!({
            "model": link(&model, 0),
            "seed": p.seed,
            "steps": p.steps,
            "cfg": p.cfg_scale,
            "sampler_name": "euler",
            "scheduler": "simple",
            "positive": link(&encoded, 0),
            "negative": link(&negative, 0),
            "latent_image": link(&latent, 0),
            "denoise": 1.0,
        }),
    );
    let decoded = g.add(
        "VAEDecodeAudio",
        json!({ "samples": link(&sampled, 0), "vae": link(&ckpt, 2) }),
    );
    let saved = g.add(
        "SaveAudioAdvanced",
        json!({ "audio": link(&decoded, 0), "filename_prefix": "audio/novira", "format": "flac" }),
    );
    Ok(BuiltGraph {
        prompt: serde_json::Value::Object(g.nodes),
        output_node: saved,
        total_steps: p.steps,
        thumbnail_node: None,
        audio_ext: Some("flac"),
        passes: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::comfy::graph::{build as build_any, tests::params};
    use crate::types::{ComfyRef, GenerationMetadata, GenerationMode};

    fn music() -> MusicParams {
        MusicParams {
            lyrics: "[Verse]\nla la".into(),
            seconds: 90,
            bpm: 128,
            key: "E minor".into(),
            time_signature: 4,
            language: "ja".into(),
            instrumental: false,
        }
    }

    fn music_params() -> GenerationMetadata {
        let mut p = params(GenerationMode::Music);
        p.positive_prompt = "city pop, warm, female vocals".into();
        p.steps = 8;
        p.cfg_scale = 1.0;
        p.music = Some(music());
        p
    }

    fn graph(p: &GenerationMetadata) -> Result<BuiltGraph, String> {
        let ckpt = ComfyRef {
            folder: "checkpoints".into(),
            name: "ace_step_1.5_turbo_aio.safetensors".into(),
        };
        build_any(&GraphInput {
            split: None,
            params: p,
            checkpoint: &ckpt,
            vae: None,
            loras: vec![],
            upscale_model: None,
            tile_controlnet: None,
            post_processing_model: None,
            text_encoder: None,
            init_image: None,
            guidance: Default::default(),
        })
    }

    fn node<'a>(g: &'a BuiltGraph, class: &str) -> &'a serde_json::Value {
        g.prompt
            .as_object()
            .unwrap()
            .values()
            .find(|n| n["class_type"] == class)
            .unwrap_or_else(|| panic!("no {class}"))
    }

    #[test]
    fn a_song_graph_has_the_ace_step_nodes_and_saves_audio() {
        let g = graph(&music_params()).unwrap();
        let enc = node(&g, "TextEncodeAceStepAudio1.5");
        assert_eq!(enc["inputs"]["tags"], "city pop, warm, female vocals");
        assert_eq!(enc["inputs"]["lyrics"], "[Verse]\nla la");
        assert_eq!(enc["inputs"]["language"], "ja");
        assert_eq!(enc["inputs"]["keyscale"], "E minor");
        assert_eq!(enc["inputs"]["bpm"], 128);
        assert_eq!(enc["inputs"]["duration"], 90.0);
        assert_eq!(
            node(&g, "EmptyAceStep1.5LatentAudio")["inputs"]["seconds"],
            90.0
        );
        assert_eq!(node(&g, "KSampler")["inputs"]["steps"], 8);
        assert_eq!(g.prompt[&g.output_node]["class_type"], "SaveAudioAdvanced");
        assert_eq!(g.audio_ext, Some("flac"));
        assert!(g.thumbnail_node.is_none());
        assert_eq!(g.total_steps, 8);
    }

    #[test]
    fn instrumental_music_drops_the_lyrics() {
        let mut p = music_params();
        p.music.as_mut().unwrap().instrumental = true;
        assert_eq!(
            node(&graph(&p).unwrap(), "TextEncodeAceStepAudio1.5")["inputs"]["lyrics"],
            "[Instrumental]"
        );
        p.music.as_mut().unwrap().instrumental = false;
        p.music.as_mut().unwrap().lyrics = "  ".into();
        assert_eq!(
            node(&graph(&p).unwrap(), "TextEncodeAceStepAudio1.5")["inputs"]["lyrics"],
            "[Instrumental]"
        );
    }

    #[test]
    fn values_the_model_does_not_list_are_replaced_by_safe_ones() {
        let mut p = music_params();
        {
            let m = p.music.as_mut().unwrap();
            m.seconds = 5000;
            m.bpm = 5;
            m.key = "H sharp".into();
            m.language = "klingon".into();
            m.time_signature = 7;
        }
        let g = graph(&p).unwrap();
        let enc = node(&g, "TextEncodeAceStepAudio1.5");
        assert_eq!(enc["inputs"]["duration"], 240.0);
        assert_eq!(enc["inputs"]["bpm"], 10);
        assert_eq!(enc["inputs"]["keyscale"], "C major");
        assert_eq!(enc["inputs"]["language"], "unknown");
        assert_eq!(enc["inputs"]["timesignature"], "4");
    }

    #[test]
    fn keys_are_checked_strictly() {
        assert_eq!(key_for("F# minor"), "F# minor");
        assert_eq!(key_for("Bb major"), "Bb major");
        assert_eq!(key_for("C major extra"), "C major");
        assert_eq!(key_for(""), "C major");
    }

    #[test]
    fn missing_settings_or_description_are_refused_with_a_reason() {
        let mut p = music_params();
        p.music = None;
        assert!(graph(&p).unwrap_err().contains("music settings"));
        let mut p = music_params();
        p.positive_prompt = "  ".into();
        assert!(graph(&p).unwrap_err().contains("Describe the music"));
    }
}
