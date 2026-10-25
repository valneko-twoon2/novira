---
description: After a model-related change, or when the user installed a model, run the model sweep in the real app and fix every category
paths:
  - "backend/crates/novira-core/src/models/**"
  - "backend/crates/novira-core/src/service/model_store.rs"
  - "backend/crates/novira-core/src/comfy/**"
  - "frontend/src/features/models/**"
  - "frontend/src/features/browse/**"
  - "frontend/src/features/params/model/**"
  - "frontend/src/state/models.ts"
  - "frontend/src/ui/ModelPicker.tsx"
  - "frontend/src/ui/CoverImage.tsx"
  - "tools/models-sweep*.mjs"
---

# Models are checked in the real app

Unit tests and the mock passed while real models went wrong: an Anima model showed no picture, an SDXL model got a wrong warning, a model waiting for its download was never looked at. What the user sees depends on real files, the real WebView and the real engine, so a model change is checked there by the agent, not left to the user.

## When

- After any change to a file this rule's `paths` name (`tools/models-sweep-lib.mjs`, `SWEEP_TRIGGERS` and `isSweepTrigger`, is the exact rule, shared by `tools/affected.mjs` and the Stop hook; tests and style sheets (`*.css`) alone do not count: the sweep reads files and pictures, not looks). `tools/affected.mjs` names the sweep for such a change, and the Stop hook asks for it when such a file was committed on the branch and no sweep record covers HEAD.
- When the user says they installed, moved or deleted a model: run it before answering anything about that model.

## How

1. Commit first (the record names the commit; uncommitted model files are recorded by content, so a later commit of the same content still counts).
2. From the repository root, also from a worktree: `NOVIRA_GPU_LOCK=<lock> node tools/models-sweep.mjs` (`--build` after a frontend or backend change, so the verification exe has it). Narrow with `--category <folder|type|rail entry|base>` or `--model <part of the name>` only to repeat a check; the run that closes the work covers at least the changed category and every other category on the same code path (a change to `CoverImage` touches every kind with a picture; a loader change touches every family that loader serves). `--via server` runs the same checks through `novira-server` and Playwright's Chromium (no window; it needs `NOVIRA_GPU_LOCK` and the data folder free just the same). It is the quick path while the user's own novira is open, but the gate stays the app's: a record made with `--via server` does not cover HEAD for the Stop hook, because the browser cannot see the `novira-image://` scheme, WebView2 rendering or native dialogs (`docs/verification.md`). Without `NOVIRA_GPU_LOCK`, or while the GPU is busy, or with `--no-gpu`, the job and graph checks are "not run", never "pass".
   The run uses the Civitai lookup OFF only. `--lookup` adds the round with the lookup ON, which sends the hash of every model file (the shared folder's too) to Civitai: run it only when the user asks. Without it the "b cover (lookup on)" column reads "not run (use --lookup)" and the verdict of a model with a picture kind reads "not run" for that reason alone. The gate (the Stop hook, `tools/affected.mjs`) counts an off-only record as covering HEAD; it asks for no lookup round.
3. Read the table (`novira-data/work/models-sweep/<time>/sweep.md` of the main checkout). Every `fail` is a fault until proved otherwise: reproduce it, fix the product code with a test, and search the other categories, surfaces and families for the same kind of fault (two components that show the same thing, two lists that filter the same models). Then sweep again.
4. Show the user the table and the folder of the screenshots, with what was not run and why. A check that cannot pass without a decision (a setting that is off by design, a family no screen runs) is listed as an open decision, not fixed by weakening the check.

## Limits

- The sweep drives the Models screen, the Generate screen's model, LoRA and VAE pickers and the Video screen. ControlNet, IP-Adapter and upscaler pickers are "n/a" with the reason: check them by hand when a change touches them, and add them to `tools/models-sweep-app.mjs` when they keep breaking.
- With the Civitai lookup off, a file put in the folder by hand gets no picture by design (the lookup sends the file's hash to Civitai); the sweep reports that as `n/a`.
- Pack folders (`video/`, `music/`, `voice/` and the like) are read from every model root. The sweep adds one row per pack to the table (checks a and b: the pack's files in any root and the app's pack status must agree; c and the cover are n/a), no job: a pack's models are used by their media screen, which the sweep does not drive. Other folders of a shared root that are neither a category nor a pack are named in the table header.
