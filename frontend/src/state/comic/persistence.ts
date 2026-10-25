// Keeps the comic projects across restarts in the backend's database.
// Each project is one row; a change to a project is saved one second after the last change to it. Saving starts only
// after the projects were read, so nothing is written over a project that could not be read.
//
// A page's layers may hold pictures that live only in the page (a `blob:` address): each is stored as a hidden gallery
// image before the project is written, and the live page takes the stored picture (canvasDocument.ts). A project read from
// version 1 whose turned pictures are still being baked (bakeRotation.ts) is not written until they are; one whose pictures
// could not be baked is not written during this run at all.
import { backend, type ComicRecord } from '@/backend';
import { t } from '@/i18n';
import type { CanvasEntity, ImageObject } from '../canvas';
import { namedObjects, withNamedImage } from '../canvasDocument';
import { toast } from '../toasts';
import { bakeOne, bakeRotations, withBaked } from './bakeRotation';
import { readComicRecords, serializeComicProject, type ComicProject } from './document';
import { useComic } from './store';

const SAVE_DELAY_MS = 1000;
/** Past this many bytes a project is close to what the backend keeps (32 MiB, service/comics.rs): the user is warned. */
export const WARN_PROJECT_BYTES = 30 * 1024 * 1024;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Projects not to be written now: their turned pictures are being baked, or could not be. */
const held = new Set<string>();
/** Projects the user was warned about, so the warning comes once until the project is small again. */
const warned = new Set<string>();
let watching = false;

/** Swaps a picture's stored address into the live page, so the next save has nothing to upload. */
function swapNamed(pageId: string, named: ImageObject) {
  const page = useComic.getState().projects.flatMap((p) => p.pages).find((pg) => pg.id === pageId);
  if (!page) return;
  const entities = withNamedImage(page.canvas.entities, named);
  if (entities !== page.canvas.entities) useComic.getState().setPageCanvas(pageId, { ...page.canvas, entities });
}

/** The project with every picture of its pages' layers named (a picture that cannot be stored is left for the next save). */
export async function withNamedPictures(project: ComicProject, onNamed: (pageId: string, named: ImageObject) => void = swapNamed): Promise<ComicProject> {
  let changed = false;
  const pages = [];
  for (const page of project.pages) {
    if (!page.canvas.entities.some((e) => e.objects.some((o) => o.kind === 'image' && !o.imageName))) {
      pages.push(page);
      continue;
    }
    const entities: CanvasEntity[] = [];
    for (const e of page.canvas.entities) entities.push({ ...e, objects: await namedObjects(e.objects, (named) => onNamed(page.id, named)) } as CanvasEntity);
    pages.push({ ...page, canvas: { ...page.canvas, entities } });
    changed = true;
  }
  return changed ? { ...project, pages } : project;
}

/** How many bytes a saved document takes as JSON text. */
export const documentBytes = (document: ComicRecord['document']) => new TextEncoder().encode(JSON.stringify(document)).length;

async function save(projectId: string) {
  const project = useComic.getState().projects.find((p) => p.id === projectId);
  if (!project || held.has(projectId)) return;
  try {
    const document = serializeComicProject(await withNamedPictures(project));
    if (documentBytes(document) > WARN_PROJECT_BYTES) {
      if (!warned.has(projectId)) toast({ status: 'warning', title: t('comic.save.large'), description: t('comic.save.largeHint') });
      warned.add(projectId);
    } else warned.delete(projectId);
    await backend.saveComic(project.id, document);
  } catch {
    // Kept in the page; the next change to this project saves it again.
  }
}

function schedule(projectId: string) {
  clearTimeout(timers.get(projectId));
  timers.set(
    projectId,
    setTimeout(() => {
      timers.delete(projectId);
      void save(projectId);
    }, SAVE_DELAY_MS),
  );
}

function forget(projectId: string) {
  clearTimeout(timers.get(projectId));
  timers.delete(projectId);
  backend.deleteComic(projectId).catch(() => undefined);
}

/**
 * Reads the saved projects into the store, then starts saving the changes. Called once after the gallery is loaded (the
 * migration of version 1 projects looks their pictures up there). If the list cannot be read, nothing starts, so the saved
 * projects are not overwritten by an empty screen. Version 1 pictures that were turned are baked afterwards.
 */
export async function restoreAndWatchComics(): Promise<void> {
  if (watching) return;
  let records;
  try {
    records = await backend.listComics();
  } catch {
    return;
  }
  const { projects, bakes } = readComicRecords(records);
  for (const b of bakes) held.add(b.projectId);
  useComic.getState().setProjects(projects);
  watching = true;
  let before = useComic.getState().projects;
  useComic.subscribe((s) => {
    const prev = before;
    before = s.projects;
    if (s.projects === prev) return;
    for (const project of s.projects) {
      if (prev.find((p) => p.id === project.id) !== project) schedule(project.id);
    }
    for (const project of prev) {
      if (!s.projects.some((p) => p.id === project.id)) forget(project.id);
    }
  });
  if (bakes.length) await bakeMigrated(bakes);
}

/** Bakes the turned pictures of migrated projects and lets each project be saved again once its pictures are in. */
async function bakeMigrated(bakes: Parameters<typeof bakeRotations>[0]) {
  const failed = await bakeRotations(
    bakes,
    (projectId, baked) => {
      held.delete(projectId);
      for (const { bake, imageName } of baked) {
        const page = useComic.getState().projects.flatMap((p) => p.pages).find((pg) => pg.id === bake.pageId);
        if (page) useComic.getState().setPageCanvas(page.id, withBaked(page.canvas, bake, imageName));
      }
    },
    bakeOne,
  );
  if (failed.length) toast({ status: 'error', title: t('comic.migrate.turnFailed'), description: t('comic.migrate.turnFailedHint') });
}
