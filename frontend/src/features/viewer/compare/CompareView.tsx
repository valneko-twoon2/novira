// Image comparison: slider with a draggable divider, side-by-side, or hover to swap. One zoom / pan state drives every
// mode and both images, so they stay in sync. The second image is fitted (contained) into the first image's box.
import { useRef, useState, type PointerEvent } from 'react';
import type { ImageDTO } from '@/backend';
import { useGallery } from '@/state/gallery';
import { cx } from '@/ui';
import { boxToScreen, clamp, containIn, PIXELATED_SCALE, type Box } from '@/ui/zoomMath';
import { useZoomPan, type ZoomPan } from '../zoom/useZoomPan';
import { ViewerZoomControls } from '../zoom/ViewerZoomControls';
import { ZoomFrame } from '../zoom/ZoomFrame';
import { CompareToolbar } from './CompareToolbar';

interface Props {
  first: ImageDTO;
  second: ImageDTO;
}

interface ModeProps extends Props {
  zoom: ZoomPan;
  boxes: [Box, Box];
}

function surfaceClass(zoom: ZoomPan, extra?: string) {
  return cx('vzoom', extra, zoom.grab && 'is-grab', zoom.panning && 'is-panning');
}

function CompareImage({ image, zoom }: { image: ImageDTO; zoom: ZoomPan }) {
  return <img src={image.url} alt="" draggable={false} className={cx(zoom.view.scale >= PIXELATED_SCALE && 'is-pixelated')} />;
}

export function CompareView({ first, second }: Props) {
  const mode = useGallery((s) => s.compareMode);
  const zoom = useZoomPan({
    content: { width: first.width, height: first.height },
    resetKey: `${mode}|${first.name}|${second.name}`,
    // In slider mode a plain drag moves the divider; Space+drag and middle-button drag still pan.
    leftButtonPans: mode !== 'slider',
  });
  const firstBox: Box = { x: 0, y: 0, width: first.width, height: first.height };
  const boxes: [Box, Box] = [firstBox, containIn(second.width, second.height, firstBox)];
  const measured = zoom.stage.width > 0 && zoom.stage.height > 0;
  const props = { first, second, zoom, boxes, measured };
  return (
    <div className="vcompare" data-testid="viewer-compare">
      <CompareToolbar first={first} second={second} />
      <div className="vcompare__stage">
        {mode === 'slider' && <SliderCompare {...props} />}
        {mode === 'side-by-side' && (
          <div className="vcompare__sbs">
            {[first, second].map((img, i) => (
              // Index keys: swapping the images must not remount the surfaces.
              <div key={i} ref={zoom.surfaceRef} className={surfaceClass(zoom, 'vcompare__half')} data-testid="compare-half">
                {measured && (
                  <ZoomFrame view={zoom.view} box={boxes[i] as Box}>
                    <CompareImage image={img} zoom={zoom} />
                  </ZoomFrame>
                )}
                <span className={`vcompare__label vcompare__label--${i === 0 ? 'a' : 'b'}`}>{img.name}</span>
              </div>
            ))}
          </div>
        )}
        {mode === 'hover' && <HoverCompare {...props} />}
        <ViewerZoomControls zoom={zoom} />
      </div>
    </div>
  );
}

function SliderCompare({ first, second, zoom, boxes, measured }: ModeProps & { measured: boolean }) {
  // Divider position as a fraction of the surface width, so it stays on screen at any zoom.
  const [pos, setPos] = useState(0.5);
  const dragging = useRef(false);
  const update = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width > 0) setPos(clamp((e.clientX - r.left) / r.width, 0, 1));
  };
  const top = boxToScreen(boxes[1], zoom.view);
  const clip = top.width > 0 ? clamp((pos * zoom.stage.width - top.x) / top.width, 0, 1) * 100 : 0;
  return (
    <div
      ref={zoom.surfaceRef}
      className={surfaceClass(zoom, 'vslider')}
      onPointerDown={(e) => {
        // A pan started by the zoom gestures marks the event as handled.
        if (e.button !== 0 || e.nativeEvent.defaultPrevented) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => dragging.current && update(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      data-testid="compare-slider"
    >
      {measured && (
        <>
          <ZoomFrame view={zoom.view} box={boxes[0]}>
            <CompareImage image={first} zoom={zoom} />
          </ZoomFrame>
          <ZoomFrame view={zoom.view} box={boxes[1]} className="vslider__top" style={{ clipPath: `inset(0 0 0 ${clip}%)` }}>
            <CompareImage image={second} zoom={zoom} />
          </ZoomFrame>
        </>
      )}
      <div className="vslider__divider" style={{ left: `${pos * 100}%` }}>
        <span className="vslider__handle" />
      </div>
      <span className="vcompare__label vcompare__label--a">{first.name}</span>
      <span className="vcompare__label vcompare__label--b vcompare__label--right">{second.name}</span>
    </div>
  );
}

function HoverCompare({ first, second, zoom, boxes, measured }: ModeProps & { measured: boolean }) {
  const [hover, setHover] = useState(false);
  const img = hover ? second : first;
  return (
    <div
      ref={zoom.surfaceRef}
      className={surfaceClass(zoom)}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      data-testid="compare-hover"
    >
      {measured && (
        <ZoomFrame view={zoom.view} box={hover ? boxes[1] : boxes[0]}>
          <CompareImage image={img} zoom={zoom} />
        </ZoomFrame>
      )}
      <span className={`vcompare__label vcompare__label--${hover ? 'b' : 'a'}`}>{img.name}</span>
    </div>
  );
}
