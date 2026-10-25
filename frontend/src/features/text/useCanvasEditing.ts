// Editing the scene directly on the canvas: dragging a layer, its corner handles and a bubble's pointer, and the
// keyboard shortcuts (nudge, delete, duplicate, undo).
import { useCallback, useRef, type PointerEvent, type RefObject } from 'react';
import { useTextEditor } from '@/state/text/textEditor';
import type { Layer, Scene } from '@/state/text/textModel';
import { useHotkey } from '@/ui';
import { HANDLE_PX } from './canvasDraw';
import { handleAt, layerAt, scaleStyle, toLocal, type Half, type Handle, type Point } from './hit';

type Drag =
  | { kind: 'move'; id: string; start: Point; from: Point }
  | { kind: 'tail'; id: string }
  | { kind: 'corner'; id: string; sx: 1 | -1; sy: 1 | -1 }
  | { kind: 'scale'; id: string; startDist: number; style: Layer['style'] };

export function useCanvasEditing(overlay: RefObject<HTMLCanvasElement | null>, halves: RefObject<Map<string, Half>>, scene: Pick<Scene, 'width' | 'height'>, cssScale: number) {
  const drag = useRef<Drag | null>(null);
  const store = useTextEditor;
  const handleRadius = (HANDLE_PX * 1.6) / cssScale;

  const imagePoint = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = overlay.current!.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * scene.width, y: ((e.clientY - rect.top) / rect.height) * scene.height };
    },
    [overlay, scene.width, scene.height],
  );

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const p = imagePoint(e);
    const s = store.getState();
    const selected = s.scene.layers.find((l) => l.id === s.selectedId);
    const selectedHalf = selected && halves.current.get(selected.id);
    let handle: Handle | null = null;
    if (selected && selectedHalf && !selected.locked && selected.visible) handle = handleAt(selected, selectedHalf, p, handleRadius);
    if (selected && handle) {
      s.checkpoint();
      if (handle.kind === 'tail') drag.current = { kind: 'tail', id: selected.id };
      else if (selected.type === 'bubble') drag.current = { kind: 'corner', id: selected.id, sx: handle.sx, sy: handle.sy };
      else drag.current = { kind: 'scale', id: selected.id, startDist: Math.max(1, Math.hypot(p.x - selected.x, p.y - selected.y)), style: selected.style };
    } else {
      const hit = layerAt(s.scene.layers, halves.current, p);
      s.select(hit?.id ?? null);
      if (hit) {
        s.checkpoint();
        drag.current = { kind: 'move', id: hit.id, start: p, from: { x: hit.x, y: hit.y } };
      }
    }
    if (drag.current) overlay.current!.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    const p = imagePoint(e);
    const s = store.getState();
    if (!d) {
      const sel = s.scene.layers.find((l) => l.id === s.selectedId);
      const half = sel && halves.current.get(sel.id);
      const over = sel && half && !sel.locked ? handleAt(sel, half, p, handleRadius) : null;
      overlay.current!.style.cursor = over ? (over.kind === 'tail' ? 'crosshair' : 'nwse-resize') : layerAt(s.scene.layers, halves.current, p) ? 'move' : 'default';
      return;
    }
    const layer = s.scene.layers.find((l) => l.id === d.id);
    if (!layer) return;
    if (d.kind === 'move') {
      s.update(d.id, { x: Math.round(d.from.x + p.x - d.start.x), y: Math.round(d.from.y + p.y - d.start.y) }, { live: true });
    } else if (d.kind === 'tail' && layer.type === 'bubble') {
      const local = toLocal(layer, p);
      s.update(d.id, { tail: { ...layer.tail, x: Math.round(local.x), y: Math.round(local.y) } }, { live: true });
    } else if (d.kind === 'corner' && layer.type === 'bubble') {
      const local = toLocal(layer, p);
      s.update(d.id, { width: Math.max(40, Math.round(Math.abs(local.x) * 2)), height: Math.max(40, Math.round(Math.abs(local.y) * 2)) }, { live: true });
    } else if (d.kind === 'scale') {
      const k = Math.hypot(p.x - layer.x, p.y - layer.y) / d.startDist;
      s.update(d.id, { style: scaleStyle(d.style, Math.max(0.05, k)) }, { live: true });
    }
  };

  const endDrag = (e: PointerEvent) => {
    if (drag.current && overlay.current?.hasPointerCapture(e.pointerId)) overlay.current.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  const nudge = (dx: number, dy: number) => (e: KeyboardEvent) => {
    const s = store.getState();
    const layer = s.scene.layers.find((l) => l.id === s.selectedId);
    if (!layer || layer.locked) return;
    const step = e.shiftKey ? 10 : 1;
    s.update(layer.id, { x: layer.x + dx * step, y: layer.y + dy * step }, { key: `nudge-${layer.id}` });
  };
  useHotkey(['arrowleft', 'shift+arrowleft'], nudge(-1, 0));
  useHotkey(['arrowright', 'shift+arrowright'], nudge(1, 0));
  useHotkey(['arrowup', 'shift+arrowup'], nudge(0, -1));
  useHotkey(['arrowdown', 'shift+arrowdown'], nudge(0, 1));
  useHotkey('delete', () => {
    const s = store.getState();
    if (s.selectedId) s.remove(s.selectedId);
  });
  useHotkey('mod+d', () => {
    const s = store.getState();
    if (s.selectedId) s.duplicate(s.selectedId);
  });
  useHotkey('mod+z', () => store.getState().undo());
  useHotkey(['mod+shift+z', 'mod+y'], () => store.getState().redo());

  return { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag };
}
