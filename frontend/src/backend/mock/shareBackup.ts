// Export for sharing and backups in the browser mock. A shared copy is drawn on a canvas and saved again (a canvas
// keeps no text chunks, EXIF or XMP), then downloaded; a backup is a JSON download of the mock's own state (the
// pictures are not included). Restoring needs the desktop app; the mock only reaches the confirmation step.
import { downloadBlob } from '../download';
import type { BackupInfo, BoardDTO, ExportFormat, ExportOptions, ExportResult, ImageDTO, SavedWorkflow, WatermarkCheck } from '../types';

/** The size of a copy: the longest side brought down to `maxSide`, never enlarged (as the Rust backend does). */
export function fitSize(width: number, height: number, maxSide: number | null): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!maxSide || longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  const fit = (v: number) => Math.min(maxSide, Math.max(1, Math.round(v * scale)));
  return width >= height ? { width: maxSide, height: fit(height) } : { width: fit(width), height: maxSide };
}

const EXTENSIONS: Record<ExportFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };
const MIME: Record<ExportFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

/** `<stem of the gallery name>.<extension of the format>`. */
export function exportFileName(name: string, format: ExportFormat): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.${EXTENSIONS[format]}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `novira-backup-YYYYMMDD-HHMM.<ext>` in local time, the name the desktop app offers too. */
export function backupFileName(date: Date, ext = 'zip'): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `novira-backup-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.${ext}`;
}

function loadPicture(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

async function encode(image: ImageDTO, options: ExportOptions): Promise<Blob> {
  const picture = await loadPicture(image.url);
  const size = fitSize(picture.naturalWidth, picture.naturalHeight, options.maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  if (options.format === 'jpeg') {
    // JPEG has no transparency: lay the picture on white.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size.width, size.height);
  }
  ctx.drawImage(picture, 0, 0, size.width, size.height);
  // WebP is lossless in the desktop app; quality 1 asks the browser for its lossless mode too.
  const quality = options.format === 'jpeg' ? options.quality / 100 : options.format === 'webp' ? 1 : undefined;
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encoding failed'))), MIME[options.format], quality),
  );
}

/** Downloads a clean copy of every still picture; videos and audio are skipped. */
export async function exportInBrowser(images: ImageDTO[], options: ExportOptions): Promise<ExportResult> {
  let count = 0;
  let skipped = 0;
  for (const image of images) {
    if ((image.mediaType ?? 'image') !== 'image') {
      skipped += 1;
      continue;
    }
    downloadBlob(await encode(image, options), exportFileName(image.name, options.format));
    count += 1;
  }
  return { count, skipped, watermarked: 0, folder: '' };
}

/** A watermarked copy the mock pretends to have written: its id and the gallery picture it came from. */
export interface MockWatermark {
  id: string;
  imageName: string;
  exportedAt: number;
  fileName: string;
}

/**
 * What "check a picture" reports in the browser, where nothing is really marked: the copy exported last with the
 * watermark on (as if the user picked that file), else a picture with no marks.
 */
export function mockWatermarkCheck(last: MockWatermark | null, inGallery: (name: string) => boolean, fileName = 'picture.png'): WatermarkCheck {
  const none: WatermarkCheck = {
    fileName,
    watermarkChecked: true,
    watermarkFound: false,
    noviraMarker: false,
    watermarkId: null,
    originalName: null,
    originalInGallery: false,
    exportedAt: null,
    credentialsPresent: false,
    credentialsValid: false,
    credentialsTrusted: false,
    credentialsAi: false,
    credentialsSigner: null,
    credentialsThisApp: false,
    iptcAi: false,
  };
  if (!last) return none;
  return {
    ...none,
    fileName: last.fileName,
    watermarkFound: true,
    noviraMarker: true,
    watermarkId: last.id,
    originalName: last.imageName,
    originalInGallery: inGallery(last.imageName),
    exportedAt: last.exportedAt,
    credentialsPresent: true,
    credentialsValid: true,
    credentialsAi: true,
    credentialsSigner: 'novira',
    credentialsThisApp: true,
    iptcAi: true,
  };
}

export interface MockData {
  boards: BoardDTO[];
  images: ImageDTO[];
  workflows: SavedWorkflow[];
}

export function backupInfo(data: MockData, createdAt: number): BackupInfo {
  return {
    appVersion: '0.1.0-mock',
    createdAt,
    images: data.images.length,
    boards: data.boards.length,
    workflows: data.workflows.filter((w) => w.category === 'user').length,
  };
}

/** Downloads the mock's state and the saved screen state as one JSON file. */
export function downloadMockBackup(data: MockData, uiState: string, now: Date): { fileName: string; bytes: number; info: BackupInfo } {
  const info = backupInfo(data, now.getTime());
  const body = JSON.stringify({
    format: 'novira-backup',
    version: 1,
    mock: true,
    ...info,
    boards: data.boards,
    images: data.images.map(({ url: _url, thumbnailUrl: _thumb, ...rest }) => rest),
    workflows: data.workflows.filter((w) => w.category === 'user'),
    uiState: JSON.parse(uiState) as unknown,
  });
  const blob = new Blob([body], { type: 'application/json' });
  const fileName = backupFileName(now, 'json');
  downloadBlob(blob, fileName);
  return { fileName, bytes: blob.size, info };
}
