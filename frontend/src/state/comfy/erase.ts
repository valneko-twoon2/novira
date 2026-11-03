// The ComfyUI prompt that erases a part of a picture: the part is filled from its surroundings by the
// comfyui-inpaint-nodes pack (catalog id `inpaintNodes`), with LaMa when its model is installed.
import type { ComfyGraph, ComfyNodeDefs } from '@/backend';

/** The node that fills a part from its surroundings; also how the app knows the pack is loaded. */
export const ERASE_NODE = 'INPAINT_MaskedFill';

/** The catalog id of the pack that has `ERASE_NODE`. */
export const ERASE_PACK = 'inpaintNodes';

/** The name of an installed LaMa model (the pack lists the files of its `inpaint` model folder), or null. */
export function lamaModel(defs: ComfyNodeDefs | null): string | null {
  const spec = defs?.INPAINT_LoadInpaintModel?.input.required?.model_name;
  const choices = Array.isArray(spec) ? (Array.isArray(spec[0]) ? spec[0] : (spec[1] as { options?: unknown } | undefined)?.options) : null;
  const names = Array.isArray(choices) ? choices.map(String) : [];
  return names.find((n) => /lama/i.test(n)) ?? null;
}

/**
 * Erases the part of a picture that a mask picture marks (white = erase): the mask grows a little so the edge of the
 * object goes too, then LaMa fills it when its model is installed, and OpenCV's Telea fill otherwise.
 */
export function buildEraseGraph(imageName: string, maskName: string, options: { lama: string | null }): ComfyGraph {
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      cover: { class_type: 'LoadImage', inputs: { image: { $image: maskName } } },
      mask: { class_type: 'ImageToMask', inputs: { image: ['cover', 0], channel: 'red' } },
      grow: { class_type: 'INPAINT_ExpandMask', inputs: { mask: ['mask', 0], grow: 12, blur: 6, blur_type: 'gaussian' } },
      ...(options.lama
        ? {
            model: { class_type: 'INPAINT_LoadInpaintModel', inputs: { model_name: options.lama } },
            fill: { class_type: 'INPAINT_InpaintWithModel', inputs: { image: ['source', 0], mask: ['grow', 0], inpaint_model: ['model', 0], seed: 0 } },
          }
        : { fill: { class_type: ERASE_NODE, inputs: { image: ['source', 0], mask: ['grow', 0], fill: 'telea', falloff: 0 } } }),
      save: { class_type: 'SaveImage', inputs: { images: ['fill', 0], filename_prefix: 'novira-erase' } },
    },
    outputs: ['save'],
  };
}
