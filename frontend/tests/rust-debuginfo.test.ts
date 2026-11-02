// No Rust build of the repository writes debug info: it was most of backend/target (a .pdb of about 70 MB per test
// binary). backend/Cargo.toml turns debug info off in every profile, and backend/.cargo/config.toml tells the linker to
// write no .pdb (debug = false alone still left one). This keeps both, and keeps the scripts from setting them back.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(REPO, p), 'utf8');

/** Each `[profile.*]` table of a Cargo.toml with the lines that turn debug info on (`debug` other than false / 0 / "none"). */
export function debugInProfiles(toml: string): string[] {
  const found: string[] = [];
  let table = '';
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const head = /^\[(.+)\]$/.exec(line);
    if (head) table = (head[1] ?? '').trim();
    else if (table.startsWith('profile.')) {
      const m = /^debug\s*=\s*(.+)$/.exec(line);
      if (m && !/^(false|0|"none")$/.test((m[1] ?? '').trim())) found.push(`[${table}] ${line}`);
    } else {
      // A dotted key outside a profile table: profile.dev.debug = true
      const m = /^profile\.[\w.-]*\.debug\s*=\s*(.+)$/.exec(line);
      if (m && !/^(false|0|"none")$/.test((m[1] ?? '').trim())) found.push(line);
    }
  }
  return found;
}

/** The `rustflags` of the `[target.x86_64-pc-windows-msvc]` table of .cargo/config.toml, or null. */
export function msvcRustflags(toml: string): string | null {
  let table = '';
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const head = /^\[(.+)\]$/.exec(line);
    if (head) table = (head[1] ?? '').trim();
    else if (table === 'target.x86_64-pc-windows-msvc') {
      const m = /^rustflags\s*=\s*(.+)$/.exec(line);
      if (m) return m[1] ?? null;
    }
  }
  return null;
}

/** What in a script, hook or workflow would bring debug info back or replace the linker flags: RUSTFLAGS (it replaces the config's list), a profile's debug through the environment or --config, -g or -C debuginfo. */
export function debugBypass(text: string): string[] {
  const patterns = [/\bRUSTFLAGS\b/, /\bCARGO_ENCODED_RUSTFLAGS\b/, /\bCARGO_TARGET_[A-Z0-9_]+_RUSTFLAGS\b/, /\bCARGO_PROFILE_[A-Z0-9_]+_DEBUG\b/, /profile\.[\w.-]+\.debug\s*=\s*(true|[1-2]|"(full|limited|line-tables-only|line-directives-only)")/, /-C\s*debuginfo=[12]/, /-Cdebuginfo=[12]/];
  return text.split(/\r?\n/).filter((line) => patterns.some((p) => p.test(line)));
}

const tracked = (globs: string[]) => execFileSync('git', ['ls-files', '--', ...globs], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);

describe('rust debug info', () => {
  it('turns debug info off in every profile of every Cargo.toml', () => {
    for (const file of tracked(['backend/Cargo.toml', 'backend/**/Cargo.toml'])) expect(debugInProfiles(read(file)), file).toEqual([]);
    expect(read('backend/Cargo.toml')).toMatch(/^\[profile\.dev\]\s*\r?\ndebug = false$/m);
  });

  it('tells the linker to write no .pdb', () => {
    expect(msvcRustflags(read('backend/.cargo/config.toml'))).toContain('"link-arg=/DEBUG:NONE"');
  });

  it('has no script, hook or workflow that brings debug info back', () => {
    const files = tracked(['scripts', '.githooks', '.claude/hooks', '.claude/settings.json', '.github', 'frontend/package.json', 'frontend/scripts']);
    const hits = files.filter((f) => !f.endsWith('.md')).flatMap((f) => debugBypass(read(f)).map((line) => `${f}: ${line.trim()}`));
    expect(hits).toEqual([]);
  });

  it('finds what turns debug info on, and lets the off settings through', () => {
    expect(debugInProfiles('[profile.dev]\ndebug = false\n[profile.release]\nopt-level = 3\n')).toEqual([]);
    expect(debugInProfiles('[profile.dev]\ndebug = 0\n[profile.test]\ndebug = "none"\n')).toEqual([]);
    expect(debugInProfiles('[profile.dev]\ndebug = true\n')).toEqual(['[profile.dev] debug = true']);
    expect(debugInProfiles('[profile.dev.package."*"]\ndebug = "line-tables-only"  # small\n')).toEqual(['[profile.dev.package."*"] debug = "line-tables-only"']);
    expect(debugInProfiles('[profile.release]\ndebug = 1\n')).toHaveLength(1);
    expect(debugInProfiles('[package]\ndebug = true\n')).toEqual([]);
    expect(debugInProfiles('profile.dev.debug = 2\n')).toEqual(['profile.dev.debug = 2']);
    expect(debugInProfiles('# debug = true\n[profile.dev]\n# debug = true\n')).toEqual([]);
  });

  it('reads the linker flags of the msvc target only', () => {
    expect(msvcRustflags('[target.x86_64-pc-windows-msvc]\nlinker = "rust-lld.exe"\nrustflags = ["-C", "link-arg=/DEBUG:NONE"]\n')).toBe('["-C", "link-arg=/DEBUG:NONE"]');
    expect(msvcRustflags('[target.x86_64-pc-windows-msvc]\nlinker = "rust-lld.exe"\n# rustflags = ["-C", "link-arg=/DEBUG:NONE"]\n')).toBeNull();
    expect(msvcRustflags('[build]\nrustflags = ["-C", "link-arg=/DEBUG:NONE"]\n')).toBeNull();
  });

  it('finds the ways around it in a script, and lets ordinary cargo lines through', () => {
    expect(debugBypass('set RUSTFLAGS=-C opt-level=1')).toHaveLength(1);
    expect(debugBypass('env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: "x" }')).toHaveLength(1);
    expect(debugBypass('CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS=""')).toHaveLength(1);
    expect(debugBypass('CARGO_PROFILE_DEV_DEBUG=true cargo test')).toHaveLength(1);
    expect(debugBypass("cargo test --config 'profile.dev.debug=true'")).toHaveLength(1);
    expect(debugBypass('cargo test --config profile.test.debug="line-tables-only"')).toHaveLength(1);
    expect(debugBypass('rustc -C debuginfo=2 x.rs')).toHaveLength(1);
    expect(debugBypass('cargo test -p novira-core\ncargo build --release -p novira\nCARGO_TARGET_DIR=x cargo build')).toEqual([]);
    expect(debugBypass('cargo test --config profile.dev.debug=false')).toEqual([]);
  });
});
