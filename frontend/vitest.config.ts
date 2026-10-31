import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // The browser mock without its own chunk, so `backend` is set as soon as src/backend/index.ts is (mockModule.ts).
      { find: /^\.\/mockModule$/, replacement: here('src/backend/mockModule.testkit.ts') },
      { find: '@', replacement: here('src') },
    ],
  },
  // The license files live at the repository root and the About dialog imports them as text (`?raw`); see vite.config.ts.
  server: { fs: { allow: [here('..')] } },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
    // Ten workers, not one per core: with coverage on, the heaviest files passed alone and timed out (5 s) in a full run
    // on a 16-core machine (2026-10-29).
    maxWorkers: 10,
    // The icon package's entry imports about 3000 small modules, and each test file loads them again (about 3 s per file,
    // measured 2026-10-13). Bundling it once into a single file took the full run from 201 s to 90 s.
    deps: {
      optimizer: {
        client: { enabled: true, include: ['@phosphor-icons/react'] },
        ssr: { enabled: true, include: ['@phosphor-icons/react'] },
      },
    },
    // Only used by `npm run coverage` (plain `vitest run` does not measure). The floors sit a little below the
    // measured values (2026-10-31: statements 96.3, branches 90.2, functions 95.2, lines 97.6): they stop a drop, not
    // a plateau. Raise them when the numbers rise. Canvas drawing code is tested on a recording 2D context
    // (src/backend/mock/canvas2dRecorder.testkit.ts); the rest of what Playwright covers keeps the totals below 100.
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        // Test support code (the recording canvas context), not app code.
        'src/**/*.testkit.ts',
      ],
      reporter: ['text-summary', 'json-summary', 'html', 'lcovonly'],
      reportsDirectory: '../novira-data/work/coverage/frontend',
      thresholds: { statements: 96, branches: 89.5, functions: 95, lines: 97 },
    },
  },
});
