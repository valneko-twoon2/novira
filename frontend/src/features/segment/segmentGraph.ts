// The ComfyUI prompt that turns a few clicks on a picture into a mask (Segment Anything 2, from the
// ComfyUI-segment-anything-2 pack), and the queue request that runs it as a hidden helper job.
import type { ComfyGraph, ComfyNodeDefs } from '@/backend';

/** The node a segmentation prompt runs; also how the app knows the pack is loaded. */
export const SEGMENT_NODE = 'Sam2Segmentation';
export const SEGMENT_MODEL = 'sam2.1_hiera_small.safetensors';

/** A click on the picture, in picture pixels. */
export interface Point {
  x: number;
  y: number;
  /** True for a part to include, false for one to leave out. */
  include: boolean;
}

const coordinates = (points: Point[]) => JSON.stringify(points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })));

/** Picture in, mask out: the mask is saved as a black-and-white picture (white = selected). */
export function buildSegmentGraph(imageName: string, points: Point[]): ComfyGraph {
  const include = points.filter((p) => p.include);
  const exclude = points.filter((p) => !p.include);
  return {
    prompt: {
      model: { class_type: 'DownloadAndLoadSAM2Model', inputs: { model: SEGMENT_MODEL, segmentor: 'single_image', device: 'cuda', precision: 'fp16' } },
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      select: {
        class_type: SEGMENT_NODE,
        inputs: {
          image: ['source', 0],
          sam2_model: ['model', 0],
          keep_model_loaded: false,
          individual_objects: false,
          coordinates_positive: coordinates(include),
          ...(exclude.length ? { coordinates_negative: coordinates(exclude) } : {}),
        },
      },
      picture: { class_type: 'MaskToImage', inputs: { mask: ['select', 0] } },
      save: { class_type: 'SaveImage', inputs: { images: ['picture', 0], filename_prefix: 'novira-mask' } },
    },
    outputs: ['save'],
  };
}

/** The node that fills a selected part from its surroundings (the comfyui-inpaint-nodes pack, catalog id `inpaintNodes`). */
export const ERASE_NODE = 'INPAINT_MaskedFill';

/** The name of an installed LaMa model (the pack lists the files of its `inpaint` model folder), or null. */
export function lamaModel(defs: ComfyNodeDefs | null): string | null {
  const spec = defs?.INPAINT_LoadInpaintModel?.input.required?.model_name;
  const choices = Array.isArray(spec) ? (Array.isArray(spec[0]) ? spec[0] : (spec[1] as { options?: unknown } | undefined)?.options) : null;
  const names = Array.isArray(choices) ? choices.map(String) : [];
  return names.find((n) => /lama/i.test(n)) ?? null;
}

/**
 * Erases the selected part of a gallery picture: the mask picture (white = selected) grows a little so the edge of the
 * object goes too, then LaMa fills it when its model is installed, and OpenCV's Telea fill otherwise.
 */
export function buildEraseGraph(imageName: string, maskName: string, options: { invert: boolean; lama: string | null }): ComfyGraph {
  const mask = options.invert ? ['flip', 0] : ['mask', 0];
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      cover: { class_type: 'LoadImage', inputs: { image: { $image: maskName } } },
      mask: { class_type: 'ImageToMask', inputs: { image: ['cover', 0], channel: 'red' } },
      ...(options.invert ? { flip: { class_type: 'InvertMask', inputs: { mask: ['mask', 0] } } } : {}),
      grow: { class_type: 'INPAINT_ExpandMask', inputs: { mask, grow: 12, blur: 6, blur_type: 'gaussian' } },
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

export interface RedrawOptions {
  /** Library key of the checkpoint that redraws the part. */
  modelKey: string;
  prompt: string;
  negative: string;
  /** How far the part may change: 0.3 keeps the shapes, 1 redraws freely. */
  strength: number;
  invert: boolean;
}

/**
 * Redraws the selected part from a text prompt with an ordinary checkpoint: the mask picture (white = selected) grows
 * a little, the part is re-sampled from the picture's own latent (so colours and shapes guide it), and the result is
 * pasted back through a softened mask so the seam does not show.
 */
export function buildRedrawGraph(imageName: string, maskName: string, o: RedrawOptions): ComfyGraph {
  const mask = o.invert ? ['flip', 0] : ['mask', 0];
  return {
    prompt: {
      ckpt: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: { $model: o.modelKey } } },
      pos: { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip: ['ckpt', 1] } },
      neg: { class_type: 'CLIPTextEncode', inputs: { text: o.negative, clip: ['ckpt', 1] } },
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      cover: { class_type: 'LoadImage', inputs: { image: { $image: maskName } } },
      mask: { class_type: 'ImageToMask', inputs: { image: ['cover', 0], channel: 'red' } },
      ...(o.invert ? { flip: { class_type: 'InvertMask', inputs: { mask: ['mask', 0] } } } : {}),
      grow: { class_type: 'GrowMask', inputs: { mask, expand: 12, tapered_corners: true } },
      soft: { class_type: 'MaskToImage', inputs: { mask: ['grow', 0] } },
      blur: { class_type: 'ImageBlur', inputs: { image: ['soft', 0], blur_radius: 9, sigma: 4 } },
      feather: { class_type: 'ImageToMask', inputs: { image: ['blur', 0], channel: 'red' } },
      encode: { class_type: 'VAEEncode', inputs: { pixels: ['source', 0], vae: ['ckpt', 2] } },
      limit: { class_type: 'SetLatentNoiseMask', inputs: { samples: ['encode', 0], mask: ['grow', 0] } },
      sample: {
        class_type: 'KSampler',
        inputs: {
          model: ['ckpt', 0],
          positive: ['pos', 0],
          negative: ['neg', 0],
          latent_image: ['limit', 0],
          seed: { $seed: true },
          steps: 28,
          cfg: 6,
          sampler_name: { $sampler_name: 'dpmpp_2m_k' },
          scheduler: { $scheduler: 'dpmpp_2m_k' },
          denoise: o.strength,
        },
      },
      decode: { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['ckpt', 2] } },
      paste: { class_type: 'ImageCompositeMasked', inputs: { destination: ['source', 0], source: ['decode', 0], x: 0, y: 0, resize_source: false, mask: ['feather', 0] } },
      save: { class_type: 'SaveImage', inputs: { images: ['paste', 0], filename_prefix: 'novira-redraw' } },
    },
    outputs: ['save'],
  };
}
