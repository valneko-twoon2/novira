// Gallery keyboard shortcuts: arrows move (Shift extends), Delete, Ctrl+A, Ctrl+C, Escape.
// Active while the viewer is the main view or the pointer is over the grid, so the canvas keeps its keys.
import type { RefObject } from 'react';
import { useGallery } from '@/state/gallery';
import { useUi, type TabName } from '@/state/ui';
import { useHotkey } from '@/ui';
import { copyImage } from '../actions';
import { requestDeleteImages } from '../deleteRequest';
import { moveSelection } from './selection';

interface Options {
  tab: TabName;
  names: string[];
  /** The image one row up (`-1`) or down (`1`) from an index, following the grid's layout. */
  stepRow: (index: number, dir: -1 | 1) => number;
  gridRef: RefObject<HTMLElement | null>;
  scrollToIndex: (idx: number) => void;
}

export function useGridHotkeys({ tab, names, stepRow, gridRef, scrollToIndex }: Options) {
  const viewerActive = useUi((s) => s.mainView[tab] === 'viewer');
  const active = () => viewerActive || gridRef.current?.matches(':hover') === true;
  const guard = (fn: (e: KeyboardEvent) => void) => (e: KeyboardEvent) => {
    if (!active()) return;
    e.preventDefault();
    fn(e);
  };
  const opts = { preventDefault: false };
  const move = (step: number | ((index: number) => number)) =>
    guard((e) => {
      const idx = moveSelection(names, step, e.shiftKey);
      if (idx !== null) scrollToIndex(idx);
    });

  useHotkey(['arrowleft', 'shift+arrowleft'], move(-1), opts);
  useHotkey(['arrowright', 'shift+arrowright'], move(1), opts);
  useHotkey(['arrowup', 'shift+arrowup'], move((i) => stepRow(i, -1)), opts);
  useHotkey(['arrowdown', 'shift+arrowdown'], move((i) => stepRow(i, 1)), opts);
  useHotkey(
    'delete',
    guard(() => requestDeleteImages(useGallery.getState().selection)),
    opts,
  );
  useHotkey(
    'mod+a',
    guard(() => useGallery.getState().setSelection(names)),
    opts,
  );
  useHotkey(
    'mod+c',
    guard(() => {
      const g = useGallery.getState();
      const image = g.images.find((i) => i.name === g.viewerImageName);
      if (image) void copyImage(image);
    }),
    opts,
  );
  useHotkey(
    'escape',
    guard(() => {
      const g = useGallery.getState();
      if (!g.compareImageName) g.setSelection([]);
    }),
    opts,
  );
}
