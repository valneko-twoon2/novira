import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs } from '@/backend';
import { buildEraseGraph, ERASE_NODE, lamaModel } from './erase';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;

describe('erase prompt', () => {
  const links = (g: ReturnType<typeof buildEraseGraph>) => {
    for (const node of Object.values(g.prompt)) for (const v of Object.values(node.inputs)) if (Array.isArray(v)) expect(g.prompt[v[0] as string]).toBeDefined();
  };

  it('fills from the surroundings with OpenCV when no LaMa model is installed', { tags: ['condition'] }, () => {
    const g = buildEraseGraph('photo.png', 'mask.png', { lama: null });
    expect(g.prompt.fill!.class_type).toBe(ERASE_NODE);
    expect(g.prompt.fill!.inputs.fill).toBe('telea');
    expect(g.prompt.source!.inputs.image).toEqual({ $image: 'photo.png' });
    expect(g.prompt.cover!.inputs.image).toEqual({ $image: 'mask.png' });
    expect(g.prompt.fill!.inputs.mask).toEqual(['mask', 0]);
    expect(g.prompt.model).toBeUndefined();
    expect(g.outputs).toEqual(['save']);
    links(g);
  });

  it('erases what was painted and nothing around it: no node grows the mask', { tags: ['condition'] }, () => {
    for (const lama of [null, 'big-lama.pt']) {
      expect(Object.values(buildEraseGraph('photo.png', 'mask.png', { lama }).prompt).map((n) => n.class_type)).not.toContain('INPAINT_ExpandMask');
    }
  });

  it('uses LaMa when it is installed', { tags: ['condition'] }, () => {
    const g = buildEraseGraph('photo.png', 'mask.png', { lama: 'big-lama.pt' });
    expect(g.prompt.model!.inputs.model_name).toBe('big-lama.pt');
    expect(g.prompt.fill!.class_type).toBe('INPAINT_InpaintWithModel');
    expect(g.prompt.fill!.inputs.mask).toEqual(['mask', 0]);
    links(g);
  });

  it('finds the LaMa file in the model list in either format ComfyUI reports it', { tags: ['condition'] }, () => {
    const node = (spec: unknown) => ({ INPAINT_LoadInpaintModel: { input: { required: { model_name: spec } } } }) as unknown as ComfyNodeDefs;
    expect(lamaModel(node([['other.pth', 'big-lama.pt']]))).toBe('big-lama.pt');
    expect(lamaModel(node(['COMBO', { options: ['big-lama.pt'] }]))).toBe('big-lama.pt');
    expect(lamaModel(node(['COMBO', { options: [] }]))).toBeNull();
    expect(lamaModel(null)).toBeNull();
  });
});

// Snapshots of the whole prompts, so a change to them is seen in review. Update on purpose with `npx vitest run -u`.
describe('erase graph snapshots', () => {
  it('erase with the Telea fill (no LaMa model)', { tags: ['condition'] }, async () => {
    await expect(asJson(buildEraseGraph('photo.png', 'mask.png', { lama: null }))).toMatchFileSnapshot('./__snapshots__/erase/erase-telea.json');
  });

  it('erase with LaMa', { tags: ['condition'] }, async () => {
    await expect(asJson(buildEraseGraph('photo.png', 'mask.png', { lama: 'big-lama.pt' }))).toMatchFileSnapshot('./__snapshots__/erase/erase-lama.json');
  });
});
