// Versions of ComfyUI and of its custom node packs: comparing them and finding who a chosen version would break.
// What each catalog pack needs is written in the catalog (`requires`); a version nobody declared a need for is never
// flagged, and neither is a pack that is not in the catalog.
import type { InstalledNodePack } from '@/backend';
import { catalogPackOf, PACK_CATALOG, type CatalogPack, type PackRequirement } from './packCatalog';

/** The number parts of a version such as `v1.2.3` or `0.3.50-rc1` (`[1, 2, 3]`); empty when it has none. */
export function versionParts(version: string): number[] {
  const m = /^v?(\d+(?:\.\d+)*)/i.exec(version.trim());
  return m ? m[1]!.split('.').map(Number) : [];
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal; `null` when either has no numbers. */
export function compareVersions(a: string, b: string): number | null {
  const x = versionParts(a);
  const y = versionParts(b);
  if (x.length === 0 || y.length === 0) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Whether `version` is inside the requirement's range. A version that cannot be compared is given the benefit of the doubt. */
export function inRange(version: string, need: Pick<PackRequirement, 'min' | 'max'>): boolean {
  if (need.min !== undefined) {
    const c = compareVersions(version, need.min);
    if (c !== null && c < 0) return false;
  }
  if (need.max !== undefined) {
    const c = compareVersions(version, need.max);
    if (c !== null && c > 0) return false;
  }
  return true;
}

/** What a chosen version is going to be installed (ComfyUI itself, or one catalog pack by its id). */
export type VersionTarget = { kind: 'comfyui' } | { kind: 'pack'; id: string };

/** Who does not support the chosen version: the pack that depends on it, or ComfyUI when the pack itself needs another ComfyUI. */
export type Conflict = { kind: 'comfyui' } | { kind: 'pack'; pack: CatalogPack; folder: string };

/**
 * The installed things that would stop working with `version` of `target`: every installed catalog pack that requires
 * the target outside its range; and, for a pack, what its own requirements say about the installed ComfyUI and packs.
 */
export function conflictsFor(
  target: VersionTarget,
  version: string,
  installed: InstalledNodePack[],
  comfyVersion: string | null,
  catalog: CatalogPack[] = PACK_CATALOG,
): Conflict[] {
  const out: Conflict[] = [];
  const targetId = target.kind === 'pack' ? target.id : 'comfyui';
  for (const p of installed) {
    const known = catalogPackOf(p, catalog);
    if (!known || (target.kind === 'pack' && known.id === target.id)) continue;
    if ((known.requires ?? []).some((r) => r.on === targetId && !inRange(version, r))) out.push({ kind: 'pack', pack: known, folder: p.folder });
  }
  if (target.kind === 'pack') {
    const own = catalog.find((c) => c.id === target.id);
    for (const r of own?.requires ?? []) {
      if (r.on === 'comfyui') {
        if (comfyVersion && !inRange(comfyVersion, r)) out.push({ kind: 'comfyui' });
      } else {
        const dep = installed.find((p) => catalogPackOf(p, catalog)?.id === r.on);
        const depVersion = dep?.version;
        if (dep && depVersion && !inRange(depVersion, r)) out.push({ kind: 'pack', pack: catalogPackOf(dep, catalog)!, folder: dep.folder });
      }
    }
  }
  return out;
}
