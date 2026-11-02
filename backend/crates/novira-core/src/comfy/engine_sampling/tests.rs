use super::*;
use serde_json::json;

fn with(sampler: Option<&str>, schedule: Option<&str>) -> GenerationMetadata {
    let mut p: GenerationMetadata = serde_json::from_value(json!({
        "generationMode": "txt2img", "positivePrompt": "a cat", "negativePrompt": "", "modelKey": "m",
        "modelName": "M", "vaeKey": null, "seed": 42, "steps": 20, "cfgScale": 6.5, "cfgRescale": 0,
        "scheduler": "dpmpp_2m_k", "width": 1024, "height": 768, "clipSkip": 0, "seamlessX": false,
        "seamlessY": false, "loras": []
    }))
    .unwrap();
    p.sampler_name = sampler.map(Into::into);
    p.noise_schedule = schedule.map(Into::into);
    p
}

#[test]
fn nothing_chosen_keeps_what_the_setting_or_family_runs() {
    let p = with(None, None);
    assert!(!is_chosen(&p));
    assert_eq!(
        with_choice(("euler", "simple"), &p),
        Ok(("euler", "simple"))
    );
    // An empty name is the screen's "auto".
    let p = with(Some(""), Some(""));
    assert!(!is_chosen(&p));
    assert_eq!(
        with_choice(("euler", "simple"), &p),
        Ok(("euler", "simple"))
    );
}

#[test]
fn a_chosen_name_replaces_only_its_own_half() {
    let p = with(Some("res_multistep"), None);
    assert!(is_chosen(&p));
    assert_eq!(
        with_choice(("euler", "beta"), &p),
        Ok(("res_multistep", "beta"))
    );
    let p = with(None, Some("karras"));
    assert_eq!(with_choice(("euler", "beta"), &p), Ok(("euler", "karras")));
    let p = with(Some("dpmpp_2m"), Some("sgm_uniform"));
    assert_eq!(
        with_choice(("euler", "beta"), &p),
        Ok(("dpmpp_2m", "sgm_uniform"))
    );
}

#[test]
fn a_name_the_engine_does_not_list_is_refused() {
    for bad in ["nope", "EULER", "euler ", "../x", "euler\n"] {
        let err = with_choice(("euler", "simple"), &with(Some(bad), None)).unwrap_err();
        assert!(err.contains("sampler"), "{bad:?}: {err}");
        let err = with_choice(("euler", "simple"), &with(None, Some(bad))).unwrap_err();
        assert!(err.contains("noise schedule"), "{bad:?}: {err}");
    }
}

#[test]
fn the_lists_have_no_duplicates_and_hold_the_names_the_setting_maps_to() {
    for list in [SAMPLERS, SCHEDULES] {
        let mut sorted = list.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), list.len());
    }
    // Every pair `sampler_for` yields (the InvokeAI names) is a pair of listed names.
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
        let (sampler, schedule) = crate::comfy::graph::sampler_for(name).unwrap();
        assert!(SAMPLERS.contains(&sampler), "{name}: {sampler}");
        assert!(SCHEDULES.contains(&schedule), "{name}: {schedule}");
    }
}
