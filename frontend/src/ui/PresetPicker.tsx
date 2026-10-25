// Preset chooser shared by every generator screen: a card with the current preset (name, summary; no pictures) that
// opens a searchable list grouped into the user's and the built-in presets, with apply / overwrite / rename / delete
// on each and "save the current settings" at the bottom. `compact` is the one-line form used under a prompt box.
import { CaretDown, Check, DotsThree, FloppyDisk, FloppyDiskBack, PencilSimple, Play, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { Button, cx, IconButton } from './controls';
import { NameDialog } from './NameDialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './overlays';
import { PressAgainMenuItem } from './PressAgain';
import { SearchPicker } from './SearchPicker';

export interface PresetItem {
  id: string;
  name: string;
  builtin?: boolean;
  /** One line under the name, e.g. model / size / steps. */
  summary?: string;
}

export interface PresetPickerProps {
  items: PresetItem[];
  selectedId: string | null;
  onApply: (id: string) => void;
  onSaveNew: (name: string) => void;
  onOverwrite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Accessible name of the card. */
  label: string;
  /** What a preset of this screen holds, shown at the top of the list. */
  hint?: string;
  /** Why presets cannot be applied or saved right now (e.g. nothing selected); null or absent when they can. */
  disabledReason?: string | null;
  compact?: boolean;
  testId?: string;
}

const GROUPS = () => [
  { key: 'mine', label: t('presets.group.mine') },
  { key: 'builtin', label: t('presets.group.builtin') },
];

export function PresetPicker(props: PresetPickerProps) {
  const { items, selectedId, compact, testId, disabledReason } = props;
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'rename'; item: PresetItem } | null>(null);
  const current = items.find((i) => i.id === selectedId) ?? null;
  const blocked = !!disabledReason;

  const apply = (item: PresetItem) => {
    props.onApply(item.id);
    toast({ status: 'success', title: t('presets.applied', { name: item.name }) });
  };
  const overwrite = (item: PresetItem) => {
    props.onOverwrite(item.id);
    toast({ status: 'success', title: t('presets.overwritten', { name: item.name }) });
  };

  const trigger = compact ? (
    <button type="button" className="ui-select ui-preset__compact" aria-label={props.label} data-testid="preset-trigger">
      <span className="ui-select__value">{current ? current.name : <span className="ui-select__placeholder">{t('presets.choose')}</span>}</span>
      <CaretDown size={12} />
    </button>
  ) : (
    <button type="button" className="ui-preset__card" aria-label={props.label} data-testid="preset-trigger">
      <span className="ui-preset__text">
        <span className="ui-preset__caption">{t('presets.label')}</span>
        <span className={cx('ui-preset__name', !current && 'is-placeholder')}>{current ? current.name : t('presets.choose')}</span>
        {current?.summary && <span className="ui-preset__summary">{current.summary}</span>}
      </span>
      <CaretDown size={12} />
    </button>
  );

  return (
    <div className={cx('ui-preset', compact && 'ui-preset--compact')} data-testid={testId}>
      <SearchPicker
        trigger={trigger}
        items={items}
        itemKey={(i) => i.id}
        textOf={(i) => `${i.name} ${i.summary ?? ''}`}
        groupOf={(i) => (i.builtin ? 'builtin' : 'mine')}
        groups={GROUPS()}
        groupLabels="multiple"
        searchLabel={t('presets.search')}
        emptyText={t('presets.empty')}
        noMatchText={t('presets.noMatch')}
        className="ui-preset__pop"
        listTestId="preset-list"
        header={
          (props.hint || disabledReason) && (
            <p className={cx('ui-preset__hint', blocked && 'is-blocked')} data-testid="preset-hint">
              {disabledReason || props.hint}
            </p>
          )
        }
        renderItem={(item, close) => (
          <div className={cx('ui-preset__row', item.id === selectedId && 'is-current')} data-testid="preset-item" data-preset-id={item.id}>
            <button
              type="button"
              className="pp-picker__item"
              disabled={blocked}
              title={t('presets.apply')}
              onClick={() => {
                apply(item);
                close();
              }}
            >
              <span className="ui-preset__text">
                <span className="pp-picker__name">{item.name}</span>
                {item.summary && <span className="ui-preset__summary">{item.summary}</span>}
              </span>
              {item.id === selectedId && <Check size={12} />}
            </button>
            <Menu>
              <MenuTrigger asChild>
                <IconButton size="xs" label={t('presets.actions', { name: item.name })} icon={<DotsThree weight="bold" />} tooltip={false} data-testid="preset-item-menu" />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem
                  icon={<Play />}
                  disabled={blocked}
                  onSelect={() => {
                    apply(item);
                    close();
                  }}
                >
                  {t('presets.apply')}
                </MenuItem>
                <MenuItem icon={<FloppyDiskBack />} disabled={blocked} onSelect={() => overwrite(item)}>
                  {t('presets.overwrite')}
                </MenuItem>
                <MenuItem
                  icon={<PencilSimple />}
                  onSelect={() => {
                    close();
                    setDialog({ mode: 'rename', item });
                  }}
                >
                  {t('presets.rename')}
                </MenuItem>
                <MenuSeparator />
                <PressAgainMenuItem
                  icon={<Trash />}
                  danger
                  label={t('presets.delete')}
                  againLabel={t('common.deleteAgain')}
                  onConfirm={() => props.onDelete(item.id)}
                />
              </MenuContent>
            </Menu>
          </div>
        )}
        footer={(close) => (
          <Button
            size="xs"
            variant="outline"
            leftIcon={<FloppyDisk />}
            disabled={blocked}
            data-testid="preset-save-new"
            onClick={() => {
              close();
              setDialog({ mode: 'new' });
            }}
          >
            {t('presets.saveNew')}
          </Button>
        )}
      />
      <IconButton
        size={compact ? 'xs' : 'sm'}
        variant={compact ? 'ghost' : 'outline'}
        label={t('presets.saveNew')}
        tooltip={disabledReason || undefined}
        icon={<FloppyDisk />}
        disabled={blocked}
        data-testid="preset-quick-save"
        onClick={() => setDialog({ mode: 'new' })}
      />
      {dialog?.mode === 'new' && (
        <NameDialog
          title={t('presets.saveNewTitle')}
          initial=""
          onClose={() => setDialog(null)}
          onSubmit={(name) => {
            props.onSaveNew(name);
            toast({ status: 'success', title: t('presets.saved', { name }) });
          }}
        />
      )}
      {dialog?.mode === 'rename' && (
        <NameDialog title={t('presets.renameTitle')} initial={dialog.item.name} onClose={() => setDialog(null)} onSubmit={(name) => props.onRename(dialog.item.id, name)} />
      )}
    </div>
  );
}
