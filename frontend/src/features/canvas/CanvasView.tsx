// Canvas tab entry: the center canvas view and the layers panel for the right column.
import { useState } from 'react';
import type { TabName } from '@/state/ui';
import { CanvasHotkeys } from './CanvasHotkeys';
import { CanvasDropTargets } from './overlays/CanvasDropTargets';
import { CanvasEmptyHint } from './overlays/CanvasEmptyHint';
import { CanvasHud } from './overlays/CanvasHud';
import { StagingToolbar } from './overlays/StagingToolbar';
import { CanvasStage } from './stage/CanvasStage';
import { CanvasToolbar } from './toolbar/CanvasToolbar';
import './canvas.css';

export { LayersPanel } from './layers/LayersPanel';

export function CanvasView(_props: { tab?: TabName }) {
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  return (
    <div className="canvas-view" data-testid="canvas-view">
      <CanvasHotkeys />
      <CanvasToolbar />
      <div ref={setBody} className="canvas-view__body">
        <CanvasStage />
        <CanvasHud />
        <CanvasEmptyHint />
        <StagingToolbar />
        <CanvasDropTargets host={body} />
      </div>
    </div>
  );
}
