//! Not a wire type: the frontend's lists of the samplers and noise schedules a picture may name
//! (`frontend/src/backend/engineSampling.ts`). They must be exactly the lists the backend accepts
//! (`comfy::engine_sampling`), so the screen offers nothing the backend refuses and hides nothing it takes.
use novira_core::comfy::engine_sampling::{SAMPLERS, SCHEDULES};
use serde_json::{json, Value};

pub fn engine_sampling(v: &Value) {
    assert_eq!(
        v,
        &json!({ "samplers": SAMPLERS, "schedules": SCHEDULES }),
        "engine-sampling.json"
    );
}
