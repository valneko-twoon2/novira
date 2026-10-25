import { describe, expect, it } from 'vitest';
import { EMPTY_SCENE, newBubbleLayer, newTextLayer, type Scene, type TextLayer } from '@/state/text/textModel';
import { applyTextOps, sanitizeStyle, textContext } from './aiOps';

function sceneWith(...layers: Scene['layers']): Scene {
  return { ...EMPTY_SCENE, layers };
}

describe('text operations from the assistant', () => {
  it('adds a text layer with checked fields and defaults for the rest', () => {
    const r = applyTextOps(EMPTY_SCENE, [
      { op: 'add', layer: { type: 'text', text: 'HELLO', x: 300, y: 200, style: { fontFamily: 'dela gothic one', fontSize: 120, fill: { kind: 'solid', color: '#ff0000' } } } },
    ]);
    expect(r.applied).toBe(1);
    const layer = r.scene.layers[0] as TextLayer;
    expect(layer).toMatchObject({ type: 'text', text: 'HELLO', x: 300, y: 200 });
    expect(layer.style).toMatchObject({ fontFamily: 'Dela Gothic One', fontSize: 120, fill: { kind: 'solid', color: '#ff0000' } });
    expect(r.selectedId).toBe(layer.id);
    // The original scene is untouched.
    expect(EMPTY_SCENE.layers).toHaveLength(0);
  });

  it('updates only what is named and keeps the rest', () => {
    const layer = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' };
    const r = applyTextOps(sceneWith(layer), [{ op: 'update', id: 'a', set: { rotation: 15, style: { fontSize: 200 } } }]);
    const out = r.scene.layers[0] as TextLayer;
    expect(out.rotation).toBe(15);
    expect(out.style.fontSize).toBe(200);
    expect(out.style.fontFamily).toBe(layer.style.fontFamily);
    expect(out.text).toBe('A');
  });

  it('drops bad values instead of breaking the scene', () => {
    const layer = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' };
    const r = applyTextOps(sceneWith(layer), [
      {
        op: 'update',
        id: 'a',
        set: { x: 'abc', opacity: 9, rotation: 99999, style: { fontFamily: 'Comic Sans', fontSize: -5, fill: { kind: 'solid', color: 'url(javascript:alert(1))' }, align: 'diagonal' } },
      },
    ]);
    const out = r.scene.layers[0] as TextLayer;
    expect(out.x).toBe(layer.x);
    expect(out.opacity).toBe(1);
    expect(out.rotation).toBe(360);
    expect(out.style.fontFamily).toBe(layer.style.fontFamily);
    expect(out.style.fontSize).toBe(4);
    expect(out.style.fill).toEqual(layer.style.fill);
    expect(out.style.align).toBe(layer.style.align);
  });

  it('turns outlines and the shadow on and off, and rejects a zero-width outline', () => {
    const base = newTextLayer(EMPTY_SCENE, 'A').style;
    const withShadow = sanitizeStyle({ shadow: { color: 'rgba(0,0,0,0.5)', blur: 8, offsetX: 4, offsetY: 6 }, stroke: { color: '#000000', width: 0 } }, base);
    expect(withShadow.shadow).toMatchObject({ blur: 8, offsetX: 4, offsetY: 6 });
    expect(withShadow.stroke).toBeNull();
    expect(sanitizeStyle({ shadow: null }, withShadow).shadow).toBeNull();
  });

  it('snaps the weight to one the font has', () => {
    const base = newTextLayer(EMPTY_SCENE, 'A').style;
    expect(sanitizeStyle({ fontFamily: 'Dela Gothic One', fontWeight: 900 }, base).fontWeight).toBe(400);
  });

  it('edits a bubble: shape, size, pointer', () => {
    const bubble = { ...newBubbleLayer(EMPTY_SCENE, 'round', 'hi'), id: 'b' };
    const r = applyTextOps(sceneWith(bubble), [{ op: 'update', id: 'b', set: { shape: 'burst', width: 99999, tail: { enabled: true, x: 10, y: 400, curve: 5 } } }]);
    const out = r.scene.layers[0]!;
    expect(out.type === 'bubble' && out.shape).toBe('burst');
    expect(out.type === 'bubble' && out.width).toBe(4000);
    expect(out.type === 'bubble' && out.tail).toMatchObject({ enabled: true, x: 10, y: 400, curve: 1 });
  });

  it('lets later operations refer to a layer added earlier by the id the assistant gave it', () => {
    const r = applyTextOps(EMPTY_SCENE, [
      { op: 'add', layer: { id: 'logo', type: 'text', text: 'X' } },
      { op: 'preset', id: 'logo', preset: 'pop' },
      { op: 'update', id: 'logo', set: { y: 123 } },
    ]);
    const out = r.scene.layers[0] as TextLayer;
    expect(r.applied).toBe(3);
    expect(out.style.fontFamily).toBe('Dela Gothic One');
    expect(out.y).toBe(123);
  });

  it('skips operations on layers that do not exist and unknown operations', () => {
    const r = applyTextOps(EMPTY_SCENE, [{ op: 'update', id: 'nope', set: { x: 1 } }, { op: 'remove', id: 'nope' }, { op: 'explode' }, 'text', null, { op: 'add', layer: { type: 'image' } }]);
    expect(r.applied).toBe(0);
  });

  it('removes, reorders, clears and sets the background', () => {
    const a = { ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' };
    const b = { ...newTextLayer(EMPTY_SCENE, 'B'), id: 'b' };
    const r = applyTextOps(sceneWith(a, b), [{ op: 'reorder', id: 'a', order: 'top' }, { op: 'background', color: '#112233', width: 800, height: 600 }, { op: 'remove', id: 'b' }]);
    expect(r.scene.layers.map((l) => l.id)).toEqual(['a']);
    expect(r.scene.background).toEqual({ kind: 'color', color: '#112233' });
    expect([r.scene.width, r.scene.height]).toEqual([800, 600]);
    expect(applyTextOps(r.scene, [{ op: 'background', color: null }]).scene.background).toEqual({ kind: 'color', color: null });
    expect(applyTextOps(r.scene, [{ op: 'clear' }]).scene.layers).toHaveLength(0);
  });

  it('stops adding layers at a limit', () => {
    const ops = Array.from({ length: 80 }, () => ({ op: 'add', layer: { type: 'text', text: 'x' } }));
    expect(applyTextOps(EMPTY_SCENE, ops).scene.layers).toHaveLength(60);
  });

  it('tells the assistant the scene and what it may choose from', () => {
    const ctx = textContext(sceneWith({ ...newTextLayer(EMPTY_SCENE, 'A'), id: 'a' }), 'a') as { selectedLayerId: string; fonts: string[]; presets: string[] };
    expect(ctx.selectedLayerId).toBe('a');
    expect(ctx.fonts).toContain('Dela Gothic One');
    expect(ctx.presets).toContain('pop');
  });
});
