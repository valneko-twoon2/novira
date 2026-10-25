// Property tests for the parameter labels in every shipped language: each enum value has a readable label, and the
// optimal size is a usable image side for any model base. In-process only (no network).
import fc from 'fast-check';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SCHEDULERS } from '@/backend';
import { loadLocales, LOCALES, setLocale } from '@/i18n';
import { check, junkText } from '@/propertyTest.testkit';
import type { CoherenceMode, InfillMethod, RefImageMethod } from '@/state/params';
import { coherenceLabel, infillLabel, methodLabel, optimalDimension, SCHEDULER_LABELS } from './labels';

// Every language at hand, so setLocale switches at once inside a property.
beforeAll(() => loadLocales());
afterEach(() => setLocale('ja'));

const METHODS: RefImageMethod[] = ['full', 'style', 'composition', 'style_strong', 'style_precise'];
const COHERENCE: CoherenceMode[] = ['Gaussian Blur', 'Box Blur', 'Staged'];
const INFILL: InfillMethod[] = ['patchmatch', 'lama', 'cv2', 'color', 'tile'];

describe('parameter labels (properties)', () => {
  it('every enum value has a label that is not a raw message key, in every language', () => {
    check(
      fc.property(fc.constantFrom(...LOCALES), (locale) => {
        setLocale(locale);
        const labels = [...METHODS.map(methodLabel), ...COHERENCE.map(coherenceLabel), ...INFILL.map(infillLabel)];
        for (const label of labels) {
          expect(label.trim()).not.toBe('');
          expect(label).not.toMatch(/^[a-z]+(\.[A-Za-z]+)+$/);
          expect(label).not.toMatch(/\{[A-Za-z]+\}/);
        }
        expect(new Set(METHODS.map(methodLabel)).size).toBe(METHODS.length);
      }),
      LOCALES.length * 2,
    );
  });

  it('every scheduler has a name', () => {
    expect(SCHEDULERS.every((s) => SCHEDULER_LABELS[s]?.trim())).toBe(true);
  });

  it('optimalDimension is a positive multiple of 64 for any base text', () => {
    check(fc.property(fc.option(fc.oneof(junkText, fc.constantFrom('sd-1', 'sd-2', 'sdxl', 'flux')), { nil: undefined }), (base) => {
      const d = optimalDimension(base);
      return d > 0 && d % 64 === 0;
    }));
  });
});
