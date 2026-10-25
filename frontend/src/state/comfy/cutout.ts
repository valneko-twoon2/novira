// The ComfyUI prompt that removes the background of a picture: the RMBG node (ComfyUI-RMBG pack, catalog id `rmbg`)
// finds the subject and returns the picture with a transparent (or plain white) background.
import type { ComfyGraph, ComfyNodeDefs } from '@/backend';

/** The node a cutout prompt runs; also how the app knows the pack is loaded. */
export const CUTOUT_NODE = 'RMBG';

/** Models the pack offers, best first: the ones named here lead, the rest keep the pack's order. */
const PREFERRED = ['RMBG-2.0', 'INSPYRENET', 'BEN2'];

/** The model names the loaded node lists (empty while the pack is not loaded). */
export function cutoutModels(defs: ComfyNodeDefs | null): string[] {
  const spec = defs?.[CUTOUT_NODE]?.input.required?.model;
  const choices = Array.isArray(spec) ? (Array.isArray(spec[0]) ? spec[0] : (spec[1] as { options?: unknown } | undefined)?.options) : null;
  const names = Array.isArray(choices) ? choices.map(String) : [];
  const rank = (n: string) => {
    const i = PREFERRED.indexOf(n);
    return i < 0 ? PREFERRED.length : i;
  };
  return [...names].sort((a, b) => rank(a) - rank(b));
}

export interface CutoutOptions {
  /** A name from `cutoutModels`. */
  model: string;
  /** How strictly the subject is separated: 1 keeps only what the model is sure of, lower keeps more. */
  sensitivity: number;
  /** Grows (positive) or shrinks (negative) the edge of the subject, in pixels. */
  edge: number;
  /** What replaces the background: nothing (transparent) or plain white. */
  background: 'alpha' | 'white';
}

/** Picture in, the same picture without its background out (transparent: a PNG with an alpha channel). */
export function buildCutoutGraph(imageName: string, o: CutoutOptions): ComfyGraph {
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      cut: {
        class_type: CUTOUT_NODE,
        inputs: {
          image: ['source', 0],
          model: o.model,
          sensitivity: o.sensitivity,
          process_res: 1024,
          mask_blur: 0,
          mask_offset: o.edge,
          invert_output: false,
          refine_foreground: false,
          ...(o.background === 'white' ? { background: 'Color', background_color: '#FFFFFF' } : { background: 'Alpha' }),
        },
      },
      save: { class_type: 'SaveImage', inputs: { images: ['cut', 0], filename_prefix: 'novira-cutout' } },
    },
    outputs: ['save'],
  };
}
