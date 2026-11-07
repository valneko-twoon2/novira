---
covers:
  - backend/crates/novira-core/src/comfy/engine_sampling.rs
  - frontend/src/backend/engineSampling.ts
  - frontend/src/features/params/sections/GenerationSection.tsx
---
# Sampler and noise schedule of a picture

What a picture is sampled with, and how a user may choose it.

## Behaviour
- The `scheduler` setting is InvokeAI's: one name for a sampler and a noise schedule together (`sampler_for` in `comfy/graph.rs`). A model of the newer families runs its family's own pair whatever the setting says (`Family::sampling`); Anima follows the setting, with plain `euler` meaning its template's `euler / simple`.
- A picture may also name a ComfyUI sampler (`samplerName`) and a noise schedule (`noiseSchedule`) by their own names. Each replaces its half of what the setting or the family would run, on every family (`engine_sampling::with_choice`). The names are the `KSampler` lists of ComfyUI in `comfy/engine_sampling.rs`; `contract/engine-sampling.json` holds the screen's copy of them and both sides check it.
- The choice is applied in `graph::build` (so hires, drafts, tiles and upscale passes take it) and in the edit recipes. FLUX.2 takes its sigmas from `Flux2Scheduler`: only the sampler can be named there, and a noise schedule is refused (the screen hides the field).
- The worker records what ran as `sampling` (`split::ran_sampling`), also when the picture named its own. The viewer's row for it takes the choice back; the presets keep it, and a preset made before it existed clears the current choice.
- The screen's "auto" entries read "Auto (name)" with what they stand for: the family's own pair, or the one the scheduler setting maps to (`runningSampling`; `contract/scheduler-sampling.json` holds the table and Rust checks it against `sampler_for`).
- Before a job the engine's `KSampler` options are read: a name this ComfyUI lacks fails the job with the name.

## Boundaries
- Any name outside the two lists is refused before it reaches the prompt (`with_choice`), whatever the screen sent.
- Video, music and voice graphs do not read the choice.

## Known limits
- Nothing checks that a sampler suits a model: a name picked for a family that its template does not use (for example an SDE sampler on a flow model) runs and may give a poor picture.
- The lists are those of ComfyUI 0.3x; a newer ComfyUI's extra names are not offered until the lists change.
