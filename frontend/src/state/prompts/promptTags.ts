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
