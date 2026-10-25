// The pre-commit type check (tools/typecheck.mjs): which staged paths start it, and where its build info lives.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { checkoutEntry, harnessDistDir } from '../../tools/harness-paths.mjs';
// @ts-expect-error -- plain ESM script without types
import { needsTypecheck } from '../../tools/typecheck.mjs';

describe('needsTypecheck', () => {
  it('starts for any ts, tsx, mts or JSON of the frontend, tests and declarations included', () => {
    for (const p of ['frontend/src/state/ui.ts', 'frontend/src/app/App.tsx', 'frontend/tests/eslint-rules.test.ts', 'frontend/e2e/layout.spec.ts', 'frontend/scripts/eslint-layers.d.mts', 'frontend/src/i18n/locales/ja/app.json', 'frontend/tsconfig.json', 'frontend/package.json', 'frontend/vite.config.ts']) {
      expect(needsTypecheck([p]), p).toBe(true);
    }
  });

  it('does not start for other files of the frontend or files outside it', () => {
    for (const p of ['frontend/src/theme/tokens.css', 'frontend/scripts/manual.mjs', 'tools/affected.mjs', 'docs/architecture/tooling.md', 'backend/src-tauri/tauri.conf.json', 'contract/settings.json', 'xfrontend/a.ts']) {
      expect(needsTypecheck([p]), p).toBe(false);
    }
    expect(needsTypecheck([])).toBe(false);
  });

  it('starts when any one of several paths is an input', () => {
    expect(needsTypecheck(['docs/verification.md', 'frontend/src/state/ui.ts'])).toBe(true);
  });
});

describe('checkoutEntry', () => {
  it('names one folder per checkout under the kind, and the harness build uses it', () => {
    const work = path.join('W', 'work');
    const main = checkoutEntry('tsc', path.join('E', 'novira'), work);
    const tree = checkoutEntry('tsc', path.join('E', 'novira-wt'), work);
    expect(path.dirname(main)).toBe(path.join(work, 'tsc'));
    expect(path.basename(main)).toMatch(/^novira-[0-9a-f]{8}$/);
    expect(tree).not.toBe(main);
    expect(checkoutEntry('tsc', path.join('E', 'NOVIRA'), work).slice(-8)).toBe(main.slice(-8));
    expect(harnessDistDir(path.join('E', 'novira'), work)).toBe(path.join(work, 'e2e-build', path.basename(main)));
  });
});
