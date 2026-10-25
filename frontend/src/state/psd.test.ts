import { describe, expect, it } from 'vitest';
import { croppedLayer, encodePsd, packBits, type PsdLayer } from './psd';

/** Undoes PackBits for `size` bytes. */
function unpack(data: Uint8Array, at: number, size: number): { bytes: number[]; end: number } {
  const bytes: number[] = [];
  let i = at;
  while (bytes.length < size) {
    const n = data[i++]!;
    if (n < 128) {
      for (let k = 0; k <= n; k++) bytes.push(data[i++]!);
    } else if (n > 128) {
      const v = data[i++]!;
      for (let k = 0; k < 257 - n; k++) bytes.push(v);
    }
  }
  return { bytes, end: i };
}

/** Reads back what the encoder writes: the header, each layer's record and pixels, and the flattened picture. */
function readPsd(file: Uint8Array) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let at = 0;
  const u8 = () => file[at++]!;
  const u16 = () => ((at += 2), view.getUint16(at - 2));
  const i16 = () => ((at += 2), view.getInt16(at - 2));
  const u32 = () => ((at += 4), view.getUint32(at - 4));
  const i32 = () => ((at += 4), view.getInt32(at - 4));
  const skip = () => {
    const n = u32();
    at += n;
  };
  const text = (n: number) => String.fromCharCode(...file.subarray(at, (at += n)));
  const signature = text(4);
  const version = u16();
  at += 6;
  const channels = u16();
  const height = u32();
  const width = u32();
  const depth = u16();
  const mode = u16();
  skip();
  skip();
  const sectionEnd = u32() + at;
  const infoEnd = u32() + at;
  const count = i16();
  const records = Array.from({ length: count }, () => {
    const top = i32();
    const left = i32();
    const bottom = i32();
    const right = i32();
    const chans = Array.from({ length: u16() }, () => ({ id: i16(), length: u32() }));
    const blend = text(4) + text(4);
    const opacity = u8();
    at++;
    const flags = u8();
    at++;
    const extraEnd = u32() + at;
    skip();
    skip();
    const nameStart = at;
    const nameLength = u8();
    const name = text(nameLength);
    at = nameStart + Math.ceil((nameLength + 1) / 4) * 4;
    let unicode = '';
    while (at < extraEnd) {
      const sig = text(4);
      const key = text(4);
      const length = u32();
      const end = at + length;
      if (sig === '8BIM' && key === 'luni') unicode = String.fromCharCode(...Array.from({ length: u32() }, () => u16()));
      at = end;
    }
    at = extraEnd;
    return { top, left, bottom, right, chans, blend, opacity, flags, name, unicode };
  });
  const layers = records.map((r) => {
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    const pixels: Record<number, number[]> = {};
    for (const c of r.chans) {
      const end = at + c.length;
      expect(u16()).toBe(1);
      const rows = Array.from({ length: h }, () => u16());
      const out: number[] = [];
      for (const size of rows) {
        const { bytes, end: rowEnd } = unpack(file, at, w);
        expect(rowEnd - at).toBe(size);
        out.push(...bytes);
        at = rowEnd;
      }
      expect(at).toBe(end);
      pixels[c.id] = out;
    }
    return { ...r, pixels };
  });
  expect(at <= infoEnd && infoEnd - at <= 1).toBe(true);
  at = infoEnd;
  expect(u32()).toBe(0);
  expect(at).toBe(sectionEnd);
  expect(u16()).toBe(1);
  const counts = Array.from({ length: 3 * height }, () => u16());
  const flat: number[][] = [[], [], []];
  counts.forEach((size, n) => {
    const { bytes, end } = unpack(file, at, width);
    expect(end - at).toBe(size);
    flat[Math.floor(n / height)]!.push(...bytes);
    at = end;
  });
  expect(at).toBe(file.length);
  return { signature, version, channels, width, height, depth, mode, layers, flat };
}

const solid = (w: number, h: number, rgba: [number, number, number, number]): Uint8Array => {
  const p = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) p.set(rgba, i * 4);
  return p;
};

describe('encodePsd', () => {
  it('writes an RGB file whose layers keep their place, pixels, transparency, opacity, visibility and names', () => {
    const stripes = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) % 256);
    const layers: PsdLayer[] = [
      { name: 'Paper', left: 0, top: 0, width: 4, height: 3, pixels: solid(4, 3, [255, 255, 255, 255]) },
      { name: 'コマ 1', left: -1, top: 2, width: 3, height: 2, pixels: stripes, opacity: 0.5 },
      { name: 'Hidden', left: 1, top: 1, width: 1, height: 1, pixels: solid(1, 1, [10, 20, 30, 0]), hidden: true },
    ];
    const composite = solid(4, 3, [200, 100, 0, 128]);
    const psd = readPsd(encodePsd({ width: 4, height: 3, layers, composite }));
    expect(psd).toMatchObject({ signature: '8BPS', version: 1, channels: 3, width: 4, height: 3, depth: 8, mode: 3 });
    expect(psd.layers.map((l) => [l.name, l.unicode, l.top, l.left, l.bottom, l.right, l.opacity, l.flags & 2, l.blend])).toEqual([
      ['Paper', 'Paper', 0, 0, 3, 4, 255, 0, '8BIMnorm'],
      ['?? 1', 'コマ 1', 2, -1, 4, 2, 128, 0, '8BIMnorm'],
      ['Hidden', 'Hidden', 1, 1, 2, 2, 255, 2, '8BIMnorm'],
    ]);
    const second = psd.layers[1]!;
    const back = Array.from({ length: 6 }, (_, i) => [second.pixels[0]![i], second.pixels[1]![i], second.pixels[2]![i], second.pixels[-1]![i]]).flat();
    expect(back).toEqual([...stripes]);
    expect(psd.layers[2]!.pixels[-1]).toEqual([0]);
    // Half-transparent orange over white.
    expect(psd.flat.map((c) => c[0])).toEqual([Math.round(200 * (128 / 255) + 255 * (127 / 255)), Math.round(100 * (128 / 255) + 255 * (127 / 255)), Math.round(255 * (127 / 255))]);
  });

  it('writes the blend of each layer under the key Photoshop reads, normal when it has none', () => {
    const one = (blend?: PsdLayer['blend']): PsdLayer => ({ name: blend ?? 'none', left: 0, top: 0, width: 1, height: 1, pixels: solid(1, 1, [0, 0, 0, 255]), blend });
    const psd = readPsd(encodePsd({ width: 1, height: 1, layers: [one(), one('normal'), one('multiply'), one('screen')], composite: solid(1, 1, [0, 0, 0, 255]) }));
    expect(psd.layers.map((l) => l.blend)).toEqual(['8BIMnorm', '8BIMnorm', '8BIMmul ', '8BIMscrn']);
  });

  it('writes a file with no layers, and an empty layer', () => {
    expect(readPsd(encodePsd({ width: 2, height: 2, layers: [], composite: solid(2, 2, [0, 0, 0, 255]) })).layers).toEqual([]);
    const psd = readPsd(encodePsd({ width: 2, height: 2, layers: [{ name: '', left: 0, top: 0, width: 0, height: 0, pixels: new Uint8Array() }], composite: solid(2, 2, [0, 0, 0, 255]) }));
    expect(psd.layers[0]).toMatchObject({ name: '', top: 0, bottom: 0 });
  });

  it('refuses a size Photoshop cannot open and pixels that do not match their size', () => {
    expect(() => encodePsd({ width: 0, height: 1, layers: [], composite: new Uint8Array() })).toThrow();
    expect(() => encodePsd({ width: 30001, height: 1, layers: [], composite: new Uint8Array(30001 * 4) })).toThrow();
    expect(() => encodePsd({ width: 1, height: 1, layers: [], composite: new Uint8Array(3) })).toThrow();
    expect(() => encodePsd({ width: 1, height: 1, layers: [{ name: 'x', left: 0, top: 0, width: 2, height: 1, pixels: new Uint8Array(4) }], composite: new Uint8Array(4) })).toThrow();
  });
});

describe('croppedLayer', () => {
  it('cuts a document-sized picture to the box around its visible pixels and keeps the look', () => {
    // 4 × 3, transparent but for two pixels at (1, 0) and (2, 2).
    const pixels = new Uint8Array(4 * 3 * 4);
    pixels.set([1, 2, 3, 255], (0 * 4 + 1) * 4);
    pixels.set([4, 5, 6, 1], (2 * 4 + 2) * 4);
    const layer = croppedLayer('Ink', pixels, 4, 3, { opacity: 0.5, hidden: true })!;
    expect(layer).toMatchObject({ name: 'Ink', left: 1, top: 0, width: 2, height: 3, opacity: 0.5, hidden: true });
    expect([...layer.pixels.subarray(0, 4)]).toEqual([1, 2, 3, 255]);
    expect([...layer.pixels.subarray((2 * 2 + 1) * 4, (2 * 2 + 2) * 4)]).toEqual([4, 5, 6, 1]);
    expect(layer.pixels.length).toBe(2 * 3 * 4);
  });

  it('keeps a picture with no transparent margin whole, and gives nothing for an empty one', () => {
    expect(croppedLayer('Full', solid(2, 2, [9, 9, 9, 255]), 2, 2)).toMatchObject({ left: 0, top: 0, width: 2, height: 2 });
    expect(croppedLayer('Empty', solid(2, 2, [9, 9, 9, 0]), 2, 2)).toBeNull();
  });
});

describe('packBits', () => {
  it('packs runs and literal stretches so they unpack to the same row', () => {
    const rows = [
      new Uint8Array([]),
      new Uint8Array([7]),
      new Uint8Array(300).fill(9),
      Uint8Array.from({ length: 300 }, (_, i) => i % 251),
      Uint8Array.from([1, 1, 2, 3, 3, 3, 4, 5, 5]),
    ];
    for (const row of rows) expect(unpack(packBits(row), 0, row.length).bytes).toEqual([...row]);
    expect(packBits(new Uint8Array(128).fill(1))).toEqual(Uint8Array.of(129, 1));
  });
});
