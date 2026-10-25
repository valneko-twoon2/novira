// Turns the video form into a queue request (shared by the video screen and the workflow graph builder's tests).
import { randomSeed, type EnqueueRequest } from '@/backend';
import { findImage } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { findModel } from '@/state/models';
import { framesFor, type VideoForm } from '@/state/media/video';

const VIDEO_MODEL_NAME = 'Wan 2.2 TI2V 5B';
/** Tells the backend to load the fast model (its `TURBO_KEY`). */
export const FAST_MODEL_KEY = 'video-turbo';

/** Reasons the form cannot be sent yet (empty = ready). `t` supplies the texts so the caller owns the wording. */
export function videoProblems(form: VideoForm, texts: { prompt: string; image: string }): string[] {
  const problems: string[] = [];
  if (!form.positivePrompt.trim()) problems.push(texts.prompt);
  if (form.mode === 'image') {
    const source = findImage(form.sourceImageName);
    if (!source || source.mediaType === 'video') problems.push(texts.image);
  }
  return problems;
}

export function buildVideoRequest(form: VideoForm): EnqueueRequest {
  const source = form.mode === 'image' ? findImage(form.sourceImageName) : undefined;
  const own = form.modelKey ? findModel(form.modelKey) : undefined;
  return {
    origin: 'generate',
    destination: 'gallery',
    params: {
      generationMode: 'video',
      positivePrompt: form.positivePrompt.trim(),
      negativePrompt: form.negativePrompt.trim(),
      modelKey: own ? own.key : form.model === 'fast' ? FAST_MODEL_KEY : '',
      modelName: own ? own.name : form.model === 'fast' ? `${VIDEO_MODEL_NAME} Turbo` : VIDEO_MODEL_NAME,
      vaeKey: null,
      seed: form.randomizeSeed ? randomSeed() : form.seed,
      steps: form.steps,
      cfgScale: form.cfgScale,
      cfgRescale: 0,
      scheduler: 'unipc',
      width: form.width,
      height: form.height,
      clipSkip: 0,
      seamlessX: false,
      seamlessY: false,
      loras: [],
      videoFrames: framesFor(form.seconds, form.fps),
      videoFps: form.fps,
      ...(form.fp8 ? { videoFp8: true } : {}),
      ...(form.tiledDecode ? { videoTiledDecode: true } : {}),
    },
    iterations: 1,
    randomizeSeed: false,
    prepend: false,
    boardId: autoAddBoardId(),
    initImageUrl: source?.url ?? null,
  };
}
