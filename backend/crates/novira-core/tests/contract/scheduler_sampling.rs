//! Not a wire type: the frontend's table of the sampler and noise schedule each scheduler name runs
//! (`frontend/src/backend/schedulerSampling.ts`). It must be exactly what `sampler_for` says, so the Generate screen
//! shows what "auto" will run.
use novira_core::comfy::graph::sampler_for;
use serde_json::{json, Map, Value};

pub fn scheduler_sampling(v: &Value) {
    let mut expected = Map::new();
    for name in [
        "euler",
        "euler_a",
        "euler_k",
        "dpmpp_2m",
        "dpmpp_2m_k",
        "dpmpp_2m_sde_k",
        "dpmpp_sde_k",
        "heun",
        "lms",
        "ddim",
        "unipc",
        "lcm",
    ] {
        let (sampler, scheduler) = sampler_for(name).unwrap();
        expected.insert(
            name.into(),
            json!({ "sampler": sampler, "scheduler": scheduler }),
        );
    }
    assert_eq!(v, &Value::Object(expected), "scheduler-sampling.json");
    // The scheduler `tcd` is refused, so the table has no entry for it.
    assert_eq!(sampler_for("tcd"), None);
}
