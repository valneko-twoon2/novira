---
covers:
  - frontend/src/state/presets/imagePresets.ts
  - frontend/src/state/presets/presetRun.ts
  - frontend/src/features/params/presets/**
---
# Image presets and the random preset run

Image presets keep a set of Generate settings under a name, to put back in one step. The random preset run queues a number of pictures, each drawn with one of several chosen presets picked at random, so pictures with very different prompts, sizes and models come out of one press without changing the form.

## Behaviour

### Presets

- A preset holds the fields in `PRESET_FIELDS` (`frontend/src/state/presets/imagePresets.ts`): prompts, model, VAE, sampler settings, size, LoRAs, reference images, the image-to-image strength, the dynamic prompt mode, the inpaint settings, the Upscaling settings and the high-resolution fix. It never holds the seed, the iteration count, the picture to draw over or the picture to upscale. Pasted or dropped reference pictures keep their slot without the picture.
- `presetPatch` is what a preset changes in a set of settings: only the fields the preset holds, with a model that is no longer installed (main, upscale, tile ControlNet, post-processing, high-resolution fix) replaced by the one the settings already have. Applying a preset (`applyPresetData`) writes that patch into the form; `withPreset` makes a copy of the settings with it, leaving the form alone.
- The presets live in local storage (`novira.presets`), follow other open pages (ui-state-sync.md), and start with three built-in ones (size, steps, CFG and scheduler only), seeded from `frontend/src/state/presets/seed/image.json`.
- The preset bar (`GenerationPresetBar.tsx`, the shared `PresetBar` and `PresetPicker` in `frontend/src/ui/`) sits at the top of the left panel of the Generate, Canvas, Upscaling and comic screens.

### Random preset run

- Only on the Generate tab's picture form: a shuffle button after the preset bar's save button (`PresetRunButton.tsx`) opens a popover with a check box per preset, the number of pictures and Add to queue. The ticked ids and the number are kept in `novira.presetRun` (`usePresetRun`, following other pages); ids of presets deleted since are ignored.
- The number is a whole number from 1 to `MAX_RUN_COUNT`, the Invoke count box's limit. Add to queue is disabled while no existing preset is ticked.
- Before queueing, each ticked preset is checked with the Generate tab's own readiness (`generateReadiness`) on the form with that preset applied (`presetRunProblems` in `frontend/src/features/params/presets/presetRun.ts`); the popover lists the preset's name and its first reason, and nothing is queued while any preset fails.
- `presetRunRequests` makes one request per picture: the preset is `presets[floor(random() * n)]` (every ticked preset equally likely, no weights), the request is built by `generateRequestOf` (`frontend/src/features/params/buildRequest.ts`) from `withPreset(form, preset.data)`, with one iteration and a fresh random seed (`randomSeed`). What the preset does not hold, including the picture to draw over, comes from the form. The random source and the seed source can be passed in (tests).
- Dynamic prompts in a preset are expanded in random mode whatever the preset's mode (`dynamicBatches(request, 'random')`): each picture gets one prompt picked by its seed, so the count stays the count of pictures.
- `runPresets` enqueues the requests one by one at the back of the queue in the order they were picked, so consecutive pictures may use different models (each switch reloads the model in the engine). It then leaves the launchpad for the viewer, like Invoke, and shows how many items were queued; a failed enqueue shows its error and keeps the items already queued.
- The form is never written: the requests are built from copies, so no store subscriber sees a change (the unit tests check this).

## Boundaries

No boundary of its own: the run uses the same `enqueue` command as Invoke, and the backend checks each request as it checks any other (generation.md).

## Known limits

- A preset's model is checked only for being installed and drawable; whether its text encoders or VAE files are present is known only for models whose parts were already looked up (`modelPartsReason`), so a missing part of another preset's model shows as a failed job.
- Large runs are sent as one enqueue per picture.

## Not implemented

- Weights per preset, an endless run, and running presets on the other screens (Canvas, Upscaling, comic, video, music, voice).
- The AI assistant cannot start a run; its guide only explains it.
