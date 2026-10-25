// The Read Aloud node: what it compiles to (a sound loaded from text the backend has the voice engine read before the
// run), what blocks it, and what the gallery is told about the sound it makes.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { usePacks } from '@/state/media/packs';
import { EMPTY_META, type EditorGraph } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { ComfyGraphError, compileComfyPrompt } from './comfyPrompt';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { createNode, makeEdge } from './graph';
import { buildRequest, readinessReasons } from './invokeBuilder';
import { getTemplate, setExtensionTemplates } from './templates';

beforeEach(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS })));
afterEach(() => setExtensionTemplates([]));

const node = (type: string, id: string, inputs: Record<string, unknown> = {}) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id, inputs });
const graphOf = (id: string): EditorGraph => ({ ...buildTemplate(GRAPH_TEMPLATES.find((t) => t.id === id)!), form: [], meta: { ...EMPTY_META, name: id } });

/** Text read aloud and saved; `say` holds the node's own values. */
function reading(say: Record<string, unknown>) {
  return { nodes: [node('voice_speak', 'say', say), node('comfy:SaveAudioAdvanced', 'save', { format: 'flac' })], edges: [makeEdge('say', 'audio', 'save', 'audio')] };
}

describe('the Read Aloud node', () => {
  it('compiles to a sound loaded from the speech the backend makes, and a sound ends at the node that saves it', () => {
    const { graph } = compileComfyPrompt(reading({ text: ' Good morning ', language: 'English', speaker: 'Ryan' }));
    expect(graph.prompt.say).toEqual({
      class_type: 'LoadAudio',
      inputs: { audio: { $speech: { text: 'Good morning', language: 'English', mode: 'preset', speaker: 'Ryan', instruct: '' } } },
    });
    expect(graph.prompt.save!.inputs.audio).toEqual(['say', 0]);
    expect(graph.outputs).toEqual(['save']);
  });

  it('takes the text from a String node, and refuses a text that comes from a node ComfyUI runs', () => {
    const nodes = [node('string', 'words', { value: 'From a node' }), ...reading({}).nodes];
    const edges = [makeEdge('words', 'value', 'say', 'text'), makeEdge('say', 'audio', 'save', 'audio')];
    expect(compileComfyPrompt({ nodes, edges }).graph.prompt.say!.inputs.audio).toMatchObject({ $speech: { text: 'From a node' } });
    // What ComfyUI makes at run time is not known when the speech is ordered.
    const blank = node('comfy:EmptyImage', 'blank');
    expect(() => compileComfyPrompt({ nodes: [blank, ...reading({}).nodes], edges: [makeEdge('blank', 'IMAGE', 'say', 'text'), makeEdge('say', 'audio', 'save', 'audio')] })).toThrow(ComfyGraphError);
  });

  it('needs the text, and the description of a voice described in words', () => {
    const reason = (say: Record<string, unknown>) => {
      try {
        compileComfyPrompt(reading(say));
        return null;
      } catch (e) {
        return e instanceof ComfyGraphError ? `${e.reason}:${e.field}` : String(e);
      }
    };
    expect(reason({ text: '   ' })).toBe('missingInput:text');
    expect(reason({ text: 'Hi', mode: 'design', instruct: '' })).toBe('missingInput:instruct');
    expect(reason({ text: 'Hi', mode: 'design', instruct: 'a calm old man' })).toBeNull();
    expect(reason({ text: 'Hi', mode: 'preset' })).toBeNull();
  });

  it('sends the description of a preset voice as its style and drops a mode it does not know', () => {
    const say = (inputs: Record<string, unknown>) => compileComfyPrompt(reading(inputs)).graph.prompt.say!.inputs.audio as { $speech: Record<string, string> };
    expect(say({ text: 'Hi', instruct: 'whisper' }).$speech).toMatchObject({ mode: 'preset', instruct: 'whisper' });
    expect(say({ text: 'Hi', mode: 'shout' }).$speech.mode).toBe('preset');
  });
});

describe('the ready-made voice graphs', () => {
  it('read a text aloud and save it as an MP3', () => {
    const g = graphOf('voiceRead');
    const { graph } = compileComfyPrompt(g);
    const save = g.nodes.find((n) => n.data.type === 'comfy:SaveAudioAdvanced')!.id;
    expect(graph.outputs).toEqual([save]);
    expect(graph.prompt[save]!.inputs).toMatchObject({ format: 'mp3', 'format.quality': '128k' });
  });

  it('put the speech on a video of the gallery and save the result as a video with a first frame', () => {
    const g = graphOf('videoNarration');
    expect(readinessReasons(g).join()).toMatch(/選べるファイルがありません|ComfyUI の一覧にありません|file/i);
    g.nodes.find((n) => n.data.type === 'comfy:LoadVideo')!.data.inputs.file = 'clip.mp4';
    const { graph } = compileComfyPrompt(g);
    const classes = Object.values(graph.prompt).map((n) => n.class_type);
    expect(classes).toEqual(expect.arrayContaining(['LoadVideo', 'GetVideoComponents', 'LoadAudio', 'CreateVideo', 'SaveVideo']));
    expect(graph.thumbnail).toBeDefined();
    const create = Object.values(graph.prompt).find((n) => n.class_type === 'CreateVideo')!;
    expect(create.inputs.audio).toEqual([g.nodes.find((n) => n.data.type === 'voice_speak')!.id, 0]);
  });
});

describe('running a graph that reads aloud', () => {
  it('waits for the voice engine to be installed', () => {
    const g = graphOf('voiceRead');
    const ready = usePacks.getState().packs.voice;
    try {
      usePacks.setState({ packs: { ...usePacks.getState().packs, voice: { state: 'missing', totalBytes: 1 } } });
      expect(readinessReasons(g).join()).toMatch(/音声のエンジンとモデルがまだインストールされていません/);
      usePacks.setState({ packs: { ...usePacks.getState().packs, voice: ready } });
      expect(readinessReasons(g)).toEqual([]);
    } finally {
      usePacks.setState({ packs: { ...usePacks.getState().packs, voice: ready } });
    }
  });

  it('tells the gallery the text that was read and the voice engine, and needs no sampler', () => {
    const req = buildRequest(graphOf('voiceRead'), {}, { prepend: false });
    expect(req.params).toMatchObject({ generationMode: 'graph', positivePrompt: expect.stringContaining('Hello!'), modelName: 'Qwen3-TTS' });
    expect(req.randomizeSeed).toBe(false);
  });
});
