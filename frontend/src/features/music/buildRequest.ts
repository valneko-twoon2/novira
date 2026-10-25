// Turns the music form into a queue request.
import { randomSeed, type EnqueueRequest } from '@/backend';
import { autoAddBoardId } from '@/state/invoke';
import type { MusicForm } from '@/state/media/music';

const MUSIC_MODEL_NAME = 'ACE-Step 1.5';

/** Reasons the form cannot be sent yet (empty = ready); the caller supplies the wording. */
export function musicProblems(form: MusicForm, texts: { tags: string }): string[] {
  return form.tags.trim() ? [] : [texts.tags];
}

export function buildMusicRequest(form: MusicForm): EnqueueRequest {
  return {
    origin: 'generate',
    destination: 'gallery',
    params: {
      generationMode: 'music',
      positivePrompt: form.tags.trim(),
      negativePrompt: '',
      modelKey: '',
      modelName: MUSIC_MODEL_NAME,
      vaeKey: null,
      seed: form.randomizeSeed ? randomSeed() : form.seed,
      steps: form.steps,
      cfgScale: form.cfgScale,
      cfgRescale: 0,
      scheduler: 'euler',
      width: 256,
      height: 144,
      clipSkip: 0,
      seamlessX: false,
      seamlessY: false,
      loras: [],
      music: {
        lyrics: form.instrumental ? '' : form.lyrics.trim(),
        seconds: form.seconds,
        bpm: form.bpm,
        key: form.key,
        timeSignature: form.timeSignature,
        language: form.language,
        instrumental: form.instrumental,
      },
    },
    iterations: 1,
    randomizeSeed: false,
    prepend: false,
    boardId: autoAddBoardId(),
    initImageUrl: null,
  };
}
