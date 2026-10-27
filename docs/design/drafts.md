---
covers:
  - frontend/src/state/drafts.ts
  - frontend/src/state/draftForm.ts
  - frontend/src/features/drafts/**
---
# Drafts

Drafts draw many candidates with the same settings and different seeds only part of the way, so the user can pick the promising ones and draw only those to the end. They are ordinary queue jobs (generation.md) with a draft position.

## Behaviour

- A draft is a text-to-image or image-to-image job with `draftAt` (0 to 1). Its graph is a `KSamplerAdvanced` stopping `draft_step(N, f) = clamp(round(f * N), ceil(0.2 * N), N - 2)` steps after its start with `return_with_leftover_noise: disable`, for the SD family and every newer family on the shared graph (`backend/crates/novira-core/src/comfy/graph.rs`); FLUX.2 cuts its sigmas at that step instead (model-families.md). It needs at least 4 steps and no high-resolution fix, which the draft leaves out and the finished run keeps. The result is stored as an intermediate image.
- Image to image samples the schedule KSampler makes for its denoise `d` (`draft_schedule`: `int(N / d)` steps, starting `int(N / d) - N` in; the whole schedule from 0 above 0.9999), so the draft is the start of the finished run and the position is a share of the steps actually drawn. A strength of 0 is refused. Inpaint, outpaint and upscaling refuse drafts.
- Edit models (Flux Fill, Flux Kontext, Qwen-Image-Edit) refuse drafts. The Drafts view offers the Generate tab's picture models (`drawableModels`) less the edit models (`draftRefusal`, the file-name words the backend reads), and names the left-out ones.
- `frontend/src/state/drafts.ts` keeps a session: 1 to 24 candidates (Settings `draftCount`), random seeds, drawn to 0.25 to 0.6 of the steps (Settings `draftPosition`, percent), from the Generate tab's request (`buildRequestFor('generate')`), with another model when one is picked in the view. The screen's count and position (`state/draftForm.ts`) follow the settings until set. A session keeps the request's reference images and, for image to image, the stored source picture the queue answered with (`initImageUrl`); finishing and retrying send them again.
- Each candidate is kept or rejected; Continue queues a normal run from step 0 with that seed. A candidate whose finished picture failed, was cancelled or was deleted can be finished again (`canFinish`). Failed drafts are retried with the same seeds.
- Sessions live in local storage (`novira.drafts`); `GroupTabs.tsx` shows the latest 5 as tabs, the older in a popup by day with thumbnails (`DraftHistory.tsx`).

## Boundaries

| Boundary | Guard |
|---|---|
| The request sent to the queue | The same checks as any generation job (generation.md); the draft position and steps are checked again when the graph is built |

## Known limits

- Continue draws the whole picture again from step 0: it takes as long as a normal run.
- A session names its source picture by URL; when that picture is deleted, finishing fails like any job without its source.
