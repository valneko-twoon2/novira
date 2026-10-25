// InvokeAI v6 canvas toolbar: tools, width, color | zoom, undo/redo, save (to the gallery, or as a layered PSD), settings.
import { ArrowClockwise, ArrowCounterClockwise, FileArrowDown, FloppyDisk } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { Divider, IconButton, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { saveCanvasAsPsd, saveCanvasToGallery } from '../actions';
import { BrushWidth } from './BrushWidth';
import { CanvasSettingsMenu } from './CanvasSettingsMenu';
import { BucketTolerance } from './BucketTolerance';
import { FillColor } from './FillColor';
import { PoseControls } from './PoseControls';
import { RasterFilterMenu } from './RasterFilterMenu';
import { ToolChooser } from './ToolChooser';
import { ZoomControls } from './ZoomControls';

export function CanvasToolbar() {
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const store = useCanvasStoreApi();
  return (
    <div className="canvas-toolbar">
      <ToolChooser />
      <Divider vertical />
      <FillColor />
      <BrushWidth />
      <BucketTolerance />
      <RasterFilterMenu />
      <PoseControls />
      <span className="canvas-toolbar__spacer" />
      <ZoomControls />
      <Divider vertical />
      <div className="canvas-toolbar__group">
        <IconButton size={TOOLBAR_BUTTON_SIZE}
          label={`${t('canvas.toolbar.undo')} (Ctrl+Z)`}
          icon={<ArrowCounterClockwise />}
          disabled={!canUndo}
          onClick={() => store.getState().undo()}
          data-testid="canvas-undo"
        />
        <IconButton size={TOOLBAR_BUTTON_SIZE}
          label={`${t('canvas.toolbar.redo')} (Ctrl+Shift+Z)`}
          icon={<ArrowClockwise />}
          disabled={!canRedo}
          onClick={() => store.getState().redo()}
        />
      </div>
      <Divider vertical />
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.toolbar.saveToGallery')} icon={<FloppyDisk />} onClick={() => void saveCanvasToGallery(store)} data-testid="canvas-save" />
      <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.toolbar.savePsd')} icon={<FileArrowDown />} onClick={() => void saveCanvasAsPsd(store)} data-testid="canvas-save-psd" />
      <CanvasSettingsMenu />
    </div>
  );
}
