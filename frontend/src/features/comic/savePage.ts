// "Save page as picture": draws the page and keeps the picture in the gallery, like any other picture the app makes.
// "Save page as PSD": draws the page as a layered file and hands it over as a download, as "export all pages" does.
import { backend } from '@/backend';
import { t } from '@/i18n';
import { autoAddBoardId } from '@/state/invoke';
import { findImage, useGallery } from '@/state/gallery';
import type { ComicEffect, ComicPage, ComicProject } from '@/state/comic/document';
import { effectOf } from '@/state/comic/effects';
import { toast } from '@/state/toasts';
import { renderPage } from './pageRender';
import { renderPagePsd } from './pagePsd';
import { PSD_MIME, download, fileBase } from './saveBook';

/** The file name of one page's PSD: the comic's name and the page's number. */
export function pagePsdFileName(project: Pick<ComicProject, 'name' | 'pages'>, page: Pick<ComicPage, 'id'>): string {
  return `${fileBase(project.name)}-${project.pages.findIndex((p) => p.id === page.id) + 1}.psd`;
}

export async function savePagePsd(project: ComicProject, page: ComicPage): Promise<void> {
  try {
    const fileName = pagePsdFileName(project, page);
    download(await renderPagePsd(page, (name) => findImage(name)?.url, effectOf(project, page)), PSD_MIME, fileName);
    toast({ status: 'success', title: t('comic.book.saved', { name: fileName }) });
  } catch (err) {
    toast({ status: 'error', title: t('comic.export.failed'), description: err instanceof Error ? err.message : String(err) });
  }
}

export async function savePage(page: ComicPage, effect: ComicEffect): Promise<void> {
  try {
    const blob = await renderPage(page, (name) => findImage(name)?.url, 'png', effect);
    const image = await backend.uploadImage(blob, { boardId: autoAddBoardId(), category: 'general' });
    useGallery.getState().addImage(image);
    toast({ status: 'success', title: t('comic.page.exported') });
  } catch (err) {
    toast({ status: 'error', title: t('comic.export.failed'), description: err instanceof Error ? err.message : String(err) });
  }
}
