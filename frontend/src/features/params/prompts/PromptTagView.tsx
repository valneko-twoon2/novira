// The prompt shown as tags: each entry is a chip, and pressing one opens a popover to set its strength or remove it.
import { ArrowCounterClockwise, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import {
  addTag,
  MAX_TAG_WEIGHT,
  MIN_TAG_WEIGHT,
  parseWeightedTags,
  removeTagAt,
  setTagWeightAt,
} from '@/state/prompts/promptTags';
import { Button, cx, IconButton, Popover, PopoverContent, PopoverTrigger, SliderNumber, TextInput } from '@/ui';

interface Props {
  value: string;
  onChange: (text: string) => void;
  kind: 'positive' | 'negative';
}

export function PromptTagView({ value, onChange, kind }: Props) {
  const tags = parseWeightedTags(value);
  const [draft, setDraft] = useState('');
  const commit = () => {
    if (draft.trim()) onChange(addTag(value, draft));
    setDraft('');
  };
  return (
    <div className={cx('pp-tags', `pp-tags--${kind}`)} data-testid={`${kind}-tags`}>
      <div className="pp-tags__list">
        {tags.map((tag, i) => (
          <Popover key={`${i}-${tag.text}`}>
            <PopoverTrigger asChild>
              <button type="button" className={cx('pp-tag', tag.weight !== 1 && 'is-weighted')} data-testid={`${kind}-tag`}>
                <span className="pp-tag__text">{tag.text}</span>
                {tag.weight !== 1 && <span className="pp-tag__weight">{tag.weight}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="pp-tagpop">
              <div className="pp-tagpop__title">{tag.text}</div>
              <SliderNumber
                value={tag.weight}
                min={MIN_TAG_WEIGHT}
                max={MAX_TAG_WEIGHT}
                step={0.05}
                precision={2}
                aria-label={t('params.prompt.tagStrength')}
                onChange={(w) => onChange(setTagWeightAt(value, i, w))}
              />
              <div className="pp-tagpop__actions">
                <Button size="xs" variant="ghost" leftIcon={<ArrowCounterClockwise />} disabled={tag.weight === 1} onClick={() => onChange(setTagWeightAt(value, i, 1))}>
                  {t('params.prompt.tagReset')}
                </Button>
                <IconButton size="xs" label={t('params.prompt.tagRemove')} icon={<Trash />} onClick={() => onChange(removeTagAt(value, i))} />
              </div>
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
