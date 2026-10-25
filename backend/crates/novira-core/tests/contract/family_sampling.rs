//! Not a wire type: the frontend's table of the sampling the backend fixes for a picture family
//! (`frontend/src/backend/familySampling.ts`). It must hold exactly `Family::picture_sampling` for every base model with
//! a picture family, so the Generate screen shows what runs.
use crate::{fixture, parse};
use novira_core::comfy::split::Family;
use novira_core::types::{BaseModel, Sampling};
use serde_json::{Map, Value};

pub fn family_sampling(v: &Value) {
    let bases: Vec<BaseModel> = parse(&fixture("enums")["BaseModel"]);
    let mut expected = Map::new();
    for base in bases {
        if let Some(family) = Family::of(base) {
            let (sampler, scheduler) = family.picture_sampling();
            let key = serde_json::to_value(base)
                .unwrap()
                .as_str()
                .unwrap()
                .to_string();
            let sampling = Sampling {
                sampler: sampler.into(),
                scheduler: scheduler.into(),
            };
            expected.insert(key, serde_json::to_value(sampling).unwrap());
        }
    }
    assert_eq!(v, &Value::Object(expected), "family-sampling.json");
}
