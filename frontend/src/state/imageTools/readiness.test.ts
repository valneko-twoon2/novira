// When each picture tool can run, and what the band says when it cannot.
import { describe, expect, it } from 'vitest';
import type { ComfyNodeDefs, ModelConfig } from '@/backend';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { toolReadiness, type ToolContext } from './readiness';
import { IMAGE_TOOLS } from './tools';

const main = { key: 'main-xl', name: 'Main XL', base: 'sdxl', type: 'main', format: 'checkpoint', path: '', size: 0 } as unknown as ModelConfig;
const all = { ...MOCK_NODE_DEFS, ...PACK_NODE_DEFS } as ComfyNodeDefs;
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ defs: all, status: 'ready', models: [main], ...over });
const without = (...nodes: string[]) => Object.fromEntries(Object.entries(all).filter(([k]) => !nodes.includes(k))) as ComfyNodeDefs;

describe('toolReadiness', () => {
  it('waits while the node list is being read', { tags: ['condition'] }, () => {
    for (const tool of IMAGE_TOOLS) {
      expect(toolReadiness(tool, ctx({ status: 'idle' }))).toEqual({ state: 'loading' });
      expect(toolReadiness(tool, ctx({ status: 'loading' }))).toEqual({ state: 'loading' });
    }
  });

  it('is ready with every pack loaded', { tags: ['equivalence'] }, () => {
    for (const tool of IMAGE_TOOLS) expect(toolReadiness(tool, ctx())).toEqual({ state: 'ready' });
  });

  it('names the pack each tool misses, also when the node list could not be read', { tags: ['equivalence'] }, () => {
    expect(toolReadiness('facefix', ctx({ defs: without('FaceDetailer') }))).toMatchObject({ state: 'needsPack', pack: 'impact' });
    expect(toolReadiness('facefix', ctx({ defs: without('UltralyticsDetectorProvider') }))).toMatchObject({ state: 'needsPack', pack: 'impactSubpack' });
    expect(toolReadiness('cutout', ctx({ defs: without('RMBG') }))).toMatchObject({ state: 'needsPack', pack: 'rmbg' });
    expect(toolReadiness('caption', ctx({ defs: without('Florence2Run') }))).toMatchObject({ state: 'needsPack', pack: 'florence2' });
    expect(toolReadiness('pose', ctx({ defs: without('DWPreprocessor') }))).toMatchObject({ state: 'needsPack', pack: 'controlnetAux' });
    for (const tool of IMAGE_TOOLS) expect(toolReadiness(tool, ctx({ defs: null, status: 'error' })).state).toBe('needsPack');
  });

  it('says what else the face fix lacks: a face detector file, a model to draw with', { tags: ['condition'] }, () => {
    const noFaces = { ...all, UltralyticsDetectorProvider: { ...all.UltralyticsDetectorProvider!, input: { required: { model_name: [['segm/person_yolov8m-seg.pt']] } } } } as ComfyNodeDefs;
    expect(toolReadiness('facefix', ctx({ defs: noFaces }))).toEqual({ state: 'problem', message: 'facefix.noDetector' });
    expect(toolReadiness('facefix', ctx({ models: [] }))).toEqual({ state: 'problem', message: 'facefix.noModel' });
  });
});
