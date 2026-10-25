// ESLint plugin with the frontend's security rules (see .claude/rules/security.md and docs/design/security.md).
//
// Scope: syntactic checks on the source. It catches the direct forms of HTML injection and dynamic code:
//   - `dangerouslySetInnerHTML` in JSX
//   - assigning `innerHTML` / `outerHTML` / `srcdoc`, calling `insertAdjacentHTML`, `document.write(ln)`,
//     `createContextualFragment` (HTML strings turned into DOM)
//   - `window.open` / `open(...)` outside `src/backend` (opening another window is a boundary action)
// Dynamic code (`eval`, `new Function`, string timers, `javascript:` URLs) is left to the core rules enabled next to it.
// Limits: it does not follow data flow, aliases (`const w = window; w.open()`), computed names (`el['innerHTML']`)
// or markdown/HTML libraries. Reading `innerHTML` is allowed (tests compare the rendered output that way).
const HTML_SINKS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);
const HTML_CALLS = new Set(['insertAdjacentHTML', 'createContextualFragment']);
const WINDOWS = new Set(['window', 'globalThis', 'self']);

function propName(member) {
  if (member.type !== 'MemberExpression' || member.computed) return null;
  return member.property.type === 'Identifier' ? member.property.name : null;
}

function objName(member) {
  return member.object.type === 'Identifier' ? member.object.name : null;
}

const noHtmlInjection = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow turning strings into HTML; render through React instead' },
    schema: [],
    messages: {
      jsx: 'dangerouslySetInnerHTML is not allowed: render data through React elements (text is escaped).',
      sink: 'Assigning {{name}} parses HTML: build the DOM with React or textContent.',
      call: '{{name}} parses HTML: build the DOM with React or textContent.',
      write: 'document.{{name}} is not allowed.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'dangerouslySetInnerHTML') {
          context.report({ node, messageId: 'jsx' });
        }
      },
      AssignmentExpression(node) {
        const name = propName(node.left);
        if (name && HTML_SINKS.has(name)) context.report({ node, messageId: 'sink', data: { name } });
      },
      CallExpression(node) {
        const callee = node.callee;
        const name = callee.type === 'Identifier' ? callee.name : propName(callee);
        if (!name) return;
        if (HTML_CALLS.has(name)) context.report({ node, messageId: 'call', data: { name } });
        if ((name === 'write' || name === 'writeln') && callee.type === 'MemberExpression' && objName(callee) === 'document') {
          context.report({ node, messageId: 'write', data: { name } });
        }
      },
    };
  },
};

const noWindowOpen = {
  meta: {
    type: 'problem',
    docs: { description: 'Open other windows only through src/backend' },
    schema: [],
    messages: { open: 'Open windows through src/backend (openInNewWindow), which checks the address.' },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        const bare = callee.type === 'Identifier' && callee.name === 'open';
        const member = propName(callee) === 'open' && WINDOWS.has(objName(callee) ?? '');
        if (bare || member) context.report({ node, messageId: 'open' });
      },
    };
  },
};

export default {
  meta: { name: 'novira-security' },
  rules: { 'no-html-injection': noHtmlInjection, 'no-window-open': noWindowOpen },
};
