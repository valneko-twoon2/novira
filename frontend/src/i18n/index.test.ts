import { afterEach, describe, expect, it } from 'vitest';
import { en } from './catalog';
import { getLocale, loadedCatalog, LOCALES, localeReady, onLocaleChange, setLocale, t, type Locale } from './index';

afterEach(() => setLocale('ja'));

describe('setLocale', () => {
  it('switches to ja and en at once, before anything is awaited', () => {
    void setLocale('en');
    expect(getLocale()).toBe('en');
    expect(t('settings.language.label')).toBe(en['settings.language.label']);
  });

  it('keeps the language shown until the chosen one has loaded, then tells the listeners once', async () => {
    // The first tests here: no language but ja and en has been loaded yet.
    const seen: Locale[] = [];
    const off = onLocaleChange((l) => seen.push(l));
    try {
      const switching = setLocale('de');
      const before = getLocale();
      await localeReady();
      await switching;
      expect(before).toBe('ja');
      expect(getLocale()).toBe('de');
      expect(seen).toEqual(['de']);
    } finally {
      off();
    }
  });

  it('ends on the language chosen last when a slower load finishes after it', async () => {
    const first = setLocale('ko');
    void setLocale('en');
    await first;
    expect(getLocale()).toBe('en');
  });

  it('switches to every shipped locale and renders its catalog', async () => {
    for (const locale of LOCALES) {
      await setLocale(locale);
      expect(getLocale()).toBe(locale);
      expect(t('settings.language.label')).not.toBe('');
    }
  });

  it('falls back to ja for a saved language this build does not ship', async () => {
    await setLocale('en');
    await setLocale('xx' as Locale);
    expect(getLocale()).toBe('ja');
    expect(t('settings.language.label')).toBe('言語');
  });

  it('shows the English text for a message a language has not been given yet, then the Japanese', async () => {
    await setLocale('fr');
    const fr = loadedCatalog('fr') as Record<string, string>;
    const saved = fr['settings.language.label'];
    delete fr['settings.language.label'];
    const english = en as Record<string, string>;
    const savedEn = english['settings.language.label'];
    try {
      expect(t('settings.language.label')).toBe(savedEn);
      delete english['settings.language.label'];
      expect(t('settings.language.label')).toBe('言語');
    } finally {
      english['settings.language.label'] = savedEn!;
      fr['settings.language.label'] = saved!;
    }
  });
});
