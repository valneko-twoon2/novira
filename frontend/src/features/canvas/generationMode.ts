// Generation mode of a canvas invocation, derived from raster coverage of the bbox and inpaint masks.
import type { GenerationMode } from '@/backend';
import type { Coverage } from './geometry';

export function pickGenerationMode(coverage: Coverage, hasMask: boolean): GenerationMode {
  if (coverage === 'empty') return 'txt2img';
  if (coverage === 'partial') return 'outpaint';
  return hasMask ? 'inpaint' : 'img2img';
}
