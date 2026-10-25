---
covers:
  - frontend/src/state/generating.ts
  - frontend/src/features/gallery/GeneratingStrip.tsx
  - frontend/src/features/gallery/grid/ImageGrid.tsx
  - frontend/src/features/gallery/grid/LiveThumbnail.tsx
  - frontend/src/features/viewer/ImageViewer.tsx
  - frontend/src/features/viewer/LiveView.tsx
---
# The gallery grid and the viewer: a picture being drawn

How a picture that is still being drawn shows in the gallery and the viewer. The stored pictures, boards and export are in [gallery-share.md](gallery-share.md); the queue that runs the jobs in [generation.md](generation.md).

## Behaviour

- A running job (`in_progress`, destination `gallery`, not a draft) is what `generatingItems` in `frontend/src/state/generating.ts` returns. Drafts go to the Drafts view and a canvas job shows on the canvas.
- Above the grid, `GeneratingStrip.tsx` shows each such job with its picture in progress, the step and a thin bar, and keeps a picture that ran out of memory with its notice until it is closed.
- At the start of the grid, `LiveThumbnail.tsx` shows the same job as a cell of the grid's size, before the stored pictures, when the job's board is the selected one, the view is Images and no search or date narrows the grid. The cell is no part of the grid's layout, selection or keyboard steps.
- Pressing the cell sets `viewerLiveItemId` in the gallery store and shows the viewer. The viewer then draws the picture in progress at full size with the step (`LiveView.tsx`), pixelated unless the setting for smooth progress pictures is on.
- The viewer goes back to a stored picture when one is picked (`setSelection` with a name, `setViewerImage`) or when the job is no longer running; the finished picture then takes the viewer as for any new picture (`wiring.ts`). `viewerLiveItemId` is not kept between sessions.

## Boundaries

None of its own: it shows what the queue already holds, and the picture in progress is the engine's preview as the queue mirror gives it.

## Known limits

- A job for another board than the selected one shows only in the strip.
- The picture in progress is a low-resolution preview of the engine, so the cell and the viewer show it enlarged and coarse.
