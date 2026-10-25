// The browser mock's module, a chunk of its own: only a plain browser loads it (index.ts). Vitest swaps this file for
// mockModule.testkit.ts (vitest.config.ts), which has the mock at once, so tests read `backend` without waiting.
export type MockModule = typeof import('./mock/MockBackend');

export function mockModule(): Promise<MockModule> | MockModule {
  return import('./mock/MockBackend');
}
