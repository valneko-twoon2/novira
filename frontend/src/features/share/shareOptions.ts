// The export-for-sharing form: its choices, defaults and how it becomes the backend's ExportOptions.
import type { ExportFormat, ExportOptions, ImageDTO } from '@/backend';

export const FORMATS: ExportFormat[] = ['png', 'jpeg', 'webp'];
export const FORMAT_LABELS: Record<ExportFormat, string> = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP' };

/** Longest-side choices: the original size, three common limits, or a number the user types. */
export type SizeChoice = 'original' | '2048' | '1536' | '1024' | 'custom';
export const SIZE_CHOICES: SizeChoice[] = ['original', '2048', '1536', '1024', 'custom'];

/** The range the backend accepts for the longest side. */
export const MIN_SIDE = 16;
export const MAX_SIDE = 16384;

export interface ShareForm {
  format: ExportFormat;
  /** JPEG quality, 1 to 100. */
  quality: number;
  size: SizeChoice;
  /** Longest side when `size` is `custom`. */
  customSide: number;
  removeInfo: boolean;
  /** Mark the copies as made by AI (watermark, IPTC label, content credentials). Off by default. */
  watermark: boolean;
}

/** Generation info is kept and no watermark is added unless the user turns them on. */
export const DEFAULT_FORM: ShareForm = { format: 'png', quality: 90, size: 'original', customSide: 1280, removeInfo: false, watermark: false };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

/** The options sent to the backend, with every number brought into its range. */
export function toExportOptions(form: ShareForm): ExportOptions {
  const maxSide = form.size === 'original' ? null : form.size === 'custom' ? clamp(form.customSide, MIN_SIDE, MAX_SIDE) : Number(form.size);
  return { format: form.format, quality: clamp(form.quality, 1, 100), maxSide, removeInfo: form.removeInfo, watermark: form.watermark };
}

/** Only JPEG has a quality setting (WebP is lossless). */
export const hasQuality = (format: ExportFormat) => format === 'jpeg';

/** Generation info survives only in a PNG copy. */
export const infoIsLost = (form: ShareForm) => !form.removeInfo && form.format !== 'png';

/** The selected items split into still pictures (exported) and everything else (videos, audio: left out). */
export function splitMedia(images: ImageDTO[]): { pictures: ImageDTO[]; others: ImageDTO[] } {
  const pictures: ImageDTO[] = [];
  const others: ImageDTO[] = [];
  for (const image of images) ((image.mediaType ?? 'image') === 'image' ? pictures : others).push(image);
  return { pictures, others };
}
