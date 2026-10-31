// The whole-book files, read back by a minimal reader written here: a ZIP lists every entry with its name, size, CRC and
// bytes as given; a PDF starts and ends as a PDF does, counts its pages, and its cross-reference table points at every
// object and every picture has its bytes where the file says.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { buildPdf, buildZip, crc32, type PdfPage, type ZipEntry } from './bookFile';

blockExternalNetwork();

const bytes = (max: number) => fc.uint8Array({ maxLength: max });
const entries = fc.array(fc.record({ name: fc.string({ minLength: 1, maxLength: 16 }), data: bytes(120) }), { maxLength: 8 });

/** Reads a ZIP through its central directory, as a reader does. */
function readZip(zip: Uint8Array): { name: string; data: Uint8Array; crc: number }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  expect(view.getUint16(end + 8, true)).toBe(count);
  let at = view.getUint32(end + 16, true);
  expect(at + view.getUint32(end + 12, true)).toBe(end);
  const out: { name: string; data: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    expect(view.getUint32(at + 24, true)).toBe(size);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    // The local header agrees with the central one and the bytes follow it.
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint32(local + 14, true)).toBe(crc);
    expect(view.getUint32(local + 18, true)).toBe(size);
    const localName = view.getUint16(local + 26, true);
    expect(localName).toBe(nameLength);
    const start = local + 30 + localName;
    out.push({ name, data: zip.slice(start, start + size), crc });
    at += 46 + nameLength;
  }
  return out;
}

describe('buildZip', () => {
  it('reads back every entry with its name, bytes and CRC, in order', () => {
    check(
      fc.property(entries, (list: ZipEntry[]) => {
        const read = readZip(buildZip(list, new Date(2024, 4, 6, 7, 8, 10)));
        expect(read).toHaveLength(list.length);
        list.forEach((e, i) => {
          expect(read[i]!.name).toBe(e.name);
          expect([...read[i]!.data]).toEqual([...e.data]);
          expect(read[i]!.crc).toBe(crc32(e.data));
        });
      }),
    );
  });

  it('is exactly as long as its headers, names (twice) and the stored bytes', () => {
    check(
      fc.property(entries, (list) => {
        const names = list.reduce((n, e) => n + new TextEncoder().encode(e.name).length, 0);
        const data = list.reduce((n, e) => n + e.data.length, 0);
        expect(buildZip(list).length).toBe(30 * list.length + 46 * list.length + 2 * names + data + 22);
      }),
    );
  });
});

describe('crc32', () => {
  it('is an unsigned 32-bit number that changes when one byte changes', () => {
    check(
      fc.property(bytes(80), fc.nat(), fc.integer({ min: 1, max: 255 }), (data, at, flip) => {
        const crc = crc32(data);
        expect(Number.isInteger(crc) && crc >= 0 && crc <= 0xffffffff).toBe(true);
        if (data.length === 0) return;
        const changed = data.slice();
        changed[at % data.length] = changed[at % data.length]! ^ flip;
        expect(crc32(changed)).not.toBe(crc);
      }),
    );
  });
});

const pdfPage = fc.record({
  jpeg: fc.uint8Array({ minLength: 1, maxLength: 100 }),
  width: fc.integer({ min: 1, max: 10000 }),
  height: fc.integer({ min: 1, max: 10000 }),
  widthMm: fc.integer({ min: 10, max: 1000 }),
  heightMm: fc.integer({ min: 10, max: 1000 }),
});

describe('buildPdf', () => {
  it('is a PDF with one page object per picture and a cross-reference table that points at every object', () => {
    check(
      fc.property(fc.array(pdfPage, { minLength: 1, maxLength: 5 }), fc.boolean(), (pages: PdfPage[], rtl) => {
        const pdf = buildPdf(pages, rtl);
        const text = new TextDecoder('latin1').decode(pdf);
        expect(text.startsWith('%PDF-1.4\n')).toBe(true);
        expect(text.endsWith('%%EOF\n')).toBe(true);
        expect(text).toContain(`/Count ${pages.length} `);
        expect(text).toContain(rtl ? '/Direction /R2L' : '/Direction /L2R');
        const objects = 2 + pages.length * 3;
        expect(text).toContain(`/Size ${objects + 1} `);
        const xref = Number(/startxref\n(\d+)\n/.exec(text)![1]);
        expect(text.slice(xref, xref + 5)).toBe('xref\n');
        // Header line "0 N", the free entry, then one row per object.
        const rows = text.slice(xref).split('\n').slice(3, 3 + objects);
        rows.forEach((row, i) => {
          const offset = Number(row.slice(0, 10));
          expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
        });
        // Each picture's bytes sit in its stream, as long as /Length says.
        pages.forEach((page, i) => {
          const at = Number(rows[2 + i * 3 + 2]!.slice(0, 10));
          const start = text.indexOf('stream\n', at) + 'stream\n'.length;
          expect(text.slice(at, start)).toContain(`/Length ${page.jpeg.length} `);
          expect([...pdf.subarray(start, start + page.jpeg.length)]).toEqual([...page.jpeg]);
        });
      }),
    );
  });

  it('refuses a book without pages', () => {
    expect(() => buildPdf([], false)).toThrow();
  });
});
