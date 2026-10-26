// The prompt shown as tags: each entry is a chip, and pressing one opens a popover to rename it, set its strength or remove it.
import { ArrowCounterClockwise, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import {
  addTag,
  MAX_TAG_WEIGHT,
  MIN_TAG_WEIGHT,
  parseWeightedTags,
  removeTagAt,
  setTagTextAt,
  setTagWeightAt,
  type WeightedTag,
} from '@/state/prompts/promptTags';
import { cx, IconButton, Popover, PopoverContent, PopoverTrigger, SliderNumber, TextInput } from '@/ui';

interface Props {
  value: string;
  onChange: (text: string) => void;
  kind: 'positive' | 'negative';
}

export function PromptTagView({ value, onChange, kind }: Props) {
  const tags = parseWeightedTags(value);
  const [draft, setDraft] = useState('');
  // The tag whose popover is open: its strength stays on the chip while it is dragged through 1, so the chip keeps its width.
  const [openAt, setOpenAt] = useState<number | null>(null);
  const commit = () => {
    if (draft.trim()) onChange(addTag(value, draft));
    setDraft('');
  };
  return (
    <div className={cx('pp-tags', `pp-tags--${kind}`)} data-testid={`${kind}-tags`}>
      <div className="pp-tags__list">
        {tags.map((tag, i) => (
          // Keyed by place, not by words: renaming a tag must not close its own popover.
          <Popover key={i} open={openAt === i} onOpenChange={(open) => setOpenAt(open ? i : null)}>
            <PopoverTrigger asChild>
              <button type="button" className={cx('pp-tag', tag.weight !== 1 && 'is-weighted')} data-testid={`${kind}-tag`}>
                <span className="pp-tag__text">{tag.text}</span>
                {(tag.weight !== 1 || openAt === i) && <span className="pp-tag__weight">{tag.weight.toFixed(2)}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="pp-tagpop" align="start">
              <TagEditor kind={kind} tag={tag} onRename={(text) => onChange(setTagTextAt(value, i, text))} onWeight={(w) => onChange(setTagWeightAt(value, i, w))} onRemove={() => onChange(removeTagAt(value, i))} />
            </PopoverContent>
          </Popover>
        ))}
        <TextInput
          className="pp-tags__add"
          value={draft}
          placeholder={t('params.prompt.tagAdd')}
          aria-label={t('params.prompt.tagAdd')}
          data-testid={`${kind}-tag-add`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            }
          }}
        />
      </div>
    </div>
  );
}

/** The popover of one tag: its words (saved on Enter or when the field is left), its strength, back to 1, remove. */
function TagEditor({ kind, tag, onRename, onWeight, onRemove }: { kind: Props['kind']; tag: WeightedTag; onRename: (text: string) => void; onWeight: (w: number) => void; onRemove: () => void }) {
  const [name, setName] = useState(tag.text);
  const save = () => {
    if (name.trim() && name.trim() !== tag.text) onRename(name);
    else setName(tag.text);
  };
  return (
    <>
      <TextInput
        value={name}
        aria-label={t('params.prompt.tagName')}
        data-testid={`${kind}-tag-name`}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
      />
      <SliderNumber value={tag.weight} min={MIN_TAG_WEIGHT} max={MAX_TAG_WEIGHT} step={0.05} precision={2} aria-label={t('params.prompt.tagStrength')} onChange={onWeight} />
      <div className="pp-tagpop__actions">
        <IconButton size="xs" label={t('params.prompt.tagReset')} icon={<ArrowCounterClockwise />} disabled={tag.weight === 1} onClick={() => onWeight(1)} />
        <IconButton size="xs" label={t('params.prompt.tagRemove')} icon={<Trash />} onClick={onRemove} />
      </div>
    </>
  );
}
