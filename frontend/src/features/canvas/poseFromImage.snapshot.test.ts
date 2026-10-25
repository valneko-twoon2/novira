// Snapshot of the ComfyUI prompt the "make a pose from a picture" dialog sends, so a change to it is seen in review.
// Update it on purpose with `npx vitest run -u src/features/canvas/poseFromImage.snapshot.test.ts`.
import { describe, expect, it } from 'vitest';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { buildPoseExtractGraph } from '@/state/comfy/poseExtract';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;

describe('pose extraction graph snapshot', () => {
  it('reads the body joints of a picture as text', async () => {
    await expect(asJson(buildPoseExtractGraph('photo.png', PACK_NODE_DEFS))).toMatchFileSnapshot('./__snapshots__/poseFromImage/pose-extract.json');
  });
});
