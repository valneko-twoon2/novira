// The painting part of the canvas toolbar, for a host that paints on its own document (a comic page) with the surrounding
// canvas store: the painting tools, the fill colour, the brush width, the filter button, and the store's undo and redo.
import { ArrowClockwise, ArrowCounterClockwise } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { Tool } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { Divider, IconButton, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { BrushWidth } from './BrushWidth';
import { BucketTolerance } from './BucketTolerance';
import { FillColor } from './FillColor';
import { RasterFilterMenu } from './RasterFilterMenu';
import { ToolChooser } from './ToolChooser';
import '../canvas.css';

/** The tools that paint on a layer, and the box tool for inpainting: no pose or view tool. */
export const PAINT_TOOLS: readonly Tool[] = ['brush', 'eraser', 'mosaic', 'rect', 'lasso', 'move', 'bbox', 'colorPicker', 'bucket'];

export function PaintToolbar() {
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const store = useCanvasStoreApi();
  return (
    <div className="canvas-paint-tools" data-testid="canvas-paint-tools">
      <ToolChooser tools={PAINT_TOOLS} />
      <Divider vertical />
      <FillColor />
      <BrushWidth />
      <BucketTolerance />
      <Divider vertical />
      <RasterFilterMenu />
      <IconButton
        size={TOOLBAR_BUTTON_SIZE}
        label={`${t('canvas.toolbar.undo')} (Ctrl+Z)`}
        icon={<ArrowCounterClockwise />}
        disabled={!canUndo}
        onClick={() => store.getState().undo()}
        data-testid="canvas-undo"
      />
      <IconButton
        size={TOOLBAR_BUTTON_SIZE}
        label={`${t('canvas.toolbar.redo')} (Ctrl+Shift+Z)`}
        icon={<ArrowClockwise />}
        disabled={!canRedo}
        onClick={() => store.getState().redo()}
        data-testid="canvas-redo"
      />
    </div>
  );
}
