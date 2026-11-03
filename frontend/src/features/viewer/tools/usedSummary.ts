// The settings a run used, as the short items shown beside its result ("Main XL", "How much the face changes 0.40").
import { t } from '@/i18n';
import type { UsedSettings } from '@/state/imageTools/tools';

export function usedSummary(used: UsedSettings): string[] {
  switch (used.tool) {
    case 'facefix':
      return [used.modelName, `${t('facefix.strength')} ${used.strength.toFixed(2)}`, `${t('facefix.sensitivity')} ${used.sensitivity.toFixed(2)}`, used.detector];
    case 'cutout':
      return [used.model, `${t('cutout.sensitivity')} ${used.sensitivity.toFixed(2)}`, `${t('cutout.edge')} ${used.edge}`, t(`cutout.background.${used.background}`)];
    case 'caption':
      return [t(`caption.style.${used.style}`)];
    case 'pose':
      return [];
    default: {
      const never: never = used;
      return never;
    }
  }
}
