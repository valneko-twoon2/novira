// Hint shown over an empty canvas.
import { t } from '@/i18n';
import { useCanvasStore } from '@/state/canvasStoreContext';

export function CanvasEmptyHint() {
  const empty = useCanvasStore((s) => s.entities.length === 0 && s.stagedImageNames.length === 0);
  if (!empty) return null;
  return (
    <div className="canvas-empty" data-testid="canvas-empty">
      <div className="canvas-empty__title">{t('canvas.empty.title')}</div>
      <div className="canvas-empty__desc">{t('canvas.empty.description')}</div>
    </div>
  );
}
