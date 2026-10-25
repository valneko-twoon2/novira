// Take a screenshot of the running dev server after a sequence of steps.
// Usage: node scripts/shot.mjs --url http://localhost:5173/ [--out <png>] [steps...]
// Without --out the picture goes to shots/shot.png in the main checkout's novira-data/work/ (never into the repository).
// Steps (run in order): --click <selector> | --theme <light|dark> | --dblclick <selector> | --rclick <selector>
//   | --hover <selector> | --fill <selector>=><text> | --key <key> | --wait <ms> | --size <w>x<h>
// Console errors and page errors are printed so broken screens are visible without opening a browser.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { harnessRoots } from '../../tools/harness-paths.mjs';

const args = process.argv.slice(2);
let url = 'http://localhost:5173/';
let out = join(harnessRoots().work, 'shots', 'shot.png');
let size = { width: 1600, height: 960 };
const steps = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const v = args[i + 1];
  if (a === '--url') url = v;
  else if (a === '--out') out = v;
  else if (a === '--size') {
    const [w, h] = v.split('x').map(Number);
    size = { width: w, height: h };
  } else steps.push([a.slice(2), v]);
  i++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: size });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForSelector('.app', { timeout: 20000 });
for (const [kind, value] of steps) {
  if (kind === 'click') await page.click(value);
  else if (kind === 'dblclick') await page.dblclick(value);
  else if (kind === 'rclick') await page.click(value, { button: 'right' });
  else if (kind === 'hover') await page.hover(value);
  else if (kind === 'fill') {
    const idx = value.indexOf('=>');
    await page.fill(value.slice(0, idx), value.slice(idx + 2));
  } else if (kind === 'key') await page.keyboard.press(value);
  else if (kind === 'theme') await page.evaluate((v) => (document.documentElement.dataset.theme = v), value);
  else if (kind === 'wait') await page.waitForTimeout(Number(value));
  else throw new Error(`unknown step --${kind}`);
}
await page.waitForTimeout(300);
mkdirSync(dirname(resolve(out)), { recursive: true });
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
