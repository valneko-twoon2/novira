// Free-text filter of prompt book entries (tag, meaning, category, note).
import type { PromptBookEntry } from '@/state/prompts/promptBook';

export function matchesEntry(e: PromptBookEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [e.tag, e.meaning, e.category, e.note].some((v) => v.toLowerCase().includes(q));
}
