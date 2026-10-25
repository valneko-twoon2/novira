// Carrying a panel about the page by a press anywhere on it. The handlers go on the panel, and on the selected picture's
// outline too, where it lies over the panel (see PanelPictureHandles).
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { ComicPoint } from '@/state/comic/document';
import { translateShape } from '@/state/comic/freeShapes';
import { frameOutlines } from '@/state/comic/layout';
import { activePage, useComic } from '@/state/comic/store';

/** The least a press must move before it carries a panel, in pixels: a click is not a move. */
const CARRY_THRESHOLD = 3;

/**
 * Carrying a panel by a press anywhere on it: the handlers go on the panel. The panel follows the pointer (its middle stays
 * on the page), and a whole carry is one undo step. The first move makes the page free (see setFreeShape): a press that does
 * not move only selects the panel.
 */
export function useCarry(pageId: string, index: number) {
  const carry = useRef<{ pointer: number; x: number; y: number; shape: ComicPoint[]; moving: boolean } | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const state = useComic.getState();
      const page = activePage(state);
      // The panel as it is drawn: a page that turns free on this carry keeps its panels where they are drawn (see setPageFree).
      const shape = page ? frameOutlines(page)[index] : undefined;
      if (!page || !shape) return;
      // The pointer is captured only once the press moves (see below): a click or a double click stays with what was
      // pressed, such as the picture, which a double click selects.
      if (state.selectedPanelId !== page.panels[index]!.id) state.selectPanel(page.panels[index]!.id);
      carry.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, shape, moving: false };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const d = carry.current;
      const rect = e.currentTarget.closest<HTMLElement>('.comic-page')?.getBoundingClientRect();
      if (!d || d.pointer !== e.pointerId || !rect?.width || !rect.height) return;
      // A press let go of where nothing saw it is over.
      if (!d.moving && !(e.buttons & 1)) {
        carry.current = null;
        return;
      }
      if (!d.moving && Math.hypot(e.clientX - d.x, e.clientY - d.y) < CARRY_THRESHOLD) return;
      if (!d.moving) e.currentTarget.setPointerCapture?.(e.pointerId);
      d.moving = true;
      const moved = translateShape(d.shape, { x: (e.clientX - d.x) / rect.width, y: (e.clientY - d.y) / rect.height });
      if (moved) useComic.getState().setFreeShape(pageId, index, moved, `carry:${pageId}:${index}`);
    },
    onPointerUp: () => {
      carry.current = null;
    },
    onPointerCancel: () => {
      carry.current = null;
    },
  };
}
