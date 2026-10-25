// Stands in for mockModule.ts in vitest (vitest.config.ts): the mock is imported directly, so `backend` is set when a
// test's modules first read it, and a test's vi.mock of a mock module still applies.
import * as MockModule from './mock/MockBackend';

export function mockModule(): typeof MockModule {
  return MockModule;
}
