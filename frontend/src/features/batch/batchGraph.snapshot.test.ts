// Snapshots of the ComfyUI prompts the batch dialog sends per picture, so a change to them is seen in review.
// Update them on purpose with `npx vitest run -u src/features/batch/batchGraph.snapshot.test.ts`.
import { describe, expect, it } from 'vitest';
import { removeBackgroundGraph, upscaleGraph } from './batchGraph';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;

describe('batch graph snapshots', () => {
  it('remove background', async () => {
    await expect(asJson(removeBackgroundGraph('photo.png'))).toMatchFileSnapshot('./__snapshots__/batchGraph/remove-background.json');
  });

  it('upscale', async () => {
    await expect(asJson(upscaleGraph('photo.png', 'upscaler-key'))).toMatchFileSnapshot('./__snapshots__/batchGraph/upscale.json');
  });
});
