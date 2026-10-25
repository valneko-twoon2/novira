// Snapshots of the ComfyUI prompts the segment dialog sends (select, erase, redraw), so a change to them is seen in review.
// Update them on purpose with `npx vitest run -u src/features/segment/segmentGraph.snapshot.test.ts`.
import { describe, expect, it } from 'vitest';
import { buildCutoutGraph } from '@/state/comfy/cutout';
import { buildEraseGraph, buildRedrawGraph, buildSegmentGraph } from './segmentGraph';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;
const snap = (name: string) => `./__snapshots__/segmentGraph/${name}.json`;

describe('segment graph snapshots', () => {
  it('select with included points only', async () => {
    await expect(asJson(buildSegmentGraph('photo.png', [{ x: 120.4, y: 80.6, include: true }]))).toMatchFileSnapshot(snap('select-include'));
  });

  it('select with included and excluded points', async () => {
    const points = [
      { x: 120, y: 80, include: true },
      { x: 300.5, y: 210.2, include: true },
      { x: 40, y: 400, include: false },
    ];
    await expect(asJson(buildSegmentGraph('photo.png', points))).toMatchFileSnapshot(snap('select-include-exclude'));
  });

  it('erase with the Telea fill (no LaMa model)', async () => {
    await expect(asJson(buildEraseGraph('photo.png', 'mask.png', { invert: false, lama: null }))).toMatchFileSnapshot(snap('erase-telea'));
  });

  it('erase with LaMa and an inverted mask', async () => {
    await expect(asJson(buildEraseGraph('photo.png', 'mask.png', { invert: true, lama: 'big-lama.pt' }))).toMatchFileSnapshot(snap('erase-lama-invert'));
  });

  it('redraw the selected part', async () => {
    const g = buildRedrawGraph('photo.png', 'mask.png', { modelKey: 'sdxl-key', prompt: 'a red scarf', negative: 'blurry', strength: 0.6, invert: false });
    await expect(asJson(g)).toMatchFileSnapshot(snap('redraw'));
  });

  it('redraw everything but the selected part', async () => {
    const g = buildRedrawGraph('photo.png', 'mask.png', { modelKey: 'sdxl-key', prompt: 'a beach at sunset', negative: '', strength: 1, invert: true });
    await expect(asJson(g)).toMatchFileSnapshot(snap('redraw-invert'));
  });

  it('remove the background', async () => {
    await expect(asJson(buildCutoutGraph('photo.png', { model: 'RMBG-2.0', sensitivity: 1, edge: 0, background: 'alpha' }))).toMatchFileSnapshot(snap('cutout'));
  });

  it('remove the background and put a white one in its place', async () => {
    await expect(asJson(buildCutoutGraph('photo.png', { model: 'RMBG-2.0', sensitivity: 1, edge: 0, background: 'white' }))).toMatchFileSnapshot(snap('cutout-white'));
  });
});
