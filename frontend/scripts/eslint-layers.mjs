// ESLint rule for the frontend's layer boundaries (.claude/rules/frontend.md, docs/architecture/frontend.md).
//
// Layers, from the bottom: backend/ -> state/ -> ui/ -> features/<name>/ -> app/. A file may import its own layer and
// the layers below it; i18n/ and theme/ are leaves that import none of the layers. A feature never imports another
// feature, except the shared features/media (video, music and voice build on it) and features/invoke (the Invoke buttons).
//
// Scope: static `import` / `export ... from` / `import()` with a literal specifier, written either as `@/...` or as a
// relative path (both are resolved against the importing file, so `../video/x` from features/music is caught too).
// Limits: specifiers built at run time, `vi.mock()` / `import.meta.glob()` strings and files outside src/ are not
// checked. Package imports are never checked here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Layers each layer must not import. `features/*` means "any other feature than the importer's own". */
const FORBIDDEN = {
  backend: ['state', 'ui', 'features', 'app'],
  i18n: ['backend', 'state', 'ui', 'features', 'app'],
  theme: ['backend', 'state', 'ui', 'features', 'app'],
  state: ['ui', 'features', 'app'],
  ui: ['features', 'app'],
  features: ['app', 'features/*'],
};

/** Features any feature may import. */
const SHARED_FEATURES = new Set(['media', 'invoke']);

/**
 * Imports that break the boundaries today, each one listed exactly (importing file -> imported module, both relative
 * to src/, without extension). Do not add patterns: move the shared code down a layer, or into state/ and a registry.
 * frontend/tests/layer-exceptions.test.ts fails when an entry is no longer needed, so the list only shrinks.
 */
export const LAYER_EXCEPTIONS = [
  // The launch pages reuse parts of the Generate panel and the workflow video guide.
  ['features/launchpad/GenerateLaunchpad.tsx', 'features/params/refImages/RefImageList'],
  ['features/launchpad/LaunchpadCard.tsx', 'features/params/refImages/useImageDrop'],
  ['features/launchpad/WorkflowsLaunchpad.tsx', 'features/workflows/VideoGuide'],
  // The viewer shares the gallery's image actions and board listing.
  ['features/viewer/ImageViewer.tsx', 'features/gallery/useBoardImages'],
  ['features/viewer/ImageViewer.tsx', 'features/gallery/useElementSize'],
  ['features/viewer/metadata/MetadataPanel.tsx', 'features/gallery/actions'],
  ['features/viewer/useViewerHotkeys.ts', 'features/gallery/actions'],
  ['features/viewer/ViewerNav.tsx', 'features/gallery/useBoardImages'],
  ['features/viewer/ViewerToolbar.tsx', 'features/gallery/actions'],
  ['features/viewer/ViewerToolbar.tsx', 'features/gallery/canvasTargets'],
  ['features/viewer/ViewerToolbar.tsx', 'features/gallery/deleteRequest'],
  // Test: the three media editors register side by side, checked from one place.
  ['features/music/agentEditor.test.ts', 'features/video/agentEditor'],
  ['features/music/agentEditor.test.ts', 'features/video/register'],
  ['features/music/agentEditor.test.ts', 'features/voice/agentEditor'],
  ['features/music/agentEditor.test.ts', 'features/voice/register'],
  // Test: the mock assistant's text edits are applied with the real Text tab operations.
  ['backend/mock/agentText.test.ts', 'features/text/aiOps'],
  ['backend/mock/agentText.test.ts', 'state/text/textModel'],
];

const EXCEPTIONS = new Set(LAYER_EXCEPTIONS.map(([from, to]) => `${from} -> ${to}`));

const toPosix = (p) => p.split(path.sep).join('/');
/** frontend/src, found from this file's place (frontend/scripts/). */
const SRC_ROOT = toPosix(fileURLToPath(new URL('../src', import.meta.url)));
const stripExt = (p) => p.replace(/\.(tsx?|jsx?|mjs|json)$/, '');

/** `features/<name>` for features, the top folder for the other layers, null for files directly in src/. */
function layerOf(rel) {
  const parts = rel.split('/');
  if (parts.length < 2) return null;
  return parts[0] === 'features' ? `features/${parts[1]}` : parts[0];
}

/** The folders that are layers. */
const LAYERS = new Set([...Object.keys(FORBIDDEN), 'app']);

/** The layer an import names: as layerOf, and also a layer's own index (`@/ui`, `@/state`), which layerOf leaves out. */
function targetLayer(rel) {
  return layerOf(rel) ?? (LAYERS.has(rel) ? rel : null);
}

function isForbidden(from, to) {
  if (from === to) return false;
  const fromTop = from.split('/')[0];
  const toTop = to.split('/')[0];
  const rules = FORBIDDEN[fromTop] ?? [];
  if (toTop === 'features' && fromTop === 'features') {
    return rules.includes('features/*') && !SHARED_FEATURES.has(to.split('/')[1]);
  }
  return rules.includes(toTop);
}

export const layerBoundaries = {
  meta: {
    type: 'problem',
    docs: { description: 'Keep imports inside the frontend layer graph (backend -> state -> ui -> features -> app)' },
    schema: [],
    messages: {
      layer: '{{from}} must not import {{to}} ({{spec}}). See the layer rules in scripts/eslint-layers.mjs.',
    },
  },
  create(context) {
    const filename = toPosix(context.filename);
    const srcRoot = SRC_ROOT;
    if (!filename.toLowerCase().startsWith(`${srcRoot.toLowerCase()}/`)) return {};
    const fromRel = filename.slice(srcRoot.length + 1);
    const fromLayer = layerOf(fromRel);
    if (!fromLayer || fromLayer === 'app') return {};

    function check(node, source) {
      if (!source || source.type !== 'Literal' || typeof source.value !== 'string') return;
      const spec = source.value;
      let target;
      if (spec.startsWith('@/')) target = spec.slice(2);
      else if (spec.startsWith('.')) {
        const joined = path.posix.join(path.posix.dirname(filename), spec);
        if (!joined.toLowerCase().startsWith(`${srcRoot.toLowerCase()}/`)) return;
        target = joined.slice(srcRoot.length + 1);
      } else return;
      const toLayer = targetLayer(target);
      if (!toLayer || !isForbidden(fromLayer, toLayer)) return;
      if (EXCEPTIONS.has(`${fromRel} -> ${stripExt(target)}`)) return;
      context.report({ node: source, messageId: 'layer', data: { from: fromLayer, to: toLayer, spec } });
    }

    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
    };
  },
};
