// Model / LoRA picker: a trigger that opens a searchable popover of thumbnails grouped by base, with shortcuts to the
// model manager and the online search.
import { CaretDown, Check, Cube, Globe } from '@phosphor-icons/react';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { BASE_LABELS, BASE_ORDER } from '@/state/models';
import { useUi } from '@/state/ui';
import { Button, cx } from './controls';
import { CoverImage } from './CoverImage';
import { SearchPicker } from './SearchPicker';

export function ModelPicker({
  models,
  value,
  onPick,
  placeholder,
  disabled,
  testId,
  shortcuts = true,
  'aria-label': ariaLabel,
}: {
  models: ModelConfig[];
  value: string | null;
  onPick: (model: ModelConfig) => void;
  placeholder: string;
  disabled?: boolean;
  testId?: string;
  /** The buttons to the model manager and the online search under the list; a layout without those screens leaves them out. */
  shortcuts?: boolean;
  'aria-label'?: string;
}) {
  const setTab = useUi((s) => s.setTab);
  const current = models.find((m) => m.key === value);

  return (
    <SearchPicker
      trigger={
        <button type="button" className="ui-select" disabled={disabled} aria-label={ariaLabel && `${ariaLabel}: ${current ? current.name : placeholder}`} data-testid={testId}>
          <span className="ui-select__value">{current ? current.name : <span className="ui-select__placeholder">{placeholder}</span>}</span>
          <CaretDown size={12} />
        </button>
      }
      items={models}
      itemKey={(m) => m.key}
      textOf={(m) => m.name}
      groupOf={(m) => m.base}
      groups={BASE_ORDER.map((base) => ({ key: base, label: BASE_LABELS[base] }))}
      sort={(a, b) => a.name.localeCompare(b.name)}
      searchLabel={t('params.model.search')}
      emptyText={t('params.model.noMatch')}
      noMatchText={t('params.model.noMatch')}
      listTestId="model-picker-list"
      renderItem={(m, close) => (
        <button
          type="button"
          className={cx('pp-picker__item', m.key === value && 'is-current')}
          onClick={() => {
            onPick(m);
            close();
          }}
        >
          <CoverImage model={m} className="pp-cover pp-cover--pick" />
          <span className="pp-picker__name">{m.name}</span>
          {m.key === value && <Check size={12} />}
        </button>
      )}
      footer={
        shortcuts
          ? (close) => (
            <>
              <Button
                size="xs"
                variant="outline"
                leftIcon={<Cube />}
                title={t('params.model.openManagerHint')}
                data-testid="open-manager"
                onClick={() => {
                  close();
                  setTab('models');
                }}
              >
                {t('app.tabs.short.models')}
              </Button>
              <Button
                size="xs"
                variant="outline"
                leftIcon={<Globe />}
                title={t('params.model.findOnlineHint')}
                data-testid="find-online"
                onClick={() => {
                  close();
                  setTab('browse');
                }}
              >
                {t('app.tabs.short.browse')}
              </Button>
            </>
            )
          : undefined
      }
    />
  );
}
