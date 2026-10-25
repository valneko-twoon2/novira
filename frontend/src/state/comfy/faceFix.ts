// The ComfyUI prompt that fixes the faces of a picture: the Impact Pack's FaceDetailer (catalog id `impact`) finds each
// face with a YOLO detector (loaded by the Impact Subpack, `impactSubpack`), cuts it out, draws it again at a higher
// resolution with the picture's own model and prompt, and pastes it back through a feathered mask.
import type { ComfyGraph, ComfyNodeDefs, SchedulerName } from '@/backend';

/** The node a face-fix prompt runs; also how the app knows the Impact Pack is loaded. */
export const FACE_NODE = 'FaceDetailer';
/** The node that loads the detector (the Impact Subpack). */
export const DETECTOR_NODE = 'UltralyticsDetectorProvider';

/** The detector files the loaded node lists (`bbox/face_yolov8m.pt`...), the ones for faces first. Empty while the pack is not loaded. */
export function faceDetectors(defs: ComfyNodeDefs | null): string[] {
  const spec = defs?.[DETECTOR_NODE]?.input.required?.model_name;
  const choices = Array.isArray(spec) ? (Array.isArray(spec[0]) ? spec[0] : (spec[1] as { options?: unknown } | undefined)?.options) : null;
  const names = Array.isArray(choices) ? choices.map(String).filter((n) => n.startsWith('bbox/')) : [];
  const rank = (n: string) => (/face/i.test(n) ? 0 : 1);
  return [...names].sort((a, b) => rank(a) - rank(b));
}

export interface FaceFixOptions {
  /** Library key of the checkpoint that draws the faces again (the picture's own model). */
  modelKey: string;
  prompt: string;
  negative: string;
  /** A name from `faceDetectors`. */
  detector: string;
  /** How far a face may change: 0.2 keeps it, 0.6 draws it almost anew. */
  strength: number;
  /** How sure the detector must be to call something a face (0 to 1); lower finds more, and more false ones. */
  sensitivity: number;
  steps: number;
  cfg: number;
  scheduler: SchedulerName;
}

/** Picture in, the same picture with its faces redrawn out. */
export function buildFaceFixGraph(imageName: string, o: FaceFixOptions): ComfyGraph {
  return {
    prompt: {
      ckpt: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: { $model: o.modelKey } } },
      pos: { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip: ['ckpt', 1] } },
      neg: { class_type: 'CLIPTextEncode', inputs: { text: o.negative, clip: ['ckpt', 1] } },
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      detector: { class_type: DETECTOR_NODE, inputs: { model_name: o.detector } },
      face: {
        class_type: FACE_NODE,
        inputs: {
          image: ['source', 0],
          model: ['ckpt', 0],
          clip: ['ckpt', 1],
          vae: ['ckpt', 2],
          guide_size: 512,
          guide_size_for: true,
          max_size: 1024,
          seed: { $seed: true },
          steps: o.steps,
          cfg: o.cfg,
          sampler_name: { $sampler_name: o.scheduler },
          scheduler: { $scheduler: o.scheduler },
          positive: ['pos', 0],
          negative: ['neg', 0],
          denoise: o.strength,
          feather: 5,
          noise_mask: true,
          force_inpaint: true,
          bbox_threshold: o.sensitivity,
          bbox_dilation: 10,
          bbox_crop_factor: 3,
          sam_detection_hint: 'center-1',
          sam_dilation: 0,
          sam_threshold: 0.93,
          sam_bbox_expansion: 0,
          sam_mask_hint_threshold: 0.7,
          sam_mask_hint_use_negative: 'False',
          drop_size: 10,
          bbox_detector: ['detector', 0],
          wildcard: '',
          cycle: 1,
          inpaint_model: false,
          noise_mask_feather: 20,
          tiled_encode: false,
          tiled_decode: false,
        },
      },
      save: { class_type: 'SaveImage', inputs: { images: ['face', 0], filename_prefix: 'novira-face' } },
    },
    outputs: ['save'],
  };
}
