// scripts/tools/changelog.mjs: the shape of CHANGELOG.md, the notes of one version and the cut of a release.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain .mjs tool without types
import { check, FILE, notes, release, REPO } from '../../scripts/tools/changelog.mjs';

const links = (...versions: string[]) =>
  [
    `[unreleased]: ${REPO}/compare/v${versions[0]}...HEAD`,
    ...versions.map((v, i) => (versions[i + 1] ? `[${v}]: ${REPO}/compare/v${versions[i + 1]}...v${v}` : `[${v}]: ${REPO}/releases/tag/v${v}`)),
  ].join('\n');

const doc = (unreleased: string, rest: string, ...versions: string[]) => `# 変更履歴\n\nはじめに。\n\n## [Unreleased]\n${unreleased}\n${rest}\n${links(...versions)}\n`;

const GOOD = doc('\n### Added\n\n- 新しい機能を追加。\n', '## [0.2.0] - 2026-10-26\n\n### Added\n\n- 何かを追加。\n\n### Fixed\n\n- 何かを直しました。\n\n## [0.1.0] - 2026-10-25\n\n### Added\n\n- 最初の版。\n', '0.2.0', '0.1.0');

describe('changelog', () => {
  it('passes the repository CHANGELOG.md', { tags: ['scenario'] }, () => {
    expect(check(readFileSync(FILE, 'utf8'))).toEqual([]);
  });

  it('passes a file in shape, with CRLF too', { tags: ['condition'] }, () => {
    expect(check(GOOD)).toEqual([]);
    expect(check(GOOD.replace(/\n/g, '\r\n'))).toEqual([]);
  });

  it('refuses a wrong title, a missing introduction or a missing [Unreleased]', { tags: ['error-guessing'] }, () => {
    expect(check(GOOD.replace('# 変更履歴', '# Changelog')).join()).toMatch(/first line/);
    expect(check(GOOD.replace('はじめに。', '')).join()).toMatch(/introduction/);
    expect(check(GOOD.replace('## [Unreleased]\n', '')).join()).toMatch(/Unreleased/);
  });

  it('refuses a type outside Keep a Changelog, types out of order or twice, and a type with no bullet', { tags: ['error-guessing'] }, () => {
    expect(check(GOOD.replace('### Fixed', '### 修正')).join()).toMatch(/not one of/);
    expect(check(GOOD.replace('### Added\n\n- 何かを追加。\n\n### Fixed', '### Fixed\n\n- 何かを追加。\n\n### Added')).join()).toMatch(/out of order/);
    expect(check(GOOD.replace('### Fixed', '### Added')).join()).toMatch(/out of order/);
    expect(check(GOOD.replace('### Fixed\n\n- 何かを直しました。\n', '### Fixed\n')).join()).toMatch(/has no bullet/);
  });

  it('refuses a paragraph, a nested bullet, a bullet before any type and an empty version', { tags: ['error-guessing'] }, () => {
    expect(check(GOOD.replace('- 何かを直しました。', '- 何かを直しました。\n  - 細かい点。')).join()).toMatch(/one-line/);
    expect(check(GOOD.replace('- 何かを直しました。', '何かを直しました。')).join()).toMatch(/one-line/);
    expect(check(GOOD.replace('## [0.1.0] - 2026-10-25\n\n### Added\n', '## [0.1.0] - 2026-10-25\n\n')).join()).toMatch(/before any/);
    expect(check(GOOD.replace('### Added\n\n- 最初の版。\n', '')).join()).toMatch(/at least one bullet/);
  });

  it('allows an empty [Unreleased]', { tags: ['boundary'] }, () => {
    expect(check(GOOD.replace('### Added\n\n- 新しい機能を追加。\n', ''))).toEqual([]);
  });

  it('refuses a bad version, a bad date, versions out of order or twice', { tags: ['error-guessing'] }, () => {
    expect(check(GOOD.replace('## [0.1.0]', '## [0.1]')).join()).toMatch(/x\.y\.z/);
    expect(check(GOOD.replace('2026-10-25', '2026-02-30')).join()).toMatch(/date/);
    expect(check(GOOD.replace('## [0.1.0] - 2026-10-25', '## [0.1.0]')).join()).toMatch(/date/);
    const swapped = doc('', '## [0.1.0] - 2026-10-25\n\n### Added\n\n- a\n\n## [0.2.0] - 2026-10-26\n\n### Added\n\n- b\n', '0.1.0', '0.2.0');
    expect(check(swapped).join()).toMatch(/newest first/);
    const twice = doc('', '## [0.1.0] - 2026-10-25\n\n### Added\n\n- a\n\n## [0.1.0] - 2026-10-25\n\n### Added\n\n- b\n', '0.1.0', '0.1.0');
    expect(check(twice).join()).toMatch(/twice/);
  });

  it('orders a pre-release before its release', { tags: ['condition'] }, () => {
    const pre = doc('', '## [0.2.0] - 2026-10-26\n\n### Added\n\n- a\n\n## [0.2.0-beta.1] - 2026-10-25\n\n### Added\n\n- b\n', '0.2.0', '0.2.0-beta.1');
    expect(check(pre)).toEqual([]);
  });

  it('refuses missing, extra or wrong links', { tags: ['error-guessing'] }, () => {
    expect(check(GOOD.replace(/\[0\.1\.0\]: .*\n/, '')).join()).toMatch(/links/);
    expect(check(GOOD.replace('v0.1.0...v0.2.0', 'v0.0.9...v0.2.0')).join()).toMatch(/links/);
    expect(check(`${GOOD}[extra]: ${REPO}\n`).join()).toMatch(/links/);
  });

  it('gives the body of the tagged version as the notes', { tags: ['condition'] }, () => {
    expect(notes(GOOD, 'v0.2.0')).toBe('### Added\n\n- 何かを追加。\n\n### Fixed\n\n- 何かを直しました。\n');
    expect(notes(GOOD, 'v0.1.0')).toBe('### Added\n\n- 最初の版。\n');
  });

  it('refuses notes for a tag that is not v<version>, a version not written, or an empty section', { tags: ['error-guessing'] }, () => {
    for (const tag of ['0.2.0', 'v0.2', 'V0.2.0', '', undefined]) expect(() => notes(GOOD, tag)).toThrow(/not a tag/);
    expect(() => notes(GOOD, 'v0.3.0')).toThrow(/no "## \[0\.3\.0\]"/);
    expect(() => notes(GOOD, 'vUnreleased')).toThrow(/not a tag/);
  });

  it('cuts a release: [Unreleased] becomes the dated version and the links follow', { tags: ['condition'] }, () => {
    const cut = release(GOOD, '0.3.0', '2026-11-02');
    expect(check(cut)).toEqual([]);
    expect(cut).toContain('## [Unreleased]\n\n## [0.3.0] - 2026-11-02\n\n### Added\n\n- 新しい機能を追加。\n\n## [0.2.0]');
    expect(cut).toContain(`[unreleased]: ${REPO}/compare/v0.3.0...HEAD\n[0.3.0]: ${REPO}/compare/v0.2.0...v0.3.0\n`);
    expect(notes(cut, 'v0.3.0')).toBe('### Added\n\n- 新しい機能を追加。\n');
  });

  it('refuses a release with nothing in [Unreleased], an older version, a bad date or a file out of shape', { tags: ['error-guessing'] }, () => {
    const empty = GOOD.replace('### Added\n\n- 新しい機能を追加。\n', '');
    expect(() => release(empty, '0.3.0', '2026-11-02')).toThrow(/nothing to release/);
    expect(() => release(GOOD, '0.2.0', '2026-11-02')).toThrow(/not newer/);
    expect(() => release(GOOD, '0.3', '2026-11-02')).toThrow(/not a version/);
    expect(() => release(GOOD, '0.3.0', '2026/11/02')).toThrow(/not a date/);
    expect(() => release(GOOD.replace('### Fixed', '### 修正'), '0.3.0', '2026-11-02')).toThrow(/not in shape/);
  });
});
