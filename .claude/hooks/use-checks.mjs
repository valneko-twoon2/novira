// Claude Code PreToolUse hook (Bash and PowerShell): a check is run through scripts/tools/checks.mjs, not as a raw command.
// A raw `cargo test` from the wrong folder, a missing PATH, a build into the folder of the running novira.exe, a Playwright
// run without the e2e lock: the tool sets all of that and passes the arguments through. The hook stops a command whose
// part starts with one of the raw check commands (exit 2 sends the reason and the exact command to run instead to the
// agent). `node scripts/tools/checks.mjs ...`, `node scripts/tools/affected.mjs` and the other tools are not stopped; neither
// are `cargo build` / `cargo run` and the like, which are not checks.
import { pathToFileURL } from 'node:url';

/** [pattern of one command part, check name, how many leading words of the part are dropped to get the arguments]. */
const RAW = [
  [/^cargo\s+fmt\b/, 'fmt'],
  [/^cargo\s+clippy\b/, 'clippy'],
  [/^cargo\s+test\b/, 'cargo-test'],
  [/^(?:npx\s+(?:--no-install\s+)?)?eslint\b/, 'lint'],
  [/^npm\s+run\s+lint\b/, 'lint'],
  [/^(?:npx\s+)?stylelint\b/, 'lint'],
  [/^npm\s+run\s+typecheck\b/, 'typecheck'],
  [/^(?:npx\s+)?tsc\b/, 'typecheck'],
  [/^(?:npx\s+)?vitest\b/, 'vitest'],
  [/^(?:npx\s+)?playwright\s+test\b/, 'e2e'],
];

/** The parts of a command line: split at `&&`, `||`, `;`, `|` and line breaks; a leading `cd x` and `VAR=value` words are dropped. */
export function partsOf(command) {
  return String(command ?? '')
    .split(/&&|\|\||;|\||\r?\n/)
    .map((part) => part.trim().replace(/^(?:\$env:\w+\s*=\s*\S+\s*;?\s*|\w+=\S*\s+)+/, ''))
    .filter(Boolean);
}

/** `{ name, run }` for the first raw check command of `command`, or null. `run` is the command to run instead. */
export function rawCheck(command) {
  for (const part of partsOf(command)) {
    for (const [pattern, name] of RAW) {
      if (!pattern.test(part)) continue;
      // The arguments: what follows the command word(s); vitest's own subcommand `run` is dropped (the tool adds it).
      const rest = part
        .replace(pattern, '')
        .replace(name === 'vitest' ? /^\s*run\b/ : /^$/, '')
        .trim();
      // Two checks take no arguments: fmt (only --fix) and typecheck.
      if (name === 'fmt') return { name, run: `node scripts/tools/checks.mjs fmt${/--check/.test(rest) ? '' : ' --fix'}` };
      if (name === 'typecheck') return { name, run: 'node scripts/tools/checks.mjs typecheck' };
      const phone = name === 'e2e' && /--project[= ]phone|--project[= ]webkit/.test(rest);
      const target = phone ? 'phone' : name;
      return { name: target, run: `node scripts/tools/checks.mjs ${target}${rest ? ` ${rest}` : ''}` };
    }
  }
  return null;
}

/** The message sent back to the agent. */
export function advice(found) {
  return `Run checks through the tool, not as a raw command: ${found.run}\nIt sets the folder, PATH, the Rust build folder (the running novira.exe is never touched) and the e2e lock, and passes your arguments through. The checks: node scripts/tools/checks.mjs --list. For the checks a change needs: node scripts/tools/affected.mjs.`;
}

function run(input) {
  const command = input?.tool_input?.command;
  const found = rawCheck(command);
  if (!found) return;
  process.stderr.write(`${advice(found)}\n`);
  process.exitCode = 2;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      run(JSON.parse(raw || '{}'));
    } catch {
      // A hook that fails on its own error must not stop the work: the pre-commit gates still run the checks.
    }
  });
}
