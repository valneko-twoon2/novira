// Canvas shortcuts on the surrounding canvas store, active only while they are mounted.
import { useEffect } from 'react';
import { isSlot, TOOL_HOTKEYS, useCanvas, type CanvasStore, type Tool } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { useParams } from '@/state/params';
import { useHotkey, ZOOM_HOTKEYS } from '@/ui';
import { acceptStaged, discardAllStaged, pasteImageBlob, randomizePoses } from './actions';
import { fitBboxToLayers, resetView, zoomStep, zoomTo } from './view';

const TOOL_KEYS: Record<string, Tool> = Object.fromEntries(Object.entries(TOOL_HOTKEYS).map(([tool, key]) => [key, tool as Tool]));

/** What a host leaves out: tools it does not offer, the view keys (its own view), the global reference images. */
export interface CanvasHotkeysProps {
  /** The tools the keys may choose; all by default. */
  tools?: readonly Tool[];
  /** Whether the zoom and fit keys act on the store's view (off over a host's document). */
  viewKeys?: boolean;
  /** Whether Delete also removes a chosen global reference image (off where they are not shown). */
  refImages?: boolean;
}

export function CanvasHotkeys({ tools, viewKeys = true, refImages = true }: CanvasHotkeysProps = {}) {
  const hasStaged = useCanvasStore((s) => s.stagedImageNames.length > 0);
  const poseTool = useCanvasStore((s) => s.tool === 'pose');
  const store = useCanvasStoreApi();

  useHotkey('r', () => randomizePoses(store.getState().selectedEntityId, undefined, store), { enabled: poseTool && (!tools || tools.includes('pose')) });

  const toolKeys = Object.keys(TOOL_KEYS).filter((k) => !tools || tools.includes(TOOL_KEYS[k] as Tool));
  useHotkey(toolKeys, (e) => {
    const tool = TOOL_KEYS[(e.key ?? '').toLowerCase()];
    if (tool && (!tools || tools.includes(tool))) store.getState().setTool(tool);
  });
  useHotkey('q', () => store.getState().swapTool());
  useHotkey(['[', ']'], (e) => {
    const s = store.getState();
    const grow = e.key === ']';
    const step = (w: number) => Math.max(1, Math.round(grow ? w * 1.15 + 1 : w / 1.15 - 1));
    if (s.tool === 'eraser') s.setEraserWidth(step(s.eraserWidth));
    else if (s.tool === 'mosaic') s.setMosaicWidth(step(s.mosaicWidth));
    else s.setBrushWidth(step(s.brushWidth));
  });
  useHotkey('mod+z', () => store.getState().undo());
  useHotkey(['mod+shift+z', 'mod+y'], () => store.getState().redo());
  useHotkey('delete', () => {
    const s = store.getState();
    const id = s.selectedEntityId;
    if (!id) return;
    if (s.entities.some((e) => e.id === id)) s.removeEntity(id);
    else if (refImages && useParams.getState().refImages.some((r) => r.id === id)) useParams.getState().removeRefImage(id);
  });
  useHotkey(ZOOM_HOTKEYS.fit, () => resetView(store), { enabled: viewKeys });
  useHotkey(ZOOM_HOTKEYS.actualSize, () => zoomTo(1, store), { enabled: viewKeys });
  useHotkey(ZOOM_HOTKEYS.zoomIn, () => zoomStep(1, store), { enabled: viewKeys });
  useHotkey(ZOOM_HOTKEYS.zoomOut, () => zoomStep(-1, store), { enabled: viewKeys });
  useHotkey('shift+r', () => resetView(store), { enabled: viewKeys });
  useHotkey('shift+c', () => fitBboxToLayers(store), { enabled: viewKeys });

  useHotkey('enter', () => acceptStaged(store), { enabled: hasStaged });
  useHotkey('escape', () => discardAllStaged(store), { enabled: hasStaged });
  useHotkey('arrowleft', () => store.getState().setStagedIndex(store.getState().stagedIndex - 1), { enabled: hasStaged });
  useHotkey('arrowright', () => store.getState().setStagedIndex(store.getState().stagedIndex + 1), { enabled: hasStaged });

  // With the move tool, the arrow keys nudge the selected layer by 1 px (10 px with Shift).
  const nudgeKeys = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'shift+arrowleft', 'shift+arrowright', 'shift+arrowup', 'shift+arrowdown'];
  useHotkey(nudgeKeys, (e) => { if (nudgeSelected(e.key, e.shiftKey, store)) e.preventDefault(); }, { enabled: !hasStaged, preventDefault: false });

  // Pasting a picture (Ctrl+V) adds it as a new raster layer.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const image = pastedImage(e);
      if (!image) return;
      e.preventDefault();
      void pasteImageBlob(image, store);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [store]);
  return null;
}

/** The first picture on the clipboard, unless the paste goes into a text field. */
export function pastedImage(e: ClipboardEvent): File | null {
  const el = e.target instanceof HTMLElement ? e.target : null;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return null;
  const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  return item?.getAsFile() ?? null;
}

/** Move the selected layer one step in the arrow key's direction. A locked layer, a slot or a non-move tool is left alone. */
export function nudgeSelected(key: string, big: boolean, store: CanvasStore = useCanvas): boolean {
  const s = store.getState();
  const e = s.entities.find((x) => x.id === s.selectedEntityId);
  if (s.tool !== 'move' || !e || e.isLocked || isSlot(e)) return false;
  const step = big ? 10 : 1;
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
  const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
  if (dx === 0 && dy === 0) return false;
  s.updateEntity(e.id, { x: e.x + dx, y: e.y + dy }, { history: 'nudge' });
  return true;
}
