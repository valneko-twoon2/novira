import { describe, expect, it } from 'vitest';
import { J } from '@/state/pose/pose';
import { newPerson, newProp, type ComicRough, type RoughCamera } from './rough';
import { depthBuffer, depthPixels, seenPeople } from './roughBake';

const camera: RoughCamera = { target: { x: 0, y: 1, z: 0 }, yaw: 0, pitch: 0, distance: 3, fov: 40 };
const set = (rough: Partial<ComicRough>): ComicRough => ({ camera, people: [], props: [], floor: false, ...rough });

describe('the depth of a rough', () => {
  it('finds a wall facing the camera at its distance, and nothing round it', () => {
    const wall = { ...newProp('plane', 0, -1, 0), w: 1, h: 2 };
    const buffer = depthBuffer(set({ props: [wall] }), 40, 40);
    const at = (x: number, y: number) => buffer.inverse[y * 40 + x]!;
    expect(1 / at(20, 20)).toBeCloseTo(4, 3);
    expect(at(1, 20)).toBe(0);
  });

  it('cuts the floor in front of the camera, so it fills the lower half of the picture up to the horizon', () => {
    const buffer = depthBuffer(set({ floor: true }), 32, 32);
    const row = (y: number) => Array.from({ length: 32 }, (_, x) => buffer.inverse[y * 32 + x]!);
    expect(row(31).every((w) => w > 0)).toBe(true);
    expect(row(10).every((w) => w === 0)).toBe(true);
    // Nearer rows of the floor are nearer the camera.
    expect(row(31)[16]!).toBeGreaterThan(row(20)[16]!);
  });

  it('keeps the nearer of two things in front of each other', () => {
    const near = { ...newProp('plane', 0, 1, 0), w: 0.2, h: 2 };
    const far = { ...newProp('plane', 0, -1, 0), w: 4, h: 2 };
    const buffer = depthBuffer(set({ props: [far, near] }), 41, 41);
    expect(1 / buffer.inverse[20 * 41 + 20]!).toBeCloseTo(2, 3);
  });

  it('draws the nearest surface white, the farthest black and nothing black', () => {
    const pixels = depthPixels({ width: 3, height: 1, inverse: new Float32Array([0.5, 0.25, 0]) });
    expect([pixels[0], pixels[4], pixels[8]]).toEqual([255, 0, 0]);
    expect(pixels[3]).toBe(255);
    expect(depthPixels({ width: 1, height: 1, inverse: new Float32Array([0.3]) })[0]).toBe(255);
  });
});

describe('what the camera sees of the people', () => {
  const see = (rough: ComicRough) => seenPeople(rough, depthBuffer(rough, 200, 200))[0]!;

  it('sees every joint of a person facing it', () => {
    expect(see(set({ people: [newPerson(0, 0, 0)] })).hidden).toEqual([]);
  });

  it('puts a joint behind the camera where the nearest seen joint is, not in the corner, and a person wholly behind it outside the picture', () => {
    // A rough's person reaching past the camera left a joint at (0, 0), which pulled its box over the whole panel.
    const close: RoughCamera = { ...camera, distance: 0.3 };
    const seen = seenPeople(set({ camera: close, people: [newPerson(0, 0.2, Math.PI / 2)] }), depthBuffer(set({ camera: close }), 200, 200))[0]!;
    expect(seen.hidden.length).toBeGreaterThan(0);
    const shown = Array.from({ length: 18 }, (_, k) => k).filter((k) => !seen.hidden.includes(k));
    expect(shown.length).toBeGreaterThan(0);
    for (const i of seen.hidden) {
      const at = [seen.points[i * 2]!, seen.points[i * 2 + 1]!];
      expect(shown.some((k) => seen.points[k * 2] === at[0] && seen.points[k * 2 + 1] === at[1])).toBe(true);
    }
    const behind = seenPeople(set({ people: [newPerson(0, 5, 0)] }), depthBuffer(set({}), 200, 200))[0]!;
    expect(behind.hidden).toHaveLength(18);
    expect(behind.points.every((v) => v === -200)).toBe(true);
  });

  it('hides the face of a person turned away, but not the ears', () => {
    expect(see(set({ people: [newPerson(0, 0, Math.PI)] })).hidden).toEqual([J.nose, J.rEye, J.lEye]);
  });

  it('hides the far arm of a person seen from the side', () => {
    const { hidden } = see(set({ people: [newPerson(0, 0, Math.PI / 2)] }));
    // Turned to the camera's right, the person shows the right side; the left arm is behind the body.
    expect(hidden).toEqual(expect.arrayContaining([J.lElbow, J.lWrist]));
    expect(hidden).not.toContain(J.rElbow);
  });

  it('hides the legs of a person behind a desk', () => {
    const desk = { ...newProp('box', 0, 0.8, 0), w: 1.5, h: 0.8, d: 0.6 };
    const { hidden } = see(set({ people: [newPerson(0, 0, 0)], props: [desk] }));
    expect(hidden).toEqual(expect.arrayContaining([J.rKnee, J.lKnee, J.rAnkle, J.lAnkle]));
    expect(hidden).not.toContain(J.neck);
  });

  it('keeps a joint out of the picture, hides one behind the camera, and gives the points in pixels', () => {
    const close = set({ camera: { ...camera, distance: 0.8 }, people: [newPerson(0, 0, 0)] });
    const seen = see(close);
    // At 0.8 m the feet are below the picture: kept, so the figure runs out of the frame.
    expect(seen.points[J.rAnkle * 2 + 1]!).toBeGreaterThan(200);
    expect(seen.hidden).not.toContain(J.rAnkle);
    const behind = see(set({ people: [newPerson(0, 4, 0)] }));
    expect(behind.hidden).toHaveLength(18);
  });
});
