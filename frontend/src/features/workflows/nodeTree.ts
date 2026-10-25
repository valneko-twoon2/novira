// The tree the Nodes tab of the left panel shows, laid out like ComfyUI's own node library: a section for the nodes
// (the app's own and ComfyUI's, in one tree) and one for the nodes of extensions, each a tree of folders. Nodes are
// filed by their ComfyUI category (`model/sampling` is the folder sampling inside model) in the order ComfyUI lists
// them, as its own library does; the app's own nodes by the ComfyUI folder that fits their kind; the extensions' under a
// folder of the extension's name, by name. Folders and headings are named with ComfyUI's own words (`comfyWords`).
import { t } from '@/i18n';
import { comfyCategoryLabel, comfyHeadings } from './comfyWords';
import { nodeTitle, type NodeCategory, type NodeTemplate } from './templates';

export interface NodeFolder {
  id: string;
  label: string;
  folders: NodeFolder[];
  nodes: NodeTemplate[];
  /** Nodes in this folder and every folder inside it. */
  count: number;
}

export type SectionId = 'core' | 'extensions';

export interface NodeSection {
  id: SectionId;
  label: string;
  folders: NodeFolder[];
  /** Nodes with no category, shown at the top level of the section. */
  nodes: NodeTemplate[];
}

/** The ComfyUI folder an app node of each category is filed in, so it sits with the ComfyUI nodes of its kind. */
const BUILTIN_PATH: Partial<Record<NodeCategory, string>> = {
  model: 'model/loaders',
  conditioning: 'model/conditioning',
  latents: 'model/latent',
  image: 'image',
  controlnet: 'model/conditioning/controlnet',
  video: 'video',
  audio: 'audio',
  primitives: 'utilities/primitive',
  util: 'utilities',
};

export const sectionOf = (tpl: NodeTemplate): SectionId => (tpl.category === 'extension' ? 'extensions' : 'core');

/** ComfyUI's headings when it has them in the app's language, else the app's. */
const sectionLabel = (id: SectionId) =>
  id === 'core' ? (comfyHeadings().core ?? t('workflows.nodeLibrary.section.core')) : (comfyHeadings().extensions ?? t('workflows.picker.extensions'));

/** The parts of a node's ComfyUI category (`model/patch/stable diffusion` → three); an app node's come from its kind. */
const partsOf = (tpl: NodeTemplate) => (tpl.comfyCategory ?? BUILTIN_PATH[tpl.category] ?? '').split('/').map((s) => s.trim()).filter(Boolean);

/** ComfyUI's name of a folder in the app's language, as its own library shows it; the folder's name when it has none. */
export const folderLabel = (part: string) => comfyCategoryLabel(part);

/** Where a node sits, for a search result: the section, then each folder (`ComfyUI's own nodes / Model / sampling`). */
export function pathLabel(tpl: NodeTemplate): string {
  const section = sectionOf(tpl);
  return [section === 'extensions' && tpl.pack ? tpl.pack : sectionLabel(section), ...partsOf(tpl).map((part) => folderLabel(part))].join(' / ');
}

const emptyFolder = (id: string, label: string): NodeFolder => ({ id, label, folders: [], nodes: [], count: 0 });

/** Where in ComfyUI's list a node comes (a node with no place goes last, by title). */
const orderOf = (tpl: NodeTemplate) => tpl.comfyOrder ?? Number.MAX_SAFE_INTEGER;

/** ComfyUI's order: a folder where its first node is in ComfyUI's list, a node where it is. */
function sortFolder(folder: NodeFolder): number {
  const first = new Map(folder.folders.map((f) => [f, sortFolder(f)]));
  folder.folders.sort((x, y) => first.get(x)! - first.get(y)! || x.label.localeCompare(y.label));
  folder.nodes.sort((x, y) => orderOf(x) - orderOf(y) || nodeTitle(x.type).localeCompare(nodeTitle(y.type)));
  return Math.min(...first.values(), ...folder.nodes.map(orderOf));
}

/** Files ComfyUI's nodes under the folders of their categories. */
function categoryTree(id: string, list: NodeTemplate[]): NodeFolder {
  const root = emptyFolder(id, '');
  for (const tpl of list) {
    let at = root;
    at.count++;
    partsOf(tpl).forEach((part) => {
      const folderId = `${at.id}/${part}`;
      let next = at.folders.find((f) => f.id === folderId);
      if (!next) {
        next = emptyFolder(folderId, folderLabel(part));
        at.folders.push(next);
      }
      next.count++;
      at = next;
    });
    at.nodes.push(tpl);
  }
  sortFolder(root);
  return root;
}

const plain = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** A category that only repeats the extension's name (`ImpactPack` in `ComfyUI-Impact-Pack`). */
const repeatsName = (category: string, pack: string) => {
  const c = plain(category);
  const p = plain(pack);
  return c !== '' && (p.includes(c) || c.includes(p));
};

/**
 * The extension nodes: a folder for each extension, by name, with its categories inside. A lone category that only
 * repeats the extension's name is left out, so the name is not shown twice.
 */
function packTree(list: NodeTemplate[]): NodeFolder {
  const root = emptyFolder('extensions', '');
  const byPack = new Map<string, NodeTemplate[]>();
  for (const tpl of list) byPack.set(tpl.pack ?? 'other', [...(byPack.get(tpl.pack ?? 'other') ?? []), tpl]);
  for (const [pack, nodes] of byPack) {
    const inner = categoryTree(`extensions/${pack}`, nodes);
    const only = inner.folders[0];
    const flat = inner.folders.length === 1 && !inner.nodes.length && only !== undefined && repeatsName(only.label, pack);
    root.folders.push({ ...emptyFolder(`extensions/${pack}`, pack), folders: flat ? only.folders : inner.folders, nodes: flat ? only.nodes : inner.nodes, count: nodes.length });
  }
  root.folders.sort((a, b) => a.label.localeCompare(b.label));
  root.count = list.length;
  return root;
}

/** The sections of `list` that hold a node, in the order nodes, extensions. */
export function nodeTree(list: NodeTemplate[]): NodeSection[] {
  const ids: SectionId[] = ['core', 'extensions'];
  return ids.flatMap((id) => {
    const own = list.filter((tpl) => sectionOf(tpl) === id);
    if (!own.length) return [];
    const root = id === 'extensions' ? packTree(own) : categoryTree(id, own);
    return [{ id, label: sectionLabel(id), folders: root.folders, nodes: root.nodes }];
  });
}
