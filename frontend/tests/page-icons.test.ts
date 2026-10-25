import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

// The build leaves `public/` out (`copyPublicDir: false`), so an icon the page names there never reaches `dist/` and the
// tab of the browser version stays without one. Icons are source files that Vite emits under `assets/`.
describe('page icons', () => {
  const page = readFileSync(resolve(root, 'index.html'), 'utf8');
  const hrefs = [...page.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]!);

  it('names a tab icon and a home-screen icon', () => {
    expect(hrefs).toHaveLength(2);
  });

  it.each(hrefs)('%s is a source file, not a file of public/', (href) => {
    expect(href.startsWith('/src/')).toBe(true);
    expect(existsSync(resolve(root, href.slice(1)))).toBe(true);
  });
});
