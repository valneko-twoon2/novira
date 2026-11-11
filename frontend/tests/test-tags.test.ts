// The test counter (scripts/tools/test-tags.mjs): how it reads tags in vitest, Playwright and Rust sources, and that the counts in
// docs/tests/README.md are the ones the tool prints now, with no tag outside the vocabulary.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { blankRust, collect, kindOf, parseRust, parseTypescript, problems, render, TAG_NAMES, withSection } from '../../scripts/tools/test-tags.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ts = (source: string) => parseTypescript(source, 'x.test.ts', ROOT) as { line: number; tags: string[]; count: number }[];
const rust = (source: string) => parseRust(source) as { line: number; tags: string[]; count: number }[];

describe('tags in TypeScript sources', { tags: ['equivalence'] }, () => {
  it('reads the tags of a test and the ones of every group around it', () => {
    const found = ts(`
      describe('outer', { tags: ['boundary'] }, () => {
        it('plain', () => {});
        describe('inner', { tags: ['error-guessing'] }, () => {
          it('own', { tags: ['regression'] }, () => {});
        });
      });
    `);
    expect(found.map((t) => t.tags)).toEqual([['boundary'], ['boundary', 'error-guessing', 'regression']]);
  });

  it('counts the rows of an it.each over an inline or constant array, and a run-time table as one', () => {
    const found = ts(`
      const CASES = [1, 2, 3];
      it.each([1, 2])('inline %i', () => {});
      it.each(CASES)('constant %i', () => {});
      it.each(load())('run time', () => {});
      describe.each([1, 2])('group %i', () => { it('inside', () => {}); });
    `);
    expect(found.map((t) => t.count)).toEqual([2, 3, 1, 2]);
  });

  it('reads the modifiers, and skips what is not a test definition', () => {
    const found = ts(`
      it.skip('skipped', () => {});
      it.fails('fails', () => {});
      describe.runIf(true)('conditional', () => { it('inside', () => {}); });
      it.todo('later');
      test.step('a step', () => {});
      beforeEach(() => {});
    `);
    expect(found.map((t) => t.line)).toEqual([2, 3, 4]);
  });

  it('reads the Playwright tag option, with or without the at sign', () => {
    const found = ts(`
      test.describe('screen', { tag: '@e2e' }, () => {
        test('one', { tag: ['@boundary', 'regression'] }, async () => {});
        test('two', async ({ page }) => {});
      });
    `);
    expect(found.map((t) => t.tags)).toEqual([['e2e', 'boundary', 'regression'], ['e2e']]);
  });
});

describe('tags in Rust sources', { tags: ['equivalence'] }, () => {
  it('reads a tag line above a test, above a module, and at the top of a file', () => {
    const found = rust(`//! tags: error-guessing
use x;
// tags: boundary
#[test]
fn a() {}

mod group { // not tagged
    #[test]
    fn b() {}
}

// tags: regression
mod tagged {
    #[test]
    fn c() {}
    #[tokio::test]
    async fn d() {}
}

#[test]
fn after() {}
`);
    expect(found.map((t) => t.tags)).toEqual([['error-guessing', 'boundary'], ['error-guessing'], ['error-guessing', 'regression'], ['error-guessing', 'regression'], ['error-guessing']]);
  });

  it('is not thrown off by braces in strings, comments and char literals', () => {
    const found = rust(`
// tags: boundary
mod tagged {
    const S: &str = "} } }";
    const R: &str = r#"}"#;
    const C: char = '}';
    // } a comment
    #[test]
    fn inside() {}
}
#[test]
fn outside() {}
`);
    expect(found.map((t) => t.tags)).toEqual([['boundary'], []]);
  });

  it('blanks strings and comments without moving a line', () => {
    const src = 'let a = "x\\ny"; // c\nlet b = 1;';
    const out = blankRust(src);
    expect(out.length).toBe(src.length);
    expect(out.split('\n').length).toBe(src.split('\n').length);
  });
});

describe('the kind of a file', { tags: ['equivalence'] }, () => {
  it.each([
    ['frontend/src/state/queue.test.ts', 'unit'],
    ['frontend/src/features/text/TextView.test.tsx', 'component'],
    ['frontend/src/state/queue.property.test.ts', 'property'],
    ['frontend/src/features/batch/batchGraph.snapshot.test.ts', 'snapshot'],
    ['frontend/difftest/backends.difftest.ts', 'differential'],
    ['frontend/e2e/a11yKeyboard.spec.ts', 'accessibility'],
    ['frontend/e2e/visual/screens.spec.ts', 'visual'],
    ['frontend/e2e/generate.spec.ts', 'e2e'],
    ['backend/crates/novira-core/tests/prop_queue.rs', 'property'],
    ['backend/crates/novira-core/tests/civitai_live.rs', 'live'],
    ['backend/crates/novira-core/tests/contract/enums.rs', 'contract'],
    ['backend/crates/novira-core/tests/worker_edge_cases.rs', 'integration'],
    ['backend/crates/novira-core/src/models/install/tests.rs', 'unit'],
  ])('%s is %s', (file, kind) => {
    expect(kindOf(file)).toBe(kind);
  });
});

describe('the counts in docs/tests/README.md', { tags: ['scenario', 'regression'] }, () => {
  const tests = collect(ROOT);

  it('uses only words the tool defines', () => {
    expect(problems(tests)).toEqual([]);
  });

  it('are the ones the tool prints now (node scripts/tools/test-tags.mjs --write)', () => {
    const readme = readFileSync(`${ROOT}/docs/tests/README.md`, 'utf8');
    expect(withSection(readme, render(tests))).toBe(readme);
  });

  it('count every test of every runner, and give each one a kind', () => {
    expect(tests.length).toBeGreaterThan(5000);
    expect(tests.every((t: { kinds: string[] }) => t.kinds.length > 0)).toBe(true);
    expect(TAG_NAMES.length).toBe(new Set(TAG_NAMES).size);
  });
});
