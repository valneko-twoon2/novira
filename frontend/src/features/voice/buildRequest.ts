// Turns the voice form into a queue request.
import { randomSeed, type EnqueueRequest } from '@/backend';
import { autoAddBoardId } from '@/state/invoke';
import type { VoiceForm } from '@/state/media/voice';

const VOICE_MODEL_NAME = 'Qwen3-TTS';

/** Reasons the form cannot be sent yet (empty = ready); the caller supplies the wording. */
export function voiceProblems(form: VoiceForm, texts: { text: string; description: string }): string[] {
  const problems: string[] = [];
  if (!form.text.trim()) problems.push(texts.text);
  if (form.mode === 'design' && !form.instruct.trim()) problems.push(texts.description);
  return problems;
}

export function buildVoiceRequest(form: VoiceForm): EnqueueRequest {
  return {
    origin: 'generate',
    destination: 'gallery',
    params: {
      generationMode: 'voice',
      positivePrompt: form.text.trim(),
      negativePrompt: '',
      modelKey: '',
      modelName: VOICE_MODEL_NAME,
      vaeKey: null,
      seed: randomSeed(),
      steps: 1,
      cfgScale: 1,
      cfgRescale: 0,
      scheduler: 'euler',
      width: 256,
      height: 144,
      clipSkip: 0,
      seamlessX: false,
      seamlessY: false,
      loras: [],
      voice: {
        text: form.text.trim(),
        language: form.language,
        mode: form.mode,
        speaker: form.speaker,
        instruct: form.instruct.trim(),
      },
    },
    iterations: 1,
    randomizeSeed: false,
    prepend: false,
    boardId: autoAddBoardId(),
    initImageUrl: null,
  };
}
