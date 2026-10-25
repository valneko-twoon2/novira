// How the assistant reads and changes the comic: the page on screen with its panels (place, shape, prompts, pose, balloons),
// and operations on it (making and opening comics, adding pages, page layout and panel shapes, adding and cutting panels,
// prompts, poses, balloons, the picture's place, drawing). Every operation is checked here; one that does not fit the page is skipped. Panels are numbered from 1 in
// reading order, as the screen numbers them, and shapes are given in unit points (0 to 1 across the page, before the margin).
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { drawPanels, fixTarget, makeSheet, redrawPart } from './generate';
import { FIX_STRENGTH, readFixBoxes } from './panelFix';
import { characterLora, comicReadiness, panelPlace, poseModelReady } from './request';
import { promptStyleOf, STYLE_MAX, styleOf, type ComicStyle } from './style';
import { findModel } from '@/state/models';
import { useParams } from '@/state/params';
import {
  BUBBLE_KINDS,
  BUBBLE_LINES,
  BUBBLE_SCALE_RANGE,
  CAST_MAX,
  CHARACTER_NAME_MAX,
  CHARACTER_NEGATIVE_MAX,
  CHARACTER_TAGS_MAX,
  clampRotation,
  COMIC_EFFECTS,
  FRAME_WIDTH_RANGE,
  PAGE_COLUMNS,
  PAGE_SIZES,
  FRAME_MARGIN_RANGE,
  newComicId,
  PICTURE_INSET_RANGE,
  PLACE_NAME_MAX,
  PLACE_NEGATIVE_MAX,
  PLACE_TAGS_MAX,
  PLACES_MAX,
  READING_DIRECTIONS,
  type BubbleKind,
  type ComicBubble,
  type ComicCharacter,
  type ComicPage,
  type ComicPlace,
  type ComicPoint,
  type ComicProject,
} from './document';
import { isFreeShape } from './freeShapes';
import { applyLayerOp, layerContext, paintContext } from './layerAgent';
import { MANGA_MAX_PANELS, MANGA_MOODS, mangaLayout } from './mangaLayout';
import { fromPage, MAX_PANELS_PER_PAGE, pageAspect, pageShapes, panelGeometry, panelPixels, templateShapes, toPage } from './layout';
import { putPosePeople } from './posePreset';
import { readPoseSpec } from '@/state/pose/poseSpec';
import { readScene, sceneOps } from './scene';
import { cleanParts } from './characterLook';
import { missingViews } from './characterSheet';
import { estimateBox, fitScale, hasTail, mouthOf, personBoxes, placeBalloon, wrapBalloonText, type Box } from './balloonPlace';
import { allValid, MAX_SHAPE_CORNERS, MIN_SHAPE_CORNERS, stitch } from './shapes';
import { activePage, activeProject, findPanel, useComic } from './store';
import { checkTypesetting } from './typeset';
import { findStamp, stampWords } from './stamps';
import { BUILTIN_PAGE_LAYOUTS, BUILTIN_SHAPE_LAYOUTS } from './templates';

const round = (v: number) => Math.round(v * 1000) / 1000;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const between = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const oneOf = <T extends string | number>(v: unknown, options: readonly T[]): T | undefined => options.find((o) => o === v);

function bubbleContext(b: ComicBubble) {
  return { id: b.id, kind: b.kind, text: b.text, x: round(b.x), y: round(b.y), scale: b.scale, vertical: b.vertical, rotation: b.rotation, tail: b.tail && { x: round(b.tail.x), y: round(b.tail.y) } };
}

/** The most comics named to the assistant. */
const COMIC_LIST_MAX = 50;
/** The most pages one addPages operation adds. */
const ADD_PAGES_MAX = 100;

/** The comics the user has, newest first, by name (for openComic). */
const comicNames = () => useComic.getState().projects.slice(0, COMIC_LIST_MAX).map((p) => p.name);

/** What the assistant is told about the comic: the page on screen, its panels, and the choices the operations take. */
export function comicContext(): unknown {
  const s = useComic.getState();
  const project = activeProject(s);
  const page = activePage(s);
  if (!project || !page) return { project: null, comics: comicNames(), note: 'No comic is open: make one with newComic or open one with openComic.' };
  const aspect = pageAspect(page.size);
  const shapes = pageShapes(page);
  const geometry = panelGeometry(page);
  const selected = page.panels.findIndex((p) => p.id === s.selectedPanelId);
  const typesetIssues = checkTypesetting(project);
  return {
    project: project.name,
    // The other comics, so the assistant can open one by name.
    comics: comicNames(),
    // The people and animals of the comic and the words that keep each looking the same (see ComicCharacter).
    cast: project.cast.map((c) => ({ name: c.name, tags: c.tags, parts: c.parts ?? {}, ...(c.negative ? { negative: c.negative } : {}), ...(c.nonHuman ? { nonHuman: true } : {}), hasReferencePicture: c.imageName !== null, ...(c.sheet ? { sheet: Object.keys(c.sheet) } : {}), ...(characterLora(c) ? { lora: true } : {}) })),
    // The places of the story and the words that keep each looking the same, put after a panel's prompt (see ComicPlace),
    // and the world every panel shares, put last.
    places: project.places.map((p) => ({ name: p.name, tags: p.tags, ...(p.negative ? { negative: p.negative } : {}) })),
    world: project.world ?? '',
    // Whether a pose reaches the picture: without an OpenPose model installed it is only kept in the panel.
    poseControl: poseModelReady(),
    // How to word a panel prompt for the main model: tags for the SD family, sentences for the newer families.
    promptStyle: promptStyleOf(mainBase()),
    // The words every panel of this page is drawn with (quality words, artist tags, the shared negative); own says the
    // comic or the page set them, else they are the model family's defaults.
    style: { ...styleOf(project, page, mainBase()), own: !!(page.style ?? project.style) },
    // How strongly the panels follow the characters' reference pictures through an IP-Adapter; false when they do not.
    castReference: project.castReference ?? false,
    pageCount: project.pages.length,
    page: project.pages.findIndex((p) => p.id === page.id) + 1,
    // What the person wrote happens on this page ("make this page" makes the panels from it).
    size: page.size,
    direction: page.direction,
    columns: page.columns,
    frameMm: page.frameMm,
    insetMm: page.insetMm,
    marginMm: page.marginMm,
    reshaped: page.shapes !== null,
    // On a free page the shapes are given as they lie on the page (0 to 1 across and down it), and may overlap.
    free: page.free,
    effect: project.effect,
    pageEffect: page.effect,
    selectedPanel: selected >= 0 ? selected + 1 : null,
    panels: page.panels.map((panel, i) => {
      const box = geometry[i]?.box;
      return {
        panel: i + 1,
        prompt: panel.prompt,
        negativePrompt: panel.negativePrompt,
        note: panel.note,
        hasPicture: panel.imageName !== null,
        // Pictures a redraw or another picture replaced, which op take can put back (newest first, from 1).
        ...(panel.takes.length ? { earlierPictures: panel.takes.length } : {}),
        cast: panel.cast.flatMap((id) => project.cast.find((c) => c.id === id)?.name ?? []),
        ...(panelPlace(project, panel) ? { place: panelPlace(project, panel)!.name } : {}),
        people: panel.poses.length,
        // The user laid the panel out in its 3D rough (people, props, a camera): a pose put in another way drops its depth map.
        ...(panel.depthImageName ? { rough: true } : {}),
        ...(panel.poseCast?.some(Boolean) ? { whoIsWho: panel.poseCast.map((id) => project.cast.find((c) => c.id === id)?.name ?? null) } : {}),
        figures: panel.figures,
        // Where each person's head is, as fractions of the panel (for the balloons' speaker, tail and free space).
        peopleAt: panel.poses.map((joints) => {
          const head = mouthOf(joints);
          return head && { x: round(head.x), y: round(head.y - 0.02) };
        }),
        shape: (shapes[i] ?? []).map((p) => {
          const u = page.free ? p : fromPage(p, aspect);
          return { x: round(u.x), y: round(u.y) };
        }),
        pixels: box ? panelPixels(box, aspect) : null,
        bubbles: panel.bubbles.map(bubbleContext),
      };
    }),
    // Lettering that needs a look, with page, panel and balloon numbers from 1: see typeset.ts.
    typesetIssues,
    layoutTemplates: [...BUILTIN_PAGE_LAYOUTS.map((l) => l.id), ...BUILTIN_SHAPE_LAYOUTS.map((l) => l.id)],
    layers: layerContext(page),
    layerState: paintContext(page),
  };
}

/**
 * What an edit call answers with: the page on screen, without the parts of the comic that only `get_comic_page` needs
 * (the cast's words, the comic list, the layout templates). Every answer repeating them would fill the conversation, and
 * an agent that has to find the fresh issues in all that reads the early rules less well in the later pages.
 */
export function comicAnswer(): unknown {
  const full = comicContext();
  const project = currentProject();
  if (!project || !isObject(full)) return full;
  const answer: Record<string, unknown> = { ...full };
  for (const key of ['cast', 'places', 'comics', 'layoutTemplates']) delete answer[key];
  return {
    ...answer,
    cast: project.cast.map((c) => ({ name: c.name, hasReferencePicture: c.imageName !== null })),
    places: project.places.map((p) => p.name),
    more: 'get_comic_page returns the whole comic: the cast and place words, the other comics and the layout templates.',
  };
}

/** The page the operations act on now (an operation may have switched or added one). */
const currentPage = (): ComicPage | null => activePage(useComic.getState());
const currentProject = (): ComicProject | null => activeProject(useComic.getState());
/** The family of the main model the panels are drawn with, or null when none is chosen. */
const mainBase = () => findModel(useParams.getState().modelKey)?.base ?? null;

/** The panel of the current page with this number (1 is the first in reading order). */
function panelAt(value: unknown): { page: ComicPage; index: number } | null {
  const page = currentPage();
  const n = num(value);
  if (!page || n === undefined || !Number.isInteger(n) || n < 1 || n > page.panels.length) {
    opNote = page ? `panel ${String(value)} is not on the open page, which has ${page.panels.length} panels numbered from 1 (open the page with op page first)` : 'no page is open';
    return null;
  }
  return { page, index: n - 1 };
}

/** The panel holding the balloon with this id, on any page of the comic. */
function bubbleOwner(id: unknown): { panelId: string; bubble: ComicBubble } | null {
  if (typeof id !== 'string') return null;
  for (const page of currentProject()?.pages ?? []) {
    for (const panel of page.panels) {
      const bubble = panel.bubbles.find((b) => b.id === id);
      if (bubble) return { panelId: panel.id, bubble };
    }
  }
  return null;
}

function readPoint(v: unknown): ComicPoint | null {
  if (!isObject(v)) return null;
  const x = num(v.x);
  const y = num(v.y);
  return x === undefined || y === undefined ? null : { x, y };
}

/** The balloon fields an operation sets, each checked; unknown or wrong ones are left out. */
function bubblePatch(v: Record<string, unknown>): Partial<ComicBubble> {
  const patch: Partial<ComicBubble> = {};
  const kind = oneOf(v.kind, BUBBLE_KINDS);
  if (kind) patch.kind = kind;
  if (typeof v.text === 'string') patch.text = v.text.slice(0, 500);
  const x = num(v.x);
  const y = num(v.y);
  if (x !== undefined) patch.x = between(x, 0, 1);
  if (y !== undefined) patch.y = between(y, 0, 1);
  const scale = num(v.scale);
  if (scale !== undefined) patch.scale = Math.min(BUBBLE_SCALE_RANGE.max, Math.max(BUBBLE_SCALE_RANGE.min, scale));
  if (typeof v.vertical === 'boolean') patch.vertical = v.vertical;
  const line = oneOf(v.line, BUBBLE_LINES);
  if (line) patch.line = line;
  if (typeof v.dark === 'boolean') patch.dark = v.dark;
  const rotation = num(v.rotation);
  if (rotation !== undefined) patch.rotation = clampRotation(rotation);
  if (v.tail === null) patch.tail = null;
  else {
    const tail = readPoint(v.tail);
    if (tail) patch.tail = { x: between(tail.x, -2, 3), y: between(tail.y, -2, 3) };
  }
  return patch;
}

/**
 * Keeps a balloon the assistant made or reworded from covering its panel: the words are made smaller until the balloon
 * takes no more than BALLOON_LIMIT of the panel (sound-effect lettering is meant to be big and is left alone).
 */
function capBubble(panelId: string, bubbleId: string) {
  const ref = findPanel(useComic.getState().projects, panelId);
  const bubble = ref?.panel.bubbles.find((b) => b.id === bubbleId);
  const page = ref?.project.pages[ref.pageIndex];
  const box = page ? panelGeometry(page)[ref.panelIndex]?.box : undefined;
  if (!bubble || !page || !box || bubble.kind === 'sfx' || bubble.kind === 'stamp') return;
  const { width, height } = panelPixels(box, pageAspect(page.size));
  const scale = fitScale(bubble, width / height, BUBBLE_SCALE_RANGE.min);
  if (scale < bubble.scale) useComic.getState().updateBubble(panelId, bubbleId, { scale });
}

/**
 * Puts a balloon in free space of its panel, away from the people the panel's poses show and near the one who speaks, with
 * its tail at that person's mouth. `speaker` is the person's number in the panel's pose (from 1). What the assistant gave
 * itself stays: x and y when it sent either, the tail when it sent one. Nothing happens in a panel without poses.
 */
function placeBubble(panelId: string, bubbleId: string, given: Record<string, unknown>, speaker: unknown, moveOthers = true) {
  const ref = findPanel(useComic.getState().projects, panelId);
  const bubble = ref?.panel.bubbles.find((b) => b.id === bubbleId);
  const page = ref?.project.pages[ref.pageIndex];
  const box = page ? panelGeometry(page)[ref.panelIndex]?.box : undefined;
  if (!ref || !bubble || !page || !box || (!ref.panel.poses.length && !ref.panel.figures.length)) return;
  const n = num(speaker);
  const who = n !== undefined && Number.isInteger(n) && n >= 1 && n <= ref.panel.poses.length ? n - 1 : null;
  const movesIt = !('x' in given) && !('y' in given);
  const aimsIt = who !== null && hasTail(bubble.kind) && given.tail === undefined;
  if (!movesIt && !aimsIt) return;
  const { width, height } = panelPixels(box, pageAspect(page.size));
  const aspect = width / height;
  const taken: Box[] = moveOthers
    ? ref.panel.bubbles.filter((b) => b.id !== bubbleId).map((b) => ({ x: b.x, y: b.y, ...estimateBox(b, aspect) }))
    : [];
  const mouth = who !== null ? mouthOf(ref.panel.poses[who]!) : null;
  const people = [...personBoxes(ref.panel.poses), ...ref.panel.figures];
  // A balloon that has no free place at its size gets smaller words, down to the smallest size, rather than cover a person.
  let scale = bubble.scale;
  let spot = placeBalloon(estimateBox({ ...bubble, scale }, aspect), people, taken, mouth);
  while (movesIt && spot.overlap > 0 && scale > BUBBLE_SCALE_RANGE.min) {
    scale = Math.max(BUBBLE_SCALE_RANGE.min, Math.round(scale * 0.88 * 100) / 100);
    spot = placeBalloon(estimateBox({ ...bubble, scale }, aspect), people, taken, mouth);
  }
  useComic.getState().updateBubble(panelId, bubbleId, {
    ...(scale !== bubble.scale ? { scale } : {}),
    ...(movesIt ? { x: round(spot.x), y: round(spot.y) } : {}),
    ...(aimsIt && spot.tail ? { tail: spot.tail } : {}),
  });
}

/** Shapes the assistant drew, in unit points and reading order, on the page; null when they do not make a valid page. */
function readShapes(v: unknown, aspect: number, free = false): ComicPoint[][] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_PANELS_PER_PAGE) return null;
  const shapes: ComicPoint[][] = [];
  for (const raw of v) {
    if (!Array.isArray(raw) || raw.length < MIN_SHAPE_CORNERS || raw.length > MAX_SHAPE_CORNERS) return null;
    const corners: ComicPoint[] = [];
    for (const c of raw) {
      const p = readPoint(c);
      if (!p) return null;
      corners.push(free ? { x: between(p.x, -1, 2), y: between(p.y, -1, 2) } : toPage(between(p.x, 0, 1), between(p.y, 0, 1), aspect));
    }
    shapes.push(corners);
  }
  // A free page's panels stand on their own: each one valid, and they may overlap.
  if (free) return shapes.every(isFreeShape) ? shapes : null;
  const stitched = stitch(shapes);
  return allValid(stitched) ? stitched : null;
}

/** Applies one operation; true when it changed something. */
function applyOne(op: Record<string, unknown>): boolean {
  const store = useComic.getState();
  const page = currentPage();
  switch (op.op) {
    case 'newComic': {
      const name = typeof op.name === 'string' ? op.name.trim().slice(0, 100) : '';
      store.createProject(name || t('comic.project.newName'));
      return true;
    }
    case 'openComic': {
      const wanted = typeof op.name === 'string' ? op.name.trim().toLowerCase() : '';
      const target = store.projects.find((p) => p.name.toLowerCase() === wanted) ?? store.projects.find((p) => wanted && p.name.toLowerCase().includes(wanted));
      if (!target) return false;
      store.selectProject(target.id);
      return true;
    }
    case 'addPages': {
      const count = num(op.count);
      if (!currentProject() || count === undefined) return false;
      let added = 0;
      for (let i = 0; i < between(Math.round(count), 1, ADD_PAGES_MAX); i++) if (useComic.getState().addPage() !== null) added++;
      return added > 0;
    }
    case 'draw': {
      const project = currentProject();
      if (!project || !page) return false;
      // The model and settings of the Generate tab draw it; without a model nothing can be drawn, and the user is told why.
      const blocked = comicReadiness().find((r) => r === t('comic.readiness.noModel'));
      if (blocked) {
        toast({ status: 'warning', title: blocked });
        return false;
      }
      const prompted = (pages: ComicPage[]) => pages.flatMap((pg) => pg.panels.filter((p) => p.prompt.trim()).map((p) => p.id));
      const at = op.scope === 'panel' ? panelAt(op.panel) : null;
      const ids = op.scope === 'comic' ? prompted(project.pages) : op.scope === 'panel' ? (at ? prompted([{ ...at.page, panels: [at.page.panels[at.index]!] }]) : []) : prompted([page]);
      if (!ids.length) return false;
      void drawPanels(ids);
      return true;
    }
    case 'page': {
      const n = num(op.page);
      const target = n !== undefined ? currentProject()?.pages[n - 1] : undefined;
      if (!target) return false;
      store.selectPage(target.id);
      return true;
    }
    case 'addPage':
      return store.addPage() !== null;
    case 'layout': {
      if (!page) return false;
      const count = num(op.panelCount);
      store.applyPageLayout(page.id, {
        panelCount: count !== undefined ? between(Math.round(count), 1, MAX_PANELS_PER_PAGE) : page.panels.length,
        columns: oneOf(op.columns, PAGE_COLUMNS) ?? page.columns,
        direction: oneOf(op.direction, READING_DIRECTIONS) ?? page.direction,
        size: oneOf(op.size, PAGE_SIZES) ?? page.size,
        shapes: null,
      });
      return true;
    }
    case 'template': {
      if (!page) return false;
      const auto = BUILTIN_PAGE_LAYOUTS.find((l) => l.id === op.id);
      if (auto) {
        store.applyPageLayout(page.id, { panelCount: auto.panelCount, columns: auto.columns, direction: page.direction, size: page.size, shapes: null });
        return true;
      }
      const shaped = BUILTIN_SHAPE_LAYOUTS.find((l) => l.id === op.id);
      if (!shaped) return false;
      const shapes = templateShapes(shaped.shapes, pageAspect(page.size), page.direction);
      store.applyPageLayout(page.id, { panelCount: shapes.length, columns: page.columns, direction: page.direction, size: page.size, shapes });
      return true;
    }
    case 'shapes': {
      if (!page) return false;
      const free = op.free === true;
      const shapes = readShapes(op.shapes, pageAspect(page.size), free);
      if (!shapes) return false;
      store.applyPageLayout(page.id, { panelCount: shapes.length, columns: page.columns, direction: page.direction, size: page.size, shapes });
      if (free) store.setPageFree(page.id, true);
      return true;
    }
    case 'mangaLayout': {
      if (!page) return false;
      const count = num(op.panelCount);
      // A page cut the way manga pages are: tiers of unequal height, a dominant panel, slanted cuts; a new seed each time.
      const shapes = mangaLayout({
        panelCount: count !== undefined ? between(Math.round(count), 1, MANGA_MAX_PANELS) : Math.min(page.panels.length, MANGA_MAX_PANELS),
        focus: num(op.focus) ?? null,
        mood: oneOf(op.mood, MANGA_MOODS) ?? 'action',
        direction: page.direction,
        aspect: pageAspect(page.size),
        seed: num(op.seed) ?? Math.floor(Math.random() * 1e9),
      });
      if (!shapes.every(isFreeShape)) return false;
      store.applyPageLayout(page.id, { panelCount: shapes.length, columns: page.columns, direction: page.direction, size: page.size, shapes });
      store.setPageFree(page.id, true);
      return true;
    }
    case 'frame': {
      if (!page) return false;
      const frameMm = num(op.frameMm);
      const insetMm = num(op.insetMm);
      const marginMm = num(op.marginMm);
      // The colour of the frame lines, as #rrggbb (anything else is left out).
      const color = typeof op.color === 'string' && /^#[0-9a-f]{6}$/i.test(op.color) ? op.color : undefined;
      if (frameMm === undefined && insetMm === undefined && marginMm === undefined && color === undefined) return false;
      store.setPageLayout(page.id, {
        ...(color !== undefined ? { frameColor: color } : {}),
        ...(frameMm !== undefined ? { frameMm: between(frameMm, FRAME_WIDTH_RANGE.min, FRAME_WIDTH_RANGE.max) } : {}),
        ...(insetMm !== undefined ? { insetMm: between(insetMm, PICTURE_INSET_RANGE.min, PICTURE_INSET_RANGE.max) } : {}),
        ...(marginMm !== undefined ? { marginMm: between(marginMm, FRAME_MARGIN_RANGE.min, FRAME_MARGIN_RANGE.max) } : {}),
      });
      return true;
    }
    case 'style': {
      // The words of every panel of the comic, or of the page on screen: an empty text goes back to the default.
      const project = currentProject();
      if (!project || (op.scope === 'page' && !page)) return false;
      const words = (['positive', 'negative'] as const).filter((k) => typeof op[k] === 'string');
      if (!words.length) return false;
      const next: ComicStyle = { ...(op.scope === 'page' ? page?.style : project.style) };
      for (const k of words) {
        const text = (op[k] as string).trim().slice(0, STYLE_MAX);
        if (text) next[k] = text;
        else delete next[k];
      }
      const style = Object.keys(next).length ? next : undefined;
      if (op.scope === 'page') store.setPageStyle(page!.id, style);
      else store.setStyle(project.id, style);
      return true;
    }
    case 'castReference': {
      const project = currentProject();
      const strength = num(op.strength);
      if (!project || (op.strength !== null && strength === undefined)) return false;
      store.setCastReference(project.id, op.strength === null ? undefined : strength);
      return true;
    }
    case 'effect': {
      const effect = COMIC_EFFECTS.find((e) => e === op.effect);
      if (!effect || !page) return false;
      if (op.scope === 'comic') store.setProjectEffect(effect);
      else store.setPageEffect(page.id, effect);
      return true;
    }
    case 'addPanel': {
      if (!page) return false;
      const at = op.panel === undefined || op.panel === null ? null : panelAt(op.panel);
      if (op.panel !== undefined && op.panel !== null && !at) return false;
      // No panel given: a panel is added over the page and the others stay as they are; a panel given is cut in half.
      return (at ? store.halvePanel(page.id, at.index) : store.addPanel(page.id)) !== null;
    }
    case 'removePanel': {
      const at = panelAt(op.panel);
      return at ? store.removePanel(at.page.id, at.index) : false;
    }
    case 'split': {
      const at = panelAt(op.panel);
      const from = readPoint(op.from);
      const to = readPoint(op.to);
      if (!at || !from || !to) return false;
      const aspect = pageAspect(at.page.size);
      return store.splitPanel(at.page.id, at.index, toPage(from.x, from.y, aspect), toPage(to.x, to.y, aspect));
    }
    case 'swap': {
      const a = panelAt(op.a);
      const b = panelAt(op.b);
      if (!a || !b || a.index === b.index) return false;
      store.swapPanels(a.page.id, a.index, b.index);
      return true;
    }
    case 'select': {
      const at = panelAt(op.panel);
      if (!at) return false;
      store.selectPanel(at.page.panels[at.index]!.id);
      return true;
    }
    case 'cast': {
      const project = currentProject();
      if (!project) return false;
      const cast: ComicCharacter[] = project.cast.map((c) => ({ ...c }));
      const named = (name: string) => cast.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
      let changed = false;
      // The list may come under another name, and the words under another key: take what is plainly meant.
      const listed = [op.characters, op.cast, op.people].find((v) => Array.isArray(v)) as unknown[] | undefined;
      let unreadable = 0;
      for (const raw of listed ?? []) {
        const words = isObject(raw) ? [raw.tags, raw.look, raw.appearance, raw.description, raw.prompt].find((v) => typeof v === 'string') : undefined;
        const parts = isObject(raw) ? cleanParts(raw.parts) : undefined;
        const nonHuman = isObject(raw) && typeof raw.nonHuman === 'boolean' ? raw.nonHuman : undefined;
        const negative = isObject(raw) && typeof raw.negative === 'string' ? raw.negative.trim().slice(0, CHARACTER_NEGATIVE_MAX) : undefined;
        if (!isObject(raw) || typeof raw.name !== 'string' || !raw.name.trim() || (typeof words !== 'string' && !parts && nonHuman === undefined && negative === undefined)) {
          unreadable++;
          continue;
        }
        const name = raw.name.trim().slice(0, CHARACTER_NAME_MAX);
        const tags = typeof words === 'string' ? words.trim().slice(0, CHARACTER_TAGS_MAX) : undefined;
        const at = named(name);
        // Words given again replace the old ones; the parts given are merged over the parts the character has.
        if (at >= 0) {
          cast[at] = { ...cast[at]!, ...(tags === undefined ? {} : { tags }), ...(parts ? { parts: { ...cast[at]!.parts, ...parts } } : {}), ...(nonHuman === undefined ? {} : { nonHuman }), ...(negative === undefined ? {} : { negative: negative || undefined }) };
        } else if (cast.length < CAST_MAX) cast.push({ id: newComicId('character'), name, tags: tags ?? '', ...(parts ? { parts } : {}), ...(nonHuman ? { nonHuman } : {}), ...(negative ? { negative } : {}), imageName: null });
        else continue;
        changed = true;
      }
      for (const name of Array.isArray(op.remove) ? op.remove : []) {
        const at = typeof name === 'string' ? named(name) : -1;
        if (at >= 0) {
          cast.splice(at, 1);
          changed = true;
        }
      }
      if (changed) store.setCast(cast);
      else if (unreadable || !listed) opNote = 'cast needs "characters": a list of {"name": text, "tags": text}, or "remove": a list of names';
      return changed;
    }
    case 'places': {
      const project = currentProject();
      if (!project) return false;
      const places: ComicPlace[] = project.places.map((p) => ({ ...p }));
      const named = (name: string) => places.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
      let changed = false;
      for (const raw of Array.isArray(op.places) ? op.places : []) {
        // The words may come under another key: take what is plainly meant.
        const words = isObject(raw) ? [raw.tags, raw.words, raw.look, raw.description].find((v) => typeof v === 'string') : undefined;
        const negative = isObject(raw) && typeof raw.negative === 'string' ? raw.negative.trim().slice(0, PLACE_NEGATIVE_MAX) : undefined;
        if (!isObject(raw) || typeof raw.name !== 'string' || !raw.name.trim() || (typeof words !== 'string' && negative === undefined)) continue;
        const name = raw.name.trim().slice(0, PLACE_NAME_MAX);
        const tags = typeof words === 'string' ? words.trim().slice(0, PLACE_TAGS_MAX) : undefined;
        const at = named(name);
        // Words given again replace the old ones; a new name is added.
        if (at >= 0) places[at] = { ...places[at]!, ...(tags === undefined ? {} : { tags }), ...(negative === undefined ? {} : { negative }) };
        else if (places.length < PLACES_MAX) places.push({ id: newComicId('place'), name, tags: tags ?? '', ...(negative ? { negative } : {}) });
        else continue;
        changed = true;
      }
      for (const name of Array.isArray(op.remove) ? op.remove : []) {
        const at = typeof name === 'string' ? named(name.trim()) : -1;
        if (at >= 0) {
          places.splice(at, 1);
          changed = true;
        }
      }
      if (changed) store.setPlaces(places);
      if (typeof op.world === 'string') {
        store.setWorld(op.world.trim());
        changed = true;
      }
      if (!changed) opNote = 'places needs "places": a list of {"name": text, "tags": text}, "remove": a list of names, or "world": text';
      return changed;
    }
    case 'panel': {
      const at = panelAt(op.panel);
      if (!at) return false;
      const id = at.page.panels[at.index]!.id;
      let changed = false;
      if (Array.isArray(op.cast)) {
        // Who is in the panel, by the names of the cast; a name the comic does not have is left out.
        const wanted = op.cast.filter((n): n is string => typeof n === 'string').map((n) => n.trim().toLowerCase());
        store.setPanelCast(id, currentProject()!.cast.filter((c) => wanted.includes(c.name.toLowerCase())).map((c) => c.id));
        changed = true;
      }
      if (Array.isArray(op.figures)) {
        store.setPanelFigures(id, op.figures);
        changed = true;
      }
      if (op.place !== undefined) {
        // Where the panel is set, by the name of a place of the comic; null or an empty text takes the place out.
        const name = typeof op.place === 'string' ? op.place.trim().toLowerCase() : '';
        const places = currentProject()!.places;
        const place = name ? places.find((p) => p.name.toLowerCase() === name) : undefined;
        if (name && !place) opNote = `no place is named "${String(op.place)}"; the places are: ${places.map((p) => p.name).join(', ') || 'none'} (add it with op places first)`;
        else {
          store.setPanelPlace(id, place?.id ?? null);
          changed = true;
        }
      }
      if (typeof op.prompt === 'string') {
        store.setPrompt(id, op.prompt.slice(0, 4000));
        changed = true;
      }
      if (typeof op.negativePrompt === 'string') {
        store.setPanelNegative(id, op.negativePrompt.slice(0, 4000));
        changed = true;
      }
      if (typeof op.note === 'string') {
        store.setPanelNote(id, op.note);
        changed = true;
      }
      return changed;
    }
    case 'pose': {
      const at = panelAt(op.panel);
      if (!at) return false;
      const id = at.page.panels[at.index]!.id;
      if (!Array.isArray(op.people) || op.people.length === 0) {
        store.setPanelPose(id, [], null);
        store.setPanelPoseCast(id, []);
        store.setPanelPoseWords(id, []);
        return true;
      }
      // A panel without a box (a broken layout) takes no pose: nothing is written before that is known.
      const box = panelGeometry(at.page)[at.index]?.box;
      if (!box) {
        opNote = 'the panel has no place on the page (its layout is broken), so it cannot take a pose';
        return false;
      }
      // Who each person is, by the cast's names: the panel then draws each character in its own region.
      // Only the people the pose can read become people of the panel, so the names stay in step with them.
      const people = op.people.slice(0, 4).filter((p) => readPoseSpec(p) !== null);
      const project = currentProject();
      const who = people.map((p) => {
        const name = isObject(p) && typeof p.who === 'string' ? p.who.trim().toLowerCase() : '';
        return (name && project?.cast.find((c) => c.name.toLowerCase() === name)?.id) || null;
      });
      store.setPanelPoseCast(id, who.some(Boolean) ? who : []);
      // What each person does goes into that person's region when the panel is drawn in regions.
      store.setPanelPoseWords(id, people.map((p) => (isObject(p) && typeof p.words === 'string' ? p.words : '')));
      const named = who.filter((w): w is string => !!w && !at.page.panels[at.index]!.cast.includes(w));
      if (named.length) store.setPanelCast(id, [...at.page.panels[at.index]!.cast, ...named]);
      const { width, height } = panelPixels(box, pageAspect(at.page.size));
      // The pose picture is drawn and uploaded in the background; the panel takes it when it is ready.
      putPosePeople(id, people, width, height).catch((err: unknown) =>
        toast({ status: 'error', title: t('comic.panel.poseFailed'), description: err instanceof Error ? err.message : String(err) }),
      );
      return true;
    }
    case 'picture': {
      const at = panelAt(op.panel);
      const panel = at?.page.panels[at.index];
      if (!panel?.imageName) return false;
      const view: Record<string, number | boolean> = {};
      for (const k of ['cx', 'cy', 'scale', 'rotation'] as const) {
        const v = num(op[k]);
        if (v !== undefined) view[k] = v;
      }
      for (const k of ['flipX', 'flipY'] as const) if (typeof op[k] === 'boolean') view[k] = op[k];
      if (!Object.keys(view).length) return false;
      store.setPanelImageView(panel.id, view);
      return true;
    }
    case 'take': {
      // An earlier picture back in its panel, as it sat; the picture there now becomes the newest earlier one.
      const at = panelAt(op.panel);
      const panel = at?.page.panels[at.index];
      const n = num(op.take);
      const take = panel && n !== undefined && Number.isInteger(n) ? panel.takes[n - 1] : undefined;
      if (!panel) return false;
      if (!take) {
        opNote = `panel ${String(op.panel)} has ${panel.takes.length} earlier picture(s), numbered from 1, the newest first`;
        return false;
      }
      store.setPanelImage(panel.id, take.imageName);
      return true;
    }
    case 'fix': {
      // The parts of a drawn panel's picture inside the boxes drawn again (inpaint); the old picture goes to its earlier ones.
      const at = panelAt(op.panel);
      const panel = at?.page.panels[at.index];
      if (!panel) return false;
      if (!panel.imageName) {
        opNote = 'the panel has no picture yet: draw it first';
        return false;
      }
      const boxes = readFixBoxes(op.boxes ?? op.box);
      if (!boxes.length) {
        opNote = 'fix needs "boxes": [{"x","y","w","h"}] in fractions of the panel, each at least 0.02 wide and high';
        return false;
      }
      // What can be told at once is told to the caller: a redraw that is refused (no model, a model without masks, a picture
      // gone from the gallery) is not reported as applied. A failure of the upload or of the queue comes later, in a toast.
      const mask = { strokes: [], boxes };
      const target = fixTarget(panel.id, mask);
      if (typeof target === 'string') {
        opNote = target;
        return false;
      }
      const strength = num(op.strength);
      const words = typeof op.prompt === 'string' ? op.prompt.slice(0, 1000) : undefined;
      void redrawPart(panel.id, mask, { words, strength: strength === undefined ? FIX_STRENGTH.default : between(strength, FIX_STRENGTH.min, FIX_STRENGTH.max) });
      return true;
    }
    case 'sheet': {
      // The views a character's sheet lacks, each drawn from its picture (the picture first when it has none).
      const project = currentProject();
      const name = typeof op.character === 'string' ? op.character.trim().toLowerCase() : '';
      const character = project?.cast.find((c) => c.name.trim().toLowerCase() === name);
      if (!project || !character) {
        opNote = `no character is named "${String(op.character)}"; the cast is: ${project?.cast.map((c) => c.name).join(', ') || 'empty'}`;
        return false;
      }
      if (!missingViews(character).length) {
        opNote = 'the sheet of this character has every view already';
        return false;
      }
      const blocked = comicReadiness().find((r) => r === t('comic.readiness.noModel'));
      if (blocked) {
        toast({ status: 'warning', title: blocked });
        return false;
      }
      void makeSheet(character.id);
      return true;
    }
    case 'addBubble': {
      const at = panelAt(op.panel);
      if (!at) return false;
      const panelId = at.page.panels[at.index]!.id;
      const kind: BubbleKind = oneOf(op.kind, BUBBLE_KINDS) ?? 'speech';
      const picture = kind === 'stamp' && typeof op.text === 'string' ? findStamp(op.text) : undefined;
      if (kind === 'stamp' && typeof op.text === 'string' && !picture) {
        opNote = `no sound-effect picture is named "${op.text}"; use an id such as "burst-doon" or one of these words: ${stampWords().join(' ')}`;
        return false;
      }
      const id = store.addBubble(panelId, kind);
      if (!id) return false;
      const patch = bubblePatch(op);
      delete patch.kind;
      if (picture) patch.text = picture.id;
      else if (kind === 'stamp') delete patch.text;
      if (patch.text !== undefined && kind !== 'sfx' && kind !== 'stamp') patch.text = wrapBalloonText(patch.text, patch.vertical ?? false);
      if (Object.keys(patch).length) useComic.getState().updateBubble(panelId, id, patch);
      capBubble(panelId, id);
      placeBubble(panelId, id, op, op.speaker);
      // Its words are fitted once the screen lays them out, so they stay inside the balloon and the panel.
      useComic.getState().fitBubbles([id]);
      return true;
    }
    case 'bubble': {
      const owner = bubbleOwner(op.id);
      const patch = isObject(op.set) ? bubblePatch(op.set) : {};
      const kindAfter = patch.kind ?? owner?.bubble.kind;
      if (owner && patch.text !== undefined && kindAfter === 'stamp') {
        const found = findStamp(patch.text);
        if (found) patch.text = found.id;
        else {
          delete patch.text;
          opNote = `no sound-effect picture is named "${String((op.set as Record<string, unknown>).text)}"`;
        }
      } else if (owner && patch.text !== undefined && kindAfter !== 'sfx') patch.text = wrapBalloonText(patch.text, patch.vertical ?? owner.bubble.vertical);
      if (!owner) opNote = 'no balloon has this id (use the ids get_comic_page lists)';
      else if (!isObject(op.set)) opNote = 'bubble needs "set": {...fields}';
      if (!owner || (!Object.keys(patch).length && !(isObject(op.set) && op.set.speaker !== undefined))) return false;
      store.updateBubble(owner.panelId, owner.bubble.id, patch);
      // Only when it names a speaker: a balloon it does not mention again stays where it is.
      if ('text' in patch || 'scale' in patch || 'vertical' in patch) capBubble(owner.panelId, owner.bubble.id);
      if (isObject(op.set) && op.set.speaker !== undefined) placeBubble(owner.panelId, owner.bubble.id, op.set, op.set.speaker);
      if ('text' in patch || 'scale' in patch || 'vertical' in patch || 'kind' in patch) useComic.getState().fitBubbles([owner.bubble.id]);
      return true;
    }
    case 'removeBubble': {
      const owner = bubbleOwner(op.id);
      if (!owner) return false;
      store.removeBubble(owner.panelId, owner.bubble.id);
      return true;
    }
    case 'layer':
    case 'addLayer':
    case 'deleteLayer':
      return applyLayerOp(op, page);
    default:
      return false;
  }
}

/**
 * Applies the assistant's operations in order; false when none of them took effect.
 */
export function applyComicOps(ops: unknown[]): boolean {
  let changed = false;
  skippedOps = [];
  for (const [at, sent] of ops.slice(0, 400).entries()) {
    const shaped = isObject(sent) ? asListOp(sent) : undefined;
    const raw: unknown = shaped?.op ?? sent;
    if (shaped?.read) skippedOps.push(`op ${at + 1} (${String(shaped.op.op)}): read as ${shaped.read}; send it in that form`);
    // A scene becomes the operations a panel is made of, each applied like any other.
    const steps = isObject(raw) && raw.op === 'scene' ? sceneSteps(raw, at) : [raw];
    for (const step of steps) {
      const name = isObject(step) && typeof step.op === 'string' ? (step === raw ? step.op : `scene: ${step.op}`) : '?';
      const op = isObject(step) ? step : null;
      if (!op) skippedOps.push(`op ${at + 1} (${name}): not an object`);
      else {
        opNote = null;
        if (applyOne(op)) {
          changed = true;
          // It took effect, but a part of it did not (a name the comic does not have).
          if (opNote) skippedOps.push(`op ${at + 1} (${name}): took effect except for a part (${opNote})`);
        } else skippedOps.push(`op ${at + 1} (${name}): took no effect (${opNote ?? 'no comic or page open for it, an unknown operation, or values that do not fit'})`);
      }
    }
  }
  return changed;
}

/** The list of each operation that adds items, and the field that marks one item written flat into the operation. */
const LISTS: Record<string, { list: string; item: string }> = {
  cast: { list: 'characters', item: 'name' },
  places: { list: 'places', item: 'name' },
};
/** Other names a list comes under; the cast case reads its own (cast, people). */
const LIST_NAMES = ['items', 'rows', 'beats', 'entries', 'list', 'places', 'characters'];

/**
 * An operation that adds items, in the form its case reads, and how it was read when it came in another. Claude Haiku 4.5
 * (a run of 2026-10-17) wrote one character or place flat into its operation, sent the plot as "rows" with the page beside
 * them, and sent "world" as an operation of its own; the plot answer then said nothing differed, and the plot step failed
 * three times. Fields beside a list go into each of its items that lacks them.
 */
function asListOp(op: Record<string, unknown>): { op: Record<string, unknown>; read?: string } {
  if (op.op === 'world' && typeof op.world === 'string') return { op: { op: 'places', world: op.world }, read: '{"op":"places","world":...}' };
  const shape = typeof op.op === 'string' ? LISTS[op.op] : undefined;
  if (!shape || Array.isArray(op[shape.list]) || (op.op === 'cast' && (Array.isArray(op.cast) || Array.isArray(op.people)))) return { op };
  const { op: name, replace, remove, clear, ...rest } = op;
  const head = { op: name, ...(replace === undefined ? {} : { replace }), ...(remove === undefined ? {} : { remove }), ...(clear === undefined ? {} : { clear }) };
  const under = LIST_NAMES.find((k) => Array.isArray(rest[k]));
  if (under) {
    const { [under]: items, ...shared } = rest;
    return { op: { ...head, [shape.list]: (items as unknown[]).map((item) => (isObject(item) ? { ...shared, ...item } : item)) }, read: `a list in "${shape.list}"` };
  }
  return shape.item in rest ? { op: { ...head, [shape.list]: [rest] }, read: `one item of a list in "${shape.list}"` } : { op };
}

/**
 * The operations a scene stands for, on the open page (see scene.ts); what the scene named that the comic lacks goes to the
 * skipped list as a note, so the assistant hears of it. Nothing when the scene cannot be read.
 */
function sceneSteps(raw: Record<string, unknown>, at: number): Record<string, unknown>[] {
  const { scene, notes } = readScene(raw);
  const project = currentProject();
  const page = currentPage();
  const panel = scene && page ? page.panels[scene.panel - 1] : undefined;
  if (!scene || !project || !page || !panel) {
    skippedOps.push(`op ${at + 1} (scene): took no effect (${notes[0] ?? (page ? `panel ${String(raw.panel)} is not on the open page, which has ${page.panels.length} panels numbered from 1` : 'no page is open')})`);
    return [];
  }
  const bubbleIds = panel.bubbles.filter((b) => b.kind !== 'sfx' && b.kind !== 'stamp').map((b) => b.id);
  const made = sceneOps(scene, { cast: project.cast, rtl: page.direction === 'rtl', bubbleIds });
  for (const note of [...notes, ...made.notes]) skippedOps.push(`op ${at + 1} (scene): ${note}`);
  return made.ops;
}

/** The operations of the last call that did nothing, with the number each had in the call, so the assistant learns which ones. */
let skippedOps: string[] = [];
/** Why the operation being applied did nothing, when the case knows; told to the assistant with the skipped operation. */
let opNote: string | null = null;

export const comicAgentEditor = {
  context: comicContext,
  answer: comicAnswer,
  apply: applyComicOps,
  skipped: () => skippedOps,
  snapshot: () => useComic.getState().projects,
  restore: (snapshot: unknown) => {
    if (Array.isArray(snapshot)) useComic.getState().restoreProjects(snapshot as ComicProject[]);
  },
};
