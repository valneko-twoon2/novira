// scripts/i18n-todo.mjs: the messages the languages other than ja and en still lack.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { missingMessages } from '../scripts/i18n-todo.mjs';

describe('missingMessages', () => {
  it('lists, per other language, the keys ja has and it lacks, with the ja and en texts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'novira-todo-'));
    const files: Record<string, Record<string, string>> = {
      ja: { 'demo.a': 'あ', 'demo.b': 'い' },
      en: { 'demo.a': 'a', 'demo.b': 'b' },
      ko: { 'demo.a': '가' },
      fr: { 'demo.a': 'a', 'demo.b': 'b' },
    };
    for (const [l, messages] of Object.entries(files)) {
      mkdirSync(join(dir, l));
      writeFileSync(join(dir, l, 'demo.json'), JSON.stringify(messages));
    }
    expect(missingMessages(dir)).toEqual({ fr: {}, ko: { demo: { 'demo.b': { ja: 'い', en: 'b' } } } });
    expect(missingMessages(dir, ['fr'])).toEqual({ fr: {} });
  });
});
