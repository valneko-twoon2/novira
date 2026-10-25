// Expansion of {a|b} groups and __wildcards__: every combination, random picks, and the problems that block Invoke.
import { describe, expect, it } from 'vitest';
import { expandPrompt, hasDynamicSyntax, hasProblems, MAX_WILDCARD_DEPTH, randomPrompt, usesWildcards, wildcardProblems } from './dynamicPrompts';

const lists = {
  hair: ['black hair', 'silver hair'],
  mood: ['smile', '{happy|sad} face'],
  look: ['__hair__, __mood__'],
  empty: [],
  loop: ['a __loop2__'],
  loop2: ['b __loop__'],
};

describe('every combination', () => {
  it('expands every combination', () => {
    expect(expandPrompt('a {red|blue} {cat|dog}')).toEqual(['a red cat', 'a red dog', 'a blue cat', 'a blue dog']);
  });

  it('supports nested groups and escapes', () => {
    expect(expandPrompt('{x|{y|z}}')).toEqual(['x', 'y', 'z']);
    expect(expandPrompt('a \\{b|c}')).toEqual(['a {b|c}']);
    expect(expandPrompt('a \\__hair__', undefined, lists)).toEqual(['a __hair__']);
    expect(hasDynamicSyntax('plain prompt')).toBe(false);
  });

  it('caps the number of prompts', () => {
    expect(expandPrompt('{a|b|c} {d|e|f}', 4)).toHaveLength(4);
    expect(expandPrompt('__hair__ __hair__ __hair__ {a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p}', 100, lists)).toHaveLength(100);
  });

  it('uses every entry of a wildcard list, with groups and wildcards inside the entries', () => {
    expect(expandPrompt('a girl, __hair__', undefined, lists)).toEqual(['a girl, black hair', 'a girl, silver hair']);
    expect(expandPrompt('__mood__', undefined, lists)).toEqual(['smile', 'happy face', 'sad face']);
    expect(expandPrompt('__look__', undefined, lists)).toHaveLength(6);
    expect(expandPrompt('{__hair__|bald}', undefined, lists)).toEqual(['black hair', 'silver hair', 'bald']);
  });

  it('reads names with digits, - and _ and leaves other underscores alone', () => {
    const named = { 'time-of-day': ['dusk'], hair_2: ['red hair'] };
    expect(expandPrompt('__time-of-day__, __hair_2__, snake_case and __ alone', undefined, named)).toEqual(['dusk, red hair, snake_case and __ alone']);
    expect(usesWildcards('snake_case __')).toBe(false);
    expect(hasDynamicSyntax('a __hair__')).toBe(true);
  });

  it('leaves a list it cannot use in the text instead of looping', () => {
    expect(expandPrompt('__nope__', undefined, lists)).toEqual(['__nope__']);
    expect(expandPrompt('__empty__', undefined, lists)).toEqual(['__empty__']);
    expect(expandPrompt('__loop__', undefined, lists)).toEqual(['a b __loop__']);
  });
});

describe('problems', () => {
  it('reports unknown and empty lists and loops, each once', () => {
    const p = wildcardProblems('__nope__ __nope__ __empty__ __loop__ __hair__', lists);
    expect(p).toEqual({ unknown: ['nope'], empty: ['empty'], cycles: ['loop'], tooDeep: false });
    expect(hasProblems(p)).toBe(true);
    expect(hasProblems(wildcardProblems('__look__ {a|b}', lists))).toBe(false);
  });

  it('finds problems inside groups and inside other lists', () => {
    expect(wildcardProblems('{a|__nope__}', lists).unknown).toEqual(['nope']);
    expect(wildcardProblems('__x__', { x: ['__y__'], y: ['__x__'] }).cycles).toEqual(['x']);
    expect(wildcardProblems('__x__', { x: ['__x__'] }).cycles).toEqual(['x']);
  });

  it('limits how deep lists may use one another', () => {
    const chain = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`l${i}`, [i + 1 < n ? `__l${i + 1}__` : 'end']]));
    expect(wildcardProblems('__l0__', chain(MAX_WILDCARD_DEPTH)).tooDeep).toBe(false);
    expect(expandPrompt('__l0__', undefined, chain(MAX_WILDCARD_DEPTH))).toEqual(['end']);
    expect(wildcardProblems('__l0__', chain(MAX_WILDCARD_DEPTH + 1)).tooDeep).toBe(true);
  });
});

describe('random', () => {
  it('gives the same prompt for the same seed, and one of the possible prompts', () => {
    const all = expandPrompt('{red|blue} __look__', 1000, lists);
    for (let seed = 0; seed < 50; seed++) {
      const p = randomPrompt('{red|blue} __look__', lists, seed);
      expect(randomPrompt('{red|blue} __look__', lists, seed)).toBe(p);
      expect(all).toContain(p);
    }
  });

  it('spreads over the options across seeds, also for neighbouring seeds', () => {
    const picked = new Set(Array.from({ length: 40 }, (_, i) => randomPrompt('{a|b|c|d}', {}, 1000 + i)));
    expect(picked).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('handles seeds across the whole u32 range and lists it cannot use', () => {
    expect(randomPrompt('{x|y}', {}, 4294967295)).toMatch(/^[xy]$/);
    expect(randomPrompt('__nope__ __loop__', lists, 7)).toBe('__nope__ a b __loop__');
    expect(randomPrompt('plain', lists, 3)).toBe('plain');
  });
});
