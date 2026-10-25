// The checks tools/affected.mjs chooses for a change (the tables of .claude/rules/regression-tests.md, done by a tool).
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM script without types
import { modulesNamed, plan, readCoreTests, specsFor } from '../../tools/affected.mjs';

interface Check {
  side: string;
  cwd: string;
  cmd: string[];
  why: string;
}
interface Plan {
  checks: Check[];
  skipped: { cmd: string; why: string }[];
}

const reexports = new Map([
  ['Backend', 'service'],
  ['Settings', 'settings'],
]);
const core = {
  tests: new Map([
    ['comfy_ws_edges', 'use novira_core::comfy::ws::Client;'],
    ['queue_flow', 'use novira_core::{Backend, types::Job};\nmod fake_site;'],
    ['grouped', 'use novira_core::{\n    media::{a, b},\n    voice::Pack,\n};'],
    ['models_live', 'use novira_core::comfy::x;'],
  ]),
  helpers: ['fake_site'],
  reexports,
};
const run = (paths: string[], e2e = false): Plan => plan(paths, { e2e, core, exists: () => true });
const commands = (p: Plan) => p.checks.map((c) => c.cmd.join(' '));
const cargoTests = (p: Plan) => commands(p).find((c) => c.startsWith('cargo test -p novira-core --test')) ?? '';

describe('affected checks: frontend', () => {
  it('typechecks, lints the file and runs the tests that import it', () => {
    const cmds = commands(run(['frontend/src/features/media/SeedControl.tsx']));
    expect(cmds).toContain('npm run typecheck');
    expect(cmds).toContain('npx eslint src/features/media/SeedControl.tsx');
    expect(cmds).toContain('npx vitest related --run --passWithNoTests ../frontend/src/features/media/SeedControl.tsx');
    expect(cmds.at(-1)).toBe('npm run check:eol');
    expect(cmds.some((c) => c.startsWith('cargo'))).toBe(false);
  });

  it('leaves out the tests of the screen text and the manual unless asked with --text', () => {
    const cmds = (paths: string[]) => commands(run(paths));
    expect(cmds(['frontend/src/i18n/locales/ja/params.json']).some((c) => c.includes('tests/i18n.test.ts'))).toBe(false);
    expect(cmds(['docs/manual/en/02-generate.md']).some((c) => c.includes('tests/manual.test.ts'))).toBe(false);
    expect(run(['docs/manual/en/02-generate.md']).skipped.some((x) => x.why.includes('--text'))).toBe(true);
    const withText = (paths: string[]) => commands(plan(paths, { text: true, core, exists: () => true }));
    expect(withText(['frontend/src/i18n/locales/ja/params.json'])).toContain('npx vitest run tests/i18n.test.ts tests/i18n-glossary.test.ts tests/manual.test.ts tests/ui-refs.test.ts');
    expect(withText(['docs/manual/en/02-generate.md'])).toContain('npx vitest run tests/manual.test.ts tests/i18n-glossary.test.ts');
  });

  it('runs the tests that read a file at run time: contract, the map', () => {
    expect(commands(run(['.claude/rules/frontend.md']))).toContain('npx vitest run tests/docs-check.test.ts tests/ui-refs.test.ts');
    const contract = commands(run(['contract/job.json']));
    expect(contract).toContain('npx vitest run src/backend/contract.test.ts src/backend/tauri');
    expect(contract).toContain('cargo test -p novira-core --test contract');
  });

  it('checks the test ids and text keys named outside the app when a component, the ja catalog or a script naming them changes', () => {
    for (const path of ['frontend/src/features/media/MediaTabs.tsx', 'frontend/src/i18n/locales/ja/media.json', 'frontend/e2e/comic.spec.ts', 'frontend/scripts/manual/scenes.mjs', 'tools/models-sweep-app.mjs', 'docs/design/navigation.md']) {
      expect(commands(run([path])).some((c) => c.includes('tests/ui-refs.test.ts')), path).toBe(true);
    }
    for (const path of ['frontend/src/i18n/locales/en/media.json', 'docs/manual/ja/02-generate.md', 'frontend/src/ui/Button.css']) {
      expect(commands(run([path])).some((c) => c.includes('tests/ui-refs.test.ts')), path).toBe(false);
    }
  });

  it('checks the whole frontend when its build settings or dependencies change', () => {
    for (const path of ['frontend/package.json', 'frontend/vitest.config.ts', 'frontend/tsconfig.json']) {
      const cmds = commands(run([path]));
      expect(cmds, path).toContain('npm run check');
      expect(cmds, path).not.toContain('npm run typecheck');
    }
  });

  it('names the flows of a feature by its name and by the test ids it sets, never the layout or visual specs', () => {
    // model-parts drives the Models screen, manga-finish the viewer's dialog, model-choice the video pack choice.
    expect(specsFor('models')).toContain('e2e/model-parts.spec.ts');
    expect(specsFor('viewer')).toContain('e2e/manga-finish.spec.ts');
    expect(specsFor('video')).toContain('e2e/model-choice.spec.ts');
    expect(specsFor('comic')).toContain('e2e/comic.spec.ts');
    for (const feature of ['models', 'viewer', 'params', 'gallery']) {
      expect(specsFor(feature).filter((s: string) => /(layout|visual)\.spec/.test(s)), feature).toEqual([]);
    }
    // A folder no spec drives names none.
    expect(specsFor('launchpad')).toEqual([]);
  });

  it('only names the Playwright runs unless asked, and runs them with --e2e', () => {
    const quiet = run(['frontend/src/features/comic/ComicEditor.tsx']);
    expect(commands(quiet).some((c) => c.includes('playwright'))).toBe(false);
    expect(quiet.skipped.map((s) => s.cmd).join('\n')).toMatch(/playwright test --project=chromium .*e2e\/comic\.spec\.ts/);
    expect(quiet.skipped.map((s) => s.cmd).join('\n')).toContain('--project=visual');
    const loud = commands(run(['frontend/src/features/comic/ComicEditor.tsx'], true));
    expect(loud).toContain('npx playwright test --project=visual');
    // A shared part runs every flow, not only one feature's.
    expect(commands(run(['frontend/src/ui/Button.tsx'], true))).toContain('npx playwright test --project=chromium');
  });

  it('names the model sweep for model code, and not for its tests', () => {
    for (const path of ['backend/crates/novira-core/src/models/classify.rs', 'frontend/src/features/models/CoverImage.tsx', 'frontend/src/ui/ModelPicker.tsx']) {
      expect(run([path]).skipped.map((s) => s.cmd), path).toContain('node tools/models-sweep.mjs --build');
    }
    expect(run(['frontend/src/features/models/CoverImage.test.tsx']).skipped.map((s) => s.cmd)).not.toContain('node tools/models-sweep.mjs --build');
    expect(run(['frontend/src/features/models/models.css', 'frontend/src/ui/CoverImage.css']).skipped.map((s) => s.cmd)).not.toContain('node tools/models-sweep.mjs --build');
  });

  it('runs the layout scan for css, shared components, the composition and feature components, not for tests or logic', () => {
    for (const path of ['frontend/src/theme/tokens.css', 'frontend/src/ui/controls.tsx', 'frontend/src/app/SideNav.tsx', 'frontend/src/features/models/ModelCard.tsx', 'frontend/e2e/layoutRules.ts']) {
      expect(commands(run([path])), path).toContain('node tools/layout-scan.mjs');
    }
    for (const path of ['frontend/src/features/models/modelStore.ts', 'frontend/src/ui/controls.test.tsx', 'frontend/src/state/ui.ts', 'tools/docs-check.mjs']) {
      expect(commands(run([path])), path).not.toContain('node tools/layout-scan.mjs');
    }
  });

  it('names no Playwright run for a test, a script or the test settings', () => {
    for (const path of ['frontend/src/features/comic/ComicEditor.test.tsx', 'frontend/src/ui/Button.test.tsx', 'tools/docs-check.mjs', 'frontend/vitest.config.ts']) {
      expect(run([path]).skipped, path).toEqual([]);
    }
  });
});

describe('affected checks: backend', () => {
  it('runs the library tests and the integration tests that name the changed module', () => {
    const p = run(['backend/crates/novira-core/src/comfy/graph.rs']);
    expect(commands(p)).toEqual(
      expect.arrayContaining(['cargo fmt --all -- --check', 'cargo clippy -p novira-core --tests -- -D warnings', 'cargo test -p novira-core --lib']),
    );
    expect(cargoTests(p)).toBe('cargo test -p novira-core --test comfy_ws_edges');
  });

  it('follows root re-exports and grouped imports, and never runs a live test', () => {
    expect(cargoTests(run(['backend/crates/novira-core/src/service/queue.rs']))).toBe('cargo test -p novira-core --test queue_flow');
    expect(cargoTests(run(['backend/crates/novira-core/src/voice/mod.rs']))).toBe('cargo test -p novira-core --test grouped');
    expect(cargoTests(run(['backend/crates/novira-core/src/media/png.rs']))).toBe('cargo test -p novira-core --test grouped');
    const live = run(['backend/crates/novira-core/tests/models_live.rs']);
    expect(cargoTests(live)).toBe('');
    expect(live.skipped[0]?.cmd).toContain('--test models_live -- --ignored');
  });

  it('runs a changed test, and every test that uses a changed helper folder', () => {
    expect(cargoTests(run(['backend/crates/novira-core/tests/comfy_ws_edges.rs']))).toBe('cargo test -p novira-core --test comfy_ws_edges');
    expect(cargoTests(run(['backend/crates/novira-core/tests/fake_site/mod.rs']))).toBe('cargo test -p novira-core --test queue_flow');
  });

  it('checks the shell, and everything on a dependency or build change', () => {
    expect(commands(run(['backend/src-tauri/src/commands.rs']))).toEqual(
      expect.arrayContaining(['cargo test -p novira', 'npx vitest run src/backend/tauri tests/test-hygiene.test.ts']),
    );
    for (const path of ['backend/Cargo.lock', 'backend/crates/novira-core/Cargo.toml', 'backend/crates/novira-core/src/lib.rs']) {
      expect(commands(run([path])), path).toEqual(
        expect.arrayContaining(['cargo test -p novira-core', 'cargo test -p novira']),
      );
    }
  });

  it('runs nothing when nothing changed', () => {
    expect(run([]).checks).toEqual([]);
  });
});

describe('affected checks: reading the Rust tests', () => {
  it('names the modules of plain paths, grouped imports and re-exports', () => {
    const named = modulesNamed('use novira_core::{\n  Backend,\n  comfy::{graph, ws},\n  types::Job,\n};\nnovira_core::db::open();', reexports);
    expect([...named].sort()).toEqual(['comfy', 'db', 'service', 'types']);
  });

  it('reads the real test folder: tests, helper folders and the re-exports of lib.rs', () => {
    const real = readCoreTests();
    expect(real.tests.has('backend_service')).toBe(true);
    expect(real.tests.has('contract')).toBe(true);
    expect(real.helpers).toContain('fake_site');
    expect(real.reexports.get('Backend')).toBe('service');
  });
});
