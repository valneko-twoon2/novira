---
covers:
  - backend/crates/novira-core/src/service/queue.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/service/mod.rs
  - backend/crates/novira-core/src/service/guidance.rs
  - backend/crates/novira-core/src/service/memory.rs
  - backend/crates/novira-core/src/comfy/graph.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/comfy/process.rs
  - backend/crates/novira-core/src/engine.rs
  - backend/crates/novira-core/src/gpu_lock.rs
  - backend/crates/novira-core/src/child_job.rs
  - backend/crates/novira-core/src/media/images.rs
  - frontend/src/state/drafts.ts
  - frontend/src/state/outOfMemory.ts
  - frontend/src/backend/tauri/TauriBackend.ts
---
# Generation

Generation makes the pictures: a queue of jobs that run one at a time, the ComfyUI graphs they send to the engine, drafts, the checks that refuse requests the engine cannot run, and the ComfyUI process the app owns. Video, music, logo and voice are queue jobs too (see media-generation.md); the engine's install is in extensions.md.

## Behaviour

### Queue

- States: `pending`, `in_progress`, `completed`, `failed`, `canceled` (`QueueItemStatus` in `backend/crates/novira-core/src/types.rs`). Each change is saved to the `queue` table before it is announced (`set_status`).
- `enqueue` makes one item per iteration, each with its own seed, and saves them all before returning; if saving fails, the whole request is refused. A request above 1000 iterations (`MAX_ITERATIONS`, the Invoke box's limit) is refused before any item is made. `prepend` puts items before the first pending one. Reference images, control layers and reference pictures are copied into the item's parameters.
- The worker (`run_worker`, started once at start-up) runs the first pending item when the queue is not paused and nothing runs. Per job: resolve models and pictures (`engine_job`, `job_guidance`), `Engine::validate`, GPU lock, `Engine::generate`, save the PNG, then `completed` and `image_added`.
- `validate` (ComfyUI jobs) builds the graph before anything is uploaded, makes sure ComfyUI answers, and checks that the models, nodes and sampler the job needs are there (`comfy/client.rs`).
- A text output (a graph job ending in `PreviewAny`) completes with `resultText` and no picture. A graph job can also end in a sound or a video, stored like the Music and Video tabs' results ([workflow-graphs.md](workflow-graphs.md)). A failure whose text says the device ran out of memory is marked `errorKind: out_of_memory`. A panic fails only that job, with "Internal error: ..." as its text.
- Pause (`pause_processor`, `resume_processor`) only decides whether the next job starts; a running job finishes.
- Cancel (`cancel_queue_item`, `cancel_batch`): a pending or running item becomes `canceled` at once. A running job's token is cancelled, which also ends a wait for the GPU lock; the engine removes the prompt from ComfyUI's queue and posts an interrupt naming its prompt id (`ComfyEngine::interrupt`).
- Retry (`retry_queue_item`): a failed or canceled item is queued again as a new item at the end, with the same parameters and seed. A picture made from a prompt may get a smaller size: multiples of 8, at least 64, not larger than before (`check_retry_size`).
- `clear_queue` removes every item (cancelling a running one); `prune_queue` removes finished items only.
- Restart: at start-up an `in_progress` item becomes `failed` with "Interrupted because novira was closed" and is not run again. Pending items are kept, and the processor starts paused if any exist (`service/mod.rs`). A job still running at shutdown becomes `canceled` with the same text.

### GPU lock

- The `gpuLock` setting: `auto` (default) reads `NOVIRA_GPU_LOCK`; a path is used as it is; `""` turns locking off (`Settings::gpu_lock_path`).
- Jobs that use the GPU take it before generating: ComfyUI jobs (after validation), voice jobs. A waiting job shows "waiting for GPU lock" and can be cancelled.
- The lock is a directory made with `mkdir`, released when its guard drops and at exit. novira writes `<lock>.owner` beside it (process id and start time). A lock whose recorded process has gone is taken over; a lock without that record is never removed.

### ComfyUI graphs

- Core nodes only, except reference images. Common part: `CheckpointLoaderSimple` (or a `VAELoader`), one `LoraLoader` per enabled LoRA, `CLIPSetLastLayer` for clip skip, `RescaleCFG` when CFG rescale is above 0, two `CLIPTextEncode`, and `PreviewImage` as output.
- Modes: text to image (`KSampler`); image to image (denoise = strength, default 0.7); inpaint and outpaint (below); upscale (optional `UpscaleModelLoader` and `ImageUpscaleWithModel`, then `ImageScale` to the target size, then an image to image pass, with an optional tile ControlNet and post-processing model). The screen picks a tile ControlNet of the main model's base when one is installed and otherwise runs without one (Anima, Qwen-Image and the other families with no tile ControlNet); a stored tile that does not fit the main model is not sent (`buildUpscaleRequest`).
- High-resolution fix (text to image only): after the first pass the picture is enlarged (upscale model, then Lanczos `ImageScale`), encoded again and redrawn with the same seed at the fix's strength and steps. Scale 1 to 4; strength above 0, at most 1.
- Scheduler names map to sampler and scheduler pairs (`sampler_for`).
- Inpaint and outpaint: the mask (white redraws, grey less) is scaled to the output size, grown and blurred (default blur 16). It sets the noise mask of the encoded source (`SetLatentNoiseMask`, with `DifferentialDiffusion` for grey values); the result is pasted back with `ImageCompositeMasked`, so pixels outside the mask stay the source's. For outpaint the canvas fills the empty part first (`frontend/src/features/canvas/render/generationInputs.ts`). No inpaint model is needed.
- Control layers: `ControlNetLoader` once per model, then `ControlNetApplyAdvanced` per layer over positive and negative; strength is the weight, `start_percent` and `end_percent` the begin and end. `more_control` leaves the negative side without the control; `more_prompt` runs as balanced (no core equivalent). A layer may say what its picture shows (`controlType`); a union ControlNet of the SD family (`is_union_controlnet`: named so, by name, file or source) then gets `SetUnionControlNetType` after its loader.
- Reference images (IP-Adapter) need the ComfyUI_IPAdapter_plus node pack: `IPAdapterModelLoader` and `CLIPVisionLoader` once per file, then `LoadImage` and `IPAdapterAdvanced` per image on the model (`combine_embeds: concat`, `embeds_scaling: V only`); a reference with `regionImageUrl` gets that picture as its `attn_mask`. The method maps to the pack's `weight_type` (`ipadapter_weight_type`). The encoder is the installed CLIP vision model of the wanted size (ViT-H, ViT-G or ViT-L, from file name or layer count). Starter models include IP-Adapter SDXL and SD 1.5 (ViT-H) from `h94/IP-Adapter`. Without the pack, validation fails before any upload, and the readiness check (`frontend/src/state/comfy/packNeeds.ts`) asks for it.
- The job's pictures are uploaded to ComfyUI's input folder when it runs. Success is read from `/history`; progress and previews come from `/ws`, with polling when the socket is missing.
- After an out-of-memory failure, `POST /free` unloads ComfyUI's models before the next job.
- Recorded real-app checks: inpaint and outpaint kept the pixels outside the mask within one 8-bit level; a canny control layer followed the source's edges.

- Newer model families (Anima, Flux, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow) use this same graph with their own loaders, shift, latent and sampler: see model-families.md.

### Drafts

- A draft is a text-to-image job with `draftAt` (0 to 1). Its graph is a `KSamplerAdvanced` stopping at `draft_step(N, f) = clamp(round(f * N), ceil(0.2 * N), N - 2)` with `return_with_leftover_noise: disable`, for the SD family and every newer family on the shared graph; FLUX.2 cuts its sigmas at that step instead (model-families.md). Edit models refuse drafts. It needs at least 4 steps and no high-resolution fix. The result is stored as an intermediate image.
- The Drafts view offers the Generate tab's picture models (`drawableModels`) less the edit models (`draftRefusal`: the file-name words the backend reads), names those under the controls and does not start a batch with one.
- `frontend/src/state/drafts.ts` keeps a session: 1 to 24 candidates (Settings `draftCount`, 4) with random seeds, drawn to 0.25 to 0.6 of the steps (default 0.35). Each is kept or rejected. Continue queues a normal run with that seed from step 0. Sessions live in local storage (`novira.drafts`) and follow the queue items.

### Guidance checks

- At enqueue (`service/guidance.rs`, `check`): at most 8 control layers, 8 reference images and 4 reference pictures (`referencePictures`, FLUX.2 only: model-families.md); guidance only for text to image, image to image, inpaint and outpaint; a mask only for inpaint and outpaint, required for both, and only with a source; `controlLayerCount` and `refImageCount` equal the pictures sent; control weight 0 to 2, reference weight -1 to 2; begin and end in 0 to 1, begin not after end.
- In the worker (`job_guidance`): a control model must be of kind ControlNet, a reference model of kind IP-Adapter, both fitting the main model's base (same base, or either is `Any`); the CLIP vision model must be installed. A main model whose base is not SD 1.5, SD 2, SDXL or any is refused (`engine_job`), unless it is of a family with a recipe in `comfy/split.rs`. A control model may also be a model patch.
- Guidance pictures are read from `novira-data/outputs/` and cannot be videos or audio. A video cannot be the source image.
- Seamless tiling (`seamlessX`, `seamlessY`) uses the seamless tiling pack's nodes: `SeamlessTile` (`enable`, `x_only` or `y_only`, on a copy of the model) after the LoRAs and reference images, and `CircularVAEDecode` instead of `VAEDecode` at every decode (both passes of the high-resolution fix). Models of the newer families refuse it. `validate` names a missing pack (`split::packs_needed`, with the GGUF pack's nodes) and its address.
- Regional guidance: `regionalGuidanceCount` equals the layers sent (at most 8; each a stored picture, white region on black, with a positive or negative prompt, at most 10,000 characters). In the graph each layer's prompt is a `CLIPTextEncode` limited to the region by `ConditioningSetMask` (the region through `ImageToMask`) and added to the positive or negative side with `ConditioningCombine`; with `autoNegative` the positive prompt is also added to the negative side limited to the outside of the region (`InvertMask`). Models of the newer families refuse them. A region's reference images are not sent.

### Local engine

- Without `comfyuiUrl` the app owns its ComfyUI. `open` takes a free loopback port; `ComfyProcess::start` runs `main.py` with that host and port, the extra model paths file, and `comfyuiArgs`, with no console window (Windows) and output to `logs/comfyui.log` (`backend/crates/novira-core/src/comfy/process.rs`).
- Python: `comfyuiPython`, else the venv or embedded Python in the ComfyUI folder (`find_python`); if none exists, `python` from PATH. Caches and temporary files go to `novira-data/cache/` (`cache_env`).
- Start: at app start (`prepare_engine`) and on the first job if that failed. `ensure_ready` waits up to `comfyuiStartTimeoutSecs` (default 180). Its state goes out as `engine_status` events: `idle`, `downloading`, `extracting`, `starting`, `ready`, `error`.
- Stop: at exit the owned process is stopped. On Windows it also joins a job object that kills it if the app dies (`child_job.rs`).
- With `comfyuiUrl` set, the app connects to that server and starts and stops nothing.
- Low-memory mode (`lowMemoryMode`, `service/memory.rs`): the owned ComfyUI starts with `--novram` in place of the user's VRAM options (not with `--cpu`). Changing it restarts ComfyUI when no job runs; otherwise it applies at the next start.
- A finished picture is written as `outputs/<uuid>.png` with its settings in a `novira_metadata` text chunk (`media/images.rs`); for a model of the newer families the worker adds `sampling`, the sampler and scheduler that ran (model-families.md).

## Boundaries

| Boundary | Guard |
|---|---|
| Pictures a job uses | The source, the inpaint mask, control pictures, reference images and reference pictures arrive as gallery URLs only; `enqueue` resolves each to a checked image name (`image_name_from_url`) and refuses anything else, so a job cannot read a file by path. Pictures rendered in the page are first stored through the upload path (`TauriBackend.stored`). `service::guidance::check` bounds the request (counts, weights, ranges, lengths of keys and URLs). |
| Local engine | The owned ComfyUI listens on `127.0.0.1` only and is started by the app; a `comfyuiDir` started at a `comfyuiUrl` must also be on this PC, or the start is refused (Local engine). ComfyUI itself refuses cross-origin browser requests. Its caches and temporary files stay inside `novira-data/cache/`. |

## Known limits

- A local program can still connect to ComfyUI's loopback port while the app is running.
- Reference images run nodes of a third-party custom node pack (ComfyUI_IPAdapter_plus, no longer maintained upstream) inside ComfyUI's Python.
- With both `comfyuiUrl` and `comfyuiDir` set, the folder's ComfyUI, if started because the URL does not answer, listens on the host and port of `comfyuiUrl`; `Backend::open` refuses a host not on this PC (`comfy::process::is_this_pc`), naming `comfyuiUrl`. A `comfyuiUrl` alone may point anywhere: nothing is started for it.

## Not implemented

- FLUX Redux and the `tcd` scheduler (ComfyUI's core has no `tcd` sampler). Each is refused with a reason before any GPU work.
