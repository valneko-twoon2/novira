// The tree of the Nodes tab: the app's nodes filed among ComfyUI's, sections in a fixed order, ComfyUI's nodes filed by
// every part of their category, folders and nodes in the order ComfyUI lists them, folders and headings named with
// ComfyUI's own words when it has them (its names otherwise), and the path a search result shows.
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { useComfyUiLocale } from '@/state/comfy/comfyUiLocale';
import { folderLabel, nodeTree, pathLabel, type NodeFolder } from './nodeTree';
import type { NodeTemplate } from './templates';

const comfy = (name: string, category: string, pack?: string, comfyOrder?: number): NodeTemplate => ({
  type: `comfy:${name}`,
  category: pack ? 'extension' : 'comfyui',
  tags: [],
  inputs: [],
  outputs: [],
  version: 'comfy',
  title: name,
  comfyCategory: category,
  ...(comfyOrder === undefined ? {} : { comfyOrder }),
  ...(pack ? { pack } : {}),
});
const builtin = (type: string, category: NodeTemplate['category']): NodeTemplate => ({ type, category, tags: [], inputs: [], outputs: [], version: '1' });

const labels = (folders: NodeFolder[]) => folders.map((f) => f.label);

/** ComfyUI's words of a made-up language. */
const withWords = () =>
  useComfyUiLocale.setState({
    locale: 'xx',
    words: { categories: { model: 'Modèle', sampling: 'Échantillonnage', image: 'Img' }, comfyNodesHeading: 'Nœuds Comfy', extensionsHeading: 'Ajouts', nodes: {} },
  });
afterEach(() => useComfyUiLocale.setState({ locale: null, words: null }));

describe('nodeTree', () => {
  it('orders the sections nodes, extensions and leaves out an empty one', () => {
    const tree = nodeTree([comfy('Ext', 'image', 'Pack'), comfy('Core', 'image'), builtin('integer', 'primitives')]);
    expect(tree.map((s) => s.id)).toEqual(['core', 'extensions']);
    expect(nodeTree([comfy('Core', 'image')]).map((s) => s.id)).toEqual(['core']);
  });

  it("files ComfyUI's nodes by every part of their category, counting what each folder holds", () => {
    const [core] = nodeTree([comfy('A', 'model/patch/stable diffusion', undefined, 0), comfy('B', 'model/patch', undefined, 1), comfy('C', 'model/sampling', undefined, 2), comfy('D', '', undefined, 3)]);
    const model = core!.folders[0]!;
    expect(model.label).toBe('model');
    expect(model.count).toBe(3);
    expect(labels(model.folders)).toEqual(['patch', 'sampling']);
    const patch = model.folders[0]!;
    expect(patch.nodes.map((n) => n.title)).toEqual(['B']);
    expect(patch.folders[0]!.nodes.map((n) => n.title)).toEqual(['A']);
    // A node with no category sits at the top of its section.
    expect(core!.nodes.map((n) => n.title)).toEqual(['D']);
  });

  it("puts folders where their first node is in ComfyUI's list and nodes where they are; with no place, by name", () => {
    const [core] = nodeTree([comfy('B', 'model/loaders', undefined, 5), comfy('A', 'image', undefined, 2), comfy('C', 'model/sampling', undefined, 1), comfy('D', 'model/sampling', undefined, 0)]);
    expect(core!.folders.map((f) => f.id)).toEqual(['core/model', 'core/image']);
    expect(core!.folders[0]!.folders.map((f) => f.id)).toEqual(['core/model/sampling', 'core/model/loaders']);
    expect(core!.folders[0]!.folders[0]!.nodes.map((n) => n.title)).toEqual(['D', 'C']);
    const [unordered] = nodeTree([comfy('zeta', 'zeta'), comfy('alpha', 'alpha')]);
    expect(unordered!.folders.map((f) => f.id)).toEqual(['core/alpha', 'core/zeta']);
  });

  it("names folders and headings with ComfyUI's words at any depth, and keeps the names it has no word for", () => {
    expect(folderLabel('sampling')).toBe('sampling');
    expect(nodeTree([comfy('A', 'model')])[0]!.label).toBe(t('workflows.nodeLibrary.section.core'));
    withWords();
    expect(folderLabel('sampling')).toBe('Échantillonnage');
    expect(folderLabel('wan')).toBe('wan');
    const [core, ext] = nodeTree([comfy('A', 'model/sampling'), comfy('B', 'image', 'Pack')]);
    expect([core!.label, ext!.label]).toEqual(['Nœuds Comfy', 'Ajouts']);
    expect(core!.folders[0]!.label).toBe('Modèle');
    expect(core!.folders[0]!.folders[0]!.label).toBe('Échantillonnage');
  });

  it("files an extension's nodes under a folder of its name, by name, with its categories inside", () => {
    const [ext] = nodeTree([comfy('a', 'image/upscaling', 'Zeta-Pack', 0), comfy('b', 'image', 'Zeta-Pack', 1), comfy('c', 'Misc', 'Alpha-Pack', 2), comfy('d', '', 'Alpha-Pack', 3)]);
    expect(ext!.folders.map((f) => f.label)).toEqual(['Alpha-Pack', 'Zeta-Pack']);
    const zeta = ext!.folders[1]!;
    expect(zeta.count).toBe(2);
    expect(zeta.folders[0]!.label).toBe('image');
    expect(zeta.folders[0]!.folders[0]!.nodes.map((n) => n.title)).toEqual(['a']);
    // A node with no category sits in the extension's folder next to its categories.
    expect(ext!.folders[0]!.nodes.map((n) => n.title)).toEqual(['d']);
    expect(ext!.folders[0]!.folders.map((f) => f.label)).toEqual(['Misc']);
  });

  it("leaves out a lone category that only repeats the extension's name", () => {
    const [ext] = nodeTree([comfy('a', 'ImpactPack/Detailer', 'ComfyUI-Impact-Pack', 0), comfy('b', 'ImpactPack', 'ComfyUI-Impact-Pack', 1), comfy('c', 'Florence2', 'ComfyUI-Florence2', 2)]);
    const impact = ext!.folders.find((f) => f.label === 'ComfyUI-Impact-Pack')!;
    expect(impact.count).toBe(2);
    expect(impact.folders.map((f) => f.label)).toEqual(['Detailer']);
    expect(impact.nodes.map((n) => n.title)).toEqual(['b']);
    const florence = ext!.folders.find((f) => f.label === 'ComfyUI-Florence2')!;
    expect(florence.folders).toHaveLength(0);
    expect(florence.nodes.map((n) => n.title)).toEqual(['c']);
  });

  it("files the app's nodes in the ComfyUI folder of their kind, next to ComfyUI's own nodes", () => {
    const [section] = nodeTree([comfy('Load', 'image', undefined, 0), builtin('img', 'image'), builtin('lora', 'model'), builtin('integer', 'primitives'), builtin('cn', 'controlnet')]);
    expect(section!.folders.map((f) => f.id)).toEqual(['core/image', 'core/model', 'core/utilities']);
    expect(section!.folders[0]!.nodes.map((n) => n.type)).toEqual(['comfy:Load', 'img']);
    expect(section!.folders[1]!.folders.map((f) => f.id)).toEqual(['core/model/conditioning', 'core/model/loaders']);
    expect(section!.folders[2]!.folders[0]!.id).toBe('core/utilities/primitive');
  });

  it('names where a node sits: the section or the extension, then its folders', () => {
    expect(pathLabel(comfy('E', 'image', 'Pack'))).toBe('Pack / image');
    expect(pathLabel(builtin('integer', 'primitives'))).toBe(`${t('workflows.nodeLibrary.section.core')} / utilities / primitive`);
    withWords();
    expect(pathLabel(comfy('A', 'model/sampling'))).toBe('Nœuds Comfy / Modèle / Échantillonnage');
  });
});
