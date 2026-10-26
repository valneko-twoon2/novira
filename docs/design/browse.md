---
covers:
  - backend/crates/novira-core/src/models/civitai.rs
  - backend/crates/novira-core/src/models/civitai/**
  - backend/crates/novira-core/src/models/huggingface.rs
  - backend/crates/novira-core/src/models/content_filter.rs
  - backend/crates/novira-core/src/service/browse.rs
  - frontend/src/features/browse/**
---
# Browse: searching Civitai and Hugging Face

The Browse tab searches Civitai and Hugging Face for models and opens their pages. What it installs, where the files go and where the keys are kept is on [models.md](models.md); this page is the search and the pages it opens.

## Behaviour

- **Civitai search.** `source: civitai` calls `GET /api/v1/models` with the types for the kind, base models, licence filters, sort, period and cursor (`models/civitai.rs`). Covers are Civitai image addresses; a video is shown by its first frame (`anim=false`) and only when the version has no picture; the card plays it muted while the pointer is over it, and the detail view has the video's own controls (`features/browse/Cover.tsx`; `media-src` allows `https://*.civitai.com` for it), and pictures above the plain level are left out unless mature content is on. The base filter starts on every base (`all`, no base sent); its list holds the SDXL family (`sdxl-compat`), single bases sent by their Civitai name (`Illustrious`, `NoobAI`, `SDXL 1.0`, `Pony`, `SD 1.5`, `Anima`), and `FLUX.1` for the Flux variants (`FLUX_BASES`: Civitai has no base named `FLUX.1`, it names `Flux.1 D`, `Flux.1 S`, `Flux.1 Krea`, `Flux.1 Kontext`, `Flux.2 D` and the Klein ones, so they are asked for together) and `all` (`features/browse/BrowseBar.tsx`). Descriptions become plain text. A model without cover addresses shows an empty frame (with a note while mature content is off, since Civitai then leaves out every picture it rates above plain); only the browser mock stands a picture in.
- **Hugging Face search.** `source: huggingface` calls `GET /api/models` with tag filters (`lora`, `controlnet`, `text-to-image`, base-model tags), hub sorts and the `Link` cursor (`models/huggingface.rs`). A repository maps to one version, `main`, with its single model files; diffusers component folders are skipped. A repository without a model file is dropped. When filtering leaves fewer than 12 results, up to four pages are read.
- **Adult content.** The Browse bar switch (`includeNsfw`, off by default) goes with every search. Civitai applies it with its `nsfw` parameter. Hugging Face has no rating, so `models/content_filter.rs` (`looks_adult`) flags a repository by its `not-for-all-audiences` tag, an adult word in its name, tags, model card text or example prompts (not negative prompts), or its owner in `UNRATED_MIRRORS`. Private repositories are always dropped; while the switch is off, flagged ones are too. Hugging Face covers stay blurred until the switch is on (`features/browse/Cover.tsx`).
- **License tag.** Each model carries six permissions (`civitai::PERMISSION_KEYS`: from Civitai's `allowCommercialUse`, `allowDerivatives`, `allowDifferentLicense`, `allowNoCredit`; on Hugging Face from the license tag) and a summary that `civitai::commercial_of` makes from the first three (sell the pictures, generation services, sell the model): `allowed` when all three are allowed, `denied` when none is, `limited` otherwise, so the tag never says more than its list. Civitai's `RentCivit` (its own service only) counts as no generation services. Installed models keep the license they were given; on start-up `registry::corrected_license_summaries` brings a stored summary that an older version made differently in line with its permissions.
- **Opening pages.** `open_civitai_page` takes a model id of up to 12 digits and opens `https://civitai.com/models/<id>`. `open_huggingface_page` takes a plain `owner/repo` and opens `https://huggingface.co/<repo>`. `open_source_page` opens an `https` address with no user name on a host in `SOURCE_SITES` (`backend/crates/novira-core/src/models/install.rs`: the model sites, the code hosts and the two download sites, or a subdomain), up to 500 characters; extension source links and the homepages of the about dialog's open-source list use it too (see extensions.md and settings-engine.md). The browser starts with `rundll32.exe url.dll,FileProtocolHandler <url>` on Windows (`api::browser_command`), `xdg-open` elsewhere, never through a shell.
- **Civitai splits.** In `backend/crates/novira-core/src/models/civitai.rs`, several base models with a sort other than `newest` send one request per base, at once, each for an equal share of the page. `sdxl-compat` is `SDXL_COMPATIBLE`. The answers are merged without repeated ids and sorted by rating or downloads, then the license and safetensors filters. The next cursor is `multi:` and a JSON map of base to cursor; a base with no next page drops out, and a failing base is skipped unless all fail.

## Boundaries

| Boundary | Guard |
|---|---|
| Opening pages | `open_civitai_page` takes a numeric id, `open_huggingface_page` an `owner/repo` of plain characters, `open_source_page` an `https` address whose host is in `SOURCE_SITES` (or a subdomain of one; the extension manager's source link, the about dialog's homepages). A test keeps every homepage of the bundled open-source list on that list. The browser is started with the address as one argument, never through a shell. |

## Known limits

- Hugging Face and Civitai content filtering is best effort (see Adult content).
