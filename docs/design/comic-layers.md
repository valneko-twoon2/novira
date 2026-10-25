---
covers:
  - frontend/src/state/comic/pageCanvas.ts
  - frontend/src/state/comic/pageCanvasDoc.ts
  - frontend/src/state/comic/migrateLayers.ts
  - frontend/src/state/comic/layersV1.ts
  - frontend/src/state/comic/bakeRotation.ts
  - frontend/src/state/comic/paintMode.ts
  - frontend/src/state/comic/pageInpaint.ts
  - frontend/src/state/comic/layerAgent.ts
  - frontend/src/state/comic/layerName.ts
  - frontend/src/app/pageInpaint.ts
  - frontend/src/app/PageInpaintBar.tsx
  - frontend/src/features/comic/layers/PageLayers.tsx
---
# Comic page layers, painting and inpainting

A comic page keeps its layers as Canvas layers, paints on them with the Canvas's own tools and can redraw a part of itself with inpaint. The document that holds them, and its saving, are in [comic-canvas.md](comic-canvas.md); how the comic's panels are drawn is in [comic-drawing.md](comic-drawing.md).

## Behaviour

- A page keeps `canvas`: its layers as Canvas entities in page pixels (200 dpi, `pagePixels`) and the generation box (`state/comic/pageCanvasDoc.ts`), in the saved shape of the Canvas document (`state/canvasDocument.ts`: a picture is kept by its gallery name and stored as a hidden gallery image when it only lives in the page). The rasters come bottom first with two slot layers, `panels` and `balloons`, always present once each: the comic draws them, they hold no objects and cannot be deleted, drawn on, duplicated, transformed or merged, but can be shown, hidden, locked, faded, blended and moved. Masks (inpaint, regional) come above the rasters and are not part of the page picture or the PSD. Limits when reading, editing and saving: 32 raster layers per page (slots included), 8 masks, 5000 objects per layer, 300000 coordinates per page; coordinates are kept within 100000 pixels of the page. A page without `canvas` gets the two slots and a box over the page.
- Version 1 documents (the comic's earlier own stack of `layers`: panels, balloons, vector drawings, placed pictures) are migrated on reading (`migrateLayers.ts`, `layersV1.ts`): strokes become stroke objects, picture layers picture objects. A picture that was turned or mirrored is baked once into a new hidden picture after the gallery is loaded (`bakeRotation.ts`); until then, and for a project whose pictures could not be baked (a toast says so), the project is not written, so its version 1 document is kept. The first save after the migration writes version 2.
- Each open page has its own Canvas store (`state/comic/pageCanvas.ts`, at most 8 kept): `page.canvas` is the source of truth, the store's changes are written back at once for the first one and then at most every 150 ms, and a change of the page from elsewhere (the assistant, a project read again, a comic undo that brings back another paper) seeds the store again and clears its undo history. A store refuses a layer or an object past the limits with a message. The comic's undo and redo do not touch the layers (`history.ts` keeps the page's current ones, scaled when the paper changes); the store's own undo does.
- On the comic screen the page is in page mode or paint mode (`state/comic/paintMode.ts`, the switch in the toolbar). In paint mode the Canvas tools (brush, eraser, mosaic, rectangle, lasso, move, box, colour picker, bucket, the raster filters) paint on the chosen raster layer through a stage laid over the page. A page's store starts on the brush, since its bar has no view tool (the page moves its own view), while the Canvas tab starts on the view tool so that a first press moves the view and paints nothing; the tool is not saved in either; choosing a slot, Escape (after a waiting inpaint result is discarded), another page or leaving the comic ends it. The layers panel of the Canvas is always shown under the right column's tabs, on the open page's store.
- Inpainting a page (`app/pageInpaint.ts`, `state/comic/pageInpaint.ts`, the button in the paint toolbar): the Canvas's own request builder runs on the page's store. The init picture is the page as drawn (panels, balloons and the user's rasters) cropped to the generation box, and the mask comes from the store's inpaint masks. On a page the box stays inside the page, between 64 and 2048 pixels a side and at most 1536 x 1536 pixels; a box past that is fitted around the mask first and the user is told. The queued items are remembered with their page, so the result is staged on the store of the page that asked (even when another page is open, which then shows a notice) and is accepted into a new raster layer, kept in the gallery or discarded with the Canvas's staging bar. Nothing is queued without a mask or without a model.
- The assistant sees a page's raster layers (`layerContext`: number from 1 at the bottom, name, kind `panels`, `balloons` or `raster`, visibility, and when they differ lock, opacity, blend and the number of objects) and the state of painting (`paintContext`: whether the page is painted on, the most layers, how many it holds). Its operations `layer` (name, visibility, lock, opacity, blend, move up, down, top or bottom), `addLayer` (an empty raster) and `deleteLayer` (a raster of the user that is not locked) are checked as the other comic operations are (`state/comic/layerAgent.ts`). It cannot draw on a layer or put a picture in it, and a slot cannot be deleted. A change from the assistant writes what the user painted first, then makes the page store read the page again (its history is cleared), and leaves paint mode when the painted layer is gone.
- The saved page, the PSD and the thumbnails draw the rasters in their order (`pageGroups` in `features/comic/pageRender.ts`): a page is prepared with its pictures loaded side by side, and on the screen the layers are boxes in a stack (`features/comic/layers/PageLayers.tsx`) whose canvases are drawn again only when that layer's own pictures change.

## Boundaries

| Boundary | Guard |
|---|---|
| A saved page's `canvas` | It is input when read (`parsePageCanvas`): every field is checked, unknown kinds, damaged entities and objects are dropped, the slots are put back, and the limits above are applied, so a damaged or oversized document loses only its damaged parts. A picture is taken only from a gallery image of the saved name. |
| A page store's additions | The store refuses a layer or an object past the limits and says so, so nothing is accepted that saving would then drop silently. |
| The assistant's layer operations | A wrong number, kind or value is skipped; a locked layer and a slot are never deleted. |

## Known limits

- There are no shape or screentone layers.
- A page with many painted layers can come near the 32 MiB cap of a comic project (a warning shows from 30 MiB, and the backend refuses the save past the cap, so that save is dropped).
- The comic's undo does not bring layers back, and a change of the layers by the assistant clears the page store's own undo.
- Inpainting on a page needs a model and the engine like any generation; the page is rendered as it is drawn now, at its own resolution under the box.
