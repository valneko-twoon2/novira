// ComfyUI's words on its nodes: the name, description, input names and help, and output names in the app's language
// when ComfyUI has them, the node's own words when it has not, and a search that still finds the English name.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useComfyUiLocale } from '@/state/comfy/comfyUiLocale';
import { matchingTemplates } from './nodeCatalog';
import { fieldLabel, fieldTooltip, getInput, nodeDesc, nodeTitle, outputLabel, setExtensionTemplates, type NodeTemplate } from './templates';

const sampler: NodeTemplate = {
  type: 'comfy:KSamplerTest',
  category: 'comfyui',
  tags: [],
  version: 'comfy',
  title: 'KSampler Test',
  description: 'Denoises',
  comfyClass: 'KSamplerTest',
  comfyCategory: 'model/sampling',
  inputs: [
    { name: 'seed', type: 'integer', input: 'any', default: 0, tooltip: 'Random seed' },
    { name: 'steps', type: 'integer', input: 'any', default: 20 },
  ],
  outputs: [{ name: 'LATENT', type: 'LatentsField' }],
};

beforeEach(() => setExtensionTemplates([sampler]));
afterEach(() => {
  setExtensionTemplates([]);
  useComfyUiLocale.setState({ locale: null, words: null });
});

const withWords = () =>
  useComfyUiLocale.setState({
    locale: 'xx',
    words: {
      categories: {},
      comfyNodesHeading: null,
      extensionsHeading: null,
      nodes: { KSamplerTest: { name: 'Échantillonneur', description: 'Débruite', inputs: { seed: { name: 'Graine', tooltip: 'Aléatoire' } }, outputs: { '0': { name: 'Latent FR', tooltip: null } } } },
    },
  });

describe("ComfyUI's words on its nodes", () => {
  it("keeps the node's own words while ComfyUI has none", () => {
    expect(nodeTitle(sampler.type)).toBe('KSampler Test');
    expect(nodeDesc(sampler.type)).toBe('Denoises');
    expect(fieldLabel(sampler.type, 'seed')).toBe('seed');
    expect(fieldTooltip(sampler.type, getInput(sampler.type, 'seed')!)).toBe('Random seed');
    expect(outputLabel(sampler.type, 'LATENT')).toBe('LATENT');
  });

  it("shows ComfyUI's words where it has them and the node's own where it has not", () => {
    withWords();
    expect(nodeTitle(sampler.type)).toBe('Échantillonneur');
    expect(nodeDesc(sampler.type)).toBe('Débruite');
    expect(fieldLabel(sampler.type, 'seed')).toBe('Graine');
    expect(fieldTooltip(sampler.type, getInput(sampler.type, 'seed')!)).toBe('Aléatoire');
    expect(fieldLabel(sampler.type, 'steps')).toBe('steps');
    expect(outputLabel(sampler.type, 'LATENT')).toBe('Latent FR');
  });

  it('finds a node by its English name and by the name in the app language', () => {
    withWords();
    expect(matchingTemplates('ksampler test').map((t) => t.type)).toContain(sampler.type);
    expect(matchingTemplates('échantillonneur').map((t) => t.type)).toContain(sampler.type);
  });
});
