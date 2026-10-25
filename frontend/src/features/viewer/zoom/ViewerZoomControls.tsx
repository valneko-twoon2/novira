// Floating zoom controls at the bottom right of the viewer stage (the canvas toolbar's zoom group).
import { t } from '@/i18n';
import { chordLabel, MenuItem, ZOOM_HOTKEYS, ZoomControls } from '@/ui';
import type { ZoomPan } from './useZoomPan';

export function ViewerZoomControls({ zoom }: { zoom: ZoomPan }) {
  return (
    <div className="vzoom-controls">
      <ZoomControls
        scale={zoom.view.scale}
        onZoomIn={zoom.zoomIn}
        onZoomOut={zoom.zoomOut}
        onZoomTo={(s) => zoom.zoomTo(s)}
        onFit={zoom.fit}
        fitLabel={t('gallery.viewer.zoomFit')}
        onActualSize={zoom.actualSize}
        testId="viewer-zoom"
        menuItems={
          <MenuItem onSelect={zoom.fit} shortcut={chordLabel(ZOOM_HOTKEYS.fit)}>
            {t('gallery.viewer.zoomFit')}
          </MenuItem>
        }
      />
    </div>
  );
}
