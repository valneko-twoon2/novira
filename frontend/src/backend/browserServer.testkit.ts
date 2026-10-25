// For one test, the backend reports itself as the browser server's (`kind: 'http'`), where no native dialog exists.
import { onTestFinished } from 'vitest';
import { backend } from '.';

export function asBrowserServer() {
  const kind = backend.kind;
  Object.defineProperty(backend, 'kind', { value: 'http', configurable: true });
  onTestFinished(() => {
    Object.defineProperty(backend, 'kind', { value: kind, configurable: true });
  });
}
