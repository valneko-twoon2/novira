---
covers:
  - backend/crates/novira-core/src/service/canvas.rs
  - backend/crates/novira-core/src/service/comics.rs
  - backend/crates/novira-core/src/fonts.rs
  - backend/crates/novira-core/src/db.rs
  - backend/crates/novira-core/src/types.rs
  - frontend/src/state/canvasPersistence.ts
  - frontend/src/state/canvasDocument.ts
  - frontend/src/state/comic/**
  - frontend/src/state/fonts.ts
  - frontend/src/features/comic/pageRender.ts
  - frontend/src/features/comic/pagePsd.ts
---
# Canvas, comics, workflows and fonts

The saved documents of four screens. The Canvas keeps its layers, masks and bounding box as one JSON text. The Comic screen keeps each project as one database row. Saved node workflows are rows of their own. The font list of the comic and the text editor is read from the installed fonts. The backend stores these documents as they are, after size and shape checks; the frontend owns their shape and checks what it reads back.

## Behaviour

### Canvas document

- Stored as one text under the key `canvas` in the `meta` table of `novira.sqlite` (`service/canvas.rs`). `load_canvas` returns the text or `null`; `save_canvas` replaces it. The backend never reads the fields.
- `save_canvas` refuses, before writing, a text over 32 MiB or one that is not a JSON object.
- The frontend document (`frontend/src/state/canvasPersistence.ts`, `version` 1) holds `entities`, `selectedEntityId`, `bbox`, `groupHidden` and `viewport`. Undo history is not part of it.
- A change to the entities, the box, the selection or the hidden groups starts a save one second later (`SAVE_DELAY_MS`); a later change restarts the timer. Nothing saves the pending change when the app closes, so a change made in the last second is lost.
- Restore runs once at start-up, after the bootstrap data is in (`frontend/src/state/wiring.ts`). Saving starts only when the text could be read from the backend. A text the frontend cannot use (another version, not JSON, no `bbox`) is ignored, and the next save replaces it.
- Restore drops unknown entity types, damaged entities and objects, and picture objects whose gallery image of the saved name no longer exists.
- A picture that lives only in the page (a `blob:` address) is first stored as a hidden gallery image (`saveImageFromUrl` with `isIntermediate: true`, category `general`), once per address; the live layer then uses the stored picture. A picture that cannot be stored is left out of that save and tried at the next one. A save the backend refuses is dropped silently, and the next change saves again.
- In the browser mock the document is kept in memory only.

### Comic projects

- One row per project in the `comics` table (`Table::Comics`, `db.rs`): id, sort key `updated_at`, JSON document. The wire type is `ComicRecord { id, updatedAt, document }` (`types.rs`). Projects are not kept in the in-memory state; `list_comics` reads the table, oldest change first.
- `save_comic(id, document)` (`service/comics.rs`) refuses an id that is empty, longer than 64 characters, or not made of ASCII letters, digits, `-` and `_`; a document that is not a JSON object; and a document whose JSON text is over 32 MiB. It stamps `updated_at` and keeps the document as it is.
- `delete_comic(id)` removes the row; an unknown id does nothing. The project's pictures stay in the gallery.
- Frontend (`frontend/src/state/comic/document.ts`): each document carries `version` 2 (`COMIC_VERSION`); version 1 is still read and migrated (below). A document with another version, or without a string `id`, is skipped on restore and never written back. The screen lists projects newest first. Project ids are made as `comic-<uuid>` (`newComicId`).
- Each project is saved one second after its last change (`frontend/src/state/comic/persistence.ts`); a deleted project is removed at once. Saving starts only after the list was read.
- A page keeps `canvas`, its layers as Canvas layers in page pixels, and version 1 documents (the comic's earlier own layer stack) are migrated when read; the layers, paint mode and inpainting of a page are in [comic-layers.md](comic-layers.md).
- A panel keeps `imageName` and `poseImageName` (gallery names), `poses` (one list of 18 joints per person, as fractions of the panel) and `takes` (its earlier pictures). It may keep `poseCast` and `poseWords` (who each person of the pose is and what they do), `rough` and `depthImageName`, its 3D rough and the depth map baked from it ([comic-rough.md](comic-rough.md)). How a panel is drawn (the queue jobs, the cast's words and reference pictures, regions, poses, the earlier pictures) is in [comic-drawing.md](comic-drawing.md).
- A project keeps `places` (at most `PLACES_MAX`: a name, the words of the place and the words it keeps out) and may keep `world` (the words every panel gets, cut to `WORLD_MAX`; none when it holds no word); a panel may name its place (`place`, a place id), which it loses when the place is removed. How they reach a panel's prompt is in [comic-drawing.md](comic-drawing.md).
- A project may keep `castReference`, the strength of its characters' IP-Adapter references (0.1 to 1, kept in range when read); without it the panels use none ([comic-drawing.md](comic-drawing.md)).
- Page layouts, the lettering checks and the sound-effect pictures are in [comic-pages.md](comic-pages.md).
- Undo and redo of the comic bring back the pages, panels and balloons, not the layers ([comic-layers.md](comic-layers.md)), the pictures, the sheets, the templates, the name, the drawing settings, the styles or the character references (`history.ts`). A panel is drawn with its comic's and its page's drawing settings laid over the form wherever the person is, off the comic screen too (`withPageDraw`, `drawSync.ts`). That swap of the form is flagged (`isSwappingDraw`) and the comic's change listener ignores it, because off the comic screen the readiness hints build a request, which swaps the form, which would notify the listener again without end.
- The page is drawn in one order: `pageGroups` in `frontend/src/features/comic/pageRender.ts` for the saved picture, `pagePsd.ts` for the PSD export (which keeps opacity, blend and visibility), and the page thumbnails (`PageThumb.tsx`). Each raster of the user is drawn by the Canvas's own drawing code (`ui/canvasDraw`) on a canvas of its own, so its eraser reaches only its own strokes; a slot's parts are drawn together first and then laid over the page with the slot's opacity and blend.

### Workflows

- Saved workflows and the workflow editor are described in [workflows.md](workflows.md).
- Gallery boards are not described here; see gallery-share.md.

### Fonts

- `list_fonts` takes no argument and runs off the UI thread (`backend/src-tauri/src/commands.rs`). It returns `fonts::installed_families()` (`backend/crates/novira-core/src/fonts.rs`), which reads only the value names under `SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` in `HKEY_LOCAL_MACHINE`, then `HKEY_CURRENT_USER`, with the wide-character API (at most 20000 values per key). No process is started. Off Windows the list is empty.
- Only TrueType and OpenType fonts are taken; names starting with `@` and bitmap fonts are left out. A full name becomes its family by dropping style words from its end (one word always stays). Names joined by ` & ` count separately. Each family appears once, sorted case-insensitively, at most 3000 (cut after sorting). A family longer than 128 characters, or containing `"`, `\`, `;`, `{`, `}` or a control character, is dropped.
- Frontend (`frontend/src/state/fonts.ts`): the list loads once, when a font picker first opens (`frontend/src/ui/FontPicker.tsx`), and the app's own bundled fonts are removed from it. The comic balloon editor, the text editor (`features/text/StyleControls.tsx`) and a Settings pane use the picker.
- The app's own fonts (Fontsource, about 1.4 MB of `@font-face` rules) are a stylesheet of their own (`frontend/src/state/appFontFaces.ts`), loaded once by `loadAppFonts`: when a font picker or a comic balloon first shows (`useAppFonts`) or a canvas draws text (`ensureFont`). A balloon is laid out only after the rules are in, so it never shows, centres or fits in the fallback font first; the screens' own text uses the system font and needs none of them.
- A font name saved in a comic balloon is read by `parseFont` (`frontend/src/state/comic/document.ts`): a trimmed name of at most 128 characters with none of `"`, `\`, `;`, `{`, `}`, `<`, `>` or a control character. Anything else reads as no font.

## Boundaries

| Boundary | Guard |
|---|---|
| Canvas document (`load_canvas`, `save_canvas`) | The document is one text in the `meta` table, written through a bound parameter. `save_canvas` refuses a text over 32 MiB or one that is not a JSON object before writing (`service/canvas.rs`); the backend never interprets it. The frontend treats the text as input when restoring: unknown layer types, objects and damaged parts are dropped, and a picture is taken only from a gallery image of the saved name. |
| Comic projects (`list_comics`, `save_comic`, `delete_comic`) | Each comic is one row of the `comics` table, written through a bound parameter. `save_comic` refuses before writing an id that is empty, too long or has anything but ASCII letters, digits, `-` and `_`, a document that is not a JSON object, and one whose JSON text is over 32 MiB, the same cap as the canvas document (`service/comics.rs`); the backend never interprets the document. `delete_comic` takes only the id. |
| Installed font names | `list_fonts` takes nothing and only reads the font list in the registry (`fonts.rs`, the wide-character registry API, no process). At most 3000 names of at most 128 characters come back, and a name with a quote, backslash, semicolon, brace or control character is dropped, because the screens put names into CSS `font-family` values. A font name saved in a comic balloon is read by `parseFont` (`state/comic/document.ts`), which refuses the same characters and also `<` and `>`. |

## Known limits

- Comic projects are stored unencrypted in the database and travel in backups, like the canvas document.
- The canvas document (layers, masks) is stored unencrypted in the database and travels in backups like the pictures. The pictures of merged or transformed layers stay in `outputs/` as hidden images after the layer is gone.
