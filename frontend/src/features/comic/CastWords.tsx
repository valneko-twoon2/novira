// The words of a comic character: the general tags, the parts (hair, eyes, face, clothes, body, what it carries) and the
// words kept out of its panels. Shown under the character in boxes that wrap their words, and in a larger window that has
// room for long words (CastWordsDialog); both edit the same character.
import { t } from '@/i18n';
import { CHARACTER_PARTS, CHARACTER_PART_MAX } from '@/state/comic/characterLook';
import { CHARACTER_NEGATIVE_MAX, CHARACTER_TAGS_MAX, type ComicCharacter } from '@/state/comic/document';
import { ErrorBoundary, Modal, Textarea, cx } from '@/ui';

interface WordsProps {
  character: ComicCharacter;
  change: (patch: Partial<ComicCharacter>) => void;
  /** The larger window: one column of taller boxes, and its own test ids. */
  large?: boolean;
}

export function CastWords({ character: c, change, large = false }: WordsProps) {
  const id = (name: string) => (large ? `comic-cast-words-${name}` : `comic-cast-${name}`);
  const rows = large ? 3 : 2;
  return (
    <div className={cx('comic-cast__words', large && 'comic-cast__words--large')}>
      <label className="comic-cast__field">
        <span className="comic-cast__label">{t('comic.cast.label.tags')}</span>
        <Textarea
          value={c.tags}
          rows={rows}
          maxLength={CHARACTER_TAGS_MAX}
          onChange={(e) => change({ tags: e.target.value })}
          placeholder={t('comic.cast.tagsPlaceholder')}
          aria-label={t('comic.cast.tags')}
          data-testid={id('tags')}
        />
      </label>
      <div className="comic-cast__parts">
        {CHARACTER_PARTS.map((part) => (
          <label key={part} className="comic-cast__field">
            <span className="comic-cast__label">{t(`comic.cast.label.${part}`)}</span>
            <Textarea
              value={c.parts?.[part] ?? ''}
              rows={rows}
              maxLength={CHARACTER_PART_MAX}
              onChange={(e) => change({ parts: { ...c.parts, [part]: e.target.value } })}
              placeholder={t(`comic.cast.part.${part}`)}
              aria-label={t(`comic.cast.part.${part}`)}
              data-testid={id(`part-${part}`)}
            />
          </label>
        ))}
      </div>
      <p className="comic-hint">{t('comic.cast.partsHelp')}</p>
      <label className="comic-cast__field">
        <span className="comic-cast__label">{t('comic.cast.label.negative')}</span>
        <Textarea
          value={c.negative ?? ''}
          rows={large ? 2 : 1}
          maxLength={CHARACTER_NEGATIVE_MAX}
          onChange={(e) => change({ negative: e.target.value })}
          placeholder={t('comic.cast.negativePlaceholder')}
          aria-label={t('comic.cast.label.negative')}
          data-testid={id('negative')}
        />
      </label>
      <p className="comic-hint">{t('comic.cast.negativeHelp')}</p>
    </div>
  );
}

/** The words of a character in a larger window, for words too long for the boxes under the character. */
export function CastWordsDialog({ open, onOpenChange, character, change }: WordsProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('comic.cast.wordsTitle', { name: character.name.trim() || t('comic.cast.name') })} size="lg" closeLabel={t('common.close')}>
      <ErrorBoundary area="comic-cast-words">
        <div data-testid="comic-cast-words">
          <CastWords character={character} change={change} large />
        </div>
      </ErrorBoundary>
    </Modal>
  );
}
