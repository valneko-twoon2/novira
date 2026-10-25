// tools/ensure-frontend.mjs: `frontend/dist` is built only when it is missing or older than a source.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { frontendIsStale } from '../../tools/ensure-frontend.mjs';

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

const at = (path: string, seconds: number) => utimesSync(path, seconds, seconds);

/** A frontend folder whose page was built at `built` and whose newest source (a file in src/) was saved at `source`. */
function frontend(built: number | null, source: number) {
  dir = mkdtempSync(join(tmpdir(), 'novira-ensure-'));
  mkdirSync(join(dir, 'src', 'deep'), { recursive: true });
  for (const f of ['index.html', 'package.json', 'vite.config.ts']) {
    writeFileSync(join(dir, f), '');
    at(join(dir, f), 100);
  }
  writeFileSync(join(dir, 'src', 'deep', 'a.ts'), '');
  at(join(dir, 'src', 'deep', 'a.ts'), source);
  if (built !== null) {
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), '');
    at(join(dir, 'dist', 'index.html'), built);
  }
  return dir;
}

describe('ensure-frontend', () => {
  it('builds when there is no page yet', () => {
    expect(frontendIsStale(frontend(null, 200))).toBe(true);
  });

  it('builds when a source, also a deep one, is newer than the page', () => {
    expect(frontendIsStale(frontend(300, 400))).toBe(true);
  });

  it('does not build when the page is newer than every source, or as new', () => {
    expect(frontendIsStale(frontend(500, 400))).toBe(false);
    expect(frontendIsStale(frontend(400, 400))).toBe(false);
  });
});
