// "Comparison grid" (X/Y plot): one generation setting varies along the columns and another along the rows, every cell
// is made from the Generate form's other settings with the same seed, and the pictures are put in one labelled grid.
// This is the logic that needs no screen: which settings can vary, how a list of values is read, and the requests.
import { SCHEDULERS, randomSeed, type EnqueueRequest, type SchedulerName } from '@/backend';
import { findModel } from './models';

export type AxisKind = 'cfgScale' | 'steps' | 'seed' | 'strength' | 'scheduler' | 'model' | 'prompt';

/** Settings that can vary, in the order the menus list them. */
export const AXIS_KINDS: AxisKind[] = ['cfgScale', 'steps', 'seed', 'strength', 'scheduler', 'model', 'prompt'];

/** The numbers an axis accepts. `integer` axes round down to whole numbers. */
const NUMBER_RANGES = {
  cfgScale: { min: 1, max: 30, integer: false },
  steps: { min: 1, max: 150, integer: true },
  seed: { min: 0, max: 4_294_967_295, integer: true },
  strength: { min: 0.05, max: 1, integer: false },
} as const;

/** A starting list of values for a setting, shown in the box when the setting is chosen. */
export const AXIS_DEFAULTS: Record<'cfgScale' | 'steps' | 'seed' | 'strength' | 'prompt', string> = {
  cfgScale: '3, 4.5, 6, 8',
  steps: '15, 25, 35',
  seed: '1, 2, 3, 4',
  strength: '0.3, 0.5, 0.7',
  prompt: 'smiling\nangry\nsurprised',
};

/** The most pictures one grid may hold, and the most values on one axis. */
export const MAX_CELLS = 36;
export const MAX_AXIS_VALUES = 8;

export interface Axis {
  kind: AxisKind | null;
  /** The values in order; numbers are written as text so every kind is a list of strings. */
  values: string[];
}

export const NO_AXIS: Axis = { kind: null, values: [] };

export type ParseResult = { values: string[]; error: null } | { values: string[]; error: 'invalid' | 'empty' | 'tooMany' };

/** Reads the text of a number or prompt axis. Numbers split at commas, spaces and lines; prompts only at lines. */
export function parseAxisValues(kind: AxisKind, text: string): ParseResult {
  if (kind === 'scheduler' || kind === 'model') return { values: [], error: 'invalid' };
  const parts = (kind === 'prompt' ? text.split(/\r?\n/) : text.split(/[\s,、，]+/)).map((p) => p.trim()).filter(Boolean);
  const values: string[] = [];
  for (const part of parts) {
    if (kind !== 'prompt') {
      const range = NUMBER_RANGES[kind];
      const n = Number(part);
      if (!Number.isFinite(n) || n < range.min || n > range.max) return { values, error: 'invalid' };
      const clean = range.integer ? Math.floor(n) : n;
      if (!values.includes(String(clean))) values.push(String(clean));
    } else if (!values.includes(part)) values.push(part);
  }
  if (!values.length) return { values, error: 'empty' };
  if (values.length > MAX_AXIS_VALUES) return { values: values.slice(0, MAX_AXIS_VALUES), error: 'tooMany' };
  return { values, error: null };
}

/** The columns and rows of a grid; an axis without a setting is one column (or row). */
export function gridSize(x: Axis, y: Axis): { columns: number; rows: number; cells: number } {
  const columns = x.kind ? x.values.length : 1;
  const rows = y.kind ? y.values.length : 1;
  return { columns, rows, cells: columns * rows };
}

/** Why the two axes cannot make a grid, or null. */
export function gridProblem(x: Axis, y: Axis): 'noAxis' | 'sameAxis' | 'empty' | 'tooMany' | null {
  if (!x.kind && !y.kind) return 'noAxis';
  if (x.kind && x.kind === y.kind) return 'sameAxis';
  if ((x.kind && !x.values.length) || (y.kind && !y.values.length)) return 'empty';
  return gridSize(x, y).cells > MAX_CELLS ? 'tooMany' : null;
}

/** The request with one setting changed. A value that does not fit the setting leaves the request as it was. */
export function applyAxis(request: EnqueueRequest, kind: AxisKind, value: string): EnqueueRequest {
  const params = { ...request.params };
  switch (kind) {
    case 'cfgScale':
      params.cfgScale = Number(value);
      break;
    case 'steps':
      params.steps = Number(value);
      break;
    case 'seed':
      params.seed = Number(value);
      break;
    case 'strength':
      params.strength = Number(value);
      break;
    case 'scheduler':
      if ((SCHEDULERS as string[]).includes(value)) params.scheduler = value as SchedulerName;
      break;
    case 'model': {
      const model = findModel(value);
      if (model) {
        params.modelKey = model.key;
        params.modelName = model.name;
      }
      break;
    }
    case 'prompt':
      params.positivePrompt = params.positivePrompt.trim() ? `${params.positivePrompt.trim()}, ${value}` : value;
      break;
  }
  return { ...request, params };
}

export interface Cell {
  column: number;
  row: number;
  request: EnqueueRequest;
}

/**
 * One request per cell, row by row. Every cell draws once with the same seed (a seed axis changes it), so what differs
 * between cells is only what the axes vary.
 */
export function buildCells(base: EnqueueRequest, x: Axis, y: Axis, seed: number = randomSeed()): Cell[] {
  const fixed: EnqueueRequest = { ...base, iterations: 1, randomizeSeed: false, prepend: false, params: { ...base.params, seed } };
  const cells: Cell[] = [];
  const { columns, rows } = gridSize(x, y);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let request = fixed;
      if (x.kind) request = applyAxis(request, x.kind, x.values[column]!);
      if (y.kind) request = applyAxis(request, y.kind, y.values[row]!);
      cells.push({ column, row, request });
    }
  }
  return cells;
}

/** The text above a column or beside a row: a model by its name, anything else as written. */
export function valueLabel(kind: AxisKind, value: string): string {
  return kind === 'model' ? (findModel(value)?.name ?? value) : value;
}
