import { describe, expect, it } from 'vitest';
import type { InstalledNodePack } from '@/backend';
import type { CatalogPack } from './packCatalog';
import { compareVersions, conflictsFor, inRange, versionParts } from './versions';

const pack = (id: string, requires: CatalogPack['requires'] = []): CatalogPack => ({
  id,
  url: `https://github.com/o/${id}`,
  license: 'MIT',
  goals: ['handy'],
  about: id,
  requires,
});
const at = (id: string, version: string | null): InstalledNodePack => ({ folder: id, url: `https://github.com/o/${id}`, version });

describe('versions', () => {
  it('reads the number parts and compares them', () => {
    expect(versionParts('v1.2.3')).toEqual([1, 2, 3]);
    expect(versionParts('0.3.50-rc1')).toEqual([0, 3, 50]);
    expect(versionParts('main')).toEqual([]);
    expect(compareVersions('v1.10.0', 'v1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('main', '1.0')).toBeNull();
  });

  it('keeps a version inside its range, and gives one that cannot be compared the benefit of the doubt', () => {
    expect(inRange('1.5.0', { min: '1.0.0', max: '2.0.0' })).toBe(true);
    expect(inRange('0.9.0', { min: '1.0.0' })).toBe(false);
    expect(inRange('2.1.0', { max: '2.0.0' })).toBe(false);
    expect(inRange('nightly', { min: '1.0.0' })).toBe(true);
  });

  it('names the installed packs that do not support a version of ComfyUI', () => {
    const catalog = [pack('a', [{ on: 'comfyui', min: '0.3.0', max: '0.3.60' }]), pack('b', [{ on: 'comfyui', min: '0.2.0' }])];
    const installed = [at('a', null), at('b', null)];
    const names = (v: string) => conflictsFor({ kind: 'comfyui' }, v, installed, '0.3.50', catalog).map((c) => (c.kind === 'pack' ? c.folder : 'comfyui'));
    expect(names('0.3.50')).toEqual([]);
    expect(names('0.3.70')).toEqual(['a']);
    expect(names('0.1.0')).toEqual(['a', 'b']);
  });

  it('names the pack that depends on a version of another pack, and what the pack itself needs', () => {
    const catalog = [pack('base'), pack('sub', [{ on: 'base', min: '2.0.0' }]), pack('needsNew', [{ on: 'comfyui', min: '0.4.0' }])];
    const installed = [at('base', 'v2.5.0'), at('sub', 'v1.0.0'), at('needsNew', null)];
    // Moving base below what sub needs is flagged, with sub as the reason.
    expect(conflictsFor({ kind: 'pack', id: 'base' }, 'v1.9.0', installed, '0.3.50', catalog).map((c) => c.kind === 'pack' && c.folder)).toEqual(['sub']);
    expect(conflictsFor({ kind: 'pack', id: 'base' }, 'v2.1.0', installed, '0.3.50', catalog)).toEqual([]);
    // A pack that needs a newer ComfyUI than the installed one is flagged with ComfyUI as the reason; so is sub's own need of base.
    expect(conflictsFor({ kind: 'pack', id: 'needsNew' }, 'v3', installed, '0.3.50', catalog)).toEqual([{ kind: 'comfyui' }]);
    const old = [at('base', 'v1.0.0'), at('sub', null)];
    expect(conflictsFor({ kind: 'pack', id: 'sub' }, 'v1', old, '0.3.50', catalog).map((c) => c.kind === 'pack' && c.folder)).toEqual(['base']);
  });

  it('flags nothing for packs without declared needs', () => {
    expect(conflictsFor({ kind: 'comfyui' }, '9.9.9', [at('a', null)], '0.3.50', [pack('a')])).toEqual([]);
  });
});
