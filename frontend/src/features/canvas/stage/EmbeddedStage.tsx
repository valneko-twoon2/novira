// The stage laid over a document its host shows itself (a comic page), on the surrounding canvas store. `EmbeddedStage`
// covers the document as shown and takes the pointer: it draws the chrome (masks, bbox, cursor) and paints with the
// store's tools. `EmbeddedStageContent` is the canvas the host puts in its own layer stack where the selected layer lies;
// the stage draws that layer and the stroke being drawn there. The two find each other through the store.
import { useEffect, useRef } from 'react';
import type { CanvasStore, Rect } from '@/state/canvas';
import { useCanvasStoreApi } from '@/state/canvasStoreContext';
import { StageController } from './StageController';
import '../canvas.css';

const contents = new WeakMap<CanvasStore, HTMLCanvasElement>();
const listeners = new WeakMap<CanvasStore, Set<() => void>>();

const tell = (store: CanvasStore) => listeners.get(store)?.forEach((l) => l());

/** The content canvas shown for a store now, if any. */
const contentCanvas = (store: CanvasStore): HTMLCanvasElement | null => contents.get(store) ?? null;

function onContent(store: CanvasStore, fn: () => void): () => void {
  let set = listeners.get(store);
  if (!set) {
    set = new Set();
    listeners.set(store, set);
  }
  set.add(fn);
  return () => set.delete(fn);
}

/**
 * The stage over the host's document of `docWidth` × `docHeight` pixels; place it over the document as it is shown. With
 * `limitBbox` the box tool works too, and the generation box is kept to what it returns.
 */
export function EmbeddedStage({ docWidth, docHeight, limitBbox }: { docWidth: number; docHeight: number; limitBbox?: (box: Rect) => Rect }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<StageController | null>(null);
  const size = useRef({ width: docWidth, height: docHeight });
  size.current = { width: docWidth, height: docHeight };
  const limit = useRef(limitBbox);
  limit.current = limitBbox;
  const limited = !!limitBbox;
  const store = useCanvasStoreApi();
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const controller = new StageController(canvas, host, store, {
      docSize: () => size.current,
      content: () => contentCanvas(store),
      ...(limited ? { limitBbox: (box: Rect) => limit.current?.(box) ?? box } : {}),
    });
    controllerRef.current = controller;
    controller.start();
    const off = onContent(store, () => controller.invalidate());
    return () => {
      off();
      controller.dispose();
      controllerRef.current = null;
    };
  }, [store, limited]);
  useEffect(() => controllerRef.current?.invalidate(), [docWidth, docHeight]);
  return (
    <div ref={hostRef} className="canvas-embedded">
      <canvas ref={canvasRef} className="canvas-embedded__chrome" data-testid="canvas-embedded-stage" />
    </div>
  );
}

/** The canvas that shows the selected layer of the surrounding store inside the host's layer stack. */
export function EmbeddedStageContent() {
  const ref = useRef<HTMLCanvasElement>(null);
  const store = useCanvasStoreApi();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    contents.set(store, el);
    tell(store);
    return () => {
      if (contents.get(store) === el) contents.delete(store);
      tell(store);
    };
  }, [store]);
  return <canvas ref={ref} className="canvas-embedded__content" aria-hidden="true" data-testid="canvas-embedded-content" />;
}
