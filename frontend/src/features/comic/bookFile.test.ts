import { describe, expect, it } from 'vitest';
import { buildPdf, buildZip, crc32 } from './bookFile';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

describe('crc32', () => {
  it('matches the known value for "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('is zero for no bytes', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('buildZip', () => {
  it('stores the entries with the right sizes, names and offsets', () => {
    const a = new TextEncoder().encode('hello');
    const b = new TextEncoder().encode('world!');
    const zip = buildZip([{ name: '001.png', data: a }, { name: '002.png', data: b }], new Date(2024, 4, 6, 7, 8, 10));
    const view = new DataView(zip.buffer);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    expect(view.getUint32(centralOffset + 16, true)).toBe(crc32(a));
    expect(view.getUint32(centralOffset + 20, true)).toBe(5);
    // The second central record points at the second local header, which holds the second entry's bytes.
    const second = centralOffset + 46 + '001.png'.length;
    const localAt = view.getUint32(second + 42, true);
    expect(view.getUint32(localAt, true)).toBe(0x04034b50);
    expect(text(zip.subarray(localAt + 30, localAt + 30 + 7))).toBe('002.png');
    expect(text(zip.subarray(localAt + 37, localAt + 43))).toBe('world!');
  });
  it('makes an empty archive from no entries', () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
  });
});

describe('buildPdf', () => {
  const page = { jpeg: JPEG, width: 1654, height: 2339, widthMm: 210, heightMm: 297 };
  it('writes one page object per picture and an xref that points at every object', () => {
    const pdf = buildPdf([page, page], true);
    const body = text(pdf);
    expect(body.startsWith('%PDF-1.4')).toBe(true);
    expect(body).toContain('/Count 2');
    expect(body).toContain('/Direction /R2L');
    expect(body).toContain('/MediaBox [0 0 595.28 841.89]');
    const xref = Number(/startxref\n(\d+)/.exec(body)![1]);
    expect(body.slice(xref, xref + 4)).toBe('xref');
    const rows = body.slice(xref).split('\n').slice(3, 3 + 8);
    expect(rows).toHaveLength(8);
    rows.forEach((row, i) => {
      const at = Number(row.slice(0, 10));
      expect(body.slice(at, at + String(i + 1).length + 6)).toBe(`${i + 1} 0 obj`);
    });
  });
  it('reads left to right when asked', () => {
    expect(text(buildPdf([page], false))).toContain('/Direction /L2R');
  });
  it('refuses a book with no pages', () => {
    expect(() => buildPdf([], true)).toThrow();
  });
});
