---
covers:
  - backend/crates/novira-core/src/service/pack_store.rs
  - backend/crates/novira-core/src/packs.rs
  - backend/crates/novira-core/src/hardware.rs
  - frontend/src/state/hardware.ts
  - frontend/src/features/media/modelFit.ts
  - frontend/src/features/media/PackChoice.tsx
  - frontend/src/features/media/PackCard.tsx
---
# Model packs, starter models and fit marks

The extra model files that some kinds of media need (video, music, voice, inpaint, logo), the fixed list of starter models, and the hardware marks that say whether a pack fits the card. The model files themselves, their folders, install sources and keys are on [models.md](models.md).

## Behaviour

- **Packs.** Six packs, one per kind of media: `video` (Wan 2.2 TI2V 5B), `turbo` (the 4-step Wan 2.2 5B, which reuses the video pack's text encoder and VAE), `music` (ACE-Step 1.5 turbo), `voice` (the voice engine's libraries and Hugging Face models; see media-generation.md), `inpaint` (LaMa, `big-lama.pt`, from GitHub) and `logo` (Z-Image-Turbo 8-bit). Installs put files in `<data>/models/<kind>/`, outside the normal lists, and a pack also counts when its files are in `<root>/<kind>/` of any `modelRoots` folder (the same layout; the data folder's copy wins; read only: novira never installs, moves or deletes there, and an install skips a file that a shared root already holds). The voice engine also loads its models from there. A pack is ready when each file is in any root (`packs::find_file`, `voice::model_dir_in`); every pack except voice has its own `novira_<kind>` section in `extra_model_paths.yaml`.
- **Pack commands.** `pack_status`, `install_pack` and `cancel_pack` take the kind. `install_pack` downloads in the background and returns at once; a second call for a running pack does nothing. Progress arrives as `pack` events carrying the kind (`missing`, `downloading`, `installing`, `ready`, `error`); `bootstrap` returns all six statuses. A pack is ready when all its files exist; sizes and hashes are not checked. Cancelling returns it to what is on disk.
- **Starter models.** `list_starter_models` returns the fixed list in `backend/crates/novira-core/src/models/starter.rs`: single files from Hugging Face (`owner/repo::path`) or GitHub. The Starter Models tab (`frontend/src/features/models/InstallStarter.tsx`) installs one entry, or a base's entries not yet installed or queued. Bundles match the base exactly, so `any` entries (the CLIP ViT-H encoder, the upscalers) are in none, and the `flux` bundle is always disabled. Dependencies are only shown there. For a model loaded in parts, `model_parts` (`models/parts.rs`) asks `comfy::split` what the family needs, checks the installed models with the worker's name matching (`split::pick`) and returns the starter entries for what is missing (with `sizeBytes`) and the names of missing files that have no entry. The Generate panel (`state/modelParts.ts`) shows that as its first reason with a button that installs those entries; above 5 GB, and after every `model_added` of a main or diffusion model with parts missing, a confirmation opens first.
- **Hardware.** `hardware_info` reads the card (`hardware.rs`) on each call: `nvidia-smi` first (most memory), else on Windows the registry's `qwMemorySize` of the display adapters (most memory), else unknown. The page reads it once per session (`frontend/src/state/hardware.ts`).
- **Fit marks.** `modelFit.ts` rounds the memory to whole GB and compares it with `PACK_NEEDS` (minimum and comfortable GB per pack): comfortable, tight, short, or unknown. The video choice (`PackChoice.tsx`) recommends the first comfortable model, else the first tight one. `PackCard.tsx` shows the mark on a missing pack.
