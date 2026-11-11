// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canWriteClipboardImage, writeClipboardImage, writeClipboardText } from './clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('writeClipboardText', { tags: [] }, () => {
  it('uses the clipboard of a secure page', { tags: ['condition'] }, async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await writeClipboardText('a cat');
    expect(writeText).toHaveBeenCalledWith('a cat');
  });

  it('copies through a hidden field where the page is not secure, and leaves nothing behind', { tags: ['condition'] }, async () => {
    vi.stubGlobal('navigator', {});
    let copied = '';
    const exec = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement | null)?.value ?? (document.querySelector('textarea')?.value ?? '');
      return true;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec });
    await writeClipboardText('a dog');
    expect(exec).toHaveBeenCalledWith('copy');
    expect(copied).toBe('a dog');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('fails when the browser refuses the copy, and still removes the field', { tags: ['error-guessing'] }, async () => {
    vi.stubGlobal('navigator', {});
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    await expect(writeClipboardText('x')).rejects.toThrow();
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('writeClipboardImage', { tags: [] }, () => {
  it(
    'asks the clipboard in the same turn, handing it the picture that is still being made',
    { tags: ['regression', 'condition'] },
    async () => {
      const write = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('ClipboardItem', class { constructor(public items: Record<string, Blob | Promise<Blob>>) {} });
      vi.stubGlobal('navigator', { clipboard: { write } });
      const pending = new Promise<Blob>(() => undefined);
      void writeClipboardImage(pending);
      expect(write).toHaveBeenCalledTimes(1);
      expect((write.mock.calls[0]?.[0] as { items: Record<string, unknown> }[])[0]?.items['image/png']).toBe(pending);
    },
  );

  it('refuses where the page has no picture clipboard, and does not touch the clipboard', { tags: ['error-guessing'] }, async () => {
    const write = vi.fn();
    vi.stubGlobal('ClipboardItem', undefined);
    vi.stubGlobal('navigator', { clipboard: { write } });
    expect(canWriteClipboardImage()).toBe(false);
    await expect(writeClipboardImage(new Blob(['x']))).rejects.toThrow('not available');
    expect(write).not.toHaveBeenCalled();
  });
});
