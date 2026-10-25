// A still image in the viewer that can be zoomed and panned like the canvas, with its zoom controls.
import type { ImageDTO } from '@/backend';
import { cx } from '@/ui';
import { PIXELATED_SCALE } from '@/ui/zoomMath';
import { useZoomPan } from './zoom/useZoomPan';
import { ViewerZoomControls } from './zoom/ViewerZoomControls';
import { ZoomFrame } from './zoom/ZoomFrame';

export function ZoomableImage({ image }: { image: ImageDTO }) {
  const zoom = useZoomPan({ content: { width: image.width, height: image.height }, resetKey: image.name });
  const measured = zoom.stage.width > 0 && zoom.stage.height > 0;
  return (
    <>
      <div ref={zoom.surfaceRef} className={cx('vzoom', zoom.grab && 'is-grab', zoom.panning && 'is-panning')} data-testid="viewer-zoom-surface">
        {measured && (
          <ZoomFrame view={zoom.view} box={{ x: 0, y: 0, width: image.width, height: image.height }}>
            <img src={image.url} alt="" draggable={false} className={cx(zoom.view.scale >= PIXELATED_SCALE && 'is-pixelated')} data-testid="viewer-image" />
          </ZoomFrame>
        )}
      </div>
      <ViewerZoomControls zoom={zoom} />
    </>
  );
}
