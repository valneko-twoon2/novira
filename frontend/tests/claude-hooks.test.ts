// The Claude Code hooks in .claude/hooks: line ends of edited files, and commands that need the user's go-ahead.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM scripts without types
import { contextFor } from '../../.claude/hooks/architecture-map.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { shouldConvert } from '../../.claude/hooks/eol.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { wantedEol, withEol } from '../../tools/eol.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { badEol, rewritesFiles } from '../../.claude/hooks/eol-after-shell.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { appeared, isProtected, listProtected, run as guard, shellWritesProtected } from '../../.claude/hooks/data-guard.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { pending, reminder } from '../../.claude/hooks/commit-before-stop.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { rootHolding } from '../../.claude/hooks/worktrees.mjs';
// @ts-expect-error -- plain ESM scripts without types
import { finished, parseWorktrees as parseTrees } from '../../tools/worktree.mjs';

describe('worktree script', () => {
  const porcelain = ['worktree E:/Code/novira', 'HEAD a', 'branch refs/heads/main', '', 'worktree E:/Code/wt-done', 'HEAD b', 'branch refs/heads/done', '', 'worktree E:/Code/wt-work', 'HEAD c', 'branch refs/heads/work', '', 'worktree E:/Code/wt-dirty', 'HEAD d', 'branch refs/heads/dirty', '', 'worktree E:/Code/wt-gone', 'HEAD e', 'detached', ''].join('\n');

  it('reads branches and detached heads, the main checkout first', () => {
    const trees = parseTrees(porcelain);
    expect(trees.map((t: { branch: string | null }) => t.branch)).toEqual(['main', 'done', 'work', 'dirty', null]);
  });

  it('calls a worktree finished when its folder is gone, or it is clean and its branch is merged into main', () => {
    const trees = parseTrees(porcelain);
    const done = finished(trees, {
      merged: new Set(['main', 'done', 'dirty']),
      dirty: (p: string) => p.endsWith('wt-dirty'),
      missing: (p: string) => p.endsWith('wt-gone'),
    });
    // A worktree made a moment ago and not used yet is not finished, whatever its branch says.
    const young = finished(trees, { merged: new Set(['main', 'done']), dirty: () => false, missing: (p: string) => p.endsWith('wt-gone'), fresh: (p: string) => p.endsWith('wt-done') });
    expect(young.map((t: { path: string }) => t.path.replaceAll('\\', '/').split('/').pop())).toEqual(['wt-gone']);
    // wt-work is unmerged and stays; wt-dirty is merged but has changes and stays; the main checkout is never listed.
    expect(done.map((t: { path: string }) => t.path.replaceAll('\\', '/').split('/').pop())).toEqual(['wt-done', 'wt-gone']);
  });
});

describe('worktree helper of the hooks', () => {
  it('reads `git worktree list --porcelain` through tools/worktree.mjs: the main checkout first, a detached head without a branch', () => {
    const out = ['worktree E:/Code/novira', 'HEAD abc', 'branch refs/heads/main', '', 'worktree E:/Code/novira-wt-x', 'HEAD def', 'detached', ''].join('\n');
    const trees = parseTrees(out).map((t: { path: string; branch: string | null }) => [t.path.replaceAll('\\', '/').split('/').pop(), t.branch]);
    expect(trees).toEqual([
      ['novira', 'main'],
      ['novira-wt-x', null],
    ]);
    expect(parseTrees('')).toEqual([]);
  });

  it('finds the work tree that holds a file, case-insensitively, and none for a file elsewhere', () => {
    const roots = ['E:/Code/novira', 'E:/Code/novira-wt-x'];
    expect(rootHolding('e:\\Code\\novira-wt-x\\frontend\\a.ts', roots)).toBe('E:/Code/novira-wt-x');
    expect(rootHolding('E:/Code/novira/frontend/a.ts', roots)).toBe('E:/Code/novira');
    // A folder that only starts with the same letters is another folder.
    expect(rootHolding('E:/Code/novira-other/a.ts', roots)).toBeNull();
    expect(rootHolding('E:/Code/ComfyUI/a.py', roots)).toBeNull();
  });
});

describe('line-end hook', () => {
  it('turns CRLF and mixed line ends into LF, and LF into CRLF for batch files', () => {
    expect(withEol('a\nb\r\nc\n', 'lf')).toBe('a\nb\nc\n');
    expect(withEol('a\nb\r\n', 'crlf')).toBe('a\r\nb\r\n');
  });

  it('wants CRLF for .bat and .cmd files and LF for the rest', () => {
    expect(wantedEol('scripts/start.bat')).toBe('crlf');
    expect(wantedEol('a/RUN.CMD')).toBe('crlf');
    expect(wantedEol('src/a.ts')).toBe('lf');
    expect(wantedEol('docs/batch.md')).toBe('lf');
  });

  it('only touches files inside the repository, outside generated folders', () => {
    const root = 'E:/repo';
    expect(shouldConvert('E:/repo/frontend/src/a.ts', root)).toBe(true);
    expect(shouldConvert('E:/repo/frontend/node_modules/x/a.js', root)).toBe(false);
    expect(shouldConvert('E:/repo/target/debug/a.txt', root)).toBe(false);
    expect(shouldConvert('E:/other/a.ts', root)).toBe(false);
    expect(shouldConvert('D:/elsewhere/a.ts', root)).toBe(false);
  });
});

describe('architecture-map hook', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));

  it('hands the entry page of the map to a session and to a subagent at their start', () => {
    for (const event of ['SessionStart', 'SubagentStart']) {
      const answer = contextFor(event, root);
      expect(answer.hookSpecificOutput.hookEventName).toBe(event);
      expect(answer.hookSpecificOutput.additionalContext).toContain('# Architecture');
      expect(answer.hookSpecificOutput.additionalContext).not.toContain('\r');
    }
  });

  it('says nothing for another event or when the page is missing', () => {
    expect(contextFor('PreToolUse', root)).toBeNull();
    expect(contextFor('SessionStart', join(root, 'frontend', 'src'))).toBeNull();
  });

  it('is registered for both events', () => {
    const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
    for (const event of ['SessionStart', 'SubagentStart']) {
      expect(JSON.stringify(settings.hooks[event])).toContain('architecture-map.mjs');
    }
  });
});

describe('eol-after-shell hook', () => {
  it('looks only at shell commands that can rewrite files', () => {
    for (const cmd of ["sed -i 's/a/b/' x.ts", 'python fix.py', 'echo a > out.txt', 'node fix.cjs', 'Set-Content a.txt b']) expect(rewritesFiles(cmd), cmd).toBe(true);
    for (const cmd of ['git status', 'npm run check', 'ls -la', 'git log --oneline 2>&1', 'cargo test -p novira-core', undefined]) expect(rewritesFiles(cmd), String(cmd)).toBe(false);
  });

  it('lists text files whose work tree copy has the wrong line ends (CRLF, mixed; LF for batch files), not binaries or generated folders', () => {
    const listing = [
      'i/lf    w/crlf  attr/text=auto eol=lf\tsrc/a.ts',
      'i/lf    w/mixed attr/text=auto eol=lf\tdocs/b.md',
      'i/lf    w/lf    attr/text=auto eol=lf\tsrc/ok.ts',
      'i/      w/crlf  attr/text=auto eol=lf\tnew.txt',
      'i/lf    w/crlf  attr/text eol=crlf\tscripts/ok.bat',
      'i/lf    w/lf    attr/text eol=crlf\tscripts/bad.bat',
      'i/-text w/-text attr/-text\tlogo.png',
      'i/lf    w/crlf  attr/text=auto eol=lf\tfrontend/node_modules/x/a.js',
    ].join('\n');
    expect(badEol(listing)).toEqual(['src/a.ts', 'docs/b.md', 'new.txt', 'scripts/bad.bat']);
  });
});

describe('data-guard hook', () => {
  const data = 'E:/Code/novira/novira-data';
  const repo = 'E:/Code/novira';

  it('protects the data folder except its work folder, on any case and slash', () => {
    expect(isProtected('E:\\Code\\novira\\novira-data\\models\\x.txt', data)).toBe(true);
    expect(isProtected(`${data}/settings.json`, data)).toBe(true);
    expect(isProtected(`${data}/work/perf/a.json`, data)).toBe(false);
    expect(isProtected(`${data}/workbench/a.json`, data)).toBe(true);
    expect(isProtected('E:/Code/novira/frontend/a.ts', data)).toBe(false);
  });

  it('refuses shell commands that write, move or delete there, and lets reads and copies into work through', () => {
    const refused = [
      'echo x > novira-data/models/a.txt',
      'cp a.txt novira-data/models/',
      'rm -rf novira-data/models/x',
      'mv novira-data/outputs/a.png novira-data/work/',
      `python -c "open(r'${data}/models/k.txt','w')"`,
      'Remove-Item E:\\Code\\novira\\novira-data\\outputs\\a.png',
      `node -e "fs.writeFileSync('novira-data/settings.json', x)"`,
    ];
    const allowed = [
      'cat novira-data/models/a.json > novira-data/work/b.txt',
      'cp novira-data/novira.sqlite novira-data/work/x/',
      'cp novira-data/models/a /tmp/',
      'rm -rf novira-data/work/x',
      `python -c "sqlite3.connect('file:novira-data/novira.sqlite?mode=ro')"`,
      'ls novira-data/models',
      'mkdir -p novira-data/work/perf',
      'git status',
    ];
    for (const cmd of refused) expect(shellWritesProtected(cmd, data, repo), cmd).toBe(true);
    for (const cmd of allowed) expect(shellWritesProtected(cmd, data, repo), cmd).toBe(false);
  });

  it('reports what a shell command left in the data folder, and nothing for an unchanged one', () => {
    const root = mkdtempSync(join(tmpdir(), 'guard-'));
    const dataDir = join(root, 'novira-data');
    const roots = { work: join(dataDir, 'work') };
    mkdirSync(join(dataDir, 'models', 'loras'), { recursive: true });
    writeFileSync(join(dataDir, 'models', 'loras', 'a.safetensors'), '');
    const input = { tool_name: 'Bash', tool_use_id: 't1', tool_input: { command: 'node script.mjs' }, cwd: root };
    const errors: string[] = [];
    const write = process.stderr.write;
    process.stderr.write = ((s: string) => (errors.push(s), true)) as typeof process.stderr.write;
    try {
      guard('pre', input, roots);
      guard('post', input, roots);
      expect(errors).toEqual([]);
      guard('pre', input, roots);
      writeFileSync(join(dataDir, 'models', 'loras', 'a.keys.txt'), '');
      writeFileSync(join(dataDir, 'models', 'loras', 'b.safetensors.part'), '');
      mkdirSync(join(dataDir, 'work', 'ok'), { recursive: true });
      guard('post', input, roots);
      expect(errors.join('')).toContain('a.keys.txt');
      expect(errors.join('')).not.toContain('.part');
      expect(errors.join('')).not.toContain('ok');
      guard('pre', { tool_name: 'Write', tool_input: { file_path: join(dataDir, 'models', 'x.txt') } }, roots);
      expect(errors.at(-1)).toContain('only under novira-data/work/');
    } finally {
      process.stderr.write = write;
      process.exitCode = 0;
      rmSync(root, { recursive: true, force: true });
    }
    expect(appeared(['a'], ['a', 'b'])).toEqual(['b']);
    expect(listProtected(join(root, 'missing'))).toEqual([]);
  });

  it('guards a data folder the app moved out of the repository the same way, by whatever name it has', () => {
    const moved = 'C:/Users/u/mydata';
    const both = [data, moved];
    expect(isProtected('C:\\Users\\u\\mydata\\models\\a.safetensors', both)).toBe(true);
    expect(isProtected(`${moved}/work/comfy-copy/x`, both)).toBe(false);
    expect(isProtected(`${data}/settings.json`, both)).toBe(true);
    for (const cmd of [`rm -rf ${moved}/models/x`, 'rm -rf /c/Users/u/mydata/models/x', `echo x > ${moved}/settings.json`,`cp a.txt C:\\Users\\u\\mydata\\outputs\\`, 'rm -rf novira-data/models/x']) {
      expect(shellWritesProtected(cmd, both, repo), cmd).toBe(true);
    }
    for (const cmd of [`ls ${moved}/models`, `cp ${moved}/models/a /tmp/`, `rm -rf ${moved}/work/x`]) {
      expect(shellWritesProtected(cmd, both, repo), cmd).toBe(false);
    }

    const root = mkdtempSync(join(tmpdir(), 'guard-'));
    const own = join(root, 'repo', 'novira-data');
    const away = join(root, 'away');
    const roots = { work: join(own, 'work'), moved: away };
    mkdirSync(join(away, 'models', 'vae'), { recursive: true });
    mkdirSync(own, { recursive: true });
    const input = { tool_name: 'Bash', tool_use_id: 't2', tool_input: { command: 'node script.mjs' }, cwd: root };
    const errors: string[] = [];
    const write = process.stderr.write;
    process.stderr.write = ((s: string) => (errors.push(s), true)) as typeof process.stderr.write;
    try {
      guard('pre', input, roots);
      writeFileSync(join(away, 'models', 'vae', 'left.txt'), '');
      mkdirSync(join(away, 'work', 'ok'), { recursive: true });
      guard('post', input, roots);
      expect(errors.join('')).toContain('left.txt');
      expect(errors.join('')).not.toContain('ok');
      guard('pre', { tool_name: 'Edit', tool_input: { file_path: join(away, 'settings.json') } }, roots);
      expect(errors.at(-1)).toContain('only under novira-data/work/');
    } finally {
      process.stderr.write = write;
      process.exitCode = 0;
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('commit-before-stop hook', () => {
  it('asks to remove finished worktrees when nothing else is pending, once', () => {
    const text = reminder({}, [], false, ['E:/Code/wt-done']);
    expect(text).toContain('E:/Code/wt-done');
    expect(text).toContain('tools/worktree.mjs remove');
    expect(reminder({ stop_hook_active: true }, [], false, ['E:/Code/wt-done'])).toBeNull();
    expect(reminder({}, [], true, ['E:/Code/wt-done'])).toBeNull();
    expect(reminder({}, [], false, [])).toBeNull();
  });

  it('lists changed paths and leaves out generated folders and user data', () => {
    const porcelain = [' M frontend/src/a.ts', '?? docs/new.md', 'R  old.md -> new.md', ' M novira-data/work/x.json', '?? frontend/node_modules/y.js', ' M data/user.db'].join('\n');
    expect(pending(porcelain)).toEqual(['frontend/src/a.ts', 'docs/new.md', 'new.md']);
  });

  it('reminds once about uncommitted work, and never during a merge, after a reminder, or with nothing changed', () => {
    const changed = ['a.ts', 'b.ts'];
    expect(reminder({}, changed, false)).toContain('a.ts');
    expect(reminder({}, changed, false)).toContain('commit');
    expect(reminder({ stop_hook_active: true }, changed, false)).toBeNull();
    expect(reminder({}, changed, true)).toBeNull();
    expect(reminder({}, [], false)).toBeNull();
    expect(reminder({}, Array.from({ length: 20 }, (_, i) => `f${i}.ts`), false)).toContain('and 8 more');
  });
});
