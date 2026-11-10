// Entries of the prompt book: click toggles the tag in the target prompt; edit / delete per entry.
import { Check, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import type { PromptBookEntry } from '@/state/prompts/promptBook';
import type { PromptKind } from '@/state/prompts/promptBook';
import { cx, IconButton, PressAgainIconButton } from '@/ui';

/** Rows drawn at first and added each time the end of the list comes near: a book holds a thousand words or more. */
const ROWS_AT_A_TIME = 60;

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
  // Without IntersectionObserver (tests in jsdom) nothing would ever add rows, so all are drawn.
  const [limit, setLimit] = useState(typeof IntersectionObserver === 'undefined' ? Infinity : ROWS_AT_A_TIME);
  const list = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const hasMore = entries.length > limit;
  // A new observer per step: it reports at once, so a tall window that still shows the end gets the next rows too.
  useEffect(() => {
    if (!hasMore || !more.current) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setLimit((n) => n + ROWS_AT_A_TIME), { root: list.current, rootMargin: '400px' });
    observer.observe(more.current);
    return () => observer.disconnect();
  }, [hasMore, limit]);

  if (!entries.length) return <p className="pb-empty">{total ? t('params.promptBook.noMatch') : t('params.promptBook.empty')}</p>;
  return (
    <div ref={list} className="pb-list" data-testid="pb-list">
      {entries.slice(0, limit).map((e) => {
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
      {hasMore && <div ref={more} className="pb-list__more" />}
    </div>
  );
}
