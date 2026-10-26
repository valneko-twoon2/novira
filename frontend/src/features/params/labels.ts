// Display labels for parameter enums. Scheduler names are engine names and stay untranslated.
import type { BaseModel, SchedulerName } from '@/backend';
import { t } from '@/i18n';
import type { CoherenceMode, InfillMethod, RefImageMethod } from '@/state/params';

export const SCHEDULER_LABELS: Record<SchedulerName, string> = {
  euler: 'Euler',
  euler_a: 'Euler Ancestral',
  euler_k: 'Euler Karras',
  dpmpp_2m: 'DPM++ 2M',
  dpmpp_2m_k: 'DPM++ 2M Karras',
  dpmpp_2m_sde_k: 'DPM++ 2M SDE Karras',
  dpmpp_sde_k: 'DPM++ SDE Karras',
  heun: 'Heun',
  lms: 'LMS',
  ddim: 'DDIM',
  unipc: 'UniPC',
  lcm: 'LCM',
  tcd: 'TCD',
};

/**
 * A scheduler as the screen names it for a model of `base`. Anima's own template runs euler with the `simple` scheduler,
 * which is what plain `euler` means there (`Family::sampling_for` in the backend), so it reads that way.
 */
export function schedulerLabel(name: SchedulerName, base?: BaseModel): string {
  return base === 'anima' && name === 'euler' ? 'Euler / simple' : SCHEDULER_LABELS[name];
}

export function methodLabel(m: RefImageMethod): string {
  switch (m) {
    case 'full':
      return t('params.refImage.method.full');
    case 'style':
      return t('params.refImage.method.style');
    case 'composition':
      return t('params.refImage.method.composition');
    case 'style_strong':
      return t('params.refImage.method.styleStrong');
    case 'style_precise':
      return t('params.refImage.method.stylePrecise');
  }
}

export function coherenceLabel(m: CoherenceMode): string {
  switch (m) {
    case 'Gaussian Blur':
      return t('params.compositing.mode.gaussian');
    case 'Box Blur':
      return t('params.compositing.mode.box');
    case 'Staged':
      return t('params.compositing.mode.staged');
  }
}

export function infillLabel(m: InfillMethod): string {
  switch (m) {
    case 'patchmatch':
      return 'PatchMatch';
    case 'lama':
      return 'LaMa';
    case 'cv2':
      return 'cv2';
    case 'color':
      return t('params.compositing.infill.color');
    case 'tile':
      return t('params.compositing.infill.tile');
  }
}

/** Optimal square side for a model base (InvokeAI "optimal size"). */
export function optimalDimension(base: string | undefined): number {
  if (base === 'sd-1') return 512;
  if (base === 'sd-2') return 768;
  return 1024;
}
