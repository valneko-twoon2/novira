// The CSS colour string of a canvas RGBA colour, used wherever layers are drawn.
import type { RGBA } from '@/state/canvas';

export const rgbaCss = (c: RGBA, alpha = c.a) => `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
