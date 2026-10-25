// Who acts where in a panel with several characters: the pose places them, by name or in the cast's order, and a
// character without a person shares the rest of the panel.
import { describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { castRegions, storeCastRegions } from './castRegions';
import type { ComicCharacter, ComicPoint } from './document';

const person = (x: number): ComicPoint[] => [
  { x, y: 0.3 },
  { x, y: 0.4 },
  { x: x - 0.05, y: 0.8 },
  { x: x + 0.05, y: 0.8 },
];
const boy: ComicCharacter = { id: 'boy', name: 'Jin', tags: '1boy', imageName: null };
const girl: ComicCharacter = { id: 'girl', name: 'Akane', tags: '1girl', imageName: null };
const kage: ComicCharacter = { id: 'kage', name: 'Kage', tags: 'monster', imageName: null, nonHuman: true };
const project = { cast: [boy, girl, kage] };

describe('castRegions', () => {
  it('is null for a panel with one character, with no pose, or with nobody placed', () => {
    expect(castRegions(project, { cast: ['boy'], poses: [person(0.3)] })).toBeNull();
    expect(castRegions(project, { cast: ['boy', 'girl'], poses: [] })).toBeNull();
    // Two people in the cast, three in the pose, nobody named: they cannot be told apart.
    expect(castRegions(project, { cast: ['boy', 'girl'], poses: [person(0.2), person(0.5), person(0.8)] })).toBeNull();
  });

  it('takes the human characters in the panel order when they are as many as the people', () => {
    const regions = castRegions(project, { cast: ['girl', 'boy', 'kage'], poses: [person(0.25), person(0.75)] })!;
    expect(regions.map((r) => r.character.id)).toEqual(['girl', 'boy', 'kage']);
    expect(regions[0]!.box!.x).toBeLessThan(0.25);
    expect(regions[1]!.box!.x).toBeGreaterThan(0.5);
    // The monster has no person: it shares the rest of the panel.
    expect(regions[2]!.box).toBeNull();
  });

  it('follows the names given to the people, and keeps a box inside the panel', () => {
    const regions = castRegions(project, { cast: ['boy', 'girl'], poses: [person(0.02), person(0.75)], poseCast: ['girl', 'boy'] })!;
    const girlBox = regions.find((r) => r.character.id === 'girl')!.box!;
    expect(girlBox.x).toBe(0);
    expect(regions.find((r) => r.character.id === 'boy')!.box!.x).toBeGreaterThan(0.5);
    for (const r of regions) expect(r.box!.x + r.box!.w).toBeLessThanOrEqual(1);
  });
});

describe('storeCastRegions', () => {
  it('stores each mask once: a panel drawn again with the same people in the same places reuses them', async () => {
    const png = new Blob(['x'], { type: 'image/png' });
    const canvas = { width: 0, height: 0, getContext: () => ({ fillRect: () => undefined, fillStyle: '' }), toBlob: (cb: (b: Blob) => void) => cb(png) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const upload = vi.spyOn(backend, 'uploadImage').mockImplementation(async () => ({ name: `m${upload.mock.calls.length}.png`, url: `novira-image://m${upload.mock.calls.length}.png` }) as ImageDTO);
    const regions = castRegions(project, { cast: ['girl', 'boy'], poses: [person(0.25), person(0.75)] })!;
    const first = await storeCastRegions(regions, 640, 480);
    expect(upload).toHaveBeenCalledTimes(2);
    const again = await storeCastRegions(regions, 640, 480);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(again.map((r) => r.imageUrl)).toEqual(first.map((r) => r.imageUrl));
    // Another size is another mask.
    await storeCastRegions(regions, 320, 240);
    expect(upload).toHaveBeenCalledTimes(4);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
