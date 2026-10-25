// The hotkey catalog builds its message keys dynamically, so check them against the catalogs here.
import { describe, expect, it } from 'vitest';
import { en, ja } from '@/i18n/catalog';
import { TOOL_HOTKEYS } from '@/state/canvas';
import { HOTKEY_CATEGORIES } from './hotkeyCatalog';

describe('hotkey catalog', () => {
  const keys = HOTKEY_CATEGORIES.flatMap((c) => [c.title, ...c.hotkeys.flatMap((h) => [h.title, h.desc])]);

  it('every key exists in ja and en', () => {
    const missing = keys.filter((k) => !(k in ja) || !(k in en));
    expect(missing).toEqual([]);
  });

  it('hotkey ids are unique', () => {
    const ids = HOTKEY_CATEGORIES.flatMap((c) => c.hotkeys.map((h) => h.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists every canvas tool with its key', () => {
    const canvas = HOTKEY_CATEGORIES.find((c) => c.id === 'canvas')!.hotkeys;
    for (const [tool, key] of Object.entries(TOOL_HOTKEYS)) expect(canvas.find((h) => h.id === `canvas.${tool}`)?.chords).toEqual([key]);
  });

  // The app's keys listen on every screen, so a canvas or comic key equal to one does both (the bucket once took `g`, which
  // also shows and hides the right panel).
  it('gives the canvas and the comic no key the whole app already uses', () => {
    const chords = (id: string) => HOTKEY_CATEGORIES.find((c) => c.id === id)!.hotkeys.flatMap((h) => (h.range ? [] : h.chords));
    const app = new Set(chords('app'));
    expect([...chords('canvas'), ...chords('comic')].filter((c) => app.has(c))).toEqual([]);
  });
});
