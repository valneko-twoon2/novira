import { describe, expect, it } from 'vitest';
import type { ExportFormat, ImageDTO } from '@/backend';
import { DEFAULT_FORM, MAX_SIDE, MIN_SIDE, hasQuality, infoIsLost, splitMedia, toExportOptions } from './shareOptions';

describe('share options', () => {
  it('keeps the generation info and the original size and adds no watermark by default', () => {
    expect(toExportOptions(DEFAULT_FORM)).toEqual({ format: 'png', quality: 90, maxSide: null, removeInfo: false, watermark: false });
    expect(toExportOptions({ ...DEFAULT_FORM, watermark: true }).watermark).toBe(true);
  });

  it('turns the size choice into a longest side, keeping a custom one in range', () => {
    expect(toExportOptions({ ...DEFAULT_FORM, size: '1536' }).maxSide).toBe(1536);
    expect(toExportOptions({ ...DEFAULT_FORM, size: 'custom', customSide: 999.6 }).maxSide).toBe(1000);
    expect(toExportOptions({ ...DEFAULT_FORM, size: 'custom', customSide: 2 }).maxSide).toBe(MIN_SIDE);
    expect(toExportOptions({ ...DEFAULT_FORM, size: 'custom', customSide: 1e9 }).maxSide).toBe(MAX_SIDE);
    expect(toExportOptions({ ...DEFAULT_FORM, size: 'custom', customSide: Number.NaN }).maxSide).toBe(MIN_SIDE);
  });

  it('keeps the quality between 1 and 100', () => {
    expect(toExportOptions({ ...DEFAULT_FORM, quality: 0 }).quality).toBe(1);
    expect(toExportOptions({ ...DEFAULT_FORM, quality: 140 }).quality).toBe(100);
  });

  it('has a quality only for JPEG, and keeps info only in PNG', () => {
    const formats: ExportFormat[] = ['png', 'jpeg', 'webp'];
    expect(formats.map(hasQuality)).toEqual([false, true, false]);
    expect(infoIsLost({ ...DEFAULT_FORM, removeInfo: false, format: 'jpeg' })).toBe(true);
    expect(infoIsLost({ ...DEFAULT_FORM, removeInfo: false, format: 'png' })).toBe(false);
    expect(infoIsLost({ ...DEFAULT_FORM, removeInfo: true, format: 'webp' })).toBe(false);
  });

  it('exports still pictures and leaves videos and audio out', () => {
    const item = (name: string, mediaType?: ImageDTO['mediaType']) => ({ name, mediaType }) as ImageDTO;
    const { pictures, others } = splitMedia([item('a.png'), item('b.mp4', 'video'), item('c.png', 'image'), item('d.wav', 'audio')]);
    expect(pictures.map((p) => p.name)).toEqual(['a.png', 'c.png']);
    expect(others.map((p) => p.name)).toEqual(['b.mp4', 'd.wav']);
  });
});
