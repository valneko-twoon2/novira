// The combined coverage report (scripts/tools/coverage-report.mjs): which file of each coverage run it reads, and the
// arguments it gives ReportGenerator.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { pickInputs, reportArgs } from '../../scripts/tools/coverage-report.mjs';

const root = join('C:', 'logs', 'coverage');

describe('coverage report', { tags: [] }, () => {
  it('reads the Cobertura file of a run when there is one, and its lcov file otherwise', { tags: ['condition'] }, () => {
    const present = new Set([join(root, 'frontend', 'cobertura-coverage.xml'), join(root, 'frontend', 'lcov.info'), join(root, 'e2e', 'lcov.info')]);
    const picked = pickInputs(root, (f: string) => present.has(f)) as Array<{ name: string; file: string; sources: string }>;
    expect(picked.map((p) => [p.name, p.file, p.sources])).toEqual([
      ['frontend unit', join(root, 'frontend', 'cobertura-coverage.xml'), 'frontend'],
      ['frontend E2E', join(root, 'e2e', 'lcov.info'), 'frontend'],
    ]);
  });

  it('reads nothing when no run left a file', { tags: ['boundary'] }, () => {
    expect(pickInputs(root, () => false)).toEqual([]);
  });

  it('passes every report, the history and the source folders to ReportGenerator as single arguments', { tags: ['error-guessing'] }, () => {
    const args = reportArgs({ reports: ['a.xml', 'b dir/lcov.info'], target: 'out dir', history: 'hist', sourceDirs: ['frontend', 'backend'], tag: 'abc1234' }) as string[];
    expect(args).toContain('-reports:a.xml;b dir/lcov.info');
    expect(args).toContain('-targetdir:out dir');
    expect(args).toContain('-historydir:hist');
    expect(args).toContain('-sourcedirs:frontend;backend');
    expect(args).toContain('-tag:abc1234');
    expect(args.find((a) => a.startsWith('-reporttypes:'))).toContain('Html');
    expect(args.find((a) => a.startsWith('-filefilters:'))).toContain('-*.css');
  });
});
