// End-to-end tests: drive the browser build against the in-memory mock backend.
// The server runs on its own port so it never collides with a `npm run dev` on 5173. It is the Vite dev server, or a
// production build served by `vite preview` (scripts/e2e-server.mjs) for the layout scan: see serverMode() there.
import { existsSync, readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { chromium, defineConfig, devices } from '@playwright/test';
// @ts-expect-error -- plain ESM script without types
import { serverMode } from './scripts/e2e-server.mjs';

// E2E_PORT lets parallel checkouts (git worktrees) run their own server instead of reusing another one's.
const PORT = Number(process.env.E2E_PORT) || 5180;
const BASE_URL = `http://localhost:${PORT}/`;
const SERVER: 'build' | 'dev' = serverMode();

/**
 * The browser to launch. NOVIRA_CHROMIUM names one. Otherwise, when the Chromium build this Playwright expects is not installed
 * (the cloud container ships an older one under PLAYWRIGHT_BROWSERS_PATH), the headless shell found there is used: the same
 * kind of browser Playwright launches by default, so screenshots keep matching.
 */
function browserPath(): string | undefined {
  if (process.env.NOVIRA_CHROMIUM) return process.env.NOVIRA_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root) || existsSync(chromium.executablePath())) return undefined;
  for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const exe = join(root, dir, 'chrome-linux', 'headless_shell');
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  // Half the processors, never more than 6: more made the user's PC too slow to work on (tools/layout-scan.mjs keeps the same cap).
  workers: Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2))),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1600, height: 960 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // See browserPath().
    launchOptions: { executablePath: browserPath() },
  },
  // Screenshot baselines live next to the specs, one set per platform (fonts and anti-aliasing differ by OS).
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
  projects: [
    {
      name: 'chromium',
      testIgnore: ['visual.spec.ts', 'layout.spec.ts', 'phone*.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 960 } },
    },
    {
      // The phone layout (`phone*.spec.ts`): a phone held upright, with touch, as the browser server serves it on the home
      // network. Pixel 7 is a Chromium phone, so the one browser Playwright installs runs it.
      name: 'phone',
      testMatch: 'phone*.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    {
      // Visual regression (`npm run e2e:visual`). Pinned scale, locale and time zone so pixels and dates match the baselines.
      name: 'visual',
      testMatch: 'visual.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 960 },
        deviceScaleFactor: 1,
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        colorScheme: 'dark',
      },
      // Allowed differing pixels per screenshot. It was a ratio (0.002, about 3072 px), which let one added side bar tab
      // (1273 to 1613 px, measured on win32) pass. Unchanged code differs by 0 px on all 22 screens (two runs), so 300 px
      // is well above the noise and about a quarter of the smallest one-item change. The settings dialog dims the side bar
      // and the colour threshold (default 0.2) ignores a tab change there, so the settings dialog also checks the side bar on its own at threshold 0.
      expect: { toHaveScreenshot: { maxDiffPixels: 300, animations: 'disabled', caret: 'hide' } },
    },
    {
      // The layout scan (`node tools/layout-scan.mjs`): every screen in ja and en, dark and light, at the size of the visual
      // project, checked for layout faults and for text that does not fit (with its tooltips and the menus it opens).
      name: 'layout',
      testMatch: 'layout.spec.ts',
      // A layout fault shows on every run, so one retry hides none; it absorbs a slow start of a worker's first page.
      retries: 1,
      // A click on something the screen no longer has fails after 10 s instead of waiting out the two-minute test (twice,
      // with the retry): a scan broken that way once took eleven minutes instead of under two.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, actionTimeout: 10_000 },
    },
  ],
  webServer:
    SERVER === 'build'
      ? {
          // Builds when the sources changed (about 15 s), then serves. Never reused: a server left on the port could be
          // serving an older build, and the layout scan records a pass for the sources it ran on.
          command: `node scripts/e2e-server.mjs --port ${PORT}`,
          url: BASE_URL,
          reuseExistingServer: false,
          timeout: 300_000,
        }
      : {
          command: `npx vite --port ${PORT} --strictPort`,
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
});
