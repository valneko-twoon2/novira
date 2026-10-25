// Terminology: one concept, one word (src/i18n/glossary.json, checked by scripts/check-glossary.mjs).
// Catches the same concept being called by different words on different screens, in the catalogs and in the manual.
// Only ja and en are checked unless NOVIRA_GLOSSARY_LOCALES names more ("all", or "ko,de").
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import glossary from '../src/i18n/glossary.json';
// @ts-expect-error -- plain ESM script without types
import { DEFAULT_LOCALES, check, findViolations, selectLocales, strip, textsOf, workingTree } from '../scripts/check-glossary.mjs';

type Term = { concept: string; ja: string; en: string; why: string; keys?: string; avoid: Record<string, string[]>; except?: { key: string; why: string }[] };
type Text = { where: string; key?: string; text: string };
const terms = (glossary as unknown as { terms: Term[] }).terms;
const available = readdirSync(join(__dirname, '..', 'src', 'i18n', 'locales'));
const locales: string[] = selectLocales(process.env.NOVIRA_GLOSSARY_LOCALES, available);

const one = (term: Partial<Term>): { terms: Term[] } => ({ terms: [{ concept: 'C', ja: '正', en: 'right', why: 'w', avoid: {}, ...term }] });

describe('glossary', () => {
  for (const language of locales) {
    it(`${language}: no word the glossary says to avoid, in the catalogs and the manual`, () => {
      expect(check(workingTree, [language])).toEqual([]);
    });
  }

  it('every term has a canonical ja and en word, a reason and valid patterns', () => {
    for (const t of terms) {
      expect(t.concept && t.ja && t.en && t.why, JSON.stringify(t)).toBeTruthy();
      for (const [language, list] of Object.entries(t.avoid)) {
        expect(language === '*' || available.includes(language), `${t.concept}: unknown language ${language}`).toBe(true);
        for (const p of list) expect(() => new RegExp(p, 'u'), `${t.concept}: ${p}`).not.toThrow();
      }
      if (t.keys) expect(() => new RegExp(t.keys!, 'u')).not.toThrow();
    }
  });

  it('every exception names a catalog key that exists and gives a reason', () => {
    const keys = new Set((textsOf('ja', workingTree) as Text[]).flatMap((x) => (x.key ? [x.key] : [])));
    for (const t of terms) for (const e of t.except ?? []) expect(keys.has(e.key) && e.why, `${t.concept}: ${e.key}`).toBeTruthy();
  });
});

describe('check-glossary', () => {
  it('checks ja and en by default, every language with "all", or a list', () => {
    expect(DEFAULT_LOCALES).toEqual(['ja', 'en']);
    expect(selectLocales(undefined, ['de', 'en', 'ja'])).toEqual(['ja', 'en']);
    expect(selectLocales('', ['de', 'en', 'ja'])).toEqual(['ja', 'en']);
    expect(selectLocales('all', ['de', 'en', 'ja'])).toEqual(['de', 'en', 'ja']);
    expect(selectLocales(' de , ja ', ['de', 'en', 'ja'])).toEqual(['de', 'ja']);
    expect(() => selectLocales('xx', ['de', 'en', 'ja'])).toThrow(/xx/);
  });

  it('does not read screen-word references, placeholders, inline code, link targets or URLs', () => {
    expect(strip('a {{ui:x.lora}} {lora} `lora` [t](08-models.md#lora) https://x.io/lora b')).not.toMatch(/lora/);
    expect(strip('keep lora here')).toContain('lora');
  });

  it('reports a variant with where it is and the word to use', () => {
    const found = findViolations([{ where: 'ja/a.json a.b', key: 'a.b', text: '誤を使う' }], one({ avoid: { ja: ['誤'] } }), 'ja');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^ja\/a\.json a\.b: "誤" -> use "正"/);
    expect(findViolations([{ where: 'x', text: '正を使う' }], one({ avoid: { ja: ['誤'] } }), 'ja')).toEqual([]);
  });

  it('applies "*" rules to every language and a language rule only to its language', () => {
    const g = one({ avoid: { '*': ['Wrongcase'], ja: ['誤'] } });
    expect(findViolations([{ where: 'x', text: 'Wrongcase 誤' }], g, 'de')).toHaveLength(1);
    expect(findViolations([{ where: 'x', text: 'Wrongcase 誤' }], g, 'ja')).toHaveLength(2);
  });

  it('reads only the keys a rule names, and never manual lines for such a rule', () => {
    const g = one({ keys: '\\.status\\.', avoid: { en: ['^Error$'] } });
    expect(findViolations([{ where: 'x', key: 'q.status.error', text: 'Error' }], g, 'en')).toHaveLength(1);
    expect(findViolations([{ where: 'x', key: 'q.detail.error', text: 'Error' }], g, 'en')).toEqual([]);
    expect(findViolations([{ where: 'manual', text: 'Error' }], g, 'en')).toEqual([]);
  });

  it('skips the keys a rule lists as exceptions', () => {
    const g = one({ avoid: { ja: ['誤'] }, except: [{ key: 'a.ok', why: 'quotes a name' }] });
    expect(findViolations([{ where: 'x', key: 'a.ok', text: '誤' }, { where: 'y', key: 'a.no', text: '誤' }], g, 'ja')).toHaveLength(1);
  });

  it('reads catalog messages and manual lines, but not fenced code', () => {
    const files: Record<string, string> = {
      'frontend/src/i18n/locales/ja/a.json': '{ "a.x": "誤" }',
      'docs/manual/ja/01-x.md': '# 見出し\n誤\n```\n誤\n```\n',
    };
    const read = {
      list: (dir: string) => [...new Set(Object.keys(files).filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1).split('/')[0]))],
      file: (p: string) => files[p] ?? '',
    };
    const texts = textsOf('ja', read) as Text[];
    expect(texts.map((t) => t.where)).toEqual(['ja/a.json a.x', 'manual/ja/01-x.md:1', 'manual/ja/01-x.md:2', 'manual/ja/01-x.md:6']);
    expect(findViolations(texts, one({ avoid: { ja: ['誤'] } }), 'ja')).toHaveLength(2);
  });

  it('keeps the words the real rules must allow', () => {
    const g = glossary as unknown as { terms: Term[] };
    const ok = (language: string, text: string, key = 'x.y') => expect(findViolations([{ where: 'x', key, text }], g, language)).toEqual([]);
    ok('ja', 'プロンプトを入れて「生成」を押します');
    ok('ja', '{count} 枚をキューに入れました');
    ok('ja', 'ComfyUI を選んだパッケージでインストールします');
    ok('ja', '動画のモデルパックをダウンロード');
    ok('en', 'The extensions ComfyUI-Impact-Pack and the Impact Subpack');
    ok('en', 'install the custom node pack');
    ok('en', 'ComfyUI_IPAdapter_plus and comfyui_controlnet_aux');
    ok('en', 'Retry', 'queue.action.retry');
  });

  it('stops the variants the real rules name', () => {
    const g = glossary as unknown as { terms: Term[] };
    const bad = (language: string, text: string, key = 'x.y') => expect(findViolations([{ where: 'x', key, text }], g, language), text).not.toEqual([]);
    bad('ja', '拡張機能を入れてください');
    bad('ja', 'モデルがまだ入っていません');
    bad('ja', 'インストールを中止');
    bad('ja', 'やり直す', 'pack.retry');
    bad('ja', '作成者: {author}');
    bad('ja', 'パックをインストール');
    bad('en', 'Install packs');
    bad('en', 'Search by creator');
    bad('en', 'Text colour');
    bad('en', 'Cancelled');
    bad('en', 'HuggingFace Repo ID');
    bad('en', 'Select an IP Adapter');
  });
});
