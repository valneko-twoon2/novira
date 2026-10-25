// The ComfyUI prompts of the operations the batch dialog runs on each picture. One prompt per picture; the queue
// runs them one after another and each result lands on the board of its source.
import type { ComfyGraph } from '@/backend';

export type BatchOp = 'removeBackground' | 'upscale';
export const BATCH_OPS: BatchOp[] = ['removeBackground', 'upscale'];

/** The node of the background-removal pack (ComfyUI-RMBG, catalog id `rmbg`). */
export const RMBG_NODE = 'RMBG';
export const RMBG_PACK = 'rmbg';

/** Keeps the subject and makes the rest transparent. */
export function removeBackgroundGraph(imageName: string): ComfyGraph {
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      cut: {
        class_type: RMBG_NODE,
        inputs: {
          image: ['source', 0],
          model: 'INSPYRENET',
          sensitivity: 1,
          process_res: 1024,
          mask_blur: 0,
          mask_offset: 0,
          invert_output: false,
          refine_foreground: false,
          unload_model: false,
          background: 'Alpha',
          background_color: '#222222',
        },
      },
      save: { class_type: 'SaveImage', inputs: { images: ['cut', 0], filename_prefix: 'novira-cutout' } },
    },
    outputs: ['save'],
  };
}

/** Enlarges by the factor the upscale model of the library was made for (usually 2 or 4). */
export function upscaleGraph(imageName: string, modelKey: string): ComfyGraph {
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      model: { class_type: 'UpscaleModelLoader', inputs: { model_name: { $model: modelKey } } },
      scale: { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['model', 0], image: ['source', 0] } },
      save: { class_type: 'SaveImage', inputs: { images: ['scale', 0], filename_prefix: 'novira-upscale' } },
    },
    outputs: ['save'],
  };
}
