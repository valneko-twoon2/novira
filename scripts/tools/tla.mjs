#!/usr/bin/env node
// Model-checks the TLA+ specs in backend/crates/novira-core/formal/ with TLC.
//
//   node scripts/tools/tla.mjs [Name...]     check Queue.tla (and every other spec with a .cfg) or only the named ones
//
// TLC needs Java 11 or newer; the machine's Java may be older, so a portable JDK 17 and tla2tools.jar are fetched once into
// novira-data/work/tools (not into the system). Run it as `node scripts/tools/checks.mjs tla`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tools = join(root, 'novira-data', 'work', 'tools');
const specs = join(root, 'backend', 'crates', 'novira-core', 'formal');
const JAR = join(tools, 'tla2tools.jar');
const JAR_URL = 'https://github.com/tlaplus/tlaplus/releases/latest/download/tla2tools.jar';
const JDK_URL = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse';

async function download(url, to) {
  const reply = await fetch(url, { redirect: 'follow' });
  if (!reply.ok) throw new Error(`${url}: HTTP ${reply.status}`);
  writeFileSync(to, Buffer.from(await reply.arrayBuffer()));
}

/** The java.exe of the portable JDK, fetched when missing. */
export async function javaPath() {
  mkdirSync(tools, { recursive: true });
  const find = () => readdirSync(tools).find((d) => d.startsWith('jdk-17'));
  if (!find()) {
    console.log('tla: fetching a portable JDK 17 into novira-data/work/tools (once)');
    const zip = join(tools, 'jdk17.zip');
    await download(JDK_URL, zip);
    const run = spawnSync('tar', ['-xf', zip, '-C', tools], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error('tla: could not unpack the JDK');
  }
  if (!existsSync(JAR)) {
    console.log('tla: fetching tla2tools.jar into novira-data/work/tools (once)');
    const part = `${JAR}.part`;
    await download(JAR_URL, part);
    renameSync(part, JAR);
  }
  return join(tools, find(), 'bin', 'java.exe');
}

const wanted = process.argv.slice(2);
const names = readdirSync(specs)
  .filter((f) => f.endsWith('.cfg'))
  .map((f) => f.slice(0, -4))
  .filter((n) => !wanted.length || wanted.includes(n));
if (!names.length) {
  console.error(`tla: no spec to check (in ${specs}${wanted.length ? `, named ${wanted.join(', ')}` : ''})`);
  process.exit(1);
}
const java = await javaPath();
const states = join(root, 'novira-data', 'work', 'tla-states');
mkdirSync(states, { recursive: true });
let failed = false;
for (const name of names) {
  console.log(`tla: ${name}.tla`);
  const run = spawnSync(java, ['-XX:+UseParallelGC', '-cp', JAR, 'tlc2.TLC', '-metadir', states, '-config', `${name}.cfg`, `${name}.tla`], {
    cwd: specs,
    stdio: 'inherit',
  });
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
