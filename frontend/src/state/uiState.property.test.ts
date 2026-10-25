// Property and fuzz tests for the saved screen state (backup / restore): collect and apply round-trip, and applying
// arbitrary text either fails without touching the storage or writes only the app's own text keys. In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkJson, junkStored, memoryStorage, blockExternalNetwork } from '@/propertyTest.testkit';
import { applyUiState, collectUiState, PERSIST_PREFIX, persistedKeys } from './uiState';

blockExternalNetwork();

const key = fc.oneof(fc.stringMatching(/^[a-zA-Z.]{1,10}$/).map((k) => `${PERSIST_PREFIX}${k}`), fc.stringMatching(/^[a-zA-Z.]{1,10}$/));
const entries = fc.dictionary(key, fc.string({ maxLength: 30 }), { maxKeys: 8 });
const dump = (s: Storage) => Object.fromEntries(Array.from({ length: s.length }, (_, i) => [s.key(i)!, s.getItem(s.key(i)!)]));

describe('saved screen state (properties)', () => {
  it('collect carries exactly the prefixed keys and apply restores them (round trip)', () => {
    check(
      fc.property(entries, entries, (before, other) => {
        const source = memoryStorage(before);
        const json = collectUiState(source);
        const parsed = JSON.parse(json) as Record<string, string>;
        expect(Object.keys(parsed).every((k) => k.startsWith(PERSIST_PREFIX))).toBe(true);
        const target = memoryStorage(other);
        const written = applyUiState(json, target);
        expect(written).toBe(Object.keys(parsed).length);
        // the prefixed part of the target equals the source's; foreign keys of the target are untouched
        expect(Object.fromEntries(persistedKeys(target).map((k) => [k, target.getItem(k)]))).toEqual(parsed);
        for (const [k, v] of Object.entries(other)) if (!k.startsWith(PERSIST_PREFIX)) expect(target.getItem(k)).toBe(v);
      }),
    );
  });

  it('applyUiState of arbitrary text throws without changing anything, or writes only prefixed text values', () => {
    check(
      fc.property(fc.oneof(junkStored, junkJson.map((v) => JSON.stringify(v))), entries, (text, initial) => {
        const storage = memoryStorage(initial);
        const before = dump(storage);
        let count: number;
        try {
          count = applyUiState(text, storage);
        } catch {
          expect(dump(storage)).toEqual(before);
          return;
        }
        const after = dump(storage);
        const prefixed = Object.keys(after).filter((k) => k.startsWith(PERSIST_PREFIX));
        expect(prefixed.length).toBe(count);
        for (const k of Object.keys(after)) expect(typeof after[k]).toBe('string');
        for (const [k, v] of Object.entries(before)) if (!k.startsWith(PERSIST_PREFIX)) expect(after[k]).toBe(v);
      }),
    );
  });
});
