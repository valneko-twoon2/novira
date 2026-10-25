// Which changed files make tools/affected.mjs name the visual regression (tools/visual-baselines.mjs).
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { isScreenSource } from '../../tools/visual-baselines.mjs';

describe('the files that can change a main screen', () => {
  it('runs for the source that decides what the screens show', () => {
    for (const path of [
      'frontend/src/features/params/ParamControls.tsx',
      'frontend/src/app/app.css',
      'frontend/src/ui/Button.tsx',
      'frontend/src/state/params.ts',
      'frontend/src/i18n/locales/ja/params.json',
      'frontend/src/backend/mock/MockBackend.ts',
      'frontend/index.html',
    ]) {
      expect(isScreenSource(path), path).toBe(true);
    }
  });

  it('does not run for tests, test support, documents, scripts', () => {
    for (const path of [
      'frontend/src/features/params/ParamControls.test.tsx',
      'frontend/src/features/params/labels.property.test.ts',
      'frontend/src/propertyTest.testkit.ts',
      'frontend/src/vite-env.d.ts',
      'frontend/e2e/visual.spec.ts',
      'tools/docs-check.mjs',
      'docs/architecture/README.md',
      'backend/crates/novira-core/src/lib.rs',
    ]) {
      expect(isScreenSource(path), path).toBe(false);
    }
  });
});
