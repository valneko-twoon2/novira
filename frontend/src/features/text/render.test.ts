// @vitest-environment jsdom
// Drawing a text scene onto a recorded 2D context: which layers are painted, in what order, and with which decoration.
import { afterEach, describe, expect, it } from 'vitest';
import { recordingContext, installRecordingCanvas } from '@/backend/mock/canvas2dRecorder.testkit';
import { DEFAULT_TEXT_STYLE, newBubbleLayer, newTextLayer, type Scene, type TextStyle } from '@/state/text/textModel';
import { layerHalfSize, renderScene } from './render';

const scene = (layers: Scene['layers'], background: Scene['background'] = { kind: 'color', color: '#336699' }): Scene => ({
  width: 400,
  height: 300,
  background,
  layers,
});
const text = (value: string, style: Partial<TextStyle> = {}, patch: object = {}) => {
  const layer = newTextLayer({ width: 400, height: 300 }, value);
  return { ...layer, ...patch, style: { ...layer.style, fontSize: 20, ...style } };
};

let restore: (() => void) | null = null;
afterEach(() => restore?.());

describe('renderScene', () => {
  it('clears, paints a colour background and then the visible layers only', () => {
    const rec = recordingContext();
    const hidden = { ...text('hidden'), visible: false };
    renderScene(rec.ctx, scene([text('shown'), hidden]), null);
    expect(rec.of('clearRect')).toHaveLength(1);
    expect(rec.of('fillRect')[0]).toEqual([0, 0, 400, 300]);
    const drawn = rec.of('fillText').map((a) => a[0]);
    expect(drawn.join('')).toContain('shown');
    expect(drawn.join('')).not.toContain('hidden');
  });

  it('draws the base picture for an image background and nothing for a transparent colour', () => {
    const base = {} as CanvasImageSource;
    const withImage = recordingContext();
    renderScene(withImage.ctx, scene([], { kind: 'image', imageName: 'a.png' }), base, 2);
    expect(withImage.of('drawImage')[0]).toEqual([base, 0, 0, 400, 300]);
    expect(withImage.of('setTransform').some((a) => a[0] === 2 && a[3] === 2)).toBe(true);

    const transparent = recordingContext();
    renderScene(transparent.ctx, scene([], { kind: 'color', color: null }), null);
    expect(transparent.of('fillRect')).toHaveLength(0);
    expect(transparent.of('drawImage')).toHaveLength(0);
  });

  it('runs the underlay before anything else', () => {
    const rec = recordingContext();
    renderScene(rec.ctx, scene([]), null, 1, (c) => c.fillRect(1, 2, 3, 4));
    expect(rec.of('fillRect')[0]).toEqual([1, 2, 3, 4]);
  });

  it('skips a layer whose text is empty', () => {
    const rec = recordingContext();
    renderScene(rec.ctx, scene([text('')]), null);
    expect(rec.of('fillText')).toHaveLength(0);
  });

  it('paints the outline, the stroke and the fill, with the shadow on the outermost shape only', () => {
    const rec = recordingContext();
    const style = {
      outline: { color: '#ff0000', width: 4 },
      stroke: { color: '#00ff00', width: 2 },
      shadow: { color: '#000000', blur: 3, offsetX: 1, offsetY: 2 },
    };
    renderScene(rec.ctx, scene([text('Hi', style)]), null);
    expect(rec.of('strokeText').length).toBeGreaterThan(0);
    expect(rec.of('fillText').length).toBeGreaterThan(0);
    const shadowOn = rec.sets.filter((s) => s.name === 'shadowBlur' && s.value === 3);
    expect(shadowOn).toHaveLength(1);
    const widths = rec.sets.filter((s) => s.name === 'lineWidth').map((s) => s.value);
    expect(widths).toEqual([2 * (4 + 2), 2 * 2]);
  });

  it('uses a gradient fill when asked', () => {
    const rec = recordingContext();
    renderScene(rec.ctx, scene([text('Hi', { fill: { kind: 'gradient', top: '#fff', bottom: '#000' } })]), null);
    expect(rec.of('createLinearGradient')).toHaveLength(1);
  });

  it('sets text on an arc when bent, and keeps empty lines straight', () => {
    const rec = recordingContext();
    renderScene(rec.ctx, scene([text('abc\n\nde', {}, { bend: 60 })]), null);
    // One put per character of the non-empty lines, each rotated to follow the arc.
    expect(rec.of('rotate').filter((a) => a[0] !== 0).length).toBeGreaterThan(0);
    expect(rec.of('fillText').length).toBeGreaterThanOrEqual(5);
  });

  it.each(['left', 'center', 'right'] as const)('aligns horizontal text %s', (align) => {
    const rec = recordingContext();
    renderScene(rec.ctx, scene([text('ab\ncdef', { align })]), null);
    expect(rec.sets.some((s) => s.name === 'textAlign' && s.value === align)).toBe(true);
  });

  it.each(['left', 'center', 'right'] as const)('lays vertical text out in columns, aligned %s', (align) => {
    const rec = recordingContext();
    renderScene(rec.ctx, scene([text('あい、「う」\nabc', { vertical: true, align })]), null);
    expect(rec.of('fillText').length).toBeGreaterThan(5);
    expect(rec.of('translate').length).toBeGreaterThan(5);
  });

  it('draws partly transparent layers on their own sheet and composites it with the opacity', () => {
    const sheet = recordingContext();
    restore = installRecordingCanvas(sheet);
    const main = recordingContext({ scale: 2 });
    renderScene(main.ctx, scene([text('ghost', {}, { opacity: 0.5 })]), null, 2);
    expect(sheet.of('scale')[0]).toEqual([2, 2]);
    expect(sheet.of('fillText').length).toBeGreaterThan(0);
    expect(main.of('fillText')).toHaveLength(0);
    expect(main.of('drawImage')).toHaveLength(1);
    expect(main.sets.some((s) => s.name === 'globalAlpha' && s.value === 0.5)).toBe(true);
  });

  it('skips a transparent layer when no sheet context is available', () => {
    restore = (() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = (() => null) as never;
      return () => {
        HTMLCanvasElement.prototype.getContext = original;
      };
    })();
    const main = recordingContext();
    renderScene(main.ctx, scene([text('ghost', {}, { opacity: 0.5 })]), null);
    expect(main.of('drawImage')).toHaveLength(0);
  });

  it.each(['round', 'box', 'cloud', 'burst', 'whisper', 'narration'] as const)('draws a %s bubble with its text', (shape) => {
    const rec = recordingContext();
    const made = newBubbleLayer({ width: 400, height: 300 }, shape, 'Hello');
    const bubble = { ...made, x: 200, y: 150, tail: { ...made.tail, enabled: true } };
    renderScene(rec.ctx, scene([bubble]), null);
    expect(rec.of('stroke').length).toBeGreaterThan(0);
    expect(rec.of('fill').length).toBeGreaterThan(0);
    expect(rec.of('fillText').length).toBeGreaterThan(0);
    if (shape === 'whisper') expect(rec.of('setLineDash')[0]).toHaveLength(1);
    if (shape === 'cloud') expect(rec.of('arc').length).toBeGreaterThan(0);
  });

  it('draws a bubble without text as a shape only, and keeps the font size when auto-fit is off', () => {
    const rec = recordingContext();
    const empty = { ...newBubbleLayer({ width: 400, height: 300 }, 'round', '  ') };
    renderScene(rec.ctx, scene([empty]), null);
    expect(rec.of('fillText')).toHaveLength(0);

    const fixed = recordingContext();
    const big = { ...newBubbleLayer({ width: 400, height: 300 }, 'narration', 'Hello there'), autoFit: false };
    renderScene(fixed.ctx, scene([big]), null);
    expect(fixed.sets.some((s) => s.name === 'font' && String(s.value).includes(`${big.style.fontSize}px`))).toBe(true);
  });
});

describe('layerHalfSize', () => {
  it('is half the bubble size for a bubble', () => {
    const rec = recordingContext();
    const bubble = newBubbleLayer({ width: 400, height: 300 }, 'round', 'x');
    expect(layerHalfSize(rec.ctx, bubble)).toEqual({ hw: bubble.width / 2, hh: bubble.height / 2 });
  });

  it('is the text block plus the outline padding for a text layer', () => {
    const rec = recordingContext({ charWidth: 10 });
    const plain = { ...text('abcd', { stroke: null, outline: null }) };
    const { hw, hh } = layerHalfSize(rec.ctx, plain);
    expect(hw).toBeCloseTo((4 * 10) / 2 + 2);
    expect(hh).toBeGreaterThan(10);
    const outlined = layerHalfSize(rec.ctx, text('abcd', { stroke: { color: '#000', width: 3 }, outline: { color: '#fff', width: 5 } }));
    expect(outlined.hw).toBeCloseTo(hw + 8);
    expect(DEFAULT_TEXT_STYLE.fontSize).toBe(96);
  });
});
