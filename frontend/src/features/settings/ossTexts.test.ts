// The license text of each package, read out of THIRD_PARTY_NOTICES.txt for the about dialog's open-source list.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import oss from './ossLicenses.json';
import { homepageOf, ossKey, parseOssTexts } from './ossTexts';

const RULE = '-'.repeat(70);

describe('parseOssTexts', () => {
  it('gives every package listed above a text that text, and keeps dashed lines inside the text', () => {
    const notices = [
      'Third-party notices',
      '',
      'License text 1 of 2',
      'Used by:',
      '- a 1.0.0 (npm, MIT) https://github.com/o/a',
      '- b 2.0.0 (crate, MIT) https://github.com/o/b',
      '',
      RULE,
      'MIT text',
      '-----------',
      'end',
      '',
      'License text 2 of 2',
      'Used by:',
      '- b 2.0.0 (crate, Apache-2.0) https://github.com/o/b',
      '',
      RULE,
      'Apache text',
      '',
    ].join('\r\n');
    const texts = parseOssTexts(notices);
    expect(texts.get(ossKey('a', '1.0.0'))).toEqual(['MIT text\r\n-----------\r\nend']);
    expect(texts.get(ossKey('b', '2.0.0'))).toEqual(['MIT text\r\n-----------\r\nend', 'Apache text']);
  });

  it('finds a text for every bundled package in the shipped notices', () => {
    const notices = readFileSync(fileURLToPath(new URL('../../../../THIRD_PARTY_NOTICES.txt', import.meta.url)), 'utf8');
    const texts = parseOssTexts(notices);
    const missing = [...oss.frontend, ...oss.backend].filter((e) => !texts.get(ossKey(e.name, e.version))?.length).map((e) => e.name);
    expect(missing).toEqual([]);
  });
});

describe('homepageOf', () => {
  it('opens a plain http repository link over https and leaves https alone', () => {
    expect(homepageOf('http://github.com/o/r')).toBe('https://github.com/o/r');
    expect(homepageOf('https://gitlab.com/o/r')).toBe('https://gitlab.com/o/r');
  });
});
