// The license notices (scripts/oss-licenses.mjs, run by the pre-commit hook): package addresses and license forms are
// cleaned, every download has its entry, and shipped content that was removed takes its notice with it.
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { cleanUrl, downloadProblems, includedProblem, spdx } from '../scripts/oss-licenses.mjs';

describe('package metadata', () => {
  it('turns a repository field into a plain https address, and drops what is not one', () => {
    expect(cleanUrl('git+https://github.com/a/b.git')).toBe('https://github.com/a/b');
    expect(cleanUrl('git://github.com/a/b.git')).toBe('https://github.com/a/b');
    expect(cleanUrl({ type: 'git', url: 'github:a/b' })).toBe('https://github.com/a/b');
    expect(cleanUrl('a/b')).toBe('https://github.com/a/b');
    expect(cleanUrl('ssh://git@host/x')).toBe('');
    expect(cleanUrl(undefined)).toBe('');
  });

  it('writes "either" licenses in the SPDX form and leaves an SPDX expression alone', () => {
    expect(spdx('MIT/Apache-2.0')).toBe('MIT OR Apache-2.0');
    expect(spdx(' MIT / Apache-2.0 ')).toBe('MIT OR Apache-2.0');
    expect(spdx('(MIT OR Apache-2.0) AND Unicode-3.0')).toBe('(MIT OR Apache-2.0) AND Unicode-3.0');
  });
});

describe('downloads', () => {
  const entry = { name: 'ComfyUI', license: 'GPL-3.0', url: 'https://example.com', covers: ['comfyui.7z'] };

  it('passes when every downloaded file is covered by a complete entry', () => {
    expect(downloadProblems([entry], ['comfyui.7z', 'comfyui.7z'])).toEqual([]);
  });

  it('names an entry without a license and a downloaded file no entry covers', () => {
    const problems = downloadProblems([entry, { name: 'x', url: 'https://x' }], ['comfyui.7z', 'onnxruntime.dll']).join('\n');
    expect(problems).toContain('lacks name, license or url');
    expect(problems).toContain('onnxruntime.dll');
  });
});

describe('content shipped without being a package', () => {
  const entry = { name: 'Lettering', text: 'included-sfx-lettering.txt', usedIn: ['frontend/src/assets/onomatopoeia/'] };
  const all = () => true;

  it('passes when the license text and every place it is used in exist', () => {
    expect(includedProblem(entry, all)).toBeNull();
  });

  it('fails when a place it is used in is gone, when it names none, or when its license text is missing', () => {
    expect(includedProblem(entry, (p: string) => !p.startsWith('frontend/src/assets'))).toMatch(/is used in frontend\/src\/assets\/onomatopoeia\/, which does not exist/);
    expect(includedProblem({ ...entry, usedIn: [] }, all)).toMatch(/names no place it is used in/);
    expect(includedProblem(entry, (p: string) => !p.includes('oss-texts'))).toMatch(/names a license text that is not in scripts\/oss-texts/);
  });
});
