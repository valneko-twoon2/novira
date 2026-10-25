// Builds `frontend/dist` only when it is missing or older than its sources, the rule backend/src-tauri/build.rs uses for
// the app, so a launcher that needs the screens as files (the browser server) does not build them again for nothing.
//   node tools/ensure-frontend.mjs            build when stale
//   node tools/ensure-frontend.mjs --check    only say so (exit 1 when stale)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WATCHED = ['src', 'index.html', 'package.json', 'vite.config.ts'];

/** The newest modification time (ms) of a file, or of the files under a folder; null when there is none. */
function newest(path) {
  if (!existsSync(path)) return null;
  if (!statSync(path).isDirectory()) return statSync(path).mtimeMs;
  let latest = null;
  for (const name of readdirSync(path)) {
    const time = newest(join(path, name));
    if (time !== null && (latest === null || time > latest)) latest = time;
  }
  return latest;
}

/** Whether `dist` has to be built: it has no page, or a source is newer than its page. */
export function frontendIsStale(frontendDir) {
  const index = join(frontendDir, 'dist', 'index.html');
  if (!existsSync(index)) return true;
  const built = statSync(index).mtimeMs;
  const source = WATCHED.map((p) => newest(join(frontendDir, p))).reduce((a, b) => (b !== null && (a === null || b > a) ? b : a), null);
  return source !== null && source > built;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'frontend');
  const stale = frontendIsStale(frontend);
  if (process.argv.includes('--check')) process.exit(stale ? 1 : 0);
  if (!stale) {
    console.log('frontend/dist is up to date: not built again.');
  } else {
    const r = spawnSync('npm', ['run', 'build'], { cwd: frontend, stdio: 'inherit', shell: process.platform === 'win32' });
    process.exit(r.status ?? 1);
  }
}
