// The queue job of a picture tool: its ComfyUI prompt (the builders of state/comfy), whether it makes a picture or
// text, and the settings it used with what was taken from the picture filled in.
import type { EnqueueRequest, ImageDTO } from '@/backend';
import { buildCaptionGraph, captionModel } from '../comfy/caption';
import { buildCutoutGraph, cutoutModels } from '../comfy/cutout';
import { buildFaceFixGraph, faceDetectors } from '../comfy/faceFix';
import { graphRequest } from '../comfy/graphJob';
import { buildPoseExtractGraph } from '../comfy/poseExtract';
import { checkpointModels } from '../models';
import { recalledModel, recalledModelKey } from '../recallModel';
import type { ToolContext } from './readiness';
import type { FaceOverrides, ImageToolId, ToolSettings, UsedSettings } from './tools';

export interface ToolJob {
  /** A picture saved next to the original, or text (a description, the joints of the people). */
  makes: 'picture' | 'text';
  request: EnqueueRequest;
  used: UsedSettings;
}

/** The model the face fix draws with: the band's choice, else the picture's own, else the form's, else the first. */
export function faceFixModel(image: ImageDTO, overrides: FaceOverrides, ctx: Pick<ToolContext, 'models'>, formModel: string | null): string | null {
  const mains = checkpointModels(ctx.models);
  const picture = image.metadata ? recalledModelKey(recalledModel(image.metadata, mains), null) : null;
  return mains.find((m) => m.key === overrides.modelKey)?.key ?? picture ?? mains.find((m) => m.key === formModel)?.key ?? mains[0]?.key ?? null;
}

/** The prompt the face fix draws with: the band's text, else the picture's own prompt. */
export function faceFixPrompt(image: ImageDTO, overrides: FaceOverrides): string {
  return overrides.prompt ?? image.metadata?.positivePrompt ?? '';
}

/** The picture-making request: shown on the picture's board, with its size for the gallery. */
const pictureRequest = (graph: Parameters<typeof graphRequest>[0], image: ImageDTO) => graphRequest(graph, 'gallery', image.boardId, { width: image.width, height: image.height });

/**
 * The job of `tool` on `image` with its part of `settings`. Throws when the tool cannot run (call `toolReadiness` first); the
 * message is for the developer log, the band says why in words before that.
 */
export function buildToolJob(tool: ImageToolId, image: ImageDTO, settings: ToolSettings, ctx: ToolContext, face: FaceOverrides, formModel: string | null): ToolJob {
  switch (tool) {
    case 'facefix': {
      const s = settings.facefix;
      const detectors = faceDetectors(ctx.defs);
      const detector = s.detector && detectors.includes(s.detector) ? s.detector : detectors[0];
      const modelKey = faceFixModel(image, face, ctx, formModel);
      if (!detector || !modelKey) throw new Error('no face detector or model');
      const stored = image.metadata;
      const graph = buildFaceFixGraph(image.name, {
        modelKey,
        prompt: faceFixPrompt(image, face),
        negative: stored?.negativePrompt ?? '',
        detector,
        strength: s.strength,
        sensitivity: s.sensitivity,
        steps: 20,
        cfg: Math.min(stored?.cfgScale || 6, 7),
        scheduler: stored?.scheduler ?? 'dpmpp_2m_k',
      });
      const modelName = ctx.models.find((m) => m.key === modelKey)?.name ?? modelKey;
      return { makes: 'picture', request: pictureRequest(graph, image), used: { tool: 'facefix', modelName, detector, strength: s.strength, sensitivity: s.sensitivity } };
    }
    case 'cutout': {
      const s = settings.cutout;
      const models = cutoutModels(ctx.defs);
      const model = s.model && models.includes(s.model) ? s.model : models[0];
      if (!model) throw new Error('no cut-out model');
      const graph = buildCutoutGraph(image.name, { model, sensitivity: s.sensitivity, edge: s.edge, background: s.background });
      return { makes: 'picture', request: pictureRequest(graph, image), used: { tool: 'cutout', model, sensitivity: s.sensitivity, edge: s.edge, background: s.background } };
    }
    case 'caption': {
      const s = settings.caption;
      const model = captionModel(ctx.defs);
      if (!model) throw new Error('no caption model');
      return { makes: 'text', request: graphRequest(buildCaptionGraph(image.name, { style: s.style, model }), 'intermediate'), used: { tool: 'caption', style: s.style } };
    }
    case 'pose':
      return { makes: 'text', request: graphRequest(buildPoseExtractGraph(image.name, ctx.defs), 'intermediate'), used: { tool: 'pose' } };
    default: {
      const never: never = tool;
      return never;
    }
  }
}
