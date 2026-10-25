// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canOpenNewWindow, openInNewWindow } from './openWindow';

describe('openInNewWindow', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens addresses the app hands out', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    for (const url of ['http://novira-image.localhost/full/a.png', 'novira-image://localhost/full/a.png', 'blob:http://localhost/x', 'data:image/png;base64,AA==', '/novira-image/full/a.png']) {
      expect(openInNewWindow(url)).toBe(true);
    }
    expect(open).toHaveBeenCalledTimes(5);
    expect(open).toHaveBeenCalledWith('http://novira-image.localhost/full/a.png', '_blank', 'noopener');
  });

  it('refuses scripts, remote pages and look-alike hosts', () => {
    const script = ['java', 'script:alert(1)'].join('');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    for (const url of [script, 'https://example.com/', 'http://novira-image.localhost.evil.com/a.png', 'data:text/html,<b>x</b>', ' blob:x', '/novira-image/full/../x', '/novira-image/other/a.png', '//evil.example/novira-image/full/a.png']) {
      expect(openInNewWindow(url)).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('opens nothing inside the desktop app, which has no tabs', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    try {
      expect(canOpenNewWindow()).toBe(false);
      expect(openInNewWindow('blob:http://localhost/x')).toBe(false);
      expect(open).not.toHaveBeenCalled();
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
    expect(canOpenNewWindow()).toBe(true);
  });
});
