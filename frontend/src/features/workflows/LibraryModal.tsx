// Workflow Library: browse, search, filter by tag, open, copy, delete, upload and create workflows.
import { ClockCounterClockwise, Copy, FilePlus, FolderOpen, MagnifyingGlass, Sparkle, Trash, UploadSimple, User } from '@phosphor-icons/react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { SavedWorkflow } from '@/backend';
import { getLocale, t } from '@/i18n';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { Badge, Button, Checkbox, EmptyState, IconButton, Modal, Select, TextInput, cx } from '@/ui';
import { copyToMyWorkflows, deleteLibraryWorkflow, newWorkflow, openLibraryWorkflow } from './actions';
import { confirmDiscard, useDialogs } from './dialogs';

type View = 'recent' | 'user' | 'default';
type Sort = 'opened' | 'name' | 'updated';

export function LibraryModal() {
  const open = useUi((s) => s.modal === 'workflowLibrary');
  const openModal = useUi((s) => s.openModal);
  // Keep the library above the confirm dialog: only close when the confirm is not showing.
  const confirming = useDialogs((s) => !!s.pending);
  return (
    <Modal open={open && !confirming} onOpenChange={(o) => !o && openModal(null)} title={t('workflows.library.title')} size="xl" closeLabel={t('common.close')}>
      {open && <LibraryBody />}
    </Modal>
  );
}

function LibraryBody() {
  const library = useWorkflows((s) => s.library);
  const recentIds = useWorkflows((s) => s.recentIds);
  const currentId = useWorkflows((s) => s.meta.id);
  const [view, setView] = useState<View>(() => (useWorkflows.getState().library.some((w) => w.category === 'user') ? 'user' : 'default'));
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('opened');
  const fileRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(() => [...new Set(library.flatMap((w) => w.tags))].filter((x) => x !== 'default').sort((a, b) => a.localeCompare(b)), [library]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list =
      view === 'recent'
        ? recentIds.map((id) => library.find((w) => w.id === id)).filter((w): w is SavedWorkflow => !!w)
        : library.filter((w) => w.category === view);
    if (q) list = list.filter((w) => [w.name, w.description, w.author, ...w.tags].join(' ').toLowerCase().includes(q));
    if (tags.length) list = list.filter((w) => tags.every((tag) => w.tags.includes(tag)));
    if (view !== 'recent' || sort !== 'opened') {
      const rank = (w: SavedWorkflow) => {
        const i = recentIds.indexOf(w.id);
        return i < 0 ? Number.MAX_SAFE_INTEGER : i;
      };
      list = [...list].sort((a, b) =>
        sort === 'name' ? a.name.localeCompare(b.name) : sort === 'updated' ? b.updatedAt - a.updatedAt : rank(a) - rank(b) || a.name.localeCompare(b.name),
      );
    }
    return list;
  }, [library, recentIds, view, query, tags, sort]);

  const counts = {
    recent: recentIds.filter((id) => library.some((w) => w.id === id)).length,
    user: library.filter((w) => w.category === 'user').length,
    default: library.filter((w) => w.category === 'default').length,
  };

  return (
    <div className="wf-lib" data-testid="wf-library">
      <nav className="wf-lib__nav">
        <NavItem icon={<ClockCounterClockwise size={16} />} active={view === 'recent'} count={counts.recent} onClick={() => setView('recent')}>
          {t('workflows.library.recent')}
        </NavItem>
        <NavItem icon={<User size={16} />} active={view === 'user'} count={counts.user} onClick={() => setView('user')}>
          {t('workflows.library.yours')}
        </NavItem>
        <NavItem icon={<Sparkle size={16} />} active={view === 'default'} count={counts.default} onClick={() => setView('default')}>
          {t('workflows.library.defaults')}
        </NavItem>
        <div className="wf-lib__navlabel">{t('workflows.library.tags')}</div>
        <div className="wf-lib__tags">
          {allTags.map((tag) => (
            <Checkbox key={tag} label={tag} checked={tags.includes(tag)} onChange={(v) => setTags(v ? [...tags, tag] : tags.filter((x) => x !== tag))} />
          ))}
        </div>
        {tags.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => setTags([])}>
            {t('workflows.library.clearTags')}
          </Button>
        )}
        <span className="wf-lib__navspacer" />
        <Button size="sm" leftIcon={<FilePlus size={14} />} onClick={() => confirmDiscard(() => { newWorkflow(); useUi.getState().openModal(null); })}>
          {t('workflows.library.new')}
        </Button>
        <Button size="sm" leftIcon={<UploadSimple size={14} />} onClick={() => fileRef.current?.click()}>
          {t('workflows.library.upload')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) useWorkflows.getState().loadFile(f);
          }}
        />
      </nav>
      <div className="wf-lib__main">
        <div className="wf-lib__bar">
          <div className="wf-lib__search">
            <MagnifyingGlass size={14} />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('workflows.library.search')} aria-label={t('workflows.library.search')} />
          </div>
          <Select<Sort>
            value={sort}
            onChange={setSort}
            aria-label={t('workflows.library.sort')}
            options={[
              { value: 'opened', label: t('workflows.library.sortOpened') },
              { value: 'updated', label: t('workflows.library.sortUpdated') },
              { value: 'name', label: t('workflows.library.sortName') },
            ]}
          />
        </div>
        <div className="wf-lib__list">
          {items.length === 0 ? (
            <EmptyState icon={<FolderOpen size={28} />} title={t('workflows.library.empty')} description={view === 'user' ? t('workflows.library.emptyUser') : undefined} />
          ) : (
            items.map((wf) => <WorkflowCard key={wf.id} wf={wf} isCurrent={wf.id === currentId} />)
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, active, count, onClick, children }: { icon: ReactNode; active: boolean; count: number; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={cx('wf-lib__navitem', active && 'is-active')} onClick={onClick}>
      {icon}
      <span>{children}</span>
      <span className="wf-lib__count">{count}</span>
    </button>
  );
}

function WorkflowCard({ wf, isCurrent }: { wf: SavedWorkflow; isCurrent: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const date = new Date(wf.updatedAt).toLocaleDateString(getLocale());
  return (
    <div className={cx('wf-card', isCurrent && 'is-current')} data-testid="wf-card">
      <button type="button" className="wf-card__main" onClick={() => confirmDiscard(() => openLibraryWorkflow(wf))}>
        <div className="wf-card__title">
          {wf.name}
          {isCurrent && <Badge scheme="accent">{t('workflows.library.opened')}</Badge>}
        </div>
        {wf.description && <div className="wf-card__desc">{wf.description}</div>}
        <div className="wf-card__meta">
          {wf.author && <span>{t('workflows.library.by', { author: wf.author })}</span>}
          <span>{t('workflows.library.updated', { date })}</span>
        </div>
        <div className="wf-card__tags">
          {wf.tags
            .filter((tag) => tag !== 'default')
            .map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
        </div>
      </button>
      <div className="wf-card__actions">
        <Button size="xs" scheme="accent" onClick={() => confirmDiscard(() => openLibraryWorkflow(wf))}>
          {t('workflows.library.open')}
        </Button>
        {wf.category === 'default' && (
          <IconButton label={t('workflows.library.copyToMine')} icon={<Copy size={14} />} size="xs" onClick={() => void copyToMyWorkflows(wf)} />
        )}
        {wf.category === 'user' &&
          (confirmDelete ? (
            <>
              <Button size="xs" scheme="danger" onClick={() => void deleteLibraryWorkflow(wf)}>
                {t('common.delete')}
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <IconButton label={t('common.delete')} icon={<Trash size={14} />} size="xs" scheme="danger" onClick={() => setConfirmDelete(true)} />
          ))}
      </div>
    </div>
  );
}
