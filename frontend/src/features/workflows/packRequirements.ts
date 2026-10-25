// Which custom node packs a workflow needs, written into the files the editor saves, and what is missing when such a
// file is opened somewhere the packs are not installed.
import { useNodePacks } from '@/state/comfy/nodePacks';
import { PACK_CATALOG, packFolder } from '@/state/comfy/packCatalog';
import { getTemplate } from './templates';

export interface PackRef {
  /** Folder name in ComfyUI's `custom_nodes`. */
  folder: string;
  /** GitHub address, when it is known. */
  url: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The GitHub address of a pack folder: where it was installed from, else the suggested packs of the Extensions tab. */
export function packUrl(folder: string): string | null {
  const installed = useNodePacks.getState().packs?.installed.find((p) => p.folder === folder && p.url);
  return installed?.url ?? PACK_CATALOG.find((p) => packFolder(p.url) === folder)?.url ?? null;
}

/** The packs the nodes come from (once each); ComfyUI's own and the app's own nodes need none. */
export function packsOfNodes(nodes: { data: { type: string } }[]): PackRef[] {
  const folders = [...new Set(nodes.map((n) => getTemplate(n.data.type)?.pack).filter((p): p is string => !!p))];
  return folders.map((folder) => ({ folder, url: packUrl(folder) }));
}

export interface MissingPacks {
  /** The packs the file says it needs (from its own list, which an older file may lack). */
  packs: PackRef[];
  /** Node types of the file that this editor does not know. */
  types: string[];
}

/**
 * What stops a workflow file from loading because custom node packs are missing; null when it is something else (an
 * app node that does not exist, a broken file), which stays an error.
 */
export function missingPacks(raw: unknown): MissingPacks | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || !Array.isArray(value.nodes)) return null;
  const types = [...new Set(value.nodes.map((n) => (isRecord(n) && isRecord(n.data) && typeof n.data.type === 'string' ? n.data.type : '')).filter((type) => type && !getTemplate(type)))];
  if (types.length === 0 || !types.every((type) => type.startsWith('comfy:'))) return null;
  const declared = Array.isArray(value.packs) ? value.packs : [];
  const packs = declared
    .filter((p): p is Record<string, unknown> => isRecord(p) && typeof p.folder === 'string')
    .map((p) => ({ folder: p.folder as string, url: typeof p.url === 'string' ? p.url : packUrl(p.folder as string) }));
  return { packs, types };
}
