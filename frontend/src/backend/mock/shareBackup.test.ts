// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from './canvas2dRecorder.testkit';
import type { ExportOptions, ImageDTO } from '../types';
import { backupFileName, backupInfo, downloadMockBackup, exportFileName, exportInBrowser, fitSize, type MockData } from './shareBackup';

describe('mock export and backup helpers', () => {
  it('shrinks the longest side like the desktop app and never enlarges', () => {
    expect(fitSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitSize(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 });
    expect(fitSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
    expect(fitSize(800, 600, null)).toEqual({ width: 800, height: 600 });
  });

  it('names copies after the gallery file with the format extension', () => {
    expect(exportFileName('000001-abc.png', 'jpeg')).toBe('000001-abc.jpg');
    expect(exportFileName('000001-abc.png', 'webp')).toBe('000001-abc.webp');
  });

  it('names backups with the local date and time', () => {
    expect(backupFileName(new Date(2026, 9, 6, 9, 5))).toBe('novira-backup-20261006-0905.zip');
    expect(backupFileName(new Date(2026, 0, 2, 23, 59), 'json')).toBe('novira-backup-20260102-2359.json');
  });
});

class FakeImage {
  naturalWidth = 4000;
  naturalHeight = 3000;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    queueMicrotask(() => (value.includes('bad') ? this.onerror?.() : this.onload?.()));
  }
}

const picture = (name: string, mediaType: ImageDTO['mediaType'] = 'image', url = `blob:${name}`): ImageDTO => ({ name, mediaType, url, thumbnailUrl: url, width: 4000, height: 3000, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null });
const options = (patch: Partial<ExportOptions>): ExportOptions => ({ format: 'png', quality: 90, maxSide: null, ...patch }) as ExportOptions;

describe('exporting copies in the browser', () => {
  let canvases: ReturnType<typeof installRecordingCanvases>;
  let toBlob: { mock: { calls: unknown[][] }; mockImplementation: (f: never) => unknown };
  let downloads: { name: string; href: string }[];
  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:download', revokeObjectURL: vi.fn() });
    canvases = installRecordingCanvases();
    toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['x'])));
    downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, href: this.href });
    });
  });
  afterEach(() => {
    canvases.restore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads each still picture at the limited size and skips videos and audio', async () => {
    const result = await exportInBrowser([picture('a.png'), picture('b.mp4', 'video'), picture('c.wav', 'audio'), picture('d.png')], options({ format: 'webp', maxSide: 1000 }));
    expect(result).toEqual({ count: 2, skipped: 2, watermarked: 0, folder: '' });
    expect(downloads.map((d) => d.name)).toEqual(['a.webp', 'd.webp']);
    const [first] = canvases.all;
    expect(first!.of('drawImage')[0]!.slice(1)).toEqual([0, 0, 1000, 750]);
    // WebP asks for the lossless mode; the document has no leftover link.
    expect(toBlob.mock.calls[0]!.slice(1)).toEqual(['image/webp', 1]);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('lays a JPEG on white and gives its quality as a fraction; PNG has no quality', async () => {
    await exportInBrowser([picture('a.png')], options({ format: 'jpeg', quality: 80 }));
    const jpeg = canvases.all[0]!;
    expect(jpeg.sets.find((s) => s.name === 'fillStyle')!.value).toBe('#fff');
    expect(jpeg.of('fillRect')).toHaveLength(1);
    expect(toBlob.mock.calls[0]!.slice(1)).toEqual(['image/jpeg', 0.8]);
    await exportInBrowser([picture('b.png')], options({ format: 'png' }));
    expect(canvases.all[1]!.of('fillRect')).toHaveLength(0);
    expect(toBlob.mock.calls[1]!.slice(1)).toEqual(['image/png', undefined]);
  });

  it('treats a picture without a media type as a still picture', async () => {
    const legacy = { ...picture('old.png'), mediaType: undefined } as unknown as ImageDTO;
    expect((await exportInBrowser([legacy], options({}))).count).toBe(1);
  });

  it('rejects when the picture cannot be loaded, the canvas is missing or encoding gives nothing', async () => {
    await expect(exportInBrowser([picture('x.png', 'image', 'blob:bad')], options({}))).rejects.toThrow('image load failed');
    toBlob.mockImplementation(((cb: BlobCallback) => cb(null)) as never);
    await expect(exportInBrowser([picture('y.png')], options({}))).rejects.toThrow('encoding failed');
    canvases.restore();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(exportInBrowser([picture('z.png')], options({}))).rejects.toThrow('canvas unavailable');
  });
});

describe('the mock backup', () => {
  const data: MockData = {
    boards: [{ id: 'b1', name: 'Board' } as MockData['boards'][number]],
    images: [picture('a.png'), picture('b.png')],
    workflows: [
      { id: 1, name: 'mine', category: 'user' } as unknown as MockData['workflows'][number],
      { id: 2, name: 'default', category: 'default' } as unknown as MockData['workflows'][number],
    ],
  };

  it('counts the pictures, the boards and only the user workflows', () => {
    expect(backupInfo(data, 123)).toEqual({ appVersion: '0.1.0-mock', createdAt: 123, images: 2, boards: 1, workflows: 1 });
  });

  it('downloads one JSON file with no picture addresses, the user workflows and the screen state', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:backup', revokeObjectURL: vi.fn() });
    let blob: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => ((blob = b as Blob), 'blob:backup'));
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    const now = new Date(2026, 9, 7, 10, 30);
    const result = downloadMockBackup(data, '{"theme":"dark"}', now);
    expect(result.fileName).toBe('novira-backup-20261007-1030.json');
    expect(clicks).toEqual([result.fileName]);
    expect(result.bytes).toBe(blob!.size);
    const body = JSON.parse(await blob!.text()) as Record<string, unknown>;
    expect(body).toMatchObject({ format: 'novira-backup', version: 1, mock: true, images: [{ name: 'a.png' }, { name: 'b.png' }], uiState: { theme: 'dark' } });
    expect(JSON.stringify(body.images)).not.toContain('blob:');
    expect(body.workflows).toHaveLength(1);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
