// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { savedTheme } from './savedTheme';

describe('savedTheme', () => {
  beforeEach(() => localStorage.clear());

  it('reads light from the saved settings', () => {
    localStorage.setItem('novira.settings', JSON.stringify({ state: { theme: 'light', language: 'en' }, version: 0 }));
    expect(savedTheme()).toBe('light');
  });

  it('is dark, the default, for anything else', () => {
    expect(savedTheme()).toBe('dark');
    for (const text of ['{"state":{"theme":"dark"},"version":0}', '{"state":{}}', '{"theme":"light"}', 'null', '"light"', 'not json']) {
      localStorage.setItem('novira.settings', text);
      expect(savedTheme(), text).toBe('dark');
    }
  });
});
