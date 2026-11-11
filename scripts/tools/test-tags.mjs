// Counts the tests of the repository by kind (手法) and by design technique (設計技法), and writes the table into docs/tests/README.md.
//   node scripts/tools/test-tags.mjs                      print the tables
//   node scripts/tools/test-tags.mjs --write              rewrite the section of docs/tests/README.md between the markers
//   node scripts/tools/test-tags.mjs --check              exit 1 when a tag is unknown or the section is stale (the test in frontend/tests/test-tags.test.ts runs this)
//   node scripts/tools/test-tags.mjs --untagged [prefix]  list the tests with no technique tag (file:line), for the files under the prefix
//
// Two axes:
//   kind       what the test is (unit, property, e2e...). Taken from the file's place and name; an explicit kind tag on a test or a
//              group overrides it.
//   technique  how its cases were chosen (boundary, equivalence...). Always written by hand as a tag; a test with none is counted "untagged".
// Where tags are written (the same words everywhere):
//   vitest      it('name', { tags: ['boundary'] }, fn)   describe('name', { tags: [...] }, fn)   (inherited by the tests inside)
//   Playwright  test('name', { tag: ['@boundary'] }, fn)  test.describe('name', { tag: '@boundary' }, fn)
//   Rust        `// tags: boundary, equivalence` on the line above `#[test]` (or above `mod x {`, for every test inside);
//               `//! tags: ...` at the top of a file for the whole file.
// Counts are of declarations found in the source: an `it.each` over an inline or same-file constant array counts its rows, a test made in
// a loop counts once.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Design techniques: how the cases of a test were chosen. A test can carry several. */
export const TECHNIQUES = [
  { name: 'equivalence', label: '同値分割', about: '入力の区分ごとに代表を取る（有効・無効の各区分）' },
  { name: 'boundary', label: '境界値', about: '上限・下限、その前後、0・空' },
  { name: 'condition', label: '分岐・条件網羅', about: 'if・match の両側、複数条件の各項を真偽に振る' },
  { name: 'decision-table', label: 'デシジョンテーブル・ペアワイズ', about: '複数の入力が一緒に結果を決める規則を、組み合わせで確かめる' },
  { name: 'state-transition', label: '状態遷移', about: '状態と事象の組。許される遷移と拒まれる遷移' },
  { name: 'error-guessing', label: 'エラー推測', about: '壊れたデータ、敵対的な入力、失敗する外部（ディスク・通信）' },
  { name: 'scenario', label: 'シナリオ', about: '利用者の流れや典型的な使い方を通しで確かめる' },
  { name: 'regression', label: '回帰', about: '見つかった不具合を再現し、再発を止める' },
];

/** Kinds: what the test is. Mostly decided by where the file is (see `kindOf`); a tag overrides it. */
export const KINDS = [
  { name: 'unit', label: '単体', about: '関数・モジュールを単独で（フロントの状態やロジック、Rust のモジュール内、道具のスクリプト）' },
  { name: 'component', label: '部品', about: 'React の部品を描画して操作する' },
  { name: 'integration', label: '結合', about: '複数のモジュールや本物のサービス・ファイル・SQLite・疑似サーバーをつないで動かす' },
  { name: 'contract', label: '契約', about: 'フロントとバックエンドの型、JSON フィクスチャ、ノード定義の一致' },
  { name: 'snapshot', label: 'スナップショット', about: '大きな出力（グラフなど）を保存した形と比べる' },
  { name: 'property', label: '性質ベース', about: 'fast-check・proptest の乱数入力で、常に成り立つ性質を確かめる' },
  { name: 'model-based', label: 'モデルベース', about: '操作列を単純なモデルと並べて実行し、状態を比べる' },
  { name: 'fuzz', label: 'ファジング', about: 'バイト列・コマンド・リクエストを崩して、落ちないことを確かめる' },
  { name: 'differential', label: '差分', about: '二つの実装（モックと本物）に同じ操作をして、答えを比べる' },
  { name: 'metamorphic', label: 'メタモルフィック', about: '入力を変えたとき、出力が満たすべき関係を確かめる' },
  { name: 'monkey', label: 'モンキー', about: '画面を乱暴に操作して、壊れないことを確かめる' },
  { name: 'e2e', label: 'E2E', about: 'ブラウザで画面を通しで操作する（Playwright）' },
  { name: 'visual', label: '見た目', about: 'スクリーンショットを基準画像と比べる' },
  { name: 'layout', label: 'レイアウト', about: 'はみ出し・重なり・幅の規則を、画面を開いて測る' },
  { name: 'accessibility', label: 'アクセシビリティ', about: 'キーボード、コントラスト、動きの抑制、拡大表示' },
  { name: 'performance', label: '性能', about: '時間・サイズの予算' },
  { name: 'crash', label: 'クラッシュ時', about: '書き込みの途中で止まったときの整合性、復元' },
  { name: 'old-data', label: '旧データ', about: '古い版が作ったデータを新しい版で開く' },
  { name: 'security', label: 'セキュリティ', about: '設定・ソースの走査、秘密情報、入力の検証' },
  { name: 'static', label: '静的検査', about: 'ソース・文書・設定・規則の形をツリー全体で検査する' },
  { name: 'live', label: '実エンジン', about: '本物の外部（ComfyUI、Civitai、Hugging Face、モデル）に当てる。普段は回さない' },
];

const KIND_NAMES = new Set(KINDS.map((k) => k.name));
const TECHNIQUE_NAMES = new Set(TECHNIQUES.map((t) => t.name));
export const TAG_NAMES = [...KINDS, ...TECHNIQUES].map((t) => t.name);
/** The tags as vitest's config wants them (`test.tags`); a tag outside this list stops the run. */
export const TAG_DEFINITIONS = [...KINDS, ...TECHNIQUES].map((t) => ({ name: t.name, description: `${t.label}: ${t.about}` }));

const MARK_START = '<!-- test-counts:start (node scripts/tools/test-tags.mjs --write) -->';
const MARK_END = '<!-- test-counts:end -->';
const DOC = 'docs/tests/README.md';

// ---------------------------------------------------------------------------------------------------------------- kinds by place

/** The kind of a test file from its path (relative to the repository root, forward slashes). */
export function kindOf(file) {
  const f = file.replaceAll('\\', '/');
  const base = f.slice(f.lastIndexOf('/') + 1);
  if (f.startsWith('frontend/difftest/')) return 'differential';
  if (f.startsWith('frontend/e2e/visual/')) return 'visual';
  if (f.startsWith('frontend/e2e/')) {
    if (/^a11y/.test(base)) return 'accessibility';
    if (/^monkey/.test(base)) return 'monkey';
    if (/^layout|^main-area-frames|^panelWidths|^preset-width/.test(base)) return 'layout';
    if (/^perf/.test(base)) return 'performance';
    return 'e2e';
  }
  if (f.startsWith('frontend/')) {
    if (/\.property\.test\./.test(base)) return 'property';
    if (/\.snapshot\.test\./.test(base)) return 'snapshot';
    if (/contract/i.test(base)) return 'contract';
    if (f.startsWith('frontend/src/') && base.endsWith('.tsx')) return 'component';
    return 'unit';
  }
  // Rust
  if (/\/(prop_[^/]*|[^/]*_prop)\.rs$|\/prop_[^/]*\//.test(f)) return 'property';
  if (/fuzz/.test(base) || /\/fuzz\//.test(f)) return 'fuzz';
  if (/_live\.rs$/.test(base)) return 'live';
  if (/\/tests\/contract\//.test(f)) return 'contract';
  if (/^meta_/.test(base)) return 'metamorphic';
  if (/model_tests\//.test(f)) return 'model-based';
  if (/crash_tests\.rs$/.test(base)) return 'crash';
  if (/old_data/.test(base)) return 'old-data';
  if (/src-tauri\/tests\/(security|robustness|window_config)/.test(f)) return 'security';
  if (/\/tests\//.test(f)) return 'integration';
  return 'unit';
}

// ---------------------------------------------------------------------------------------------------------------- file lists

function trackedFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean).filter((f) => existsSync(path.join(root, f)));
}

/** { file, runner } of every file that holds tests. */
export function testFiles(root = ROOT, files = trackedFiles(root)) {
  const found = [];
  for (const f of files) {
    if (/^frontend\/(src|tests)\/.*\.test\.tsx?$/.test(f)) found.push({ file: f, runner: 'vitest' });
    else if (/^frontend\/difftest\/.*\.difftest\.ts$/.test(f)) found.push({ file: f, runner: 'vitest' });
    else if (/^frontend\/e2e\/.*\.spec\.ts$/.test(f)) found.push({ file: f, runner: 'playwright' });
    else if (/^backend\/.*\.rs$/.test(f) && !f.includes('/target/') && !f.startsWith('backend/crates/novira-core/examples/')) found.push({ file: f, runner: 'cargo' });
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------- TypeScript

let ts;
function typescript(root) {
  ts ??= createRequire(path.join(root, 'frontend', 'package.json'))('typescript');
  return ts;
}

const GROUP_ROOTS = new Set(['describe', 'suite']);
const TEST_ROOTS = new Set(['it', 'test']);
const NOT_A_DEFINITION = new Set(['step', 'use', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll', 'setTimeout', 'extend', 'info', 'slow', 'fixme', 'todo', 'expect', 'fail', 'configure', 'only_']);

/**
 * The tests of one TypeScript source: [{ line, tags: string[] (as written, no `@`), count }].
 * `tags` are the ones given to the test and to every group around it.
 */
export function parseTypescript(source, fileName, root = ROOT) {
  const T = typescript(root);
  const sf = T.createSourceFile(fileName, source, T.ScriptTarget.Latest, true, fileName.endsWith('x') ? T.ScriptKind.TSX : T.ScriptKind.TS);
  const tests = [];
  const arrays = new Map(); // const name -> row count, for it.each(name)

  for (const st of sf.statements) {
    if (!T.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (!T.isIdentifier(d.name) || !d.initializer) continue;
      const init = unwrap(T, d.initializer);
      if (T.isArrayLiteralExpression(init)) arrays.set(d.name.text, init.elements.length);
    }
  }

  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const stringsOf = (node) => {
    node = unwrap(T, node);
    if (T.isStringLiteralLike(node)) return [node.text];
    if (T.isArrayLiteralExpression(node)) return node.elements.flatMap((e) => (T.isStringLiteralLike(unwrap(T, e)) ? [unwrap(T, e).text] : []));
    return [];
  };
  const optionTags = (obj) => {
    obj = unwrap(T, obj);
    if (!T.isObjectLiteralExpression(obj)) return [];
    const tags = [];
    for (const p of obj.properties) {
      if (!T.isPropertyAssignment(p)) continue;
      const key = T.isIdentifier(p.name) || T.isStringLiteral(p.name) ? p.name.text : '';
      if (key === 'tags' || key === 'tag') tags.push(...stringsOf(p.initializer).map((t) => t.replace(/^@/, '')));
    }
    return tags;
  };

  /** What a call is: null, or { group, rows } from its callee chain (`it.each(rows).skip`, `describe.runIf(c)`, `test.describe.serial`...). */
  const classify = (call) => {
    let expr = call.expression;
    const props = [];
    let rows = 1;
    let each = false;
    for (;;) {
      if (T.isCallExpression(expr)) {
        if (props.length || each) {
          // `it.each(rows)` or `it.runIf(cond)`: a call inside the chain.
        }
        const inner = expr.expression;
        if (T.isPropertyAccessExpression(inner) && inner.name.text === 'each') {
          each = true;
          rows = rowCount(expr.arguments[0]);
        }
        expr = inner;
      } else if (T.isPropertyAccessExpression(expr)) {
        props.push(expr.name.text);
        expr = expr.expression;
      } else if (T.isTaggedTemplateExpression(expr)) {
        const inner = expr.tag;
        if (T.isPropertyAccessExpression(inner) && inner.name.text === 'each') {
          each = true;
          rows = Math.max(1, expr.template.getText(sf).split('\n').length - 2);
        }
        expr = inner;
      } else break;
    }
    if (!T.isIdentifier(expr)) return null;
    const root = expr.text;
    if (props.some((p) => NOT_A_DEFINITION.has(p))) return null;
    if (props.includes('todo')) return null;
    if (GROUP_ROOTS.has(root) || (root === 'test' && props.includes('describe'))) return { group: true, rows };
    if (TEST_ROOTS.has(root)) return { group: false, rows };
    return null;
  };
  const rowCount = (arg) => {
    if (!arg) return 1;
    const a = unwrap(T, arg);
    if (T.isArrayLiteralExpression(a)) return a.elements.length;
    if (T.isIdentifier(a) && arrays.has(a.text)) return arrays.get(a.text);
    return 1;
  };

  const visit = (node, inherited, multiplier) => {
    if (T.isCallExpression(node)) {
      const c = classify(node);
      const args = node.arguments;
      const fn = args.length ? args[args.length - 1] : null;
      if (c && fn && (T.isArrowFunction(fn) || T.isFunctionExpression(fn) || (!c.group && args.length >= 2 && !T.isObjectLiteralExpression(unwrap(T, fn))))) {
        const own = args.length >= 3 ? optionTags(args[1]) : [];
        const tags = [...new Set([...inherited, ...own])];
        if (c.group) {
          if (T.isArrowFunction(fn) || T.isFunctionExpression(fn)) for (const s of fn.body.statements ?? [fn.body]) visit(s, tags, multiplier * c.rows);
          return;
        }
        tests.push({ line: line(node), tags, count: c.rows * multiplier });
        return;
      }
    }
    T.forEachChild(node, (child) => visit(child, inherited, multiplier));
  };
  visit(sf, [], 1);
  return tests;
}

function unwrap(T, node) {
  while (T.isParenthesizedExpression(node) || T.isAsExpression(node) || T.isSatisfiesExpression?.(node) || T.isNonNullExpression(node)) node = node.expression;
  return node;
}

// ---------------------------------------------------------------------------------------------------------------- Rust

const TAGS_LINE = /^\s*\/\/[!/]?\s*tags:\s*(.*?)\s*$/;
const tagList = (text) => text.split(/[,\s]+/).filter(Boolean);

/** Source with comments, strings and char literals blanked (same length, same newlines), so braces can be counted. */
export function blankRust(src) {
  let out = '';
  let i = 0;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '/' && next === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < src.length && depth) {
        if (src[j] === '/' && src[j + 1] === '*') (depth++, (j += 2));
        else if (src[j] === '*' && src[j + 1] === '/') (depth--, (j += 2));
        else j++;
      }
      out += blank(src.slice(i, j));
      i = j;
    } else if (c === 'r' && /^r#*"/.test(src.slice(i, i + 12)) && !/[\w]/.test(src[i - 1] ?? ' ')) {
      const hashes = /^r(#*)"/.exec(src.slice(i, i + 12))[1];
      const close = `"${hashes}`;
      const start = i + 2 + hashes.length;
      const end = src.indexOf(close, start);
      const stop = end < 0 ? src.length : end + close.length;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      out += blank(src.slice(i, j + 1));
      i = j + 1;
    } else if (c === "'" && /^'(\\.[^']*|[^\\'])'/.test(src.slice(i, i + 12))) {
      const m = /^'(\\.[^']*|[^\\'])'/.exec(src.slice(i, i + 12));
      out += blank(m[0]);
      i += m[0].length;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The tests of one Rust source: [{ line, tags, count: 1 }]. */
export function parseRust(source) {
  const lines = source.split('\n');
  const blanked = blankRust(source).split('\n');
  const fileTags = [];
  for (const l of lines) {
    if (/^\s*\/\/!/.test(l)) {
      const m = TAGS_LINE.exec(l);
      if (m) fileTags.push(...tagList(m[1]));
    } else if (l.trim() && !/^\s*\/\//.test(l)) break;
  }
  // mod blocks with a `// tags:` line above them: [start line, end line, tags]
  const blocks = [];
  let depth = 0;
  const open = []; // { depth, tags, from }
  let pending = null;
  const tests = [];
  let testAttr = null; // line of the attribute waiting for its fn
  for (let n = 0; n < lines.length; n++) {
    const raw = lines[n];
    const code = blanked[n];
    const tagMatch = TAGS_LINE.exec(raw);
    if (tagMatch && !/^\s*\/\/!/.test(raw)) {
      pending = { tags: tagList(tagMatch[1]) };
      continue;
    }
    const trimmed = code.trim();
    if (/^#\[(tokio::)?test(\(.*\))?\]/.test(trimmed) || /^#\[test_case/.test(trimmed)) {
      testAttr = { line: n + 1, tags: pending?.tags ?? [] };
      pending = pending && null;
    } else if (trimmed === '' && !pending) {
      // a blank line keeps nothing
    } else if (/^#\[/.test(trimmed)) {
      // another attribute between the tag line and the item: keep what is pending
    } else if (pending && /^(pub(\([^)]*\))?\s+)?mod\s+\w+\s*\{/.test(trimmed)) {
      open.push({ depth, tags: pending.tags });
      pending = null;
    } else if (!trimmed.startsWith('#') && trimmed !== '') {
      pending = null;
    }
    if (testAttr && /\bfn\s+\w+/.test(trimmed)) {
      const inherited = open.flatMap((o) => o.tags);
      tests.push({ line: testAttr.line, tags: [...new Set([...fileTags, ...inherited, ...testAttr.tags])], count: 1 });
      testAttr = null;
    }
    for (const ch of code) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        while (open.length && open[open.length - 1].depth >= depth) open.pop();
      }
    }
  }
  void blocks;
  return tests;
}

// ---------------------------------------------------------------------------------------------------------------- collect and count

/** Every test: [{ file, line, runner, kinds, techniques, unknown, count }]. */
export function collect(root = ROOT, files = testFiles(root)) {
  const all = [];
  for (const { file, runner } of files) {
    const source = readFileSync(path.join(root, file), 'utf8');
    let found;
    try {
      found = runner === 'cargo' ? parseRust(source) : parseTypescript(source, file, root);
    } catch (e) {
      throw new Error(`${file}: ${e.message}`);
    }
    for (const t of found) {
      const kinds = t.tags.filter((x) => KIND_NAMES.has(x));
      all.push({
        file,
        line: t.line,
        runner,
        kinds: kinds.length ? kinds : [kindOf(file)],
        techniques: t.tags.filter((x) => TECHNIQUE_NAMES.has(x)),
        unknown: t.tags.filter((x) => !KIND_NAMES.has(x) && !TECHNIQUE_NAMES.has(x)),
        count: t.count,
      });
    }
  }
  return all;
}

const RUNNERS = [['vitest', 'フロント（vitest）'], ['playwright', 'ブラウザ（Playwright）'], ['cargo', 'バックエンド（cargo）']];

/** The Markdown section: the totals, the kind table, the technique table and their cross table. */
export function render(tests) {
  const total = (list) => list.reduce((s, t) => s + t.count, 0);
  const by = (pred) => total(tests.filter(pred));
  const lines = [];
  lines.push(`宣言されたテストは全部で **${total(tests)} 件**（${RUNNERS.map(([r, name]) => `${name} ${by((t) => t.runner === r)}`).join('、')}）。ソースを静的に数えた件数で、\`it.each\` は行数、ループで作るテストは 1 件と数える。`);
  lines.push('');
  lines.push('### 手法別');
  lines.push('');
  lines.push(`| 手法 | ${RUNNERS.map(([, n]) => n).join(' | ')} | 計 | 内容 |`);
  lines.push(`|---|${RUNNERS.map(() => '---:').join('|')}|---:|---|`);
  for (const k of KINDS) {
    const mine = tests.filter((t) => t.kinds.includes(k.name));
    if (!mine.length) continue;
    lines.push(`| ${k.label}（\`${k.name}\`） | ${RUNNERS.map(([r]) => total(mine.filter((t) => t.runner === r)) || '-').join(' | ')} | ${total(mine)} | ${k.about} |`);
  }
  lines.push('');
  lines.push('### 設計技法別');
  lines.push('');
  lines.push('技法は 1 つのテストに複数付けてよいので、合計は全体の件数と一致しない。タグのないテストは「未分類」に数える。');
  lines.push('');
  lines.push(`| 技法 | ${RUNNERS.map(([, n]) => n).join(' | ')} | 計 | 内容 |`);
  lines.push(`|---|${RUNNERS.map(() => '---:').join('|')}|---:|---|`);
  for (const t of TECHNIQUES) {
    const mine = tests.filter((x) => x.techniques.includes(t.name));
    lines.push(`| ${t.label}（\`${t.name}\`） | ${RUNNERS.map(([r]) => total(mine.filter((x) => x.runner === r)) || '-').join(' | ')} | ${total(mine) || '-'} | ${t.about} |`);
  }
  const untagged = tests.filter((x) => !x.techniques.length);
  lines.push(`| 未分類 | ${RUNNERS.map(([r]) => total(untagged.filter((x) => x.runner === r)) || '-').join(' | ')} | ${total(untagged) || '-'} | 技法のタグがまだ付いていない |`);
  lines.push('');
  lines.push('### 手法 × 技法');
  lines.push('');
  const usedTech = TECHNIQUES;
  lines.push(`| 手法 | ${usedTech.map((t) => t.label).join(' | ')} | 未分類 |`);
  lines.push(`|---|${usedTech.map(() => '---:').join('|')}|---:|`);
  for (const k of KINDS) {
    const mine = tests.filter((t) => t.kinds.includes(k.name));
    if (!mine.length) continue;
    const cells = usedTech.map((t) => total(mine.filter((x) => x.techniques.includes(t.name))) || '-');
    lines.push(`| ${k.label} | ${cells.join(' | ')} | ${total(mine.filter((x) => !x.techniques.length)) || '-'} |`);
  }
  lines.push('');
  lines.push('タグの付け方と語彙は [../../scripts/tools/test-tags.mjs](../../scripts/tools/test-tags.mjs) の冒頭に書いてある。');
  return lines.join('\n');
}

/** The README text with the generated section replaced (or appended before "## 未実装" when the markers are not there yet). */
export function withSection(readme, section) {
  const block = `${MARK_START}\n\n${section}\n\n${MARK_END}`;
  const a = readme.indexOf(MARK_START);
  const b = readme.indexOf(MARK_END);
  if (a >= 0 && b > a) return readme.slice(0, a) + block + readme.slice(b + MARK_END.length);
  const at = readme.indexOf('## 未実装');
  const heading = '## 件数\n\n';
  return at < 0 ? `${readme}\n${heading}${block}\n` : `${readme.slice(0, at)}${heading}${block}\n\n${readme.slice(at)}`;
}

/** Problems that stop the build: a tag nobody defined. */
export function problems(tests) {
  const bad = new Map();
  for (const t of tests) for (const u of t.unknown) bad.set(`${t.file}:${t.line}`, [...(bad.get(`${t.file}:${t.line}`) ?? []), u]);
  return [...bad].map(([where, tags]) => `${where}: unknown tag ${tags.join(', ')}`);
}

function main(argv) {
  const tests = collect();
  const bad = problems(tests);
  if (argv.includes('--untagged')) {
    const prefix = argv[argv.indexOf('--untagged') + 1];
    const p = prefix && !prefix.startsWith('--') ? prefix.replaceAll('\\', '/') : '';
    for (const t of tests) if (!t.techniques.length && t.file.startsWith(p)) console.log(`${t.file}:${t.line}`);
    return 0;
  }
  const readme = readFileSync(path.join(ROOT, DOC), 'utf8');
  const next = withSection(readme, render(tests));
  if (argv.includes('--write')) {
    if (next !== readme) writeFileSync(path.join(ROOT, DOC), next);
    for (const b of bad) console.error(b);
    console.log(`test-tags: ${DOC} ${next !== readme ? 'updated' : 'already current'}`);
    return bad.length ? 1 : 0;
  }
  if (argv.includes('--check')) {
    for (const b of bad) console.error(b);
    if (next !== readme) console.error(`test-tags: the counts in ${DOC} are stale; run node scripts/tools/test-tags.mjs --write`);
    return bad.length || next !== readme ? 1 : 0;
  }
  console.log(render(tests));
  for (const b of bad) console.error(b);
  return bad.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
