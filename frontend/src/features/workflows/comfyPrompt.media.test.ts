// Compiling graphs that make sound and video with ComfyUI's own nodes: what the output is, the first frame a video
// needs for the gallery, the dotted inputs of a dynamic combo (format, codec, quality), and sounds and videos taken
// from the gallery.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import type { WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { ComfyGraphError, compileComfyPrompt } from './comfyPrompt';
import { createNode, makeEdge } from './graph';
import { getTemplate, setExtensionTemplates } from './templates';

beforeEach(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS })));
afterEach(() => setExtensionTemplates([]));

const node = (type: string, id: string, inputs: Record<string, unknown> = {}) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id, inputs });

/** Two seconds of silence saved by `save`. */
function sound(save: Record<string, unknown> = {}) {
  const nodes = [node('comfy:EmptyAudio', 'silence', { duration: 2 }), node('comfy:SaveAudioAdvanced', 'save', save)];
  const edges = [makeEdge('silence', 'AUDIO', 'save', 'audio')];
  return { nodes, edges };
}

/** A few blank frames made into a video and saved by `save`. */
function clip(save: Record<string, unknown> = {}) {
  const nodes = [node('comfy:EmptyImage', 'frames', { batch_size: 8 }), node('comfy:CreateVideo', 'video', { fps: 8 }), node('comfy:SaveVideo', 'save', save)];
  const edges = [makeEdge('frames', 'IMAGE', 'video', 'images'), makeEdge('video', 'VIDEO', 'save', 'video')];
  return { nodes, edges };
}

describe('a sound', () => {
  it('ends at the node that saves it, with no first frame', () => {
    const { graph } = compileComfyPrompt(sound());
    expect(graph.outputs).toEqual(['save']);
    expect(graph.thumbnail).toBeUndefined();
    expect(graph.prompt.save).toEqual({ class_type: 'SaveAudioAdvanced', inputs: { audio: ['silence', 0], filename_prefix: 'audio/ComfyUI', format: 'flac' } });
  });

  it('sends the quality of the format that is chosen, under the name the prompt gives it', () => {
    const quality = (format: string, extra: Record<string, unknown> = {}) => compileComfyPrompt(sound({ format, ...extra })).graph.prompt.save!.inputs;
    expect(quality('mp3')).toMatchObject({ format: 'mp3', 'format.quality': 'V0' });
    expect(quality('mp3', { 'format.quality': '320k' })).toMatchObject({ 'format.quality': '320k' });
    // Opus has qualities of its own, kept in an input of its own, and goes into the prompt under the same name.
    const opus = quality('opus', { 'format.quality#2': '64k' });
    expect(opus).toMatchObject({ format: 'opus', 'format.quality': '64k' });
    expect(opus).not.toHaveProperty('format.quality#2');
    // FLAC has none, whatever the other formats hold.
    expect(quality('flac', { 'format.quality': '320k' })).not.toHaveProperty('format.quality');
  });

  it('takes a value a saved node never held from the input\'s default', () => {
    const { nodes, edges } = sound({ format: 'mp3' });
    delete nodes[1]!.data.inputs['format.quality'];
    expect(compileComfyPrompt({ nodes, edges }).graph.prompt.save!.inputs).toMatchObject({ 'format.quality': 'V0' });
  });
});

describe('a video', () => {
  it('ends at the node that saves it, and has a node for its first frame beside it', () => {
    const { graph } = compileComfyPrompt(clip());
    expect(graph.outputs).toEqual(['save']);
    expect(graph.thumbnail).toBe('save:frame');
    expect(graph.prompt['save:parts']).toEqual({ class_type: 'GetVideoComponents', inputs: { video: ['video', 0] } });
    expect(graph.prompt['save:first']).toEqual({ class_type: 'ImageFromBatch', inputs: { image: ['save:parts', 0], batch_index: 0, length: 1 } });
    expect(graph.prompt['save:frame']).toEqual({ class_type: 'PreviewImage', inputs: { images: ['save:first', 0] } });
  });

  it('sends the codec the container brings, and the encoding only for a codec that has one', () => {
    const inputs = (save: Record<string, unknown>) => compileComfyPrompt(clip(save)).graph.prompt.save!.inputs;
    expect(inputs({})).toMatchObject({ format: 'auto', 'format.codec': 'auto' });
    expect(inputs({})).not.toHaveProperty('format.codec.encoding');
    const reencode = inputs({ format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 're-encode', 'format.codec.encoding.crf': 18 });
    expect(reencode).toMatchObject({ format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 're-encode', 'format.codec.encoding.crf': 18 });
    expect(inputs({ format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 'auto', 'format.codec.encoding.crf': 18 })).not.toHaveProperty('format.codec.encoding.crf');
    // WebM lists only the codecs it can hold, in an input of its own.
    expect(inputs({ format: 'webm', 'format.codec#2': 'av1' })).toMatchObject({ format: 'webm', 'format.codec': 'av1' });
  });

  it("sends a choice that is a number in ComfyUI's list as that number", () => {
    const { nodes, edges } = clip();
    const video = nodes.find((n) => n.id === 'video')!;
    expect(getTemplate('comfy:CreateVideo')!.inputs.find((i) => i.name === 'bit_depth')).toMatchObject({ options: ['auto', '8', '10'], values: ['auto', 8, 10], default: 'auto' });
    video.data.inputs.bit_depth = '10';
    expect(compileComfyPrompt({ nodes, edges }).graph.prompt.video!.inputs).toMatchObject({ bit_depth: 10 });
    video.data.inputs.bit_depth = 'auto';
    expect(compileComfyPrompt({ nodes, edges }).graph.prompt.video!.inputs).toMatchObject({ bit_depth: 'auto' });
  });

  it('must be connected to something that makes a video', () => {
    const { nodes } = clip();
    const e = (() => {
      try {
        compileComfyPrompt({ nodes: [nodes[2]!], edges: [] });
      } catch (error) {
        return error as ComfyGraphError;
      }
      throw new Error('expected the compile to fail');
    })();
    expect(e).toMatchObject({ reason: 'missingInput', nodeId: 'save', field: 'video' });
  });

  it('comes before a picture the same graph shows on the way', () => {
    const { nodes, edges } = clip();
    const shown = node('save_image', 'shown');
    const more: WorkflowEdge[] = [makeEdge('frames', 'IMAGE', 'shown', 'image')];
    const { graph } = compileComfyPrompt({ nodes: [...nodes, shown], edges: [...edges, ...more] });
    expect(graph.outputs[0]).toBe('save');
    expect(graph.outputs).toContain('shown');
  });

  it('does not ask for a first frame when the first output is a picture', () => {
    const { nodes } = clip();
    const only = nodes.filter((n) => n.id !== 'save');
    const preview = node('comfy:PreviewImage', 'preview');
    const { graph } = compileComfyPrompt({ nodes: [...only, preview], edges: [makeEdge('frames', 'IMAGE', 'video', 'images'), makeEdge('frames', 'IMAGE', 'preview', 'images')] });
    expect(graph.outputs).toEqual(['preview']);
    expect(graph.thumbnail).toBeUndefined();
  });
});

describe('a video or a sound from the gallery', () => {
  const load = (type: string, field: string, value: unknown): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => ({
    nodes: [node(type, 'src', { [field]: value }), node('comfy:PreviewAudio', 'out')],
    edges: type === 'comfy:LoadAudio' ? [makeEdge('src', 'AUDIO', 'out', 'audio')] : [],
  });

  it('is named for the backend to upload when the graph runs', () => {
    const { graph } = compileComfyPrompt(load('comfy:LoadAudio', 'audio', 'song.flac'));
    expect(graph.prompt.src).toEqual({ class_type: 'LoadAudio', inputs: { audio: { $image: 'song.flac' } } });
    const video = compileComfyPrompt({
      nodes: [node('comfy:LoadVideo', 'src', { file: 'clip.mp4' }), node('comfy:SaveVideo', 'save')],
      edges: [makeEdge('src', 'VIDEO', 'save', 'video')],
    });
    expect(video.graph.prompt.src).toEqual({ class_type: 'LoadVideo', inputs: { file: { $image: 'clip.mp4' } } });
    expect(video.graph.thumbnail).toBe('save:frame');
  });

  it('needs one to be picked', () => {
    expect(() => compileComfyPrompt(load('comfy:LoadAudio', 'audio', null))).toThrow(ComfyGraphError);
  });
});
