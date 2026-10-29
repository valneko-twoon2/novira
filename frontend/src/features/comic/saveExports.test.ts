// @vitest-environment jsdom
// Saving a page or the whole comic: the file is built page by page in order and handed over as a download, a page picture
// goes to the gallery, and a failure becomes a toast instead of an unhandled error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { newProject } from '@/state/comic/document';
import { useGallery } from '@/state/gallery';
import { useToasts } from '@/state/toasts';
import { buildBook, bookFileName, saveBook } from './saveBook';
import { savePage, savePagePsd } from './savePage';

const render = vi.hoisted(() => ({
  renderPage: vi.fn(async (_p: unknown, _u: unknown, format: string) => new Blob([format === 'png' ? 'png' : 'jpg'])),
  renderPagePsd: vi.fn(async () => new Uint8Array([1, 2, 3])),
  pagePixels: vi.fn(() => ({ width: 100, height: 140 })),
}));
vi.mock('./pageRender', () => ({ renderPage: render.renderPage, pagePixels: render.pagePixels }));
vi.mock('./pagePsd', () => ({ renderPagePsd: render.renderPagePsd }));

const project = () => {
  const p = newProject('Story: 1');
  return { ...p, pages: [p.pages[0]!, { ...p.pages[0]!, id: 'second' }] };
};
const lastToast = () => useToasts.getState().toasts.at(-1);
let clicked: { download: string; href: string }[];

beforeEach(() => {
  useToasts.setState({ toasts: [] });
  clicked = [];
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  render.renderPage.mockClear();
  render.renderPagePsd.mockClear();
});

describe('the bytes of the whole comic', () => {
  it('is a ZIP of numbered PNG pages for a CBZ and of numbered PSD pages for a PSD export', async () => {
    const cbz = await buildBook(project(), 'cbz');
    const text = new TextDecoder('latin1').decode(cbz);
    expect(text).toContain('001.png');
    expect(text).toContain('002.png');
    const psd = await buildBook(project(), 'psd');
    expect(new TextDecoder('latin1').decode(psd)).toContain('001.psd');
    expect(render.renderPagePsd).toHaveBeenCalledTimes(2);
  });

  it('is a PDF of JPEG pages otherwise', async () => {
    const pdf = await buildBook(project(), 'pdf');
    expect(new TextDecoder('latin1').decode(pdf.slice(0, 5))).toBe('%PDF-');
    expect(render.renderPage.mock.calls.every((c) => c[2] === 'jpeg')).toBe(true);
  });
});

describe('saving the whole comic', () => {
  it('downloads the file under the name of the comic and says so', async () => {
    await saveBook(project(), 'cbz');
    expect(clicked.map((c) => c.download)).toEqual([bookFileName('Story: 1', 'cbz')]);
    expect(lastToast()?.status).toBe('success');
  });

  it('says why when a page cannot be drawn', async () => {
    render.renderPage.mockRejectedValueOnce(new Error('no canvas'));
    await saveBook(project(), 'cbz');
    expect(clicked).toEqual([]);
    expect(lastToast()).toMatchObject({ status: 'error', description: 'no canvas' });
  });
});

describe('saving one page', () => {
  it('keeps the page picture in the gallery', async () => {
    const image = { name: 'page.png', url: '/novira-image/page.png' } as ImageDTO;
    vi.spyOn(backend, 'uploadImage').mockResolvedValue(image);
    const p = project();
    await savePage(p.pages[0]!, 'none');
    expect(useGallery.getState().images.map((i) => i.name)).toContain('page.png');
    expect(lastToast()?.status).toBe('success');
  });

  it('says why when the upload fails', async () => {
    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('disk full'));
    await savePage(project().pages[0]!, 'none');
    expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' });
  });

  it('downloads a page as a PSD named after the comic and the page number', async () => {
    const p = project();
    await savePagePsd(p, p.pages[1]!);
    expect(clicked.map((c) => c.download)).toEqual(['Story_ 1-2.psd']);
    expect(lastToast()?.status).toBe('success');
  });

  it('says why when a PSD cannot be drawn, with a message even for a thrown text', async () => {
    render.renderPagePsd.mockRejectedValueOnce('plain text');
    const p = project();
    await savePagePsd(p, p.pages[0]!);
    expect(lastToast()).toMatchObject({ status: 'error', description: 'plain text' });
  });
});
