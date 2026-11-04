---
covers:
  - backend/crates/novira-core/src/models/civitai/updates.rs
  - backend/crates/novira-core/src/models/civitai/updates/**
  - frontend/src/state/modelUpdates.ts
---
# Notice of new model versions

An installed model that came from Civitai is checked for a newer version, so the person hears of it without opening the model's page. Where models are kept and installed is on [models.md](models.md); the search that finds them is on [browse.md](browse.md).

## Behaviour

- **New versions.** An installed model whose page names a Civitai version (`pageUrl`: `civitai.com/models/<id>?modelVersionId=<version>`) is asked about with `check_model_updates`: one request per 50 models, `GET /api/v1/models?ids=..&nsfw=true` (adult models come back only with `nsfw=true`, asked for because they are already installed; `models/civitai/updates.rs`). Each is compared with the newest version of the **same base model** that is public, not paid and published later than the installed one: a model page often holds an SDXL and a Flux version, and neither is an update of the other. The answer (`ModelUpdate`: the newer version's name, date and page) is kept in the browser storage (`state/modelUpdates.ts`, key `novira.modelUpdates`) and shows as a tag on the card, a row in the detail with a button that opens the newer version's page (`open_source_page`), and a notice once per new version. The Model Manager asks when it opens if the kept answer is over a day old, and the toolbar button asks at once; a failed automatic check says nothing, a failed button press does. What goes out is the model ids of the installed Civitai models (and the Civitai key, when one is saved), to the same address the search uses. Nothing is downloaded or changed: the person installs the new version from its page or from Browse.

## Known limits

- The new-version notice reads only models installed from a Civitai page that names a version (`pageUrl`); a model put in a folder by hand, or installed before the page was kept, has none. A version Civitai lists under another base model name, or an early access that is not free, is not offered. The newest version by date wins, which is not always the one the author means as the successor (a pruned or inpainting variant of the same base).
