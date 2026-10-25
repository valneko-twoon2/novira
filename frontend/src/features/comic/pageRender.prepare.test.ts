// @vitest-environment jsdom
// Preparing a page for drawing: the panels' pictures load side by side, not one after the other.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as backend from '@/backend';
import { emptyPage } from '@/state/comic/document';
import { preparePage } from './pageRender';

vi.mock('@/backend', async (original) => ({
  ...(await original<typeof import('@/backend')>()),
  loadImage: vi.fn(),
}));

let running = 0;
let peak = 0;
beforeEach(() => {
  running = 0;
  peak = 0;
  vi.mocked(backend.loadImage).mockImplementation(async (url: string) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return { naturalWidth: 100, naturalHeight: 80, src: url } as HTMLImageElement;
  });
});

describe('preparePage', () => {
  it('loads every panel picture and the backdrop at the same time, and keeps the panels in order', async () => {
    const page = emptyPage(3);
    page.panels.forEach((panel, i) => (panel.imageName = `p${i}.png`));
    page.backdrop = { imageName: 'back.png', view: { ...page.panels[0]!.imageView } } as typeof page.backdrop;
    const prepared = await preparePage(page, (name) => `blob:${name}`);
    expect(peak).toBe(4);
    expect(prepared.panels.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(prepared.panels.map((p) => (p.image as unknown as { src: string }).src)).toEqual(['blob:p0.png', 'blob:p1.png', 'blob:p2.png']);
    expect((prepared.backdrop as unknown as { src: string }).src).toBe('blob:back.png');
  });
});
