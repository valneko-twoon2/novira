// Registers the logo panel's Invoke builder, so Invoke (and its shortcut) makes logos while the Logo tab is open.
import { t } from '@/i18n';
import { registerInvokeBuilder } from '@/state/invoke';
import { useLogo } from '@/state/media/logo';
import { usePacks } from '@/state/media/packs';
import { buildLogoRequest, logoProblems } from './buildRequest';

function logoReadiness(): string[] {
  const problems = logoProblems(useLogo.getState().form, { text: t('logo.problem.text') });
  if (usePacks.getState().packs.logo.state !== 'ready') problems.push(t('logo.problem.pack'));
  return problems;
}

export function registerLogoFeature() {
  registerInvokeBuilder('logo', {
    // The iterations box does not apply: the screen has its own count.
    countsPictures: false,
    readiness: logoReadiness,
    build: async () => buildLogoRequest(useLogo.getState().form),
    subscribe: (onChange) => {
      const a = useLogo.subscribe(onChange);
      const b = usePacks.subscribe(onChange);
      return () => {
        a();
        b();
      };
    },
  });
}
