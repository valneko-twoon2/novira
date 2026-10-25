// How the AI assistant reads and fills the music form: it is told the values and the choices, and its fields are
// checked (unknown choices dropped, numbers clamped) before they reach the form.
import type { AgentEditor } from '@/state/agent';
import { MUSIC_KEYS, MUSIC_LANGUAGES, MUSIC_LIMITS, TIME_SIGNATURES, useMusic, type MusicForm } from '@/state/media/music';

const clamp = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;

/** The form fields an assistant answer may set; anything else in it is ignored. */
export function musicPatch(fields: Record<string, unknown>): Partial<MusicForm> {
  const patch: Partial<MusicForm> = {};
  if (typeof fields.tags === 'string') patch.tags = fields.tags.trim();
  if (typeof fields.lyrics === 'string') patch.lyrics = fields.lyrics.trim();
  if (typeof fields.instrumental === 'boolean') patch.instrumental = fields.instrumental;
  if (typeof fields.language === 'string' && (MUSIC_LANGUAGES as readonly string[]).includes(fields.language)) patch.language = fields.language;
  if (typeof fields.key === 'string' && MUSIC_KEYS.includes(fields.key)) patch.key = fields.key;
  if (typeof fields.timeSignature === 'number' && (TIME_SIGNATURES as readonly number[]).includes(fields.timeSignature)) patch.timeSignature = fields.timeSignature;
  const seconds = clamp(fields.seconds, MUSIC_LIMITS.seconds.min, MUSIC_LIMITS.seconds.max);
  if (seconds !== undefined) patch.seconds = seconds;
  const bpm = clamp(fields.bpm, MUSIC_LIMITS.bpm.min, MUSIC_LIMITS.bpm.max);
  if (bpm !== undefined) patch.bpm = bpm;
  return patch;
}

export const musicAgentEditor: AgentEditor = {
  context: () => {
    const { tags, lyrics, instrumental, language, seconds, bpm, key, timeSignature } = useMusic.getState().form;
    return {
      kind: 'music',
      values: { tags, lyrics, instrumental, language, seconds, bpm, key, timeSignature },
      choices: { language: MUSIC_LANGUAGES, key: MUSIC_KEYS, timeSignature: TIME_SIGNATURES, seconds: MUSIC_LIMITS.seconds, bpm: MUSIC_LIMITS.bpm },
    };
  },
  apply: (ops) => {
    const patch = musicPatch((ops[0] ?? {}) as Record<string, unknown>);
    if (!Object.keys(patch).length) return false;
    useMusic.getState().setForm(patch);
    return true;
  },
  snapshot: () => ({ ...useMusic.getState().form }),
  restore: (snapshot) => useMusic.getState().setForm(snapshot as MusicForm),
};
