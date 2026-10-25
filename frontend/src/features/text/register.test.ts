import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEditor } from '@/state/agent';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, newTextLayer } from '@/state/text/textModel';

let editor: AgentEditor | undefined;
vi.mock('@/state/agent', () => ({
  registerAgentEditor: (screen: string, e: AgentEditor) => {
    if (screen === 'text') editor = e;
  },
}));

const { registerTextFeature } = await import('./register');

beforeEach(() => {
  useTextEditor.setState({ scene: EMPTY_SCENE, selectedId: null, past: [], future: [] });
  registerTextFeature();
});

describe('text editor for the assistant', () => {
  it('reports the scene and selection', () => {
    const layer = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' };
    useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [layer] }, selectedId: 'a' });
    expect(editor!.context()).toMatchObject({ selectedLayerId: 'a', scene: { layers: [{ id: 'a' }] } });
  });

  it('applies operations as one undo step and selects the new layer', () => {
    const changed = editor!.apply([
      { op: 'add', layer: { type: 'text', text: 'one' } },
      { op: 'add', layer: { type: 'text', text: 'two' } },
    ]);
    expect(changed).toBe(true);
    const s = useTextEditor.getState();
    expect(s.scene.layers.map((l) => l.text)).toEqual(['one', 'two']);
    expect(s.selectedId).toBe(s.scene.layers[1]!.id);
    expect(s.past).toHaveLength(1);
  });

  it('reports no change and leaves the history alone when nothing applied', () => {
    expect(editor!.apply([{ op: 'remove', id: 'missing' }])).toBe(false);
    expect(useTextEditor.getState().past).toHaveLength(0);
  });

  it('snapshots the scene and restores it without a selection', () => {
    editor!.apply([{ op: 'add', layer: { type: 'text', text: 'one' } }]);
    const snap = editor!.snapshot();
    editor!.apply([{ op: 'clear' }]);
    expect(useTextEditor.getState().scene.layers).toHaveLength(0);
    editor!.restore(snap);
    expect(useTextEditor.getState().scene.layers).toHaveLength(1);
    expect(useTextEditor.getState().selectedId).toBeNull();
  });
});
