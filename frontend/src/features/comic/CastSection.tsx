// The comic's cast: the people and animals whose words (hair, clothes, ...) are put in front of a panel's prompt, so each
// looks the same in every panel. A list of the characters on top, in the panel tools each with whether it is in the
// selected panel, and the words of the chosen one below, one character at a time (see CastCharacter). The AI assistant can
// write them too. Without a panel (the design tab) the panel-bound parts are left out.
import { UserPlus } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { CAST_MAX, newComicId, type ComicCharacter } from '@/state/comic/document';
import { useComic } from '@/state/comic/store';
import { findImage, useGallery } from '@/state/gallery';
import { Button, Checkbox, cx } from '@/ui';
import { CastCharacter } from './CastCharacter';

export function CastSection({
  panelId,
  panelCast = [],
  panelImage = null,
  cast,
  posePeople = 0,
  poseCast = [],
}: {
  panelId?: string;
  panelCast?: string[];
  panelImage?: string | null;
  cast: ComicCharacter[];
  /** How many people the panel's pose has. */
  posePeople?: number;
  /** Who each of them is (cast ids or null). */
  poseCast?: (string | null)[];
}) {
  const store = useComic.getState;
  // The pictures reach the gallery after the cast names them.
  useGallery((s) => s.images);
  const [chosen, setChosen] = useState<string | null>(null);
  // A character that is gone (removed, another comic) gives way to the first one.
  const selected = cast.find((c) => c.id === chosen) ?? cast[0] ?? null;
  const add = () => {
    const id = newComicId('character');
    store().setCast([...cast, { id, name: t('comic.cast.newName', { number: cast.length + 1 }), tags: '', imageName: null }]);
    setChosen(id);
  };
  return (
    <div className="comic-cast" data-testid="comic-cast">
      {panelId && cast.length > 0 && <p className="comic-hint">{t('comic.cast.inPanelHelp')}</p>}
      <div className="comic-cast__roster" role="list" aria-label={t('comic.cast.list')}>
        {cast.map((c) => {
          const picture = c.imageName ? findImage(c.imageName) : undefined;
          const name = c.name.trim() || t('comic.cast.name');
          return (
            <div key={c.id} role="listitem" className={cx('comic-cast__entry', c.id === selected?.id && 'is-on')} data-testid="comic-cast-entry">
              {panelId && (
                <Checkbox
                  checked={panelCast.includes(c.id)}
                  onChange={(on) => store().setPanelCast(panelId, on ? [...panelCast, c.id] : panelCast.filter((id) => id !== c.id))}
                  label={<span className="comic-cast__sr">{t('comic.cast.inPanelOf', { name })}</span>}
                />
              )}
              <button type="button" className="comic-cast__pick" aria-pressed={c.id === selected?.id} onClick={() => setChosen(c.id)} data-testid="comic-cast-pick">
                {picture ? <img className="comic-cast__avatar" src={picture.thumbnailUrl || picture.url} alt="" /> : <span className="comic-cast__avatar" aria-hidden>{name.slice(0, 1)}</span>}
                <span className="comic-cast__entry-name">{name}</span>
              </button>
            </div>
          );
        })}
        <Button variant="outline" size="sm" leftIcon={<UserPlus />} disabled={cast.length >= CAST_MAX} onClick={add} data-testid="comic-cast-add">
          {t('comic.cast.add')}
        </Button>
      </div>
      {selected && (
        <CastCharacter
          key={selected.id}
          character={selected}
          cast={cast}
          {...(panelId ? { panelId } : {})}
          panelCast={panelCast}
          panelImage={panelImage}
          posePeople={posePeople}
          poseCast={poseCast}
        />
      )}
      {panelId && posePeople > 0 && <p className="comic-hint">{t('comic.cast.posePersonHelp')}</p>}
      <p className="comic-hint">{t('comic.cast.help')}</p>
    </div>
  );
}
