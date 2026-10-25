// Entries of the prompt book: click toggles the tag in the target prompt; edit / delete per entry.
import { Check, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { PromptBookEntry } from '@/state/prompts/promptBook';
import type { PromptKind } from '@/state/prompts/promptBook';
import { cx, IconButton, PressAgainIconButton } from '@/ui';

export function PromptBookList({
  entries,
  total,
  isUsed,
  onToggle,
  onEdit,
  onDelete,
}: {
  entries: PromptBookEntry[];
  total: number;
  isUsed: (tag: string, kind: PromptKind) => boolean;
  onToggle: (tag: string, kind: PromptKind) => void;
  onEdit: (entry: PromptBookEntry) => void;
  onDelete: (entry: PromptBookEntry) => void;
}) {
  if (!entries.length) return <p className="pb-empty">{total ? t('params.promptBook.noMatch') : t('params.promptBook.empty')}</p>;
  return (
    <div className="pb-list" data-testid="pb-list">
      {entries.map((e) => {
        const usedPos = isUsed(e.tag, 'positive');
        const usedNeg = isUsed(e.tag, 'negative');
        return (
          <article key={e.id} className={cx('pb-item', (usedPos || usedNeg) && 'is-used')}>
            <div className="pb-item__main">
              <span className="pb-item__head">
                <b className="pb-item__tag">{e.tag}</b>
                {e.category && <span className="pb-pill">{e.category}</span>}
              </span>
              {e.meaning && <span className="pb-item__meaning">{e.meaning}</span>}
              {e.note && <span className="pb-item__note">{e.note}</span>}
            </div>
            <span className="pb-item__targets">
              {(['positive', 'negative'] as const).map((k) => {
                const used = k === 'positive' ? usedPos : usedNeg;
                return (
                  <button
                    key={k}
                    type="button"
                    className={cx('pb-target', `pb-target--${k}`, used && 'is-on')}
                    title={used ? t('params.promptBook.removeHint') : t('params.promptBook.addHint')}
                    onClick={() => onToggle(e.tag, k)}
                  >
                    {used ? <Check size={12} weight="bold" /> : <Plus size={12} weight="bold" />}
                    {k === 'positive' ? t('params.prompt.positive') : t('params.prompt.negative')}
                  </button>
                );
              })}
            </span>
            <span className="pb-item__acts">
              <IconButton size="xs" label={t('common.edit')} icon={<PencilSimple />} onClick={() => onEdit(e)} />
              <PressAgainIconButton
                size="xs"
                scheme="danger"
                label={t('common.delete')}
                againLabel={t('common.deleteAgain')}
                icon={<Trash />}
                onConfirm={() => onDelete(e)}
              />
            </span>
          </article>
        );
      })}
    </div>
  );
}
