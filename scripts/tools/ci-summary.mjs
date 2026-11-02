// Writes the breakdown of a CI run's tests as Markdown for the job summary ($GITHUB_STEP_SUMMARY), so a run shows how many
// tests ran, not only that it passed. vitest prints its own summary; this adds what cargo and Playwright do not.
//   node scripts/tools/ci-summary.mjs cargo <title> <log>...      the output of `cargo test`, one log per crate (named by its file)
//   node scripts/tools/ci-summary.mjs playwright <title> <json>   the JSON report of `playwright test --reporter=json`
// The Markdown goes to stdout. A missing or unreadable input gives a line saying so and still exits 0: a summary never fails a run.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ZERO = () => ({ passed: 0, failed: 0, ignored: 0 });

/** The test binaries in the output of `cargo test`: `[{ name, passed, failed, ignored }]`, in the order they ran. Pure. */
export function parseCargo(text) {
  const rows = [];
  let name = '';
  for (const line of String(text).split(/\r?\n/)) {
    const run = /^\s*Running (?:unittests )?(.+?) \(/.exec(line);
    if (run) {
      name = run[1].replace(/\\/g, '/').replace(/^tests\//, '');
      continue;
    }
    const doc = /^\s*Doc-tests (.+)$/.exec(line);
    if (doc) {
      name = `doc-tests ${doc[1]}`;
      continue;
    }
    const result = /^test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored/.exec(line);
    if (result) rows.push({ name: name || '(unnamed)', passed: Number(result[1]), failed: Number(result[2]), ignored: Number(result[3]) });
  }
  return rows;
}

const total = (rows) => rows.reduce((t, r) => ({ passed: t.passed + r.passed, failed: t.failed + r.failed, ignored: t.ignored + r.ignored }), ZERO());
const line = (t) => `${t.passed} passed, ${t.failed} failed, ${t.ignored} ignored`;

/** Markdown for the logs of several crates: a total per crate, the binaries behind it in a fold. Pure. */
export function cargoMarkdown(title, crates) {
  const all = total(crates.flatMap((c) => c.rows));
  const out = [`## ${title}`, '', `**${line(all)}** in ${crates.reduce((n, c) => n + c.rows.length, 0)} test binaries`, ''];
  for (const { name, rows, missing } of crates) {
    if (missing) {
      out.push(`- \`${name}\`: no log (the step did not run)`, '');
      continue;
    }
    out.push(`<details><summary><b>${name}</b>: ${line(total(rows))} (${rows.length} binaries)</summary>`, '', '| binary | passed | failed | ignored |', '|---|---:|---:|---:|');
    for (const r of rows) out.push(`| ${r.name} | ${r.passed} | ${r.failed} | ${r.ignored} |`);
    out.push('', '</details>', '');
  }
  return out.join('\n');
}

/** Counts per project and per spec file from a Playwright JSON report: `{ projects: Map, files: Map }`. A test counts once, by its final status. Pure. */
export function parsePlaywright(report) {
  const projects = new Map();
  const files = new Map();
  const add = (map, key, status) => {
    const c = map.get(key) ?? { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    c[status] += 1;
    map.set(key, c);
  };
  const walk = (suite, file) => {
    const here = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const status = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' }[t.status] ?? 'failed';
        add(projects, t.projectName ?? '(project)', status);
        add(files, `${t.projectName ?? '(project)'} ${here ?? spec.file ?? ''}`.trim(), status);
      }
    }
    for (const s of suite.suites ?? []) walk(s, here);
  };
  for (const s of report.suites ?? []) walk(s, s.file);
  return { projects, files };
}

const sum = (map) => [...map.values()].reduce((t, c) => ({ passed: t.passed + c.passed, failed: t.failed + c.failed, flaky: t.flaky + c.flaky, skipped: t.skipped + c.skipped }), { passed: 0, failed: 0, flaky: 0, skipped: 0 });
const pline = (c) => `${c.passed} passed, ${c.failed} failed, ${c.flaky} flaky, ${c.skipped} skipped`;

/** Markdown for a parsed Playwright report. Pure. */
export function playwrightMarkdown(title, { projects, files }) {
  const out = [`## ${title}`, '', `**${pline(sum(projects))}**`, '', '| project | passed | failed | flaky | skipped |', '|---|---:|---:|---:|---:|'];
  for (const [name, c] of projects) out.push(`| ${name} | ${c.passed} | ${c.failed} | ${c.flaky} | ${c.skipped} |`);
  out.push('', `<details><summary>per spec file (${files.size})</summary>`, '', '| project and file | passed | failed | flaky | skipped |', '|---|---:|---:|---:|---:|');
  for (const [name, c] of [...files].sort((a, b) => a[0].localeCompare(b[0]))) out.push(`| ${name} | ${c.passed} | ${c.failed} | ${c.flaky} | ${c.skipped} |`);
  out.push('', '</details>', '');
  return out.join('\n');
}

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** The Markdown for the command line `args`; reads the files. */
export function run(args) {
  const [kind, title, ...inputs] = args;
  if (kind === 'cargo') {
    const crates = inputs.map((file) => {
      const text = readOrNull(file);
      return { name: path.basename(file, path.extname(file)), rows: text === null ? [] : parseCargo(text), missing: text === null };
    });
    return cargoMarkdown(title, crates);
  }
  if (kind === 'playwright') {
    const text = readOrNull(inputs[0]);
    try {
      return playwrightMarkdown(title, parsePlaywright(JSON.parse(text ?? '')));
    } catch {
      return `## ${title}\n\nNo report to read (the step did not run or wrote no JSON).\n`;
    }
  }
  return `usage: ci-summary.mjs cargo|playwright <title> <file>...\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.stdout.write(`${run(process.argv.slice(2))}\n`);
