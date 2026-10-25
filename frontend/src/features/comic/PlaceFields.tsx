// One place of the comic, edited: its name, the words that draw it the same way in every panel set there, and the words
// kept out of those panels, in boxes that wrap their words.
import { Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { PLACE_NAME_MAX, PLACE_NEGATIVE_MAX, PLACE_TAGS_MAX, type ComicPlace } from '@/state/comic/document';
import { IconButton, Textarea, TextInput } from '@/ui';

export function PlaceFields({ place, change, remove }: { place: ComicPlace; change: (patch: Partial<ComicPlace>) => void; remove: () => void }) {
  return (
    <div className="comic-place" data-testid="comic-place">
      <div className="comic-place__head">
        <TextInput
          value={place.name}
          maxLength={PLACE_NAME_MAX}
          onChange={(e) => change({ name: e.target.value })}
          placeholder={t('comic.place.name')}
          aria-label={t('comic.place.name')}
          data-testid="comic-place-name"
        />
        <IconButton size="sm" label={t('comic.place.remove')} icon={<Trash />} onClick={remove} data-testid="comic-place-remove" />
      </div>
      <label className="comic-place__field">
        <span className="comic-place__label">{t('comic.place.tags')}</span>
        <Textarea
          value={place.tags}
          rows={2}
          maxLength={PLACE_TAGS_MAX}
          onChange={(e) => change({ tags: e.target.value })}
          placeholder={t('comic.place.tagsPlaceholder')}
          aria-label={t('comic.place.tags')}
          data-testid="comic-place-tags"
        />
      </label>
      <label className="comic-place__field">
        <span className="comic-place__label">{t('comic.place.negative')}</span>
        <Textarea
          value={place.negative ?? ''}
          rows={1}
          maxLength={PLACE_NEGATIVE_MAX}
          onChange={(e) => change({ negative: e.target.value })}
          placeholder={t('comic.place.negativePlaceholder')}
          aria-label={t('comic.place.negative')}
          data-testid="comic-place-negative"
        />
      </label>
    </div>
  );
}
