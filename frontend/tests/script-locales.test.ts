// The frontend scripts' own copy of the primary languages (scripts/locales.mjs, plain JavaScript) stays equal to the app's
// (src/i18n/catalog.ts), and the chapter file name pattern takes what the manual's chapters are called.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRIMARY_LOCALES as APP } from '@/i18n/catalog';
// @ts-expect-error -- plain ESM script without types
import { CHAPTER_FILE, CHAPTER_NAME, PRIMARY_LOCALES } from '../scripts/locales.mjs';

describe('what the frontend scripts share about languages', () => {
  it('names the same primary languages as the app', () => {
    expect(PRIMARY_LOCALES).toEqual([...APP]);
  });

  it('takes every chapter file of the manual and nothing else', () => {
    const ja = readdirSync(fileURLToPath(new URL('../../docs/manual/ja', import.meta.url)));
    const chapters = ja.filter((f) => CHAPTER_FILE.test(f));
    expect(chapters.length).toBeGreaterThan(5);
    expect(ja.filter((f) => f.endsWith('.md') && !CHAPTER_FILE.test(f))).toEqual([]);
    expect(CHAPTER_FILE.test('_meta.json')).toBe(false);
    expect(new RegExp(`^docs/manual/ja/(${CHAPTER_NAME})$`).exec('docs/manual/ja/02-generate.md')?.[1]).toBe('02-generate.md');
  });
});
