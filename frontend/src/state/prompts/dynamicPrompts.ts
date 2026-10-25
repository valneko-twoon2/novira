// Dynamic prompt syntax: "a {red|blue} {cat|dog}" -> 4 prompts; "__hair__" -> one prompt per entry of the wildcard
// list "hair" (entries may use {a|b} and other wildcards). Nested groups are supported; "\{" and "\_" escape.
// Two modes: every combination (capped), or prompts picked at random, each fixed by a seed.
import { mulberry32 } from '@/backend';
import { WILDCARD_NAME_SOURCE } from '@/state/prompts/wildcards';

export const MAX_DYNAMIC_PROMPTS = 100;
/** How many wildcards may use one another in a chain (`__a__` whose entries use `__b__` is a chain of two). */
export const MAX_WILDCARD_DEPTH = 6;

/** Entries of each wildcard list by name. */
export type WildcardLists = Readonly<Record<string, readonly string[]>>;

type Part = string | { group: Part[][] } | { wildcard: string };

const WILDCARD_AT = new RegExp(`^__(${WILDCARD_NAME_SOURCE})__`, 'u');

function parse(src: string, pos: { i: number }, inGroup: boolean): Part[][] {
  const options: Part[][] = [[]];
  let text = '';
  const flush = () => {
    if (text) options[options.length - 1]!.push(text);
    text = '';
  };
  while (pos.i < src.length) {
    const ch = src[pos.i]!;
    if (ch === '\\' && pos.i + 1 < src.length) {
      text += src[pos.i + 1];
      pos.i += 2;
      continue;
    }
    if (ch === '_' && src[pos.i + 1] === '_') {
      const m = WILDCARD_AT.exec(src.slice(pos.i));
      if (m) {
        flush();
        options[options.length - 1]!.push({ wildcard: m[1]! });
        pos.i += m[0].length;
        continue;
      }
    }
    if (ch === '{') {
      flush();
      pos.i++;
      options[options.length - 1]!.push({ group: parse(src, pos, true) });
      continue;
    }
    if (inGroup && ch === '}') {
      pos.i++;
      flush();
      return options;
    }
    if (inGroup && ch === '|') {
      flush();
      options.push([]);
      pos.i++;
      continue;
    }
    text += ch;
    pos.i++;
  }
  flush();
  return options;
}

const parseSeq = (src: string): Part[] => parse(src, { i: 0 }, false).flat();
const tidy = (p: string) => p.replace(/\s+/g, ' ').trim();
const literal = (name: string) => `__${name}__`;

/** The wildcard names a sequence uses, in order of appearance. */
function namesIn(seq: Part[], into: string[] = []): string[] {
  for (const part of seq) {
    if (typeof part === 'string') continue;
    if ('wildcard' in part) {
      if (!into.includes(part.wildcard)) into.push(part.wildcard);
    } else part.group.forEach((option) => namesIn(option, into));
  }
  return into;
}

/** What stops a template from expanding: unknown or empty lists, lists that use themselves, chains too long. */
export interface WildcardProblems {
  unknown: string[];
  empty: string[];
  cycles: string[];
  tooDeep: boolean;
}

export function wildcardProblems(template: string, lists: WildcardLists): WildcardProblems {
  const found: WildcardProblems = { unknown: [], empty: [], cycles: [], tooDeep: false };
  const add = (into: string[], name: string) => {
    if (!into.includes(name)) into.push(name);
  };
  // Depth-first over the lists: a list met again while it is still open is a cycle; `depth` is the longest chain.
  const open = new Set<string>();
  const depth = new Map<string, number>();
  const visit = (name: string): number => {
    const entries = lists[name];
    if (!entries) {
      add(found.unknown, name);
      return 1;
    }
    if (open.has(name)) {
      add(found.cycles, name);
      return 0;
    }
    const known = depth.get(name);
    if (known !== undefined) return known;
    if (!entries.length) add(found.empty, name);
    open.add(name);
    const used = namesIn(entries.flatMap((e) => parseSeq(e)));
    const d = 1 + Math.max(0, ...used.map(visit));
    open.delete(name);
    depth.set(name, d);
    return d;
  };
  for (const name of namesIn(parseSeq(template))) if (visit(name) > MAX_WILDCARD_DEPTH) found.tooDeep = true;
  return found;
}

export function hasProblems(p: WildcardProblems): boolean {
  return p.unknown.length > 0 || p.empty.length > 0 || p.cycles.length > 0 || p.tooDeep;
}

/** Whether a wildcard cannot be used where it stands (the problems above), so it is left in the text as written. */
function unusable(name: string, lists: WildcardLists, stack: string[]): boolean {
  return !lists[name]?.length || stack.includes(name) || stack.length >= MAX_WILDCARD_DEPTH;
}

// Every combination ---------------------------------------------------------

function expandSeq(seq: Part[], limit: number, lists: WildcardLists, stack: string[]): string[] {
  let acc = [''];
  for (const part of seq) {
    const alts = expandPart(part, limit, lists, stack);
    const next: string[] = [];
    for (const a of acc) {
      for (const b of alts) {
        next.push(a + b);
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    acc = next;
  }
  return acc;
}

function expandPart(part: Part, limit: number, lists: WildcardLists, stack: string[]): string[] {
  if (typeof part === 'string') return [part];
  if ('group' in part) return expandOptions(part.group, limit, lists, stack);
  if (unusable(part.wildcard, lists, stack)) return [literal(part.wildcard)];
  return expandOptions(
    lists[part.wildcard]!.map((e) => parseSeq(e)),
    limit,
    lists,
    [...stack, part.wildcard],
  );
}

function expandOptions(options: Part[][], limit: number, lists: WildcardLists, stack: string[]): string[] {
  const out: string[] = [];
  for (const seq of options) {
    for (const s of expandSeq(seq, limit, lists, stack)) {
      out.push(s);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** All prompts produced by the template (every combination), de-duplicated and capped. */
export function expandPrompt(template: string, limit = MAX_DYNAMIC_PROMPTS, lists: WildcardLists = {}): string[] {
  return [...new Set(expandSeq(parseSeq(template), limit, lists, []).map(tidy))];
}

// Random --------------------------------------------------------------------

function pickSeq(seq: Part[], lists: WildcardLists, stack: string[], next: () => number): string {
  let out = '';
  for (const part of seq) {
    if (typeof part === 'string') out += part;
    else if ('group' in part) out += pickSeq(part.group[Math.floor(next() * part.group.length)] ?? [], lists, stack, next);
    else if (unusable(part.wildcard, lists, stack)) out += literal(part.wildcard);
    else {
      const entries = lists[part.wildcard]!;
      out += pickSeq(parseSeq(entries[Math.floor(next() * entries.length)]!), lists, [...stack, part.wildcard], next);
    }
  }
  return out;
}

/** One prompt picked at random from the template: every group and wildcard chooses one option. The same template,
 * lists and seed always give the same prompt, so a picture drawn again with its seed gets its prompt again. */
export function randomPrompt(template: string, lists: WildcardLists, seed: number): string {
  // Mixed so neighbouring seeds (a batch is seed, seed + 1, ...) do not start from neighbouring states.
  const next = mulberry32(Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0);
  return tidy(pickSeq(parseSeq(template), lists, [], next));
}

/** Whether the template uses {a|b} groups or __wildcards__ (a plain prompt runs as it is). */
export function hasDynamicSyntax(template: string): boolean {
  return /(^|[^\\])\{[^}]*\|/.test(template) || usesWildcards(template);
}

/** Whether the template names any wildcard. */
export function usesWildcards(template: string): boolean {
  return namesIn(parseSeq(template)).length > 0;
}
