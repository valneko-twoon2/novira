// Fuzz tests for the AI assistant's edits of the text scene: whatever the assistant sends, applying it never throws,
// leaves a scene that is valid, within limits and survives a JSON save / load unchanged, and does not change the
// scene it was given. The answers are generated in-process; nothing leaves the process.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkJson, junkText, blockExternalNetwork } from '@/propertyTest.testkit';
import { DEFAULT_TEXT_STYLE, SCENE_LIMITS, newBubbleLayer, newTextLayer, type Scene } from '@/state/text/textModel';
import { applyTextOps, sanitizeStyle, textContext } from './aiOps';
import { FONTS } from '@/state/fonts';

blockExternalNetwork();

const scene: Scene = { width: 800, height: 600, background: { kind: 'color', color: null }, layers: [] };
const withLayers: Scene = { ...scene, layers: [{ ...newTextLayer(scene, 'one'), id: 'a' }, { ...newBubbleLayer(scene, 'round', 'two'), id: 'b' }] };

const byte = fc.integer({ min: 0, max: 255 });
// Colour texts the editor accepts, plus text it must refuse. A broken alpha like "1.2.3" is covered by the regression test below.
const colorText = fc.oneof(
  fc.tuple(byte, byte, byte).map(([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`),
  fc.constantFrom('#fff', 'rgb(1, 2, 3)', 'rgba(10, 20, 30, 0.5)', 'rgba(300, 0, 0, 7)'),
  junkText.filter((s) => !/\d\.\d*\./.test(s)),
);
const number = fc.oneof(fc.double({ noNaN: false }), fc.integer(), fc.string({ maxLength: 6 }), fc.constant(null));
const value = fc.oneof(number, junkText, colorText, junkJson, fc.boolean());
const rec = (keys: string[]) => fc.dictionary(fc.constantFrom(...keys), value, { maxKeys: keys.length });
const style = fc.record(
  { fontFamily: fc.oneof(fc.constantFrom(...FONTS.map((f) => f.family)), junkText), fontSize: number, fontWeight: number, letterSpacing: number, lineHeight: number, align: value, vertical: value, fill: value, stroke: value, outline: value, shadow: value },
  { requiredKeys: [] },
);
const layerFields = fc
  .tuple(rec(['type', 'text', 'x', 'y', 'rotation', 'opacity', 'visible', 'locked', 'bend', 'shape', 'width', 'height', 'fill', 'border', 'tail', 'autoFit', 'seed', 'id']), style)
  .map(([a, s]) => ({ ...a, style: s }));
const op = fc.oneof(
  fc.record({ op: fc.constant('add'), layer: fc.oneof(layerFields.map((l) => ({ ...l, type: 'text' })), layerFields.map((l) => ({ ...l, type: 'bubble' })), layerFields) }),
  fc.record({ op: fc.constant('update'), id: fc.oneof(fc.constantFrom('a', 'b'), junkText), set: layerFields }),
  fc.record({ op: fc.constant('remove'), id: fc.oneof(fc.constantFrom('a', 'b'), junkText) }),
  fc.record({ op: fc.constant('preset'), id: fc.constantFrom('a', 'b'), preset: fc.oneof(fc.constantFrom('plain', 'pop', 'sfx', 'gold', 'sticker', 'soft'), junkText) }),
  fc.record({ op: fc.constant('reorder'), id: fc.constantFrom('a', 'b'), order: fc.constantFrom('up', 'down', 'top', 'bottom', 'x') }),
  fc.record({ op: fc.constant('background'), color: colorText, width: number, height: number }, { requiredKeys: [] }),
  fc.constant({ op: 'clear' }),
  junkJson,
  fc.record({ op: junkText }),
);

const finiteDeep = (v: unknown): boolean => (typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(finiteDeep) : v && typeof v === 'object' ? Object.values(v).every(finiteDeep) : true);

describe('applyTextOps (fuzz)', () => {
  it('never throws, keeps the scene valid and JSON-safe, and does not touch the input', () => {
    check(
      fc.property(fc.array(op, { maxLength: 12 }), fc.constantFrom(scene, withLayers), (ops, start) => {
        const before = JSON.stringify(start);
        const r = applyTextOps(start, ops, start.layers[0]?.id ?? null);
        expect(JSON.stringify(start)).toBe(before);
        expect(r.applied).toBeLessThanOrEqual(ops.length);
        const s = r.scene;
        expect(s.width).toBeGreaterThanOrEqual(SCENE_LIMITS.size.min);
        expect(s.width).toBeLessThanOrEqual(SCENE_LIMITS.size.max);
        expect(s.height).toBeGreaterThanOrEqual(SCENE_LIMITS.size.min);
        expect(s.height).toBeLessThanOrEqual(SCENE_LIMITS.size.max);
        const ids = s.layers.map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeLessThanOrEqual(60);
        if (r.selectedId !== null) expect(ids).toContain(r.selectedId);
        expect(finiteDeep(s)).toBe(true);
        for (const l of s.layers) {
          expect(l.style.fontSize).toBeGreaterThanOrEqual(4);
          expect(l.style.fontSize).toBeLessThanOrEqual(1200);
          expect(l.style.lineHeight).toBeGreaterThanOrEqual(0.5);
          expect(l.style.lineHeight).toBeLessThanOrEqual(3);
          expect(l.opacity).toBeGreaterThanOrEqual(0);
          expect(l.opacity).toBeLessThanOrEqual(1);
          expect(l.text.length).toBeLessThanOrEqual(600);
          expect(FONTS.some((f) => f.family === l.style.fontFamily)).toBe(true);
        }
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }),
    );
  });

  it('sanitizeStyle of any value is a complete style with finite numbers', () => {
    check(
      fc.property(fc.oneof(style, junkJson), (raw) => {
        const out = sanitizeStyle(raw, DEFAULT_TEXT_STYLE);
        expect(Object.keys(out).sort()).toEqual(Object.keys(DEFAULT_TEXT_STYLE).sort());
        expect(finiteDeep(out)).toBe(true);
      }),
    );
  });

  it('textContext is JSON-safe for any scene', () => {
    check(fc.property(fc.constantFrom(scene, withLayers), (s) => JSON.parse(JSON.stringify(textContext(s, null))) !== null));
  });

  // Regression: a colour with a broken alpha is refused like any other bad colour (it used to become a NaN alpha that JSON turns into null).
  it('keeps a colour with a broken alpha out of the scene', () => {
    const r = applyTextOps(scene, [{ op: 'add', layer: { type: 'text', text: 'x', style: { shadow: { color: 'rgba(0,0,0,1.2.3)' } } } }]);
    expect(JSON.stringify(r.scene)).not.toContain('NaN');
    expect(finiteDeep(r.scene)).toBe(true);
    expect(JSON.parse(JSON.stringify(r.scene))).toEqual(r.scene);
  });
});
