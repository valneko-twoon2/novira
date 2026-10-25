// Preset card of the Text tab: saved text styles (the logo looks built in), applied to the selected text layer.
import { t } from '@/i18n';
import { logoPresetId, textStylePresets, type TextStylePresetData } from '@/state/presets/textStylePresets';
import { useTextEditor } from '@/state/text/textEditor';
import { LOGO_PRESETS } from '@/state/text/textModel';
import { PresetBar } from '@/ui';
import { fontOf } from '@/state/fonts';

const LOGO_BY_ID = new Map(LOGO_PRESETS.map((look) => [logoPresetId(look), look]));

export function summarizeTextStyle(style: TextStylePresetData): string {
  const fill = style.fill.kind === 'solid' ? style.fill.color : `${style.fill.top} → ${style.fill.bottom}`;
  return [fontOf(style.fontFamily).label, fill].join(' · ');
}

export function TextPresetBar() {
  const hasTextLayer = useTextEditor((s) => s.scene.layers.some((l) => l.id === s.selectedId && l.type === 'text'));
  return (
    <PresetBar
      kind={textStylePresets}
      summarize={summarizeTextStyle}
      nameOf={(p) => {
        const look = p.builtin ? LOGO_BY_ID.get(p.id) : undefined;
        return look ? t(`text.preset.${look}`) : p.name;
      }}
      hint={t('presets.hint.text')}
      disabledReason={hasTextLayer ? null : t('presets.text.selectLayer')}
      testId="text-presets"
    />
  );
}
