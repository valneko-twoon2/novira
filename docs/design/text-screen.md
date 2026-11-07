---
covers:
  - frontend/src/features/text/TextPanel.tsx
  - frontend/src/features/text/TextCanvas.tsx
  - frontend/src/features/text/TextAddBar.tsx
  - frontend/src/features/text/TextLayersPanel.tsx
  - frontend/src/features/text/TextCandidates.tsx
  - frontend/src/features/text/TextFloatingBar.tsx
  - frontend/src/features/text/barPlace.ts
  - frontend/src/features/text/TextScenePresetBar.tsx
  - frontend/src/features/text/saveScene.ts
  - frontend/src/state/presets/textScenePresets.ts
  - frontend/src/state/text/textSources.ts
---
# Text: the screen's layout, templates and re-opening

The Text screen (Generate tab, text) is laid out like the Generate screen, and keeps the scene as vector layers. How the letters are painted by AI is [text-rich.md](text-rich.md).

## Layout
- **Left column**, top to bottom: the template card; the AI finish (`RichSection.tsx`: the run button with the count and a stop button, the model, the look and words, the folded details); the settings of the selected layer; the background and size. The sections fold like the Generate screen's. A text layer's style preset card (`TextPresetBar.tsx`, "Text style") is the first thing in its settings, because it applies to that layer.
- **Canvas toolbar** (`TextCanvas.tsx`): add text, add a bubble (a menu of the shapes), undo and redo, zoom, the size, save to the gallery. It wraps to a second row when narrow.
- **Quick bar** (`TextFloatingBar.tsx`): over the selected visible layer: the font, size and fill color(s) and the outline color of a text layer, the fill and border colors of a bubble, duplicate and delete. The size of the bar is measured, and `barPlace.ts` puts it above the layer's rotated bounds, under them when the top has no room, at the top edge when neither has, always inside the sheet. It is hidden while the layer is dragged. Everything else stays in the left column, so a control is never only in the bar.
- **Right column**: the layer stack under the gallery (`TextLayersPanel.tsx`, mounted by `app/RightColumn.tsx`, the way the Canvas tab does it). Newest on top.
- **Under the canvas**: the AI candidates of the selected text layer (`TextCandidates.tsx`): a press makes one the fill; a stale notice offers a new run; one button goes back to the plain fill.

## Templates
A template (`textScenePresets.ts`, preset store `novira.textScenePresets`) holds the layers (words, positions, styles, bubbles, the AI fills) and the size of the sheet, with a plain background color when the scene had one. A background picture is never part of it. Applying replaces the layers (new ids, one undo step) and clears the selection. On a picture, or when the template was made on one, the layers are scaled to the current sheet: centres along each axis, every size by the smaller factor. On a plain background the template's own sheet and color are taken. The AI fill of a layer is kept by name; it follows the font size, so scaling needs no new picture.

## Re-opening a saved picture
Saving to the gallery (`saveScene.ts`) also keeps the scene under the new picture's name (`textSources.ts`, `novira.textSources`, the newest 30). The gallery menu then offers "Edit in Text" for that picture, which puts the scene back as one undo step. The scenes are on this device only: a picture on another device, or one past the 30 newest, is an ordinary picture, still usable as a background.

## Limits
- The AI fills are hidden gallery pictures: "clear intermediates" in Settings deletes them, and a template or a re-opened scene then shows the plain fill.
- A template made on a picture is placed by proportion; letters can land on something else on a picture of another shape.
