// The name a comic page's raster layer is shown with: the name the user gave it, else the screen's word for a slot (the
// panels, the balloons), else the Canvas's default name with the layer's number ("Raster Layer 2").
import { t } from '@/i18n';
import type { RasterEntity } from '../canvas';
import { BALLOONS_SLOT, PANELS_SLOT } from './pageCanvasDoc';

/** The screen's words for the page's slots, as the Canvas layers panel labels them. */
export const slotLabels = (): Record<string, string> => ({ [PANELS_SLOT]: t('comic.layers.panels'), [BALLOONS_SLOT]: t('comic.layers.balloons') });

export function layerName(e: RasterEntity): string {
  if (e.name) return e.name;
  if (e.slot) return slotLabels()[e.slot] ?? e.slot;
  return t('canvas.entity.defaultName.raster', { number: e.seq });
}
