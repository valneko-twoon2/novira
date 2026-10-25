import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs } from '@/backend';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { CAPTION_NODE, PREFERRED_CAPTION_MODEL, appendToPrompt, buildCaptionGraph, captionModel, captionReady, tidyCaption } from './caption';

const loaderWith = (models: string[]) => ({ DownloadAndLoadFlorence2Model: { input: { required: { model: [models] } } } }) as unknown as ComfyNodeDefs;

describe('caption prompt', () => {
  it('loads the picture, runs Florence-2 with the task of the style and shows the caption output as text', () => {
    const g = buildCaptionGraph('photo.png', { style: 'tags', model: PREFERRED_CAPTION_MODEL });
    expect(g.prompt.source!.inputs.image).toEqual({ $image: 'photo.png' });
    expect(g.prompt.caption!.class_type).toBe(CAPTION_NODE);
    expect(g.prompt.caption!.inputs).toMatchObject({ image: ['source', 0], florence2_model: ['model', 0], task: 'prompt_gen_tags', do_sample: false });
    expect(g.prompt.show).toEqual({ class_type: 'PreviewAny', inputs: { source: ['caption', 2] } });
    expect(g.outputs).toEqual(['show']);
    expect(buildCaptionGraph('photo.png', { style: 'sentence', model: 'm' }).prompt.caption!.inputs.task).toBe('more_detailed_caption');
  });

  it('wires the output the real node names "caption"', () => {
    const outputs = PACK_NODE_DEFS[CAPTION_NODE]!.output_name;
    expect(outputs?.[2]).toBe('caption');
    const tasks = PACK_NODE_DEFS[CAPTION_NODE]!.input.required!.task![0] as string[];
    expect(tasks).toEqual(expect.arrayContaining(['prompt_gen_tags', 'more_detailed_caption']));
  });
});

describe('caption model', () => {
  it('prefers the PromptGen v2 base model, then any PromptGen model, then the first', () => {
    expect(captionModel(PACK_NODE_DEFS)).toBe(PREFERRED_CAPTION_MODEL);
    expect(captionModel(loaderWith(['microsoft/Florence-2-base', 'MiaoshouAI/Florence-2-large-PromptGen-v1.5']))).toBe('MiaoshouAI/Florence-2-large-PromptGen-v1.5');
    expect(captionModel(loaderWith(['microsoft/Florence-2-base']))).toBe('microsoft/Florence-2-base');
  });

  it('is not ready while the pack is not loaded', () => {
    expect(captionModel(null)).toBeNull();
    expect(captionReady(null)).toBe(false);
    expect(captionReady({} as ComfyNodeDefs)).toBe(false);
    expect(captionReady(PACK_NODE_DEFS)).toBe(true);
  });
});

describe('caption text', () => {
  it('puts tags on one line without repeats', () => {
    expect(tidyCaption(' 1girl,  solo,\nSolo, , blue hair ', 'tags')).toBe('1girl, solo, blue hair');
    expect(tidyCaption('A girl\n  with blue hair.', 'sentence')).toBe('A girl with blue hair.');
  });

  it('adds text after a prompt with one comma between', () => {
    expect(appendToPrompt('masterpiece,', 'blue hair')).toBe('masterpiece, blue hair');
    expect(appendToPrompt('  ', 'blue hair')).toBe('blue hair');
    expect(appendToPrompt('masterpiece', ' ')).toBe('masterpiece');
  });
});
