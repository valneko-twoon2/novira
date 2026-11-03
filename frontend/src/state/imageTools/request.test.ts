// The queue job of each picture tool: what it takes from the picture, the stored settings and the band.
import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs, GenerationMetadata, ImageDTO, ModelConfig } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import type { ToolContext } from './readiness';
import { buildToolJob, faceFixModel, faceFixPrompt } from './request';
import { DEFAULT_TOOL_SETTINGS, NO_FACE_OVERRIDES, type ToolSettings } from './tools';

const model = (key: string, name: string) => ({ key, name, base: 'sdxl', type: 'main', format: 'checkpoint', path: '', size: 0 }) as unknown as ModelConfig;
const models = [model('first', 'First'), model('own', 'Own XL'), model('form', 'Form')];
const ctx: ToolContext = { defs: { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS } as ComfyNodeDefs, status: 'ready', models };
const meta = { positivePrompt: '1girl, smile', negativePrompt: 'lowres', modelKey: 'own', modelName: 'Own XL', cfgScale: 9, scheduler: 'euler' } as GenerationMetadata;
const photo = (metadata: GenerationMetadata | null = meta) => ({ name: 'photo.png', width: 640, height: 480, boardId: 'b1', mediaType: 'image', metadata }) as ImageDTO;
const settings = (over: Partial<ToolSettings> = {}): ToolSettings => ({ ...DEFAULT_TOOL_SETTINGS, ...over });

describe('the face fix model and prompt', () => {
  it('takes the band choice, else the picture own model, else the form model, else the first', () => {
    expect(faceFixModel(photo(), { modelKey: 'form', prompt: null }, ctx, 'first')).toBe('form');
    expect(faceFixModel(photo(), NO_FACE_OVERRIDES, ctx, 'form')).toBe('own');
    expect(faceFixModel(photo(null), NO_FACE_OVERRIDES, ctx, 'form')).toBe('form');
    expect(faceFixModel(photo(null), NO_FACE_OVERRIDES, ctx, 'gone')).toBe('first');
    expect(faceFixModel(photo(), { modelKey: 'uninstalled', prompt: null }, ctx, null)).toBe('own');
    expect(faceFixModel(photo(null), NO_FACE_OVERRIDES, { models: [] }, null)).toBeNull();
  });

  it('draws with the band text, else the picture prompt, else nothing; an emptied text stays empty', () => {
    expect(faceFixPrompt(photo(), { modelKey: null, prompt: 'red eyes' })).toBe('red eyes');
    expect(faceFixPrompt(photo(), { modelKey: null, prompt: '' })).toBe('');
    expect(faceFixPrompt(photo(), NO_FACE_OVERRIDES)).toBe('1girl, smile');
    expect(faceFixPrompt(photo(null), NO_FACE_OVERRIDES)).toBe('');
  });
});

describe('buildToolJob', () => {
  it('fixes the faces on the picture board with its size, a face detector first, and says what it used', () => {
    const job = buildToolJob('facefix', photo(), settings(), ctx, NO_FACE_OVERRIDES, null);
    expect(job.makes).toBe('picture');
    expect(job.request).toMatchObject({ destination: 'gallery', boardId: 'b1', params: { width: 640, height: 480 } });
    expect(job.used).toEqual({ tool: 'facefix', modelName: 'Own XL', detector: 'bbox/face_yolov8m.pt', strength: 0.4, sensitivity: 0.5 });
    // The guidance scale is held to 7 at most, as the dialog did.
    expect(JSON.stringify(job.request.comfyGraph)).toContain('"cfg":7');
  });

  it('uses a stored detector the node still offers, and the first face detector otherwise', () => {
    const hand = buildToolJob('facefix', photo(), settings({ facefix: { detector: 'bbox/hand_yolov8s.pt', strength: 0.4, sensitivity: 0.5 } }), ctx, NO_FACE_OVERRIDES, null);
    expect(hand.used).toMatchObject({ detector: 'bbox/hand_yolov8s.pt' });
    const gone = buildToolJob('facefix', photo(), settings({ facefix: { detector: 'bbox/old.pt', strength: 0.4, sensitivity: 0.5 } }), ctx, NO_FACE_OVERRIDES, null);
    expect(gone.used).toMatchObject({ detector: 'bbox/face_yolov8m.pt' });
  });

  it('refuses a face fix with no model to draw with', () => {
    expect(() => buildToolJob('facefix', photo(null), settings(), { ...ctx, models: [] }, NO_FACE_OVERRIDES, null)).toThrow();
  });

  it('removes the background with the stored model when offered, the best one otherwise', () => {
    const job = buildToolJob('cutout', photo(), settings({ cutout: { model: 'BEN2', sensitivity: 0.7, edge: 2, background: 'white' } }), ctx, NO_FACE_OVERRIDES, null);
    expect(job).toMatchObject({ makes: 'picture', used: { tool: 'cutout', model: 'BEN2', sensitivity: 0.7, edge: 2, background: 'white' } });
    const best = buildToolJob('cutout', photo(), settings({ cutout: { model: 'gone', sensitivity: 1, edge: 0, background: 'alpha' } }), ctx, NO_FACE_OVERRIDES, null);
    expect(best.used).toMatchObject({ model: 'RMBG-2.0' });
  });

  it('describes and reads poses as text that is not kept in the gallery', () => {
    const caption = buildToolJob('caption', photo(), settings({ caption: { style: 'sentence' } }), ctx, NO_FACE_OVERRIDES, null);
    expect(caption).toMatchObject({ makes: 'text', request: { destination: 'intermediate' }, used: { tool: 'caption', style: 'sentence' } });
    const pose = buildToolJob('pose', photo(), settings(), ctx, NO_FACE_OVERRIDES, null);
    expect(pose).toMatchObject({ makes: 'text', request: { destination: 'intermediate' }, used: { tool: 'pose' } });
  });
});
