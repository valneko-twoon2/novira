// The smoke test of a release build (scripts/tools/release-smoke.mjs): its options, the files it requires and what an old-data fixture must hold.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { checkFixtureBootstrap, fixtureVersions, missingFiles, parseArgs, portIsExcluded, tailOf } from '../../scripts/tools/release-smoke.mjs';

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

  it('keeps the end of what a program printed, cut to a size', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\r\n');
    expect(tailOf(lines, 3)).toBe('line 38\nline 39\nline 40');
    expect(tailOf('  only  \n')).toBe('only');
    expect(tailOf('x'.repeat(5000), 15, 100)).toBe('x'.repeat(100));
    expect(tailOf(undefined)).toBe('');
    expect(tailOf('')).toBe('');
  });

  it('says whether a port lies in a range Windows keeps for itself', () => {
    const netsh = ['', 'Protocol tcp Port Exclusion Ranges', '', 'Start Port    End Port', '----------    --------', '      1234        1333', '      9300        9399     *', '', '* - Administered port exclusions.'].join('\r\n');
    expect(portIsExcluded(netsh, 9334)).toBe(true);
    expect(portIsExcluded(netsh, 9300)).toBe(true);
    expect(portIsExcluded(netsh, 9399)).toBe(true);
    expect(portIsExcluded(netsh, 9400)).toBe(false);
    expect(portIsExcluded(netsh, 1233)).toBe(false);
    expect(portIsExcluded('', 9334)).toBe(false);
    expect(portIsExcluded(undefined, 9334)).toBe(false);
    expect(portIsExcluded('no ranges here', 9334)).toBe(false);
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
