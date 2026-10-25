import { describe, expect, it } from 'vitest';
import type { RegistryNode } from '@/backend';
import { authorOf, buildItems, filterItems, hasUpdate, sortItems } from './extensionList';
import { PACK_CATALOG } from './packCatalog';

describe('extension list', () => {
  it('takes the author from the GitHub address, whatever its spelling', () => {
    expect(authorOf('https://github.com/ltdrdata/ComfyUI-Impact-Pack')).toBe('ltdrdata');
    expect(authorOf('https://github.com/ltdrdata/ComfyUI-Impact-Pack.git/')).toBe('ltdrdata');
    expect(authorOf(null)).toBeNull();
    expect(authorOf('not an address')).toBeNull();
  });

  it('lists every catalog pack once, marks the installed ones, and adds packs found only in ComfyUI', () => {
    const items = buildItems([
      { folder: 'ComfyUI-Impact-Pack', url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack', version: 'v8.0' },
      { folder: 'by-hand', url: null, version: null },
      { folder: 'Fancy', url: 'https://github.com/someone/Fancy', version: null },
    ]);
    expect(items).toHaveLength(PACK_CATALOG.length + 2);
    expect(items.find((i) => i.folder === 'ComfyUI-Impact-Pack')!.installed?.version).toBe('v8.0');
    expect(items.filter((i) => i.installed)).toHaveLength(3);
    expect(items.find((i) => i.folder === 'by-hand')!.author).toBeNull();
    expect(items.find((i) => i.folder === 'Fancy')!.author).toBe('someone');
  });

  it('filters by state, purpose and text', () => {
    const items = buildItems([{ folder: 'Fancy', url: 'https://github.com/someone/Fancy', version: null }]);
    expect(filterItems(items, 'installed', '').map((i) => i.folder)).toEqual(['Fancy']);
    expect(filterItems(items, 'notInstalled', '')).toHaveLength(PACK_CATALOG.length);
    const background = filterItems(items, 'background', '');
    expect(background.length).toBeGreaterThan(0);
    expect(background.every((i) => i.catalog?.goals.includes('background'))).toBe(true);
    expect(filterItems(items, 'all', 'LTDRDATA').every((i) => i.author === 'ltdrdata')).toBe(true);
    expect(filterItems(items, 'all', 'zzz-no-match')).toEqual([]);
    expect(filterItems(items, 'all', 'by the description', () => 'by the description')).toHaveLength(items.length);
  });

  const node = (name: string, publisher: string, downloads: number, updated: string): RegistryNode => ({
    id: name.toLowerCase(),
    name,
    description: `${name} does things`,
    publisher,
    repository: `https://github.com/${publisher}/${name}`,
    icon: null,
    downloads,
    stars: 1,
    version: '1.0.0',
    updated,
    license: null,
  });

  it('merges the registry, the catalog and what is installed into one entry per repository', () => {
    const registry = [node('ComfyUI-Impact-Pack', 'ltdrdata', 500, '2026-01-01'), node('Other', 'someone', 900, '2026-03-01')];
    const items = buildItems(
      [
        { folder: 'ComfyUI-Impact-Pack', url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack', version: null },
        { folder: 'other', url: null, version: null },
      ],
      registry,
    );
    // One entry for Impact Pack with all three sources; `other` (put there by hand) is matched to the registry by folder name.
    const impact = items.filter((i) => i.folder === 'ComfyUI-Impact-Pack');
    expect(impact).toHaveLength(1);
    expect(impact[0]).toMatchObject({ author: 'ltdrdata' });
    expect(impact[0]!.catalog).not.toBeNull();
    expect(impact[0]!.installed).not.toBeNull();
    expect(impact[0]!.registry?.downloads).toBe(500);
    expect(items.find((i) => i.folder === 'other')!.registry?.publisher).toBe('someone');
    expect(items).toHaveLength(PACK_CATALOG.length + 1);
  });

  it('sorts by downloads, stars, update date or name', () => {
    const items = buildItems([], [node('Bee', 'p', 10, '2026-01-01'), node('Ay', 'p', 30, '2025-01-01'), node('Cee', 'p', 20, '2026-06-01')]);
    const names = (sort: Parameters<typeof sortItems>[1]) => sortItems(items, sort).filter((i) => i.registry).map((i) => i.folder);
    expect(names('downloads')).toEqual(['Ay', 'Cee', 'Bee']);
    expect(names('updated')).toEqual(['Cee', 'Bee', 'Ay']);
    expect(names('name')).toEqual(['Ay', 'Bee', 'Cee']);
  });

  it('sees an update only when the installed tag is older than the latest version of the registry', () => {
    const at = (version: string | null, latest: string | null) =>
      buildItems([{ folder: 'Alpha', url: 'https://github.com/p/Alpha', version }], [{ ...node('Alpha', 'p', 1, '2026-01-01'), version: latest }]).find((i) => i.folder === 'Alpha')!;
    expect(hasUpdate(at('v1.9.0', '1.10.0'))).toBe(true);
    expect(hasUpdate(at('v2.0.0', '2.0.0'))).toBe(false);
    expect(hasUpdate(at('v3.0.0', '2.0.0'))).toBe(false);
    expect(hasUpdate(at(null, '2.0.0'))).toBe(false);
    expect(filterItems([at('v1.0.0', '1.1.0'), at('v1.1.0', '1.1.0')], 'updatable', '')).toHaveLength(1);
  });
});
