// The differential corpus of the wire contract: seeded variants of the samples in `contract/`, valid and damaged, one
// file per wire type (`contract/corpus/<fixture>.jsonl`, one case per line).
//
// Why one generated file: the Rust test (`backend/crates/novira-core/tests/contract/corpus.rs`) and the TypeScript test
// (`frontend/src/backend/contractCorpus.test.ts`) must read the very same inputs. This script is the only generator, so
// the two sides cannot drift. The verdict of each case (accepted or refused, and the value written back) is produced by
// Rust (`CONTRACT_CORPUS_UPDATE=1`) and checked by both sides: Rust re-derives it, TypeScript compares its own verdict
// from `types.ts` with it.
//
// Usage, from the repository root:
//   node contract/corpus/generate.mjs                    rewrite contract/corpus/ (cases, then Rust's verdicts)
//   node contract/corpus/generate.mjs --cases-only       rewrite the cases only (no cargo)
//   node contract/corpus/generate.mjs --cases 400 --seed 7 --out novira-data/work/contract-corpus
//       a deeper one-off corpus in another folder; run it with NOVIRA_CONTRACT_CORPUS_DIR=<that folder> set for
//       `cargo test -p novira-core --test contract corpus` and `npx vitest run src/backend/contractCorpus.test.ts`
// Changing a mutation here changes the corpus: rewrite it and read the `git diff contract/corpus`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { harnessRoots } from '../../scripts/tools/harness-paths.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_SEED = 20261107;
export const DEFAULT_CASES = 40;

/** The fixtures that are a value of one type the Rust side can read (the wire types that cross toward Rust). */
export const FIXTURES = [
  'generation-metadata',
  'enqueue-request',
  'queue-item',
  'retry-size',
  'progress-event',
  'image-dto',
  'board-dto',
  'board-patch',
  'image-patch',
  'image-options',
  'model-config',
  'starter-model',
  'model-parts-report',
  'model-install-job',
  'saved-workflow',
  'comic-record',
  'face-rig-preview-request',
  'engine-settings-patch',
  'agent-endpoint-input',
  'civitai-search-params',
];

// splitmix64-style mixing into a 32-bit seed, then mulberry32: every seed and fixture name gives a different stream.
function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const pointer = (path) => path.map((k) => `/${String(k).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('') || '/';

/** Every path in `value` (the root included), as arrays of keys. */
function paths(value, here = [], out = []) {
  out.push(here);
  if (Array.isArray(value)) value.forEach((v, i) => paths(v, [...here, i], out));
  else if (isObj(value)) for (const [k, v] of Object.entries(value)) paths(v, [...here, k], out);
  return out;
}
const at = (root, p) => p.reduce((v, k) => v[k], root);

/** The string lists of `contract/enums.json` and `share-enums.json`: a string found in one is an enum literal. */
function enumLists(contractDir) {
  const lists = [];
  for (const name of ['enums.json', 'share-enums.json']) {
    const file = path.join(contractDir, name);
    if (!fs.existsSync(file)) continue;
    for (const list of Object.values(JSON.parse(fs.readFileSync(file, 'utf8')))) {
      if (Array.isArray(list) && list.every((x) => typeof x === 'string')) lists.push(list);
    }
  }
  return lists;
}

const WRONG = {
  string: [42, true, [], {}],
  number: ['1', true, [], {}],
  boolean: ['true', 1, 0, []],
  array: [{}, 'x', 1],
  object: [[], 'x', 1],
};
const kindOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/**
 * One mutation of `root` at path `p`: `[name, damaged, apply]`, or `undefined` when this kind does not fit the value.
 * `damaged` is the intent; the verdict of a case always comes from Rust, not from this label.
 */
function mutations(root, p, rnd, lists) {
  const v = at(root, p);
  const key = p[p.length - 1];
  const set = (r, value) => {
    if (p.length === 0) return value;
    at(r, p.slice(0, -1))[key] = value;
    return r;
  };
  const all = [];
  if (p.length) {
    all.push(['drop', false, (r) => {
      const par = at(r, p.slice(0, -1));
      if (Array.isArray(par)) par.splice(key, 1);
      else delete par[key];
      return r;
    }]);
    all.push(['null', true, (r) => set(r, null)]);
  }
  const wrong = WRONG[kindOf(v)];
  if (wrong) all.push(['wrong-type', true, (r) => set(r, clone(wrong[Math.floor(rnd() * wrong.length)]))]);
  if (typeof v === 'string') {
    const list = lists.find((l) => l.includes(v));
    if (list && list.length > 1) {
      all.push(['enum-swap', false, (r) => set(r, list.filter((x) => x !== v)[Math.floor(rnd() * (list.length - 1))])]);
    }
    all.push(['enum-unknown', true, (r) => set(r, 'zz-unknown')]);
    all.push(['empty-string', false, (r) => set(r, '')]);
  }
  if (typeof v === 'number') {
    all.push(['number-shift', false, (r) => set(r, Number.isInteger(v) ? v + 1 : v + 0.25)]);
    all.push(['number-zero', false, (r) => set(r, 0)]);
    const bad = [-1, 4294967296, 1e30, 0.5, -0.5];
    all.push(['out-of-range', true, (r) => set(r, bad[Math.floor(rnd() * bad.length)])]);
  }
  if (typeof v === 'boolean') all.push(['bool-flip', false, (r) => set(r, !v)]);
  if (Array.isArray(v) && v.length) all.push(['empty-array', false, (r) => set(r, [])]);
  if (Array.isArray(v) && v.length) all.push(['array-double', false, (r) => set(r, [...v, clone(v[0])])]);
  if (isObj(v)) {
    all.push(['unknown-field', true, (r) => { at(r, p)['zzUnknown'] = 1; return r; }]);
    const keys = Object.keys(v);
    if (keys.length > 2) {
      all.push(['strip-half', false, (r) => {
        const o = at(r, p);
        for (const k of Object.keys(o)) if (rnd() < 0.5) delete o[k];
        return r;
      }]);
    }
  }
  return all;
}

/** The cases of one fixture: the sample itself, then `count - 1` seeded variants with one or two mutations each. */
export function casesFor(fixture, sample, { seed = DEFAULT_SEED, count = DEFAULT_CASES, lists = [] } = {}) {
  const rnd = rng(hash(`${seed}:${fixture}`));
  const out = [{ id: `${fixture}-0`, kind: 'sample', mutations: [], value: clone(sample) }];
  const seen = new Set([JSON.stringify(sample)]);
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    let value = clone(sample);
    const names = [];
    let damaged = false;
    const steps = rnd() < 0.7 ? 1 : 2;
    for (let s = 0; s < steps; s++) {
      const ps = paths(value);
      const p = ps[Math.floor(rnd() * ps.length)];
      const options = mutations(value, p, rnd, lists);
      if (!options.length) continue;
      const [name, bad, apply] = options[Math.floor(rnd() * options.length)];
      value = apply(value);
      names.push(`${name} ${pointer(p)}`);
      damaged ||= bad;
    }
    const text = JSON.stringify(value);
    if (!names.length || seen.has(text)) continue;
    seen.add(text);
    out.push({ id: `${fixture}-${out.length}`, kind: damaged ? 'damaged' : 'valid', mutations: names, value });
  }
  return out;
}

/** All corpus files as `{ fixture: [case] }`, built from the samples in `contractDir`. */
export function generate(contractDir = path.join(REPO, 'contract'), options = {}) {
  const lists = enumLists(contractDir);
  const corpus = {};
  for (const fixture of FIXTURES) {
    const sample = JSON.parse(fs.readFileSync(path.join(contractDir, `${fixture}.json`), 'utf8'));
    corpus[fixture] = casesFor(fixture, sample, { ...options, lists });
  }
  return corpus;
}

export const toLines = (cases) => `${cases.map((c) => JSON.stringify(c)).join('\n')}\n`;

function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i < 0 ? fallback : args[i + 1];
  };
  const known = new Set(['--cases-only', '--cases', '--seed', '--out']);
  for (const a of args.filter((x) => x.startsWith('--'))) if (!known.has(a)) throw new Error(`unknown option ${a}`);
  const out = path.resolve(REPO, opt('--out', 'contract/corpus'));
  const count = Number(opt('--cases', DEFAULT_CASES));
  const seed = Number(opt('--seed', DEFAULT_SEED));
  if (!Number.isInteger(count) || count < 1 || count > 5000 || !Number.isInteger(seed)) throw new Error('bad --cases or --seed');
  const work = harnessRoots(REPO).work;
  const custom = path.relative(path.join(REPO, 'contract', 'corpus'), out) !== '';
  if (custom && !path.resolve(out).startsWith(work + path.sep)) throw new Error('--out must be a folder under the harness work folder (novira-data/work/)');
  fs.mkdirSync(out, { recursive: true });
  for (const [fixture, cases] of Object.entries(generate(path.join(REPO, 'contract'), { seed, count }))) {
    fs.writeFileSync(path.join(out, `${fixture}.jsonl`), toLines(cases));
  }
  console.log(`wrote ${FIXTURES.length} files to ${path.relative(REPO, out)}`);
  if (args.includes('--cases-only')) return;
  const run = spawnSync('cargo', ['test', '-p', 'novira-core', '--test', 'contract', 'corpus'], {
    cwd: path.join(REPO, 'backend'),
    env: { ...process.env, CONTRACT_CORPUS_UPDATE: '1', NOVIRA_CONTRACT_CORPUS_DIR: out },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(run.status ?? 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
