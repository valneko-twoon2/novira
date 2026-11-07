// Differential test of the wire contract on damaged and varied input (the half of `contract.test.ts` that the samples
// alone cannot give). `contract/corpus/<fixture>.jsonl` holds seeded variants of each sample, valid and damaged, made by
// `contract/corpus/generate.mjs`; Rust produced the verdict of every case (accepted or refused, and the value it
// writes back; `backend/crates/novira-core/tests/contract/corpus.rs` re-derives it on each run). Here each case is read
// as the type `types.ts` declares, and the two verdicts and written values are compared.
//
// What `types.ts` can say is less than what serde says. The app has no runtime validator, so the check is the type
// system itself, read with the compiler API (`contract/wireValidator.testkit.ts`). It cannot refuse a number that is
// not an integer or out of range, and an unknown key is fine to it. Rust, on the other side, keeps some enums as
// `String`. Every such difference is named in `DESIGNED` with the reason; anything else fails naming the case.
// Null and an absent key are the same value here (Rust writes `None` as null or leaves it out; TypeScript uses `?:`).
// Rewrite the corpus: `node contract/corpus/generate.mjs`; deeper: see its header.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { generate, toLines } from '../../../contract/corpus/generate.mjs';
import { wireValidator } from './contract/wireValidator.testkit';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_DIR = join(REPO, 'contract', 'corpus');
const DIR = process.env.NOVIRA_CONTRACT_CORPUS_DIR || DEFAULT_DIR;

/** A corpus file (the fixture name) and the type of `types.ts` (or the sample helper) that describes it. */
const TS_TYPES: Record<string, string> = {
  'generation-metadata': 'GenerationMetadata',
  'enqueue-request': 'EnqueueRequest',
  'queue-item': 'QueueItem',
  'retry-size': 'RetrySize',
  'progress-event': 'ProgressEvent',
  'image-dto': 'ImageDTO',
  'board-dto': 'BoardDTO',
  'board-patch': 'BoardPatch',
  'image-patch': 'ImagePatch',
  'image-options': 'ImageOptions',
  'model-config': 'ModelConfig',
  'starter-model': 'StarterModel',
  'model-parts-report': 'ModelPartsReport',
  'model-install-job': 'ModelInstallJob',
  'saved-workflow': 'SavedWorkflow',
  'comic-record': 'ComicRecord',
  'face-rig-preview-request': 'FaceRigPreviewRequest',
  'engine-settings-patch': 'EngineSettingsPatch',
  'agent-endpoint-input': 'AgentEndpointInput',
  'civitai-search-params': 'CivitaiSearchParams',
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface Case {
  id: string;
  kind: string;
  mutations: string[];
  value: Json;
  rust?: { accept: boolean; same?: true; out?: Json };
}

const readCases = (name: string): Case[] =>
  readFileSync(join(DIR, `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Case);

/** Null and an absent key are one value, everywhere in the tree. */
function dropNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
  }
  return v;
}

interface Seen {
  fixture: string;
  c: Case;
  /** What each side said: refused, or accepted with the value it writes back (`undefined` when it cannot write). */
  rust: { accept: boolean; out?: unknown };
  ts: { accept: true; out: unknown } | { accept: false; path: string; got: string };
}

/** The JSON pointer a mutation text names (`drop /params/seed` gives `/params/seed`). */
const pointerOf = (mutation: string) => mutation.slice(mutation.indexOf(' ') + 1);
const nameOf = (mutation: string) => mutation.slice(0, mutation.indexOf(' '));
const kinds = (c: Case) => c.mutations.map(nameOf);
/** Whether the mutation changed the value at `path` or an ancestor or descendant of it. */
const touches = (mutation: string, path: string) => {
  const p = pointerOf(mutation) === '/' ? '' : pointerOf(mutation);
  return p === path || path.startsWith(`${p}/`) || p.startsWith(`${path}/`);
};
/** Every leaf of `a` is in `b` with the same value: `b` only has more keys. */
function subset(a: unknown, b: unknown): boolean {
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => subset(x, b[i]));
  if (a !== null && typeof a === 'object') {
    return b !== null && typeof b === 'object' && !Array.isArray(b) && Object.entries(a).every(([k, x]) => subset(x, (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

/**
 * The differences that are designed, each with the reason. A rule gets a case on which the two sides differ and returns
 * true when the difference is explained by the mutation that caused it. Every rule must explain at least one case.
 */
const DESIGNED: { name: string; reason: string; explains: (s: Seen) => boolean }[] = [
  {
    name: 'rust-reads-null-as-none',
    reason: 'Rust reads null as None for an Option field; a TypeScript `x?: T` has no null in it. Rust is the more lenient reader; no TypeScript code sends null there.',
    explains: ({ c, ts, rust }) => rust.accept && !ts.accept && ts.got === 'null' && c.mutations.some((m) => nameOf(m) === 'null' && touches(m, ts.path)),
  },
  {
    name: 'rust-defaults-an-absent-field',
    reason: 'Rust reads an absent Option field, or one with #[serde(default)], as None or the default; TypeScript declares the key required (or the default is written back).',
    explains: ({ c, ts, rust }) => {
      if (!rust.accept) return false;
      const dropped = c.mutations.some((m) => ['drop', 'strip-half'].includes(nameOf(m)));
      if (!dropped) return false;
      if (!ts.accept) return ts.got === 'missing';
      return subset(ts.out, rust.out); // Rust wrote the default back where TypeScript leaves the key out
    },
  },
  {
    name: 'rust-string-where-ts-union',
    reason: 'Rust keeps some enums as String (scheduler, category, site, quality, the settings package; listed in tests/contract/main.rs); TypeScript has the union of literals and refuses any other text.',
    explains: ({ c, ts, rust }) => rust.accept && !ts.accept && ts.got === 'string' && c.mutations.some((m) => ['enum-unknown', 'empty-string', 'enum-swap'].includes(nameOf(m)) && touches(m, ts.path)),
  },
  {
    name: 'rust-keeps-unknown-fields',
    reason: 'GenerationMetadata keeps unknown fields in `extra` (#[serde(flatten)]) so newer frontends round-trip; TypeScript drops what its type does not name.',
    explains: ({ c, ts, rust }) => rust.accept && ts.accept && kinds(c).includes('unknown-field') && subset(ts.out, rust.out),
  },
  {
    // known bug: serde's derived Deserialize reads a JSON array as the struct's fields in order, so `[]` is an empty
    // patch and `["pkg", 30]` is a patch with two fields. Nothing sends an array; the cost is that IPC input that is
    // plainly the wrong shape is accepted. A fix needs a custom Deserialize (or a check of the JSON kind) per type, which
    // is more than one line, so it is reported and left.
    name: 'known-bug-rust-reads-an-array-as-a-struct',
    reason: 'Rust accepts [] (all fields optional) where the type is an object.',
    explains: ({ c, ts, rust }) => rust.accept && !ts.accept && ts.path === '' && ts.got === 'array' && c.mutations.some((m) => nameOf(m) === 'wrong-type' && pointerOf(m) === '/'),
  },
  {
    name: 'ts-has-no-integer-type',
    reason: 'Rust refuses a number outside u32/u64/i64 or with a fraction; the TypeScript type is `number` and cannot say integer or range.',
    explains: ({ c, ts, rust }) => !rust.accept && ts.accept && kinds(c).includes('out-of-range'),
  },
  {
    name: 'ts-ignores-unknown-fields',
    reason: 'EngineSettingsPatch is #[serde(deny_unknown_fields)]; a TypeScript object type accepts extra keys.',
    explains: ({ fixture, c, ts, rust }) => fixture === 'engine-settings-patch' && !rust.accept && ts.accept && kinds(c).includes('unknown-field'),
  },
];

describe('contract corpus: Rust and types.ts on the same input', () => {
  const validator = beforeAllValidator();

  it('has a corpus file for every type this test knows, and no other', () => {
    const files = readdirSync(DIR)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => f.slice(0, -'.jsonl'.length));
    expect(files.sort()).toEqual(Object.keys(TS_TYPES).sort());
  });

  it.runIf(DIR === DEFAULT_DIR)('the committed cases are what the generator makes from the samples now', () => {
    const made = generate(join(REPO, 'contract')) as Record<string, Case[]>;
    for (const [fixture, cases] of Object.entries(made)) {
      const stored = readCases(fixture).map(({ rust: _rust, ...rest }) => rest);
      const fresh = toLines(cases).split('\n').filter(Boolean).map((line: string) => JSON.parse(line));
      expect(stored, `${fixture}.jsonl is stale: run node contract/corpus/generate.mjs`).toEqual(fresh);
    }
  });

  it('every case carries a verdict from Rust', () => {
    for (const fixture of Object.keys(TS_TYPES)) {
      const missing = readCases(fixture).filter((c) => !c.rust).map((c) => c.id);
      expect(missing, `${fixture}: no verdict (run node contract/corpus/generate.mjs)`).toEqual([]);
    }
  });

  it('types.ts and Rust agree on every case, except the designed differences', () => {
    const v = validator();
    const unexplained: string[] = [];
    const used = new Map<string, number>();
    let compared = 0;
    let bothRefuse = 0;
    for (const [fixture, tsType] of Object.entries(TS_TYPES)) {
      for (const c of readCases(fixture)) {
        const r = c.rust!;
        const checked = v.check(tsType, c.value);
        const rustOut = r.same ? c.value : r.out;
        const seen: Seen = {
          fixture,
          c,
          rust: { accept: r.accept, out: rustOut },
          ts: checked.ok ? { accept: true, out: checked.out } : { accept: false, path: checked.path, got: checked.got },
        };
        compared++;
        if (!seen.rust.accept && !seen.ts.accept) {
          bothRefuse++;
          continue;
        }
        const same =
          seen.rust.accept === seen.ts.accept &&
          (seen.rust.out === undefined || (seen.ts.accept && JSON.stringify(sortKeys(dropNulls(seen.rust.out))) === JSON.stringify(sortKeys(dropNulls(seen.ts.out)))));
        if (same) continue;
        const rule = DESIGNED.find((d) => d.explains(seen));
        if (rule) {
          used.set(rule.name, (used.get(rule.name) ?? 0) + 1);
          continue;
        }
        const where = checked.ok ? '' : ` at ${checked.path || "/"}: ${checked.why}`;
        const diff = r.accept && checked.ok ? `; written back differently, first at ${firstDiff(sortKeys(dropNulls(rustOut)), sortKeys(dropNulls(checked.out)))}` : '';
        unexplained.push(`${c.id} [${c.mutations.join(' + ') || 'the sample'}]: Rust ${r.accept ? 'accepts' : 'refuses'}, ${tsType} ${checked.ok ? 'accepts' : 'refuses'}${where}${diff}`);
      }
    }
    expect(unexplained, `${unexplained.length} differences nobody designed`).toEqual([]);
    expect(DESIGNED.filter((d) => !used.has(d.name)).map((d) => d.name), 'rules that explain no case').toEqual([]);
    expect(compared).toBeGreaterThan(300);
    expect(bothRefuse, 'damaged input must be refused by both sides sometimes').toBeGreaterThan(20);
    if (process.env.CONTRACT_CORPUS_REPORT === '1') console.log({ compared, bothRefuse, designed: Object.fromEntries(used) });
  });
});

/** The JSON pointer of the first place where two values differ. */
function firstDiff(a: unknown, b: unknown, at = ''): string {
  if (JSON.stringify(a) === JSON.stringify(b)) return '';
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}/${k}`);
      if (d) return d;
    }
  }
  return `${at || '/'} (Rust ${JSON.stringify(a)?.slice(0, 60)}, types.ts ${JSON.stringify(b)?.slice(0, 60)})`;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sortKeys(x)]));
  }
  return v;
}

/** The compiler program takes a few seconds to build: once for the file. */
function beforeAllValidator() {
  let built: ReturnType<typeof wireValidator> | undefined;
  beforeAll(() => {
    built = wireValidator();
  }, 60_000);
  return () => built!;
}
