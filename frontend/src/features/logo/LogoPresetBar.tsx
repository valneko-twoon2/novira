// Preset card of the logo screen: the look and the shape (not the lettering).
import { t } from '@/i18n';
import { LOGO_SIZES } from '@/state/media/logo';
import { logoPresets, type LogoPresetData } from '@/state/presets/logoPresets';
import { PresetBar } from '@/ui';
import { SIZE_LABELS } from './sizeLabels';

export function summarizeLogoPreset(data: LogoPresetData): string {
  const size = LOGO_SIZES.find((s) => s.value === data.size);
  return [size ? t(SIZE_LABELS[size.value]) : '', data.style?.split(',')[0]?.trim() ?? ''].filter(Boolean).join(' · ');
}

export function LogoPresetBar() {
  return <PresetBar kind={logoPresets} summarize={summarizeLogoPreset} hint={t('presets.hint.logo')} testId="logo-presets" />;
}
