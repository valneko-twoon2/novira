---
covers:
  - backend/crates/novira-core/src/media/**
  - backend/crates/novira-core/src/provenance/**
  - backend/crates/novira-core/src/service/gallery.rs
  - backend/crates/novira-core/src/service/share.rs
  - backend/crates/novira-core/src/service/boards.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/secret.rs
  - backend/src-tauri/src/image_scheme.rs
  - backend/crates/novira-core/src/image_serve.rs
  - backend/src-tauri/src/dialogs.rs
  - backend/src-tauri/tauri.conf.json
  - frontend/src/features/share/**
  - frontend/src/features/gallery/actions.ts
  - frontend/src/features/gallery/boards/**
  - frontend/src/state/gallery.ts
  - frontend/src/state/invoke.ts
---
# Gallery and sharing

The gallery keeps the pictures, videos and audio that novira makes or receives, with thumbnails and their embedded settings. Export for sharing writes copies to a folder the user chooses and can mark each copy as made by AI (an invisible watermark, an XMP label and signed C2PA credentials); a check reads those marks back. Generation is in media-generation.md; backup in settings-engine.md.

## Behaviour

**Files and names.** Originals are `novira-data/outputs/<uuid>.png`, `<uuid>.mp4` (video) or `<uuid>.flac|wav|mp3` (audio). Thumbnails are `novira-data/thumbnails/<stem>.thumb`: a JPEG at quality 85, or a PNG for pictures with transparency, fitted in 256 x 256. A name is valid (`images::is_valid_name`, `backend/crates/novira-core/src/media/images.rs`) when it is at most 80 characters, has one of those extensions, uses only letters, digits, `-`, `_` and `.`, does not start with a dot and is not a Windows device name.

**Embedded settings.** Each generated PNG carries UTF-8 `iTXt` chunks before `IEND`: `novira_metadata` (generation parameters as JSON) and, when the job had one, `novira_workflow`. Pixel data is not re-encoded. Uploading such a PNG restores both.

**Recall.** "Use all", "Remix", the viewer's model row and the face fix take the stored model by its key; when the key is empty or not installed (pictures made by another program and imported), they look the stored name up among the drawable models (`frontend/src/state/recallModel.ts`): case and punctuation are ignored, an exact name or file name wins, else the only model whose name starts with it. With no match, or several, the current model stays and the notification names the missing one. LoRAs and the VAE are stored by key only, so they have no such fallback.

**Upload.** The page sends raw bytes and options (board, intermediate flag, category) in a header. Before decoding, `images::check_limits` refuses a file over 256 MiB, a side over 20,000 pixels, more than 100,000,000 pixels, and any format other than PNG, JPEG, WebP, GIF or BMP (detected from the content). A PNG is kept byte for byte once its chunks and pixels are checked; other formats are re-encoded as PNG.

**Gallery state.** Pictures made for the canvas, as intermediates or as drafts (`draftAt`) get `isIntermediate` and are left out of the board view (`frontend/src/state/gallery.ts`). Logos get category `other`.

**Video and audio.** A video is stored as `.mp4` with `mediaType: video`; its thumbnail is the first frame. Music is saved as FLAC and speech as WAV (`backend/crates/novira-core/src/service/worker.rs`); both keep their settings in the database row only. `store_audio` refuses bytes that are not WAV, FLAC or MP3. The audio thumbnail is a 256 x 144 PNG of 48 bars: a 16-bit PCM WAV is drawn from its loudness, other files from a pattern of their bytes. No current job writes MP3. The scheme answers `Range` requests (206 or 416), so media can seek.

**Image URLs.** The page gets names only: `http://novira-image.localhost/full/<name>` or `/thumb/<name>` on Windows, `novira-image://localhost/...` elsewhere. `backend/src-tauri/src/image_scheme.rs` serves them (the decision is `backend/crates/novira-core/src/image_serve.rs`); unknown or invalid names are 404. The CSP allows it for `img-src` and `media-src`.

**Export for sharing.** The share dialog (`frontend/src/features/share/ShareDialog.tsx`) sends names and options to `export_images`. The command checks them first (1 to 10,000 valid names, options, watermark status). Then the shell opens a folder dialog (`backend/src-tauri/src/dialogs.rs`, rfd); cancelling returns `null`. The page never sends or receives a path. Copies are encoded again from the pixels (`backend/crates/novira-core/src/media/export.rs`): PNG, JPEG (quality 1 to 100, transparency on white) or lossless WebP. The longest side can be limited to 2048, 1536, 1024 or 16 to 16,384; pictures are never enlarged. Text chunks, EXIF and XMP of the original never survive. Unless "remove generation info" is on, a PNG copy keeps `novira_metadata` and `novira_workflow`; JPEG and WebP never do. Defaults (`frontend/src/features/share/shareOptions.ts`): PNG, quality 90, original size, info kept, watermark off; the last choices are kept for the session. Videos, audio and missing files are skipped and counted. Files are `<stem>.<ext>`, then `<stem>-2.<ext>`, never overwritten. The browser server (`POST /export/images`) makes the same copies (`export_download`) as one download: a picture as itself, several in a stored zip; over `export::MAX_DOWNLOAD_BYTES` it is refused, as both sides hold it in memory. "Open the folder" opens the last export's folder as the shell remembers it. "Open in new tab" is shown only in the browser build (`frontend/src/backend/openWindow.ts`).

**AI marks.** With the watermark switch on, each copy gets three marks in this order:

1. A TrustMark watermark, variant P (BCH_5): 61 bits, a 16-bit marker `0x4E56` and a 45-bit random id (`payload.rs`), embedded after the resize at strength 1.0 (`watermark.rs`). Pictures of more than 4096 x 4096 pixels in all, or with a side under 2, are refused.
2. The IPTC source type `trainedAlgorithmicMedia` as XMP (`xmp.rs`): an `iTXt` packet in PNG, an APP1 segment in JPEG, an `XMP ` chunk in WebP.
3. Signed C2PA credentials (`credentials.rs`): a create intent with the `trainedAlgorithmicMedia` source. With the watermark, also a `c2pa.watermarked` action and a `c2pa.soft-binding` assertion (algorithm `com.adobe.trustmark.P`, value `1*` followed by the 61 bits). The manifest is embedded over the XMP.

Each marked copy adds a `watermarks` row: the 12-digit hex id, the gallery picture's name, the export time and the format. The export is refused unless the watermark status is `ready` (`check_export`).

**Watermark files.** Pinned sizes and hashes: see Boundaries. The files are looked for in the bundled folder and then the data folder, and downloaded at start (`backend/src-tauri/src/lib.rs`) or by `prepare_watermark`. Status: `missing`, `downloading`, `ready` or `failed` (`provenance/mod.rs`). The code sets no GPU execution provider.

**Checking a picture.** `check_watermark_file` opens the shell's dialog and returns `null` on cancel (the picker is hidden on the browser server, which has no dialog); `check_watermark_image` takes a gallery name. The check is opened from the picture's right-click menu; the share form has no link to it. Both run `images::check_limits` first (`backend/crates/novira-core/src/service/share.rs`). The result says whether the watermark was checked, whether it is a novira mark and its id; for a known id it gives the original's name, whether that picture is still in the gallery, and the export time. It also reports the C2PA state (present, valid, trusted, AI source, signer, made by this installation) and the XMP source type. The gallery picture menu opens it.

**Signing key.** The first watermarked export makes a local CA and an ES256 leaf certificate valid for about ten years, named "novira", with no user, account or PC name. The CA key is dropped at once. The leaf key and chain are saved with DPAPI for the current Windows user in `novira-data/secrets/c2pa-signing.key` (`backend/crates/novira-core/src/secret.rs`). An unreadable saved value is replaced; a check only loads it. The key never reaches the page.

### Boards

A board is a row of the `boards` table: an id (`board-` and 12 hex digits), a name, an `archived` flag and `createdAt` (`backend/crates/novira-core/src/service/boards.rs`). A picture belongs to one board by its `boardId`; `null` is Uncategorized. The page computes the counts and covers (`frontend/src/features/gallery/boards/useBoardStats.ts`): intermediate pictures are left out, `general` pictures count as images and the others as assets.

- Create and rename trim the name and refuse a blank one, changing nothing. No length limit is checked.
- Archiving sets only the flag. Archived boards are hidden unless the show-archived setting is on; with them hidden, archiving the selected board selects Uncategorized. Archiving the auto-add board clears it (`frontend/src/features/gallery/boards/boardActions.ts`).
- With the auto-assign setting on (the default), selecting a board makes it the target of new pictures from generation, uploads and the canvas (`autoAddBoardId()`, `frontend/src/state/invoke.ts`). The backend does not check that a `boardId` names an existing board.
- `delete_board(id, deleteImages)` removes the board. Each of its pictures either loses the board (`boardId` null) or is deleted with its files, and the deleted names are returned. The dialog counts non-intermediate pictures, but deletion also takes intermediate ones that carry the board id.

## Boundaries

| Boundary | Guard |
|---|---|
| Image scheme `novira-image` | URLs carry a generated name only. Names are checked (`images::is_valid_name`, which also refuses Windows device names such as `nul.png`); anything else is a 404. Tested with traversal and encoded forms. |
| Uploaded pictures | Size, side and pixel limits are checked from the header before decoding (`images::check_limits`), so a small file cannot declare a huge canvas. Only PNG, JPEG, WebP, GIF and BMP reach a decoder (`images::ACCEPTED_FORMATS`): `trustmark` turns on every format of the `image` crate, and the others (TIFF, EXR, QOI, ...) are refused before decoding. |
| Export watermark files | TrustMark's `encoder_P.onnx` / `decoder_P.onnx` and Microsoft's `onnxruntime.dll` 1.22.0 are pinned by size and SHA-256 in `backend/crates/novira-core/src/provenance/files.json`. They are taken from `<exe folder>/resources/trustmark` or downloaded at start into `novira-data/models/trustmark/` from `https://cai-watermark.adobe.net` and `https://github.com` only (the addresses in `backend/crates/novira-core/src/endpoints.rs`, exact host, `https`), capped at the pinned size while streaming, hashed while written to a `.part` name and renamed only when the hash matches; the runtime comes out of its pinned zip as one named entry, capped and hashed again. Before each first use in a session every file is hashed again; a downloaded file that fails is deleted. The DLL is loaded into the app's process with `libloading` (no `ORT_DYLIB_PATH`, no search of other folders) and runs on the CPU only. ONNX files are model data, not pickle. |
| Checking a picture for a watermark (`check_watermark_file`, `check_watermark_image`) | The file comes only from the native dialog the shell opens inside the command (PNG, JPEG, WebP filter); the page sends nothing for it. A gallery picture is named and checked like any image name. The file is read through one handle, refused over the gallery's byte limit before it is read whole, then passes `images::check_limits` (size, side, pixels, accepted formats) before any decoder, C2PA parser or XMP scan sees it. The C2PA reader has no network access (no HTTP features, no remote manifests, no OCSP). Texts returned to the page (file name, signer) are cut to a length and shown as text. |
| Signing key for content credentials | Made on first use: a local CA signs an ES256 leaf certificate (no name, account or PC name in it), the CA's private key is dropped at once, and the leaf's key and the chain are saved with DPAPI in `novira-data/secrets/c2pa-signing.key`. The key never leaves the backend; backups do not contain `secrets/`. |

## Known limits

- The export watermark (TrustMark) is a public scheme: anyone with the models can write the same marker or read the id, and Adobe publishes a remover. It survives JPEG at quality 80 and halving the size (measured 2026-10-11), but cropping into the picture (not measured; about a fifth is the figure the decision was made with), regenerating or heavy edits can remove it. Variant P marks only the centred square of a picture. A missing watermark proves nothing; a found one is a hint, not a proof.
- The content credentials are signed by a certificate made on the user's PC; no trust list knows it, so viewers show the signer as unknown. They prove only that the file is unchanged since this installation signed it. Removing the metadata (most sites do) removes them; the watermark id can then point back to the gallery picture only in the app that exported it.
- `onnxruntime.dll` and the TrustMark models are hashed before each first load in a session, but a program running as the same user could swap the file between the check and the load (as it could already change any of the user's files). Loading the DLL needs the Microsoft Visual C++ runtime; without it the watermark reports an error and the rest of the app is unaffected.
- The pictures of merged or transformed layers stay in `outputs/` as hidden images after the layer is gone.

## Not implemented

- Gallery download (`downloadImages` in `frontend/src/features/gallery/actions.ts`, also used by the viewer) saves through a browser link to the image URL. The desktop app has no native save dialog for it; whether WebView2 saves such a link was not verified in the real app.
- Comic and PSD exports are drawn in the page and do not pass through the backend, so they carry no marks.
- Board download (`downloadBoard` in `frontend/src/features/gallery/boards/boardActions.ts`) only shows a notice.
