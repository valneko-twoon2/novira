// A wildcard list as a plain .txt file (one entry per line), the way wildcard lists are commonly shared.
import { freeWildcardName, useWildcards, type WildcardList } from '@/state/prompts/wildcards';

// A UTF-8 file saved by Notepad may start with a byte-order mark.
const BYTE_ORDER_MARK = new RegExp(`^${String.fromCharCode(0xfeff)}`);

/** The list name a file suggests: its name without the extension, made valid and unused. */
export function listNameForFile(fileName: string, lists: readonly WildcardList[]): string {
  return freeWildcardName(fileName.replace(/\.[^.]*$/, ''), lists);
}

/** The text a list is saved as: its lines with Windows line ends and one at the end. */
export function listFileText(list: WildcardList): string {
  const lines = list.text.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines.length ? `${lines.join('\r\n')}\r\n` : '';
}

/** Adds one list per file; returns the names given to them. */
export async function importListFiles(files: readonly File[]): Promise<string[]> {
  const names: string[] = [];
  for (const file of files) {
    const text = (await file.text()).replace(BYTE_ORDER_MARK, '').replace(/\r\n?/g, '\n');
    const store = useWildcards.getState();
    const id = store.add(listNameForFile(file.name, store.lists), text);
    const added = useWildcards.getState().lists.find((l) => l.id === id);
    if (added) names.push(added.name);
  }
  return names;
}

/** Saves a list as `<name>.txt` through the browser's download. */
export function downloadList(list: WildcardList) {
  const url = URL.createObjectURL(new Blob([listFileText(list)], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${list.name}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
