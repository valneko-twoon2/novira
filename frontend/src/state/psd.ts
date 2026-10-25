// A layered Photoshop file (PSD, version 1, 8-bit RGB) from pictures held as RGBA pixels, for the comic's pages and the
// canvas. Each layer keeps its own transparency, position, opacity and visibility; text and shapes arrive already drawn
// as pixels (a PSD's editable text needs Photoshop's own engine data). The flattened picture is stored too, over white,
// for programs that read only that. Channels are packed with PackBits (RLE), as Photoshop writes them.

/** One layer: its RGBA pixels, `width` × `height`, placed at `left`, `top` on the document (it may run off it). */
export interface PsdLayer {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row by row. */
  pixels: Uint8ClampedArray | Uint8Array;
  /** 0 to 1; 1 when absent. */
  opacity?: number;
  hidden?: boolean;
  /** How the layer's colours meet the layers under it; normal when absent. */
  blend?: PsdBlend;
}

export type PsdBlend = 'normal' | 'multiply' | 'screen';

/** The four-letter key Photoshop writes for each blend. */
const BLEND_KEY: Record<PsdBlend, string> = { normal: 'norm', multiply: 'mul ', screen: 'scrn' };

export interface PsdDocument {
  width: number;
  height: number;
  /** Bottom first, as a stack is drawn. */
  layers: PsdLayer[];
  /** The whole picture as RGBA, `width` × `height`; drawn over white into the file's flattened picture. */
  composite: Uint8ClampedArray | Uint8Array;
}

/** The longest side Photoshop opens in a version 1 file. */
export const PSD_MAX_SIDE = 30000;

/**
 * A layer from a picture the size of the document (RGBA, `width` × `height`, at its top left), cut down to the box around
 * its pixels that are not fully transparent, so an empty margin costs nothing. Null when every pixel is transparent.
 */
export function croppedLayer(
  name: string,
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  look: Pick<PsdLayer, 'opacity' | 'hidden' | 'blend'> = {},
): PsdLayer | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!pixels[(y * width + x) * 4 + 3]) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (right < 0) return null;
  const w = right - left + 1;
  const h = bottom - top + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((top + y) * width + left) * 4;
    out.set(pixels.subarray(from, from + w * 4), y * w * 4);
  }
  return { name, left, top, width: w, height: h, pixels: out, ...look };
}

class Writer {
  private chunks: Uint8Array[] = [];
  private size = 0;
  get length(): number {
    return this.size;
  }
  bytes(b: Uint8Array): void {
    this.chunks.push(b);
    this.size += b.length;
  }
  u8(v: number): void {
    this.bytes(Uint8Array.of(v & 0xff));
  }
  u16(v: number): void {
    this.bytes(Uint8Array.of((v >> 8) & 0xff, v & 0xff));
  }
  i16(v: number): void {
    this.u16(v < 0 ? v + 0x10000 : v);
  }
  u32(v: number): void {
    this.bytes(Uint8Array.of((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff));
  }
  i32(v: number): void {
    this.u32(v >>> 0);
  }
  ascii(s: string): void {
    this.bytes(Uint8Array.from(s, (c) => c.charCodeAt(0) & 0x7f));
  }
  pad(multiple: number, from = 0): void {
    while ((this.size - from) % multiple) this.u8(0);
  }
  done(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const c of this.chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
}

/** One row packed with PackBits: runs of 2 to 128 equal bytes, and stretches of up to 128 bytes as they are. */
export function packBits(row: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < row.length) {
    let run = 1;
    while (i + run < row.length && run < 128 && row[i + run] === row[i]) run++;
    if (run >= 2) {
      out.push(257 - run, row[i]!);
      i += run;
      continue;
    }
    const start = i;
    while (i < row.length && i - start < 128 && !(i + 1 < row.length && row[i] === row[i + 1])) i++;
    if (i === start) i++;
    out.push(i - start - 1);
    for (let k = start; k < i; k++) out.push(row[k]!);
  }
  return Uint8Array.from(out);
}

/** One channel (an offset into RGBA) of a picture, compressed: the RLE marker, the packed size of each row, the rows. */
function channelData(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number, offset: number, value?: (i: number) => number): Uint8Array {
  const w = new Writer();
  w.u16(1);
  const rows: Uint8Array[] = [];
  const row = new Uint8Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row[x] = value ? value(i) : pixels[i + offset]!;
    }
    rows.push(packBits(row));
  }
  for (const r of rows) w.u16(r.length);
  for (const r of rows) w.bytes(r);
  return w.done();
}

/** A layer name as a Pascal string, padded to a multiple of 4 with its length byte (Photoshop's own limit is 255 bytes). */
function pascalName(w: Writer, name: string): void {
  const ascii = Uint8Array.from([...name].slice(0, 255), (c) => (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 0x3f)).slice(0, 255);
  const start = w.length;
  w.u8(ascii.length);
  w.bytes(ascii);
  w.pad(4, start);
}

/** The layer's name in Unicode (the "luni" block), which Photoshop shows in place of the Pascal name. */
function unicodeName(w: Writer, name: string): void {
  const text = name.slice(0, 255);
  w.ascii('8BIM');
  w.ascii('luni');
  const length = 4 + text.length * 2;
  w.u32(length + (length % 4 ? 4 - (length % 4) : 0));
  const start = w.length;
  w.u32(text.length);
  for (let i = 0; i < text.length; i++) w.u16(text.charCodeAt(i));
  w.pad(4, start);
}

/** The PSD file of a document. Throws when a side is empty or larger than Photoshop opens. */
export function encodePsd(doc: PsdDocument): Uint8Array {
  const { width, height } = doc;
  if (!(width >= 1 && height >= 1 && width <= PSD_MAX_SIDE && height <= PSD_MAX_SIDE)) throw new Error(`PSD size out of range: ${width}×${height}`);
  if (doc.composite.length !== width * height * 4) throw new Error('PSD composite does not match the document size');
  for (const l of doc.layers) if (l.pixels.length !== l.width * l.height * 4) throw new Error(`PSD layer "${l.name}" does not match its size`);

  const w = new Writer();
  // Header: signature, version, reserved, channels (RGB), size, depth, colour mode (RGB).
  w.ascii('8BPS');
  w.u16(1);
  w.bytes(new Uint8Array(6));
  w.u16(3);
  w.u32(height);
  w.u32(width);
  w.u16(8);
  w.u16(3);
  w.u32(0); // colour mode data
  w.u32(0); // image resources

  // Layer and mask information.
  const channels = doc.layers.map((l) => [-1, 0, 1, 2].map((id) => ({ id, data: channelData(l.pixels, l.width, l.height, id === -1 ? 3 : id) })));
  const info = new Writer();
  info.i16(doc.layers.length);
  doc.layers.forEach((l, n) => {
    info.i32(l.top);
    info.i32(l.left);
    info.i32(l.top + l.height);
    info.i32(l.left + l.width);
    info.u16(4);
    for (const c of channels[n]!) {
      info.i16(c.id);
      info.u32(c.data.length);
    }
    info.ascii('8BIM');
    info.ascii(BLEND_KEY[l.blend ?? 'normal']);
    info.u8(Math.round(Math.min(1, Math.max(0, l.opacity ?? 1)) * 255));
    info.u8(0); // clipping: base
    info.u8(l.hidden ? 0x02 : 0x00);
    info.u8(0); // filler
    const extra = new Writer();
    extra.u32(0); // layer mask
    extra.u32(0); // blending ranges
    pascalName(extra, l.name);
    unicodeName(extra, l.name);
    info.u32(extra.length);
    info.bytes(extra.done());
  });
  for (const layer of channels) for (const c of layer) info.bytes(c.data);
  info.pad(2);

  const section = new Writer();
  section.u32(info.length);
  section.bytes(info.done());
  section.u32(0); // global layer mask
  w.u32(section.length);
  w.bytes(section.done());

  // The flattened picture over white: one marker, then every row's packed size for R, G and B, then the rows.
  const flat = new Writer();
  flat.u16(1);
  const over = (i: number, c: number) => {
    const a = doc.composite[i + 3]! / 255;
    return Math.round(doc.composite[i + c]! * a + 255 * (1 - a));
  };
  const parts = [0, 1, 2].map((c) => channelData(doc.composite, width, height, c, (i) => over(i, c)).subarray(2));
  for (const p of parts) flat.bytes(p.subarray(0, height * 2));
  for (const p of parts) flat.bytes(p.subarray(height * 2));
  w.bytes(flat.done());
  return w.done();
}
