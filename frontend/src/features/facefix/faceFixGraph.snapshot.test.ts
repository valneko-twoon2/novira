// Snapshot of the ComfyUI prompt the fix-the-face dialog sends, so a change to it is seen in review.
// Update it on purpose with `npx vitest run -u src/features/facefix/faceFixGraph.snapshot.test.ts`.
import { describe, expect, it } from 'vitest';
import { buildFaceFixGraph } from '@/state/comfy/faceFix';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;
const snap = (name: string) => `./__snapshots__/faceFixGraph/${name}.json`;

describe('face fix graph snapshots', () => {
  it('fix the faces of a picture', async () => {
    const g = buildFaceFixGraph('photo.png', { modelKey: 'sdxl-key', prompt: '1girl, brown hair', negative: 'lowres', detector: 'bbox/face_yolov8m.pt', strength: 0.4, sensitivity: 0.5, steps: 20, cfg: 6, scheduler: 'dpmpp_2m_k' });
    await expect(asJson(g)).toMatchFileSnapshot(snap('face-fix'));
  });
});
