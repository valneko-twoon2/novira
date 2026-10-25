// Register / edit form of the prompt book.
import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import type { PromptBookEntry, PromptBookInput } from '@/state/prompts/promptBook';
import { Button, TextInput } from '@/ui';

const EMPTY: PromptBookInput = { tag: '', meaning: '', category: '', note: '' };

export function PromptBookForm({
  editing,
  categories,
  onSubmit,
  onCancel,
}: {
  editing: PromptBookEntry | null;
  categories: string[];
  onSubmit: (input: PromptBookInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PromptBookInput>(EMPTY);
  useEffect(() => {
    setForm(editing ? { tag: editing.tag, meaning: editing.meaning, category: editing.category, note: editing.note } : EMPTY);
  }, [editing]);
  const field = (key: keyof PromptBookInput, label: string, placeholder: string, extra?: { list?: string; required?: boolean }) => (
    <TextInput
      className={`pb-form__${key}`}
      value={form[key]}
      placeholder={placeholder}
      aria-label={label}
      data-testid={`pb-${key}`}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      {...extra}
    />
  );
  return (
    <form
      className="pb-form"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.tag.trim()) return;
        onSubmit({ ...form, tag: form.tag.trim() });
        setForm(EMPTY);
      }}
    >
      {field('tag', t('params.promptBook.tag'), t('params.promptBook.tagPlaceholder'), { required: true })}
      {field('meaning', t('params.promptBook.meaning'), t('params.promptBook.meaningPlaceholder'))}
      {field('category', t('params.promptBook.category'), t('params.promptBook.categoryPlaceholder'), { list: 'pb-categories' })}
      <datalist id="pb-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {field('note', t('params.promptBook.note'), t('params.promptBook.notePlaceholder'))}
      <Button type="submit" scheme="accent" variant="solid" disabled={!form.tag.trim()} data-testid="pb-submit">
        {editing ? t('params.promptBook.update') : t('params.promptBook.register')}
      </Button>
      {editing && (
        <Button variant="ghost" onClick={onCancel} data-testid="pb-cancel-edit">
          {t('params.promptBook.stopEditing')}
        </Button>
      )}
    </form>
  );
}
