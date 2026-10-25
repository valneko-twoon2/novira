// Graphs of ComfyUI's own nodes that end in a sound, as the browser mock sees them: the text a Read Aloud node asks
// to be read, and how long a song its latent asks for.
import type { ComfyGraph } from '../types';

const SOUND_SAVERS = new Set(['SaveAudio', 'SaveAudioMP3', 'SaveAudioOpus', 'SaveAudioAdvanced', 'PreviewAudio']);

/** The graph's first output saves a sound. */
export function savesSound(graph: ComfyGraph | null | undefined): boolean {
  const first = graph?.outputs[0];
  const node = first ? graph?.prompt[first] : undefined;
  return !!node && SOUND_SAVERS.has(node.class_type);
}

/** The text of the first `{ $speech }` placeholder, or null when the graph reads nothing aloud. */
export function speechText(graph: ComfyGraph | null | undefined): string | null {
  for (const node of Object.values(graph?.prompt ?? {})) {
    const audio = node.inputs.audio as { $speech?: { text?: unknown } } | undefined;
    const text = audio?.$speech?.text;
    if (typeof text === 'string') return text;
  }
  return null;
}

/** Seconds a song's empty latent asks for, when the graph has one. */
export function songSeconds(graph: ComfyGraph | null | undefined): number | null {
  for (const node of Object.values(graph?.prompt ?? {})) {
    const seconds = node.inputs.seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds;
  }
  return null;
}
