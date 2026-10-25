// Builds the queue request of a canvas invocation: the mode from what the bbox holds, the source and mask, the
// control layers' pictures and the global reference images. The pixels come from a CanvasRenderer.
import type { ControlLayerInput, ControlType, EnqueueRequest, GenerationMetadata, GenerationMode, RegionalLayerInput } from '@/backend';
import type { CanvasState, ControlEntity } from '@/state/canvas';
import { autoAddBoardId } from '@/state/invoke';
import { findModel } from '@/state/models';
import { refImageInputs, type ParamsState } from '@/state/params';
import { pickGenerationMode } from './generationMode';
import { hasContent } from '@/ui/canvasDraw/composite';
import { visibleEntities } from './render/composite';
import type { CanvasRenderer } from './render/generationInputs';

type Doc = Pick<CanvasState, 'entities' | 'groupHidden' | 'bbox' | 'filterPreviews'>;

/**
 * What a control layer's picture shows, for a ControlNet that reads several kinds (a union model): the kind its filter
 * makes, or a pose for an unfiltered layer that holds stick figures. Unknown (a colour map, a picture put in) is left out.
 */
export function controlTypeOf(e: Pick<ControlEntity, 'filter' | 'objects'>): ControlType | undefined {
  switch (e.filter) {
    case 'depth':
      return 'depth';
    case 'canny':
    case 'lineart':
      return 'lineart';
    case 'hed':
      return 'softedge';
    case 'normal':
      return 'normal';
    case 'color_map':
      return undefined;
    case 'none':
    default:
      return e.objects.some((o) => o.kind === 'pose') ? 'openpose' : undefined;
  }
}

export async function buildCanvasRequest(s: Doc, p: ParamsState, prepend: boolean, renderer: CanvasRenderer): Promise<EnqueueRequest> {
  const coverage = await renderer.coverage(s);
  const hasMask = visibleEntities(s, ['inpaint']).some(hasContent);
  let mode: GenerationMode = pickGenerationMode(coverage, hasMask);
  let initImageUrl: string | null = null;
  let maskImageUrl: string | null = null;
  if (mode !== 'txt2img') {
    const rendered = await renderer.sourceAndMask(s, { outpaint: mode === 'outpaint', infill: { method: p.infillMethod, color: p.infillColor } });
    initImageUrl = rendered.initImageUrl;
    // Without anything to redraw inside the bbox the whole source is reworked.
    maskImageUrl = mode === 'img2img' ? null : rendered.maskImageUrl;
    if (!maskImageUrl) mode = 'img2img';
  }
  const controlLayers: ControlLayerInput[] = [];
  for (const e of visibleEntities(s, ['control'])) {
    if (e.type !== 'control' || !e.modelKey || !(hasContent(e) || s.filterPreviews[e.id])) continue;
    const controlType = controlTypeOf(e);
    controlLayers.push({
      imageUrl: await renderer.controlImage(s, e),
      modelKey: e.modelKey,
      weight: e.weight,
      beginEnd: [e.beginEnd[0], e.beginEnd[1]],
      controlMode: e.controlMode,
      ...(controlType ? { controlType } : {}),
    });
  }
  const refImages = refImageInputs(p.refImages);
  // Regional guidance: each layer's prompts apply inside its region. A layer without a prompt says nothing.
  const regionalLayers: RegionalLayerInput[] = [];
  for (const e of visibleEntities(s, ['regional'])) {
    if (e.type !== 'regional' || !hasContent(e)) continue;
    const positivePrompt = e.positivePrompt?.trim() || null;
    const negativePrompt = e.negativePrompt?.trim() || null;
    if (!positivePrompt && !negativePrompt) continue;
    regionalLayers.push({ imageUrl: await renderer.regionMask(s, e), positivePrompt, negativePrompt, autoNegative: e.autoNegative });
  }
  const params: GenerationMetadata = {
    generationMode: mode,
    positivePrompt: p.positivePrompt,
    negativePrompt: p.negativePrompt,
    modelKey: p.modelKey ?? '',
    modelName: findModel(p.modelKey)?.name ?? '',
    vaeKey: p.vaeKey,
    seed: p.seed,
    steps: p.steps,
    cfgScale: p.cfgScale,
    cfgRescale: p.cfgRescale,
    scheduler: p.scheduler,
    width: s.bbox.width,
    height: s.bbox.height,
    clipSkip: p.clipSkip,
    seamlessX: p.seamlessX,
    seamlessY: p.seamlessY,
    loras: p.loras.filter((l) => l.isEnabled).map((l) => ({ ...l })),
    ...(mode !== 'txt2img' ? { strength: p.strength } : {}),
    ...(maskImageUrl ? { maskBlur: p.maskBlur } : {}),
    controlLayerCount: controlLayers.length,
    refImageCount: refImages.length,
    ...(regionalLayers.length ? { regionalGuidanceCount: regionalLayers.length } : {}),
  };
  return {
    origin: 'canvas',
    destination: 'canvas',
    params,
    iterations: p.iterations,
    randomizeSeed: p.shouldRandomizeSeed,
    prepend,
    boardId: autoAddBoardId(),
    initImageUrl,
    maskImageUrl,
    controlLayers,
    regionalLayers,
    refImages,
  };
}
