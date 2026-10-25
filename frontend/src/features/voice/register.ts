// Registers the voice panel's Invoke builder, so Invoke (and its shortcut) makes voice while the Voice tab is open.
import { t } from '@/i18n';
import { registerAgentEditor } from '@/state/agent';
import { registerInvokeBuilder } from '@/state/invoke';
import { usePacks } from '@/state/media/packs';
import { useVoice } from '@/state/media/voice';
import { voiceAgentEditor } from './agentEditor';
import { buildVoiceRequest, voiceProblems } from './buildRequest';

function voiceReadiness(): string[] {
  const problems = voiceProblems(useVoice.getState().form, { text: t('voice.problem.text'), description: t('voice.problem.description') });
  if (usePacks.getState().packs.voice.state !== 'ready') problems.push(t('voice.problem.pack'));
  return problems;
}

export function registerVoiceFeature() {
  registerAgentEditor('voice', voiceAgentEditor);
  registerInvokeBuilder('voice', {
    // The iterations box does not apply: one press makes one voice job.
    countsPictures: false,
    readiness: voiceReadiness,
    build: async () => buildVoiceRequest(useVoice.getState().form),
    subscribe: (onChange) => {
      const a = useVoice.subscribe(onChange);
      const b = usePacks.subscribe(onChange);
      return () => {
        a();
        b();
      };
    },
  });
}
