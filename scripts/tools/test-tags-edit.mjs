// Reads and edits the tags of tests (the counting is scripts/tools/test-tags.mjs).
//   node scripts/tools/test-tags-edit.mjs --list <file>              every test (and, in TypeScript, group) of a file with its tags, by line
//   node scripts/tools/test-tags-edit.mjs --set <file> <json-file>   set the design techniques by line: {"12": ["boundary"], "30": [...]}
//                                                                    Rust: the line of `#[test]`; "file" sets the `//! tags:` line of the whole file
//   node scripts/tools/test-tags-edit.mjs --wrap [file...] [--max 140]  break the header of a tagged test whose first line is longer than max
// Kind tags already written on a test stay; --set replaces only the technique tags.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KIND_NAMES, parseRust, parseTypescript, TAGS_LINE, TECHNIQUE_NAMES, testFiles, typescript, unwrap } from './test-tags.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const quote = (t) => `'${t}'`;

/** One line per test (and group): "line  T|G  own tags -> all tags  name". */
export function listFile(root, file) {
  const source = readFileSync(path.join(root, file), 'utf8');
  const items = [];
  const rust = file.endsWith('.rs');
  if (rust) parseRust(source, items);
  else parseTypescript(source, file, root, items);
  const out = [];
  if (rust) out.push(`file\t${[...new Set(items.flatMap((i) => i.fileTags))].join(',') || '-'}\t(the //! tags: line of the file)`);
  for (const i of items) out.push(`${i.line}\t${i.group ? 'G' : 'T'}\t${i.own.join(',') || '-'} -> ${i.tags.join(',') || '-'}\t${i.name}`);
  return out.join('\n');
}

/** changes = { "<line>": ["boundary", ...] } on a TypeScript source; returns the new source. */
export function setTypescriptTags(source, fileName, changes, root = ROOT) {
  const T = typescript(root);
  const items = [];
  parseTypescript(source, fileName, root, items);
  const playwright = fileName.replaceAll('\\', '/').includes('/e2e/');
  const key = playwright ? 'tag' : 'tags';
  const mark = playwright ? '@' : '';
  const edits = [];
  for (const [lineText, techniques] of Object.entries(changes)) {
    const item = items.find((i) => i.line === Number(lineText));
    if (!item) throw new Error(`no test or group starts at line ${lineText}`);
    for (const t of techniques) if (!TECHNIQUE_NAMES.has(t)) throw new Error(`line ${lineText}: ${t} is not a technique`);
    if (!item.group && !techniques.length) throw new Error(`line ${lineText}: a test needs at least one technique`);
    const kinds = item.own.filter((t) => KIND_NAMES.has(t));
    const array = '[' + [...kinds, ...techniques].map((t) => quote(mark + t)).join(', ') + ']';
    const args = item.node.arguments;
    const second = args.length >= 3 ? unwrap(T, args[1]) : null;
    if (second && T.isObjectLiteralExpression(second)) {
      const prop = second.properties.find((p) => T.isPropertyAssignment(p) && (p.name.text === 'tags' || p.name.text === 'tag'));
      if (prop) edits.push({ start: prop.initializer.getStart(), end: prop.initializer.end, text: array });
      else edits.push({ start: second.getStart() + 1, end: second.getStart() + 1, text: ` ${key}: ${array},` });
    } else if (args.length === 3 && T.isNumericLiteral(args[2])) {
      // it('name', fn, 20_000): the timeout moves into the options
      edits.push({ start: args[1].getStart(), end: args[1].getStart(), text: `{ ${key}: ${array}, timeout: ${args[2].getText()} }, ` });
      edits.push({ start: args[1].end, end: args[2].end, text: '' });
    } else {
      const fn = args[args.length - 1];
      edits.push({ start: fn.getStart(), end: fn.getStart(), text: `{ ${key}: ${array} }, ` });
    }
  }
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** changes = { "<line of #[test]>": [...], "file": [...] } on a Rust source. */
export function setRustTags(source, changes) {
  const lines = source.split('\n');
  const items = [];
  parseRust(source, items);
  const edits = []; // { at, remove, text }
  for (const [key, techniques] of Object.entries(changes)) {
    for (const t of techniques) if (!TECHNIQUE_NAMES.has(t)) throw new Error(`${key}: ${t} is not a technique`);
    if (key === 'file') {
      const at = lines.findIndex((l) => /^\s*\/\/!\s*tags:/.test(l));
      const text = techniques.length ? `//! tags: ${techniques.join(', ')}` : null;
      edits.push(at >= 0 ? { at, remove: 1, text } : { at: 0, remove: 0, text });
      continue;
    }
    const item = items.find((i) => i.line === Number(key));
    if (!item) throw new Error(`no #[test] at line ${key}`);
    if (!techniques.length) throw new Error(`line ${key}: a test needs at least one technique`);
    const kinds = item.own.filter((t) => KIND_NAMES.has(t));
    const text = `${/^\s*/.exec(lines[item.line - 1])[0]}// tags: ${[...kinds, ...techniques].join(', ')}`;
    let at = item.line - 2;
    while (at >= 0 && /^\s*#\[/.test(lines[at])) at--;
    if (at >= 0 && TAGS_LINE.test(lines[at]) && !/^\s*\/\/!/.test(lines[at])) edits.push({ at, remove: 1, text });
    else edits.push({ at: item.line - 1, remove: 0, text });
  }
  edits.sort((a, b) => b.at - a.at);
  for (const e of edits) lines.splice(e.at, e.remove, ...(e.text === null ? [] : [e.text]));
  return lines.join('\n');
}

/**
 * Breaks the header of every test or group whose first line is longer than `max` and carries tags, one argument to a line, and moves
 * the body two columns right (lines inside a template literal stay as they are):
 *   it('a long name', { tags: ['x'] }, async () => {        it(
 *     body                                            ->      'a long name',
 *   });                                                       { tags: ['x'] },
 *                                                             async () => {
 *                                                               body
 *                                                             },
 *                                                           );
 */
export function wrapHeaders(source, fileName, max = 140, root = ROOT) {
  const T = typescript(root);
  const skip = new Set();
  const kind = fileName.endsWith('x') ? T.ScriptKind.TSX : T.ScriptKind.TS;
  for (let guard = 0; guard < 20000; guard++) {
    const items = [];
    parseTypescript(source, fileName, root, items);
    const sf = T.createSourceFile(fileName, source, T.ScriptTarget.Latest, true, kind);
    const lines = source.split('\n');
    const templates = [];
    const collect = (n) => {
      if (T.isTemplateExpression(n) || T.isNoSubstitutionTemplateLiteral(n)) templates.push([n.getStart(sf), n.end]);
      T.forEachChild(n, collect);
    };
    collect(sf);
    const candidates = items
      .filter((i) => {
        const at = i.node.getStart(sf);
        const text = lines[sf.getLineAndCharacterOfPosition(at).line];
        return text.length > max && /\btags?: \[/.test(text) && /^\s*(it|test|describe)[.\w]*\(.+/.test(text) && !skip.has(at) && i.node.arguments.length >= 2;
      })
      .sort((a, b) => b.node.getStart(sf) - a.node.getStart(sf));
    if (!candidates.length) return source;
    const node = candidates[0].node;
    const start = node.getStart(sf);
    const indent = /^\s*/.exec(lines[sf.getLineAndCharacterOfPosition(start).line])[0];
    const calleeText = node.expression.getText(sf);
    const args = [...node.arguments];
    // Comments between the arguments would be lost: leave such a call as it is.
    const comments = args.some((a, k) => /\/[/*]/.test(source.slice(k ? args[k - 1].end : node.expression.end, a.getStart(sf)))) || /\/[/*]/.test(source.slice(args[args.length - 1].end, node.end));
    if (calleeText.includes('\n') || comments) {
      skip.add(start);
      continue;
    }
    const inTemplate = (pos) => templates.some(([a, b]) => pos > a && pos < b);
    const indented = (a) => {
      const base = a.getStart(sf);
      let offset = 0;
      return a
        .getText(sf)
        .split('\n')
        .map((l, k) => {
          const at = base + offset;
          offset += l.length + 1;
          return k === 0 || l === '' || inTemplate(at) ? l : `  ${l}`;
        })
        .join('\n');
    };
    const text = `${calleeText}(\n${args.map((a) => `${indent}  ${indented(a)},`).join('\n')}\n${indent})`;
    source = source.slice(0, start) + text + source.slice(node.end);
  }
  throw new Error(`${fileName}: too many wraps`);
}

function main(argv) {
  const arg = (flag) => argv[argv.indexOf(flag) + 1];
  if (argv.includes('--list')) {
    console.log(listFile(ROOT, arg('--list').replaceAll('\\', '/')));
    return 0;
  }
  if (argv.includes('--set')) {
    const file = arg('--set').replaceAll('\\', '/');
    const changes = JSON.parse(readFileSync(argv[argv.indexOf('--set') + 2], 'utf8'));
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    writeFileSync(path.join(ROOT, file), file.endsWith('.rs') ? setRustTags(source, changes) : setTypescriptTags(source, file, changes));
    console.log(`test-tags-edit: ${Object.keys(changes).length} set in ${file}`);
    return 0;
  }
  if (argv.includes('--wrap')) {
    const max = Number(arg('--max')) || 140;
    const rest = argv.slice(argv.indexOf('--wrap') + 1);
    const given = rest.filter((a, k) => !a.startsWith('--') && rest[k - 1] !== '--max');
    const files = given.length ? given.map((g) => ({ file: g.replaceAll('\\', '/') })) : testFiles(ROOT).filter((f) => f.runner !== 'cargo');
    let changed = 0;
    for (const { file } of files) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      const next = wrapHeaders(source, file, max);
      if (next !== source) {
        writeFileSync(path.join(ROOT, file), next);
        changed++;
      }
    }
    console.log(`test-tags-edit: wrapped headers in ${changed} files`);
    return 0;
  }
  console.error('usage: node scripts/tools/test-tags-edit.mjs --list <file> | --set <file> <json> | --wrap [file...] [--max N]');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
