// The differential test of the mock and the real backend (frontend/difftest/), run by tools/diff-backends.mjs, which
// starts novira-server and passes its address and token. Not part of `vitest run`: it needs the server.
import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  resolve: base.resolve,
  test: {
    include: ['difftest/**/*.difftest.ts'],
    environment: 'node',
    maxWorkers: 1,
    testTimeout: 20_000,
  },
});
