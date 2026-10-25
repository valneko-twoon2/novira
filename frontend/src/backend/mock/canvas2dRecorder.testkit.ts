// Test support: a stand-in for CanvasRenderingContext2D that records every call and property write, so drawing code can
// be unit-tested without a real canvas. Not part of the app (excluded from coverage in vitest.config.ts).
import { vi } from 'vitest';

export interface RecordedCall {
  name: string;
  args: unknown[];
}

export interface Recorder {
  ctx: CanvasRenderingContext2D;
  /** Every method call, in order. */
  calls: RecordedCall[];
  /** Every property assignment, in order. */
  sets: { name: string; value: unknown }[];
  /** Calls of one method. */
  of(name: string): unknown[][];
}

export interface RecorderOptions {
  width?: number;
  height?: number;
  /** Every character is this wide, whatever the font. */
  charWidth?: number;
  /** The `a` of the current transform. */
  scale?: number;
  /** The canvas the context belongs to (its size wins over `width`/`height`). */
  canvas?: { width: number; height: number };
  /** Colour of a pixel handed out by getImageData: [r, g, b, a]. The default is black on the left half, white on the right. */
  pixel?: (x: number, y: number, width: number, height: number) => number[];
}

export function recordingContext(options: RecorderOptions = {}): Recorder {
  const { width = 200, height = 100, charWidth = 10, scale = 1 } = options;
  const calls: RecordedCall[] = [];
  const sets: { name: string; value: unknown }[] = [];
  const state: Record<string, unknown> = { letterSpacing: '0px', canvas: options.canvas ?? { width, height } };
  const pixel = options.pixel ?? ((x, _y, w) => (x < w / 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    measureText: (text) => ({ width: String(text).length * charWidth }),
    getTransform: () => ({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createPattern: () => ({}),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Number(w) * Number(h) * 4) }),
    getImageData: (_x, _y, w, h) => {
      const data = new Uint8ClampedArray(Number(w) * Number(h) * 4);
      for (let y = 0; y < Number(h); y++) {
        for (let x = 0; x < Number(w); x++) data.set(pixel(x, y, Number(w), Number(h)), (y * Number(w) + x) * 4);
      }
      return { width: w, height: h, data };
    },
  };
  const ctx = new Proxy(
    {},
    {
      get(_t, key: string) {
        if (key in state) return state[key];
        return (...args: unknown[]) => {
          calls.push({ name: key, args });
          return methods[key]?.(...args);
        };
      },
      set(_t, key: string, value) {
        state[key] = value;
        sets.push({ name: key, value });
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, sets, of: (name) => calls.filter((c) => c.name === name).map((c) => c.args) };
}

/** Makes `canvas.getContext('2d')` of every canvas element return `rec.ctx`; call the returned function to restore. */
export function installRecordingCanvas(rec: Recorder): () => void {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => rec.ctx as never);
  return () => spy.mockRestore();
}

/** Gives every canvas element its own recorder (sized like the canvas); `of(canvas)` finds it. Call `restore` afterwards. */
export function installRecordingCanvases(options: Omit<RecorderOptions, 'canvas'> = {}): {
  of(canvas: HTMLCanvasElement): Recorder;
  all: Recorder[];
  restore(): void;
} {
  const byCanvas = new Map<HTMLCanvasElement, Recorder>();
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let rec = byCanvas.get(this);
    if (!rec) {
      rec = recordingContext({ ...options, canvas: this });
      byCanvas.set(this, rec);
    }
    return rec.ctx as never;
  });
  return {
    of: (canvas) => {
      canvas.getContext('2d');
      return byCanvas.get(canvas)!;
    },
    get all() {
      return [...byCanvas.values()];
    },
    restore: () => spy.mockRestore(),
  };
}
