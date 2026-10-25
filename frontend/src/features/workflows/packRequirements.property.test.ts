// Fuzz tests for reading which node packs a workflow file needs: arbitrary content never throws and a result is either
// null or a list of pack-only types. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkJson, junkStored, blockExternalNetwork } from '@/propertyTest.testkit';
import { missingPacks } from './packRequirements';

blockExternalNetwork();

describe('missingPacks (fuzz)', () => {
  it('never throws for any text or JSON and gives null or only comfy: types', () => {
    check(
      fc.property(fc.oneof(junkStored, junkJson), (raw) => {
        const r = missingPacks(raw);
        if (r === null) return;
        expect(r.types.length).toBeGreaterThan(0);
        expect(r.types.every((t) => t.startsWith('comfy:'))).toBe(true);
        expect(r.packs.every((p) => typeof p.folder === 'string' && (p.url === null || typeof p.url === 'string'))).toBe(true);
      }),
    );
  });

  it('reports the unknown pack node types of a file and the packs it declares', () => {
    check(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[A-Za-z0-9_]{1,8}$/), { minLength: 1, maxLength: 4 }), fc.array(fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/), { maxLength: 3 }), (names, folders) => {
        const file = { nodes: names.map((n) => ({ data: { type: `comfy:unknown-${n}` } })), packs: folders.map((folder) => ({ folder })) };
        const r = missingPacks(file)!;
        expect(r.types).toEqual(names.map((n) => `comfy:unknown-${n}`));
        expect(r.packs.map((p) => p.folder)).toEqual(folders);
      }),
    );
  });
});
