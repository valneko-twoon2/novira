import { describe, expect, it } from 'vitest';
import type { InstalledNodePack, RegistryNode } from '@/backend';
import { agentExtensions, editsToFind, extensionId, folderOfExtensionId, questionWords } from './agentExtensions';
import { buildItems } from './comfy/extensionList';

const reg = (name: string, description: string, downloads = 0): RegistryNode => ({
  id: name.toLowerCase(),
  name,
  description,
  publisher: 'someone',
  repository: `https://github.com/someone/${name}`,
  icon: null,
  downloads,
  stars: 0,
  version: '1.0.0',
  updated: '2026-01-01',
  license: 'MIT',
});

const registry = [
  reg('ComfyUI-Foo', 'Draws foo shapes into a picture', 10),
  reg('ComfyUI-Bar', 'A bar chart maker', 500),
  reg('ComfyUI-Baz', 'Something about foo and bar', 5),
  ...Array.from({ length: 12 }, (_, i) => reg(`Other-${i}`, 'unrelated')),
];
const installed: InstalledNodePack[] = [{ folder: 'ComfyUI-Foo', url: 'https://github.com/someone/ComfyUI-Foo', version: 'v0.2' }];
const items = buildItems(installed, registry);
const nodes = (folder: string) => (folder === 'ComfyUI-Foo' ? [{ name: 'Foo Draw', inputs: ['image:IMAGE'], outputs: ['IMAGE'] }] : []);

describe('extension ids', () => {
  it('are the folder name behind a prefix, and only that form is an extension id', () => {
    expect(extensionId('ComfyUI-Foo')).toBe('ext:ComfyUI-Foo');
    expect(folderOfExtensionId('ext:ComfyUI-Foo')).toBe('ComfyUI-Foo');
    expect(folderOfExtensionId('rmbg')).toBeNull();
  });
});

describe('questionWords', () => {
  it('keeps the Latin words that can name something and drops filler, repeats and Japanese', () => {
    expect(questionWords('What does ComfyUI-Foo do with foo? Foo!')).toEqual(['comfyui-foo', 'foo']);
    expect(questionWords('背景を消したい')).toEqual([]);
  });
});

describe('agentExtensions', () => {
  it('lists the chosen extension first with the nodes it adds, and makes it the focus', () => {
    const { extensions, focus } = agentExtensions('how do I use it', ['ComfyUI-Foo'], items, nodes);
    expect(focus).toBe('ext:ComfyUI-Foo');
    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toMatchObject({ id: 'ext:ComfyUI-Foo', installed: true, version: 'v0.2', publisher: 'someone', nodes: [{ name: 'Foo Draw' }] });
  });

  it('finds extensions by the words of the question, best match first, and not by part of a word', () => {
    const { extensions, focus } = agentExtensions('Tell me about ComfyUI-Bar and foo', [], items, nodes);
    expect(focus).toBeUndefined();
    expect(extensions.map((e) => e.name)).toEqual(['ComfyUI-Foo', 'ComfyUI-Bar', 'ComfyUI-Baz']);
    expect(extensions.every((e) => !e.nodes)).toBe(true);
  });

  it('does not list a chosen extension twice, and caps what it finds', () => {
    const many = buildItems([], Array.from({ length: 30 }, (_, i) => reg(`Pack-${i}`, 'draws things')));
    const { extensions } = agentExtensions('draws', ['Pack-3'], many, nodes);
    expect(extensions[0]!.name).toBe('Pack-3');
    expect(extensions).toHaveLength(7);
    expect(new Set(extensions.map((e) => e.id)).size).toBe(7);
  });

  it('says nothing when the question names nothing and nothing was chosen', () => {
    expect(agentExtensions('背景を消したい', [], items, nodes)).toEqual({ extensions: [] });
  });

  it('does not list nodes when several extensions were chosen, to keep the prompt small', () => {
    const { extensions } = agentExtensions('compare', ['ComfyUI-Foo', 'ComfyUI-Bar'], items, nodes);
    expect(extensions.map((e) => e.name)).toEqual(['ComfyUI-Foo', 'ComfyUI-Bar']);
    expect(extensions.some((e) => e.nodes)).toBe(false);
  });
});

describe('names with a typo', () => {
  const tj = buildItems([], [reg('ComfyUI_TJ_NormalLighting', 'Relights a picture'), reg('ComfyUI-Other', 'unrelated'), reg('ComfyUI-Normal', 'x')]);

  it('counts the edits needed to find a name inside another', () => {
    expect(editsToFind('comfyuitjnormallighting', 'comfyuitjnormallighting')).toBe(0);
    expect(editsToFind('confyuitjnormallighting', 'comfyuitjnormallighting')).toBe(1);
    expect(editsToFind('normallighting', 'comfyuitjnormallighting')).toBe(0);
    expect(editsToFind('zzzzzz', 'comfyuitj')).toBeGreaterThan(3);
  });

  it('finds the extension although a letter of its name is wrong, or the separators differ', () => {
    for (const asked of ['confyUI_TJ_NormalLighting', 'ComfyUI TJ NormalLighting', 'comfyui_tj_normallightin']) {
      const { extensions } = agentExtensions(`${asked}について教えて`, [], tj, nodes);
      expect(extensions[0]?.name, asked).toBe('ComfyUI_TJ_NormalLighting');
    }
  });

  it('does not take a different name for it', () => {
    expect(agentExtensions('Tell me about ZetaWidget', [], tj, nodes).extensions).toEqual([]);
  });
});
