// Canvas zoom group: the shared zoom controls driving the canvas viewport, plus bbox and reset-view menu items.
import { t } from '@/i18n';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { chordLabel, MenuItem, ZOOM_HOTKEYS, ZoomControls as SharedZoomControls } from '@/ui';
import { fitBbox, resetView, zoomStep, zoomTo } from '../view';

export function ZoomControls() {
  const scale = useCanvasStore((s) => s.viewport.scale);
  const store = useCanvasStoreApi();
  return (
    <SharedZoomControls
      className="canvas-toolbar__group"
      scale={scale}
      onZoomIn={() => zoomStep(1, store)}
      onZoomOut={() => zoomStep(-1, store)}
      onZoomTo={(scale) => zoomTo(scale, store)}
      onFit={() => resetView(store)}
      fitLabel={t('canvas.toolbar.resetView')}
      testId="canvas-zoom"
      menuItems={
        <>
          <MenuItem onSelect={() => fitBbox(store)}>{t('canvas.toolbar.fitBbox')}</MenuItem>
          <MenuItem onSelect={() => resetView(store)} shortcut={chordLabel(ZOOM_HOTKEYS.fit)}>
            {t('canvas.toolbar.resetView')}
          </MenuItem>
        </>
      }
    />
  );
}
