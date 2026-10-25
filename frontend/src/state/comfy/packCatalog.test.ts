import { describe, expect, it } from 'vitest';
import { ja } from '@/i18n/catalog';
import { agentPacks, caveatKey, goalDescKey, goalTitleKey, PACK_CATALOG, PACK_GOALS, packDescKey, packFolder, packsForGoal } from './packCatalog';

describe('pack catalog', () => {
  it('has unique ids and repository folders', () => {
    const ids = PACK_CATALOG.map((p) => p.id);
    const folders = PACK_CATALOG.map((p) => packFolder(p.url));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(folders).size).toBe(folders.length);
  });

  it('has a message for every pack, caveat and goal it shows', () => {
    const missing: string[] = [];
    const need = (key: string) => {
      if (!(key in ja)) missing.push(key);
    };
    for (const p of PACK_CATALOG) {
      need(packDescKey(p.id));
      if (p.caveat) need(caveatKey(p.caveat));
    }
    for (const g of PACK_GOALS) {
      need(goalTitleKey(g));
      need(goalDescKey(g));
    }
    expect(missing).toEqual([]);
  });

  it('lists at least one pack under every goal, the packs mainly for it first', () => {
    for (const goal of PACK_GOALS) {
      const packs = packsForGoal(goal);
      expect(packs.length, goal).toBeGreaterThan(0);
      const ranks = packs.map((p) => p.goals.indexOf(goal));
      expect(ranks, goal).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('takes the folder from a GitHub address with or without .git and a trailing slash', () => {
    expect(packFolder('https://github.com/owner/Repo.git')).toBe('Repo');
    expect(packFolder('https://github.com/owner/Repo/')).toBe('Repo');
  });

  it('tells the assistant which packs are installed, by folder or by address', () => {
    const [byFolder, byUrl] = PACK_CATALOG;
    const info = agentPacks([
      { folder: packFolder(byFolder!.url), url: null },
      { folder: 'renamed-folder', url: byUrl!.url },
    ]);
    expect(info.filter((p) => p.installed).map((p) => p.id)).toEqual([byFolder!.id, byUrl!.id]);
    expect(agentPacks(undefined).every((p) => !p.installed)).toBe(true);
  });
});
