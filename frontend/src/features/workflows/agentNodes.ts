// What the AI assistant is told when it looks for nodes of ComfyUI (and of installed extensions) to build a workflow
// with: the best matches for a few words, each with the inputs and outputs it has under the names the editor uses, or
// the groups to browse. The built-in nodes are in `agentNodeTypes` (agentRecipes.ts).
import type { AgentComfyNode, AgentNodeSearch } from '@/backend';
import { allTemplates, type InputTemplate, type NodeTemplate } from './templates';

/** Most nodes one search returns, and the most choices of a list shown for one input. */
export const MAX_MATCHES = 20;
const MAX_CHOICES = 10;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const className = (t: NodeTemplate) => t.type.replace(/^comfy:/, '');
const typeName = (type: string) => type.replace(/^comfy:/, '');

/** One input as the assistant reads it: `name*:type=default (when ...)`; a link is `name<-TYPE`. */
function inputText(i: InputTemplate): string {
  const required = i.required ? '*' : '';
  const when = i.when ? ` (only while ${i.when.map((chain) => chain.map((c) => `${c.field}=${c.is}`).join(' and ')).join(' or ')})` : '';
  if (i.input === 'connection') return `${i.name}${required}<-${typeName(i.type)}`;
  if (i.media) return `${i.name}${required}:gallery-${i.media === 'audio' ? 'sound' : 'video'}-name${when}`;
  if (i.type === 'ImageField') return `${i.name}${required}:gallery-image-name-or-link${when}`;
  if (i.type === 'enum') {
    const options = (i.options ?? []).map((o) => o.slice(0, 60));
    const shown = options.slice(0, MAX_CHOICES).join('|');
    const more = options.length > MAX_CHOICES ? `|...+${options.length - MAX_CHOICES}` : '';
    const dflt = i.default !== undefined && i.default !== null && i.default !== '' ? `=${String(i.default).slice(0, 60)}` : '';
    return `${i.name}${required}:one of [${shown}${more}]${dflt}${when}`;
  }
  const range = i.min !== undefined || i.max !== undefined ? `(${i.min ?? ''}..${i.max ?? ''})` : '';
  const dflt = typeof i.default === 'string' ? (i.default.length <= 40 ? `=${i.default}` : '') : i.default !== undefined && i.default !== null ? `=${String(i.default)}` : '';
  return `${i.name}${required}:${typeName(i.type)}${range}${dflt}${when}`;
}

function detail(t: NodeTemplate): AgentComfyNode {
  return {
    type: t.type,
    title: t.title ?? className(t),
    ...(t.group ? { group: t.group } : {}),
    ...(t.pack ? { pack: t.pack } : {}),
    ...(t.description ? { about: t.description.slice(0, 240) } : {}),
    ...(t.isOutput ? { output: true } : {}),
    inputs: t.inputs.map(inputText),
    outputs: t.outputs.map((o) => `${o.name}:${typeName(o.type)}`),
  };
}

/** How well `t` answers the words: 0 when one of them is nowhere in it. */
function score(t: NodeTemplate, tokens: string[], whole: string): number {
  const cls = className(t).toLowerCase();
  const title = (t.title ?? '').toLowerCase();
  const group = (t.group ?? t.pack ?? '').toLowerCase();
  const tags = t.tags.join(' ');
  const about = (t.description ?? '').toLowerCase();
  let total = cls === whole || title === whole ? 30 : 0;
  for (const token of tokens) {
    const here = (cls.includes(token) ? 6 : 0) + (title.includes(token) ? 5 : 0) + (group.includes(token) ? 3 : 0) + (tags.includes(token) ? 2 : 0) + (about.includes(token) ? 1 : 0);
    if (!here) return 0;
    total += here;
  }
  return total;
}

/**
 * The nodes of ComfyUI and of installed extensions that match `query`, best first (at most `limit`); with no words, the
 * groups the nodes are in and how many each holds. Empty with `ready: false` while ComfyUI has not told the editor
 * which nodes it has.
 */
export function searchComfyNodes(query: string, limit: number): AgentNodeSearch {
  const all = allTemplates().filter((t) => t.type.startsWith('comfy:'));
  if (!all.length) {
    return { ready: false, total: 0, note: 'ComfyUI is not running (or has not reported its nodes yet), so its nodes cannot be listed. Tell the user to start it and ask again.', matches: [] };
  }
  const tokens = words(query);
  if (!tokens.length) {
    const counts = new Map<string, number>();
    for (const t of all) {
      const key = t.group ?? `pack: ${t.pack ?? 'other'}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return { ready: true, total: all.length, groups: [...counts].map(([group, count]) => ({ group, count })).sort((a, b) => a.group.localeCompare(b.group)), matches: [] };
  }
  const whole = tokens.join('');
  const ranked = all
    .map((t) => ({ t, s: score(t, tokens, whole) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.t.type.localeCompare(b.t.type))
    .slice(0, Math.max(1, Math.min(MAX_MATCHES, Math.round(limit))));
  return { ready: true, total: all.length, matches: ranked.map((x) => detail(x.t)) };
}
