// The window half of the model sweep: run by tools/verify-real-app.mjs (the isolated app is up on the debugging port) for one
// phase of tools/models-sweep.mjs, it drives the window with Playwright over CDP and writes `<out>/<phase>.json` and screenshots.
// Per model: (a) the Models screen lists it under its rail entry with its base, (b) its cover shows and loads, (c) the screen
// that draws with it offers it; with NOVIRA_SWEEP_GPU=1, for one model per kind and base: (d) one short job from the screen
// succeeds and (e) the graph ComfyUI received loads that file and the picture is not blank.
// With NOVIRA_SWEEP_VIA=server it is not run by verify-real-app.mjs: models-sweep.mjs starts novira-server (tools/server-run.mjs) and passes
// its address in NOVIRA_SWEEP_URL; the page is then opened in Playwright's own Chromium and the commands go through POST /api/<command>.
// Environment (set by models-sweep.mjs): NOVIRA_SWEEP_VIA, NOVIRA_SWEEP_URL, NOVIRA_SWEEP_OUT, NOVIRA_SWEEP_PHASE (off | on), NOVIRA_SWEEP_DATA, NOVIRA_SWEEP_ROOTS
// (JSON list of the model roots, own first), NOVIRA_SWEEP_CATEGORY, NOVIRA_SWEEP_MODEL, NOVIRA_SWEEP_GPU, NOVIRA_SWEEP_LOOKUP_WAIT.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listProcesses, pythonsWith } from './harness-process.mjs';
import { classificationCheck, comfyNameOf, graphCheck, narrow, pickerOf, pictureCheck, railOf, readCode, representatives } from './models-sweep-lib.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(REPO, 'frontend', 'package.json'))('@playwright/test');
const env = (name, fallback = '') => process.env[name] || fallback;
const OUT = env('NOVIRA_SWEEP_OUT');
const PHASE = env('NOVIRA_SWEEP_PHASE', 'off');
const DATA = env('NOVIRA_SWEEP_DATA');
const ROOTS = JSON.parse(env('NOVIRA_SWEEP_ROOTS', '[]'));
const GPU = env('NOVIRA_SWEEP_GPU') === '1';
const LOOKUP_WAIT_S = Number(env('NOVIRA_SWEEP_LOOKUP_WAIT', '900'));
const code = readCode(REPO);
const log = (m) => console.log(`[models-sweep:${PHASE}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.replace(/[^\w.-]+/g, '_').slice(0, 80);
const shots = path.join(OUT, PHASE);
fs.mkdirSync(shots, { recursive: true });

function catalog(lang) {
  const dir = path.join(REPO, 'frontend', 'src', 'i18n', 'locales', fs.existsSync(path.join(REPO, 'frontend', 'src', 'i18n', 'locales', lang)) ? lang : 'ja');
  return Object.assign({}, ...fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
}

const VIA_SERVER = env('NOVIRA_SWEEP_VIA') === 'server';

async function serverPage() {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await page.goto(env('NOVIRA_SWEEP_URL'));
  return { browser, page };
}

async function appPage() {
  if (VIA_SERVER) return serverPage();
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (let i = 0; i < 60; i++) {
    const page = browser.contexts().flatMap((c) => c.pages()).find((p) => !p.url().startsWith('devtools:'));
    if (page) return { browser, page };
    await sleep(1000);
  }
  throw new Error('no app page over CDP');
}

const { browser, page } = await appPage();
// The same call either way: Tauri IPC in the window, `POST /api/<command>` (the cookie carries the token) through the server.
const invoke = VIA_SERVER
  ? (cmd, args = {}) =>
      page.evaluate(async ([c, a]) => {
        const res = await fetch(`/api/${c}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `${c}: HTTP ${res.status}`);
        return body;
      }, [cmd, args])
  : (cmd, args = {}) => page.evaluate(([c, a]) => window.__TAURI_INTERNALS__.invoke(c, a), [cmd, args]);
await page.getByTestId('tab-models').waitFor({ timeout: 240_000 });
const lang = (await page.evaluate(() => document.documentElement.lang)) || 'ja';
const T = catalog(lang.startsWith('zh') || lang === 'pt-BR' ? lang : lang.split('-')[0]);
const t = (key) => T[key] ?? key;
// Jobs left in the isolated data's queue would start on their own: clear them (this is the verification data, never the user's).
await invoke('clear_queue').catch((e) => log(`clear_queue: ${e}`));

/** Whether an <img> loaded a real picture (waits a little for it). */
async function imageLoaded(img) {
  for (let i = 0; i < 40; i++) {
    const state = await img.evaluate((el) => ({ done: el.complete, width: el.naturalWidth, src: el.currentSrc || el.src })).catch(() => null);
    if (state?.done) return state;
    await sleep(250);
  }
  return img.evaluate((el) => ({ done: el.complete, width: el.naturalWidth, src: el.currentSrc || el.src })).catch(() => ({ done: false, width: 0, src: '' }));
}

/** Check b on one surface: a picture when the record has one, the icon otherwise. */
async function coverCheck(scope, model, where) {
  if (!code.pictureTypes.has(model.type)) return { status: 'n/a', why: 'this kind shows an icon' };
  const img = scope.locator('img').first();
  const has = (await img.count()) > 0;
  if (!model.coverImageUrl) {
    if (has) return { status: 'fail', why: `${where}: shows a picture although the record has none` };
    return { status: 'n/a', why: PHASE === 'off' ? 'no picture stored; with the Civitai lookup off a file put in the folder gets none' : 'no picture stored after the lookup (Civitai has none for this file)' };
  }
  if (!has) return { status: 'fail', why: `${where}: the record has a picture but the icon shows` };
  const state = await imageLoaded(img);
  if (!state.done || state.width === 0) return { status: 'fail', why: `${where}: the picture did not load (${state.src.slice(0, 80)})` };
  return { status: 'pass', why: `${where}: ${state.width}px wide` };
}

async function waitLookup(models) {
  if (PHASE !== 'on') return null;
  const { DatabaseSync } = await import('node:sqlite');
  const started = Date.now();
  const todo = () => models.filter((m) => !m.coverImageUrl).map((m) => m.key);
  let checked = new Set();
  while (Date.now() - started < LOOKUP_WAIT_S * 1000) {
    try {
      const db = new DatabaseSync(path.join(DATA, 'novira.sqlite'), { readOnly: true });
      const row = db.prepare("SELECT value FROM meta WHERE key = 'covers_checked_3'").get();
      db.close();
      checked = new Set(row ? JSON.parse(row.value) : []);
    } catch (e) {
      log(`reading the lookup progress: ${e.message}`);
    }
    const left = todo().filter((k) => !checked.has(k));
    if (!left.length) break;
    log(`Civitai lookup: ${left.length} model(s) not looked up yet`);
    await sleep(15_000);
  }
  return checked;
}

async function openModels() {
  await page.getByTestId('tab-models').click();
  await page.getByTestId('model-manager').waitFor();
}

async function checkListed(model) {
  const rail = railOf(model.type, code.rail);
  if (!rail) return { listed: { status: 'fail', why: `no rail entry lists ${model.type}` }, cover: { status: 'not run', why: 'not listed' } };
  await page.getByTestId(`mm-cat-${rail}`).click();
  await page.getByTestId('mm-search').fill(model.name);
  const item = page.locator('[data-testid="mm-item"]').filter({ has: page.locator('.mm-card-item__media') }).and(page.locator(`[aria-label="${model.name.replaceAll('"', '\\"')}"]`)).first();
  try {
    await item.waitFor({ timeout: 10_000 });
  } catch {
    await page.screenshot({ path: path.join(shots, `missing-${slug(model.name)}.png`) });
    return { listed: { status: 'fail', why: `not listed under the rail entry "${rail}"` }, cover: { status: 'not run', why: 'not listed' } };
  }
  await item.scrollIntoViewIfNeeded();
  const badge = (await item.locator('.mm-card-item__badges .mm-tag--accent').first().textContent())?.trim();
  const cover = await coverCheck(item.locator('.mm-cover'), model, 'Models card');
  await item.screenshot({ path: path.join(shots, `card-${slug(model.name)}.png`) }).catch(() => {});
  const where = comfyNameOf(model.path, ROOTS, code.categories);
  const cls = classificationCheck(model, where, code.categories);
  const want = code.baseLabels[model.base];
  if (badge !== want) return { listed: { status: 'fail', why: `the card says ${badge}, the record ${model.base} (${want})` }, cover };
  return { listed: cls.status === 'pass' ? { status: 'pass', why: `${rail} / ${badge}` } : cls, cover };
}

async function openGenerate() {
  await page.getByTestId('tab-generate').click();
  const image = page.getByTestId('media-image');
  if (await image.count()) await image.click();
  await page.getByTestId('model-picker').waitFor({ timeout: 15_000 });
}

/**
 * Opens the Video screen. Throws, saying how to fix it, when the build has no Video icon: the app's own build hides it for
 * now (`HIDDEN_TABS` in frontend/src/state/ui.ts); the harness builds in the harness mode show it.
 */
async function openVideo() {
  await page.getByTestId('tab-generate').click();
  const icon = page.getByTestId('media-video');
  if ((await icon.count()) === 0) throw new Error('this build has no Video icon (an app build in production mode); rebuild the verification app with --build');
  await icon.click();
}

/** Opens a ModelPicker and searches; returns the option of `name` (or null) and leaves the popover open. */
async function findInPicker(testId, name) {
  const trigger = page.getByTestId(testId);
  if (await trigger.isDisabled()) return null;
  await trigger.click();
  const list = page.getByTestId('model-picker-list');
  await list.waitFor({ timeout: 5_000 });
  await page.keyboard.type(name);
  const option = list.locator('.pp-picker__item').filter({ has: page.locator('.pp-picker__name', { hasText: name }) });
  try {
    await option.first().waitFor({ timeout: 5_000 });
    return option.first();
  } catch {
    return null;
  }
}

async function pickMain(model) {
  await openGenerate();
  const current = (await page.getByTestId('model-picker').textContent())?.trim();
  if (current === model.name) return true;
  const option = await findInPicker('model-picker', model.name);
  if (!option) {
    await page.keyboard.press('Escape');
    return false;
  }
  await option.click();
  await page.waitForFunction(([id, name]) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() === name, ['model-picker', model.name], { timeout: 5_000 });
  return true;
}

/** A main model the Generate screen draws with, of `base` (to show the LoRAs and VAEs of that base). */
function mainOfBase(models, base) {
  return models.find((m) => pickerOf(m, code).picker === 'generate' && (m.base === base || base === 'any'));
}

async function openAdvanced() {
  const section = page.locator('.ui-section').filter({ has: page.locator('.ui-section__toggle', { hasText: t('params.advanced.title') }) }).first();
  const toggle = section.locator('.ui-section__toggle').first();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  return section;
}

async function checkPicker(model, models) {
  const { picker, why } = pickerOf(model, code);
  if (!picker) return { status: 'n/a', why };
  try {
    if (picker === 'generate') {
      if (!(await pickMain(model))) return { status: 'fail', why: 'the Generate screen\'s model picker does not offer it' };
      const card = await coverCheck(page.getByTestId('model-card').locator('.pp-cover').first(), model, 'Generate model card');
      await page.getByTestId('model-card').screenshot({ path: path.join(shots, `picker-${slug(model.name)}.png`) }).catch(() => {});
      return card.status === 'fail' ? card : { status: 'pass', why: 'offered and picked on the Generate screen' };
    }
    if (picker === 'lora' || picker === 'vae') {
      const main = mainOfBase(models, model.base);
      if (!main) return { status: 'not run', why: `no main model of base ${model.base} to show it with` };
      if (!(await pickMain(main))) return { status: 'fail', why: `could not pick ${main.name} to show it with` };
      if (picker === 'lora') {
        const option = await findInPicker('lora-picker', model.name);
        await page.keyboard.press('Escape');
        return option ? { status: 'pass', why: `offered by the LoRA picker with ${main.name}` } : { status: 'fail', why: `the LoRA picker does not offer it with ${main.name} (${main.base})` };
      }
      const section = await openAdvanced();
      await section.getByRole('combobox', { name: t('params.advanced.vae'), exact: true }).click();
      const option = page.getByRole('option', { name: model.name, exact: true });
      const seen = await option.waitFor({ timeout: 5_000 }).then(() => true, () => false);
      await page.keyboard.press('Escape');
      return seen ? { status: 'pass', why: `offered by the VAE select with ${main.name}` } : { status: 'fail', why: `the VAE select does not offer it with ${main.name} (${main.base})` };
    }
    if (picker === 'video') {
      await openVideo();
      const select = page.getByTestId('video-model');
      const shown = await select.waitFor({ timeout: 10_000 }).then(() => true, () => false);
      if (!shown) {
        await page.screenshot({ path: path.join(shots, `video-${slug(model.name)}.png`) });
        return { status: 'fail', why: 'the Video screen shows no model select' };
      }
      await select.click();
      const option = page.getByRole('option', { name: `${model.name} (${code.baseLabels[model.base]})`, exact: true });
      const seen = await option.waitFor({ timeout: 5_000 }).then(() => true, () => false);
      await page.keyboard.press('Escape');
      return seen ? { status: 'pass', why: 'offered on the Video screen' } : { status: 'fail', why: 'the Video screen does not offer it' };
    }
  } catch (e) {
    await page.screenshot({ path: path.join(shots, `error-${slug(model.name)}.png`) }).catch(() => {});
    return { status: 'fail', why: `driving the ${picker} picker failed: ${e.message.split('\n')[0]}` };
  }
  return { status: 'n/a', why: 'no picker' };
}

// --- GPU part ---

/** The port of the verification ComfyUI (its python's command line names the copy and `--port`). */
function comfyPort() {
  const out = pythonsWith(listProcesses(), 'comfy-copy', 'main.py').map((p) => p.cmd).join('\n');
  const port = /--port\s+(\d+)/.exec(out)?.[1];
  return port ? Number(port) : null;
}

async function comfyHistory() {
  const port = comfyPort();
  if (!port) return { port: null, entries: {} };
  const res = await fetch(`http://127.0.0.1:${port}/history?max_items=64`).catch(() => null);
  return { port, entries: res?.ok ? await res.json() : {} };
}

async function lastItemId() {
  const snap = await invoke('queue_snapshot');
  return Math.max(0, ...(snap.items ?? []).map((i) => i.id));
}

/** Presses the screen's Invoke button and waits for the job it queued; returns the queue item. */
async function runJob(timeoutMs) {
  const before = await lastItemId();
  const button = page.getByTestId('invoke-button');
  await button.waitFor({ timeout: 10_000 });
  if (await button.isDisabled()) throw new Error('the Invoke button is disabled');
  await button.click();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const snap = await invoke('queue_snapshot');
    const item = (snap.items ?? []).filter((i) => i.id > before).sort((a, b) => b.id - a.id)[0];
    if (item && ['completed', 'failed', 'canceled'].includes(item.status)) return item;
    await sleep(1000);
  }
  throw new Error(`no result after ${Math.round(timeoutMs / 1000)} s`);
}

async function gpuChecks(model, models) {
  const { picker } = pickerOf(model, code);
  const where = comfyNameOf(model.path, ROOTS, code.categories);
  const notRun = (why) => ({ generate: { status: 'not run', why }, graph: { status: 'not run', why }, picture: { status: 'not run', why } });
  if (!where) return notRun('the file is in no scanned folder');
  let main = model;
  if (picker === 'lora' || picker === 'vae') main = mainOfBase(models, model.base);
  // A kind no screen runs a job with (a part, an adapter picked elsewhere) has nothing to generate: n/a, not "not run".
  if (!picker) {
    const na = { status: 'n/a', why: 'the sweep runs no job with this kind' };
    return { generate: na, graph: na, picture: na };
  }
  if (!main) return notRun(`no main model of base ${model.base}`);
  const seen = new Set(Object.keys((await comfyHistory()).entries));
  let item;
  try {
    if (picker === 'video') {
      await openVideo();
      await page.getByTestId('video-model').click();
      await page.getByRole('option', { name: `${model.name} (${code.baseLabels[model.base]})`, exact: true }).click();
      await page.getByTestId('video-prompt').fill('a cute girl with long hair smiling in a flower field, soft light');
      const length = page.getByRole('slider', { name: t('video.lengthLabel') }).first();
      if (await length.count()) {
        await length.focus();
        await page.keyboard.press('Home');
      }
      item = await runJob(20 * 60_000);
    } else {
      if (!(await pickMain(main))) return notRun(`could not pick ${main.name}`);
      if (picker === 'lora') {
        const option = await findInPicker('lora-picker', model.name);
        if (!option) return notRun('the LoRA picker does not offer it');
        await option.click();
      }
      if (picker === 'vae') {
        const section = await openAdvanced();
        await section.getByRole('combobox', { name: t('params.advanced.vae'), exact: true }).click();
        await page.getByRole('option', { name: model.name, exact: true }).click();
      }
      await page.getByTestId('positive-prompt').fill('masterpiece, best quality, a cute girl with long hair smiling in a flower field, soft light');
      try {
        item = await runJob(10 * 60_000);
      } finally {
        if (picker === 'lora') await page.getByTestId('lora-card').getByRole('button', { name: t('params.lora.remove') }).click().catch(() => {});
        if (picker === 'vae') {
          const section = await openAdvanced();
          await section.getByRole('combobox', { name: t('params.advanced.vae'), exact: true }).click();
          await page.getByRole('option', { name: t('params.advanced.vaeDefault'), exact: true }).click().catch(() => page.keyboard.press('Escape'));
        }
      }
    }
  } catch (e) {
    await page.screenshot({ path: path.join(shots, `gpu-error-${slug(model.name)}.png`) }).catch(() => {});
    const why = `the job could not be run from the screen: ${e.message.split('\n')[0]}`;
    return { generate: { status: 'fail', why }, graph: { status: 'not run', why: 'no job' }, picture: { status: 'not run', why: 'no job' } };
  }
  const generate =
    item.status === 'completed'
      ? { status: 'pass', why: `queue item ${item.id} in ${item.completedAt && item.startedAt ? Math.round((item.completedAt - item.startedAt) / 1000) : '?'} s (${main === model ? model.name : `${main.name} + ${model.name}`})` }
      : { status: 'fail', why: `queue item ${item.id} ${item.status}: ${item.error ?? ''}`.trim() };
  const { port, entries } = await comfyHistory();
  const fresh = Object.entries(entries).filter(([id]) => !seen.has(id));
  if (!fresh.length) return { generate, graph: { status: 'fail', why: port ? 'ComfyUI has no new prompt in its history' : 'the verification ComfyUI is not running' }, picture: { status: 'not run', why: 'no prompt' } };
  // The prompt that loads a model file (a job may send a helper prompt too); the last one when several do.
  const [, entry] = fresh.reverse().find(([, e]) => graphCheck(e.prompt?.[2], where.name, code.extensions).files.length) ?? fresh[0];
  const graph = graphCheck(entry.prompt?.[2], where.name, code.extensions);
  fs.writeFileSync(path.join(shots, `graph-${slug(model.name)}.json`), JSON.stringify(entry.prompt?.[2] ?? null, null, 2));
  if (main !== model && graph.status === 'pass') {
    const mainWhere = comfyNameOf(main.path, ROOTS, code.categories);
    const alsoMain = mainWhere && graphCheck(entry.prompt?.[2], mainWhere.name, code.extensions);
    if (alsoMain && alsoMain.status !== 'pass') Object.assign(graph, { status: 'fail', why: `loads ${model.name} but not ${main.name}` });
  }
  if (picker === 'video') return { generate, graph, picture: { status: 'n/a', why: 'a clip: the blank check reads pictures only' } };
  const image = Object.values(entry.outputs ?? {}).flatMap((o) => o.images ?? [])[0];
  if (!image) return { generate, graph, picture: { status: 'fail', why: 'ComfyUI reports no picture for the prompt' } };
  const q = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' });
  const res = await fetch(`http://127.0.0.1:${port}/view?${q}`).catch(() => null);
  if (!res?.ok) return { generate, graph, picture: { status: 'fail', why: `ComfyUI did not serve the picture (${res?.status ?? 'no answer'})` } };
  const png = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(shots, `result-${slug(model.name)}.png`), png);
  return { generate, graph, picture: pictureCheck(png) };
}

// --- run ---

const boot = await invoke('bootstrap');
const all = narrow(boot.models, { category: env('NOVIRA_SWEEP_CATEGORY') || undefined, model: env('NOVIRA_SWEEP_MODEL') || undefined }, code);
log(`${boot.models.length} model(s) in the app, ${all.length} swept`);
const checked = await waitLookup(boot.models);
// After the lookup the records may carry new pictures: read them again, and reload so the screens show them.
const models = checked ? narrow((await invoke('bootstrap')).models, { category: env('NOVIRA_SWEEP_CATEGORY') || undefined, model: env('NOVIRA_SWEEP_MODEL') || undefined }, code) : all;
if (checked) {
  await page.reload();
  await page.getByTestId('tab-models').waitFor({ timeout: 120_000 });
}
const results = {};
await openModels();
await page.screenshot({ path: path.join(shots, 'models-screen.png') });
for (const m of models) {
  const r = await checkListed(m).catch((e) => ({ listed: { status: 'fail', why: e.message.split('\n')[0] }, cover: { status: 'not run', why: 'error' } }));
  if (PHASE === 'on' && r.cover.status === 'n/a' && !m.coverImageUrl && checked && !checked.has(m.key) && code.pictureTypes.has(m.type)) {
    r.cover = { status: 'fail', why: `the Civitai lookup did not reach this file within ${LOOKUP_WAIT_S} s` };
  }
  results[m.key] = { listed: r.listed, cover: r.cover };
}
for (const m of models) results[m.key].picker = await checkPicker(m, boot.models);
if (GPU) {
  for (const m of representatives(models)) {
    log(`GPU: ${m.name} (${m.type} / ${m.base})`);
    Object.assign(results[m.key], await gpuChecks(m, boot.models));
  }
}
fs.writeFileSync(path.join(OUT, `${PHASE}.json`), JSON.stringify({ phase: PHASE, lang, models, results, packs: boot.packs ?? null, lookupChecked: checked ? [...checked] : null }, null, 2));
log(`wrote ${path.join(OUT, `${PHASE}.json`)}`);
await browser.close().catch(() => {});
