// scripts/i18n-add.mjs: one spec adds a message to every language, and refuses a spec that would leave a language out of step.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { addMessages } from '../scripts/i18n-add.mjs';

const LOCALES = ['ja', 'en', 'ko'];

/** A locales folder with one area file per language. */
function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'novira-i18n-'));
  for (const l of LOCALES) {
    mkdirSync(join(dir, l));
    writeFileSync(join(dir, l, 'demo.json'), `{\n  "demo.a": "${l} a"\n}\n`);
  }
  return dir;
}
const texts = (extra: Record<string, string> = {}) => ({ ja: 'ja b', en: 'en b', ko: 'ko b', ...extra });
const read = (dir: string, l: string, area = 'demo') => readFileSync(join(dir, l, `${area}.json`), 'utf8');

describe('addMessages', () => {
  it('appends the key to every language, in the repository format (2 spaces, LF)', () => {
    const dir = fixture();
    addMessages({ demo: { 'demo.b': texts() } }, { dir });
    for (const l of LOCALES) {
      expect(read(dir, l)).toBe(`{\n  "demo.a": "${l} a",\n  "demo.b": "${l} b"\n}\n`);
    }
  });

  it('writes nothing when ja or en lacks a text, and names it', () => {
    const dir = fixture();
    expect(() => addMessages({ demo: { 'demo.b': { ja: 'x', ko: 'y' } } }, { dir })).toThrow(/demo\.b: no text for en/);
    expect(read(dir, 'ja')).not.toContain('demo.b');
  });

  it('leaves out a language that has no text yet', () => {
    const dir = fixture();
    addMessages({ demo: { 'demo.b': { ja: 'ja b', en: 'en b' } } }, { dir });
    expect(read(dir, 'en')).toContain('"demo.b": "en b"');
    expect(read(dir, 'ko')).not.toContain('demo.b');
  });

  it('drops the old text of a language that is not given the new wording, and keeps the one that is', () => {
    const dir = fixture();
    addMessages({ demo: { 'demo.a': { ja: 'ja b', en: 'en b' } } }, { dir, replace: true });
    expect(read(dir, 'ko')).not.toContain('demo.a');
    addMessages({ demo: { 'demo.a': texts() } }, { dir, replace: true });
    expect(read(dir, 'ko')).toContain('"demo.a": "ko b"');
  });

  it('fills the missing texts of the other languages, never the primary ones', () => {
    const dir = fixture();
    addMessages({ demo: { 'demo.b': { ja: 'ja b', en: 'en b' } } }, { dir });
    addMessages({ demo: { 'demo.b': { ko: 'ko b' } } }, { dir, fill: true });
    expect(read(dir, 'ko')).toContain('"demo.b": "ko b"');
    expect(() => addMessages({ demo: { 'demo.b': { en: 'other' } } }, { dir, fill: true })).toThrow(/not en/);
    expect(() => addMessages({ demo: { 'demo.zzz': { ko: 'x' } } }, { dir, fill: true })).toThrow(/ja already has/);
    addMessages({ demo: { 'demo.b': { ko: 'changed' } } }, { dir, fill: true });
    expect(read(dir, 'ko')).toContain('"demo.b": "ko b"');
  });

  it('refuses another set of placeholders, a foreign key prefix and an existing key', () => {
    const dir = fixture();
    expect(() => addMessages({ demo: { 'demo.b': texts({ ja: 'has {count}' }) } }, { dir })).toThrow(/other \{placeholders\}/);
    expect(() => addMessages({ demo: { 'other.b': texts() } }, { dir })).toThrow(/should start with "demo\."/);
    expect(() => addMessages({ demo: { 'demo.a': texts() } }, { dir })).toThrow(/already exists/);
  });

  it('replaces a text in every language only when asked', () => {
    const dir = fixture();
    addMessages({ demo: { 'demo.a': texts() } }, { dir, replace: true });
    expect(read(dir, 'en')).toContain('"demo.a": "en b"');
  });

  it('creates a new area in every language only when asked', () => {
    const dir = fixture();
    expect(() => addMessages({ fresh: { 'fresh.x': texts() } }, { dir })).toThrow(/does not exist/);
    addMessages({ fresh: { 'fresh.x': texts() } }, { dir, newArea: true });
    for (const l of LOCALES) expect(JSON.parse(read(dir, l, 'fresh'))).toEqual({ 'fresh.x': `${l} b` });
  });
});
