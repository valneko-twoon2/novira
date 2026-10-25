// Small preview of an entity's content rendered into a canvas.
import { useEffect, useRef, useState } from 'react';
import { type CanvasEntity } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { renderEntity } from '@/ui/canvasDraw/entityRender';
import { onImageLoaded } from '@/ui/canvasDraw/imageCache';

const SIZE = 36;

export function EntityThumbnail({ entity }: { entity: CanvasEntity }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const preview = useCanvasStore((s) => s.filterPreviews[entity.id]);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => onImageLoaded(() => setLoaded((n) => n + 1)), []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = SIZE * dpr;
    c.height = SIZE * dpr;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, c.width, c.height);
    const r = renderEntity(entity, { preview });
    if (!r) return;
    const s = Math.min((SIZE * dpr) / r.width, (SIZE * dpr) / r.height);
    const w = r.width * s;
    const h = r.height * s;
    ctx.globalAlpha = entity.type === 'inpaint' || entity.type === 'regional' ? 1 : entity.opacity;
    ctx.drawImage(r.canvas, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }, [entity, preview, loaded]);
  return <canvas ref={ref} className="canvas-thumb" style={{ width: SIZE, height: SIZE }} aria-hidden />;
}
