// The checks that keep the architecture map and the design pages in step with the repository (scripts/tools/docs-check.mjs):
// the real repository must pass, and each rule must fire on a repository that breaks it.
import { describe, expect, it } from 'vitest';
import {
  checkRepository,
  codeNamesIn,
  coversOf,
  covers,
  designCovers,
  DESIGN_LIMIT,
  ENTRY_LIMIT,
  PAGE_LIMIT,
  proseLength,
  pagesCovering,
  stagedProblems,
  stagedWarnings,
  structureProblems,
  // @ts-expect-error -- plain ESM script without types
} from '../../scripts/tools/docs-check.mjs';

const QUEUE = 'backend/crates/novira-core/src/service/queue.rs';
const PAGES: Record<string, string> = {
  'docs/architecture/README.md': '# Architecture\n\nfrontend/ backend/ docs/ .claude/ scripts/ scripts/tools/ .githooks/ start.bat [tooling](03-tooling.md)\n',
  'docs/architecture/01-frontend.md': '# frontend\n\n一覧に戻る: [README.md](README.md)\n\napp/ features/ gallery/ viewer/\n',
  'docs/architecture/02-backend.md': '# backend\n\n一覧に戻る: [README.md](README.md)\n\ncrates/ novira-core/ service/ comfy/\n',
  'docs/architecture/03-tooling.md': '# tooling\n\n一覧に戻る: [README.md](README.md)\n\nrules/i18n.md skills/i18n/ start.bat check.mjs pre-commit.mjs\n',
  'docs/design/README.md': '# Design\n\n[01-app/](01-app/README.md) [02-generation/](02-generation/README.md)\n',
  'docs/design/01-app/README.md': '# App\n\n一覧に戻る: [../README.md](../README.md)\n\n[01-core/](01-core/README.md)\n',
  'docs/design/01-app/01-core/README.md': '# Core\n\n一覧に戻る: [../README.md](../README.md)\n\n[03-security.md](03-security.md)\n',
  'docs/design/02-generation/README.md': '# Generation\n\n一覧に戻る: [../README.md](../README.md)\n\n[01-pictures/](01-pictures/README.md)\n',
  'docs/design/02-generation/01-pictures/README.md': '# Pictures\n\n一覧に戻る: [../README.md](../README.md)\n\n[01-generation.md](01-generation.md)\n',
  'docs/design/02-generation/01-pictures/01-generation.md': `---\ncovers:\n  - ${QUEUE}\n  - backend/crates/novira-core/src/comfy/**\n---\n# Generation\n\n一覧に戻る: [README.md](README.md)\n`,
  'docs/design/01-app/01-core/03-security.md': '---\ncovers:\n  - backend/src-tauri/capabilities/**\n---\n# Security\n\n一覧に戻る: [README.md](README.md)\n',
  'AGENTS.md': 'i18n.md /i18n\n',
};
const TREE = [
  ...Object.keys(PAGES),
  'scripts/start.bat',
  'scripts/tools/check.mjs',
  '.githooks/pre-commit.mjs',
  '.claude/rules/i18n.md',
  '.claude/skills/i18n/SKILL.md',
  'frontend/src/app/App.tsx',
  'frontend/src/features/gallery/Gallery.tsx',
  'frontend/src/features/viewer/Viewer.tsx',
  'backend/crates/novira-core/src/lib.rs',
  QUEUE,
  'backend/crates/novira-core/src/comfy/graph.rs',
  'backend/src-tauri/capabilities/default.json',
];
const problems = (files: string[], pages: Record<string, string> = PAGES) => structureProblems(files, (p: string) => pages[p] ?? null) as string[];

describe('the map against the tree', () => {
  it('passes the repository itself', { tags: ['scenario'] }, () => {
    expect(checkRepository()).toEqual([]);
  });

  it('passes a tree that is fully described', { tags: ['condition'] }, () => {
    expect(problems(TREE)).toEqual([]);
  });

  it('fails for a new feature folder, a new source folder, a new crate, a new launcher, a new rule and a new skill nobody described', { tags: ['error-guessing'] }, () => {
    const found = problems([
      ...TREE,
      'frontend/src/features/downloads/PackDock.tsx',
      'frontend/src/state/x.ts',
      'backend/crates/other/src/lib.rs',
      'backend/crates/novira-core/src/models/mod.rs',
      'scripts/run.bat',
      'scripts/tools/new-tool.mjs',
      '.githooks/new-hook.mjs',
      '.claude/rules/new-rule.md',
      '.claude/skills/new-skill/SKILL.md',
    ]).join('\n');
    expect(found).toContain('"downloads/"');
    expect(found).toContain('"state/"');
    expect(found).toContain('"other/"');
    expect(found).toContain('"models/"');
    expect(found).toContain('"run.bat"');
    expect(found).toContain('"new-tool.mjs"');
    expect(found).toContain('"new-hook.mjs"');
    expect(found).toContain('"new-rule.md"');
    expect(found).toContain('"/new-skill"');
  });

  it('wants the whole name: a tool written only inside a longer name is not described', { tags: ['condition'] }, () => {
    const pages = { ...PAGES, 'docs/architecture/03-tooling.md': `${PAGES['docs/architecture/03-tooling.md']} check-eol.mjs` };
    expect(problems([...TREE, 'scripts/tools/eol.mjs'], pages).join('\n')).toContain('"eol.mjs"');
    expect(problems([...TREE, 'scripts/tools/check-eol.mjs'], pages)).toEqual([]);
  });

  it('does not ask for the files of a folder, only for the folder', { tags: ['condition'] }, () => {
    const many = Array.from({ length: 30 }, (_, i) => `frontend/src/features/gallery/File${i}.tsx`);
    expect(problems([...TREE, ...many])).toEqual([]);
  });
});

describe('the code names the pages write exist', () => {
  const CODE = { ...PAGES, 'frontend/src/app/App.tsx': 'export function useQueueStore() {}\nconst MAX_ITEMS = 3;\nlet page_size = 1;' };
  const withPage = (body: string) => ({ ...CODE, 'docs/design/02-generation/01-pictures/01-generation.md': `${PAGES['docs/design/02-generation/01-pictures/01-generation.md']}${body}\n` });

  it('reads camelCase, PascalCase with a capital inside, snake_case and UPPER_SNAKE names, not plain words or fenced examples', { tags: ['condition'] }, () => {
    const names = codeNamesIn('`useQueueStore()` `PlaceSection` `page_size` `MAX_ITEMS` `cast` `Settings` `a b`\n```\n`inFence`\n```\n`afterFence`');
    expect([...names.keys()]).toEqual(['useQueueStore', 'PlaceSection', 'page_size', 'MAX_ITEMS', 'afterFence']);
    expect(names.get('afterFence')).toBe(5);
  });

  it('fails for a removed component or constant, naming the page and the line', { tags: ['error-guessing'] }, () => {
    const found = problems([...TREE], withPage('The cast edits them (`PlaceSection`), capped at `MAX_PLACES`.')).join('\n');
    expect(found).toContain('docs/design/02-generation/01-pictures/01-generation.md:9: names `PlaceSection`');
    expect(found).toContain('names `MAX_PLACES`');
  });

  it('does not count a name that only a frontend test has (a test may quote a removed name as its example)', { tags: ['condition'] }, () => {
    const pages = { ...withPage('Edited by `OldThing`.'), 'frontend/tests/x.test.ts': 'const OldThing = 1;', 'frontend/src/app/App.test.tsx': 'OldThing' };
    expect(problems([...TREE, 'frontend/tests/x.test.ts', 'frontend/src/app/App.test.tsx'], pages).join('\n')).toContain('names `OldThing`');
  });

  it('passes names the code has, plain words, fenced examples and the names kept for code outside the repository', { tags: ['condition'] }, () => {
    const body = '`useQueueStore()` keeps `MAX_ITEMS` and `page_size`; a `cast` of `Settings`; `ORT_DYLIB_PATH` is not used.\n```\nconst removedThing = 1;\n```';
    expect(problems([...TREE], withPage(body))).toEqual([]);
  });
});

describe('what the pages point at exists', () => {
  const withPage = (body: string) => ({ ...PAGES, 'docs/architecture/01-frontend.md': `# frontend\n\n一覧に戻る: [README.md](README.md)\n\napp/ features/ gallery/ viewer/\n\n${body}\n` });

  it('fails for a path written in backticks that is not in the tree, and names the page', { tags: ['error-guessing'] }, () => {
    const found = problems(TREE, withPage('See `frontend/src/features/gallery/Gone.tsx` and `frontend/src/app/App.tsx`.')).join('\n');
    expect(found).toContain('docs/architecture/01-frontend.md: names the path "frontend/src/features/gallery/Gone.tsx"');
    expect(found).not.toContain('App.tsx"');
  });

  it('accepts a folder, a placeholder or a star after an existing folder, and build output', { tags: ['condition'] }, () => {
    const body = '`frontend/src/features/gallery/` `frontend/src/features/<name>/` `frontend/src/features/*/index.ts` `frontend/dist`';
    expect(problems(TREE, withPage(body))).toEqual([]);
    expect(problems(TREE, withPage('`frontend/src/nothing/<name>/`')).join('\n')).toContain('"frontend/src/nothing/"');
  });

  it('leaves other backticks and fenced blocks alone', { tags: ['condition'] }, () => {
    const body = '`cargo test -p novira` `frontend` `novira-data/` `logs/coverage/report/index.html`\n\n```text\nfrontend/dist and `backend/ghost/` inside a fence\n```';
    expect(problems(TREE, withPage(body))).toEqual([]);
  });

  it('fails for a link to a page or file that does not exist, and accepts one that does', { tags: ['error-guessing'] }, () => {
    expect(problems(TREE, withPage('[gone](nothing.md) [web](https://example.com) [anchor](#top)')).join('\n')).toContain('links to "nothing.md"');
    expect(problems(TREE, withPage('[up](README.md) [design](../design/01-app/01-core/03-security.md#x) [rule](../../.claude/rules/i18n.md)'))).toEqual([]);
  });

  it('checks the design pages the same way', { tags: ['condition'] }, () => {
    const pages = { ...PAGES, 'docs/design/02-generation/01-pictures/01-generation.md': `${PAGES['docs/design/02-generation/01-pictures/01-generation.md']}\nSee \`${QUEUE}\` and \`backend/crates/novira-core/src/gone.rs\`.\n` };
    const found = problems(TREE, pages).join('\n');
    expect(found).toContain('docs/design/02-generation/01-pictures/01-generation.md: names the path "backend/crates/novira-core/src/gone.rs"');
    expect(found).not.toContain('queue.rs"');
  });
});

describe('the map stays small enough to read', () => {
  it('refuses an entry page over its limit and another page over the larger limit', { tags: ['error-guessing'] }, () => {
    const entry = { ...PAGES, 'docs/architecture/README.md': `${PAGES['docs/architecture/README.md']}${'x'.repeat(ENTRY_LIMIT)}\n` };
    expect(problems(TREE, entry).join('\n')).toContain(`docs/architecture/README.md: ${proseLength(entry['docs/architecture/README.md'])} characters (at most ${ENTRY_LIMIT})`);
    const other = { ...PAGES, 'docs/architecture/02-backend.md': `${PAGES['docs/architecture/02-backend.md']}${'x'.repeat(ENTRY_LIMIT)}\n` };
    expect(problems(TREE, other)).toEqual([]);
    const big = { ...PAGES, 'docs/architecture/02-backend.md': `${PAGES['docs/architecture/02-backend.md']}${'x'.repeat(PAGE_LIMIT)}\n` };
    expect(problems(TREE, big).join('\n')).toContain('docs/architecture/02-backend.md:');
  });
});

describe('the design pages', () => {
  it('reads the covers list of the front matter', { tags: ['condition'] }, () => {
    expect(coversOf(PAGES['docs/design/02-generation/01-pictures/01-generation.md'])).toEqual([QUEUE, 'backend/crates/novira-core/src/comfy/**']);
    expect(coversOf('# no front matter\n')).toBeNull();
    expect(coversOf('---\ntitle: x\n---\n# t\n')).toEqual([]);
    expect(coversOf('---\r\ncovers:\r\n  - a/b.rs\r\nother: 1\r\n---\r\n')).toEqual(['a/b.rs']);
  });

  it('matches a file, a folder and globs', { tags: ['condition'] }, () => {
    expect(covers('a/b.rs', 'a/b.rs')).toBe(true);
    expect(covers('a/b.rs', 'a/b.rsx')).toBe(false);
    expect(covers('a/dir', 'a/dir/x.rs')).toBe(true);
    expect(covers('a/dir/**', 'a/dir/deep/x.rs')).toBe(true);
    expect(covers('a/*.rs', 'a/x.rs')).toBe(true);
    expect(covers('a/*.rs', 'a/deep/x.rs')).toBe(false);
    expect(covers('a/dir/**', 'a/other/x.rs')).toBe(false);
  });

  it('fails for a page with no covers, a covers entry that matches nothing, a page missing from the index and a page that is too long', { tags: ['error-guessing'] }, () => {
    const pages = {
      ...PAGES,
      'docs/design/02-generation/03-models/README.md': '# Models\n',
      'docs/design/01-app/03-engine/README.md': '# Engine\n',
      'docs/design/02-generation/03-models/01-models.md': '# Models\n',
      'docs/design/01-app/03-engine/02-extensions.md': '---\ncovers:\n  - backend/crates/novira-core/src/ghost/**\n---\n# Extensions\n',
      'docs/design/02-generation/01-pictures/01-generation.md': `${PAGES['docs/design/02-generation/01-pictures/01-generation.md']}${'x'.repeat(DESIGN_LIMIT)}\n`,
    };
    const found = problems([...TREE, 'docs/design/02-generation/03-models/README.md', 'docs/design/01-app/03-engine/README.md', 'docs/design/02-generation/03-models/01-models.md', 'docs/design/01-app/03-engine/02-extensions.md'], pages).join('\n');
    expect(found).toContain('docs/design/02-generation/03-models/01-models.md: needs a "covers:" list');
    expect(found).toContain('docs/design/01-app/03-engine/02-extensions.md: covers "backend/crates/novira-core/src/ghost/**", which matches no file');
    expect(found).toContain('docs/design/02-generation/03-models/README.md: does not list 01-models.md');
    expect(found).toContain('docs/design/01-app/03-engine/README.md: does not list 02-extensions.md');
    expect(found).toContain('docs/design/02-generation/01-pictures/01-generation.md:');
    expect(found).toContain(`(at most ${DESIGN_LIMIT})`);
  });

  it('wants a README.md in every design folder that names everything directly in it', { tags: ['condition'] }, () => {
    const fresh = 'docs/design/03-new/01-topic/01-page.md';
    const found = problems([...TREE, fresh], { ...PAGES, [fresh]: '---\ncovers:\n  - frontend/src/app/App.tsx\n---\n' + '# Page\n' }).join('\n');
    expect(found).toContain('docs/design/03-new: needs a README.md');
    expect(found).toContain('docs/design/03-new/01-topic: needs a README.md');
    expect(found).toContain('docs/design/README.md: does not list 03-new');
    const more = 'docs/design/01-app/01-core/04-more.md';
    const half = problems([...TREE, more], { ...PAGES, [more]: '---\ncovers:\n  - frontend/src/app/App.tsx\n---\n' + '# More\n' }).join('\n');
    expect(half).toContain('docs/design/01-app/01-core/README.md: does not list 04-more.md');
  });

  it('wants every page to link back to its list, and a folder README to the list above it', { tags: ['condition'] }, () => {
    const lonely = { ...PAGES, 'docs/design/02-generation/01-pictures/01-generation.md': (PAGES['docs/design/02-generation/01-pictures/01-generation.md'] ?? '').replace(/一覧に戻る.*/, ''), 'docs/design/01-app/01-core/README.md': '# Core\n\n[03-security.md](03-security.md)\n', 'docs/architecture/02-backend.md': '# backend\n\ncrates/ novira-core/ service/ comfy/\n' };
    const found = problems(TREE, lonely).join('\n');
    expect(found).toContain('docs/design/02-generation/01-pictures/01-generation.md: needs a link back to the list');
    expect(found).toContain('docs/design/01-app/01-core/README.md: needs a link back to the list: `一覧に戻る: [../README.md](../README.md)`');
    expect(found).toContain('docs/architecture/02-backend.md: needs a link back to the list');
    // The top READMEs have no list above them.
    expect(found).not.toContain('docs/design/README.md: needs a link');
    expect(found).not.toContain('docs/architecture/README.md: needs a link');
  });

  it('does not ask a design page for a "Last updated" line', { tags: ['condition'] }, () => {
    expect(problems(TREE).join('\n')).not.toContain('Last updated');
  });

  it('finds the pages that cover a path', { tags: ['condition'] }, () => {
    const pages = designCovers(TREE, (p: string) => PAGES[p] ?? null);
    expect(pagesCovering(QUEUE, pages)).toEqual(['docs/design/02-generation/01-pictures/01-generation.md']);
    expect(pagesCovering('backend/crates/novira-core/src/comfy/graph.rs', pages)).toEqual(['docs/design/02-generation/01-pictures/01-generation.md']);
    expect(pagesCovering('backend\\src-tauri\\capabilities\\default.json', pages)).toEqual(['docs/design/01-app/01-core/03-security.md']);
    expect(pagesCovering('frontend/src/app/App.tsx', pages)).toEqual([]);
  });
});

describe('the staged change', () => {
  const change = (path: string, status = 'M') => ({ status, path });
  const pages = designCovers(TREE, (p: string) => PAGES[p] ?? null);

  it('requires a design page in the commit for a change to a boundary file', { tags: ['boundary'] }, () => {
    const boundary = change('backend/src-tauri/src/command_list.rs');
    expect(stagedProblems([boundary])[0]).toContain('a design page must be in the same commit');
    expect(stagedProblems([change('backend/src-tauri/capabilities/default.json')])).toHaveLength(1);
    expect(stagedProblems([boundary, change('docs/design/03-assistant/01-core/01-assistant.md')])).toEqual([]);
    expect(stagedProblems([boundary, change('docs/design/03-assistant/01-core/01-assistant.md', 'D')])).toHaveLength(1);
  });

  it('lets other files through', { tags: ['condition'] }, () => {
    expect(stagedProblems([change('frontend/src/a.ts'), change('docs/design/old.md', 'D')])).toEqual([]);
  });

  it('warns when code that a page covers changes and the page is not in the commit', { tags: ['condition'] }, () => {
    const found = stagedWarnings([change(QUEUE)], pages);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('docs/design/02-generation/01-pictures/01-generation.md covers code in this commit (backend/crates/novira-core/src/service/queue.rs)');
  });

  it('does not warn when the page is in the commit, for tests, for a deleted file or for code no page covers', { tags: ['condition'] }, () => {
    expect(stagedWarnings([change(QUEUE), change('docs/design/02-generation/01-pictures/01-generation.md')], pages)).toEqual([]);
    expect(stagedWarnings([change('backend/crates/novira-core/src/comfy/graph.test.ts')], pages)).toEqual([]);
    expect(stagedWarnings([change(QUEUE, 'D')], pages)).toEqual([]);
    expect(stagedWarnings([change('frontend/src/app/App.tsx')], pages)).toEqual([]);
  });

  it('names three files and counts the rest', { tags: ['condition'] }, () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((n) => change(`backend/crates/novira-core/src/comfy/${n}.rs`));
    expect(stagedWarnings(many, pages)[0]).toContain('and 2 more');
  });
});
