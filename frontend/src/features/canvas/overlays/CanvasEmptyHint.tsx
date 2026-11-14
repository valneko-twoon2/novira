// Hint shown over an empty canvas.
import { t } from '@/i18n';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { EmptyOverlay } from '@/ui';

export function CanvasEmptyHint() {
  const empty = useCanvasStore((s) => s.entities.length === 0 && s.stagedImageNames.length === 0);
  if (!empty) return null;
  return <EmptyOverlay title={t('canvas.empty.title')} description={t('canvas.empty.description')} data-testid="canvas-empty" />;
}
