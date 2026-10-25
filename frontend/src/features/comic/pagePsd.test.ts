// @vitest-environment jsdom
// "Save page as PSD" and the PSD pages of "export all pages": which layers a page gives, in which order and under which
// names, that the effect reaches every layer, and that the file is a PSD (one per page in the ZIP). Drawing goes to
// recorded canvases, so this checks the layers and the calls, not the pixels.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { setLocale } from '@/i18n';
import { emptyPage, newBubble, newProject, type ComicBubble, type ComicPage } from '@/state/comic/document';
import { buildPagePsd, firstWords, pageLayers, renderPagePsd } from './pagePsd';
import { drawPage, preparePage, type PreparedPage } from './pageRender';
import { buildBook } from './saveBook';

vi.mock('@/backend', async (original) => ({
  ...(await original<typeof import('@/backend')>()),
  loadImage: vi.fn(async () => ({ naturalWidth: 100, naturalHeight: 80 }) as HTMLImageElement),
}));

const said = (text: string, x = 0.1): ComicBubble => ({ ...newBubble('speech', x, 0.1), text });

/** A page with a backdrop, two panels with pictures, and balloons: two with words and one empty in the first panel, one in the second. */
function samplePage(): ComicPage {
  const page = emptyPage(2);
  page.backdrop = { imageName: 'sky.png', view: { cx: 0.5, cy: 0.5, scale: 1, rotation: 0, flipX: false, flipY: false } };
  page.panels[0]!.imageName = 'a.png';
  page.panels[0]!.bubbles = [said('Hello there, how are you today?'), said(''), said('**Wow**')];
  page.panels[1]!.imageName = 'b.png';
  page.panels[1]!.bubbles = [said('ねえ\n聞いて')];
  return page;
}

const urlOf = (name: string) => `blob:${name}`;

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  setLocale('en');
  // Transparent but for a small square at the top left, so each layer is cut down to it.
  canvases = installRecordingCanvases({ pixel: (x, y) => (x < 4 && y < 3 ? [255, 255, 255, 255] : [0, 0, 0, 0]) });
});
afterEach(() => {
  canvases.restore();
  setLocale('ja');
});

/** The prepared page at a small size, so the recorded canvases hand out few pixels. */
async function prepared(page: ComicPage): Promise<PreparedPage> {
  return { ...(await preparePage(page, urlOf)), width: 20, height: 30 };
}

describe('the layers of a page', () => {
  it('are the paper, the backdrop, each panel, the frames and each balloon with words, bottom first', async () => {
    const layers = pageLayers(await prepared(samplePage()));
    expect(layers.map((l) => l.name)).toEqual([
      'Paper',
      'Picture over the whole page',
      'Panel 1',
      'Panel 2',
      'Frames',
      'Balloon 1-1: Hello there, how…',
      'Balloon 1-3: Wow',
      'Balloon 2-1: ねえ 聞いて',
    ]);
    expect(layers.map((l) => l.part.kind)).toEqual(['paper', 'backdrop', 'panel', 'panel', 'frames', 'balloon', 'balloon', 'balloon']);
  });

  it('leave out the backdrop when the page has none, and the frames when no panel has one', async () => {
    const page = { ...samplePage(), backdrop: null, frameMm: 0, insetMm: 0, marginMm: 0 };
    const ready = await prepared(page);
    const names = pageLayers({ ...ready, panels: ready.panels.map((p) => ({ ...p, outline: null })) }).map((l) => l.name);
    expect(names).not.toContain('Picture over the whole page');
    expect(names).not.toContain('Frames');
    expect(names.slice(0, 3)).toEqual(['Paper', 'Panel 1', 'Panel 2']);
  });

  it('are named in the language of the app', async () => {
    setLocale('ja');
    const names = pageLayers(await prepared(samplePage())).map((l) => l.name);
    expect(names[0]).toBe('用紙');
    expect(names).toContain('コマ 1');
    expect(names.at(-1)).toBe('吹き出し 2-1: ねえ 聞いて');
  });

  it('show the start of a balloon\'s words on one line, without its marks', () => {
    expect(firstWords('**Big**  《《news》》\nhere')).toBe('Big news here');
    expect(firstWords('あいうえおかきくけこさしすせそたち')).toBe('あいうえおかきくけこさしすせそた…');
  });
});

describe('the PSD of a page', () => {
  it('has one layer per part, cut to what is drawn in it, and the whole page as its flattened picture', async () => {
    const ready = await prepared(samplePage());
    const doc = buildPagePsd(ready, 'none');
    expect(doc.layers.map((l) => l.name)).toEqual(pageLayers(ready).map((l) => l.name));
    for (const layer of doc.layers) expect(layer).toMatchObject({ left: 0, top: 0, width: 4, height: 3 });
    expect(doc).toMatchObject({ width: 20, height: 30 });
    expect(doc.composite.length).toBe(20 * 30 * 4);
  });

  it('gives every layer the page\'s effect: the filter, then the paper tone over its pixels', async () => {
    const doc = buildPagePsd(await prepared(samplePage()), 'ebook');
    const filtered = canvases.all.filter((rec) => rec.sets.some((s) => s.name === 'filter' && String(s.value).includes('grayscale')));
    // One filtered canvas per layer, and one for the flattened picture.
    expect(filtered).toHaveLength(doc.layers.length + 1);
    // White multiplied by the e-book paper (#f1eee6), alpha kept.
    expect([...doc.layers[0]!.pixels.subarray(0, 4)]).toEqual([0xf1, 0xee, 0xe6, 255]);
  });

  it('draws the flattened picture the way the saved page is drawn', async () => {
    const ready = await prepared(samplePage());
    const flat = drawPage(ready, 'none');
    const pageCalls = canvases.of(flat).calls.map((c) => c.name);
    canvases.restore();
    canvases = installRecordingCanvases({ pixel: () => [0, 0, 0, 0] });
    buildPagePsd(ready, 'none');
    const flatOfPsd = canvases.all.find((rec) => !rec.calls.some((c) => c.name === 'clearRect'))!;
    expect(flatOfPsd.calls.map((c) => c.name).filter((n) => n !== 'getImageData')).toEqual(pageCalls);
  });

  it('is a PSD file, and "export all pages" puts one per page into a ZIP', async () => {
    const page = { ...samplePage(), size: 'A5' as const };
    const bytes = await renderPagePsd(page, urlOf, 'mono');
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('8BPS');
    const project = { ...newProject('Story'), pages: [page, { ...emptyPage(1), size: 'A5' as const }] };
    const zip = new TextDecoder('latin1').decode(await buildBook(project, 'psd'));
    expect(zip.startsWith('PK')).toBe(true);
    expect(zip).toContain('001.psd');
    expect(zip).toContain('002.psd');
    expect(zip).toContain('8BPS');
  }, 30000);
});
