// Sets the app's one version everywhere it is written: `[workspace.package]` of backend/Cargo.toml (every crate inherits
// it), frontend/package.json and the two copies of it in frontend/package-lock.json, and the workspace crates' entries
// of backend/Cargo.lock (`cargo update --workspace --offline`). A test (frontend/tests) keeps package.json equal to Cargo.
// Usage: `node tools/set-version.mjs 0.2.0` or `0.2.0-beta.1`; with no argument it shows the version and asks for one
// (scripts\version.bat). Nothing is committed: the changed files are listed for you to review.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

/** Whether `text` is a version Cargo and npm both take: `1.2.3`, or `1.2.3-beta.1` (no build metadata). */
export function isVersion(text) {
  return SEMVER.test(text);
}

/** `backend/Cargo.toml` with the workspace version replaced, and the version it had. */
export function withCargoVersion(toml, version) {
  const section = /(\[workspace\.package\][^[]*?\nversion = ")([^"]*)(")/.exec(toml);
  if (!section) throw new Error('backend/Cargo.toml has no [workspace.package] version');
  return { text: toml.replace(section[0], `${section[1]}${version}${section[3]}`), before: section[2] };
}

/** `package.json` / `package-lock.json` text with the app's own version replaced (the dependencies' are not touched). */
export function withPackageVersion(json, version) {
  const data = JSON.parse(json);
  data.version = version;
  if (data.packages?.['']) data.packages[''].version = version;
  const indent = /^\{\n( +)"/.exec(json)?.[1].length ?? 2;
  return `${JSON.stringify(data, null, indent)}\n`;
}

function update(path, change) {
  const file = `${ROOT}${path}`;
  const before = readFileSync(file, 'utf8');
  const after = change(before);
  if (after !== before) writeFileSync(file, after);
  return after !== before;
}

async function main() {
  const cargo = `${ROOT}backend/Cargo.toml`;
  const current = withCargoVersion(readFileSync(cargo, 'utf8'), '0.0.0').before;
  let version = process.argv[2];
  if (!version) {
    console.log(`The version now: ${current}`);
    const ask = createInterface({ input: process.stdin, output: process.stdout });
    version = (await ask.question('The new version (for example 0.2.0 or 0.2.0-beta.1): ')).trim();
    ask.close();
  }
  if (version.startsWith('v')) version = version.slice(1);
  if (!isVersion(version)) {
    console.error(`"${version}" is not a version. Write it as 1.2.3 or 1.2.3-beta.1.`);
    process.exit(2);
  }
  if (version === current) {
    console.log(`The version is ${current} already; nothing to change.`);
    return;
  }
  const changed = [];
  if (update('backend/Cargo.toml', (t) => withCargoVersion(t, version).text)) changed.push('backend/Cargo.toml');
  for (const file of ['frontend/package.json', 'frontend/package-lock.json']) {
    if (update(file, (t) => withPackageVersion(t, version))) changed.push(file);
  }
  const lock = spawnSync('cargo', ['update', '--workspace', '--offline'], { cwd: `${ROOT}backend`, stdio: 'inherit' });
  if (lock.status !== 0) {
    console.error('cargo could not update backend/Cargo.lock; run `cargo update --workspace` in backend/ yourself.');
    process.exit(1);
  }
  changed.push('backend/Cargo.lock');
  console.log(`Version ${current} -> ${version}. Changed: ${changed.join(', ')}`);
  console.log('Review with `git diff`, then commit. README.md and the manual may still say the old version.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
