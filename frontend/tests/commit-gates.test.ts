// Which checks a commit must pass besides the quick ones: the CI jobs rust-format, clippy, lint, diff-backends and e2e-phone,
// each only when a staged file can change its result (scripts/tools/commit-gates.mjs; the hook runs it). The visual regression is
// not among them: it runs in CI (`e2e-visual`).
import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain .mjs tool with no types
import { specOf } from '../../scripts/tools/checks.mjs';
// @ts-expect-error a plain .mjs tool with no types
import { gatesFor } from '../../scripts/tools/commit-gates.mjs';

type Gate = { name: string; check: string };
const names = (paths: string[]): string[] => (gatesFor(paths) as Gate[]).map((g) => g.name);

describe('commit gates', { tags: [] }, () => {
  it(
    'runs nothing for documents only, and the phone layouts for screen text (a longer text moves the layout)',
    { tags: ['decision-table'] },
    () => {
      expect(names(['docs/design/02-generation/01-pictures/05-drafts.md', 'README.md', 'docs/manual/ja/07-media.md'])).toEqual([]);
      expect(names(['frontend/src/i18n/locales/ja/params.json'])).toEqual(['e2e-phone']);
    },
  );

  it('checks the format and clippy when Rust is staged, and compares the backends', { tags: ['equivalence'] }, () => {
    expect(names(['backend/crates/novira-core/src/service/mod.rs'])).toEqual(['rust-format', 'clippy', 'diff-backends']);
    expect(names(['backend/Cargo.lock'])).toEqual(['rust-format', 'clippy', 'diff-backends']);
  });

  it('lints a changed ts, js or css file of the frontend, and runs the phone layouts for a screen', { tags: ['decision-table'] }, () => {
    expect(names(['frontend/src/features/text/RichSection.tsx'])).toEqual(['lint', 'e2e-phone']);
    expect(names(['frontend/src/features/text/text.css'])).toEqual(['lint', 'e2e-phone']);
    expect(names(['frontend/e2e/perf-budget.spec.ts'])).toEqual(['lint']);
  });

  it('compares the backends when the mock or the contract changes', { tags: ['equivalence'] }, () => {
    expect(names(['frontend/src/backend/mock/MockBackend.ts'])).toEqual(['lint', 'diff-backends', 'e2e-phone']);
    expect(names(['contract/samples/x.json'])).toEqual(['diff-backends']);
  });

  it('does not run the visual regression: CI does', { tags: ['condition'] }, () => {
    expect(names(['backend/a.rs', 'frontend/src/a.ts', 'docs/a.md']).includes('visual')).toBe(false);
  });

  it('never runs the three long CI jobs (vitest, cargo test, the Chromium flows)', { tags: ['condition'] }, () => {
    const all = names(['backend/a.rs', 'frontend/src/a.ts', 'contract/a.json', 'frontend/e2e/phone.spec.ts']);
    expect(all.some((n) => /vitest|cargo-test|chromium/.test(n))).toBe(false);
  });

  it('runs the Playwright gate (phone) under the e2e lock', { tags: ['condition'] }, () => {
    const gates = gatesFor(['backend/a.rs', 'frontend/src/a.tsx']) as Gate[];
    expect(gates.filter((g) => specOf(g.check).lock).map((g) => g.name)).toEqual(['e2e-phone']);
    // Every gate runs a check of the tool that sets its folder and environment.
    expect(gates.every((g) => specOf(g.check).cmd.length > 0)).toBe(true);
  });
});
