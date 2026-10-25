//! Types that cross in both directions (`Serialize + Deserialize`): the fixture must survive a round trip unchanged.
use crate::round_trip;
use novira_core::types::*;
use serde_json::Value;

/// Round trip plus the `extra` exception: unknown fields are kept in `extra`, which would hide a renamed field.
pub fn metadata(v: &Value) -> GenerationMetadata {
    let meta: GenerationMetadata = round_trip(v, "GenerationMetadata");
    assert!(
        meta.extra.is_empty(),
        "fields unknown to Rust: {:?}",
        meta.extra.keys().collect::<Vec<_>>()
    );
    meta
}

pub fn generation_metadata(v: &Value) {
    let meta = metadata(v);
    assert!(
        meta.music.is_some()
            && meta.voice.is_some()
            && meta.hires_fix.is_some()
            && meta.manga_screen.is_some()
            && meta.sampling.is_some(),
        "the sample fills every field"
    );
}

pub fn enqueue_request(v: &Value) {
    let req: EnqueueRequest = round_trip(v, "EnqueueRequest");
    metadata(&v["params"]);
    assert!(req.comfy_graph.is_some_and(|g| g.thumbnail.is_some()));
    guidance_filled(&req.guidance);
}

/// The sample fills every guidance field (a flattened struct drops unknown keys, which the round trip catches).
fn guidance_filled(g: &Guidance) {
    assert!(
        g.mask_image_url.is_some() && !g.control_layers.is_empty() && !g.ref_images.is_empty(),
        "the sample fills the guidance"
    );
}

pub fn queue_item(v: &Value) {
    let item = round_trip::<QueueItem>(v, "QueueItem");
    metadata(&v["params"]);
    guidance_filled(&item.guidance);
}

/// `retry_queue_item`'s smaller size.
pub fn retry_size(v: &Value) {
    round_trip::<RetrySize>(v, "RetrySize");
}

pub fn progress_event(v: &Value) {
    round_trip::<ProgressEvent>(v, "ProgressEvent");
}

pub fn image_dto(v: &Value) {
    round_trip::<ImageDTO>(v, "ImageDTO");
    metadata(&v["metadata"]);
}

pub fn board_dto(v: &Value) {
    round_trip::<BoardDTO>(v, "BoardDTO");
}

/// `update_board`'s patch.
pub fn board_patch(v: &Value) {
    round_trip::<BoardPatch>(v, "BoardPatch");
}

/// `update_images`'s patch.
pub fn image_patch(v: &Value) {
    round_trip::<ImagePatch>(v, "ImagePatch");
}

/// The options header of `upload_image`.
pub fn image_options(v: &Value) {
    round_trip::<ImageOptions>(v, "ImageOptions");
}

pub fn model_config(v: &Value) {
    round_trip::<ModelConfig>(v, "ModelConfig");
}

pub fn starter_model(v: &Value) {
    round_trip::<StarterModel>(v, "StarterModel");
}

pub fn model_parts_report(v: &Value) {
    round_trip::<ModelPartsReport>(v, "ModelPartsReport");
}

pub fn model_install_job(v: &Value) {
    round_trip::<ModelInstallJob>(v, "ModelInstallJob");
}

pub fn saved_workflow(v: &Value) {
    round_trip::<SavedWorkflow>(v, "SavedWorkflow");
}

/// `save_workflow`'s input.
pub fn workflow_input(v: &Value) {
    round_trip::<WorkflowInput>(v, "WorkflowInput");
}

/// A saved comic project: the document is any JSON object, kept as it is.
pub fn comic_record(v: &Value) {
    round_trip::<ComicRecord>(v, "ComicRecord");
}

pub fn face_rig_preview_request(v: &Value) {
    round_trip::<FaceRigPreview>(v, "FaceRigPreview");
}
