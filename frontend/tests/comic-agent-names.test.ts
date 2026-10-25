// The comic agent is told operation names in two places (the edit_comic description and the comic rules in the backend)
// and the window applies them in a third. A name told but not applied makes the agent send an
// operation that silently does nothing (the agent was once told `makePanels` and `setShapes`, which never existed).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (url: string) => readFileSync(fileURLToPath(new URL(url, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const AGENT = '../../backend/crates/novira-core/src/agent/';

const tools = read(`${AGENT}tools.rs`);
const prompt = read(`${AGENT}prompt.rs`);
const editorSource = read('../src/state/comic/agentEditor.ts');

/** The text of a Rust raw-string constant. */
function rustConst(source: string, name: string): string {
  const start = source.indexOf(`const ${name}: &str = r##"`);
  if (start < 0) throw new Error(`${name} not found`);
  return source.slice(start, source.indexOf('"##;', start));
}

/** The operations edit_comic's description lists: {"op":"<name>" at the start of an item. */
const declared = new Set([...rustConst(tools, 'COMIC_OPS').matchAll(/\{"op":"(\w+)"/g)].map((m) => m[1]!));
/**
 * The operations the window applies: the cases of the page editor, the operations it expands before applying them
 * (`raw.op === 'scene'` becomes several steps).
 */
const applied = new Set(
  [...editorSource.matchAll(/^ {4}case '(\w+)'/gm), ...editorSource.matchAll(/raw\.op === '(\w+)'/g)].map((m) => m[1]!),
);

/** camelCase words the guide may use that are fields of what get_comic_page returns, not operations. */
const FIELDS = new Set(['nonHuman', 'typesetIssues', 'hasReferencePicture', 'poseControl', 'promptStyle']);

describe('the operation names told to the comic agent', () => {
  it('finds the operations at all (the scan is not silently empty)', () => {
    expect(declared.size).toBeGreaterThan(20);
    expect(applied.size).toBeGreaterThan(20);
  });

  it('are all applied by the window: every operation edit_comic lists has a case', () => {
    expect([...declared].filter((op) => !applied.has(op))).toEqual([]);
  });

  it.each(['COMIC_INSTRUCTIONS'])('are real in the rules %s of the prompt', (name) => {
    const rules = rustConst(prompt, name);
    const unknown = [...(rules.match(/\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/g) ?? [])].filter((w) => !applied.has(w) && !FIELDS.has(w));
    expect(unknown).toEqual([]);
  });
});
