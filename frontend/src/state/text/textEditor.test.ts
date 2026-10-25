import { beforeEach, describe, expect, it } from 'vitest';
import { useTextEditor } from './textEditor';
import { EMPTY_SCENE } from './textModel';

const store = () => useTextEditor.getState();

beforeEach(() => {
  useTextEditor.setState({ scene: EMPTY_SCENE, selectedId: null, past: [], future: [] });
});

describe('text editor store', () => {
  it('adds layers on top and selects the new one', () => {
    const a = store().addText('A');
    const b = store().addBubble('round', 'B');
    expect(store().scene.layers.map((l) => l.id)).toEqual([a, b]);
    expect(store().selectedId).toBe(b);
    expect(store().scene.layers[1]!.type).toBe('bubble');
  });

  it('undoes and redoes edits', () => {
    const id = store().addText('A');
    store().update(id, { text: 'B' });
    store().undo();
    expect(store().scene.layers[0]!.type === 'text' && store().scene.layers[0]!.text).toBe('A');
    store().undo();
    expect(store().scene.layers).toHaveLength(0);
    store().redo();
    expect(store().scene.layers).toHaveLength(1);
  });

  it('merges quick edits of one control into one undo step', () => {
    const id = store().addText('A');
    store().update(id, { x: 10 }, { key: 'x' });
    store().update(id, { x: 20 }, { key: 'x' });
    store().update(id, { x: 30 }, { key: 'x' });
    store().undo();
    // Back to just after the layer was added.
    expect(store().scene.layers[0]!.x).toBe(store().scene.width / 2);
  });

  it('records one step for a drag made of live moves', () => {
    const id = store().addText('A');
    store().checkpoint();
    for (const x of [1, 2, 3]) store().update(id, { x }, { live: true });
    expect(store().scene.layers[0]!.x).toBe(3);
    store().undo();
    expect(store().scene.layers[0]!.x).toBe(store().scene.width / 2);
  });

  it('clears the redo history on a new edit', () => {
    const id = store().addText('A');
    store().undo();
    expect(store().future).toHaveLength(1);
    store().addText('B');
    expect(store().future).toHaveLength(0);
    expect(id).not.toBe(store().selectedId);
  });

  it('reorders, duplicates and removes layers', () => {
    const a = store().addText('A');
    const b = store().addText('B');
    store().reorder(a, 'top');
    expect(store().scene.layers.map((l) => l.id)).toEqual([b, a]);
    store().reorder(a, 'up');
    expect(store().scene.layers.map((l) => l.id)).toEqual([b, a]);
    store().duplicate(b);
    expect(store().scene.layers).toHaveLength(3);
    expect(store().scene.layers[1]!.id).not.toBe(b);
    store().remove(a);
    expect(store().scene.layers.some((l) => l.id === a)).toBe(false);
  });

  it('keeps the canvas size within the limits', () => {
    store().resize(10, 99999);
    expect(store().scene.width).toBe(64);
    expect(store().scene.height).toBe(4096);
  });

  it('copies a layer deeply so edits to the copy leave the original alone', () => {
    const id = store().addText('A');
    store().duplicate(id);
    const [orig, copy] = store().scene.layers;
    store().updateStyle(copy!.id, { fontSize: 5 });
    expect(store().scene.layers[0]!.style.fontSize).toBe(orig!.style.fontSize);
  });
});
