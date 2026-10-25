// The bundled comic know-how: the tool description names exactly the topics that exist, and every text stands alone.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANGA_GUIDE_TOPICS, mangaGuide } from './mangaGuide';

const rust = readFileSync(resolve(process.cwd(), '../backend/crates/novira-core/src/agent/tools.rs'), 'utf8');
const listed = () => {
  const at = rust.indexOf('name: "get_manga_guide"');
  const description = rust.slice(at, rust.indexOf('read_only', at));
  return [...description.matchAll(/\[([a-z-]+)\]/g)].map((m) => m[1]!);
};

describe('the comic know-how', () => {
  it('has exactly the topics the tool description lists', () => {
    expect([...listed()].sort()).toEqual(MANGA_GUIDE_TOPICS);
  });

  it('covers the 16 kinds of scene and the working topics', () => {
    expect(MANGA_GUIDE_TOPICS.filter((t) => t.startsWith('scene-'))).toHaveLength(16);
    for (const id of ['story', 'direction', 'layout', 'lettering', 'prompting', 'fixing', 'scene']) expect(MANGA_GUIDE_TOPICS).toContain(id);
  });

  it('keeps each text to a size one answer can carry, with a title and its own-work line', () => {
    for (const id of MANGA_GUIDE_TOPICS) {
      const text = String(mangaGuide(id).content);
      expect(text.startsWith('# '), id).toBe(true);
      expect(text.length, id).toBeGreaterThan(300);
      expect(text.length, id).toBeLessThan(9000);
      expect(text.split('\n')[1], id).toBe('> novira オリジナルの手引き');
    }
  });

  it('lists the topics when none or an unknown one is asked for', () => {
    expect(mangaGuide(undefined)).toMatchObject({ ok: true, content: { topics: expect.any(Array) } });
    expect(mangaGuide('nope').ok).toBe(false);
  });

  it('names no external kit or sample', () => {
    for (const id of MANGA_GUIDE_TOPICS) expect(String(mangaGuide(id).content), id).not.toMatch(/MangaAgents|百合学園|NovelAI|Anlas|Production Kit|contributors|出典/i);
  });
});
