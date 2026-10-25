import { describe, expect, it } from 'vitest';
import { MAX_FRAMES, animationPoses, blendRig, encodeGif, encodeVideo, videoType } from './animation';
import { EMPTY_RIG, serializeRig, type RigState } from './rig';

/** Poses are the same when they write the same `rig` text. */
const same = (a: RigState | undefined, b: RigState) => expect(serializeRig(a!)).toBe(serializeRig(b));

const smile: RigState = { w: { au12: 1 }, p: { happy: 0.6 }, rot: [0, 20, 0] };

describe('face rig animation poses', () => {
  it('blends axes, presets and head turn, treating a missing axis as 0', () => {
    const half = blendRig(EMPTY_RIG, smile, 0.5);
    expect(half.w.au12).toBe(0.5);
    expect(half.p.happy).toBeCloseTo(0.3);
    expect(half.rot[1]).toBe(10);
  });

  it('eases from one keyframe to the next and ends on the last one', () => {
    const poses = animationPoses([EMPTY_RIG, smile], { seconds: 1, fps: 10, loop: false });
    expect(poses).toHaveLength(11);
    same(poses[0], EMPTY_RIG);
    same(poses[10], smile);
    // Slow at the ends, fast in the middle.
    const w = poses.map((p) => p.w.au12 ?? 0);
    expect(w[1]! - w[0]!).toBeLessThan(w[6]! - w[5]!);
  });

  it('returns to the first keyframe when it loops, without repeating it', () => {
    const poses = animationPoses([EMPTY_RIG, smile], { seconds: 0.5, fps: 10, loop: true });
    expect(poses).toHaveLength(10);
    same(poses[0], EMPTY_RIG);
    expect(poses[5]!.w.au12).toBe(1);
    expect(poses[9]!.w.au12!).toBeGreaterThan(0);
  });

  it('has nothing to animate with fewer than two keyframes, and caps the frame count', () => {
    expect(animationPoses([], { seconds: 1, fps: 10, loop: true })).toEqual([]);
    expect(animationPoses([smile], { seconds: 1, fps: 10, loop: true })).toEqual([smile]);
    const long = animationPoses([EMPTY_RIG, smile, EMPTY_RIG, smile], { seconds: 3, fps: 24, loop: true });
    expect(long).toHaveLength(MAX_FRAMES);
    same(long[0], EMPTY_RIG);
  });
});

describe('face rig GIF', () => {
  const frame = (shade: number) => {
    const data = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < data.length; i += 4) data.set([shade, 255 - shade, 80, 255], i);
    return { data, width: 8, height: 8 };
  };

  it('writes a looping GIF with one frame per picture at the frame delay', () => {
    const bytes = encodeGif([frame(0), frame(100), frame(200)], 10);
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    // Graphic control extension (0x21 0xF9) holds the delay in hundredths of a second: 10 fps is 10.
    let frames = 0;
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 4) {
        frames += 1;
        expect(bytes[i + 4]).toBe(10);
      }
    }
    expect(frames).toBe(3);
    expect(() => encodeGif([], 10)).toThrow();
  });

  it('offers a video only where the browser can record one', async () => {
    // jsdom has no MediaRecorder.
    expect(videoType()).toBeNull();
    await expect(encodeVideo([{ data: new Uint8ClampedArray(4), width: 1, height: 1 }], 10, new AbortController().signal)).rejects.toThrow('cannot record');
  });
});
