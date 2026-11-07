// @vitest-environment jsdom
// Drawing a text layer with an AI fill onto a recorded 2D context, and the letters-alone helpers its run uses.
import { describe, expect, it } from 'vitest';
import { recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { newTextLayer, richSourceKey, type Scene, type TextLayer, type TextStyle } from '@/state/text/textModel';
import { drawWhiteGlyphs, layerHalfSize, letterHalfSize, renderScene } from './render';

const scene = (layers: Scene['layers']): Scene => ({ width: 400, height: 300, background: { kind: 'color', color: '#336699' }, layers });
const text = (value: string, style: Partial<TextStyle> = {}): TextLayer => {
  const layer = newTextLayer({ width: 400, height: 300 }, value);
  return { ...layer, style: { ...layer.style, fontSize: 20, ...style } };
};
const picture = {} as CanvasImageSource;
const pictures = new Map([['rich.png', picture]]);

/** A layer with an AI fill made at font size 20, for the lettering it has now unless told otherwise. */
function withRich(style: Partial<TextStyle> = {}, rich: object = {}): TextLayer {
  const base = text('NOVIRA', style);
  return { ...base, rich: { imageName: 'rich.png', candidates: ['rich.png'], width: 200, height: 80, fontSize: 20, sourceKey: richSourceKey(base), ...rich } };
}

describe('AI fills', () => {
  it('draws the picture in place of the fill, scaled with the font size, and keeps the outline drawn from the style', () => {
    const rec = recordingContext();
    const layer = withRich({ stroke: { color: '#111111', width: 3 } });
    renderScene(rec.ctx, scene([layer]), null, 1, undefined, pictures);
    expect(rec.of('drawImage')).toEqual([[picture, -100, -40, 200, 80]]);
    expect(rec.of('strokeText').length).toBeGreaterThan(0);
    expect(rec.of('fillText')).toHaveLength(0);

    const bigger = recordingContext();
    renderScene(bigger.ctx, scene([{ ...layer, style: { ...layer.style, fontSize: 40 } }]), null, 1, undefined, pictures);
    expect(bigger.of('drawImage')).toEqual([[picture, -200, -80, 400, 160]]);
  });

  it('falls back to the plain fill when the picture is not loaded or the lettering changed since it was made', () => {
    const notLoaded = recordingContext();
    renderScene(notLoaded.ctx, scene([withRich()]), null, 1, undefined, new Map());
    expect(notLoaded.of('drawImage')).toHaveLength(0);
    expect(notLoaded.of('fillText').length).toBeGreaterThan(0);

    const stale = recordingContext();
    renderScene(stale.ctx, scene([withRich({}, { sourceKey: 'another lettering' })]), null, 1, undefined, pictures);
    expect(stale.of('drawImage')).toHaveLength(0);
    expect(stale.of('fillText').length).toBeGreaterThan(0);

    const none = recordingContext();
    renderScene(none.ctx, scene([withRich()]), null);
    expect(none.of('drawImage')).toHaveLength(0);
  });

  it('draws the picture for a layer with no outline too, so the shadow still has a shape', () => {
    const rec = recordingContext();
    renderScene(rec.ctx, scene([withRich({ stroke: null, outline: null, shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 3 } })]), null, 1, undefined, pictures);
    expect(rec.of('drawImage')).toHaveLength(1);
  });
});

describe('the letters alone', () => {
  it('draws the glyphs in white at the middle of the canvas, with no outline', () => {
    const rec = recordingContext();
    const layer = text('NOVIRA', { stroke: { color: '#111111', width: 3 }, shadow: { color: '#000000', blur: 4, offsetX: 2, offsetY: 3 } });
    drawWhiteGlyphs(rec.ctx, layer, 2);
    expect(rec.of('strokeText')).toHaveLength(0);
    expect(rec.of('fillText').length).toBeGreaterThan(0);
    expect(rec.of('translate')[0]).toEqual([rec.ctx.canvas.width / 2, rec.ctx.canvas.height / 2]);
    expect(rec.of('scale')[0]).toEqual([2, 2]);
  });

  it('measures the letters without the outline padding', () => {
    const rec = recordingContext();
    const layer = text('NOVIRA', { stroke: { color: '#111111', width: 6 } });
    const letters = letterHalfSize(rec.ctx, layer);
    const padded = layerHalfSize(rec.ctx, layer);
    expect(padded.hw).toBeCloseTo(letters.hw + 8, 6);
    expect(padded.hh).toBeCloseTo(letters.hh + 8, 6);
  });
});
