# Design: what each feature does now

One page per feature, each the current specification of that feature: how it behaves, how it is built, its security boundaries, its known limits. Read the page of a feature before you change its code, and correct it in the same commit when the change makes it untrue. To find the page of a file: `node scripts/tools/docs-check.mjs --find <path>` (each page names the code it covers in its front matter). The rules for these pages are in `.claude/rules/docs.md`. How the parts fit together and where to start is in [../architecture/README.md](../architecture/README.md).

| Page | Feature |
|---|---|
| [runtime.md](runtime.md) | How the backend starts, runs and stops: layers, the data folder and its lock, storage, child processes, the self-contained build |
| [navigation.md](navigation.md) | The side bar, the number keys, and the media row with the Comic icon |
| [phone-layout.md](phone-layout.md) | The phone layout of the browser page: when it shows, its tabs, what each tab does and what it leaves out |
| [generation.md](generation.md) | The generation queue and worker, ComfyUI graphs for pictures, guidance (masks, control layers, reference images), the local engine, the GPU lock |
| [model-families.md](model-families.md) | The newer image model families (Anima, Flux, SD3...): their loaders, encoders, VAE and control patches |
| [drafts.md](drafts.md) | Drafts: candidates drawn part of the way, then finished one by one |
| [generation-sampling.md](generation-sampling.md) | The sampler and noise schedule of a picture: the scheduler setting, a family's own, and the ComfyUI names a picture may choose |
| [presets.md](presets.md) | Image presets, and the random preset run that queues pictures from several presets picked at random |
| [media-generation.md](media-generation.md) | Video, music, voice and logo generation |
| [workflows.md](workflows.md) | The node workflow editor: saved workflows, the editor state, saving and importing a workflow file |
| [workflow-graphs.md](workflow-graphs.md) | Running a workflow graph: the ComfyUI prompt the editor compiles, ComfyUI's own nodes in the editor, the result (picture, text, sound, video) |
| [models.md](models.md) | Model folders, install (including the folder scan), covers, keys and tokens |
| [model-packs.md](model-packs.md) | Model packs (video, music, voice, inpaint, logo), the starter list, hardware and fit marks |
| [browse.md](browse.md) | The Browse tab: searching Civitai and Hugging Face, the settings of a model's example pictures, adult-content filtering, opening their pages |
| [model-updates.md](model-updates.md) | The notice that an installed Civitai model has a newer version |
| [extensions.md](extensions.md) | ComfyUI custom node packs, the ComfyUI Registry, installing ComfyUI and switching its version |
| [assistant.md](assistant.md) | The AI assistant: providers, tools, the tool server, what it may read |
| [assistant-refine.md](assistant-refine.md) | The loop that keeps the assistant drawing trial pictures, up to 30, until it matches a picture or a description |
| [assistant-history.md](assistant-history.md) | What the assistant is told about the earlier chat: notes of what each answer changed or the user undid, and the Generate settings before each request |
| [assistant-models.md](assistant-models.md) | The model and thinking effort the assistant's command-line tool runs on: Claude's full names, Codex's list, the default the picker always names |
| [assistant-pictures.md](assistant-pictures.md) | The pictures the assistant sees: attachments the user makes, and a drawn comic page on the comic screen after the user allows it |
| [assistant-web-lookup.md](assistant-web-lookup.md) | The assistant's fact look-up on Wikipedia: the fixed hosts, the request, the limits, its own permission setting |
| [gallery-share.md](gallery-share.md) | The gallery's files and boards, the image scheme, export for sharing, the watermark and content credentials |
| [gallery-files.md](gallery-files.md) | Where the gallery's files are under `outputs/`: a folder per board, drafts apart, file names with the time |
| [gallery-trash.md](gallery-trash.md) | Deleting pictures: the trash that keeps them for 14 days, and undo and redo of a deletion |
| [image-tools.md](image-tools.md) | The picture tools (fix the face, remove the background, describe as a prompt, read poses): the "Fix" group of the picture menu that runs at once, the tool band over the viewer, runs that go on when the band closes |
| [gallery-view.md](gallery-view.md) | The gallery grid and the viewer on a picture being drawn: the cell at the start of the grid, the large live picture |
| [comic-canvas.md](comic-canvas.md) | The saved canvas document and comic projects, the font list |
| [comic-layers.md](comic-layers.md) | A comic page's layers (Canvas layers, one store per page), painting on a page, inpainting a page |
| [comic-drawing.md](comic-drawing.md) | How a comic panel is drawn: the jobs, the cast's words and reference pictures, regions, poses, the earlier pictures |
| [comic-rough.md](comic-rough.md) | A comic panel's 3D rough: mannequins, props, a floor and a camera, baked into the pose picture and a depth map |
| [comic-pages.md](comic-pages.md) | Comic page layouts, the page plan checks, the sound-effect pictures |
| [comic-scene.md](comic-scene.md) | The assistant's `scene` operation: a panel written as one scene and turned into prompt, pose and balloons |
| [first-run.md](first-run.md) | The first start of the desktop app: choosing the data folder and the ComfyUI folder before anything is opened |
| [settings-engine.md](settings-engine.md) | Settings, engine settings, low-memory mode, unfinished downloads, backup and restore |
| [ui-state-sync.md](ui-state-sync.md) | The screen state (`novira.*` keys) kept in the backend and followed live by the other open pages: the PC and phones |
| [browser-server.md](browser-server.md) | The real backend behind a plain web browser: the shared command layer, the localhost-only server with its token, the commands it answers, the picture route |
| [browser-server-start.md](browser-server-start.md) | Starting the browser server: its options, the data folder it opens (`--data`, `--app-data`), the launchers |
| [browser-server-lan.md](browser-server-lan.md) | The browser server on the home network (opened on demand): the TLS-only listener and its local CA, who is answered, the subnet check |
| [browser-server-pairing.md](browser-server-pairing.md) | Pairing a phone with the home-network listener: the pairing code and QR, the phone page, this computer's approval, sessions and their limits |
| [browser-server-remote.md](browser-server-remote.md) | Phones away from home over Tailscale: the remote listener with Tailscale's certificate, enrolling a passkey after pairing, signing in with it, the log, turning off when unused |
| [browser-server-app.md](browser-server-app.md) | Phones and the desktop app: the home-network and remote listeners run inside the app, the window's `lan_*` and `remote_*` commands, the built-in page and the picture URLs |
| [release-workflow.md](release-workflow.md) | The release built on GitHub when a version tag is pushed: the checks before it, the smoke test, the draft release, what the workflow may do |
| [ci.md](ci.md) | The checks GitHub runs on every branch push, and the order in which more are added |
| [security.md](security.md) | What is common to all: what is at stake, the IPC and CSP boundaries, an index of each feature's boundaries, limits that belong to no feature, how to re-check |
