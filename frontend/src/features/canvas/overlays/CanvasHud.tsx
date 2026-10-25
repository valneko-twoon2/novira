// Heads-up display at the top-left of the stage: bbox size and position, zoom, layer count.
import { t } from '@/i18n';
import { useCanvasStore } from '@/state/canvasStoreContext';

export function CanvasHud() {
  const show = useCanvasStore((s) => s.settings.showHud);
  const bbox = useCanvasStore((s) => s.bbox);
  const scale = useCanvasStore((s) => s.viewport.scale);
  const count = useCanvasStore((s) => s.entities.length);
  if (!show) return null;
  return (
    <div className="canvas-hud" data-testid="canvas-hud">
      <span className="canvas-hud__key">{t('canvas.hud.bbox')}</span>
      <span>
        {bbox.width} × {bbox.height}
      </span>
      <span className="canvas-hud__key">{t('canvas.hud.position')}</span>
      <span>
        {bbox.x}, {bbox.y}
      </span>
      <span className="canvas-hud__key">{t('canvas.hud.scaled')}</span>
      <span>
        {Math.round(bbox.width * scale)} × {Math.round(bbox.height * scale)}
      </span>
      <span className="canvas-hud__key">{t('canvas.hud.zoom')}</span>
      <span>{Math.round(scale * 100)}%</span>
      <span className="canvas-hud__key">{t('canvas.hud.layers')}</span>
      <span>{count}</span>
    </div>
  );
}
