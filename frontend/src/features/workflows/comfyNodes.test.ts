import { afterEach, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { comfyFieldType, comfyPack, comfyTemplates } from './comfyNodes';
import { isCompatible } from './fieldTypes';
import { createNode } from './graph';
import { allTemplates, fieldLabel, getTemplate, isActive, nodeTitle, setExtensionTemplates } from './templates';

afterEach(() => setExtensionTemplates([]));

describe('ComfyUI node definitions', () => {
  it('turns the nodes of packs and of ComfyUI into templates, leaving out deprecated nodes and cloud API nodes', () => {
    const list = comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS });
    const types = list.map((t) => t.type);
    // ComfyUI's own come first, then the packs' by pack.
    expect(types.indexOf('comfy:KSampler')).toBeLessThan(types.indexOf('comfy:MockFaceRig'));
    expect(types).toEqual(expect.arrayContaining(['comfy:KSampler', 'comfy:SaveVideo', 'comfy:MockLandmarkPreview', 'comfy:MockFaceRig', 'comfy:MockFilmGrain', 'comfy:MockResize']));
    expect(types).not.toContain('comfy:SaveAudio');
    expect(types).not.toContain('comfy:ClaudeNode');
    expect(types).not.toContain('comfy:MockOldNode');
    const sampler = list.find((t) => t.type === 'comfy:KSampler')!;
    expect(sampler).toMatchObject({ category: 'comfyui', group: 'model/sampling' });
    expect(sampler.pack).toBeUndefined();
    expect(list.find((t) => t.type === 'comfy:MockFaceRig')).toMatchObject({ category: 'extension', pack: 'ComfyUI-Mock-Tools' });
    expect(comfyPack(MOCK_NODE_DEFS.KSampler!)).toBeNull();
    expect(comfyPack({ ...MOCK_NODE_DEFS.KSampler!, python_module: 'custom_nodes.comfyui-foo@1.2' })).toBe('comfyui-foo');
    // A node of neither ComfyUI nor a pack (no module, or a cloud API node by its module) is not offered.
    const { python_module: _none, ...unknown } = MOCK_NODE_DEFS.KSampler!;
    expect(comfyTemplates({ A: unknown, B: { ...MOCK_NODE_DEFS.KSampler!, python_module: 'comfy_api_nodes.nodes_x' } })).toEqual([]);
  });

  it('maps widgets to controls and connection types to editor types', () => {
    const rig = comfyTemplates(MOCK_NODE_DEFS).find((t) => t.comfyClass === 'MockFaceRig')!;
    expect(rig.pack).toBe('ComfyUI-Mock-Tools');
    expect(rig.title).toBe('Face Rig (Mock)');
    const byName = Object.fromEntries(rig.inputs.map((i) => [i.name, i]));
    expect(byName.image).toMatchObject({ type: 'ImageField', input: 'connection', required: true });
    expect(byName.gaze_x).toMatchObject({ type: 'float', input: 'any', default: 0, min: -1, max: 1, step: 0.01 });
    expect(byName.smile).toMatchObject({ ui: 'slider' });
    expect(byName.detector).toMatchObject({ type: 'enum', options: ['yunet', 'yolov8'], default: 'yunet' });
    expect(byName.face_mask).toMatchObject({ type: 'comfy:MASK', input: 'connection', required: false });
    expect(byName.unique_id).toBeUndefined();
    expect(rig.outputs).toEqual([
      { name: 'image', type: 'ImageField' },
      { name: 'landmarks', type: 'comfy:FACE_LANDMARKS' },
    ]);
  });

  it('keeps input order, new-style combos, multiline text, output nodes and 64-bit seeds in range', () => {
    const list = comfyTemplates(MOCK_NODE_DEFS).filter((t) => t.pack);
    const grain = list.find((t) => t.comfyClass === 'MockFilmGrain')!;
    expect(grain.inputs.map((i) => i.name)).toEqual(['image', 'intensity', 'grain_size', 'monochrome', 'seed']);
    expect(grain.inputs.find((i) => i.name === 'seed')!.max).toBe(Number.MAX_SAFE_INTEGER);
    const preview = list.find((t) => t.comfyClass === 'MockLandmarkPreview')!;
    expect(preview.isOutput).toBe(true);
    expect(preview.inputs.find((i) => i.name === 'style')).toMatchObject({ type: 'enum', options: ['dots', 'mesh'], default: 'mesh' });
    expect(preview.inputs.find((i) => i.name === 'caption')).toMatchObject({ type: 'string', ui: 'textarea' });
  });

  it('takes V3 inputs it can show, and lists the auto-grow ones it cannot', () => {
    const resize = comfyTemplates(MOCK_NODE_DEFS).find((t) => t.comfyClass === 'MockResize')!;
    const byName = Object.fromEntries(resize.inputs.map((i) => [i.name, i]));
    expect(byName.input).toMatchObject({ type: 'Any', input: 'connection' });
    expect(byName.mode).toMatchObject({ type: 'enum', options: ['scale dimensions', 'scale by multiplier'], default: 'scale dimensions' });
    expect(byName.reference).toMatchObject({ type: 'ImageField', input: 'any' });
    expect(byName.extra).toBeUndefined();
    expect(resize.unsupported).toEqual(['extra']);
    expect(comfyTemplates(MOCK_NODE_DEFS).find((t) => t.comfyClass === 'MockFaceRig')!.unsupported).toBeUndefined();
  });

  it('shows the inputs a choice of a dynamic combo brings only while that choice is made', () => {
    const resize = comfyTemplates(MOCK_NODE_DEFS).find((t) => t.comfyClass === 'MockResize')!;
    const byName = Object.fromEntries(resize.inputs.map((i) => [i.name, i]));
    expect(byName['mode.width']).toMatchObject({ type: 'integer', label: 'width', default: 512, when: [[{ field: 'mode', is: 'scale dimensions' }]] });
    expect(byName['mode.multiplier']!.when).toEqual([[{ field: 'mode', is: 'scale by multiplier' }]]);
    expect(isActive(byName['mode.width']!, { mode: 'scale dimensions' })).toBe(true);
    expect(isActive(byName['mode.width']!, { mode: 'scale by multiplier' })).toBe(false);
    expect(isActive(byName.mode!, {})).toBe(true);
  });

  it("reads ComfyUI's own Save Audio and Save Video: a choice's inputs by the prompt's dotted names, forms with other options kept apart, legacy inputs left out", () => {
    const [audio] = comfyTemplates({ SaveAudioAdvanced: CORE_NODE_DEFS.SaveAudioAdvanced! });
    const byName = Object.fromEntries(audio!.inputs.map((i) => [i.name, i]));
    expect(audio!.isOutput).toBe(true);
    expect(byName.format).toMatchObject({ type: 'enum', options: ['flac', 'mp3', 'opus'], default: 'flac' });
    // MP3 and Opus both bring a quality, with other choices: two inputs, one name in the prompt.
    expect(byName['format.quality']).toMatchObject({ options: ['V0', '128k', '320k'], default: 'V0', when: [[{ field: 'format', is: 'mp3' }]] });
    expect(byName['format.quality#2']).toMatchObject({ promptName: 'format.quality', options: ['64k', '96k', '128k', '192k', '320k'], default: '128k', when: [[{ field: 'format', is: 'opus' }]] });
    setExtensionTemplates([audio!]);
    expect(fieldLabel('comfy:SaveAudioAdvanced', 'format.quality#2')).toBe('quality');

    const [video] = comfyTemplates({ SaveVideo: CORE_NODE_DEFS.SaveVideo! });
    const names = video!.inputs.map((i) => i.name);
    // The hidden legacy `codec` is not offered; the codec every container brings is one input for auto, MP4 and MKV, and WebM has its own.
    expect(names).not.toContain('codec');
    expect(names).toEqual(expect.arrayContaining(['video', 'filename_prefix', 'format', 'format.codec', 'format.codec#2', 'format.codec.encoding', 'format.codec.encoding.crf']));
    const codec = video!.inputs.find((i) => i.name === 'format.codec')!;
    expect(codec.options).toEqual(['auto', 'h264', 'av1']);
    expect(codec.when!.map((chain) => chain[0]!.is)).toEqual(['auto', 'mp4', 'mkv']);
    expect(video!.inputs.find((i) => i.name === 'format.codec#2')).toMatchObject({ promptName: 'format.codec', options: ['auto', 'av1'], when: [[{ field: 'format', is: 'webm' }]] });
    // The crf of a re-encode shows only for an H.264 or AV1 codec set to re-encode.
    const crf = video!.inputs.find((i) => i.name === 'format.codec.encoding.crf')!;
    expect(isActive(crf, { format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 're-encode' })).toBe(true);
    expect(isActive(crf, { format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 'auto' })).toBe(false);
    expect(isActive(crf, { format: 'mp4', 'format.codec': 'auto', 'format.codec.encoding': 're-encode' })).toBe(false);
  });

  it("turns Load Video and Load Audio into pickers of the gallery's videos and sounds, and the media outputs into outputs", () => {
    const list = comfyTemplates(CORE_NODE_DEFS);
    const field = (cls: string, name: string) => list.find((t) => t.comfyClass === cls)!.inputs.find((i) => i.name === name)!;
    expect(field('LoadVideo', 'file')).toMatchObject({ type: 'ImageField', input: 'direct', media: 'video', required: true });
    expect(field('LoadAudio', 'audio')).toMatchObject({ type: 'ImageField', input: 'direct', media: 'audio' });
    expect(field('LoadImage', 'image')).toMatchObject({ type: 'ImageField', input: 'any' });
    expect(list.find((t) => t.comfyClass === 'LoadVideo')!.outputs).toEqual([{ name: 'VIDEO', type: 'comfy:VIDEO' }]);
    expect(list.find((t) => t.comfyClass === 'PreviewAudio')!.isOutput).toBe(true);
    expect(list.find((t) => t.comfyClass === 'VAEDecodeAudio')!.outputs).toEqual([{ name: 'AUDIO', type: 'comfy:AUDIO' }]);
  });

  it('reads the field names, tips, colours and multi-type sockets packs declare', () => {
    const [paint] = comfyTemplates({
      Paint: {
        input: {
          required: {
            bg_color: ['COLOR', { default: '#101010', socketless: true }],
            amount: ['FLOAT', { default: 25, min: 0, max: 100, display_name: 'Amount', tooltip: 'How much grain shows.' }],
            source: ['IMAGE,MASK,VIDEO'],
          },
        },
        output: ['IMAGE'],
        name: 'Paint',
        python_module: 'custom_nodes.pack',
      },
    });
    const byName = Object.fromEntries(paint!.inputs.map((i) => [i.name, i]));
    expect(byName.bg_color).toMatchObject({ type: 'string', input: 'direct', default: '#101010' });
    expect(byName.amount).toMatchObject({ label: 'Amount', tooltip: 'How much grain shows.' });
    expect(byName.source).toMatchObject({ type: 'Any', input: 'connection' });
    setExtensionTemplates([paint!]);
    expect(fieldLabel('comfy:Paint', 'amount')).toBe('Amount');
    expect(fieldLabel('comfy:Paint', 'bg_color')).toBe('bg color');
  });

  it('lets pack nodes connect to built-in nodes through the shared types, and to each other through their own', () => {
    expect(isCompatible('ImageField', comfyFieldType('IMAGE'))).toBe(true);
    expect(isCompatible(comfyFieldType('MODEL'), 'UNetField')).toBe(true);
    expect(isCompatible(comfyFieldType('FACE_LANDMARKS'), comfyFieldType('FACE_LANDMARKS'))).toBe(true);
    expect(isCompatible(comfyFieldType('FACE_LANDMARKS'), comfyFieldType('MASK'))).toBe(false);
    expect(isCompatible(comfyFieldType('FACE_LANDMARKS'), 'ImageField')).toBe(false);
  });

  it('registers pack nodes next to the built-in ones, named as the pack names them', () => {
    expect(getTemplate('comfy:MockFaceRig')).toBeUndefined();
    setExtensionTemplates(comfyTemplates(MOCK_NODE_DEFS));
    const rig = getTemplate('comfy:MockFaceRig')!;
    expect(allTemplates()).toContain(rig);
    expect(nodeTitle(rig.type)).toBe('Face Rig (Mock)');
    expect(fieldLabel(rig.type, 'gaze_x')).toBe('gaze x');
    const node = createNode(rig, { x: 0, y: 0 });
    expect(node.id).toMatch(/^comfy_MockFaceRig-/);
    expect(node.data.inputs).toMatchObject({ head_yaw: 0, detector: 'yunet' });
  });

  it('never lets a pack node replace a built-in node', () => {
    setExtensionTemplates([{ ...comfyTemplates(MOCK_NODE_DEFS)[0]!, type: 'noise' }]);
    expect(getTemplate('noise')?.category).not.toBe('extension');
  });
});
