// Wildcard lists dialog: the lists on the left, the chosen list's name and entries (one per line) on the right,
// with .txt import and export. `__name__` in a prompt uses the list.
import { DownloadSimple, Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { t, tCount } from '@/i18n';
import { toast } from '@/state/toasts';
import { useWildcards, wildcardEntries, type WildcardList } from '@/state/prompts/wildcards';
import { Button, cx, Modal, PressAgainButton, Textarea, TextInput } from '@/ui';
import { downloadList, importListFiles } from './wildcardFiles';
import './wildcards.css';

export function WildcardsDialog() {
  const open = useWildcards((s) => s.open);
  const lists = useWildcards((s) => s.lists);
  const selectedId = useWildcards((s) => s.selectedId);
  const store = useWildcards.getState;
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = lists.find((l) => l.id === selectedId) ?? null;

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const names = await importListFiles([...files]);
      const last = useWildcards.getState().lists.find((l) => l.name === names[names.length - 1]);
      if (last) store().select(last.id);
      toast({ status: 'success', title: t('params.wildcards.imported', { names: names.map((n) => `__${n}__`).join(', ') }) });
    } catch (e) {
      toast({ status: 'error', title: t('params.wildcards.importFailed'), description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && store().closeEditor()}
      size="lg"
      closeLabel={t('common.close')}
      title={
        <span className="pb-title">
          {t('params.wildcards.title')}
          <span className="pb-count">{tCount('params.wildcards.listCount', lists.length)}</span>
        </span>
      }
    >
      <div className="wcd" data-testid="wildcards-dialog">
        <p className="wcd__intro">{t('params.wildcards.intro')}</p>
        <div className="wcd__body">
          <nav className="wcd__lists" aria-label={t('params.wildcards.lists')}>
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                className={cx('pb-cat', l.id === selectedId && 'is-active')}
                onClick={() => store().select(l.id)}
                data-testid="wildcard-list"
              >
                <span className="pb-cat__name">{l.name}</span>
                <span className="pb-cat__n">{wildcardEntries(l.text).length}</span>
              </button>
            ))}
            {!lists.length && <p className="pp-hint">{t('params.wildcards.empty')}</p>}
            <div className="wcd__list-actions">
              <Button size="xs" variant="ghost" leftIcon={<Plus />} data-testid="wildcard-new" onClick={() => store().select(store().add('list'))}>
                {t('params.wildcards.new')}
              </Button>
              <Button size="xs" variant="ghost" leftIcon={<UploadSimple />} data-testid="wildcard-import" onClick={() => fileInput.current?.click()}>
                {t('params.wildcards.import')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".txt,text/plain"
                multiple
                hidden
                onChange={(e) => {
                  void importFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </nav>
          <div className="wcd__main">{selected ? <ListEditor key={selected.id} list={selected} /> : <p className="pp-hint">{t('params.wildcards.select')}</p>}</div>
        </div>
      </div>
    </Modal>
  );
}

function ListEditor({ list }: { list: WildcardList }) {
  // The editor is keyed by the list, so the name field starts from the list's name and only this field renames it.
  const [name, setName] = useState(list.name);
  const [error, setError] = useState<string | null>(null);
  const entries = wildcardEntries(list.text).length;

  const commitName = () => {
    if (name === list.name) return setError(null);
    const result = useWildcards.getState().rename(list.id, name.trim());
    setError(result === 'invalid' ? t('params.wildcards.nameInvalid') : result === 'taken' ? t('params.wildcards.nameTaken') : null);
  };

  return (
    <div className="wcd__editor">
      <label className="wcd__field">
        <span>{t('params.wildcards.name')}</span>
        <TextInput
          value={name}
          aria-label={t('params.wildcards.name')}
          aria-invalid={!!error}
          data-testid="wildcard-name"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && commitName()}
        />
      </label>
      {error ? (
        <p className="pp-warn" role="alert">
          {error}
        </p>
      ) : (
        <p className="pp-hint">{t('params.wildcards.usage', { token: `__${list.name}__` })}</p>
      )}
      <label className="wcd__field wcd__field--grow">
        <span>
          {t('params.wildcards.entries')} <span className="pb-count">{tCount('params.wildcards.entryCount', entries)}</span>
        </span>
        <Textarea
          className="wcd__text"
          value={list.text}
          placeholder={t('params.wildcards.entriesPlaceholder')}
          aria-label={t('params.wildcards.entries')}
          data-testid="wildcard-text"
          spellCheck={false}
          onChange={(e) => useWildcards.getState().setText(list.id, e.target.value)}
        />
      </label>
      <div className="wcd__actions">
        <Button size="sm" variant="ghost" leftIcon={<DownloadSimple />} data-testid="wildcard-export" onClick={() => downloadList(list)}>
          {t('params.wildcards.export')}
        </Button>
        <span className="pp-spacer" />
        <PressAgainButton
          size="sm"
          variant="ghost"
          scheme="danger"
          leftIcon={<Trash />}
          data-testid="wildcard-delete"
          againLabel={t('common.deleteAgain')}
          onConfirm={() => useWildcards.getState().remove(list.id)}
        >
          {t('common.delete')}
        </PressAgainButton>
      </div>
    </div>
  );
}
