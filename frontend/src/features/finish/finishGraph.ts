// The ComfyUI prompt that finishes a clip: more frames in between (frame interpolation, the Frame Interpolation pack)
// and/or a larger picture (an upscale model of the library). Only core nodes are used besides the pack's RIFE node.
import type { ComfyGraph, ComfyNodeDefs } from '@/backend';

/** The pack's node and its catalog id. */
export const RIFE_NODE = 'RIFE VFI';
export const RIFE_PACK = 'frameInterpolation';

export interface FinishOptions {
  /** Doubles the frames, so the motion is smoother. */
  smooth: boolean;
  /** Makes every frame twice as large, with the library's upscale model of this key. */
  upscale: { modelKey: string } | null;
}

export interface ClipInfo {
  /** Gallery name of the video. */
  name: string;
  width: number;
  height: number;
  fps: number;
}

type Inputs = Record<string, unknown>;

/** Keeps only the inputs the installed node has, so a newer or older pack version does not refuse the prompt. */
function knownInputs(inputs: Inputs, def: ComfyNodeDefs[string] | undefined): Inputs {
  if (!def) return inputs;
  const has = new Set([...Object.keys(def.input.required ?? {}), ...Object.keys(def.input.optional ?? {})]);
  return Object.fromEntries(Object.entries(inputs).filter(([k]) => has.has(k)));
}

export function finishGraph(clip: ClipInfo, o: FinishOptions, defs?: ComfyNodeDefs): ComfyGraph {
  const prompt: ComfyGraph['prompt'] = {
    load: { class_type: 'LoadVideo', inputs: { file: { $image: clip.name } } },
    parts: { class_type: 'GetVideoComponents', inputs: { video: ['load', 0] } },
  };
  let frames: [string, number] = ['parts', 0];
  let fps = clip.fps;
  if (o.smooth) {
    prompt.smooth = {
      class_type: RIFE_NODE,
      inputs: knownInputs(
        { ckpt_name: 'rife49.pth', frames, clear_cache_after_n_frames: 10, multiplier: 2, fast_mode: true, ensemble: true, scale_factor: 1, dtype: 'float16', torch_compile: false, batch_size: 1 },
        defs?.[RIFE_NODE],
      ),
    };
    frames = ['smooth', 0];
    fps *= 2;
  }
  if (o.upscale) {
    prompt.model = { class_type: 'UpscaleModelLoader', inputs: { model_name: { $model: o.upscale.modelKey } } };
    prompt.enlarge = { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['model', 0], image: frames } };
    // The model's own factor (2 or 4) is brought to exactly twice the clip.
    prompt.fit = { class_type: 'ImageScale', inputs: { image: ['enlarge', 0], upscale_method: 'lanczos', width: clip.width * 2, height: clip.height * 2, crop: 'disabled' } };
    frames = ['fit', 0];
  }
  prompt.video = { class_type: 'CreateVideo', inputs: { images: frames, fps } };
  prompt.save = { class_type: 'SaveVideo', inputs: { video: ['video', 0], filename_prefix: 'video/novira-finish', format: 'mp4', codec: 'auto' } };
  prompt.first = { class_type: 'ImageFromBatch', inputs: { image: frames, batch_index: 0, length: 1 } };
  prompt.thumb = { class_type: 'PreviewImage', inputs: { images: ['first', 0] } };
  return { prompt, outputs: ['save'], thumbnail: 'thumb' };
}
