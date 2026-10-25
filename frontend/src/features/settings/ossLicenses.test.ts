// The open-source list the About dialog shows must match the license notices (THIRD_PARTY_NOTICES.txt).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import oss from './ossLicenses.json';

const notices = readFileSync(new URL('../../../../THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8');
const license = readFileSync(new URL('../../../../LICENSE', import.meta.url), 'utf8');
const shipped = [...oss.frontend, ...oss.backend];

describe('open-source list', () => {
  it('names a real license for every package, written as an SPDX expression', () => {
    for (const e of shipped) {
      expect(e.license, `${e.name}`).not.toBe('UNKNOWN');
      expect(e.license, `${e.name}`).not.toMatch(/\//);
      expect(e.license, `${e.name}`).not.toBe('see license file');
    }
  });

  it('has the license text of every package in THIRD_PARTY_NOTICES.txt', () => {
    for (const e of shipped) {
      expect(notices, `${e.name} ${e.version}`).toContain(`- ${e.name} ${e.version} (`);
    }
  });

  it('ships novira under the Apache License 2.0, in full', () => {
    expect(license).toContain('Apache License');
    expect(license).toContain('Version 2.0, January 2004');
    expect(license).toContain('limitations under the License.');
  });
});
