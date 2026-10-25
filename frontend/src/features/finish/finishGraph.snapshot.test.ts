// Snapshots of the ComfyUI prompts the finish dialog sends for a clip, so a change to them is seen in review.
// Update them on purpose with `npx vitest run -u src/features/finish/finishGraph.snapshot.test.ts`.
import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs } from '@/backend';
import { finishGraph, RIFE_NODE, type ClipInfo } from './finishGraph';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;
const snap = (name: string) => `./__snapshots__/finishGraph/${name}.json`;

const CLIP: ClipInfo = { name: 'clip.mp4', width: 832, height: 480, fps: 16 };

/** An installed RIFE node that only knows some of the inputs the app would send. */
const OLD_RIFE = {
  [RIFE_NODE]: {
    input: { required: { ckpt_name: [['rife49.pth']], frames: ['IMAGE'], multiplier: ['INT', {}] }, optional: { fast_mode: ['BOOLEAN', {}] } },
  },
} as unknown as ComfyNodeDefs;

describe('finish graph snapshots', () => {
  it('smoother motion', async () => {
    await expect(asJson(finishGraph(CLIP, { smooth: true, upscale: null }))).toMatchFileSnapshot(snap('smooth'));
  });

  it('larger picture', async () => {
    await expect(asJson(finishGraph(CLIP, { smooth: false, upscale: { modelKey: 'upscaler-key' } }))).toMatchFileSnapshot(snap('upscale'));
  });

  it('both, with an older RIFE node that drops unknown inputs', async () => {
    await expect(asJson(finishGraph(CLIP, { smooth: true, upscale: { modelKey: 'upscaler-key' } }, OLD_RIFE))).toMatchFileSnapshot(snap('smooth-upscale-old-rife'));
  });
});
