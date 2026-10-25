// Registers the video panel's Invoke builder, so Invoke (and its shortcut) makes a video while the Video tab is open.
import { registerAgentEditor } from '@/state/agent';
import { registerInvokeBuilder } from '@/state/invoke';
import { useGallery } from '@/state/gallery';
import { usePacks } from '@/state/media/packs';
import { findModel } from '@/state/models';
import { useVideo } from '@/state/media/video';
import { t } from '@/i18n';
import { videoAgentEditor } from './agentEditor';
import { buildVideoRequest, videoProblems } from './buildRequest';

function videoReadiness(): string[] {
  const { form } = useVideo.getState();
  const pack = usePacks.getState().packs[form.model === 'fast' ? 'turbo' : 'video'];
  const problems = videoProblems(form, { prompt: t('video.problem.prompt'), image: t('video.problem.image') });
  // An installed model brings its own files; only the pack's two models need the download.
  const own = form.modelKey ? findModel(form.modelKey) : undefined;
  if (form.modelKey && !own) problems.push(t('video.problem.model'));
  else if (!own && pack.state !== 'ready') problems.push(t('video.problem.pack'));
  return problems;
}

export function registerVideoFeature() {
  registerAgentEditor('video', videoAgentEditor);
  registerInvokeBuilder('video', {
    // The iterations box does not apply: one press makes one video job.
    countsPictures: false,
    readiness: videoReadiness,
    build: async () => buildVideoRequest(useVideo.getState().form),
    subscribe: (onChange) => {
      const a = useVideo.subscribe(onChange);
      const b = useGallery.subscribe(onChange);
      const c = usePacks.subscribe(onChange);
      return () => {
        a();
        b();
        c();
      };
    },
  });
}
