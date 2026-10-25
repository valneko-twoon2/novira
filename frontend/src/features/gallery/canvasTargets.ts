// "Send to canvas" destinations, in InvokeAI menu order.
import type { MessageKey } from '@/i18n';
import type { CanvasImportTarget } from '@/state/canvas';

export const CANVAS_TARGETS: { target: CanvasImportTarget; label: MessageKey }[] = [
  { target: 'newCanvasRaster', label: 'gallery.canvas.newCanvasRaster' },
  { target: 'newCanvasControl', label: 'gallery.canvas.newCanvasControl' },
  { target: 'raster', label: 'gallery.canvas.raster' },
  { target: 'control', label: 'gallery.canvas.control' },
  { target: 'inpaint', label: 'gallery.canvas.inpaint' },
  { target: 'regional', label: 'gallery.canvas.regional' },
];
