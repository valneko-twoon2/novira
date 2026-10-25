// Tool buttons of the canvas toolbar (brush, eraser, mosaic, rect, lasso, pose, move, bbox, view, color picker, bucket).
import { ArrowsOutCardinal, BoundingBox, Eraser, Eyedropper, GridFour, Hand, Lasso, PaintBrush, PaintBucket, PersonSimple, Rectangle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { type Tool } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { IconButton, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { TOOL_LABEL } from '../names';

const TOOLS: { tool: Tool; icon: ReactNode; key: string }[] = [
  { tool: 'brush', icon: <PaintBrush />, key: 'B' },
  { tool: 'eraser', icon: <Eraser />, key: 'E' },
  { tool: 'mosaic', icon: <GridFour />, key: 'M' },
  { tool: 'rect', icon: <Rectangle />, key: 'U' },
  { tool: 'lasso', icon: <Lasso />, key: 'L' },
  { tool: 'pose', icon: <PersonSimple />, key: 'O' },
  { tool: 'move', icon: <ArrowsOutCardinal />, key: 'V' },
  { tool: 'bbox', icon: <BoundingBox />, key: 'C' },
  { tool: 'view', icon: <Hand />, key: 'H' },
  { tool: 'colorPicker', icon: <Eyedropper />, key: 'I' },
  { tool: 'bucket', icon: <PaintBucket />, key: 'G' },
];

/** The tool buttons; `tools` narrows them to the ones a host offers (all by default). */
export function ToolChooser({ tools }: { tools?: readonly Tool[] }) {
  const tool = useCanvasStore((s) => s.tool);
  const setTool = useCanvasStore((s) => s.setTool);
  return (
    <div className="canvas-toolbar__group" role="toolbar" aria-label={t('canvas.toolbar.tools')}>
      {TOOLS.filter((x) => !tools || tools.includes(x.tool)).map((x) => (
        <IconButton size={TOOLBAR_BUTTON_SIZE}
          key={x.tool}
          label={`${t(TOOL_LABEL[x.tool])} (${x.key})`}
          icon={x.icon}
          isActive={tool === x.tool}
          variant={tool === x.tool ? 'solid' : 'ghost'}
          scheme={tool === x.tool ? 'accent' : 'base'}
          data-testid={`canvas-tool-${x.tool}`}
          onClick={() => setTool(x.tool)}
        />
      ))}
    </div>
  );
}
