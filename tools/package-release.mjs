// Packs what scripts\release.bat put in artifacts\ into one zip for a release page: novira-<version>-windows-x64.zip, with a
// folder of the same name inside and a .sha256 file beside it. Only the programs go in (novira.exe, novira-server.exe, dist\,
// server.bat) and the licence texts; artifacts\novira-data\ (the data of whoever built it) is never in it.
// Usage: `node tools/package-release.mjs` (scripts\package.bat). It builds nothing: run scripts\release.bat first.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ART = join(ROOT, 'artifacts');

/** What goes into the zip, read from `artifacts\` (a folder is copied whole) or the repository root. */
export const ENTRIES = [
  { from: join(ART, 'novira.exe'), to: 'novira.exe' },
  { from: join(ART, 'novira-server.exe'), to: 'novira-server.exe' },
  { from: join(ART, 'dist'), to: 'dist', folder: true },
  { from: join(ART, 'server.bat'), to: 'server.bat' },
  { from: join(ROOT, 'LICENSE'), to: 'LICENSE' },
  { from: join(ROOT, 'THIRD_PARTY_NOTICES.txt'), to: 'THIRD_PARTY_NOTICES.txt' },
];

/** The workspace version of backend/Cargo.toml's text, or null when it has none. */
export function cargoVersion(toml) {
  return /\[workspace\.package\][^[]*?\nversion = "([^"]*)"/.exec(toml)?.[1] ?? null;
}

/** The base name of the package for a version: the zip and the folder inside it. */
export function packageName(version) {
  return `novira-${version}-windows-x64`;
}

/** The entries that are missing, as the names a person would look for. */
export function missingEntries(entries = ENTRIES, exists = existsSync) {
  return entries.filter((e) => !exists(e.from)).map((e) => e.to);
}

function fail(message) {
  console.error(`package-release: ${message}`);
  process.exit(1);
}

function main() {
  const version = cargoVersion(readFileSync(join(ROOT, 'backend', 'Cargo.toml'), 'utf8'));
  if (!version) fail('backend/Cargo.toml has no [workspace.package] version.');
  const missing = missingEntries();
  if (missing.length) fail(`not found: ${missing.join(', ')}. Run scripts\\release.bat first.`);

  const name = packageName(version);
  const stage = join(ART, 'package');
  const folder = join(stage, name);
  const zip = join(ART, `${name}.zip`);
  rmSync(stage, { recursive: true, force: true });
  rmSync(zip, { force: true });
  mkdirSync(folder, { recursive: true });
  for (const e of ENTRIES) {
    if (e.folder) cpSync(e.from, join(folder, e.to), { recursive: true });
    else copyFileSync(e.from, join(folder, e.to));
  }

  // Compress-Archive keeps the folder as the top level of the zip.
  const ps = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Compress-Archive -LiteralPath $env:NOVIRA_PACK_FROM -DestinationPath $env:NOVIRA_PACK_TO -CompressionLevel Optimal'], { stdio: 'inherit', env: { ...process.env, NOVIRA_PACK_FROM: folder, NOVIRA_PACK_TO: zip } });
  rmSync(stage, { recursive: true, force: true });
  if (ps.status !== 0 || !existsSync(zip)) fail('the zip could not be written.');

  const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
  writeFileSync(`${zip}.sha256`, `${sha} *${name}.zip\n`);
  console.log(`package-release: ${zip}`);
  console.log(`package-release: SHA-256 ${sha}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
