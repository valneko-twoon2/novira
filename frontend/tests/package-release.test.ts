// scripts/tools/package-release.mjs: the version, the package name and what goes into the zip.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain .mjs tool without types
import { cargoVersion, ENTRIES, missingEntries, packageName, tagNamesVersion } from '../../scripts/tools/package-release.mjs';

describe('package-release', () => {
  it('reads the workspace version, not a dependency version', () => {
    const toml = '[workspace]\nmembers = []\n\n[workspace.package]\nversion = "0.3.1"\n\n[workspace.dependencies]\nserde = { version = "1" }\n';
    expect(cargoVersion(toml)).toBe('0.3.1');
    expect(cargoVersion('[package]\nversion = "1.0.0"\n')).toBeNull();
  });

  it('names the package after the version', () => {
    expect(packageName('0.2.0-beta.1')).toBe('novira-0.2.0-beta.1-windows-x64');
  });

  it('accepts a tag only when it is v and exactly the version', () => {
    expect(tagNamesVersion('v0.4.0', '0.4.0')).toBe(true);
    expect(tagNamesVersion('v0.4.0-beta.1', '0.4.0-beta.1')).toBe(true);
    for (const tag of ['0.4.0', 'v0.4', 'v0.4.0-beta.1', 'v0.4.00', 'V0.4.0', 'v0.4.0 ', '', undefined, null]) expect(tagNamesVersion(tag, '0.4.0')).toBe(false);
    expect(tagNamesVersion('v', '')).toBe(false);
    expect(tagNamesVersion('v0.4.0', null)).toBe(false);
  });

  it('packs the programs and the licence texts, and never the data folder', () => {
    const names = (ENTRIES as { to: string }[]).map((e) => e.to);
    expect(names).toEqual(['novira.exe', 'novira-server.exe', 'dist', 'server.bat', 'LICENSE', 'THIRD_PARTY_NOTICES.txt']);
    expect(names.some((n) => n.includes('novira-data'))).toBe(false);
    expect((ENTRIES as { from: string }[]).some((e) => /novira-data/.test(e.from))).toBe(false);
  });

  it('names what is missing', () => {
    expect(missingEntries(ENTRIES, () => true)).toEqual([]);
    expect(missingEntries(ENTRIES, (p: string) => !/server\.bat$|novira-server\.exe$/.test(p))).toEqual(['novira-server.exe', 'server.bat']);
  });
});
