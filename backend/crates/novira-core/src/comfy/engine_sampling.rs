//! The samplers and noise schedules of ComfyUI's `KSampler`, chosen by their own names.
//!
//! The `scheduler` setting is InvokeAI's (a sampler and a schedule in one name, `sampler_for`), and a model of the newer
//! families runs its family's own. A picture's `sampler_name` and `noise_schedule` replace one or both of what that
//! would run, whichever the model is. Both are checked against the lists below before they reach the engine's prompt.
use crate::types::GenerationMetadata;

/// `KSampler`'s `sampler_name` options in ComfyUI 0.3x (`frontend/src/backend/mock/comfyCoreDefs.json`). The contract
/// fixture `contract/engine-sampling.json` is this list and `SCHEDULES`, so the screen's copy cannot drift.
pub const SAMPLERS: &[&str] = &[
    "euler",
    "euler_cfg_pp",
    "euler_ancestral",
    "euler_ancestral_cfg_pp",
    "heun",
    "heunpp2",
    "exp_heun_2_x0",
    "exp_heun_2_x0_sde",
    "dpm_2",
    "dpm_2_ancestral",
    "lms",
    "dpm_fast",
    "dpm_adaptive",
    "dpmpp_2s_ancestral",
    "dpmpp_2s_ancestral_cfg_pp",
    "dpmpp_sde",
    "dpmpp_sde_gpu",
    "dpmpp_2m",
    "dpmpp_2m_cfg_pp",
    "dpmpp_2m_sde",
    "dpmpp_2m_sde_gpu",
    "dpmpp_2m_sde_heun",
    "dpmpp_2m_sde_heun_gpu",
    "dpmpp_3m_sde",
    "dpmpp_3m_sde_gpu",
    "ddpm",
    "lcm",
    "ipndm",
    "ipndm_v",
    "deis",
    "cfgpp_ud10_ab",
    "res_multistep",
    "res_multistep_cfg_pp",
    "res_multistep_ancestral",
    "res_multistep_ancestral_cfg_pp",
    "gradient_estimation",
    "gradient_estimation_cfg_pp",
    "er_sde",
    "seeds_2",
    "seeds_3",
    "sa_solver",
    "sa_solver_pece",
    "ddim",
    "uni_pc",
    "uni_pc_bh2",
];

/// `KSampler`'s `scheduler` options (the noise schedules).
pub const SCHEDULES: &[&str] = &[
    "simple",
    "sgm_uniform",
    "karras",
    "exponential",
    "ddim_uniform",
    "beta",
    "normal",
    "linear_quadratic",
    "kl_optimal",
];

/// Whether the picture asks for a sampler or a noise schedule of its own.
pub fn is_chosen(p: &GenerationMetadata) -> bool {
    named(&p.sampler_name).is_some() || named(&p.noise_schedule).is_some()
}

fn named(v: &Option<String>) -> Option<&str> {
    v.as_deref().filter(|s| !s.is_empty())
}

/// `base` (what the setting or the family runs) with the picture's own sampler and noise schedule put over it. A name
/// that is not in the lists is refused: it would otherwise be sent to the engine as the user wrote it.
pub fn with_choice(
    base: (&'static str, &'static str),
    p: &GenerationMetadata,
) -> Result<(&'static str, &'static str), String> {
    let pick = |chosen: &Option<String>, list: &[&'static str], base: &'static str, what: &str| {
        match named(chosen) {
            None => Ok(base),
            Some(name) => list
                .iter()
                .find(|s| **s == name)
                .copied()
                .ok_or_else(|| format!("Unknown {what} '{name}'")),
        }
    };
    Ok((
        pick(&p.sampler_name, SAMPLERS, base.0, "sampler")?,
        pick(&p.noise_schedule, SCHEDULES, base.1, "noise schedule")?,
    ))
}

#[cfg(test)]
mod tests;
