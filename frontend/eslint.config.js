// Lint rules for the InvokeAI-style mock frontend.
// Keeps line endings, React hook rules, and the boundary that UI code never reaches the network directly.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import security from './scripts/eslint-security.mjs';
import { layerBoundaries } from './scripts/eslint-layers.mjs';
import { noFocusedTests } from './scripts/eslint-test-hygiene.mjs';

const NET = ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource'].map((name) => ({
  name,
  message: 'The frontend talks to the backend only through src/backend (mock for now).',
}));

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'linebreak-style': ['error', 'unix'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/backend/**'],
    rules: {
      'no-restricted-globals': ['error', ...NET],
    },
  },
  // --- security (see .claude/rules/security.md) ---
  // HTML injection and dynamic code anywhere in src/; other windows only from src/backend (openInNewWindow).
  // Syntactic only: data flow, aliases and computed property names are not followed (limits in scripts/eslint-security.mjs).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'novira-security': security },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'novira-security/no-html-injection': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/backend/**'],
    plugins: { 'novira-security': security },
    rules: { 'novira-security/no-window-open': 'error' },
  },
  // --- end security ---
  // --- exhaustiveness (see .claude/rules/frontend.md) ---
  // A switch over a union names every member even when it has a default, so a new tab, kind or event does not fall
  // silently into the default branch. Typed, so it reads tsconfig; tests are left out to keep the lint fast.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/**/*.testkit.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: false }] },
  },
  // A model list filtered to main models drops the diffusion models of the newer families (Anima, Flux...): the Drafts,
  // XY plot, face fix and redraw pickers each did. Pick with the helpers of state/models.ts, which know the families.
  // src/backend/ sits below state/ and cannot use them; state/models.ts is where they are written.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/backend/**', 'src/state/models.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='filter'] BinaryExpression[operator=/^[!=]==?$/][right.value='main'][left.property.name='type']",
          message: 'Pick models with drawableModels, checkpointModels or isDrawable (state/models.ts), not by type main.',
        },
        {
          selector: "CallExpression[callee.name='modelsOfType'][arguments.1.value='main']",
          message: 'Pick models with drawableModels, checkpointModels or isDrawable (state/models.ts), not by type main.',
        },
      ],
    },
  },
  // --- end exhaustiveness ---
  // --- harness: layer boundaries and test hygiene (see AGENTS.md section 4) ---
  // Layer graph and its listed exceptions: scripts/eslint-layers.mjs. Focused tests: scripts/eslint-test-hygiene.mjs.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'novira-layers': { rules: { boundaries: layerBoundaries } } },
    rules: { 'novira-layers/boundaries': 'error' },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    plugins: { 'novira-tests': { rules: { 'no-only': noFocusedTests } } },
    rules: { 'novira-tests/no-only': 'error' },
  },
  // --- end harness ---
);
