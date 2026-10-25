import { describe, expect, it } from 'vitest';
import type { EnqueueRequest, GenerationMetadata, ModelConfig } from '@/backend';
import { useModels } from './models';
import { AXIS_DEFAULTS, MAX_AXIS_VALUES, MAX_CELLS, NO_AXIS, applyAxis, buildCells, gridProblem, gridSize, parseAxisValues, valueLabel, type Axis } from './xyplot';

const params: GenerationMetadata = {
  generationMode: 'txt2img',
  positivePrompt: 'a girl',
  negativePrompt: '',
  modelKey: 'm1',
  modelName: 'Model 1',
  vaeKey: null,
  seed: 7,
  steps: 20,
  cfgScale: 6,
  cfgRescale: 0,
  scheduler: 'euler',
  width: 512,
  height: 512,
  clipSkip: 0,
  seamlessX: false,
  seamlessY: false,
  loras: [],
};

const base: EnqueueRequest = { origin: 'generate', destination: 'gallery', params, iterations: 4, randomizeSeed: true, prepend: true, boardId: 'b1' };

const model = (key: string, name: string) => ({ key, name, base: 'sdxl', type: 'main', format: 'checkpoint', description: '', path: '', size: 0, source: '' }) as ModelConfig;
const axis = (kind: Axis['kind'], values: string[]): Axis => ({ kind, values });

describe('parseAxisValues', () => {
  it('reads numbers split at commas, spaces and lines, without repeats', () => {
    expect(parseAxisValues('cfgScale', '3, 4.5 6\n6，8')).toEqual({ values: ['3', '4.5', '6', '8'], error: null });
  });

  it('rounds whole-number settings down', () => {
    expect(parseAxisValues('steps', '20.9, 30').values).toEqual(['20', '30']);
  });

  it('refuses a value that is not a number or is out of range, and an empty list', () => {
    expect(parseAxisValues('cfgScale', '3, abc').error).toBe('invalid');
    expect(parseAxisValues('cfgScale', '0').error).toBe('invalid');
    expect(parseAxisValues('steps', '999').error).toBe('invalid');
    expect(parseAxisValues('strength', '1.5').error).toBe('invalid');
    expect(parseAxisValues('seed', '  ').error).toBe('empty');
  });

  it('keeps only as many values as an axis may hold', () => {
    const many = Array.from({ length: MAX_AXIS_VALUES + 2 }, (_, i) => String(i + 1)).join(',');
    const parsed = parseAxisValues('steps', many);
    expect(parsed.error).toBe('tooMany');
    expect(parsed.values).toHaveLength(MAX_AXIS_VALUES);
  });

  it('splits a prompt axis only at lines, so commas stay inside a value', () => {
    expect(parseAxisValues('prompt', 'red hair, smiling\n\nblue eyes').values).toEqual(['red hair, smiling', 'blue eyes']);
  });

  it('accepts its own starting values', () => {
    for (const kind of ['cfgScale', 'steps', 'seed', 'strength', 'prompt'] as const) expect(parseAxisValues(kind, AXIS_DEFAULTS[kind]).error).toBeNull();
  });
});

describe('gridSize and gridProblem', () => {
  it('counts one column or row for an axis that is not used', () => {
    expect(gridSize(axis('cfgScale', ['3', '6']), NO_AXIS)).toEqual({ columns: 2, rows: 1, cells: 2 });
    expect(gridSize(axis('cfgScale', ['3', '6']), axis('steps', ['10', '20', '30']))).toEqual({ columns: 2, rows: 3, cells: 6 });
  });

  it('names what is wrong with the axes', () => {
    expect(gridProblem(NO_AXIS, NO_AXIS)).toBe('noAxis');
    expect(gridProblem(axis('steps', ['1']), axis('steps', ['2']))).toBe('sameAxis');
    expect(gridProblem(axis('steps', []), NO_AXIS)).toBe('empty');
    const wide = Array.from({ length: MAX_AXIS_VALUES }, (_, i) => String(i + 1));
    expect(gridProblem(axis('steps', wide), axis('seed', wide))).toBe(wide.length ** 2 > MAX_CELLS ? 'tooMany' : null);
    expect(gridProblem(axis('cfgScale', ['3', '6']), NO_AXIS)).toBeNull();
  });
});

describe('applyAxis', () => {
  it('changes one setting and leaves the rest and the original alone', () => {
    const changed = applyAxis(base, 'cfgScale', '4.5');
    expect(changed.params.cfgScale).toBe(4.5);
    expect(changed.params.steps).toBe(20);
    expect(base.params.cfgScale).toBe(6);
    expect(applyAxis(base, 'steps', '35').params.steps).toBe(35);
    expect(applyAxis(base, 'seed', '99').params.seed).toBe(99);
    expect(applyAxis(base, 'strength', '0.4').params.strength).toBe(0.4);
  });

  it('only takes a scheduler that exists', () => {
    expect(applyAxis(base, 'scheduler', 'dpmpp_2m').params.scheduler).toBe('dpmpp_2m');
    expect(applyAxis(base, 'scheduler', 'nope').params.scheduler).toBe('euler');
  });

  it('switches the model by key, and ignores one that is not installed', () => {
    useModels.getState().setModels([model('m2', 'Model 2')]);
    expect(applyAxis(base, 'model', 'm2').params).toMatchObject({ modelKey: 'm2', modelName: 'Model 2' });
    expect(applyAxis(base, 'model', 'gone').params.modelKey).toBe('m1');
  });

  it('adds the words of a prompt value after the prompt', () => {
    expect(applyAxis(base, 'prompt', 'smiling').params.positivePrompt).toBe('a girl, smiling');
    expect(applyAxis({ ...base, params: { ...params, positivePrompt: '  ' } }, 'prompt', 'smiling').params.positivePrompt).toBe('smiling');
  });
});

describe('buildCells', () => {
  it('makes one single-picture request per cell, row by row, all with the same seed', () => {
    const cells = buildCells(base, axis('cfgScale', ['3', '6']), axis('steps', ['10', '20', '30']), 123);
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => [c.column, c.row])).toEqual([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]);
    expect(cells.map((c) => [c.request.params.cfgScale, c.request.params.steps])).toEqual([[3, 10], [6, 10], [3, 20], [6, 20], [3, 30], [6, 30]]);
    for (const c of cells) {
      expect(c.request).toMatchObject({ iterations: 1, randomizeSeed: false, prepend: false, boardId: 'b1', destination: 'gallery' });
      expect(c.request.params.seed).toBe(123);
    }
  });

  it('lets a seed axis change the seed, and makes one cell per value when only one axis is used', () => {
    const cells = buildCells(base, axis('seed', ['1', '2', '3']), NO_AXIS, 123);
    expect(cells.map((c) => c.request.params.seed)).toEqual([1, 2, 3]);
    expect(cells.every((c) => c.row === 0)).toBe(true);
  });

  it('draws a random seed when none is given, and keeps the original request untouched', () => {
    const cells = buildCells(base, axis('steps', ['10', '20']), NO_AXIS);
    expect(cells[0]!.request.params.seed).toBe(cells[1]!.request.params.seed);
    expect(base.iterations).toBe(4);
    expect(base.params.seed).toBe(7);
  });
});

describe('valueLabel', () => {
  it('shows a model by its name and everything else as written', () => {
    useModels.getState().setModels([model('m2', 'Model 2')]);
    expect(valueLabel('model', 'm2')).toBe('Model 2');
    expect(valueLabel('model', 'gone')).toBe('gone');
    expect(valueLabel('cfgScale', '4.5')).toBe('4.5');
  });
});
