// Contract tests between `types.ts` and the Rust wire types (`backend/crates/novira-core/src/types.rs` and friends).
//
// Every sample in `contract/samples/` is the TypeScript half of one JSON fixture in `contract/` at the repository
// root; the Rust half is `backend/crates/novira-core/tests/contract/`, which checks each fixture against its Rust
// type. Only this test imports the samples, so they never reach the app bundle.
// - `satisfies Required<T>` makes the sample fill every field, optional ones included, so renaming or removing a field
//   in `types.ts` (or changing an enum literal) breaks `npm run typecheck`.
// - `toStrictEqual` against the fixture makes a changed sample fail until the fixture is updated, which then has to
//   pass the Rust side too.
// - f64 fields use non-integer values: Rust writes `7.0` for an f64 and serde_json compares `7.0` and `7` as different.
//
// Regenerate the fixtures from the samples with `CONTRACT_UPDATE=1 npx vitest run src/backend/contract.test.ts`, then
// run `cargo test -p novira-core --test contract`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAMPLES } from './contract/samples';

const CONTRACT_DIR = fileURLToPath(new URL('../../../contract/', import.meta.url));
const fixturePath = (name: string) => join(CONTRACT_DIR, `${name}.json`);

describe('contract fixtures', () => {
  if (process.env.CONTRACT_UPDATE === '1') {
    for (const [name, sample] of Object.entries(SAMPLES)) {
      writeFileSync(fixturePath(name), `${JSON.stringify(sample, null, 2)}\n`);
    }
  }

  it.each(Object.entries(SAMPLES))('%s.json matches its TypeScript sample', (name, sample) => {
    expect(JSON.parse(readFileSync(fixturePath(name), 'utf8'))).toStrictEqual(sample);
  });

  it('has a TypeScript sample for every fixture file', () => {
    const files = readdirSync(CONTRACT_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length));
    expect(files.sort()).toEqual(Object.keys(SAMPLES).sort());
  });
});
