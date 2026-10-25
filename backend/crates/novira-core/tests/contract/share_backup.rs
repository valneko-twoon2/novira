//! Export for sharing and backup / restore: the options and replies of `export_images`, the watermark's status and
//! check, `create_backup`, `open_backup` and `take_restored_ui_state`. Every type crosses as JSON both ways in tests,
//! so each fixture must survive a round trip; enums and the tagged outcomes list every Rust variant (an exhaustive
//! `match`).
use crate::{assert_wire, get, keys, parse, round_trip};
use novira_core::backup::{BackupInfo, BackupPhase, BackupSummary, RestoreOutcome};
use novira_core::media::export::{ExportFormat, ExportOptions, ExportResult};
use novira_core::types::{WatermarkCheck, WatermarkStatus};
use serde_json::Value;

pub fn export_options(v: &Value) {
    let o: ExportOptions = round_trip(v, "ExportOptions");
    assert!(
        o.max_side.is_some() && o.watermark,
        "the sample fills every field"
    );
}

pub fn export_result(v: &Value) {
    round_trip::<ExportResult>(v, "ExportResult");
}

pub fn backup_info(v: &Value) {
    round_trip::<BackupInfo>(v, "BackupInfo");
}

pub fn backup_summary(v: &Value) {
    round_trip::<BackupSummary>(v, "BackupSummary");
}

/// One sample per outcome, keyed by its `state`.
pub fn restore_outcome(v: &Value) {
    let built: Vec<RestoreOutcome> = keys(v)
        .iter()
        .map(|k| {
            let s = &v[k];
            match get::<String>(s, "state").as_str() {
                "none" => RestoreOutcome::None,
                "restored" => RestoreOutcome::Restored {
                    ui_state: get(s, "uiState"),
                },
                "failed" => RestoreOutcome::Failed {
                    message: get(s, "message"),
                },
                other => panic!("RestoreOutcome has no state `{other}`"),
            }
        })
        .collect();
    for (k, o) in keys(v).iter().zip(&built) {
        assert_wire(o, &v[k], k);
    }
    let mut seen: Vec<&str> = built
        .iter()
        .map(|o| match o {
            RestoreOutcome::None => "none",
            RestoreOutcome::Restored { .. } => "restored",
            RestoreOutcome::Failed { .. } => "failed",
        })
        .collect();
    seen.sort();
    seen.dedup();
    assert_eq!(seen, ["failed", "none", "restored"]);
}

/// `{ "ExportFormat": [...], "BackupPhase": [...] }`: every value once, as the TS unions have them.
pub fn share_enums(v: &Value) {
    let formats: Vec<ExportFormat> = parse(&v["ExportFormat"]);
    assert_wire(&formats, &v["ExportFormat"], "ExportFormat");
    let mut names: Vec<&str> = formats
        .iter()
        .map(|f| match f {
            ExportFormat::Png => "png",
            ExportFormat::Jpeg => "jpeg",
            ExportFormat::Webp => "webp",
        })
        .collect();
    names.sort();
    names.dedup();
    assert_eq!(names.len(), 3);
    let phases: Vec<BackupPhase> = parse(&v["BackupPhase"]);
    assert_wire(&phases, &v["BackupPhase"], "BackupPhase");
    let mut names: Vec<&str> = phases
        .iter()
        .map(|p| match p {
            BackupPhase::Create => "create",
            BackupPhase::Restore => "restore",
        })
        .collect();
    names.sort();
    names.dedup();
    assert_eq!(names.len(), 2);
    assert_eq!(keys(v), ["BackupPhase", "ExportFormat"]);
}

/// One sample per state of the watermark's files, keyed by its `state`.
pub fn watermark_status(v: &Value) {
    let built: Vec<WatermarkStatus> = keys(v)
        .iter()
        .map(|k| {
            let s = &v[k];
            match get::<String>(s, "state").as_str() {
                "missing" => WatermarkStatus::Missing,
                "downloading" => WatermarkStatus::Downloading {
                    done: get(s, "done"),
                    total: get(s, "total"),
                },
                "ready" => WatermarkStatus::Ready,
                "failed" => WatermarkStatus::Failed {
                    message: get(s, "message"),
                },
                other => panic!("WatermarkStatus has no state `{other}`"),
            }
        })
        .collect();
    for (k, o) in keys(v).iter().zip(&built) {
        assert_wire(o, &v[k], k);
    }
    let mut seen: Vec<&str> = built
        .iter()
        .map(|o| match o {
            WatermarkStatus::Missing => "missing",
            WatermarkStatus::Downloading { .. } => "downloading",
            WatermarkStatus::Ready => "ready",
            WatermarkStatus::Failed { .. } => "failed",
        })
        .collect();
    seen.sort();
    seen.dedup();
    assert_eq!(seen, ["downloading", "failed", "missing", "ready"]);
}

pub fn watermark_check(v: &Value) {
    let c: WatermarkCheck = round_trip(v, "WatermarkCheck");
    assert!(
        c.watermark_id.is_some() && c.original_name.is_some() && c.exported_at.is_some(),
        "the sample fills every field"
    );
}
