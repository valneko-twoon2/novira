---
description: Layers, look and failure handling of the frontend (frontend/src)
paths:
  - "frontend/src/**"
---

# Frontend structure and look

Follow this when changing `frontend/src/`. The map of locations is [docs/architecture/frontend.md](../../docs/architecture/frontend.md).

## 1. Layers

- From the bottom, the layers are `backend/` (the boundary, including the mock) → `state/` (zustand, wiring, registries) → `ui/` (shared components) → `features/<feature>/` (screens) → `app/` (composition). An upper layer imports only lower layers. `i18n/` and `theme/` import no layer.
- A feature stays inside `features/<name>/`. Features do not import each other (except `features/media`, shared by video, music, audio and logo, and `features/invoke`, the Invoke buttons every generator screen shows). Coordination goes through `state/` stores and registries (for example `registerInvokeBuilder`, `registerAgentEditor`).
- ESLint (`scripts/eslint-layers.mjs`) checks layer boundaries. **Do not add to the exceptions list.** Move the shared thing to a lower layer or a registry.
- External connections (`fetch` etc.) live only in `src/backend/`.
- One file, one responsibility. Do not create catch-all folders (`utils/`, `misc/`, `helpers/`); `tests/structure.test.ts` stops this.
- A list of screens, kinds or families is derived from its source (`TABS`, `MEDIA_KINDS`, `GENERATED_MEDIA`, `EDIT_SCREENS`, `TOOL_HOTKEYS`) or typed as a `Record` over it, never written out again, so a new member fails to compile where it is missing. A `switch` over a union names every member even with a `default` (ESLint, typed), and models are picked with the helpers of `state/models.ts` (ESLint stops a list filtered to type `main`). A new screen also says in `app/registerFeatures.test.ts` whether it has an Invoke builder.

## 2. Look

- The reference for screens and operations is InvokeAI (v6 series).
- The palette is blue-based, and the default is a pure-black dark theme (switched with `data-theme`). Accent fills use the brand gradient `--grad-accent`, the same blue-to-red as the app's mark: buttons, active tabs and segments, toggles, checkboxes, badges, slider and progress fills, and dots. Backgrounds and panels stay flat. Lines, borders, text and focus rings stay solid. Do not add glow; keep the look calm.
- Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining: a heading, a grouping, an icon and a control's own label say what a part is; a sentence under it that repeats them is not added. Keep text that tells what the layout cannot (a consequence, a requirement, a state).
- CSS colors use only the tokens in `src/theme/tokens.css` (stylelint stops anything else).
- A layer over the app (dock, dialog, menu, tooltip, toast, the assistant's window) takes a `--z-*` token, so the stacking order lives in one place; 0 to 9 order the parts inside one component (stylelint stops any other value).
- Corner radii use only the `--radius-*` tokens, so one family of panels never has different corners (stylelint stops a raw value). Labels and buttons do not end in "…": let them wrap. Visible controls keep a gap of at least 1px, unless joined with square facing corners. `node tools/layout-scan.mjs` checks every screen for these and for controls that stick out of their box; `data-truncate-ok` marks a place designed to shorten (a file or model name in a fixed box) and needs a reason.

## 3. Contain failures

- **Wrap every new screen region (tab, panel, dialog, floating window) in an `ErrorBoundary` (`src/ui`).** This confines a render failure to that region so the whole app does not go blank.
- Send failures of asynchronous work to a notification (`toast`) or the developer log (`devLog`) with `try/catch`; never swallow them.

## 4. Browser and desktop

- **Do not show browser-only features in the desktop app.** Things like opening in a new tab or mock-only settings are gated with `canOpenNewWindow()` or `backend.kind`.
- The mock (`src/backend/mock/`) returns the same picture for the same input (seed, prompt). A prompt containing `[fail]` makes generation fail. `?scenario=empty` in the URL starts from an empty state. Tests and the manual's screenshots depend on this behavior, so do not change it.

## 5. Keep in step in the same change

- Screen text goes only in the i18n catalogs ([i18n.md](i18n.md)).
- When you add, change or remove a user-visible feature, update the manual too ([manual.md](manual.md)).
- Add, change or remove tests ([test-maintenance.md](test-maintenance.md)). What to run is in [regression-tests.md](regression-tests.md).
- When you rename or remove a test id or a screen text, change what names it outside `src/`: the e2e specs, the manual's scenes, the tools that drive the real app, the docs. `tools/ui-refs.mjs` (pre-commit) lists every reference left behind. Hiding something in one build only (`import.meta.env.MODE === 'production'`) it cannot see: the harness builds use the mode `HARNESS_MODE` (`tools/harness-paths.mjs`), so check what drives the app's own build.
