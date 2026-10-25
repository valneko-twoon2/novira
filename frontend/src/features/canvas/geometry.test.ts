// Pure canvas math: bbox resizing, coverage and generation mode (zoom math: ui/zoomMath.test.ts).
import { describe, expect, it } from 'vitest';
import { pickGenerationMode } from './generationMode';
import { classifyCoverage, hitBbox, resizeRect, transformedRect } from './geometry';

describe('canvas geometry', () => {
  it('resizes the bbox from handles with snapping, minimum and ratio', () => {
    const start = { x: 0, y: 0, width: 512, height: 512 };
    expect(resizeRect(start, 'se', 100, 3)).toEqual({ x: 0, y: 0, width: 616, height: 512 });
    expect(resizeRect(start, 'nw', 600, 600)).toEqual({ x: 448, y: 448, width: 64, height: 64 });
    expect(resizeRect(start, 'e', 512, 0, { ratio: 1 })).toMatchObject({ width: 1024, height: 1024 });
  });

  it('hit-tests handles before the inside', () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(hitBbox({ x: 101, y: 99 }, r)).toBe('nw');
    expect(hitBbox({ x: 200, y: 150 }, r)).toBe('inside');
    expect(hitBbox({ x: 10, y: 10 }, r)).toBeNull();
  });

  it('classifies coverage and picks the generation mode', () => {
    const px = (alphas: number[]) => alphas.flatMap((a) => [0, 0, 0, a]);
    expect(classifyCoverage(px([0, 0]))).toBe('empty');
    expect(classifyCoverage(px([255, 255]))).toBe('full');
    expect(classifyCoverage(px([255, 0]))).toBe('partial');
    expect(pickGenerationMode('empty', true)).toBe('txt2img');
    expect(pickGenerationMode('partial', false)).toBe('outpaint');
    expect(pickGenerationMode('full', true)).toBe('inpaint');
    expect(pickGenerationMode('full', false)).toBe('img2img');
  });
});

describe('transformedRect', () => {
  it('keeps the centre, swaps the sides for a quarter turn and doubles or halves for scaling', () => {
    const r = { x: 10, y: 20, width: 40, height: 20 };
    expect(transformedRect(r, 'rotateRight')).toEqual({ x: 20, y: 10, width: 20, height: 40 });
    expect(transformedRect(r, 'rotateLeft')).toEqual({ x: 20, y: 10, width: 20, height: 40 });
    expect(transformedRect(r, 'scaleUp')).toEqual({ x: -10, y: 10, width: 80, height: 40 });
    expect(transformedRect(r, 'scaleDown')).toEqual({ x: 20, y: 25, width: 20, height: 10 });
  });
});
