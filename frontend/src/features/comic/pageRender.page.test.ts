// @vitest-environment jsdom
// The rest of the saved page around its balloons: a picture mirrored by its view, a panel of a reshaped page cut to its
// shape, the fonts and stamp pictures made ready before drawing, the picture format (PNG by default, JPEG with a quality),
// and what happens when the browser hands out no canvas or no picture. Drawing goes to recorded canvases, so this checks
// the calls.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as backend from '@/backend';
import { installRecordingCanvases, recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { DEFAULT_IMAGE_VIEW, emptyPage, newBubble, type ComicImageView, type ComicPage } from '@/state/comic/document';
import { DEFAULT_STAMP_ID, stampUrl } from '@/state/comic/stamps';
import { ensureFont } from '@/state/fonts';
import { useSettings } from '@/state/settings';
import { drawPage, drawPagePart, preparePage, renderPage, type PreparedPage } from './pageRender';

vi.mock('@/backend', async (original) => ({
  ...(await original<typeof import('@/backend')>()),
  loadImage: vi.fn(async (url: string) => ({ naturalWidth: 100, naturalHeight: 80, src: url }) as HTMLImageElement),
}));
vi.mock('@/state/fonts', async (original) => ({
  ...(await original<typeof import('@/state/fonts')>()),
  ensureFont: vi.fn(async () => undefined),
}));

const urlOf = (name: string) => `blob:${name}`;
const picture = { naturalWidth: 100, naturalHeight: 80 } as HTMLImageElement;

let canvases: ReturnType<typeof installRecordingCanvases>;
let comicFont: string;
beforeEach(() => {
  canvases = installRecordingCanvases();
  comicFont = useSettings.getState().comicFont;
  vi.mocked(ensureFont).mockClear();
  vi.mocked(backend.loadImage).mockClear();
});
afterEach(() => {
  canvases.restore();
  useSettings.setState({ comicFont });
  vi.restoreAllMocks();
});

/** A one-panel page prepared by hand at 400 by 600 pixels, its panel's picture loaded. */
function preparedPage(page: ComicPage = emptyPage(1)): PreparedPage {
  const rect = { x: 40, y: 60, width: 200, height: 300 };
  return { page, width: 400, height: 600, backdrop: picture, panels: [{ index: 0, panel: page.panels[0]!, shape: null, rect, outline: null, image: picture }], defaultFont: '', rasters: [], stamps: new Map() };
}

describe('a picture mirrored by its view', () => {
  const mirroring = (view: Partial<ComicImageView>, part: 'backdrop' | 'panel') => {
    const page = emptyPage(1);
    page.backdrop = { imageName: 'sky.png', view: { ...DEFAULT_IMAGE_VIEW, ...view } };
    page.panels[0]!.imageView = { ...DEFAULT_IMAGE_VIEW, ...view };
    const rec = recordingContext();
    drawPagePart(rec.ctx, preparedPage(page), part === 'panel' ? { kind: 'panel', index: 0 } : { kind: 'backdrop' });
    return rec.of('scale');
  };

  it('is turned over left to right when flipped across, and upside down when flipped down', () => {
    for (const part of ['backdrop', 'panel'] as const) {
      expect(mirroring({}, part)).toEqual([[1, 1]]);
      expect(mirroring({ flipX: true }, part)).toEqual([[-1, 1]]);
      expect(mirroring({ flipY: true }, part)).toEqual([[1, -1]]);
      expect(mirroring({ flipX: true, flipY: true }, part)).toEqual([[-1, -1]]);
    }
  });
});

describe('a panel of a reshaped page', () => {
  it('is cut to its shape, not to its box, and its frame follows the shape', async () => {
    const page = emptyPage(1);
    const shape = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.2 },
      { x: 0.5, y: 0.9 },
    ];
    page.shapes = [shape];
    const ready = await preparePage(page, urlOf);
    const corners = shape.map((p) => [p.x * ready.width, p.y * ready.height]);
    for (const part of [{ kind: 'panel', index: 0 }, { kind: 'frame', index: 0 }] as const) {
      const rec = recordingContext();
      drawPagePart(rec.ctx, ready, part);
      expect(rec.of('rect')).toEqual([]);
      expect(rec.of('clip')).toHaveLength(1);
      // The clip, and each ring of the frame, trace the shape's corners.
      const path = rec.calls.filter((c) => c.name === 'moveTo' || c.name === 'lineTo').map((c) => c.args);
      expect(path.slice(0, 3)).toEqual(corners);
    }
  });

  it('is cut to its box when the page keeps the automatic layout', async () => {
    const ready = await preparePage(emptyPage(1), urlOf);
    const rec = recordingContext();
    drawPagePart(rec.ctx, ready, { kind: 'panel', index: 0 });
    const { x, y, width, height } = ready.panels[0]!.rect;
    expect(rec.of('rect')).toEqual([[x, y, width, height]]);
  });
});

describe('making a page ready to draw', () => {
  it('loads the regular and the bold weight of each balloon font for its words, the settings font when it has none', async () => {
    useSettings.setState({ comicFont: 'Meiryo' });
    const page = emptyPage(2);
    page.panels[0]!.bubbles = [{ ...newBubble('speech', 0, 0), text: '**Hi** there', font: 'Yu Mincho' }];
    page.panels[1]!.bubbles = [{ ...newBubble('speech', 0, 0), text: 'Yo' }, { ...newBubble('speech', 0, 0), text: '' }];
    await preparePage(page, urlOf);
    expect(vi.mocked(ensureFont).mock.calls).toEqual([
      ['Yu Mincho', 400, 'Hi there'],
      ['Yu Mincho', 700, 'Hi there'],
      ['Meiryo', 400, 'Yo'],
      ['Meiryo', 700, 'Yo'],
    ]);
  });

  it('loads no font when neither the balloon nor the settings name one (the standard fonts are drawn)', async () => {
    useSettings.setState({ comicFont: '' });
    const page = emptyPage(1);
    page.panels[0]!.bubbles = [{ ...newBubble('speech', 0, 0), text: 'Hi' }];
    await preparePage(page, urlOf);
    expect(ensureFont).not.toHaveBeenCalled();
  });

  it('loads the picture of each stamp once, and no font for a stamp', async () => {
    useSettings.setState({ comicFont: 'Meiryo' });
    const page = emptyPage(2);
    page.panels[0]!.bubbles = [newBubble('stamp', 0, 0), newBubble('stamp', 0.5, 0.5)];
    page.panels[1]!.bubbles = [newBubble('stamp', 0, 0)];
    const ready = await preparePage(page, urlOf);
    expect(vi.mocked(backend.loadImage).mock.calls).toEqual([[stampUrl(DEFAULT_STAMP_ID)]]);
    expect([...ready.stamps.keys()]).toEqual([DEFAULT_STAMP_ID]);
    expect(ensureFont).not.toHaveBeenCalled();
  });
});

describe('the page as a picture file', () => {
  let blob: Blob | null;
  /** The type and the quality of each picture asked of a canvas. */
  let asked: unknown[][];
  beforeEach(() => {
    blob = new Blob(['picture']);
    asked = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done: BlobCallback, ...rest: unknown[]) => {
      asked.push(rest);
      done(blob);
    });
  });

  it('is a PNG without a quality by default, drawn without an effect', async () => {
    expect(await renderPage(emptyPage(1), urlOf)).toBe(blob);
    expect(asked).toEqual([['image/png', undefined]]);
    // No effect: the page's own canvas is saved, no second canvas is laid over it with a filter.
    expect(canvases.all).toHaveLength(1);
    expect(canvases.all[0]!.sets.some((s) => s.name === 'filter')).toBe(false);
  });

  it('is a JPEG with a high quality when asked for one', async () => {
    await renderPage(emptyPage(1), urlOf, 'jpeg');
    expect(asked).toHaveLength(1);
    const [type, quality] = asked[0] as [string, number];
    expect(type).toBe('image/jpeg');
    expect(quality).toBeGreaterThan(0.85);
    expect(quality).toBeLessThanOrEqual(1);
  });

  it('fails when the browser hands back no picture', async () => {
    blob = null;
    await expect(renderPage(emptyPage(1), urlOf)).rejects.toThrow('empty image');
  });
});

describe('a browser that hands out no canvas', () => {
  it('fails to draw the page rather than give a blank one', () => {
    canvases.restore();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => drawPage(preparedPage())).toThrow('no canvas');
  });

  it('gives the page without its effect when the effect has no canvas to be laid on', () => {
    canvases.restore();
    const rec = recordingContext({ width: 400, height: 600 });
    const asked: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      asked.push(this);
      return asked.length === 1 ? (rec.ctx as never) : null;
    });
    // The canvas the page was drawn on is handed back as it is.
    expect(drawPage(preparedPage(), 'mono')).toBe(asked[0]);
    expect(asked).toHaveLength(2);
    expect(rec.of('fillRect')[0]).toEqual([0, 0, 400, 600]);
  });
});
