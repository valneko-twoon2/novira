// Template rendering: `{name}` placeholders, `{{` / `}}` escape literal braces.
export type MessageArgs = Record<string, string | number>;

export function renderTemplate(template: string, args: MessageArgs = {}): string {
  let out = '';
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    const next = template[i + 1];
    if (ch === '{' && next === '{') {
      out += '{';
      i++;
    } else if (ch === '}' && next === '}') {
      out += '}';
      i++;
    } else if (ch === '{') {
      const end = template.indexOf('}', i);
      if (end < 0) {
        out += template.slice(i);
        break;
      }
      const name = template.slice(i + 1, end);
      out += Object.hasOwn(args, name) ? String(args[name]) : `{${name}}`;
      i = end;
    } else {
      out += ch;
    }
  }
  return out;
}

export function placeholders(template: string): string[] {
  const names = new Set<string>();
  const stripped = template.replace(/\{\{|\}\}/g, '');
  for (const m of stripped.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) names.add(m[1] as string);
  return [...names].sort();
}
