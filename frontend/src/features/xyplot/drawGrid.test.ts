// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvas, recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { MAX_CELL, drawGrid, gridLayout } from './drawGrid';

describe('gridLayout', () => {
  it('shrinks a large picture to the cell size and keeps its proportions', () => {
    const layout = gridLayout(2, 2, { width: 1024, height: 1536 }, { x: true, y: true });
    expect(layout.cellHeight).toBe(MAX_CELL);
    expect(layout.cellWidth).toBe(Math.round((1024 * MAX_CELL) / 1536));
  });

  it('keeps a small picture at its own size', () => {
    const layout = gridLayout(1, 1, { width: 200, height: 100 }, { x: false, y: false });
    expect([layout.cellWidth, layout.cellHeight]).toEqual([200, 100]);
  });

  it('puts the cells in rows and columns inside the picture, with room for the labels only of the axes in use', () => {
    const both = gridLayout(3, 2, { width: 512, height: 512 }, { x: true, y: true });
    const none = gridLayout(3, 2, { width: 512, height: 512 }, { x: false, y: false });
    expect(both.width).toBeGreaterThan(none.width);
    expect(both.height).toBeGreaterThan(none.height);
    const first = both.cell(0, 0);
    const last = both.cell(2, 1);
    expect(last.x).toBeGreaterThan(first.x + both.cellWidth);
    expect(last.y).toBeGreaterThan(first.y + both.cellHeight);
    // The last cell ends inside the picture.
    expect(last.x + both.cellWidth).toBeLessThanOrEqual(both.width);
    expect(last.y + both.cellHeight).toBeLessThanOrEqual(both.height);
  });

  it('does not overlap neighbouring cells', () => {
    const layout = gridLayout(2, 1, { width: 300, height: 300 }, { x: true, y: false });
    expect(layout.cell(1, 0).x).toBeGreaterThanOrEqual(layout.cell(0, 0).x + layout.cellWidth);
  });
});

describe('drawGrid', () => {
  afterEach(() => vi.restoreAllMocks());

  const content = { columns: 2, rows: 1, images: [{} as CanvasImageSource, null], picture: { width: 100, height: 50 }, title: 'Title', columnLabels: ['a', 'b'], rowLabels: ['row'] };
  const stubBlob = (blob: Blob | null) => vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(blob));

  it('draws the title, the labels, the pictures and a cross for a missing picture, and returns the PNG', async () => {
    const rec = recordingContext();
    const restore = installRecordingCanvas(rec);
    const png = new Blob(['x'], { type: 'image/png' });
    stubBlob(png);
    await expect(drawGrid(content)).resolves.toBe(png);
    restore();
    const texts = rec.of('fillText').map((a) => a[0]);
    expect(texts).toEqual(['Title', 'a', 'b', 'row', '×']);
    expect(rec.of('drawImage')).toHaveLength(1);
    // The white background first, the grey placeholder for the missing cell.
    expect(rec.of('fillRect')[0]![0]).toBe(0);
    expect(rec.sets.some((s) => s.name === 'fillStyle' && s.value === '#eeeeee')).toBe(true);
  });

  it('cuts a label that is wider than its cell with an ellipsis', async () => {
    const rec = recordingContext({ charWidth: 10 });
    const restore = installRecordingCanvas(rec);
    stubBlob(new Blob(['x']));
    await drawGrid({ ...content, images: [null, null], columnLabels: ['a very long column label that cannot fit', 'b'], rowLabels: [] });
    restore();
    const label = rec.of('fillText').map((a) => String(a[0])).find((text) => text.endsWith('…'))!;
    expect(label.length).toBeLessThan('a very long column label that cannot fit'.length);
    expect(label.length * 10).toBeLessThanOrEqual(100 + 10);
  });

  it('fails when there is no 2D context or the canvas gives no image', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(drawGrid(content)).rejects.toThrow('no canvas');
    spy.mockRestore();
    const restore = installRecordingCanvas(recordingContext());
    stubBlob(null);
    await expect(drawGrid(content)).rejects.toThrow('empty image');
    restore();
  });
});
