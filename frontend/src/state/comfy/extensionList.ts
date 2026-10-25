// The extension manager's list: the packs of the ComfyUI Registry, the packs novira suggests and the packs found in
// ComfyUI, merged into one entry per GitHub repository, with who made it.
import type { InstalledNodePack, RegistryNode } from '@/backend';
import { packKey } from './nodePacks';
import { PACK_CATALOG, catalogPackOf, packFolder, type CatalogPack } from './packCatalog';
import { assignedPurposes, purposesFromText, type PurposeId } from './purposes';

export interface ExtensionItem {
  /** Folder name under custom_nodes (the repository name for one not installed yet). */
  folder: string;
  /** GitHub address (null for a pack put into ComfyUI by hand). */
  url: string | null;
  catalog: CatalogPack | null;
  installed: InstalledNodePack | null;
  /** The registry's entry for it (downloads, version, publisher), when it has one. */
  registry: RegistryNode | null;
  /** Who made it: the registry's publisher, else the owner part of the GitHub address (null when neither is known). */
  author: string | null;
}

export type ExtensionFilter = 'all' | 'installed' | 'notInstalled' | 'updatable' | PurposeId;
export type ExtensionSort = 'downloads' | 'stars' | 'updated' | 'name';

/** The owner of a GitHub repository address. */
export function authorOf(url: string | null): string | null {
  const m = url ? /^https:\/\/github\.com\/([^/]+)\//i.exec(packKey(url) + '/') : null;
  return m?.[1] ?? null;
}

const parts = (v: string) => v.replace(/^v/i, '').split(/[.+-]/).map((p) => Number.parseInt(p, 10) || 0);

/** The registry's latest version is newer than the tag the pack was installed at (a pack from the default branch has no tag to compare). */
export function hasUpdate(item: ExtensionItem): boolean {
  const have = item.installed?.version;
  const latest = item.registry?.version;
  if (!have || !latest) return false;
  const a = parts(have);
  const b = parts(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

const lower = (url: string | null) => (url ? packKey(url).toLowerCase() : null);

/** Merges the three sources by repository address (and, for what is installed, by folder name). */
export function buildItems(installed: InstalledNodePack[], registry: RegistryNode[] = []): ExtensionItem[] {
  const items: ExtensionItem[] = [];
  const byUrl = new Map<string, ExtensionItem>();
  const add = (item: ExtensionItem) => {
    items.push(item);
    const key = lower(item.url);
    if (key) byUrl.set(key, item);
  };
  for (const r of registry) {
    add({ folder: packFolder(r.repository), url: packKey(r.repository), catalog: null, installed: null, registry: r, author: r.publisher });
  }
  for (const c of PACK_CATALOG) {
    const found = byUrl.get(lower(c.url)!);
    if (found) found.catalog = c;
    else add({ folder: packFolder(c.url), url: packKey(c.url), catalog: c, installed: null, registry: null, author: authorOf(c.url) });
  }
  for (const i of installed) {
    const found = (lower(i.url) && byUrl.get(lower(i.url)!)) || items.find((x) => x.folder.toLowerCase() === i.folder.toLowerCase()) || null;
    if (found) {
      found.installed = i;
      found.folder = i.folder;
    } else {
      const cat = catalogPackOf(i);
      add({ folder: i.folder, url: i.url, catalog: cat ?? null, installed: i, registry: null, author: authorOf(i.url) });
    }
  }
  return items;
}

/** What a pack is for: the purposes it is filed under in the catalog, else the AI's filing of the registry pack, else the ones its name and description point to. */
export function purposesOf(item: ExtensionItem): PurposeId[] {
  if (item.catalog) return item.catalog.goals;
  let found = PURPOSES.get(item);
  if (!found) {
    found = (item.registry && assignedPurposes(item.registry.id)) || purposesFromText(`${item.folder} ${item.registry?.name ?? ''} ${item.registry?.description ?? ''}`);
    PURPOSES.set(item, found);
  }
  return found;
}

/** Filing a pack by its words is the slow part of a filter, so it is done once per entry. */
const PURPOSES = new WeakMap<ExtensionItem, PurposeId[]>();

/** How many entries each rail item of the manager would list (no search), counted in one pass. */
export function countFilters(items: ExtensionItem[]): Record<string, number> {
  const count: Record<string, number> = { all: items.length, installed: 0, updatable: 0, notInstalled: 0 };
  for (const i of items) {
    if (i.installed) count.installed!++;
    else count.notInstalled!++;
    if (hasUpdate(i)) count.updatable!++;
    for (const p of purposesOf(i)) count[p] = (count[p] ?? 0) + 1;
  }
  return count;
}

/** `describe` gives the text a search also looks in (the description in the current language). */
export function filterItems(items: ExtensionItem[], filter: ExtensionFilter, search: string, describe: (i: ExtensionItem) => string = () => ''): ExtensionItem[] {
  const q = search.trim().toLowerCase();
  return items.filter((i) => {
    if (filter === 'installed' && !i.installed) return false;
    if (filter === 'notInstalled' && i.installed) return false;
    if (filter === 'updatable' && !hasUpdate(i)) return false;
    if (filter !== 'all' && filter !== 'installed' && filter !== 'notInstalled' && filter !== 'updatable' && !purposesOf(i).includes(filter)) return false;
    return !q || `${i.folder} ${i.author ?? ''} ${i.registry?.name ?? ''} ${i.registry?.description ?? ''} ${i.catalog?.about ?? ''} ${describe(i)}`.toLowerCase().includes(q);
  });
}

/** A sorted copy. Packs novira suggests or that are installed come before others that tie. */
export function sortItems(items: ExtensionItem[], sort: ExtensionSort): ExtensionItem[] {
  const num = (i: ExtensionItem) => (sort === 'downloads' ? (i.registry?.downloads ?? 0) : sort === 'stars' ? (i.registry?.stars ?? 0) : 0);
  const rank = (i: ExtensionItem) => (i.installed ? 2 : i.catalog ? 1 : 0);
  return [...items].sort((a, b) => {
    if (sort === 'name') return a.folder.localeCompare(b.folder);
    if (sort === 'updated') return (b.registry?.updated ?? '').localeCompare(a.registry?.updated ?? '') || rank(b) - rank(a);
    return num(b) - num(a) || rank(b) - rank(a) || a.folder.localeCompare(b.folder);
  });
}
