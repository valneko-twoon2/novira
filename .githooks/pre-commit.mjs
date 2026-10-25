// The checks of the versioned Git pre-commit hook (.githooks/pre-commit), kept fast so every commit can run them:
//   1. refuse user data, verification output, personal settings and secrets in the index
//      (novira-data/ with everything under novira-data/work/, data/, outputs/, out/, any config.json, .env and .env.*), even when forced past .gitignore;
//   2. line ends of the staged files (tools/check-eol.mjs --staged), and the product name written "novira" in lowercase
//      everywhere (tools/check-name.mjs --staged);
//   3. the languages stay in step: ja and en change together, other languages keep no out-of-date text, and a manual chapter
//      is translated or listed as pending (frontend/scripts/check-i18n-sync.mjs, check-manual-sync.mjs);
//   3b. one concept, one word: when a ja or en catalog, a ja or en manual chapter or the glossary is staged, the staged
//      texts use none of the words frontend/src/i18n/glossary.json forbids (frontend/scripts/check-glossary.mjs --staged);
//   4. the map and the design pages match the repository (tools/docs-check.mjs --git): every folder is named in the map,
//      a path the map writes exists, a code name the docs write still exists, a security boundary change comes with a
//      design page.
//   4b. what drives or describes the screens names only test ids and screen-text keys that still exist (tools/ui-refs.mjs:
//      the e2e specs, the frontend scripts, the tools, the docs and skills against frontend/src and the ja catalog).
//   4c. the frontend type-checks (tools/typecheck.mjs --staged: tsc over src, the tests, the e2e specs and the configs,
//      incremental, when a ts / tsx / mts or a JSON of frontend/ is staged; it reads the working tree).
//   5. (the visual regression is not run here: it is heavy. Run `npm run e2e:visual` by hand when needed.)
//      The layout scan is not run here either, but a commit that changes layout source needs a recorded pass of
//      `node tools/layout-scan.mjs` on exactly what is staged (tools/layout-scan.mjs; checking the record only hashes files).
//   6. the license notices are current: when a dependency, a download or a license text is staged, the notices and the About
//      list are regenerated and staged too (frontend/scripts/oss-licenses.mjs). A package with no license text, or a
//      downloaded file that no entry of oss-downloads.json covers, stops the commit.
// `npm install` in frontend/ turns the hook on (the `prepare` script runs `git config core.hooksPath .githooks`). Run by hand: `node .githooks/pre-commit.mjs`.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateMessage, indexFingerprint, readPasses } from '../tools/layout-scan.mjs';

const FORBIDDEN = [
  { test: /^(novira-data|data|outputs|out)\//, why: 'user data or generated output' },
  { test: /(^|\/)config\.json$/, why: 'personal settings' },
  { test: /(^|\/)\.env(\.[^/]*)?$/, why: 'environment file (may hold API keys)' },
];

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const refused = staged.flatMap((path) => FORBIDDEN.filter((f) => f.test.test(path)).map((f) => `  ${path}  (${f.why})`));
if (refused.length > 0) {
  console.error('pre-commit: these files must not be committed; unstage them with `git restore --staged <path>`:');
  for (const line of refused) console.error(line);
  process.exit(1);
}

const run = (script, ...args) => spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...args], { stdio: 'inherit' }).status ?? 1;
const eol = run('../tools/check-eol.mjs', '--staged');
const name = run('../tools/check-name.mjs', '--staged');
const i18n = run('../frontend/scripts/check-i18n-sync.mjs') || run('../frontend/scripts/check-manual-sync.mjs');
/** Inputs of the terminology check: the ja and en catalogs and manual, the glossary and its checker. */
const GLOSSARY_INPUTS = /^(frontend\/src\/i18n\/(locales\/(ja|en)\/|glossary\.json$)|docs\/manual\/(ja|en)\/|frontend\/scripts\/check-glossary\.mjs$)/;
const glossary = staged.some((path) => GLOSSARY_INPUTS.test(path)) ? run('../frontend/scripts/check-glossary.mjs', '--staged') : 0;
// Both run, so one commit shows every stale page and reference.
const docs = [run('../tools/docs-check.mjs', '--git'), run('../tools/ui-refs.mjs')].some(Boolean) ? 1 : 0;
// Inputs of the license notices: a dependency, a download manifest, a license text or the generator itself.
const LICENSE_INPUTS = [
  /(^|\/)Cargo\.(lock|toml)$/,
  /^frontend\/package(-lock)?\.json$/,
  /^frontend\/scripts\/oss-(licenses\.mjs|downloads\.json|included\.json)$/,
  /^frontend\/scripts\/oss-texts\//,
  /^backend\/crates\/novira-core\/src\/provenance\/files\.json$/,
];
const LICENSE_OUTPUTS = ['THIRD_PARTY_NOTICES.txt', 'frontend/src/features/settings/ossLicenses.json'];

/** Regenerates the license notices and the About list when their inputs are staged, and stages the result. */
function licenses() {
  if (!staged.some((path) => LICENSE_INPUTS.some((re) => re.test(path)))) return 0;
  const generated = spawnSync(process.execPath, [fileURLToPath(new URL('../frontend/scripts/oss-licenses.mjs', import.meta.url))], { stdio: 'inherit' });
  if ((generated.status ?? 1) !== 0) {
    console.error('pre-commit: the license notices could not be made (see above); add the missing license text or download entry, then commit again.');
    return 1;
  }
  execFileSync('git', ['add', '--', ...LICENSE_OUTPUTS]);
  console.log('pre-commit: license notices regenerated and staged');
  return 0;
}

/** Refuses a commit that changes layout source without a recorded pass of the layout scan on what is staged. */
function layout() {
  const changed = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const message = gateMessage(changed, indexFingerprint(), readPasses());
  if (!message) return 0;
  console.error(message);
  return 1;
}

const types = run('../tools/typecheck.mjs', '--staged');
const fast = eol || name || i18n || glossary || docs || types || layout() || licenses();
process.exit(fast);
