// ESLint rule that keeps focused tests out of the repository (.claude/rules/test-maintenance.md).
//
// Scope: `it.only`, `test.only`, `describe.only`, `suite.only`, `bench.only` and `test.describe.only` (Playwright),
// including chained forms such as `it.only.each` and `describe.skip.only`, in vitest and Playwright sources.
// Limits: aliases (`const t = it; t.only()`) and computed access (`it['only']`) are not caught. Playwright's own
// `forbidOnly` covers the e2e run on CI; this rule also covers local runs and vitest.
const TEST_FUNCTIONS = new Set(['it', 'test', 'describe', 'suite', 'bench']);

/** The root identifier of a member chain (`test.describe.only` -> `test`). */
function rootName(node) {
  let n = node;
  while (n.type === 'MemberExpression') n = n.object;
  return n.type === 'Identifier' ? n.name : null;
}

export const noFocusedTests = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow committed .only on tests and suites' },
    schema: [],
    messages: { only: '`.only` would skip every other test; remove it before committing.' },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier' || node.property.name !== 'only') return;
        const root = rootName(node.object);
        if (root && TEST_FUNCTIONS.has(root)) context.report({ node: node.property, messageId: 'only' });
      },
    };
  },
};
