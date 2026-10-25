// The license text of each package, read out of THIRD_PARTY_NOTICES.txt (written by frontend/scripts/oss-licenses.mjs):
// each text is printed once under "License text N of M", after the list of the packages that carry it.

/** The key a package is found by: its name and version. */
export const ossKey = (name: string, version: string) => `${name}@${version}`;

const HEADER = /^License text \d+ of \d+\r?\nUsed by:\r?\n/m;
const MEMBER = /^- (\S+) (\S+) \(/;
const RULE = /\r?\n-{70}\r?\n/;

/** Every package's license texts by `ossKey`; a package with more than one text (a license and a notice) gets them all. */
export function parseOssTexts(notices: string): Map<string, string[]> {
  const texts = new Map<string, string[]>();
  for (const block of notices.split(HEADER).slice(1)) {
    const rule = RULE.exec(block);
    if (!rule) continue;
    const body = block.slice(rule.index + rule[0].length).replace(/\s+$/, '');
    for (const line of block.slice(0, rule.index).split(/\r?\n/)) {
      const m = MEMBER.exec(line);
      if (!m) continue;
      const key = ossKey(m[1]!, m[2]!);
      texts.set(key, [...(texts.get(key) ?? []), body]);
    }
  }
  return texts;
}

/** The address to open for a homepage: the generated list has a few plain `http` repository links. */
export function homepageOf(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}
