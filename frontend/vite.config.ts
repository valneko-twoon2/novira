import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Fontsource lists every font twice (woff2 and the older woff). Every WebView the app runs in reads woff2, and the
 * files are embedded in the app, so the woff copies would only double its size.
 */
export function woff2Only(): Plugin {
  return {
    name: 'novira:woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource') || !id.split('?')[0]!.endsWith('.css')) return null;
      return code.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, '');
    },
  };
}

/**
 * `public/theme-boot.js` puts the saved theme on the page before its first paint, so it is a plain script that index.html
 * loads in <head>, not a module Vite bundles. The dev server serves it from `public/`; the build, which leaves `public/`
 * out, writes this one file.
 */
export function themeBoot(): Plugin {
  return {
    name: 'novira:theme-boot',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'theme-boot.js', source: readFileSync(here('public/theme-boot.js'), 'utf8') });
    },
  };
}

export default defineConfig({
  plugins: [woff2Only(), themeBoot(), react()],
  resolve: { alias: { '@': here('src') } },
  // The license files live at the repository root and the About dialog imports them as text (`?raw`).
  server: { fs: { allow: [here('..')] } },
  // `public/` holds the browser mock's pictures, which the desktop app never shows: the build leaves them out (the dev server still serves them).
  // Its `theme-boot.js` is written by `themeBoot`.
  build: {
    outDir: 'dist',
    sourcemap: false,
    copyPublicDir: false,
    // Measured 2026-10-21 (kB as Vite counts them): the app's chunk is 2,493 (every screen, which App.tsx keeps mounted once
    // opened, and 600 of icon paths in six weights each), the start-up chunk 757 (React and the ja and en messages), the
    // license texts 1,008 (About only), three.js 535 (3D pose only), the mock's node list 524 (browser mock only). The app
    // loads them from its own files, not over a network; the other languages, the mock and the comic fonts' rules are
    // chunks of their own. The limit sits just above the largest, so a chunk that grows past it still warns.
    chunkSizeWarningLimit: 2600,
  },
});
