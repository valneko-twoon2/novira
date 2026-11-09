// @vitest-environment jsdom
// The layer-side actions of "finish with AI": picking a candidate, going back to the plain fill and stopping a run.
import { beforeEach, describe, expect, it } from 'vitest';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, richSourceKey, type TextLayer } from '@/state/text/textModel';
import { clearRich, pickRichCandidate, runRich, useRichRun } from './richRun';

function setup(withRich = true): TextLayer {
  useTextEditor.setState({ scene: EMPTY_SCENE, selectedId: null, past: [], future: [] });
  const id = useTextEditor.getState().addText('NOVIRA');
  const layer = useTextEditor.getState().scene.layers.find((l) => l.id === id) as TextLayer;
  if (withRich) {
    useTextEditor.getState().update(id, { rich: { imageName: 'a.png', candidates: ['a.png', 'b.png'], width: 300, height: 100, fontSize: layer.style.fontSize, sourceKey: richSourceKey(layer) } }, { live: true });
  }
  return useTextEditor.getState().scene.layers.find((l) => l.id === id) as TextLayer;
}

const current = (id: string) => useTextEditor.getState().scene.layers.find((l) => l.id === id) as TextLayer;

beforeEach(() => useRichRun.setState({ running: {} }));

describe('pickRichCandidate', () => {
  it('makes another candidate the fill as one undo step', () => {
    const { id } = setup();
    useTextEditor.getState().checkpoint();
    pickRichCandidate(id, 'b.png');
    expect(current(id).rich?.imageName).toBe('b.png');
    useTextEditor.getState().undo();
    expect(current(id).rich?.imageName).toBe('a.png');
  });

  it('ignores the one already in use, a name that is not a candidate and a layer with no AI fill', () => {
    const { id } = setup();
    const before = useTextEditor.getState().past.length;
    pickRichCandidate(id, 'a.png');
    pickRichCandidate(id, 'other.png');
    pickRichCandidate('missing', 'b.png');
    expect(current(id).rich?.imageName).toBe('a.png');
    expect(useTextEditor.getState().past.length).toBe(before);
    const plain = setup(false);
    pickRichCandidate(plain.id, 'b.png');
    expect(current(plain.id).rich).toBeUndefined();
  });
});

describe('clearRich', () => {
  it('goes back to the plain fill, and undo brings the AI fill back', () => {
    const { id } = setup();
    clearRich(id);
    expect(current(id).rich).toBeUndefined();
    useTextEditor.getState().undo();
    expect(current(id).rich?.imageName).toBe('a.png');
  });

  it('does nothing for a layer with no AI fill or a layer that is gone', () => {
    const plain = setup(false);
    const before = useTextEditor.getState().past.length;
    clearRich(plain.id);
    clearRich('missing');
    expect(useTextEditor.getState().past.length).toBe(before);
  });
});

describe('runRich', () => {
  it('does nothing for an empty text, a missing layer or when no model can draw', async () => {
    const { id } = setup(false);
    useTextEditor.getState().update(id, { text: '   ' });
    await runRich(id);
    await runRich('missing');
    expect(useRichRun.getState().running).toEqual({});
    useTextEditor.getState().update(id, { text: 'NOVIRA' });
    await runRich(id);
    expect(current(id).rich).toBeUndefined();
    expect(useRichRun.getState().running).toEqual({});
  });
});
