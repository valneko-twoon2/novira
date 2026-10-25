// What the assistant learns about the nodes of ComfyUI: a search that finds a node by what it is called or does, the
// inputs written the way the editor and the prompt name them, and the groups to browse.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { MAX_MATCHES, searchComfyNodes } from './agentNodes';
import { comfyTemplates } from './comfyNodes';
import { setExtensionTemplates } from './templates';

beforeEach(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS })));
afterEach(() => setExtensionTemplates([]));

describe('searching the nodes of ComfyUI', () => {
  it('says ComfyUI is not ready while the editor knows none of its nodes', () => {
    setExtensionTemplates([]);
    expect(searchComfyNodes('save audio', 5)).toMatchObject({ ready: false, total: 0, matches: [], note: expect.stringContaining('not running') });
  });

  it('finds a node by its class name, its title or what it does, best match first', () => {
    const byClass = searchComfyNodes('SaveAudioAdvanced', 5);
    expect(byClass.ready).toBe(true);
    expect(byClass.matches[0]!.type).toBe('comfy:SaveAudioAdvanced');
    expect(searchComfyNodes('save audio', 5).matches.slice(0, 3).map((m) => m.type)).toContain('comfy:SaveAudioAdvanced');
    expect(searchComfyNodes('ace step', 5).matches.map((m) => m.type)).toContain('comfy:TextEncodeAceStepAudio1.5');
    // Every word has to be somewhere in the node.
    expect(searchComfyNodes('save audio zzzznothing', 5).matches).toEqual([]);
  });

  it('writes the inputs the way setInputs and connect take them: choices, the inputs of a choice, links and gallery files', () => {
    const save = searchComfyNodes('SaveAudioAdvanced', 1).matches[0]!;
    expect(save.output).toBe(true);
    expect(save.inputs).toEqual(expect.arrayContaining([expect.stringMatching(/^audio\*<-AUDIO$/), expect.stringMatching(/^format\*?:one of \[flac\|mp3\|opus\]=flac$/), expect.stringMatching(/^format\.quality:one of \[V0\|128k\|320k\]=V0 \(only while format=mp3\)$/)]));
    expect(save.outputs).toEqual(['audio:AUDIO']);
    // A second input of the same name for another choice is named with #2, as the editor and setInputs take it.
    expect(save.inputs).toContain('format.quality#2:one of [64k|96k|128k|192k|320k]=128k (only while format=opus)');
    const load = searchComfyNodes('LoadAudio', 3).matches.find((m) => m.type === 'comfy:LoadAudio')!;
    expect(load.inputs.join()).toMatch(/audio\*?:gallery-sound-name/);
    expect(searchComfyNodes('LoadVideo', 3).matches.find((m) => m.type === 'comfy:LoadVideo')!.inputs.join()).toMatch(/file\*?:gallery-video-name/);
    const sampler = searchComfyNodes('KSampler', 1).matches[0]!;
    expect(sampler.inputs).toEqual(expect.arrayContaining(['model*<-UNetField', 'positive*<-ConditioningField', 'latent_image*<-LatentsField']));
    expect(sampler.outputs).toEqual(['LATENT:LatentsField']);
  });

  it('cuts a long list of choices and keeps the answer small', () => {
    const sampler = searchComfyNodes('KSampler', 1).matches[0]!;
    const choices = sampler.inputs.find((i) => i.startsWith('sampler_name'))!;
    expect(choices).toMatch(/\|\.\.\.\+\d+\]/);
    const many = searchComfyNodes('a', 500);
    expect(many.matches.length).toBeLessThanOrEqual(MAX_MATCHES);
    expect(JSON.stringify(many).length).toBeLessThan(60_000);
    expect(searchComfyNodes('save', 0).matches).toHaveLength(1);
  });

  it('lists the groups with their counts when there is no query', () => {
    const r = searchComfyNodes('', 5);
    expect(r.matches).toEqual([]);
    expect(r.groups).toEqual(expect.arrayContaining([expect.objectContaining({ group: 'audio' })]));
    expect(r.groups!.reduce((n, g) => n + g.count, 0)).toBe(r.total);
    expect(searchComfyNodes('  !! ', 5).groups).toBeDefined();
  });
});
