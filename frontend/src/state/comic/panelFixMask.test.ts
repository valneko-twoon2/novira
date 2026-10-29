// @vitest-environment jsdom
// The mask of a part to redraw as a picture: black, with the boxes and the brush strokes in white, drawn at the picture's
// size through the panel's view. A dot is a disc, a line is a stroke, and a mask that cannot be drawn says so.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases, type Recorder } from '@/backend/mock/canvas2dRecorder.testkit';
import { DEFAULT_IMAGE_VIEW } from './document';
import { fixMaskPicture, type FixMask } from './panelFix';

const panel = { width: 200, height: 100 };
const image = { width: 400, height: 300 };
let canvases: ReturnType<typeof installRecordingCanvases>;
let rec: Recorder;

beforeEach(() => {
  canvases = installRecordingCanvases();
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }));
  };
});

afterEach(() => {
  canvases.restore();
  vi.restoreAllMocks();
});

/** Draws the mask and returns the recording of its canvas. */
async function draw(mask: FixMask) {
  const blob = await fixMaskPicture(mask, DEFAULT_IMAGE_VIEW, image, panel);
  rec = canvases.all.at(-1)!;
  return blob;
}

describe('the mask picture', () => {
  it('is the size of the picture, filled black first', async () => {
    const blob = await draw({ boxes: [], strokes: [] });
    expect(blob.type).toBe('image/png');
    expect(rec.ctx.canvas).toMatchObject({ width: 400, height: 300 });
    expect(rec.of('fillRect')[0]).toEqual([0, 0, 400, 300]);
    expect(rec.sets.find((s) => s.name === 'fillStyle' && s.value === '#000000')).toBeDefined();
  });

  it('draws each box in white at its place in the panel', async () => {
    await draw({ boxes: [{ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }], strokes: [] });
    expect(rec.of('fillRect')).toContainEqual([20, 20, 100, 25]);
  });

  it('draws a dot as a disc of the brush width', async () => {
    await draw({ boxes: [], strokes: [{ points: [0.5, 0.5], width: 0.1 }] });
    expect(rec.of('arc')).toEqual([[100, 50, 10, 0, Math.PI * 2]]);
    expect(rec.of('fill')).toHaveLength(1);
    expect(rec.of('stroke')).toHaveLength(0);
  });

  it('draws a line through its points with round ends at the brush width', async () => {
    await draw({ boxes: [], strokes: [{ points: [0, 0, 0.5, 0.5, 1, 0], width: 0.05 }] });
    expect(rec.of('moveTo')).toEqual([[0, 0]]);
    expect(rec.of('lineTo')).toEqual([[100, 50], [200, 0]]);
    expect(rec.of('stroke')).toHaveLength(1);
    expect(rec.sets).toContainEqual({ name: 'lineWidth', value: 10 });
    expect(rec.sets).toContainEqual({ name: 'lineCap', value: 'round' });
  });

  it('leaves out a stroke with no point at all', async () => {
    await draw({ boxes: [], strokes: [{ points: [], width: 0.1 }] });
    expect(rec.of('arc')).toHaveLength(0);
    expect(rec.of('stroke')).toHaveLength(0);
  });
});

describe('a mask that cannot be drawn', () => {
  it('fails when the canvas has no 2D context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(fixMaskPicture({ boxes: [], strokes: [] }, DEFAULT_IMAGE_VIEW, image, panel)).rejects.toThrow('no canvas');
  });

  it('fails when the browser gives no picture', async () => {
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(null);
    };
    await expect(fixMaskPicture({ boxes: [], strokes: [] }, DEFAULT_IMAGE_VIEW, image, panel)).rejects.toThrow('empty image');
  });
});
