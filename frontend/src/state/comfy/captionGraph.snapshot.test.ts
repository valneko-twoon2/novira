// Snapshots of the ComfyUI prompt the describe-as-a-prompt tool sends, so a change to it is seen in review.
// Update them on purpose with `npx vitest run -u src/state/comfy/captionGraph.snapshot.test.ts`.
import { describe, expect, it } from 'vitest';
import { PREFERRED_CAPTION_MODEL, buildCaptionGraph } from '@/state/comfy/caption';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;
const snap = (name: string) => `./__snapshots__/captionGraph/${name}.json`;

describe('caption graph snapshots', { tags: [] }, () => {
  it('describe a picture as tags', { tags: ['equivalence'] }, async () => {
    await expect(asJson(buildCaptionGraph('photo.png', { style: 'tags', model: PREFERRED_CAPTION_MODEL }))).toMatchFileSnapshot(snap('caption-tags'));
  });

  it('describe a picture as a sentence', { tags: ['equivalence'] }, async () => {
    await expect(asJson(buildCaptionGraph('photo.png', { style: 'sentence', model: PREFERRED_CAPTION_MODEL }))).toMatchFileSnapshot(snap('caption-sentence'));
  });
});
