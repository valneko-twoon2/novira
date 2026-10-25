// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeClipboardText } from './clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('writeClipboardText', () => {
  it('uses the clipboard of a secure page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await writeClipboardText('a cat');
    expect(writeText).toHaveBeenCalledWith('a cat');
  });

  it('copies through a hidden field where the page is not secure, and leaves nothing behind', async () => {
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

  it('fails when the browser refuses the copy, and still removes the field', async () => {
    vi.stubGlobal('navigator', {});
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    await expect(writeClipboardText('x')).rejects.toThrow();
    expect(document.querySelector('textarea')).toBeNull();
  });
});
