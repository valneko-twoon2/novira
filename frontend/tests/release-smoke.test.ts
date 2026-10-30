// The smoke test of a release build (tools/release-smoke.mjs): its options, the files it requires and what an old-data fixture must hold.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { checkFixtureBootstrap, fixtureVersions, missingFiles, parseArgs } from '../../tools/release-smoke.mjs';

const whole = {
  boards: [{ name: 'Scenery' }, { name: 'Portraits' }],
  images: [{ starred: true }, { starred: false }, { starred: false }],
  workflows: [{ name: 'Old workflow' }],
  models: [{}, {}],
  queue: { items: [{}, {}, {}] },
};

describe('release-smoke', () => {
  it('checks artifacts\\ unless --artifacts names another folder, and refuses an unknown option', () => {
    expect(parseArgs([]).artifacts).toMatch(/[\\/]artifacts$/);
    expect(parseArgs(['--artifacts', 'E:/x/out']).artifacts).toBe(path.resolve('E:/x/out'));
    expect(() => parseArgs(['--artifacts'])).toThrow(/needs a folder/);
    expect(() => parseArgs(['--fast'])).toThrow(/unknown option --fast/);
  });

  it('names each release file that is missing', () => {
    const present = new Set([path.join('A', 'novira.exe'), path.join('A', 'server.bat')]);
    expect(missingFiles('A', (f: string) => present.has(f))).toEqual(['novira-server.exe', path.join('dist', 'index.html')]);
    expect(missingFiles('A', () => true)).toEqual([]);
  });

  it('finds the committed old-data fixtures by version', () => {
    expect(fixtureVersions()).toContain('v0.3.0');
    expect(fixtureVersions('E:/no/such/folder')).toEqual([]);
  });

  it('accepts a fixture bootstrap that holds everything, and names each thing that went missing', () => {
    expect(checkFixtureBootstrap(whole)).toEqual([]);
    expect(checkFixtureBootstrap({ ...whole, boards: [{ name: 'Portraits' }] })).toEqual(['boards ["Portraits"]']);
    expect(checkFixtureBootstrap({ ...whole, images: [{ starred: false }] })).toEqual(['1 pictures, not 3', 'no starred picture']);
    expect(checkFixtureBootstrap({ ...whole, workflows: [], models: [{}] })).toEqual(['the workflow is missing', '1 models, not 2']);
    expect(checkFixtureBootstrap({})).toHaveLength(6);
  });
});
