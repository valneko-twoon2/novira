# Glossary

The words used on the screens (Japanese, as the app shows them), what each one means, and the names used in the code and files behind it. Where one word means two things, both are listed. The Japanese screen words come from the catalog `frontend/src/i18n/locales/ja/`; a name in `code font` is a code or file name.

When a screen word changes, update its row here (`/i18n` skill). This page says what a word means. Which word to use for a concept in ja and en, and the variants that must not be used (導入 for installing, "pack" for an extension, British spellings, misspelt names such as HuggingFace), are in the terminology list `frontend/src/i18n/glossary.json`, which a test and the pre-commit hook check; they are not repeated here.

## Product name

| Term | Meaning | Spelling |
|---|---|---|
| novira | The name of this app. The logo on the About screen is lowercase too | Always lowercase `novira`, in every language, in docs, comments, tests and commit messages, even at the start of a sentence. Do not write "novira" |

Names built from it keep the lowercase form: `novira.exe`, the data folder `novira-data/` (`NOVIRA_DATA_DIR` overrides it), the backend crate `novira-core`, and `novira` as the window title.

The window title and the screen text in every language are lowercase too. Comments, tests and the architecture pages may still say "novira".

## Screens

| Screen word | Meaning | Code / where |
|---|---|---|
| 生成 (Generate) | Write a prompt and make images | `features/invoke`, `features/params` |
| キャンバス (Canvas) | Paint and compose on one surface, with layers | `features/canvas`, `state/canvas.ts` |
| 漫画 (Comic) | Comic pages made of a project: pages, panels with their own pictures and poses, balloons and captions. A project is saved as one database row | `features/comic`, `state/comic/`, `comics` table |
| アップスケール (Upscaling) | Enlarge an image with an upscaling workflow | `features/launchpad/UpscalingLaunchpad.tsx` |
| ワークフロー (Workflows) | Node graphs you edit and save; the graph sent to ComfyUI is built from them | `features/workflows`, `comfy/` (backend) |
| モデル (Models) | The model files you have, install and remove them | `features/models` |
| キュー (Queue) | The generation jobs, waiting or running, with their status | `features/queue`, `QueueItem` in `types.rs` |
| 探す (Browse) | Find models on the internet (Civitai, Hugging Face) and bring them in | `features/browse` |
| ギャラリー (Gallery) | The pictures novira holds, shown as images or assets and grouped in boards: the whole right side panel on the desktop (boards and pictures together), and the Gallery tab on a phone | `features/gallery`, `app/phone` |
| AI アシスタント (AI assistant) | A chat window that answers questions and can set some of the forms for you | `features/agent`, `backend/crates/novira-core/src/agent/` |
| 設定 (Settings) | App settings; the About dialog is opened from the settings menu | `features/settings` |
| 拡張機能の管理 (Extension manager) | Install, update and remove ComfyUI custom node packs | `features/workflows/ExtensionsTab.tsx` |
| novira について (About) | Version, open-source list, license | `features/settings/AboutModal.tsx` |

## Gallery

| Screen word | Meaning | Code |
|---|---|---|
| 画像 (Images) | Pictures in the gallery's images view (category `General`) | `ImageCategory::General` |
| アセット (Assets) | Pictures that are not generated results: uploads, masks, control images and other inputs | any `ImageCategory` other than `General` |
| ボード (Board) | A named group of pictures in the gallery. A board can be set to receive new pictures automatically (自動) | `gallery.boards.*` |
| アーカイブ (Archive) | Hides a board from the list without deleting it | `gallery.boards.archive` |

## Generation

| Screen word | Meaning | Code |
|---|---|---|
| ジョブ / キューの項目 (Job, queue item) | One generation request in the queue | `QueueItem` in `types.rs` |
| 待機中 (Pending) / 処理中 (In progress) / 完了 (Completed) / 失敗 (Failed) / キャンセル (Canceled) | The statuses of a queue item | `queue.status.*` |
| 一時停止中 (Paused) | The queue processor is paused; running work is not started | `queue.processor.paused` |
| 下書き (Draft) | A rough picture stopped partway through the steps, to choose a seed before a full run | `GenerationMetadata.draftAt` |
| まとめて処理 (Batch) | Run one operation (remove the background, upscale, and so on) on many pictures | `batch.*` |
| 比較グリッド (XY plot) | A table of pictures that change one or two settings across its columns and rows | `xyplot.*` |
| シード (Seed) | The number that fixes the random starting noise; the same seed with the same settings gives the same picture | `seed` |
| プリセット (Preset) | Saved settings that can be applied again | `presets.*` |
| キャラクター (Character) | A saved set of reference pictures and words for one character | `character.*` |
| ポーズ (Pose) | A stick figure whose joints you move to set the pose of a person | `pose.*` |
| 範囲を選んで直す (Segment) | Click the parts of a picture to include or exclude, then repaint those parts | `segment.*` |
| 顔を直す (Face fix) | Find faces, repaint them at higher resolution. Needs the Impact Pack extension | `facefix.*` |
| 背景を除去 (Remove background) | Cut out the subject and make the background transparent | `cutout.*` |
| 絵からプロンプトを作る (Caption) | Write tags or a sentence for a picture with Florence-2 | `caption.*` |

## Comic

| Screen word | Meaning | Code |
|---|---|---|
| プロジェクト (Project) | One comic under one name, with its pages. The list of projects is in the left panel | `ComicProject`, `comics` table |
| ページ (Page) | One sheet of a comic. Its panels are laid out automatically by their number | `ComicPage`, `state/comic/layout.ts` |
| コマ (Panel) | One frame of a page, with its own prompt, picture and optional pose | `ComicPanel` |
| 吹き出し (Balloon) | Speech in a balloon with a tail, placed on a panel | `ComicBubble` with kind `speech` |
| ナレーション (Caption) | Narration in a plain box, placed on a panel | `ComicBubble` with kind `caption` |
| 3D ラフ (3D rough) | A panel laid out in 3D: mannequins, boxes, boards, cylinders and a floor seen through a camera, baked into the panel's pose picture and a depth map | `ComicRough`, `state/comic/rough.ts` |

## Models

| Screen word | Meaning | Code |
|---|---|---|
| モデル (Model) | A model file: checkpoint, LoRA, VAE, ControlNet, upscaler and so on | `models` table, `models/` |
| ベース (Base) | The family a model belongs to, for example SD1.X or SDXL. A LoRA works only with models of its base | `lora.modelHint` |
| 種類 (Kind) | What a model does: チェックポイント (checkpoint), LoRA, VAE, ControlNet, アップスケーラー (upscaler) | `models.type.*`, `models.rail.*` |
| トリガーワード (Trigger word) | Word in the prompt that calls up a LoRA | `lora.trigger` |
| ライセンスの札 (License tag) | The commercial-use tag on a model, summarizing its license | `CommercialTag` |
| 変換 (Convert) | Turn a checkpoint into the Diffusers format | `models.convertConfirm` |

## Engine and extensions

In the code, "pack" is used for two different things; the screens say 拡張機能 (extension) for the first and name the second by what it is for.

| Screen word | Meaning | Code |
|---|---|---|
| エンジン (Engine) | The image generation engine: ComfyUI with Python, downloaded and started by novira | `novira-core/src/engine.rs`, `comfy/`, `novira-data/comfyui/` |
| 拡張機能 (Extension) | A ComfyUI custom node pack, installed into ComfyUI | `comfy/node_packs.rs` |
| おすすめの拡張機能 (Suggested extension) | A custom node pack that novira suggests, with a description in every language. The screens call it an extension too, not a pack | `PACK_CATALOG` in `state/comfy/packCatalog.ts` |
| カスタムノード (Custom node) | The ComfyUI term for the same thing as an extension | ComfyUI |
| ComfyUI レジストリ (ComfyUI Registry) | The public index of custom node packs that the extension manager searches | `comfy/registry.rs` |
| *Model pack* (モデルセット) | Extra model files that video, music, voice and logo need, downloaded on request. The screen titles them 動画のモデル, 音楽のモデル and so on | `packs.rs` |

## Install

| Word | Meaning | Note |
|---|---|---|
| インストール (Install) | Put an engine, extension or model on this PC | ダウンロード (Download) is the transfer itself: its progress, and a file saved by the browser |
| データフォルダ (Data folder) | Everything novira keeps: pictures, models, the engine, settings. `novira-data/` by default | `NOVIRA_DATA_DIR` overrides it |

## Modes and parts of the code

| Term | Meaning |
|---|---|
| モック (Mock) | Browser mode. Pictures are made-up samples, nothing reaches the files or the network, and data is lost on reload |
| デスクトップアプリ (Desktop app) | The Tauri window with the Rust backend |
| `novira-core` | The backend library: storage, queue, ComfyUI adapter, models, assistant. It has no Tauri code |
| `src-tauri` | The thin Tauri shell: IPC commands, image URLs, window settings |
| `BackendClient` / `TauriBackend` / `MockBackend` | The frontend's one interface to the backend, its desktop implementation and its browser mock. See `frontend/src/backend/client.ts` |
| contract | The types sent between frontend and backend: `frontend/src/backend/types.ts` and `backend/crates/novira-core/src/types.rs` |
| 規則 (rule) / スキル (skill) | Working rules in `.claude/rules/` and procedures in `.claude/skills/` for coding agents |
