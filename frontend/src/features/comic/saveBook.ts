// "Export all pages": draws every page of the comic and hands the user one file, a PDF, a CBZ or a ZIP of one layered
// PSD per page, as a download (the desktop app's WebView saves it as a browser does).
import { t } from '@/i18n';
import { findImage } from '@/state/gallery';
import { PAGE_SIZE_MM, type ComicProject } from '@/state/comic/document';
import { toast } from '@/state/toasts';
import { buildPdf, buildZip, type PdfPage } from './bookFile';
import { effectOf } from '@/state/comic/effects';
import { pagePixels, renderPage } from './pageRender';
import { renderPagePsd } from './pagePsd';

export type BookFormat = 'pdf' | 'cbz' | 'psd';

/** Each format's file type, and how its file name ends (the PSD pages come in one ZIP). */
const FILE: Record<BookFormat, { mime: string; ending: string }> = {
  pdf: { mime: 'application/pdf', ending: '.pdf' },
  cbz: { mime: 'application/vnd.comicbook+zip', ending: '.cbz' },
  psd: { mime: 'application/zip', ending: '-psd.zip' },
};

/** The file type of one PSD file. */
export const PSD_MIME = 'image/vnd.adobe.photoshop';

/** The comic's name as the start of a file name the system accepts: without the characters it forbids, never empty. */
export function fileBase(name: string): string {
  const base = [...name].map((ch) => (ch.charCodeAt(0) < 32 ? '_' : ch)).join('').replace(/[\\/:*?"<>|]+/g, '_').trim().replace(/[. ]+$/, '');
  return base || t('comic.book.defaultName');
}

/** The file name of the whole comic in a format. */
export function bookFileName(name: string, format: BookFormat): string {
  return `${fileBase(name)}${FILE[format].ending}`;
}

const urlOf = (name: string) => findImage(name)?.url;

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** The comic as the bytes of the file, page by page in order. */
export async function buildBook(project: ComicProject, format: BookFormat): Promise<Uint8Array> {
  if (format === 'cbz' || format === 'psd') {
    // A ZIP of the pages in order: PNG pictures for a comic reader, or one layered PSD per page.
    const digits = Math.max(3, String(project.pages.length).length);
    const entries = [];
    for (const [i, page] of project.pages.entries()) {
      const effect = effectOf(project, page);
      const data = format === 'psd' ? await renderPagePsd(page, urlOf, effect) : await bytes(await renderPage(page, urlOf, 'png', effect));
      entries.push({ name: `${String(i + 1).padStart(digits, '0')}.${format === 'psd' ? 'psd' : 'png'}`, data });
    }
    return buildZip(entries);
  }
  const pages: PdfPage[] = [];
  for (const page of project.pages) {
    const { width, height } = pagePixels(page);
    const paper = PAGE_SIZE_MM[page.size];
    pages.push({ jpeg: await bytes(await renderPage(page, urlOf, 'jpeg', effectOf(project, page))), width, height, widthMm: paper.width, heightMm: paper.height });
  }
  return buildPdf(pages, project.pages[0]?.direction !== 'ltr');
}

/** Hands the bytes to the user as a downloaded file. */
export function download(data: Uint8Array, mime: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveBook(project: ComicProject, format: BookFormat): Promise<void> {
  try {
    const fileName = bookFileName(project.name, format);
    download(await buildBook(project, format), FILE[format].mime, fileName);
    toast({ status: 'success', title: t('comic.book.saved', { name: fileName }) });
  } catch (err) {
    toast({ status: 'error', title: t('comic.book.failed'), description: err instanceof Error ? err.message : String(err) });
  }
}
