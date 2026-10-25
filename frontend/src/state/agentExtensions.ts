// The extensions the AI assistant is told about when a question may be about one: the ones chosen in the extension
// manager, and the ones whose name or description share words with the question. Unlike the packs novira suggests
// (`agentPacks`), these come from the whole ComfyUI Registry that the manager has loaded.
import type { AgentExtensionInfo } from '@/backend';
import { purposesOf, type ExtensionItem } from './comfy/extensionList';

/** A node of an installed extension, as the assistant is told about it. */
export type AgentExtensionNode = NonNullable<AgentExtensionInfo['nodes']>[number];

const MAX_MATCHES = 6;
const MAX_FOCUS = 8;
const MAX_NODES = 14;
const MAX_ABOUT = 400;

/** The id the assistant uses for an extension (the folder name, which is also the manager's key). */
export const extensionId = (folder: string) => `ext:${folder}`;

/** The folder name behind an id from the assistant, or null when it is not an extension id. */
export const folderOfExtensionId = (id: string) => (id.startsWith('ext:') ? id.slice(4) : null);

// Words that say nothing about which extension is meant.
const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'does', 'this', 'that', 'can', 'use', 'from', 'about', 'tell', 'please', 'extension', 'extensions', 'node', 'nodes', 'pack', 'packs', 'install', 'comfyui']);

/** Latin words of the question (names of extensions are Latin; the registry's texts are English). */
export function questionWords(message: string): string[] {
  return [...new Set((message.toLowerCase().match(/[a-z0-9][a-z0-9._-]{2,}/g) ?? []).filter((w) => !STOP.has(w)))];
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The fewest edits that turn `needle` into some part of `hay` (approximate substring matching): a typo, a dropped
 * letter or other separators still find the name. Both are squashed to letters and digits first.
 */
export function editsToFind(needle: string, hay: string): number {
  let prev = Array.from({ length: hay.length + 1 }, () => 0);
  for (let i = 1; i <= needle.length; i++) {
    const row = [i];
    for (let j = 1; j <= hay.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (needle[i - 1] === hay[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return Math.min(...prev);
}

/** Nearly every name starts with ComfyUI; it says nothing about which extension is meant, so it is not compared (a typo in it is forgiven). */
function withoutComfyPrefix(squashed: string): string {
  return squashed.length > 7 && editsToFind(squashed.slice(0, 7), 'comfyui') <= 1 && editsToFind('comfyui', squashed.slice(0, 7)) <= 1 ? squashed.slice(7) : squashed;
}

/** Words shorter than this are only matched exactly: one wrong letter would change them into another word. */
const FUZZY_MIN = 5;

function score(item: ExtensionItem, words: string[]): number {
  const name = `${item.folder} ${item.registry?.name ?? ''} ${item.registry?.id ?? ''}`.toLowerCase();
  // A name may contain the word (comfyui-foo-pack); in a description it has to be a word of its own ("foo" is not "footage").
  const text = new Set(`${item.registry?.description ?? ''} ${item.catalog?.about ?? ''}`.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g));
  let total = 0;
  const squashed = withoutComfyPrefix(squash(name));
  for (const w of words) {
    if (name.includes(w)) total += 3;
    else if (w.length >= FUZZY_MIN) {
      const sw = withoutComfyPrefix(squash(w));
      // About one wrong letter in six is tolerated.
      if (sw.length >= FUZZY_MIN && editsToFind(sw, squashed) <= Math.floor(sw.length / 6)) total += 2;
    }
    if (text.has(w)) total += 1;
  }
  return total;
}

function info(item: ExtensionItem, nodes: AgentExtensionNode[]): AgentExtensionInfo {
  const about = item.catalog?.about ?? item.registry?.description ?? '';
  return {
    id: extensionId(item.folder),
    name: item.folder,
    ...(item.author ? { publisher: item.author } : {}),
    about: about.length > MAX_ABOUT ? `${about.slice(0, MAX_ABOUT)}…` : about,
    purposes: purposesOf(item),
    installed: !!item.installed,
    ...(item.installed?.version || item.registry?.version ? { version: item.installed?.version ?? item.registry?.version ?? null } : {}),
    ...(item.registry ? { downloads: item.registry.downloads } : {}),
    ...(item.url ? { url: item.url } : {}),
    ...((item.catalog?.license ?? item.registry?.license) ? { license: item.catalog?.license ?? item.registry?.license ?? null } : {}),
    ...(nodes.length ? { nodes } : {}),
  };
}

export interface AgentExtensionContext {
  extensions: AgentExtensionInfo[];
  /** The id of the first extension the user chose, when they asked from the manager. */
  focus?: string;
}

/**
 * `focus` are folders the user chose in the extension manager (listed first, with the nodes they add when installed);
 * after them come up to six extensions that share words with the question.
 */
export function agentExtensions(
  message: string,
  focus: string[],
  items: ExtensionItem[],
  nodesOf: (folder: string) => AgentExtensionNode[],
): AgentExtensionContext {
  const chosen = focus.slice(0, MAX_FOCUS).flatMap((f) => items.find((i) => i.folder === f) ?? []);
  const taken = new Set(chosen.map((i) => i.folder));
  const words = questionWords(message);
  const found = words.length
    ? items
        .filter((i) => !taken.has(i.folder))
        .map((i) => ({ i, s: score(i, words) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || (b.i.registry?.downloads ?? 0) - (a.i.registry?.downloads ?? 0))
        .slice(0, MAX_MATCHES)
        .map((x) => x.i)
    : [];
  const detailed = chosen.length === 1;
  const extensions = [
    ...chosen.map((i) => info(i, i.installed && detailed ? nodesOf(i.installed.folder).slice(0, MAX_NODES) : [])),
    ...found.map((i) => info(i, [])),
  ];
  return { extensions, ...(chosen[0] ? { focus: extensionId(chosen[0].folder) } : {}) };
}
