// Claude Code SessionStart and SubagentStart hook: puts the entry page of the architecture map (docs/architecture/README.md)
// in front of the main session and of every subagent at its start, as additional context. The built-in Explore and Plan
// subagents do not read AGENTS.md, and an agent that does read it still skipped the map (.claude/rules/architecture-map.md).
// It never fails a start: when the page cannot be read it prints nothing.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PAGE = ['docs', 'architecture', 'README.md'];
const EVENTS = new Set(['SessionStart', 'SubagentStart']);

/** The hook's JSON answer for `event`, or null when the event is not one of ours or the page is missing. */
export function contextFor(event, root) {
  if (!EVENTS.has(event)) return null;
  const file = join(root, ...PAGE);
  if (!existsSync(file)) return null;
  const page = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
  const additionalContext = `The architecture map of this repository (docs/architecture/README.md). Read it before you look for anything; frontend.md, backend.md and tooling.md in the same folder go deeper. It is a guide, not a list of files: search the tree for files.\n\n${page}`;
  return { hookSpecificOutput: { hookEventName: event, additionalContext } };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain) process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    return;
  }
  const answer = contextFor(input?.hook_event_name, resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd()));
  if (answer) console.log(JSON.stringify(answer));
});
