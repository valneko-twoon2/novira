// Whether a picture tool can run now: the node definitions are still being read, a custom node pack it needs is
// missing (the band offers to install it), something else is missing, or it is ready.
import type { ComfyNodeDefs, ModelConfig } from '@/backend';
import type { MessageKey } from '@/i18n';
import { CAPTION_PACK, captionReady } from '../comfy/caption';
import { CUTOUT_NODE, cutoutModels } from '../comfy/cutout';
import { DETECTOR_NODE, FACE_NODE, faceDetectors } from '../comfy/faceFix';
import { POSE_EXTRACT_PACK, poseExtractReady } from '../comfy/poseExtract';
import { checkpointModels } from '../models';
import type { ImageToolId } from './tools';

export type ToolReadiness =
  | { state: 'loading' }
  | { state: 'ready' }
  /** `pack` is a catalog id (packCatalog.ts); `message` says what it is needed for and takes `{pack}`. */
  | { state: 'needsPack'; pack: string; message: MessageKey }
  | { state: 'problem'; message: MessageKey };

/** What the tools read: ComfyUI's node definitions as `useComfyNodes` holds them, and the installed models. */
export interface ToolContext {
  defs: ComfyNodeDefs | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  models: ModelConfig[];
}

export function toolReadiness(tool: ImageToolId, { defs, status, models }: ToolContext): ToolReadiness {
  if (status === 'idle' || status === 'loading') return { state: 'loading' };
  switch (tool) {
    case 'facefix':
      if (!defs?.[FACE_NODE]) return { state: 'needsPack', pack: 'impact', message: 'facefix.needsImpact' };
      if (!defs[DETECTOR_NODE]) return { state: 'needsPack', pack: 'impactSubpack', message: 'facefix.needsSubpack' };
      if (!faceDetectors(defs).length) return { state: 'problem', message: 'facefix.noDetector' };
      if (!checkpointModels(models).length) return { state: 'problem', message: 'facefix.noModel' };
      return { state: 'ready' };
    case 'cutout':
      return defs?.[CUTOUT_NODE] && cutoutModels(defs).length ? { state: 'ready' } : { state: 'needsPack', pack: 'rmbg', message: 'cutout.needsPack' };
    case 'caption':
      return captionReady(defs) ? { state: 'ready' } : { state: 'needsPack', pack: CAPTION_PACK, message: 'caption.needsPack' };
    case 'pose':
      return poseExtractReady(defs) ? { state: 'ready' } : { state: 'needsPack', pack: POSE_EXTRACT_PACK, message: 'canvas.poseFromImage.needsPack' };
    default: {
      const never: never = tool;
      return never;
    }
  }
}
