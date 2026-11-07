// The preset card at the top of a generator screen's left panel: PresetPicker bound to one kind's preset store.
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { applyPreset, overwritePreset, savePreset, type Preset, type PresetKind } from '@/state/presets/presetStore';
import { PresetPicker, type PresetItem } from './PresetPicker';

export interface PresetBarProps<D> {
  kind: PresetKind<D>;
  /** One line under the name (model, size, steps...). */
  summarize?: (data: D) => string;
  /** Display name, e.g. a translated name for a built-in preset. */
  nameOf?: (preset: Preset<D>) => string;
  hint?: string;
  /** The card's caption; "Presets" unless the screen has more than one kind. */
  label?: string;
  disabledReason?: string | null;
  testId: string;
  /** More buttons of the screen, after the save button. */
  actions?: ReactNode;
}

export function PresetBar<D>({ kind, summarize, nameOf, hint, label, disabledReason, testId, actions }: PresetBarProps<D>) {
  const presets = kind.store((s) => s.presets);
  const selectedId = kind.store((s) => s.selectedId);
  const items: PresetItem[] = presets.map((p) => ({
    id: p.id,
    name: nameOf?.(p) ?? p.name,
    builtin: p.builtin,
    summary: summarize?.(p.data),
  }));
  return (
    <PresetPicker
      items={items}
      selectedId={selectedId}
      label={label ?? t('presets.label')}
      hint={hint}
      disabledReason={disabledReason}
      testId={testId}
      actions={actions}
      onApply={(id) => applyPreset(kind, id)}
      onSaveNew={(name) => savePreset(kind, name)}
      onOverwrite={(id) => overwritePreset(kind, id)}
      onRename={(id, name) => kind.store.getState().rename(id, name)}
      onDelete={(id) => kind.store.getState().remove(id)}
    />
  );
}
