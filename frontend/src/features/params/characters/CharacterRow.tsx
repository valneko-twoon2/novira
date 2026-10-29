// The character picker above the reference images: choose a saved character to set up its reference image and words,
// edit or delete one, or register the pictures selected in the gallery as a new one.
import { CaretDown, Check, DotsThree, PencilSimple, Plus, Trash, UserFocus } from '@phosphor-icons/react';
import { t, tCount } from '@/i18n';
import { CHARACTER_CFG, MAX_REFERENCE_IMAGES, useCharacters } from '@/state/characters';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useGallery } from '@/state/gallery';
import { toast } from '@/state/toasts';
import { Button, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, PressAgainMenuItem, SearchPicker, cx } from '@/ui';
import { applyCharacter, type AppliedCharacter } from './applyCharacter';
import './characters.css';

/** What a use of a character left out or changed, in a sentence for the notification. */
function usedNotes(applied: AppliedCharacter): string {
  return [
    applied.cfgLowered ? t('character.row.cfgLowered', { cfg: CHARACTER_CFG }) : '',
    applied.capped ? t('character.row.capped', { max: MAX_REFERENCE_IMAGES, used: applied.used }) : '',
    applied.missing ? t('character.row.missingSome', { count: applied.missing }) : '',
    applied.lora === 'gone' ? t('lora.goneNote') : applied.lora === 'used' ? t('lora.usedNote') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function CharacterRow() {
  const characters = useCharacters((s) => s.presets);
  const selectedId = useCharacters((s) => s.selectedId);
  const current = characters.find((c) => c.id === selectedId) ?? null;

  const registerSelected = () => {
    const { selection, images } = useGallery.getState();
    const picked = images.filter((i) => selection.includes(i.name) && (i.mediaType ?? 'image') === 'image');
    if (!picked.length) {
      toast({ status: 'info', title: t('character.noSelection') });
      return;
    }
    useCharacterDialog.getState().open({ imageNames: picked.map((i) => i.name) });
  };

  return (
    <div className="pp-chars" data-testid="character-row">
      <span className="pp-chars__icon" aria-hidden>
        <UserFocus size={14} />
      </span>
      <SearchPicker
        trigger={
          <button type="button" className="ui-select pp-chars__trigger" aria-label={`${t('character.row.label')}: ${current ? current.name : t('character.row.choose')}`} data-testid="character-trigger">
            <span className="ui-select__value">{current ? current.name : <span className="ui-select__placeholder">{t('character.row.choose')}</span>}</span>
            <CaretDown size={12} />
          </button>
        }
        items={characters}
        itemKey={(c) => c.id}
        textOf={(c) => `${c.name} ${c.data.tags}`}
        searchLabel={t('character.row.search')}
        emptyText={t('character.row.empty')}
        noMatchText={t('presets.noMatch')}
        className="ui-preset__pop"
        listTestId="character-list"
        header={<p className="ui-preset__hint">{t('character.row.hint')}</p>}
        renderItem={(c, close) => (
          <div className={cx('ui-preset__row', c.id === selectedId && 'is-current')} data-testid="character-item">
            <button
              type="button"
              className="pp-picker__item"
              title={t('character.row.use')}
              onClick={() => {
                const applied = applyCharacter(c.id);
                const notes = applied ? usedNotes(applied) : '';
                if (applied) toast({ status: 'success', title: t('character.row.used', { name: c.name }), ...(notes ? { description: notes } : {}) });
                close();
              }}
            >
              <span className="ui-preset__text">
                <span className="pp-picker__name">{c.name}</span>
                <span className="ui-preset__summary">{[tCount('character.row.count', c.data.imageNames.length), c.data.tags].filter(Boolean).join(' · ')}</span>
              </span>
              {c.id === selectedId && <Check size={12} />}
            </button>
            <Menu>
              <MenuTrigger asChild>
                <IconButton size="xs" label={t('presets.actions', { name: c.name })} icon={<DotsThree weight="bold" />} tooltip={false} data-testid="character-item-menu" />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem
                  icon={<PencilSimple />}
                  onSelect={() => {
                    close();
                    useCharacterDialog.getState().open({ imageNames: c.data.imageNames, name: c.name, editId: c.id });
                  }}
                >
                  {t('character.row.edit')}
                </MenuItem>
                <MenuSeparator />
                <PressAgainMenuItem
                  icon={<Trash />}
                  danger
                  label={t('presets.delete')}
                  againLabel={t('common.deleteAgain')}
                  onConfirm={() => useCharacters.getState().remove(c.id)}
                />
              </MenuContent>
            </Menu>
          </div>
        )}
        footer={(close) => (
          <Button
            size="xs"
            variant="outline"
            leftIcon={<Plus />}
            data-testid="character-register"
            onClick={() => {
              close();
              registerSelected();
            }}
          >
            {t('character.row.register')}
          </Button>
        )}
      />
    </div>
  );
}
