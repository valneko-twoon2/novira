// Keeps the editor's two canvases (the scene, and the selection overlay) in step with the scene: loads the background
// picture and the fonts the layers use, draws, and remembers each layer's size for hit-testing.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { loadImage } from '@/backend';
import { useGallery } from '@/state/gallery';
import type { Scene } from '@/state/text/textModel';
import { checkerboard, measureCtx, paintSelection } from './canvasDraw';
import { ensureFont } from '@/state/fonts';
import type { Half } from './hit';
import { layerHalfSize, renderScene } from './render';

export interface ScenePreview {
  /** The background picture once loaded. */
  base: HTMLImageElement | null;
  /** Half size of every layer as drawn last, for hit-testing. */
  halves: RefObject<Map<string, Half>>;
}

export function useScenePreview(
  scene: Scene,
  selectedId: string | null,
  cssScale: number,
  canvas: RefObject<HTMLCanvasElement | null>,
  overlay: RefObject<HTMLCanvasElement | null>,
): ScenePreview {
  const halves = useRef(new Map<string, Half>());
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [fontsTick, setFontsTick] = useState(0);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  // Background picture.
  const backgroundName = scene.background.kind === 'image' ? scene.background.imageName : null;
  const backgroundUrl = useGallery((s) => (backgroundName ? (s.images.find((i) => i.name === backgroundName)?.url ?? null) : null));
  useEffect(() => {
    let alive = true;
    if (!backgroundUrl) {
      setBase(null);
      return;
    }
    void loadImage(backgroundUrl).then(
      (img) => alive && setBase(img),
      () => alive && setBase(null),
    );
    return () => {
      alive = false;
    };
  }, [backgroundUrl]);

  // Fonts: load what the layers use (Fontsource splits Japanese fonts by character range), then draw again.
  const fontKey = useMemo(() => scene.layers.map((l) => `${l.style.fontFamily}|${l.style.fontWeight}|${l.text}`).join('\n'), [scene.layers]);
  useEffect(() => {
    let alive = true;
    void Promise.all(scene.layers.map((l) => ensureFont(l.style.fontFamily, l.style.fontWeight, l.text))).then(() => alive && setFontsTick((n) => n + 1));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontKey stands for the layers' fonts and texts
  }, [fontKey]);

  // Draw the scene and the selection.
  useEffect(() => {
    const c = canvas.current;
    const o = overlay.current;
    if (!c || !o) return;
    const w = Math.max(1, Math.round(scene.width * cssScale * dpr));
    const h = Math.max(1, Math.round(scene.height * cssScale * dpr));
    for (const el of [c, o]) {
      if (el.width !== w) el.width = w;
      if (el.height !== h) el.height = h;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const transparent = scene.background.kind === 'color' && !scene.background.color;
    const noPicture = scene.background.kind === 'image' && !base;
    renderScene(ctx, scene, base, cssScale * dpr, transparent || noPicture ? checkerboard : undefined);
    const mctx = measureCtx();
    halves.current = new Map(scene.layers.map((l) => [l.id, layerHalfSize(mctx, l)]));

    const octx = o.getContext('2d');
    if (!octx) return;
    octx.clearRect(0, 0, w, h);
    const layer = scene.layers.find((l) => l.id === selectedId);
    const half = layer && halves.current.get(layer.id);
    if (layer && half && layer.visible) paintSelection(octx, layer, half, cssScale, dpr);
  }, [scene, base, cssScale, dpr, selectedId, fontsTick, canvas, overlay]);

  return { base, halves };
}
