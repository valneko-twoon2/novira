// Drawing comic panels through the queue. The Invoke bar draws the selected panel, the page actions draw several. Each
// queue item is remembered with its panel, so its picture is put in that panel when it is made (see results.ts).
import { backend, type EnqueueRequest, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { findImage } from '@/state/gallery';
import type { InvokeBuilder } from '@/state/invoke';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { isSwappingDraw, withPageDraw } from './drawSync';
import { pageAspect, panelGeometry } from './layout';
import { fixMaskPicture, hasFix, type FixMask } from './panelFix';
import { posesReady } from './posePreset';
import { comicPanelIds, comicReadiness, fixRequest, portraitRequest, comicWarnings, drawablePanel, pagePanelIds, panelBatches, panelRegions, sheetRequest, takesReferencePictures, usesCastPictures } from './request';
import { bindComicItem, bindPortraitItem, bindSheetItem, takePortrait } from './results';
import { useQueue } from '@/state/queue';
import { allWords } from './characterLook';
import { missingViews } from './characterSheet';
import type { ComicCharacter } from './document';
import { findPanel, workPanel, useComic, type PanelRef } from './store';

/** The panel the last Invoke build was for: the queue item it returns belongs to it. */
let builtFor: string | null = null;
/** The page's other panels, which are queued after the first one. */
let laterPanels: string[] = [];

/**
 * The characters of the panels that have no reference picture yet (and tags to draw one from), once each; none for a comic
 * whose panels are drawn without their characters' pictures (see usesCastPictures).
 */
export function portraitCharacters(panelIds: string[]): { projectId: string; character: ComicCharacter }[] {
  const projects = useComic.getState().projects;
  const found = new Map<string, { projectId: string; character: ComicCharacter }>();
  for (const panelId of panelIds) {
    const ref = findPanel(projects, panelId);
    if (!ref || !withPageDraw(ref.project, ref.project.pages[ref.pageIndex], () => usesCastPictures(ref.project))) continue;
    for (const id of ref.panel.cast) {
      const character = ref.project.cast.find((c) => c.id === id);
      if (character && !character.imageName && allWords(character) && !found.has(id)) found.set(id, { projectId: ref.project.id, character });
    }
  }
  return [...found.values()];
}

/** Resolves when the condition holds on a change of the store, or after the time (a picture that never settles must not hold the rest forever). */
function until(subscribe: (listener: () => void) => () => void, holds: () => boolean, timeoutMs: number): Promise<void> {
  if (holds()) return Promise.resolve();
  return new Promise((resolve) => {
    let off = () => {};
    const finish = () => {
      clearTimeout(timer);
      off();
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    off = subscribe(() => {
      if (holds()) finish();
    });
  });
}

const ENDED = ['completed', 'failed', 'canceled'];

/**
 * The status of a queue item. An item the queue no longer holds (its history was cleared) counts as completed: it is over.
 * Items just queued are put in the store at once (see enqueueTracked), so an item missing here is never one still to come.
 */
function itemStatus(id: number): string {
  return useQueue.getState().items.find((i) => i.id === id)?.status ?? 'completed';
}

/** Queues a request and puts its items in the queue store at once, so a wait on them does not take their absence for being over. */
async function enqueueTracked(request: EnqueueRequest): Promise<QueueItem[]> {
  const items = await backend.enqueue(request);
  const queue = useQueue.getState();
  for (const item of items) if (!queue.items.some((i) => i.id === item.id)) queue.upsertItem(item);
  return items;
}

/** Waits until every queue item has finished (made its picture, failed or been cancelled), and the pictures are in their panels. */
async function waitForPictures(itemIds: number[], panelIds: string[]): Promise<void> {
  const finished = () => itemIds.every((id) => ENDED.includes(itemStatus(id)));
  await until(useQueue.subscribe, finished, 30 * 60_000);
  // The picture reaches its panel a moment after the item completes.
  const placed = () => panelIds.every((id) => !useComic.getState().pending || !Object.values(useComic.getState().pending).includes(id));
  await until(useComic.subscribe, placed, 10_000);
}

/** The picture a reference-picture item made: it reaches the screen a moment after the item completes. */
async function portraitName(itemId: number): Promise<string | undefined> {
  for (let i = 0; i < 100; i++) {
    const name = takePortrait(itemId);
    if (name) return name;
    await new Promise((r) => setTimeout(r, 100));
  }
  return undefined;
}

/**
 * Gives every character of the panels that has none a reference picture: the character drawn alone on a plain background
 * from its tags (IP-Adapter carries the look of a whole picture, so a panel's picture, with a place and other people in it,
 * would bring all of that along). The pictures are waited for, so the panels queued after this one use them. A character
 * whose picture cannot be made is drawn from its words alone. Returns how many pictures were queued.
 */
export async function ensurePortraits(panelIds: string[]): Promise<number> {
  const needed = portraitCharacters(panelIds);
  return needed.length ? drawPortraits(needed) : 0;
}

/** Draws the reference pictures of these characters, waits for them and gives each to its character (see ensurePortraits). */
async function drawPortraits(needed: { projectId: string; character: ComicCharacter }[]): Promise<number> {
  const items: { itemId: number; projectId: string; characterId: string }[] = [];
  for (const { projectId, character } of needed) {
    const request = portraitRequest(character);
    if (!request) continue;
    try {
      const [item] = await enqueueTracked(request);
      if (!item) continue;
      bindPortraitItem(item);
      items.push({ itemId: item.id, projectId, characterId: character.id });
    } catch (err) {
      toast({ status: 'error', title: t('comic.draw.failed'), description: err instanceof Error ? err.message : String(err) });
      break;
    }
  }
  await waitForPictures(items.map((i) => i.itemId), []);
  for (const { itemId, projectId, characterId } of items) {
    const name = await portraitName(itemId);
    if (!name) continue;
    const store = useComic.getState();
    // The open comic's cast is what setCast edits, so open the comic the character belongs to first when it is another one.
    if (store.activeProjectId !== projectId) store.selectProject(projectId);
    const project = useComic.getState().projects.find((p) => p.id === projectId);
    if (project) useComic.getState().setCast(project.cast.map((c) => (c.id === characterId ? { ...c, imageName: name } : c)));
  }
  return items.length;
}

/**
 * Draws the views the sheet of a character of the open comic lacks (see sheetRequest), each from the character's picture,
 * which is drawn first when there is none. A view already being drawn is not queued again. The views land in the sheet as
 * they come (see results.ts). Returns how many were queued.
 */
export async function makeSheet(characterId: string): Promise<number> {
  const projectId = useComic.getState().activeProjectId;
  const character = () => useComic.getState().projects.find((p) => p.id === projectId)?.cast.find((c) => c.id === characterId);
  const first = character();
  if (!projectId || !first) return 0;
  if (!allWords(first)) {
    toast({ status: 'warning', title: t('comic.sheet.noWords') });
    return 0;
  }
  const hasFront = (c: ComicCharacter | undefined) => !!c?.imageName && !!findImage(c.imageName);
  if (!hasFront(first)) await drawPortraits([{ projectId, character: { ...first, imageName: null } }]);
  const now = character();
  if (!now || !hasFront(now)) {
    toast({ status: 'error', title: t('comic.sheet.noFront') });
    return 0;
  }
  const drawing = new Set(Object.values(useComic.getState().sheetPending).flatMap((p) => (p.projectId === projectId && p.characterId === characterId ? [p.view] : [])));
  let queued = 0;
  for (const view of missingViews(now).filter((v) => !drawing.has(v))) {
    const request = sheetRequest(now, view);
    if (!request) continue;
    try {
      const [item] = await enqueueTracked(request);
      if (!item) continue;
      bindSheetItem(item, { projectId, characterId, view });
      queued++;
    } catch (err) {
      toast({ status: 'error', title: t('comic.draw.failed'), description: err instanceof Error ? err.message : String(err) });
      break;
    }
  }
  if (queued) toast({ status: 'success', title: t('app.invoke.enqueued', { count: queued }) });
  return queued;
}

export const comicInvokeBuilder: InvokeBuilder = {
  // One picture per panel: the iterations box of the Invoke bar does not apply here.
  countsPictures: false,
  readiness: comicReadiness,
  warnings: comicWarnings,
  build: async ({ prepend }) => {
    const state = useComic.getState();
    // The page's panels: the first is drawn by this build, the rest are queued once it is (see onEnqueued).
    const many = state.drawScope !== 'panel';
    // Poses the assistant has just put in are still being drawn and uploaded; a panel drawn before that would miss its pose.
    await posesReady();
    const ids = state.drawScope === 'comic' ? comicPanelIds() : many ? pagePanelIds() : [];
    // The characters' reference pictures are made first, so every panel is drawn with them.
    if (many) await ensurePortraits(ids);
    const ref = many ? drawablePanel(ids[0] ?? '') : workPanel(state);
    if (!ref) throw new Error(t(state.drawScope === 'comic' ? 'comic.readiness.noPromptsComic' : many ? 'comic.readiness.noPrompts' : 'comic.readiness.noPanel'));
    builtFor = ref.panel.id;
    laterPanels = ids.slice(1);
    // The other combinations are queued here; the first one (the panel's picture) goes back to the caller that enqueues it.
    const [first, ...rest] = panelBatches(ref, prepend, await panelRegions(ref));
    for (const batch of prepend ? [...rest].reverse() : rest) await enqueueTracked(batch);
    return first!;
  },
  onEnqueued: (items: QueueItem[]) => {
    const drawn = builtFor;
    if (drawn) for (const item of items) bindComicItem(item, drawn);
    builtFor = null;
    if (laterPanels.length) void drawPanels(laterPanels);
    laterPanels = [];
  },
  subscribe: (onChange) => {
    const a = useComic.subscribe(() => onChange());
    // The swap of withPageDraw (which the hints run off the comic screen) is not a change of the form: reacting to it loops.
    const b = useParams.subscribe(() => !isSwappingDraw() && onChange());
    const c = useModels.subscribe(() => onChange());
    return () => {
      a();
      b();
      c();
    };
  },
};

export { comicPanelIds };

/** Draws every panel with a prompt on every page of the open comic. Returns the items queued (0 when no model is chosen). */
export async function drawComic(): Promise<number> {
  const blocked = comicReadiness().find((r) => r === t('comic.readiness.noModel'));
  if (blocked) {
    toast({ status: 'warning', title: blocked });
    return 0;
  }
  return drawPanels(comicPanelIds());
}

/**
 * What a redraw of a part of a panel's picture works on (the panel, its picture and its box on the page), or why it cannot be
 * done now: the panel has no picture there, nothing is painted, no model is chosen, or the panel's model takes no masks
 * (FLUX.2). Asked before queueing, so a caller can tell a refusal from a queued job.
 */
export function fixTarget(panelId: string, mask: FixMask): { ref: PanelRef; image: NonNullable<ReturnType<typeof findImage>>; box: NonNullable<ReturnType<typeof panelBox>> } | string {
  const ref = findPanel(useComic.getState().projects, panelId);
  const image = ref?.panel.imageName ? findImage(ref.panel.imageName) : undefined;
  const box = ref ? panelBox(ref) : undefined;
  if (!ref || !image || !box) return t('comic.fix.noPicture');
  if (!hasFix(mask)) return t('comic.fix.empty');
  const noModel = comicReadiness().find((r) => r === t('comic.readiness.noModel'));
  if (noModel) return noModel;
  // The panel is drawn with its own page's model, which is not always the one on screen.
  if (withPageDraw(ref.project, ref.project.pages[ref.pageIndex], takesReferencePictures)) return t('comic.fix.noInpaint');
  return { ref, image, box };
}

const panelBox = (ref: PanelRef) => panelGeometry(ref.project.pages[ref.pageIndex]!)[ref.panelIndex]?.box;

/**
 * Redraws a part of a panel's picture (inpaint): the mask is drawn at the picture's own size and stored as an intermediate
 * picture, and the job is queued for the panel, so its picture replaces the panel's (which goes to the panel's earlier
 * pictures). Says in the corner why nothing was queued. Returns whether the job was queued.
 */
export async function redrawPart(panelId: string, mask: FixMask, options: { words?: string; strength: number }): Promise<boolean> {
  const target = fixTarget(panelId, mask);
  if (typeof target === 'string') {
    toast({ status: 'warning', title: target });
    return false;
  }
  const { ref, image, box } = target;
  // The panel as the page shows it, in any unit: the mask follows the picture's place in it.
  const panel = { width: 1000, height: (1000 * box.height * pageAspect(ref.project.pages[ref.pageIndex]!.size)) / box.width };
  try {
    const picture = await fixMaskPicture(mask, ref.panel.imageView, { width: image.width, height: image.height }, panel);
    const stored = await backend.uploadImage(picture, { boardId: null, isIntermediate: true, category: 'mask' });
    const items = await enqueueTracked(fixRequest(ref, image, stored.url, options));
    for (const item of items) bindComicItem(item, panelId, { keepView: true });
    if (items.length) toast({ status: 'success', title: t('comic.fix.queued') });
    return items.length > 0;
  } catch (err) {
    toast({ status: 'error', title: t('comic.draw.failed'), description: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * Draws the given panels, one queue item each, in order. Panels without a prompt are skipped. Returns the items queued.
 *
 * Characters without a reference picture get one first (see ensurePortraits), and the panels are queued with it
 * (IP-Adapter), so a character's face and clothes carry over.
 */
export async function drawPanels(panelIds: string[]): Promise<number> {
  return (await queuePanels(panelIds)).queued;
}

/** Queues the panels as drawPanels does: how many items, and the ids of those that draw the panels' own pictures. */
async function queuePanels(panelIds: string[]): Promise<{ queued: number; own: number[] }> {
  let queued = 0;
  const own: number[] = [];
  await posesReady();
  await ensurePortraits(panelIds);
  for (const panelId of panelIds) {
    const ref = drawablePanel(panelId);
    if (!ref) continue;
    try {
      const [first, ...rest] = panelBatches(ref, false, await panelRegions(ref));
      const items = await enqueueTracked(first!);
      for (const item of items) bindComicItem(item, panelId);
      own.push(...items.map((i) => i.id));
      queued += items.length;
      for (const batch of rest) queued += (await enqueueTracked(batch)).length;
    } catch (err) {
      toast({ status: 'error', title: t('comic.draw.failed'), description: err instanceof Error ? err.message : String(err) });
      break;
    }
  }
  if (queued) toast({ status: 'success', title: t('app.invoke.enqueued', { count: queued }) });
  return { queued, own };
}

/** How long the pictures may stop coming before a wait gives up: a picture takes a minute or so, and a load a few more. */
export const STALL_MS = 30 * 60_000;

/**
 * Resolves when every item has finished (made its picture, failed or been cancelled), or when none of them has moved for
 * STALL_MS: a long queue is waited for as long as it moves, and a stuck engine does not hold the caller forever.
 */
function settled(itemIds: number[]): Promise<void> {
  const status = () => itemIds.map(itemStatus);
  const done = (s: string[]) => s.every((v) => ENDED.includes(v));
  return new Promise((resolve) => {
    let last = status().join();
    let timer: ReturnType<typeof setTimeout>;
    let off = () => {};
    const finish = () => {
      clearTimeout(timer);
      off();
      resolve();
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(finish, STALL_MS);
    };
    if (done(status())) return resolve();
    arm();
    off = useQueue.subscribe(() => {
      const now = status();
      if (done(now)) return finish();
      if (now.join() !== last) {
        last = now.join();
        arm();
      }
    });
  });
}

/**
 * Draws the panels and waits until their pictures are in their panels (or stop coming, see settled), for a run that looks
 * at the drawn page next. Returns the pictures queued for the panels.
 */
export async function drawPanelsAndWait(panelIds: string[]): Promise<number> {
  const { own } = await queuePanels(panelIds);
  if (!own.length) return 0;
  await settled(own);
  // The picture reaches its panel a moment after its item completes.
  const placed = () => !Object.values(useComic.getState().pending).some((id) => panelIds.includes(id));
  await until(useComic.subscribe, placed, 10_000);
  return own.length;
}
