import { describe, expect, it } from 'vitest';
import { EMPTY_SCENE, newBubbleLayer, newTextLayer, type BubbleLayer, type Scene, type TextLayer } from '@/state/text/textModel';
import { applyTextOps, sanitizeStyle } from './aiOps';

function sceneWith(...layers: Scene['layers']): Scene {
  return { ...EMPTY_SCENE, layers };
}

const baseStyle = () => newTextLayer(EMPTY_SCENE, 'A').style;

describe('style checks for the assistant: edge cases', () => {
  it('ignores a style that is not an object', () => {
    const base = baseStyle();
    expect(sanitizeStyle('bold', base)).toBe(base);
    expect(sanitizeStyle([1, 2], base)).toBe(base);
    expect(sanitizeStyle(null, base)).toBe(base);
  });

  it('accepts a gradient fill only with both colours valid', () => {
    const base = baseStyle();
    expect(sanitizeStyle({ fill: { kind: 'gradient', top: '#ff0000', bottom: '#0000ff' } }, base).fill).toEqual({ kind: 'gradient', top: '#ff0000', bottom: '#0000ff' });
    expect(sanitizeStyle({ fill: { kind: 'gradient', top: '#ff0000', bottom: 'blue' } }, base).fill).toEqual(base.fill);
    expect(sanitizeStyle({ fill: 'red' }, base).fill).toEqual(base.fill);
  });

  it('clears an outline or a stroke with null and keeps a valid one', () => {
    const base = baseStyle();
    const set = sanitizeStyle({ outline: { color: '#ffffff', width: 6 }, stroke: { color: '#000000', width: 3 } }, base);
    expect(set.outline).toEqual({ color: '#ffffff', width: 6 });
    expect(set.stroke).toEqual({ color: '#000000', width: 3 });
    const cleared = sanitizeStyle({ outline: null, stroke: null }, set);
    expect(cleared.outline).toBeNull();
    expect(cleared.stroke).toBeNull();
  });

  it('keeps the old outline when the new one is malformed', () => {
    const base = { ...baseStyle(), outline: { color: '#ffffff', width: 6 } };
    expect(sanitizeStyle({ outline: 'thick' }, base).outline).toEqual({ color: '#ffffff', width: 6 });
    expect(sanitizeStyle({ outline: { color: 'nope', width: 4 } }, base).outline).toEqual({ color: '#ffffff', width: 6 });
    expect(sanitizeStyle({ outline: { color: '#000000' } }, base).outline).toEqual({ color: '#ffffff', width: 6 });
  });

  it('ignores a shadow without a valid colour and defaults its numbers', () => {
    const base = baseStyle();
    expect(sanitizeStyle({ shadow: 'dark' }, base).shadow).toEqual(base.shadow);
    expect(sanitizeStyle({ shadow: { color: 'nope' } }, base).shadow).toEqual(base.shadow);
    expect(sanitizeStyle({ shadow: { color: '#000000' } }, base).shadow).toMatchObject({ blur: 0, offsetX: 0, offsetY: 0 });
    expect(sanitizeStyle({ shadow: { color: '#000000', offsetX: 99999 } }, base).shadow).toMatchObject({ offsetX: 400 });
  });

  it('matches fonts by label as well as family and takes numbers given as strings', () => {
    const base = baseStyle();
    expect(sanitizeStyle({ fontFamily: 7 }, base).fontFamily).toBe(base.fontFamily);
    expect(sanitizeStyle({ fontSize: '48.4', letterSpacing: '3', lineHeight: 9, vertical: true }, base)).toMatchObject({ fontSize: 48, letterSpacing: 3, lineHeight: 3, vertical: true });
    expect(sanitizeStyle({ fontSize: '  ' }, base).fontSize).toBe(base.fontSize);
  });
});

describe('layer edits from the assistant: edge cases', () => {
  it('bends text and limits its string length, position and visibility flags', () => {
    const layer = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' };
    const r = applyTextOps(sceneWith(layer), [
      { op: 'update', id: 'a', set: { text: 'x'.repeat(900), bend: 500, x: 99999, y: -99999, visible: false, locked: true } },
    ]);
    const out = r.scene.layers[0] as TextLayer;
    expect(out.text).toHaveLength(600);
    expect(out.bend).toBe(100);
    expect([out.x, out.y]).toEqual([12000, -8000]);
    expect([out.visible, out.locked]).toEqual([false, true]);
  });

  it('checks the border, pointer, fit and seed of a bubble', () => {
    const bubble = { ...newBubbleLayer(EMPTY_SCENE, 'round', 'hi'), id: 'b' };
    const r = applyTextOps(sceneWith(bubble), [
      {
        op: 'update',
        id: 'b',
        set: { fill: '#abcdef', height: 1, border: { color: 'nope', width: 500 }, shape: 'not-a-shape', autoFit: false, seed: 2_000_000, tail: { width: 1, enabled: false } },
      },
    ]);
    const out = r.scene.layers[0] as BubbleLayer;
    expect(out.fill).toBe('#abcdef');
    expect(out.height).toBe(40);
    expect(out.border).toEqual({ color: bubble.border.color, width: 80 });
    expect(out.shape).toBe(bubble.shape);
    expect(out.autoFit).toBe(false);
    expect(out.seed).toBe(1_000_000);
    expect(out.tail).toMatchObject({ enabled: false, width: 4 });
  });

  it('leaves a bubble border alone when the border is not an object', () => {
    const bubble = { ...newBubbleLayer(EMPTY_SCENE, 'round', 'hi'), id: 'b' };
    const out = applyTextOps(sceneWith(bubble), [{ op: 'update', id: 'b', set: { border: 'thick', tail: 'long' } }]).scene.layers[0] as BubbleLayer;
    expect(out.border).toEqual(bubble.border);
    expect(out.tail).toEqual(bubble.tail);
  });

  it('adds a bubble with its own fields', () => {
    const r = applyTextOps(EMPTY_SCENE, [{ op: 'add', layer: { type: 'bubble', text: 'Hey', shape: 'burst', width: 300 } }]);
    const out = r.scene.layers[0] as BubbleLayer;
    expect(out).toMatchObject({ type: 'bubble', text: 'Hey', shape: 'burst', width: 300 });
  });

  it('applies a preset to a text layer but not to a bubble or an unknown preset', () => {
    const t = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 't' };
    const b = { ...newBubbleLayer(EMPTY_SCENE, 'round', 'B'), id: 'b' };
    const ok = applyTextOps(sceneWith(t, b), [{ op: 'preset', id: 't', preset: 'gold' }]);
    expect(ok.applied).toBe(1);
    expect(ok.selectedId).toBe('t');
    const none = applyTextOps(sceneWith(t, b), [
      { op: 'preset', id: 'b', preset: 'gold' },
      { op: 'preset', id: 't', preset: 'nope' },
      { op: 'preset', id: 'missing', preset: 'gold' },
    ]);
    expect(none.applied).toBe(0);
  });

  it('moves layers up, down and to the bottom and ignores moves that go nowhere', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((id) => ({ ...newTextLayer(EMPTY_SCENE, id), id }));
    const order = (ops: unknown[]) =>
      applyTextOps(sceneWith(a!, b!, c!), ops)
        .scene.layers.map((l) => l.id)
        .join('');
    expect(order([{ op: 'reorder', id: 'a', order: 'up' }])).toBe('bac');
    expect(order([{ op: 'reorder', id: 'c', order: 'down' }])).toBe('acb');
    expect(order([{ op: 'reorder', id: 'c', order: 'bottom' }])).toBe('cab');
    expect(order([{ op: 'reorder', id: 'c', order: 'top' }])).toBe('abc');
    expect(order([{ op: 'reorder', id: 'c', order: 'up' }])).toBe('abc');
    expect(order([{ op: 'reorder', id: 'a', order: 'down' }])).toBe('abc');
    expect(order([{ op: 'reorder', id: 'a', order: 'sideways' }])).toBe('abc');
    expect(order([{ op: 'reorder', id: 'zzz', order: 'up' }])).toBe('abc');
  });

  it('clears the selection when the selected layer is removed or the scene is cleared', () => {
    const a = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' };
    expect(applyTextOps(sceneWith(a), [{ op: 'remove', id: 'a' }], 'a').selectedId).toBeNull();
    expect(applyTextOps(sceneWith(a), [{ op: 'clear' }], 'a').selectedId).toBeNull();
    expect(applyTextOps(sceneWith(a), [{ op: 'remove', id: 'a' }], 'other').selectedId).toBe('other');
  });

  it('ignores a background that changes nothing or has a malformed colour', () => {
    expect(applyTextOps(EMPTY_SCENE, [{ op: 'background' }]).applied).toBe(0);
    expect(applyTextOps(EMPTY_SCENE, [{ op: 'background', color: 'plaid' }]).applied).toBe(0);
    const sized = applyTextOps(EMPTY_SCENE, [{ op: 'background', width: 1, height: 99999 }]).scene;
    expect(sized.width).toBeGreaterThan(1);
    expect(sized.height).toBeLessThan(99999);
  });

  it('needs a layer object to add and an object to update with', () => {
    const a = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' };
    expect(applyTextOps(EMPTY_SCENE, [{ op: 'add', layer: 'text' }, { op: 'add' }]).applied).toBe(0);
    expect(applyTextOps(sceneWith(a), [{ op: 'update', id: 'a', set: 'x' }, { op: 'update', set: {} }]).applied).toBe(0);
  });
});
