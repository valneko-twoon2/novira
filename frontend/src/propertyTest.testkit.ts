// Shared setup for the property-based and fuzz-style tests (`*.property.test.ts(x)`, fast-check).
//
// Rules every such test follows:
//   - In-process only. Generated data goes to pure functions, stores and the in-memory mock backend, never to a
//     network or an external service. `blockExternalNetwork()` makes any `fetch` throw (loopback included).
//   - A fixed number of runs and a fixed seed, so a run on CI is the same run as on a developer's machine. A failure
//     prints fast-check's report (seed, path, shrunk counterexample); rerun it with the same seed to reproduce.
//   - Override from the environment while investigating: `NOVIRA_PBT_RUNS=2000 NOVIRA_PBT_SEED=1234 npx vitest run <file>`.
import fc from 'fast-check';
import { afterEach, beforeEach, vi } from 'vitest';

const fromEnv = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] !== undefined && process.env[name] !== '' ? n : fallback;
};

/** Runs per property (default 150; a few seconds for the whole suite). */
export const NUM_RUNS = fromEnv('NOVIRA_PBT_RUNS', 150);
/** Committed seed: the same inputs on every machine unless overridden. */
export const SEED = fromEnv('NOVIRA_PBT_SEED', 20261007);

/** Parameters for `fc.assert`. `runs` scales the default for properties that are expensive per run. */
export function pbt(runs = NUM_RUNS): fc.Parameters<unknown> {
  return { numRuns: Math.max(1, runs), seed: SEED, verbose: 0 };
}

/** Assert a property with the committed seed and run count. */
export function check<Ts extends unknown[]>(property: fc.IPropertyWithHooks<Ts>, runs = NUM_RUNS): void {
  fc.assert(property, pbt(runs) as fc.Parameters<Ts>);
}

/** Network calls attempted while a test ran (cleared by `blockExternalNetwork`'s hooks). */
export const attemptedFetches: string[] = [];

/**
 * Install (per test) a `fetch` that throws for every URL (loopback included) and records the attempt. A test that
 * reaches it fails loudly instead of sending generated data anywhere.
 */
export function blockExternalNetwork(): void {
  beforeEach(() => {
    attemptedFetches.length = 0;
    vi.stubGlobal('fetch', (input: unknown) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String((input as { url?: string })?.url ?? input);
      attemptedFetches.push(url);
      throw new Error(`property test tried to call fetch: ${url}`);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}

/** Text that stresses parsers: free text, control characters, braces, unicode, very long runs. */
export const junkText: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 60 }),
  fc.string({ unit: 'binary', maxLength: 60 }),
  fc.stringMatching(/^[{}[\]|,;:"'\\<>_ \t\r\n$#*/-]{0,40}$/),
  fc.constantFrom('', ' ', '\u0000', '\ud800', '__proto__', 'constructor', '{', '}', '{{', '}}', '{a', '{}', '{a}{b}', '\r\n'),
);

/** Any JSON value, including shapes an app never writes (what `localStorage` can hold after a manual edit). */
export const junkJson: fc.Arbitrary<unknown> = fc.jsonValue({ maxDepth: 3 });

/** A raw string that may or may not be valid JSON of any shape. */
export const junkStored: fc.Arbitrary<string> = fc.oneof(
  junkText,
  junkJson.map((v) => JSON.stringify(v)),
  junkJson.map((v) => JSON.stringify(v).slice(0, -1)),
);

/** A `Storage` kept in memory, for stores that persist (the node test environment has no `localStorage`). */
export function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

/** Install a fresh in-memory `localStorage` before each test and remove it afterwards. */
export function installMemoryLocalStorage(): void {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}
