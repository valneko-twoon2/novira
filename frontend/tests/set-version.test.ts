// tools/set-version.mjs: what counts as a version, and the three files it rewrites.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain .mjs tool without types
import { isVersion, withCargoVersion, withPackageVersion } from '../../tools/set-version.mjs';

describe('set-version', () => {
  it('takes a version both Cargo and npm accept', () => {
    for (const ok of ['0.1.0', '1.20.3', '0.2.0-beta.1', '1.0.0-rc-1']) expect(isVersion(ok), ok).toBe(true);
    for (const bad of ['', '1', '1.2', '01.2.3', '1.2.3.4', 'v1.2.3', '1.2.3-', '1.2.3+build', '1.2.3-beta..1', 'a.b.c', ' 1.2.3'])
      expect(isVersion(bad), bad).toBe(false);
  });

  it('replaces only the workspace version of Cargo.toml', () => {
    const toml = '[workspace]\nmembers = []\n\n[workspace.package]\n# note\nversion = "0.1.0"\n\n[workspace.dependencies]\nserde = { version = "1" }\n';
    const out = withCargoVersion(toml, '0.2.0');
    expect(out.before).toBe('0.1.0');
    expect(out.text).toBe(toml.replace('version = "0.1.0"', 'version = "0.2.0"'));
    expect(() => withCargoVersion('[package]\nversion = "1.0.0"\n', '0.2.0')).toThrow();
  });

  it('replaces the app version of package.json and package-lock.json, not the dependencies', () => {
    const lock = '{\n  "name": "x",\n  "version": "0.1.0",\n  "packages": {\n    "": {\n      "version": "0.1.0"\n    },\n    "node_modules/a": {\n      "version": "7.1.3"\n    }\n  }\n}\n';
    const out = JSON.parse(withPackageVersion(lock, '0.2.0-beta.1'));
    expect(out.version).toBe('0.2.0-beta.1');
    expect(out.packages[''].version).toBe('0.2.0-beta.1');
    expect(out.packages['node_modules/a'].version).toBe('7.1.3');
    expect(withPackageVersion(lock, '0.1.0')).toBe(lock);
  });

  it('finds the real files in their expected shape', () => {
    const root = new URL('../../', import.meta.url);
    const cargo = readFileSync(new URL('backend/Cargo.toml', root), 'utf8');
    const pkg = readFileSync(new URL('frontend/package.json', root), 'utf8');
    const lock = readFileSync(new URL('frontend/package-lock.json', root), 'utf8');
    const { before } = withCargoVersion(cargo, '9.9.9');
    // Writing the version it already has changes nothing, so the formatting of both JSON files survives a rewrite.
    expect(withPackageVersion(pkg, JSON.parse(pkg).version)).toBe(pkg);
    expect(withPackageVersion(lock, JSON.parse(lock).version)).toBe(lock);
    expect(JSON.parse(pkg).version).toBe(before);
  });
});
