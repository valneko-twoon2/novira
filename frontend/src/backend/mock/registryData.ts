// The mock's copy of the ComfyUI Registry: a few of the suggested packs plus generated ones, most downloaded first.
import type { RegistryNode } from '../types';

const SUGGESTED: [string, string, string, number][] = [
  ['ComfyUI-Impact-Pack', 'ltdrdata', 'This node pack offers various detector nodes and detailer nodes that allow you to configure a workflow.', 3_468_637],
  ['ComfyUI-KJNodes', 'kijai', 'Various quality of life -nodes for ComfyUI, mostly just visual stuff to improve usability.', 4_554_755],
  ['ComfyUI-RMBG', '1038lab', 'Removes the background of a picture and keeps the subject.', 1_200_300],
  ['ComfyUI_UltimateSDUpscale', 'ssitu', 'Upscales a picture tile by tile.', 900_000],
  ['ComfyUI_IPAdapter_plus', 'cubiq', 'Uses a reference picture to guide the style of the result.', 2_000_100],
];

const generated = (n: number): RegistryNode => ({
  id: `mock-pack-${n}`,
  name: `Mock Pack ${n}`,
  description: `A generated pack number ${n}, used only by the mock backend.`,
  publisher: `mockpub${n % 5}`,
  repository: `https://github.com/mockpub${n % 5}/ComfyUI-Mock-${n}`,
  icon: null,
  downloads: 50_000 - n * 1_000,
  stars: 100 - n,
  version: `1.${n}.0`,
  updated: `2026-0${(n % 9) + 1}-1${n % 9}`,
  license: n % 4 === 0 ? null : 'MIT',
});

export const MOCK_REGISTRY: RegistryNode[] = [
  ...SUGGESTED.map(
    ([name, publisher, description, downloads], i): RegistryNode => ({
      id: name.toLowerCase(),
      name,
      description,
      publisher,
      repository: `https://github.com/${publisher}/${name}`,
      icon: null,
      downloads,
      stars: 1000 - i * 100,
      version: name === 'ComfyUI_IPAdapter_plus' ? '2.1.0' : '2.0.0',
      updated: '2026-08-08',
      license: 'GPL-3.0',
    }),
  ),
  ...Array.from({ length: 80 }, (_, i) => generated(i + 1)),
].sort((a, b) => b.downloads - a.downloads);
