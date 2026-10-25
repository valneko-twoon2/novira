// The page the assistant asks to look at (`view_comic_page`): drawn as "save page as picture" draws it and kept
// as an intermediate picture, which the gallery does not show. Only its name goes back; the backend reads the picture.
import { backend } from '@/backend';
import { activeProject, useComic } from '@/state/comic/store';
import { effectOf } from '@/state/comic/effects';
import { keepScratch } from '@/state/comic/scratch';
import { findImage } from '@/state/gallery';
import { renderPage } from './pageRender';

/** The stored name of a picture of page `page` (from 1) of the open comic; throws a sentence for the model when there is none. */
export async function viewComicPage(page: number): Promise<string> {
  const project = activeProject(useComic.getState());
  if (!project) throw new Error('No comic is open.');
  const at = project.pages[page - 1];
  if (!at) throw new Error(`The comic has ${project.pages.length} page(s); there is no page ${page}.`);
  if (!at.panels.some((p) => p.imageName)) throw new Error(`Page ${page} has no drawn panel yet: draw it first.`);
  const blob = await renderPage(at, (name) => findImage(name)?.url, 'jpeg', effectOf(project, at));
  const image = await backend.uploadImage(blob, { boardId: null, isIntermediate: true, category: 'general' });
  keepScratch(image.name);
  return image.name;
}
