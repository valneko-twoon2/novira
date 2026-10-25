// Reading the layers of a version 1 page before they are migrated: the default stack for a page saved before there were
// layers, every field held to its range, damaged parts dropped, and the bounds version 1 held a saved file to.
import { describe, expect, it } from 'vitest';
import {
  BALLOONS_LAYER_ID,
  defaultLayers,
  LAYER_NAME_MAX,
  MAX_LAYERS_PER_PAGE,
  MAX_POINTS_PER_PAGE,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_LAYER,
  PANELS_LAYER_ID,
  parseLayers,
  parseStroke,
  STROKE_WIDTH_RANGE,
  type ComicLayer,
  type ComicStroke,
  type DrawingLayer,
} from './layersV1';

const kinds = (layers: ComicLayer[]) => layers.map((l) => l.kind);
const line = (n = 2): ComicStroke => ({ points: Array.from({ length: n * 2 }, (_, i) => (i % 10) / 10), color: '#112233', width: 0.01, erase: false });
const drawing = (id: string, name: string, strokes: unknown[] = []) => ({ id, kind: 'drawing', name, strokes });
const strokePoints = (layers: ComicLayer[]) => layers.reduce((n, l) => n + (l.kind === 'drawing' ? l.strokes.reduce((m, s) => m + s.points.length / 2, 0) : 0), 0);

describe('reading saved version 1 layers', () => {
  it('gives a page saved before there were layers the default stack', () => {
    expect(parseLayers(undefined)).toEqual(defaultLayers());
    expect(parseLayers('not a list')).toEqual(defaultLayers());
    expect(defaultLayers().map((l) => l.id)).toEqual([PANELS_LAYER_ID, BALLOONS_LAYER_ID]);
  });

  it('keeps every field in its range and drops what cannot be read', () => {
    const layers = parseLayers([
      { id: 'panels', kind: 'panels', opacity: 7, blend: 'overlay', visible: 'no' },
      { id: 'a', kind: 'drawing', name: ' Line\nart ', opacity: -1, strokes: [{ points: [0.5, 0.5, 9, -9], color: 'red', width: 99, erase: true }, { points: [] }, { points: [0.1, 'x'] }, 'junk'] },
      { id: 'b', kind: 'image', imageName: '', view: { cx: 99, scale: 0 } },
      { id: 'c', kind: 'tone' },
      { kind: 'drawing' },
      'junk',
    ]);
    expect(kinds(layers)).toEqual(['panels', 'drawing', 'image', 'balloons']);
    expect(layers[0]).toMatchObject({ opacity: 1, blend: 'normal', visible: true });
    const ink = layers[1] as DrawingLayer;
    expect(ink).toMatchObject({ name: 'Line art', opacity: 0 });
    expect(ink.strokes).toEqual([{ points: [0.5, 0.5, 1.1, -0.1], color: '#000000', width: STROKE_WIDTH_RANGE.max, erase: true }]);
    expect(layers[2]).toMatchObject({ imageName: null, view: { cx: 2, scale: 0.1 } });
  });

  it('keeps one layer per id and one of each built-in layer, and puts a missing built-in layer back', () => {
    const user = drawing('ink', 'Ink');
    const layers = parseLayers([{ id: 'balloons', kind: 'balloons' }, user, { ...user, name: 'Copy' }, { id: 'other', kind: 'balloons' }]);
    // The balloons were saved under the drawing: they stay there; the panels were missing and go to the bottom.
    expect(kinds(layers)).toEqual(['panels', 'balloons', 'drawing']);
    expect(layers.filter((l) => l.id === 'ink')).toHaveLength(1);
  });

  it('cuts a page to the most layers it may hold, keeping the built-in layers', () => {
    const many = [...defaultLayers(), ...Array.from({ length: MAX_LAYERS_PER_PAGE + 5 }, (_, i) => drawing(`l${i}`, `L${i}`))];
    const layers = parseLayers(many);
    expect(layers).toHaveLength(MAX_LAYERS_PER_PAGE);
    expect(kinds(layers).slice(0, 2)).toEqual(['panels', 'balloons']);
    expect(layers.at(-1)!.name).toBe(`L${MAX_LAYERS_PER_PAGE - 3}`);
  });

  it('holds the drawings to the most strokes of a layer, points of a stroke and points of a page', () => {
    const long = { points: Array.from({ length: (MAX_POINTS_PER_STROKE + 10) * 2 }, () => 0.5) };
    expect(parseStroke(long)!.points).toHaveLength(MAX_POINTS_PER_STROKE * 2);
    const crowded = drawing('a', 'A', Array.from({ length: MAX_STROKES_PER_LAYER + 3 }, () => line(1)));
    expect((parseLayers([crowded])[1] as DrawingLayer).strokes).toHaveLength(MAX_STROKES_PER_LAYER);
    const heavy = (id: string) => drawing(id, 'H', Array.from({ length: 20 }, () => ({ ...line(0), points: long.points })));
    expect(strokePoints(parseLayers([heavy('h1'), heavy('h2'), heavy('h3')]))).toBe(MAX_POINTS_PER_PAGE);
  });

  it('keeps a name to one line of at most LAYER_NAME_MAX characters', () => {
    const [, layer] = parseLayers([{ id: 'i', kind: 'image', name: 'x'.repeat(200) }]);
    expect(layer!.name).toHaveLength(LAYER_NAME_MAX);
  });
});
