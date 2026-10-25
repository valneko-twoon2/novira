// The bucket's tolerance: how far a colour may differ from the pressed pixel's and still be filled (shown for the bucket tool).
import { t } from '@/i18n';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { NumberInput } from '@/ui';
import '../canvas.css';

export function BucketTolerance() {
  const tool = useCanvasStore((s) => s.tool);
  const tolerance = useCanvasStore((s) => s.bucketTolerance);
  const setTolerance = useCanvasStore((s) => s.setBucketTolerance);
  if (tool !== 'bucket') return null;
  return (
    <div className="canvas-width">
      <span className="canvas-width__label">{t('canvas.toolbar.bucketTolerance')}</span>
      <NumberInput value={tolerance} onChange={setTolerance} min={0} max={255} className="canvas-width__input" aria-label={t('canvas.toolbar.bucketTolerance')} />
    </div>
  );
}
