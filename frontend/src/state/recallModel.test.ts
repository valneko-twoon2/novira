// Finding the model of a recalled picture: by key, else by a loosely matched name, never by a guess between several.
import { describe, expect, it } from 'vitest';
import type { ModelConfig } from '@/backend';
import { matchModelByName, normalizeModelName, recalledModel } from './recallModel';

const model = (key: string, name: string, path = '', over: Partial<ModelConfig> = {}): ModelConfig => ({
  key,
  name,
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: '',
  path,
  size: 0,
  source: '',
  ...over,
});

const wai = model('main-df710eb000d0', 'waiIllustriousSDXL_v170', 'E:\\models\\checkpoints\\waiIllustriousSDXL_v170.safetensors');
const juggernaut = model('jug', 'Juggernaut XL v9', 'C:/m/juggernautXL_v9Rundiffusionphoto2.safetensors');

describe('model name matching', () => {
  it('normalizes case, spaces and punctuation', () => {
    expect(normalizeModelName('WAI-illustrious-SDXL-v17')).toBe('waiillustrioussdxlv17');
    expect(normalizeModelName(' -_. ')).toBe('');
  });

  it('matches an exact name, the file name, or a unique start', () => {
    expect(matchModelByName('waiillustrioussdxl_V170', [wai, juggernaut])).toBe(wai);
    expect(matchModelByName('juggernautXL_v9Rundiffusionphoto2', [wai, juggernaut])).toBe(juggernaut);
    expect(matchModelByName('WAI-illustrious-SDXL-v17', [wai, juggernaut])).toBe(wai);
  });

  it('prefers an exact match to a longer name that starts the same', () => {
    const v17 = model('v17', 'WAI-illustrious-SDXL-v17');
    expect(matchModelByName('WAI-illustrious-SDXL-v17', [wai, v17])).toBe(v17);
  });

  it('finds nothing when the start is shared, when nothing matches, or for an empty name', () => {
    const v171 = model('v171', 'waiIllustriousSDXL_v171');
    expect(matchModelByName('WAI-illustrious-SDXL-v17', [wai, v171])).toBeNull();
    expect(matchModelByName('ponyDiffusionV6XL', [wai, juggernaut])).toBeNull();
    expect(matchModelByName('', [wai])).toBeNull();
    expect(matchModelByName('---', [wai])).toBeNull();
  });

  it('only matches models the Generate tab draws with', () => {
    const lora = model('l', 'WAI-illustrious-SDXL-v17-lora', '', { type: 'lora' });
    expect(matchModelByName('WAI-illustrious-SDXL-v17', [lora])).toBeNull();
  });
});

describe('the model of a recalled picture', () => {
  it('uses an installed key as it is', () => {
    expect(recalledModel({ modelKey: 'jug', modelName: 'whatever' }, [wai, juggernaut])).toEqual({ kind: 'key', key: 'jug' });
  });

  it('falls back to the name when the key is empty or not installed', () => {
    expect(recalledModel({ modelKey: '', modelName: 'WAI-illustrious-SDXL-v17' }, [wai, juggernaut])).toEqual({ kind: 'name', model: wai });
    expect(recalledModel({ modelKey: 'gone', modelName: 'Juggernaut XL v9' }, [wai, juggernaut])).toEqual({ kind: 'name', model: juggernaut });
  });

  it('reports a name it cannot find, and a picture that names no model', () => {
    expect(recalledModel({ modelKey: '', modelName: 'ponyDiffusionV6XL' }, [wai])).toEqual({ kind: 'missing', name: 'ponyDiffusionV6XL' });
    expect(recalledModel({ modelKey: 'gone', modelName: '' }, [wai])).toEqual({ kind: 'missing', name: 'gone' });
    expect(recalledModel({ modelKey: '', modelName: '  ' }, [wai])).toEqual({ kind: 'none' });
  });
});
