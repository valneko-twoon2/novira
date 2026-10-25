// Whole-book files built by hand, so no library is needed: a PDF whose pages are full-page JPEG pictures, and a CBZ (a
// ZIP of the page pictures, which comic readers open). Both only copy bytes the canvas already encoded.

const encoder = new TextEncoder();

/** One page of a PDF: a JPEG picture that fills a sheet of the given size. */
export interface PdfPage {
  jpeg: Uint8Array;
  /** The picture's size in pixels. */
  width: number;
  height: number;
  /** The sheet's size in millimetres. */
  widthMm: number;
  heightMm: number;
}

const POINTS_PER_MM = 72 / 25.4;

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** A PDF with one page per picture. `rightToLeft` makes viewers turn pages the way a right-to-left book is read. */
export function buildPdf(pages: PdfPage[], rightToLeft: boolean): Uint8Array {
  if (pages.length === 0) throw new Error('no pages');
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array) => {
    chunks.push(data);
    length += data.length;
  };
  const text = (s: string) => push(encoder.encode(s));
  // Object numbers: 1 catalog, 2 page tree, then three per page (page, contents, picture).
  const begin = (id: number) => {
    offsets[id] = length;
    text(`${id} 0 obj\n`);
  };
  text('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  begin(1);
  text(`<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /Direction /${rightToLeft ? 'R2L' : 'L2R'} >> >>\nendobj\n`);
  begin(2);
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  text(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);
  pages.forEach((page, i) => {
    const pageId = 3 + i * 3;
    const w = +(page.widthMm * POINTS_PER_MM).toFixed(2);
    const h = +(page.heightMm * POINTS_PER_MM).toFixed(2);
    begin(pageId);
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${pageId + 2} 0 R >> >> /Contents ${pageId + 1} 0 R >>\nendobj\n`,
    );
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    begin(pageId + 1);
    text(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream\nendobj\n`);
    begin(pageId + 2);
    text(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
    );
    push(page.jpeg);
    text('\nendstream\nendobj\n');
  });
  const count = 3 + pages.length * 3;
  const xref = length;
  text(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) text(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return concat(chunks);
}

export interface ZipEntry {
  /** A plain ASCII name; no folders. */
  name: string;
  data: Uint8Array;
}

let crcTable: Uint32Array | null = null;

export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP that stores its entries as they are (the pictures are compressed already). */
export function buildZip(entries: ZipEntry[], now = new Date()): Uint8Array {
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + entry.data.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return concat([...locals, ...centrals, end]);
}
