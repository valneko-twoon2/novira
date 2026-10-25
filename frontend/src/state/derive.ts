// "Derive from this picture": more pictures made from the settings stored in a finished one, in one click and without
// touching the parameter form. A variation keeps every setting and draws again with new seeds; a redo starts from the
// picture itself and changes it as much as its strength allows (image-to-image; the quick choice is a low strength).
// The reference images and control layers the picture was made with are stored with it and used again.
import { backend, randomSeed, type EnqueueRequest, type GenerationMetadata, type GenerationMode, type ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import { findModel } from '@/state/models';
import { toast } from '@/state/toasts';

export type DeriveKind = 'variation' | 'subtle';

/** The choices the menus offer: what to make and how many. */
export const DERIVE_CHOICES = [
  { kind: 'variation', count: 1 },
  { kind: 'variation', count: 4 },
  { kind: 'subtle', count: 1 },
  { kind: 'subtle', count: 4 },
] as const satisfies readonly { kind: DeriveKind; count: number }[];

/** How far a subtle redo may move away from the picture (0 keeps it, 1 redraws it freely). */
export const SUBTLE_STRENGTH = 0.45;
/** The range of the strength slider of "redo with a chosen strength". */
export const STRENGTH_RANGE = { min: 0.05, max: 0.95, step: 0.05 } as const;

/** Pictures made from a prompt (not upscales, clips, sound or app-written graphs) have settings worth reusing. */
const DERIVABLE: GenerationMode[] = ['txt2img', 'img2img', 'inpaint', 'outpaint'];

export function canDerive(image: ImageDTO | undefined): boolean {
  const m = image?.metadata;
  return !!image && (image.mediaType ?? 'image') === 'image' && !!m && !!m.modelKey && DERIVABLE.includes(m.generationMode);
}

/** Settings a derived picture never carries over: they are not stored with the picture. */
const NOT_STORED_KEYS = ['maskBlur', 'draftAt'] as const;

/** Whether the picture used guidance that could not be stored (so a derived picture will differ), e.g. a picture made before references were kept. */
function lostGuidance(stored: GenerationMetadata): boolean {
  return (
    NOT_STORED_KEYS.some((key) => (stored[key] ?? 0) > 0) ||
    ((stored.refImageCount ?? 0) > 0 && !stored.refImages?.length) ||
    ((stored.controlLayerCount ?? 0) > 0 && !stored.controlLayers?.length) ||
    ((stored.regionalGuidanceCount ?? 0) > 0 && !stored.regionalLayers?.length)
  );
}

export function buildDerivedRequest(image: ImageDTO, kind: DeriveKind, count: number, strength: number = SUBTLE_STRENGTH): EnqueueRequest {
  const stored = image.metadata!;
  const refImages = stored.refImages ?? [];
  const controlLayers = stored.controlLayers ?? [];
  const regionalLayers = stored.regionalLayers ?? [];
  const referencePictures = stored.referencePictures ?? [];
  const params: GenerationMetadata = { ...stored, seed: randomSeed() };
  for (const key of NOT_STORED_KEYS) delete params[key];
  // The stored lists travel as request fields (the queue stores them with the new picture again).
  delete params.refImages;
  delete params.controlLayers;
  delete params.regionalLayers;
  delete params.referencePictures;
  if (refImages.length) params.refImageCount = refImages.length;
  else delete params.refImageCount;
  if (controlLayers.length) params.controlLayerCount = controlLayers.length;
  else delete params.controlLayerCount;
  if (regionalLayers.length) params.regionalGuidanceCount = regionalLayers.length;
  else delete params.regionalGuidanceCount;
  if (kind === 'subtle') {
    params.generationMode = 'img2img';
    params.strength = strength;
    // A redo starts from the finished (already enlarged, already screentoned) picture: no second pass, no second finish.
    delete params.hiresFix;
    delete params.mangaScreen;
    params.width = image.width;
    params.height = image.height;
  } else {
    params.generationMode = 'txt2img';
    delete params.strength;
  }
  return {
    origin: 'generate',
    destination: 'gallery',
    params,
    iterations: count,
    randomizeSeed: true,
    prepend: false,
    boardId: image.boardId,
    ...(kind === 'subtle' ? { initImageUrl: image.url } : {}),
    ...(refImages.length ? { refImages } : {}),
    ...(controlLayers.length ? { controlLayers } : {}),
    ...(regionalLayers.length ? { regionalLayers } : {}),
    ...(referencePictures.length ? { referencePictures } : {}),
  };
}

/** Queues `count` derived pictures; says what could not be carried over, or why nothing was queued. */
export async function deriveFrom(image: ImageDTO, kind: DeriveKind, count: number, strength: number = SUBTLE_STRENGTH): Promise<void> {
  const stored = image.metadata;
  if (!canDerive(image) || !stored) return;
  if (!findModel(stored.modelKey)) {
    toast({ status: 'error', title: t('gallery.derive.noModel', { model: stored.modelName || stored.modelKey }) });
    return;
  }
  try {
    await backend.enqueue(buildDerivedRequest(image, kind, count, strength));
    const dropped = lostGuidance(stored);
    toast({ status: 'success', title: tCount('gallery.derive.queued', count), ...(dropped ? { description: t('gallery.derive.dropped') } : {}) });
  } catch (e) {
    toast({ status: 'error', title: t('gallery.derive.failed'), description: e instanceof Error ? e.message : String(e) });
  }
}
