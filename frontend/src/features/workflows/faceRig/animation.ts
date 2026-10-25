// The Face Rig animation: poses between keyframes, one picture per pose from the pack, and a GIF of them. The pack
// renders one pose per request, so the frames are asked for one after another.
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { backend } from '@/backend';
import type { RigState } from './rig';
import { serializeRig } from './rig';

export const MAX_FRAMES = 120;

export interface AnimationOptions {
  /** Seconds from one keyframe to the next. */
  seconds: number;
  fps: number;
  /** Return from the last keyframe to the first, so the GIF repeats without a jump. */
  loop: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The pose `t` (0..1) of the way from `a` to `b`; an axis one side lacks counts as 0. */
export function blendRig(a: RigState, b: RigState, t: number): RigState {
  const mix = (x: Record<string, number>, y: Record<string, number>) =>
    Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map((k) => [k, lerp(x[k] ?? 0, y[k] ?? 0, t)]));
  return { w: mix(a.w, b.w), p: mix(a.p, b.p), rot: [lerp(a.rot[0], b.rot[0], t), lerp(a.rot[1], b.rot[1], t), lerp(a.rot[2], b.rot[2], t)] };
}

/** One pose per frame, easing in and out of each keyframe; at most MAX_FRAMES (a longer plan is thinned evenly). */
export function animationPoses(keys: RigState[], { seconds, fps, loop }: AnimationOptions): RigState[] {
  if (keys.length === 0) return [];
  if (keys.length === 1) return [keys[0]!];
  const steps = Math.max(1, Math.round(seconds * fps));
  const segments = loop ? keys.length : keys.length - 1;
  const poses: RigState[] = [];
  for (let s = 0; s < segments; s++) {
    for (let k = 0; k < steps; k++) poses.push(blendRig(keys[s]!, keys[(s + 1) % keys.length]!, smooth(k / steps)));
  }
  if (!loop) poses.push(keys[keys.length - 1]!);
  if (poses.length <= MAX_FRAMES) return poses;
  return Array.from({ length: MAX_FRAMES }, (_, i) => poses[Math.round((i * (poses.length - 1)) / (MAX_FRAMES - 1))]!);
}

export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** A looping GIF of the frames; one palette for all of them so colours do not flicker. */
export function encodeGif(frames: RgbaFrame[], fps: number): Uint8Array {
  const first = frames[0];
  if (!first) throw new Error('no frames');
  const sample: number[] = [];
  for (const f of frames) for (let i = 0; i < f.data.length; i += 16) sample.push(f.data[i]!, f.data[i + 1]!, f.data[i + 2]!, f.data[i + 3]!);
  const palette = quantize(Uint8Array.from(sample), 256);
  const gif = GIFEncoder();
  for (const f of frames) gif.writeFrame(applyPalette(f.data, palette), f.width, f.height, { palette, delay: Math.round(1000 / fps), repeat: 0 });
  gif.finish();
  return gif.bytes();
}

async function pixels(url: string): Promise<RgbaFrame> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

async function renderFrames(imageName: string, poses: RigState[], onProgress: (done: number) => void, signal: AbortSignal): Promise<RgbaFrame[]> {
  const nodeKey = `rig-anim-${Math.random().toString(36).slice(2)}`;
  const frames: RgbaFrame[] = [];
  let sent = false;
  for (const pose of poses) {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    let res = await backend.faceRigPreview({ nodeKey, image: sent ? null : imageName, rig: serializeRig(pose), quality: 'final' });
    if ('needsFrame' in res && sent) res = await backend.faceRigPreview({ nodeKey, image: imageName, rig: serializeRig(pose), quality: 'final' });
    if ('needsFrame' in res) throw new Error('The pack did not accept the picture');
    if ('error' in res) throw new Error(res.error);
    sent = true;
    frames.push(await pixels(res.image));
    onProgress(frames.length);
  }
  return frames;
}

/**
 * Renders every pose on the picture and returns the GIF. `onProgress` gets the number of frames done; aborting the
 * signal stops after the frame in flight. Throws the pack's message when it cannot render.
 */
export async function renderGif(imageName: string, poses: RigState[], fps: number, onProgress: (done: number) => void, signal: AbortSignal): Promise<Uint8Array> {
  return encodeGif(await renderFrames(imageName, poses, onProgress, signal), fps);
}

/** The video types the browser can record, best first. */
const VIDEO_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

/** The type a video of the animation would be recorded as, or null when this browser cannot record one. */
export function videoType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/** Records the frames as a video by playing them onto a canvas at `fps`; takes as long as the video lasts. */
export async function encodeVideo(frames: RgbaFrame[], fps: number, signal: AbortSignal): Promise<Blob> {
  const first = frames[0];
  const type = videoType();
  if (!first) throw new Error('no frames');
  if (!type) throw new Error('This browser cannot record video');
  const canvas = document.createElement('canvas');
  canvas.width = first.width;
  canvas.height = first.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  recorder.start();
  try {
    for (const f of frames) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      ctx.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.width, f.height), 0, 0);
      await wait(1000 / fps);
    }
  } finally {
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
  }
  return new Blob(chunks, { type });
}

/** Renders every pose and records them as a video; same progress and abort rules as `renderGif`. */
export async function renderVideo(imageName: string, poses: RigState[], fps: number, onProgress: (done: number) => void, signal: AbortSignal): Promise<Blob> {
  return encodeVideo(await renderFrames(imageName, poses, onProgress, signal), fps, signal);
}
