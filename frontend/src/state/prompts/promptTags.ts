// Comma separated prompt helpers: tag membership, add / remove, token estimate, recommended text.

const norm = (s: string) => s.trim().toLowerCase();

const splitTags = (prompt: string): string[] =>
  prompt
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const hasTag = (prompt: string, tag: string): boolean => splitTags(prompt).some((x) => norm(x) === norm(tag));

export function addTag(prompt: string, tag: string): string {
  if (hasTag(prompt, tag) || !tag.trim()) return prompt;
  const tags = splitTags(prompt);
  return [...tags, tag.trim()].join(', ');
}

export function removeTag(prompt: string, tag: string): string {
  return splitTags(prompt)
    .filter((x) => norm(x) !== norm(tag))
    .join(', ');
}

/** Rough CLIP token count: words and punctuation marks. */
export const estimateTokens = (prompt: string): number => prompt.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g)?.length ?? 0;

export const CLIP_TOKEN_LIMIT = 77;

/** Puts the tags not present yet in front of the prompt. */
export function withTagsFirst(prompt: string, tags: string): string {
  const missing = splitTags(tags).filter((tag) => !hasTag(prompt, tag));
  return [...missing, ...splitTags(prompt)].join(', ');
}

/** Appends the tags not present yet to the end of the prompt. */
export function withTagsLast(prompt: string, tags: string): string {
  return splitTags(tags).reduce((acc, tag) => addTag(acc, tag), prompt);
}

/** One entry of a prompt as the tag view shows it: the words and the strength they are written with (1 when plain). */
export interface WeightedTag {
  text: string;
  weight: number;
}

export const MIN_TAG_WEIGHT = 0;
export const MAX_TAG_WEIGHT = 2;

/** Splits at the commas outside (), [] and {} so `(a, b:1.2)` and `{x|y, z}` stay one entry. */
function splitTopLevel(prompt: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of prompt) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts.map((s) => s.trim()).filter(Boolean);
}

const WEIGHTED = /^\(([\s\S]+):(\d+(?:\.\d+)?)\)$/;

/** The entries of a prompt, each with its `(words:1.2)` strength. */
export function parseWeightedTags(prompt: string): WeightedTag[] {
  return splitTopLevel(prompt).map((raw) => {
    const m = WEIGHTED.exec(raw);
    return m ? { text: m[1]!.trim(), weight: Number(m[2]) } : { text: raw, weight: 1 };
  });
}

const roundWeight = (w: number): number => Math.round(Math.min(MAX_TAG_WEIGHT, Math.max(MIN_TAG_WEIGHT, w)) * 100) / 100;

export function formatWeightedTag({ text, weight }: WeightedTag): string {
  const w = roundWeight(weight);
  return w === 1 ? text : `(${text}:${w})`;
}

/** Writes the entries back as a comma separated prompt. */
export const joinWeightedTags = (tags: WeightedTag[]): string => tags.map(formatWeightedTag).join(', ');

/** Sets the strength of the entry at `index`; 1 writes it back as plain words. */
export function setTagWeightAt(prompt: string, index: number, weight: number): string {
  const tags = parseWeightedTags(prompt);
  if (!tags[index]) return prompt;
  tags[index] = { ...tags[index], weight };
  return joinWeightedTags(tags);
}

export function removeTagAt(prompt: string, index: number): string {
  return joinWeightedTags(parseWeightedTags(prompt).filter((_, i) => i !== index));
}
