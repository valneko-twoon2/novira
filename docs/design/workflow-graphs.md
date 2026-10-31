---
covers:
  - backend/crates/novira-core/src/comfy/user_graph.rs
  - backend/crates/novira-core/src/comfy/client.rs
  - backend/crates/novira-core/src/service/worker.rs
  - frontend/src/features/workflows/comfyPrompt.ts
  - frontend/src/features/workflows/comfyNodes.ts
  - frontend/src/features/workflows/invokeBuilder.ts
  - frontend/src/features/workflows/promptSummary.ts
  - frontend/src/features/workflows/templates.ts
  - frontend/src/features/workflows/graphTemplates.ts
  - frontend/src/state/comfy/comfyNodes.ts
  - frontend/src/state/comfy/graphJob.ts
  - frontend/src/state/comfy/runGraph.ts
---
# Running a workflow graph

What happens when a graph of the workflow editor is run: the checks before it, the ComfyUI prompt the editor compiles from it, the nodes of ComfyUI the editor offers, and what the backend does with the prompt and its result. Every graph is sent to ComfyUI as that prompt, built-in nodes, ComfyUI's own nodes (pictures, video, music, any of them) and the nodes of custom packs alike, and the result may be a picture, text, a sound or a video. The built-in Read Aloud node (`voice_speak`) has the voice engine make speech before the run. Only a graph that makes a video with the Generate Video node runs on the backend's own video path. The editor, the saved workflows and the files are in [workflows.md](workflows.md); installing packs is in [extensions.md](extensions.md).

## Behaviour

### Readiness and the request

- Readiness (`readinessReasons`, `frontend/src/features/workflows/invokeBuilder.ts`) blocks the run without an output node, with a required input neither connected nor set, with an invalid edge, when an IP-Adapter node that feeds a sampler lacks its extension or its image encoder (`packMissing`, `encoderMissing`, `frontend/src/state/comfy/packNeeds.ts`), when a choice of a ComfyUI node (a model file) is not in the list ComfyUI reports now or the list is empty (`choiceReasons`), or when the prompt cannot be compiled.
- `buildRequest` makes one of two requests (`runsAsPrompt`):
  1. A ComfyUI prompt: every graph, unless it has a Generate Video node and no node of ComfyUI or of a pack. `frontend/src/features/workflows/comfyPrompt.ts` compiles the graph into a ComfyUI API prompt. Built-in nodes become core nodes; the nodes of ComfyUI and of packs pass as they are, with the inputs that are active (below). An IP-Adapter node becomes `IPAdapterModelLoader`, `CLIPVisionLoader` and `IPAdapterAdvanced` on the model the sampler runs. Integer Math and Float Math are worked out while compiling, from plain numbers. A picture a built-in node holds itself is loaded by its own `LoadImage`. Placeholders stand for what only the backend knows: `$model`, `$clip_vision`, `$image`, `$sampler_name`, `$scheduler`, `$seed`, `$speech`. A Read Aloud node becomes a `LoadAudio` whose `audio` is `{"$speech": {text, language, mode, speaker, instruct}}` (its text must be typed in the node or come from a String node, and a preset or described voice follows the Voice tab's rules). The request has mode `graph` and `comfyGraph` (`prompt`, `outputs`); Save Image is the first output. Iterations come from `state/params`; the board from Save Image. The params only describe the run for the gallery: for built-in nodes the model, VAE and LoRA nodes, the prompts, the sampler settings, the size of the noise node and the strength of a picture-to-picture graph; for a graph of ComfyUI's own nodes what `promptSummary.ts` reads off the compiled prompt (its first sampler, the text behind its conditioning, the model it loads, the size or length of its latent, the frame rate of Create Video).
  2. Video (a Generate Video node and no pack node, `buildVideoRequest`): its fields and wired image become a `video` request. With a pack node the Generate Video node is refused.
- The generation mode `workflow` is no longer sent; older pictures carry it, and `comfy/graph.rs` still builds a prompt for it.
- Every request carries the serialized graph. The worker writes it into the PNG as `novira_workflow` (`service/worker.rs`), so a picture keeps its graph (`ImageDTO.workflow`).

### Graph jobs in the backend

- Enqueue (`service/queue.rs`) copies `comfyGraph` and `workflow` without checking them.
- `graph_job` (`service/worker.rs`) calls `user_graph::prepare` (`backend/crates/novira-core/src/comfy/user_graph.rs`). It refuses: no output; an output or thumbnail missing from the prompt; a node without `class_type` or `inputs`; a link to a missing node; any placeholder but the seven above; an unknown scheduler; an unknown CLIP vision size; a model key not in the library (`resolve_model`); a speech with no text, with text over 4000 characters or a description over 500, a described voice with no description, or more than 8 different speeches.
- `$model` becomes the model file ComfyUI loads. `$clip_vision` (`ViT-H`, `ViT-G` or `ViT-L`) becomes the installed CLIP vision model of that size, found the way reference images find theirs (`clip_vision_model`, `backend/crates/novira-core/src/service/guidance.rs`); both are checked against ComfyUI's model lists. `$image` must be a valid gallery file name (`images::is_valid_name`, via `original_path`); the picture is uploaded to ComfyUI's input folder when the job runs. `$seed` is the item's seed. `$speech` becomes `{"$image": "speech-<n>.wav"}`: the same speech written twice is made once, and the name is not read from the gallery (`PreparedGraph.speeches`).
- Speech (`process`, `speak_for_graph`, `backend/crates/novira-core/src/service/worker.rs`): a graph with speeches takes the GPU lock first, then the voice engine reads each one (`synthesize`, the same call the Voice tab's job makes) and the WAVs join the uploads of the run, then the voice worker is stopped because its model holds GPU memory ComfyUI needs, and only then is ComfyUI run. A speech that fails (engine not installed, an error, a cancel) ends the job before ComfyUI is asked.
- The engine (`backend/crates/novira-core/src/comfy/client.rs`) checks that ComfyUI sees the models and that every node class is in its `object_info` (`validate_graph`), then uploads pictures, videos and sounds (by their extension) and runs. Only the first output's result is read (`outputs.first()`).
- The kind of the result comes from the file that output saved (`fetch_result`, `result_kind`): `.mp3`, `.wav` and `.flac` are a sound, stored by `store_audio` (a waveform thumbnail); `.mp4` is a video, stored with the first frame the graph's `thumbnail` node showed (`store_video`; a video with no such node is refused); anything else is a picture. Sound in `.opus`, `.ogg`, `.m4a` or `.aac` and video in `.webm`, `.mkv` or `.mov` are refused with the way out, since the gallery keeps only MP3, WAV, FLAC and MP4.
- Text: if that output reports text and no file (`PreviewAny`), the result is `EngineOutput::Text`. The item completes with `resultText`, no picture is stored and no `image_added` event is sent. The frontend waits with `runTextJob` (`frontend/src/state/comfy/runGraph.ts`).

### Node definitions from ComfyUI

- `useComfyNodes` (`frontend/src/state/comfy/comfyNodes.ts`) holds ComfyUI's `object_info` (the `node_defs` command). The splash gate loads it once the backend and engine are ready (`frontend/src/features/splash/useSplashGate.ts`), and it is read again after a ComfyUI version switch or a restart (`frontend/src/state/comfy/nodePacks.ts`). A newly installed pack appears after that restart.
- `frontend/src/features/workflows/comfyNodes.ts` turns each node of a custom pack and each node of ComfyUI itself (`nodes` and `comfy_extras.*`) into a template of type `comfy:<ClassName>`. Deprecated nodes and the cloud API nodes (`api_node`, `comfy_api_nodes.*`, which need an account with a paid service) are skipped. The picker groups ComfyUI's nodes by the first two parts of their category, under a heading of their own (`group`). Each template also keeps its whole category (`comfyCategory`), the folders of the Nodes tab, and its place in ComfyUI's list (`comfyOrder`), their order.
- Types with an editor equivalent map to it; primitives become fields, choice lists enums (a number in the list goes back as a number: `values`), and upload inputs gallery pickers: a picture (`image_upload`), a video or a sound (`video_upload`, `audio_upload`: a field with `media`, whose gallery file is uploaded when the graph runs). An input marked `hidden` is not offered.
- A V3 dynamic combo (Save Audio's format, Save Video's container and codec) is an enum followed by the inputs each choice brings, named as the prompt names them (`format.quality`) and shown only while their choice is made (`when`, `isActive`). The same input under several choices with the same definition is one input; with another definition (the qualities of MP3 and of Opus) it is a second input `format.quality#2` that goes into the prompt as `format.quality` (`promptName`). Auto-grow inputs are listed as unsupported.
- ComfyUI's own words in the app's language (`comfy_ui_locale`, `backend/crates/novira-core/src/comfy/ui_locale.rs`): read as data from the locale files of the frontend the running ComfyUI serves, kept in `frontend/src/state/comfy/comfyUiLocale.ts` (read when the node definitions load and when the language changes) and used through `frontend/src/features/workflows/comfyWords.ts`: category, heading, node, input and output names, descriptions and help. Without a word (English, a missing language, a pack's node, the browser mock) the own name stays.
- The browser mock offers ComfyUI's own nodes in ComfyUI's order: the hand-made `comfyCoreDefs.json` and, read only by the mock, `comfyMoreCoreDefs.json` (`frontend/scripts/mock-comfy-defs.mjs`, choices naming files emptied).
- Registry packs grouped by purpose: [extensions.md](extensions.md).

## Boundaries

| Boundary | Guard |
|---|---|
| Graph sent to ComfyUI (`comfyGraph`) | `user_graph::prepare` checks structure and placeholders; `$image` reads gallery file names only (pictures, videos and sounds), `$model` library keys only, `$clip_vision` one of three sizes, `$speech` a bounded text and description (at most 8 different speeches); `validate_graph` accepts only classes ComfyUI reports. |
| ComfyUI's locale files (`ui_locale.rs`) | Only the app's languages; file names of letters, digits, `-`, `_`, `.` ending in `.js`; at most 8 MB a file; read as data only (literals, names of other declarations, `JSON.parse` of a text, an export list), anything else makes the file unreadable and the words absent; nesting bounded at 64. |
| What comes back | The result file's extension decides what it is; only the formats the gallery keeps are stored (`result_kind`); `store_audio` and `store_video` check the name and the content. |

## Known limits

- A graph job is bounded by neither depth nor node count; a saved workflow is bounded only in size.
- Only the first output's result is read: a picture, text, a sound or a video. An output that saves sound or video comes before a picture the graph also shows, and the first frame of a video comes from `GetVideoComponents`, `ImageFromBatch` and `PreviewImage` that the compiler adds beside the saving node (`thumbnailOf`). The gallery keeps MP3, WAV, FLAC and MP4 only (above). The graph of a sound or video is kept with it (`ImageDTO.workflow`); a picture keeps it inside the PNG.
- A choice that is a number in a ComfyUI list goes back as that number only when it is picked as text that matches; a list of other types is not handled.
- The compiler refuses, naming the node: Collect, Iterate and Range; a box blur; a Math node whose numbers are not plain (a random seed feeds it, or it has no result, such as a division by zero); a ControlNet or IP-Adapter output wired anywhere but to a sampler; a graph that loops back into itself (the editor refuses such a connection, but a file or the assistant can bring one in).
- Speech is made once per run, before ComfyUI starts, and again for each iteration; its text cannot come from a node ComfyUI runs, and a graph that reads aloud needs the voice engine installed (the Invoke check says so). Create Video cuts a sound to the length of its video.
- A node of ComfyUI keeps the seed it holds: a fixed seed repeats the result. Wire a Random Integer node to its seed to take a new one each run (the ready-made graphs do).
- The built-in Face Detailer workflow has no face detector: it redraws the whole picture, guided by Canny edges and an IP-Adapter.
- ComfyUI's words are read only from a frontend built as ComfyUI 0.35.1's (frontend 1.51.10) is: the page, the `i18n` map and data-only locale modules. Another build gives no words, and the names stay English. Custom node packs' own translations are not read.
- Input values are not checked against their field types: the compiler reads them with fallbacks, and the nodes of ComfyUI and of packs get theirs unchanged. The only check is that a choice is in ComfyUI's list.

## Not implemented

- The Generate Video node inside a graph of ComfyUI's or a pack's nodes (refused as `unsupported`).
- ComfyUI's auto-grow inputs (several sounds or videos into one node).
- Results of more than the first output node.
- Sound in Opus or Ogg, and video in WebM or MKV (the gallery cannot keep them).
