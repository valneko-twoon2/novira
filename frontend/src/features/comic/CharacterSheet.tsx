// The sheet of a comic character in the design tab: its picture from the front and from the other sides, the button that
// draws the views it lacks (see makeSheet), and a line saying which LoRA its panels use. A panel takes the view its framing needs as the character's reference.
import { X } from '@phosphor-icons/react';
import { useShallow } from 'zustand/react/shallow';
import { t } from '@/i18n';
import { useCharacters } from '@/state/characters';
import { allWords } from '@/state/comic/characterLook';
import { missingViews } from '@/state/comic/characterSheet';
import { SHEET_VIEWS, type ComicCharacter, type SheetView } from '@/state/comic/document';
import { makeSheet } from '@/state/comic/generate';
import { characterLora } from '@/state/comic/request';
import { useComic } from '@/state/comic/store';
import { findImage, useGallery } from '@/state/gallery';
import { findModel } from '@/state/models';
import { Button, IconButton } from '@/ui';

type Slot = 'front' | SheetView;
const SLOTS: readonly Slot[] = ['front', ...SHEET_VIEWS];

export function CharacterSheet({ projectId, cast, character }: { projectId: string; cast: ComicCharacter[]; character: ComicCharacter }) {
  // The pictures reach the gallery after the sheet names them, and the library holds the LoRA: both redraw the sheet.
  useGallery((s) => s.images);
  useCharacters((s) => s.presets);
  const drawing = useComic(useShallow((s) => Object.values(s.sheetPending).flatMap((p) => (p.projectId === projectId && p.characterId === character.id ? [p.view] : []))));
  const pictureOf = (slot: Slot) => (slot === 'front' ? character.imageName : (character.sheet?.[slot] ?? null));
  const remove = (slot: Slot) => {
    if (slot === 'front') useComic.getState().setCast(cast.map((c) => (c.id === character.id ? { ...c, imageName: null } : c)));
    else useComic.getState().setCharacterView(projectId, character.id, slot, null);
  };
  const lora = characterLora(character);
  const toDraw = missingViews(character).filter((view) => !drawing.includes(view));
  return (
    <div className="comic-sheet" data-testid="comic-sheet">
      <span className="comic-cast__label">{t('comic.sheet.title')}</span>
      <div className="comic-sheet__views">
        {SLOTS.map((slot) => {
          const name = pictureOf(slot);
          const image = name ? findImage(name) : undefined;
          const label = t(`comic.sheet.view.${slot}`);
          return (
            <figure key={slot} className="comic-sheet__view" data-testid={`comic-sheet-view-${slot}`} data-has={image ? 'yes' : 'no'}>
              <div className="comic-sheet__frame">
                {image ? <img src={image.thumbnailUrl || image.url} alt={t('comic.sheet.alt', { name: character.name, view: label })} /> : null}
                {slot !== 'front' && drawing.includes(slot) ? <span className="comic-sheet__drawing">{t('comic.sheet.drawing')}</span> : null}
                {name ? <IconButton size="xs" className="comic-sheet__remove" label={t('comic.sheet.remove', { view: label })} icon={<X />} onClick={() => remove(slot)} data-testid={`comic-sheet-remove-${slot}`} /> : null}
              </div>
              <figcaption>{label}</figcaption>
            </figure>
          );
        })}
      </div>
      <div className="comic-detail__row">
        <Button variant="outline" size="xs" disabled={!allWords(character) || !toDraw.length} onClick={() => void makeSheet(character.id)} data-testid="comic-sheet-make">
          {t('comic.sheet.make')}
        </Button>
      </div>
      <p className="comic-hint">{t('comic.sheet.help')}</p>
      {lora ? (
        <p className="comic-hint" data-testid="comic-sheet-lora-on">
          {t('comic.sheet.loraOn', { name: findModel(lora.key)?.name ?? lora.key })}
        </p>
      ) : null}
    </div>
  );
}
