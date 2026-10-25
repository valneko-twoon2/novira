// How the AI assistant reads and fills the video form: it is told the values and the choices, and its fields are
// checked (unknown sizes dropped, numbers clamped) before they reach the form.
import type { AgentEditor } from '@/state/agent';
import { useVideo, VIDEO_LIMITS, VIDEO_SIZES, type VideoForm } from '@/state/media/video';

const clamp = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;

/** The form fields an assistant answer may set; anything else in it is ignored. */
export function videoPatch(fields: Record<string, unknown>): Partial<VideoForm> {
  const patch: Partial<VideoForm> = {};
  if (typeof fields.prompt === 'string') patch.positivePrompt = fields.prompt.trim();
  if (typeof fields.negativePrompt === 'string') patch.negativePrompt = fields.negativePrompt.trim();
  if (fields.mode === 'text' || fields.mode === 'image') patch.mode = fields.mode;
  const size = VIDEO_SIZES.find((s) => s.value === fields.size);
  if (size) Object.assign(patch, { width: size.width, height: size.height });
  const seconds = clamp(fields.seconds, VIDEO_LIMITS.seconds.min, VIDEO_LIMITS.seconds.max);
  if (seconds !== undefined) patch.seconds = seconds;
  const fps = clamp(fields.fps, VIDEO_LIMITS.fps.min, VIDEO_LIMITS.fps.max);
  if (fps !== undefined) patch.fps = fps;
  return patch;
}

export const videoAgentEditor: AgentEditor = {
  context: () => {
    const { mode, positivePrompt, negativePrompt, width, height, seconds, fps } = useVideo.getState().form;
    return {
      kind: 'video',
      values: { mode, prompt: positivePrompt, negativePrompt, size: `${width}x${height}`, seconds, fps },
      choices: { mode: ['text', 'image'], size: VIDEO_SIZES.map((s) => s.value), seconds: VIDEO_LIMITS.seconds, fps: VIDEO_LIMITS.fps },
    };
  },
  apply: (ops) => {
    const patch = videoPatch((ops[0] ?? {}) as Record<string, unknown>);
    if (!Object.keys(patch).length) return false;
    useVideo.getState().setForm(patch);
    return true;
  },
  snapshot: () => ({ ...useVideo.getState().form }),
  restore: (snapshot) => useVideo.getState().setForm(snapshot as VideoForm),
};
