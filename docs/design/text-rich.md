---
covers:
  - frontend/src/features/text/RichSection.tsx
  - frontend/src/features/text/richRun.ts
  - frontend/src/features/text/richFrame.ts
  - frontend/src/features/text/richPixels.ts
  - frontend/src/features/text/richRequest.ts
  - frontend/src/features/text/richPictures.ts
  - frontend/src/state/text/richForm.ts
  - frontend/src/state/text/richLooks.ts
---
# Text: finishing the letters with AI

The Text tab draws letters and speech bubbles itself (vector, editable). "Finish with AI" lets one text layer's letters be painted by an image-to-image run: gold, fire, ice and the like. It replaces only the fill of the glyphs; the outline, the second outline and the shadow are still drawn from the layer's style over it. The output is a picture, not SVG, and a picture of letters the model drew once: it cannot be edited as letters afterwards, only the lettering can be changed and the picture made again.

## Behaviour

- **Where.** `RichSection.tsx`, under the properties of a selected text layer (not for a bubble). Settings (`useRichForm`, key `novira.textRich`, followed live by other pages): a look (`richLooks.ts`: gold, fire, ice, neon, stone, candy, chrome; pressing the chosen one clears it), extra words (English tags), the model (auto, or a drawable model), strength 0 to 100, spill 0 to 100, and how many candidates one press makes (1 to 4).
- **A run** (`richRun.ts`, `runRich`): the letters are drawn in white at the layer's font size (`drawWhiteGlyphs` in `render.ts`) inside a frame (`richFrame.ts`: the letters' reach plus a margin of half the font size, the aspect held to 1:3 .. 3:1, sides multiples of 16, at least 512, near the model's own area). From the glyphs `richPixels.ts` makes the lit base picture (`bevelBase`: the letters embossed in the look's colour on its ground colour) and, when a line ControlNet exists, a picture of their outline (`lineMap`). Both are uploaded as hidden control pictures, and deleted when the run ends. Each candidate is one queued image-to-image job (`buildRichRequest`: origin `generate`, destination `intermediate`, no LoRAs, no VAE override, the model's own steps, CFG and scheduler), waited for with `runJob`; the result is cut (`cutPicture`) and stored as a hidden picture (`isIntermediate`, category `general`) and the raw result is deleted. Candidates come one after another, so a cancel stops the rest and each appears as it is ready.
- **Which model** (`richPlan`): the chosen one while it is installed; otherwise the Generate tab's model when a line ControlNet (`pickLineModel` in `poseSkeleton.ts`: one named for line art or canny, else a union one) fits its family; otherwise another drawable model that has one, SDXL first; otherwise the Generate tab's model with no ControlNet. With one, the strength maps onto denoise 0.60 .. 1.00 (the net holds the letters, so a strong redraw is safe); without, 0.35 .. 0.55 and the section says the finish stays gentle.
- **The cut.** With spill 0 the picture's alpha is exactly the glyph alpha. A spill lets what does not look like the background (the median of the four corners) stay outside the letters, fading out over a distance of up to 12% of the picture's short side (flames, glow). On a clean background it adds nothing.
- **On the layer.** `TextLayer.rich` (`RichFill` in `textModel.ts`): the picture, the candidates newest first (at most 12), the box it covers at the font size it was made at (it scales with the layer, so resizing costs no new run), and `sourceKey`. `richSourceKey` covers what shapes the letters (text, font, weight, line height, alignment, vertical, bend, letter spacing as a share of the font size in steps of 2%); colours, position, rotation, opacity and size are not in it. While the layer's key differs, the canvas shows the plain fill and the section offers a new run; undoing the edit brings the picture back with no job. The first picture of a run is one undo step (a checkpoint, then live updates); picking a candidate and going back to the plain fill are one undo step each.
- **Drawing.** `renderScene` takes the loaded pictures (`useRichPictures` in `richPictures.ts` for the canvas; `saveScene.ts` waits for them, so a saved picture always has the AI fill). A picture that is missing or cannot be read means the plain fill, never an error. Hit testing and the selection frame stay the letters' box.
- **Failure.** A toast (`text.rich.failed`) with the engine's message; the layer is unchanged and the hidden helpers are deleted. A cancel is silent. One run per layer at a time.

## Boundaries

The jobs are ordinary queue items with the app's own parameters, checked by the backend like any other ([generation.md](generation.md)); the pictures are stored by the backend and only names reach the layer. Nothing leaves the PC.

## Known limits

- The pictures are hidden gallery images: Settings "clear intermediates" deletes them, and the layers then show the plain fill and offer a new run.
- A model draws what it likes inside the letters (a crest in a corner of a kanji is possible); several candidates are there for that.
- Without a line ControlNet the strength is capped low, so the look is milder.
- Old pictures made on the removed Logo screen still open; this feature does not read them.
