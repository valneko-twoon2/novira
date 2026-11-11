// The one way to run a check (scripts/tools/checks.mjs) and the hook that sends a raw check command to it (.claude/hooks/use-checks.mjs).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { CHECKS, checkFolder, envFor, pathFor, specOf } from '../../scripts/tools/checks.mjs';
// @ts-expect-error -- plain ESM script without types
import { partsOf, rawCheck } from '../../.claude/hooks/use-checks.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const run = (name: string, args: string[] = []): string[] => specOf(name, args).cmd;

describe('checks tool', () => {
  it('knows every check CI and the commit gates name, and says what each does', () => {
    for (const name of ['fmt', 'clippy', 'cargo-test', 'lint', 'typecheck', 'vitest', 'e2e', 'phone', 'diff-backends', 'layout', 'docs', 'tla']) {
      expect(CHECKS[name], name).toBeTruthy();
      expect(CHECKS[name].about.length, name).toBeGreaterThan(10);
    }
  });

  it('runs a check in its folder with the drive letter in capitals, whatever case the shell started in', () => {
    // A shell started in `e:\...` gives Node a lower-case drive; vitest then loads its own module twice (`e:` and `E:`) and
    // every test file fails with "Cannot read properties of undefined (reading 'config')".
    expect(checkFolder('e:\\Code\\novira\\', 'frontend')).toBe(join('E:\\Code\\novira\\', 'frontend'));
    expect(checkFolder('E:\\Code\\novira\\', '.')).toBe(join('E:\\Code\\novira\\', '.'));
    expect(checkFolder('/home/me/novira/', 'backend')).toBe(join('/home/me/novira/', 'backend'));
  });

  it('runs the same commands as CI when no arguments are given', () => {
    expect(run('fmt')).toEqual(['cargo', 'fmt', '--all', '--', '--check']);
    expect(run('clippy')).toEqual(['cargo', 'clippy', '-p', 'novira-core', '-p', 'novira-server', '-p', 'novira', '--tests', '--', '-D', 'warnings']);
    expect(run('cargo-test')).toEqual(['cargo', 'test', '-p', 'novira-core', '--no-fail-fast']);
    expect(run('lint')).toEqual(['npm', 'run', 'lint']);
    expect(run('typecheck')).toEqual(['npm', 'run', 'typecheck']);
    expect(run('e2e')).toEqual(['npx', 'playwright', 'test', '--project=chromium']);
    expect(run('phone')).toEqual(['npx', 'playwright', 'test', '--project=phone', '--project=webkit']);
  });

  it('passes the arguments through, and an explicit choice replaces the default', () => {
    expect(run('fmt', ['--fix'])).toEqual(['cargo', 'fmt', '--all']);
    expect(run('clippy', ['-p', 'novira-core'])).toEqual(['cargo', 'clippy', '-p', 'novira-core', '--tests', '--', '-D', 'warnings']);
    expect(run('cargo-test', ['-p', 'novira-core', '--lib', 'queue'])).toEqual(['cargo', 'test', '-p', 'novira-core', '--lib', 'queue']);
    expect(run('lint', ['src/a.ts'])).toEqual(['npx', 'eslint', 'src/a.ts']);
    expect(run('vitest', ['src/a.test.ts', '-t', 'x'])).toEqual(['npx', 'vitest', 'run', 'src/a.test.ts', '-t', 'x']);
    expect(run('e2e', ['e2e/a.spec.ts', '--project=firefox'])).toEqual(['npx', 'playwright', 'test', 'e2e/a.spec.ts', '--project=firefox']);
  });

  it('turns a path written from the repository root into the path the command sees', () => {
    expect(pathFor('frontend', 'frontend/src/a.ts')).toBe('src/a.ts');
    expect(pathFor('frontend', 'frontend\\src\\a.ts')).toBe('src/a.ts');
    expect(pathFor('frontend', 'src/a.ts')).toBe('src/a.ts');
    expect(pathFor('frontend', '-t')).toBe('-t');
    expect(pathFor('.', 'frontend/src/a.ts')).toBe('frontend/src/a.ts');
    expect(run('vitest', ['frontend/src/a.test.ts'])).toEqual(['npx', 'vitest', 'run', 'src/a.test.ts']);
  });

  it('runs a check in the folder it belongs to, and takes the e2e lock for the browser runs only', () => {
    expect(specOf('clippy').cwd).toBe('backend');
    expect(specOf('vitest').cwd).toBe('frontend');
    expect(specOf('docs').cwd).toBe('.');
    expect(['e2e', 'phone'].filter((n) => specOf(n).lock)).toEqual(['e2e', 'phone']);
    expect(['fmt', 'clippy', 'cargo-test', 'lint', 'vitest', 'typecheck', 'docs'].filter((n) => specOf(n).lock)).toEqual([]);
  });

  it('refuses an unknown name and says which exist', () => {
    expect(() => specOf('nothing')).toThrow(/unknown check "nothing".*fmt, clippy/);
  });

  it('puts cargo on the PATH, and builds Rust in the harness folder unless a build folder is given', () => {
    const rust = envFor(specOf('clippy'), { PATH: 'X' }, root, () => false);
    expect(rust.PATH).toContain('.cargo');
    expect(rust.PATH.endsWith('X')).toBe(true);
    expect(rust.CARGO_TARGET_DIR.replaceAll('\\', '/')).toMatch(/novira-data\/work\/check-target$/);
    expect(rust.NOVIRA_SKIP_FRONTEND_BUILD).toBeUndefined();
    expect(envFor(specOf('clippy'), { PATH: 'X', CARGO_TARGET_DIR: 'Z' }, root, () => false).CARGO_TARGET_DIR).toBe('Z');
    expect(envFor(specOf('clippy'), { PATH: 'X' }, root, () => true).NOVIRA_SKIP_FRONTEND_BUILD).toBe('1');
    expect(envFor(specOf('vitest'), { PATH: 'X' }, root, () => true).CARGO_TARGET_DIR).toBeUndefined();
  });
});

describe('use-checks hook', () => {
  it('sends a raw check command to the tool, keeping the arguments', () => {
    expect(rawCheck('cd frontend && npx vitest run src/a.test.ts -t foo').run).toBe('node scripts/tools/checks.mjs vitest src/a.test.ts -t foo');
    expect(rawCheck('cargo test -p novira-core --lib queue').run).toBe('node scripts/tools/checks.mjs cargo-test -p novira-core --lib queue');
    expect(rawCheck('cargo test test_name').run).toBe('node scripts/tools/checks.mjs cargo-test test_name');
    expect(rawCheck('npx eslint src/a.ts src/b.ts').run).toBe('node scripts/tools/checks.mjs lint src/a.ts src/b.ts');
    expect(rawCheck('npm run lint').run).toBe('node scripts/tools/checks.mjs lint');
    expect(rawCheck('cargo clippy -p novira-core --tests -- -D warnings').name).toBe('clippy');
    expect(rawCheck('npx playwright test e2e/a.spec.ts --project=chromium').run).toBe('node scripts/tools/checks.mjs e2e e2e/a.spec.ts --project=chromium');
    expect(rawCheck('npx playwright test --project=phone').name).toBe('phone');
    expect(rawCheck('npm run typecheck').run).toBe('node scripts/tools/checks.mjs typecheck');
  });

  it('tells a format check from formatting', () => {
    expect(rawCheck('cargo fmt --all -- --check').run).toBe('node scripts/tools/checks.mjs fmt');
    expect(rawCheck('cargo fmt --all').run).toBe('node scripts/tools/checks.mjs fmt --fix');
  });

  it('finds the raw command after an environment assignment, a pipe or a second command', () => {
    expect(rawCheck('RUST_LOG=debug cargo test').name).toBe('cargo-test');
    expect(rawCheck('echo start; cargo test -p novira').name).toBe('cargo-test');
    expect(rawCheck('cargo clippy 2>&1 | tail -5').name).toBe('clippy');
    expect(partsOf('a && b || c ; d | e\nf')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('lets the tools, other cargo commands and words inside other commands through', () => {
    for (const ok of [
      'node scripts/tools/checks.mjs vitest src/a.test.ts',
      'node scripts/tools/affected.mjs',
      'node scripts/tools/e2e-lock.mjs -- npx playwright test --project=chromium',
      'cargo build',
      'cargo run -p novira',
      'cargo metadata',
      'git log --oneline | grep "cargo test"',
      'git commit -m "fix: cargo fmt の差分"',
      'npm install',
      'npm run build',
      'ls',
      '',
    ]) {
      expect(rawCheck(ok), ok).toBeNull();
    }
    expect(rawCheck(undefined)).toBeNull();
  });

  it('is registered before every shell call', () => {
    const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
    const pre = settings.hooks.PreToolUse.filter((entry: { matcher: string }) => entry.matcher.includes('Bash'));
    expect(JSON.stringify(pre)).toContain('use-checks.mjs');
  });
});
