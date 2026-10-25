// While the comic screen is open, the generation form holds the drawing settings of the page on screen (see drawSettings.ts):
// the comic's own, with what the page changes laid over them; a comic that has none yet starts from the form as it was. What
// is changed in the form is kept in the comic or in the page, whichever the settings window is editing (see drawScope). The
// Generate tab's settings are kept aside meanwhile and put back when another screen opens; they are also what the saved form
// holds meanwhile, so closing the app on the comic screen keeps them. A panel is drawn with its own page's settings.
import { keepDrawForSaving, useParams } from '../params';
import { useUi } from '../ui';
import type { ComicPage, ComicProject } from './document';
import { useDrawScope } from './drawScope';
import { DRAW_KEYS, pickDraw, sameDraw, type DrawSettings } from './drawSettings';
import { activePage, activeProject, useComic } from './store';

/** The Generate tab's settings, kept while the comic screen has the form; null while another screen has it. */
let kept: DrawSettings | null = null;
/** Set while the sync itself writes the form, so that write is not taken for the user's. */
let writing = false;
/** Set while withPageDraw lays a page's settings over the form for one build, so listeners can ignore that swap. */
let swapping = false;
/** The comic and page whose settings the form holds now. */
let shownFor: string | null = null;

const onComic = () => useUi.getState().activeTab === 'comic';

function put(settings: DrawSettings) {
  writing = true;
  try {
    useParams.getState().set(settings);
  } finally {
    writing = false;
  }
}

/** The settings a page is drawn with: the comic's laid over the Generate tab's, then the page's laid over those. */
const effective = (base: DrawSettings | null, project: Pick<ComicProject, 'draw'>, page: Pick<ComicPage, 'draw'> | undefined): DrawSettings => ({ ...base, ...project.draw, ...page?.draw });

/** Puts the settings of the page on screen in the form. */
function showCurrent() {
  const s = useComic.getState();
  const project = activeProject(s);
  const page = activePage(s);
  const key = project ? `${project.id}:${page?.id ?? ''}` : null;
  if (key === shownFor) return;
  shownFor = key;
  if (project) put(effective(kept, project, page ?? undefined));
  else if (kept) put(kept);
}

/** Puts the settings of the page on screen in the form again (after the page's changes were taken back). */
export function reloadDraw() {
  shownFor = null;
  if (kept) showCurrent();
}

/**
 * Runs `build` with the form holding the settings of `page`, and puts the form back after, so a panel is drawn with its own
 * page's settings whichever page is on screen. Off the comic screen the comic's and the page's settings are laid over the form
 * as it is, so a run that goes on while another tab is open still draws with the comic's model and size.
 */
export function withPageDraw<T>(project: ComicProject, page: ComicPage | undefined, build: () => T): T {
  const before = pickDraw(useParams.getState());
  const wanted = effective(kept ?? before, project, page);
  if (sameDraw(wanted, before)) return build();
  const outer = swapping;
  swapping = true;
  put(wanted);
  try {
    return build();
  } finally {
    put(before);
    swapping = outer;
  }
}

/** Whether the form holds a page's settings only for the build running now (withPageDraw); a listener ignores that swap. */
export const isSwappingDraw = () => swapping;

function followTab() {
  if (onComic() && !kept) {
    kept = pickDraw(useParams.getState());
    keepDrawForSaving(kept);
    shownFor = null;
    showCurrent();
  } else if (!onComic() && kept) {
    const back = kept;
    kept = null;
    shownFor = null;
    keepDrawForSaving(null);
    put(back);
  }
}

/** What the form changed from the comic's settings: only the keys that differ. */
function differing(now: DrawSettings, base: DrawSettings): DrawSettings | undefined {
  const diff: Record<string, unknown> = {};
  for (const k of DRAW_KEYS) if (JSON.stringify(now[k]) !== JSON.stringify(base[k])) diff[k] = now[k];
  return Object.keys(diff).length ? (diff as DrawSettings) : undefined;
}

/** Keeps a change of the form in the page or in the comic, as the settings window is editing. */
function keepChange(now: DrawSettings) {
  const s = useComic.getState();
  const project = activeProject(s);
  const page = activePage(s);
  if (!project || !kept) return;
  const own = { ...kept, ...project.draw };
  if (useDrawScope.getState().scope === 'page' && page) {
    const diff = differing(now, own);
    if (JSON.stringify(diff) !== JSON.stringify(page.draw)) s.setPageDraw(page.id, diff);
    return;
  }
  // The comic's own: what the page changes stays the page's, so it is not written into the comic.
  const next: Record<string, unknown> = { ...now };
  for (const k of Object.keys(page?.draw ?? {})) next[k] = own[k as keyof DrawSettings];
  if (!sameDraw(next as DrawSettings, own)) s.setDraw(project.id, next as DrawSettings);
}

/** Starts tying the form's drawing settings to the page on screen while the comic screen is open. Returns the function that stops it. */
export function startComicDrawSync(): () => void {
  const stopUi = useUi.subscribe(followTab);
  const stopComic = useComic.subscribe(() => {
    if (kept) showCurrent();
  });
  const stopParams = useParams.subscribe((p) => {
    if (!kept || writing) return;
    keepChange(pickDraw(p));
  });
  followTab();
  return () => {
    stopUi();
    stopComic();
    stopParams();
    if (kept) {
      keepDrawForSaving(null);
      put(kept);
      kept = null;
      shownFor = null;
    }
  };
}
