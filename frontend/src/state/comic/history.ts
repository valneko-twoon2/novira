// Undo and redo of the comic projects. A step is the projects as they were before one change. A step brings back what
// the user made on the pages (the layout, the prompts, the poses and the balloons), but not the pages' layers (each page's
// canvas store undoes those), the panels' pictures and their earlier ones, the views of the characters' sheets,
// the templates, the drawing settings and styles, or a project's name: a picture arrives from the queue at any time, and
// undo does not touch the saved templates.
import { undoLimit } from '../settings';
import { pagePixels, type ComicProject } from './document';
import { rescaleCanvasDoc } from './pageCanvasDoc';

/** Changes to the same field within this many milliseconds are one step, so typing a sentence is one undo. */
export const HISTORY_GAP_MS = 1000;

/** The most steps kept for undo (the setting shared by the editors). */
export const historyLimit = () => undoLimit();

/**
 * The projects as a step brings them back: the pages, panels and balloons of `snapshot`, with the pictures, templates and
 * name that `current` has now. A project that is not in `snapshot` (made after it) is kept as it is.
 */
export function restoreProjects(current: ComicProject[], snapshot: ComicProject[], at: number): ComicProject[] {
  return current.map((project) => {
    const before = snapshot.find((p) => p.id === project.id);
    if (!before || before === project) return project;
    const shown = new Map(project.pages.flatMap((page) => page.panels.map((panel) => [panel.id, panel] as const)));
    return {
      ...before,
      name: project.name,
      panelTemplates: project.panelTemplates,
      pageTemplates: project.pageTemplates,
      // The drawing settings, the style and the character references are no undo steps: the form shows them as they are now.
      draw: project.draw,
      style: project.style,
      castReference: project.castReference,
      updatedAt: at,
      // The views of a character's sheet arrive from the queue as the panels' pictures do: each character keeps the ones it has.
      cast: before.cast.map((c) => {
        const now = project.cast.find((x) => x.id === c.id);
        if (!now || now.sheet === c.sheet) return c;
        const { sheet: _old, ...rest } = c;
        return now.sheet ? { ...rest, sheet: now.sheet } : rest;
      }),
      pages: before.pages.map((page) => {
        const here = project.pages.find((p) => p.id === page.id);
        return {
          ...page,
          // The page's layers are undone by its own canvas store, not here: they stay as they are now, on the
          // paper the step brings back.
          ...(here ? { draw: here.draw, style: here.style, canvas: here.size === page.size ? here.canvas : rescaleCanvasDoc(here.canvas, pagePixels(here), pagePixels(page)) } : {}),
          panels: page.panels.map((panel) => {
            const now = shown.get(panel.id);
            return now ? { ...panel, imageName: now.imageName, imageView: now.imageView, takes: now.takes } : panel;
          }),
        };
      }),
    };
  });
}
