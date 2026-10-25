// Property tests for the message template renderer: arbitrary templates and arguments never throw, escapes round-trip,
// and known placeholders are substituted exactly. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import { placeholders, renderTemplate, type MessageArgs } from './render';

const argValue = fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.double({ noNaN: false }));
const argName = fc.stringMatching(/^[a-zA-Z0-9_]{1,8}$/);
const args: fc.Arbitrary<MessageArgs> = fc.dictionary(argName, argValue, { maxKeys: 4 });
const escapeBraces = (s: string) => s.replace(/[{}]/g, (c) => c + c);

describe('renderTemplate (properties)', () => {
  it('never throws for an arbitrary template and arbitrary arguments', () => {
    check(
      fc.property(junkText, fc.dictionary(junkText, argValue, { maxKeys: 4 }), (template, a) => {
        expect(typeof renderTemplate(template, a)).toBe('string');
      }),
    );
  });

  it('returns a template without braces unchanged', () => {
    check(fc.property(fc.string({ maxLength: 60 }).filter((s) => !/[{}]/.test(s)), args, (s, a) => renderTemplate(s, a) === s));
  });

  it('turns an escaped literal back into the original text', () => {
    check(fc.property(junkText, args, (s, a) => renderTemplate(escapeBraces(s), a) === s));
  });

  it('substitutes a known placeholder with the String() of its value', () => {
    check(
      fc.property(argName, argValue, fc.string({ maxLength: 10 }).map(escapeBraces), fc.string({ maxLength: 10 }).map(escapeBraces), (name, v, pre, post) => {
        expect(renderTemplate(`${pre}{${name}}${post}`, { [name]: v })).toBe(`${renderTemplate(pre)}${String(v)}${renderTemplate(post)}`);
      }),
    );
  });

  it('keeps an unknown placeholder visible as written', () => {
    check(fc.property(argName.filter((n) => !(n in {})), (name) => renderTemplate(`{${name}}`, { zzzzzzzzzz: 1 }) === `{${name}}`));
  });

  it('lists every placeholder of a template that placeholders() finds, sorted and unique', () => {
    check(
      fc.property(fc.array(argName, { maxLength: 5 }), (names) => {
        const template = names.map((n) => `{${n}}`).join(' ');
        expect(placeholders(template)).toEqual([...new Set(names)].sort());
      }),
    );
  });

  // Regression: a placeholder named like an Object.prototype member stays visible (it used to render native function source text).
  it('does not substitute placeholders named like Object.prototype members', () => {
    for (const name of ['toString', 'constructor', 'hasOwnProperty', 'valueOf']) {
      expect(renderTemplate(`{${name}}`, {})).toBe(`{${name}}`);
    }
  });
});
