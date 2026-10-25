// A font chooser: the app's own fonts and the ones installed on this computer, searchable, each name shown in its own font.
// The installed fonts are read from the backend the first time a chooser opens. With `defaultLabel`, the first row stands
// for "no font of its own" (null), for example a balloon that follows the settings.
import { CaretDown, Check } from '@phosphor-icons/react';
import { useEffect, useMemo } from 'react';
import { t } from '@/i18n';
import { FONTS, fontStack, useAppFonts, useInstalledFonts } from '@/state/fonts';
import { cx } from './controls';
import { SearchPicker } from './SearchPicker';

interface FontItem {
  family: string | null;
  label: string;
  group: 'app' | 'installed';
}

export interface FontPickerProps {
  value: string | null;
  onChange: (family: string | null) => void;
  /** The name of the "no font of its own" row; without it, a font must be chosen. */
  defaultLabel?: string;
  /** What the chooser is for, read by screen readers. */
  label: string;
  testId?: string;
}

export function FontPicker({ value, onChange, defaultLabel, label, testId }: FontPickerProps) {
  const installed = useInstalledFonts((s) => s.families);
  useEffect(() => useInstalledFonts.getState().load(), []);
  // Each name is shown in its own font.
  useAppFonts();
  const items = useMemo<FontItem[]>(
    () => [
      ...(defaultLabel !== undefined ? [{ family: null, label: defaultLabel, group: 'app' as const }] : []),
      ...FONTS.map((f) => ({ family: f.family, label: f.label, group: 'app' as const })),
      ...installed.map((family) => ({ family, label: family, group: 'installed' as const })),
    ],
    [defaultLabel, installed],
  );
  const current = items.find((i) => i.family === value) ?? (value ? { family: value, label: value, group: 'installed' as const } : items[0]);
  return (
    <SearchPicker
      trigger={
        <button type="button" className="ui-select" aria-label={label} data-testid={testId}>
          <span className="ui-select__value" style={{ fontFamily: fontStack(current?.family) }}>
            {current?.label ?? ''}
          </span>
          <CaretDown size={12} />
        </button>
      }
      items={items}
      itemKey={(i) => i.family ?? ''}
      textOf={(i) => i.label}
      groupOf={(i) => i.group}
      groups={[
        { key: 'app', label: t('common.font.app') },
        { key: 'installed', label: t('common.font.installed') },
      ]}
      searchLabel={t('common.font.search')}
      emptyText={t('common.font.noMatch')}
      noMatchText={t('common.font.noMatch')}
      listTestId={testId ? `${testId}-list` : undefined}
      renderItem={(item, close) => (
        <button
          type="button"
          className={cx('pp-picker__item', item.family === value && 'is-current')}
          onClick={() => {
            onChange(item.family);
            close();
          }}
          data-testid="font-option"
        >
          <span className="pp-picker__name" style={{ fontFamily: fontStack(item.family) }}>
            {item.label}
          </span>
          {item.family === value && <Check size={12} />}
        </button>
      )}
    />
  );
}
