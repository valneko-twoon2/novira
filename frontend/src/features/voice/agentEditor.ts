// How the AI assistant reads and fills the voice form: it is told the values and the choices, and its fields are
// checked (unknown choices dropped) before they reach the form.
import type { AgentEditor } from '@/state/agent';
import { useVoice, VOICE_LANGUAGES, VOICE_SPEAKERS, type VoiceForm } from '@/state/media/voice';

/** The form fields an assistant answer may set; anything else in it is ignored. */
export function voicePatch(fields: Record<string, unknown>): Partial<VoiceForm> {
  const patch: Partial<VoiceForm> = {};
  if (typeof fields.text === 'string') patch.text = fields.text.trim();
  if (typeof fields.instruct === 'string') patch.instruct = fields.instruct.trim();
  if (typeof fields.language === 'string' && (VOICE_LANGUAGES as readonly string[]).includes(fields.language)) patch.language = fields.language;
  if (typeof fields.speaker === 'string' && (VOICE_SPEAKERS as readonly string[]).includes(fields.speaker)) patch.speaker = fields.speaker;
  if (fields.mode === 'preset' || fields.mode === 'design') patch.mode = fields.mode;
  return patch;
}

export const voiceAgentEditor: AgentEditor = {
  context: () => {
    const { text, language, mode, speaker, instruct } = useVoice.getState().form;
    return {
      kind: 'voice',
      values: { text, language, mode, speaker, instruct },
      choices: { language: VOICE_LANGUAGES, mode: ['preset', 'design'], speaker: VOICE_SPEAKERS },
    };
  },
  apply: (ops) => {
    const patch = voicePatch((ops[0] ?? {}) as Record<string, unknown>);
    if (!Object.keys(patch).length) return false;
    useVoice.getState().setForm(patch);
    return true;
  },
  snapshot: () => ({ ...useVoice.getState().form }),
  restore: (snapshot) => useVoice.getState().setForm(snapshot as VoiceForm),
};
