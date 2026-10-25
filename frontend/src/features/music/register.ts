// Registers the music panel's Invoke builder, so Invoke (and its shortcut) makes music while the Music tab is open.
import { t } from '@/i18n';
import { registerAgentEditor } from '@/state/agent';
import { registerInvokeBuilder } from '@/state/invoke';
import { usePacks } from '@/state/media/packs';
import { useMusic } from '@/state/media/music';
import { musicAgentEditor } from './agentEditor';
import { buildMusicRequest, musicProblems } from './buildRequest';

function musicReadiness(): string[] {
  const problems = musicProblems(useMusic.getState().form, { tags: t('music.problem.tags') });
  if (usePacks.getState().packs.music.state !== 'ready') problems.push(t('music.problem.pack'));
  return problems;
}

export function registerMusicFeature() {
  registerAgentEditor('music', musicAgentEditor);
  registerInvokeBuilder('music', {
    // The iterations box does not apply: one press makes one music job.
    countsPictures: false,
    readiness: musicReadiness,
    build: async () => buildMusicRequest(useMusic.getState().form),
    subscribe: (onChange) => {
      const a = useMusic.subscribe(onChange);
      const b = usePacks.subscribe(onChange);
      return () => {
        a();
        b();
      };
    },
  });
}
