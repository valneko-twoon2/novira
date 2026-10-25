// Prompt list dialog: category navigation, search, register form and the tag list. On a phone it is a screen of its own
// (a back control and the list across the whole screen) instead of a dialog.
import { CaretLeft, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';
import { usePhoneLayout } from '@/state/layout';
import { useParams } from '@/state/params';
import { usePromptBook, type PromptBookEntry } from '@/state/prompts/promptBook';
import type { PromptKind } from '@/state/prompts/promptBook';
import { cx, Modal, TextInput } from '@/ui';
import { getPrompt, setPrompt } from '../prompts/promptActions';
import { addTag, hasTag, removeTag } from '@/state/prompts/promptTags';
import { PromptBookForm } from './PromptBookForm';
import { PromptBookList } from './PromptBookList';
import { matchesEntry } from './promptBookSearch';

export function PromptBookDialog() {
  const open = usePromptBook((s) => s.open);
  const entries = usePromptBook((s) => s.entries);
  const book = usePromptBook.getState;
  const positive = useParams((s) => s.positivePrompt);
  const negative = useParams((s) => s.negativePrompt);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<PromptBookEntry | null>(null);

  const categories = useMemo(() => [...new Set(entries.map((e) => e.category).filter(Boolean))], [entries]);
  const shown = useMemo(
    () => entries.filter((e) => (category === null || e.category === category) && matchesEntry(e, query)),
    [entries, category, query],
  );

  const toggle = (tag: string, kind: PromptKind) => setPrompt(kind, hasTag(getPrompt(kind), tag) ? removeTag(getPrompt(kind), tag) : addTag(getPrompt(kind), tag));
  const phone = usePhoneLayout();
  const count = (c: string | null) => (c === null ? entries.length : entries.filter((e) => e.category === c).length);

  const content = (
    <div className="pb" data-testid="prompt-book">
      <PromptBookForm
        editing={editing}
        categories={categories}
        onCancel={() => setEditing(null)}
        onSubmit={(input) => {
          if (editing) book().update(editing.id, input);
          else book().add(input);
          setEditing(null);
        }}
      />
      <div className="pb-body">
        <nav className="pb-cats" aria-label={t('params.promptBook.category')}>
          {[null, ...categories].map((c) => (
            <button key={c ?? '__all__'} type="button" className={cx('pb-cat', category === c && 'is-active')} onClick={() => setCategory(c)}>
              <span className="pb-cat__name">{c ?? t('params.promptBook.all')}</span>
              <span className="pb-cat__n">{count(c)}</span>
            </button>
          ))}
        </nav>
        <div className="pb-main">
          <div className="pb-tools">
            <span className="pb-search">
              <MagnifyingGlass size={14} />
              <TextInput
                type="search"
                value={query}
                placeholder={t('params.promptBook.searchPlaceholder')}
                aria-label={t('params.promptBook.search')}
                data-testid="pb-search"
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </div>
          <PromptBookList
            entries={shown}
            total={entries.length}
            isUsed={(tag, kind) => hasTag(kind === 'positive' ? positive : negative, tag)}
            onToggle={toggle}
            onEdit={setEditing}
            onDelete={(e) => {
              book().remove(e.id);
              if (editing?.id === e.id) setEditing(null);
            }}
          />
        </div>
      </div>
    </div>
  );
  const totalText = t('params.promptBook.count', { count: entries.length });

  if (phone) {
    return open ? createPortal(<PhoneScreen title={t('params.promptBook.title')} count={totalText} onBack={() => book().closeBook()}>{content}</PhoneScreen>, document.body) : null;
  }
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && book().closeBook()}
      size="xl"
      closeLabel={t('common.close')}
      title={
        <span className="pb-title">
          {t('params.promptBook.title')}
          <span className="pb-count">{totalText}</span>
        </span>
      }
    >
      {content}
    </Modal>
  );
}

/** The phone's version of the dialog: the whole screen with a back control above the list. */
function PhoneScreen({ title, count, onBack, children }: { title: string; count: string; onBack: () => void; children: ReactNode }) {
  // Escape closes it, as it closes the dialog (a keyboard on a tablet, a screen reader).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onBack]);
  return (
    <section className="pb-screen" role="dialog" aria-modal="true" aria-label={title} data-testid="prompt-book-screen">
      <header className="pb-screen__top">
        <button type="button" className="pb-screen__back" aria-label={t('common.back')} onClick={onBack} data-testid="prompt-book-back">
          <CaretLeft size={22} />
        </button>
        <h2 className="pb-screen__title">
          {title}
          <span className="pb-count">{count}</span>
        </h2>
      </header>
      <div className="pb-screen__body">{children}</div>
    </section>
  );
}
