// Saved logo presets: the look (style words) and the shape; the lettering belongs to each logo.
import { useLogo, type LogoForm } from '../media/logo';
import { createPresetStore, pickFields, type Preset, type PresetKind } from './presetStore';
import seed from './seed/logo.json';

export const LOGO_PRESET_FIELDS = ['style', 'size', 'count'] as const satisfies readonly (keyof LogoForm)[];

export type LogoPresetData = Partial<Pick<LogoForm, (typeof LOGO_PRESET_FIELDS)[number]>>;

export const useLogoPresets = createPresetStore<LogoPresetData>({ name: 'novira.logoPresets', seed: seed as Preset<LogoPresetData>[] });

export const logoPresets: PresetKind<LogoPresetData> = {
  store: useLogoPresets,
  snapshot: () => pickFields(useLogo.getState().form, LOGO_PRESET_FIELDS),
  apply: (data) => useLogo.getState().setForm(pickFields(data, LOGO_PRESET_FIELDS)),
};
