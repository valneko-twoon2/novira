// Editable workflow details (name, author, description, version, tags, notes, contact).
import { t } from '@/i18n';
import { useWorkflows, type WorkflowMeta } from '@/state/workflows/workflows';
import { Field, TextInput, Textarea } from '@/ui';

type TextKey = 'name' | 'author' | 'version' | 'tags' | 'contact';
type AreaKey = 'description' | 'notes';

const LINES: { key: TextKey; label: () => string }[] = [
  { key: 'name', label: () => t('workflows.details.name') },
  { key: 'author', label: () => t('workflows.details.author') },
  { key: 'version', label: () => t('workflows.details.version') },
  { key: 'tags', label: () => t('workflows.details.tags') },
  { key: 'contact', label: () => t('workflows.details.contact') },
];

const AREAS: { key: AreaKey; label: () => string }[] = [
  { key: 'description', label: () => t('workflows.details.description') },
  { key: 'notes', label: () => t('workflows.details.notes') },
];

export function DetailsView() {
  const meta = useWorkflows((s) => s.meta);
  const setMeta = useWorkflows((s) => s.setMeta);
  const set = (key: keyof WorkflowMeta, v: string) => setMeta({ [key]: v });
  return (
    <div className="wf-details" data-testid="wf-details">
      {LINES.map(({ key, label }) => (
        <Field key={key} label={label()} orientation="vertical">
          <TextInput value={meta[key]} onChange={(e) => set(key, e.target.value)} aria-label={label()} placeholder={key === 'tags' ? t('workflows.details.tagsHint') : undefined} />
        </Field>
      ))}
      {AREAS.map(({ key, label }) => (
        <Field key={key} label={label()} orientation="vertical">
          <Textarea rows={4} value={meta[key]} onChange={(e) => set(key, e.target.value)} aria-label={label()} />
        </Field>
      ))}
    </div>
  );
}
