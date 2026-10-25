// Checks the message catalogs and that UI source does not hardcode Japanese text.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en, ja, loadCatalog, PRIMARY_LOCALES } from '@/i18n/catalog';
import { catalogs } from '@/i18n/catalogs.testkit';
import { placeholders, renderTemplate } from '@/i18n/render';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
/** Folders that are not user-facing UI (mock fixtures, the catalogs themselves). */
const EXEMPT = ['i18n/', 'backend/mock/'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

const files = sourceFiles(SRC).map((p) => ({ rel: relative(SRC, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));

describe('i18n catalogs', () => {
  it('renders placeholders and escaped braces', () => {
    expect(renderTemplate('{a} of {{b}}', { a: 1 })).toBe('1 of {b}');
  });

  it('other locales only use keys and placeholders that exist in ja', () => {
    const jaRecord = ja as Record<string, string>;
    for (const [locale, catalog] of Object.entries(catalogs)) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(jaRecord[key], `${locale}: unknown key ${key}`).toBeDefined();
        expect(placeholders(value as string), `${locale}: ${key}`).toEqual(placeholders(jaRecord[key] as string));
      }
    }
  });

  it('ja and en have every key; the other languages may lack some and show the English text meanwhile', () => {
    const jaKeys = Object.keys(ja);
    for (const locale of PRIMARY_LOCALES) {
      const missing = jaKeys.filter((k) => !(k in (catalogs[locale] as Record<string, string>)));
      expect(missing, `${locale} lacks keys that ja has; add them to locales/${locale}/<area>.json`).toEqual([]);
    }
  });

  it('the built-in ja and en hold every area file (a new area is imported in catalog.ts)', () => {
    expect(ja).toEqual(catalogs.ja);
    expect(en).toEqual(catalogs.en);
  });

  it('a language loaded when chosen holds the same messages as its area files', async () => {
    for (const locale of Object.keys(catalogs) as (keyof typeof catalogs)[]) expect(await loadCatalog(locale), locale).toEqual(catalogs[locale]);
  });

  it('every area file exists for every locale', () => {
    const dir = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url));
    const areas = (locale: string) => readdirSync(join(dir, locale)).sort();
    for (const locale of readdirSync(dir)) expect(areas(locale), locale).toEqual(areas('ja'));
  });

  it('every t() key used in source exists in ja', () => {
    const missing: string[] = [];
    for (const f of files) {
      for (const m of f.text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) {
        if (!((m[1] as string) in ja)) missing.push(`${f.rel}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('UI source has no hardcoded Japanese', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (EXEMPT.some((e) => f.rel.startsWith(e))) continue;
      f.text.split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (/[぀-ヿ一-鿿]/.test(code)) offenders.push(`${f.rel}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
