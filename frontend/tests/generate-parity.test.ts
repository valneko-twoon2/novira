// New screens follow the Generate screen (.claude/rules/frontend.md, "Look"): a main model is chosen with the Generate screen's
// `ModelPicker` (pictures, search, grouped by base), never in a plain `Select` of names. A file that takes the main models
// (`drawableModels`, `checkpointModels`) and turns them into select options by name is what slipped through before (the
// Text screen's AI fill, the viewer's face fix). Lists of choices that are not a model picker (an axis of values in the XY
// plot, a LoRA in a character) build their options another way and are not matched.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Files that may list main models in a `Select`, each with why. Keep it empty: fix the screen instead. */
const ALLOWED = new Map<string, string>();

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path);
    return e.name.endsWith('.tsx') && !/\.test\.tsx$|\.testkit\.tsx$/.test(e.name) ? [path] : [];
  });
}

/** Whether the source takes the main models and maps them, by name, into the options of a select. */
export function listsMainModelsInSelect(source: string): boolean {
  const takesMains = /\b(drawableModels|checkpointModels)\(/.test(source);
  const namesAsOptions = /\.map\(\((\w+)\) => \(\{ value: \1\.key, label: \1\.name/.test(source);
  return takesMains && namesAsOptions && /<Select\b/.test(source);
}

describe('screens follow the Generate screen', () => {
  it('finds a main model in a plain Select, and not the picker or other lists', { tags: ['condition'] }, () => {
    const select = "const mains = checkpointModels(models);\n<Select options={mains.map((m) => ({ value: m.key, label: m.name }))} />";
    expect(listsMainModelsInSelect(select)).toBe(true);
    expect(listsMainModelsInSelect('const mains = drawableModels(models);\n<ModelPicker models={mains} />')).toBe(false);
    expect(listsMainModelsInSelect("<Select options={upscalers.map((m) => ({ value: m.key, label: m.name }))} />")).toBe(false);
    expect(listsMainModelsInSelect('const all = drawableModels(models);\nmodel: all.map((m): ChoiceOption => ({ value: m.key, label: m.name })),\n<Select />')).toBe(false);
  });

  it('chooses every main model with ModelPicker, as the Generate screen does', { tags: ['condition', 'static'] }, () => {
    const found = files(SRC)
      .filter((f) => listsMainModelsInSelect(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).replaceAll('\\', '/'))
      .filter((f) => !ALLOWED.has(f));
    expect(found, 'use ModelPicker (with `auto` for an "automatic" choice) like features/params/model/ModelCard.tsx').toEqual([]);
  });
});
