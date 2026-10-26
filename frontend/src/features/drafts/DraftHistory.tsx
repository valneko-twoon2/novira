// The draft history: every batch on one large screen, narrowed by period and model, searched by prompt, split by day.
// A card opens its batch, puts its settings back in the Generate form, or closes it.
import { ArrowCounterClockwise, CalendarBlank, Cube, FolderOpen, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useMemo, useState, type ReactNode } from 'react';
import { t, tCount, type MessageKey } from '@/i18n';
import { useDrafts, type DraftGroup } from '@/state/drafts';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { recalledModelNote } from '@/state/recallModel';
import { toast } from '@/state/toasts';
import { Button, cx, EmptyState, IconButton, Modal, Select, TextInput } from '@/ui';
import { dayLabel, HISTORY_PERIODS, RECENT_GROUPS, historyDays, historyModels, inPeriod, timeLabel, type HistoryPeriod, type HistorySort } from './history';
import { pictureOf } from './pictures';

/** How many pictures a card shows. */
const THUMBS = 4;

const PERIOD_LABEL: Record<HistoryPeriod, MessageKey> = {
  all: 'drafts.history.period.all',
  today: 'drafts.history.period.today',
  yesterday: 'drafts.history.period.yesterday',
  week: 'drafts.history.period.week',
  older: 'drafts.history.period.older',
};

export function DraftHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={t('drafts.history.title')} size="xl" closeLabel={t('common.close')}>
      {open && <HistoryBody onClose={onClose} />}
    </Modal>
  );
}

function HistoryBody({ onClose }: { onClose: () => void }) {
  const groups = useDrafts((s) => s.groups);
  const currentId = useDrafts((s) => s.currentId);
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const [model, setModel] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<HistorySort>('newest');
  const models = useMemo(() => historyModels(groups), [groups]);
  const days = useMemo(() => historyDays(groups, { period, model, text, sort }), [groups, period, model, text, sort]);
  // The batches older than the tabs, which "close the older ones" closes.
  const older = groups.slice(0, Math.max(0, groups.length - RECENT_GROUPS));
  // Each batch keeps the number its tab shows.
  const numberOf = (g: DraftGroup) => groups.indexOf(g) + 1;
  const openBatch = (g: DraftGroup) => {
    useDrafts.getState().setCurrent(g.id);
    onClose();
  };
  return (
    <div className="dh" data-testid="drafts-history">
      <nav className="dh__nav">
        <div className="dh__navlabel">{t('drafts.history.periods')}</div>
        {HISTORY_PERIODS.map((p) => (
          <NavItem key={p} icon={<CalendarBlank size={15} />} active={period === p} count={groups.filter((g) => inPeriod(g.createdAt, p)).length} onClick={() => setPeriod(p)} testId={`drafts-history-period-${p}`}>
            {t(PERIOD_LABEL[p])}
          </NavItem>
        ))}
        <div className="dh__navlabel">{t('drafts.history.models')}</div>
        <NavItem icon={<Cube size={15} />} active={model === null} count={groups.length} onClick={() => setModel(null)}>
          {t('drafts.history.allModels')}
        </NavItem>
        {models.map((m) => (
          <NavItem key={m.name} icon={<Cube size={15} />} active={model === m.name} count={m.count} onClick={() => setModel(m.name)} testId="drafts-history-model">
            {m.name}
          </NavItem>
        ))}
        <span className="dh__navspacer" />
        {older.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => useDrafts.getState().closeGroups(older.map((g) => g.id))} data-testid="drafts-close-older">
            {t('drafts.closeOlder')}
          </Button>
        )}
      </nav>
      <div className="dh__main">
        <div className="dh__bar">
          <div className="dh__search">
            <MagnifyingGlass size={14} />
            <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder={t('drafts.history.search')} aria-label={t('drafts.history.search')} data-testid="drafts-history-search" />
          </div>
          <Select<HistorySort>
            value={sort}
            onChange={setSort}
            aria-label={t('drafts.history.sort')}
            options={[
              { value: 'newest', label: t('drafts.history.sortNewest') },
              { value: 'oldest', label: t('drafts.history.sortOldest') },
            ]}
          />
        </div>
        <div className="dh__list">
          {days.length === 0 ? (
            <EmptyState icon={<FolderOpen size={28} />} title={t('drafts.history.empty')} />
          ) : (
            days.map(({ day, groups: list }) => (
              <section key={day} className="dh__day">
                <h3>{dayLabel(day)}</h3>
                <div className="dh__cards">
                  {list.map((g) => (
                    <HistoryCard key={g.id} group={g} n={numberOf(g)} isCurrent={g.id === currentId} onOpen={() => openBatch(g)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, active, count, onClick, testId, children }: { icon: ReactNode; active: boolean; count: number; onClick: () => void; testId?: string; children: ReactNode }) {
  return (
    <button type="button" className={cx('dh__navitem', active && 'is-active')} aria-pressed={active} onClick={onClick} data-testid={testId}>
      {icon}
      <span className="dh__navname" data-truncate-ok="a model name in the fixed-width side list">
        {children}
      </span>
      <span className="dh__count">{count}</span>
    </button>
  );
}

function HistoryCard({ group: g, n, isCurrent, onOpen }: { group: DraftGroup; n: number; isCurrent: boolean; onOpen: () => void }) {
  const images = useGallery((s) => s.images);
  const pictures = g.candidates
    .map((c) => pictureOf(c, images).image)
    .filter((image) => image !== undefined)
    .slice(0, THUMBS);
  const finished = g.candidates.filter((c) => c.finalStatus === 'ready').length;
  const reuse = () => {
    const note = recalledModelNote(useParams.getState().recallAll(g.params));
    toast({ status: note?.status ?? 'info', title: t('drafts.history.reused'), ...(note ? { description: note.description } : {}) });
  };
  return (
    <div className={cx('dh-card', isCurrent && 'is-current')} data-testid="drafts-history-card">
      <button type="button" className="dh-card__main" onClick={onOpen}>
        <span className="dh-card__thumbs">
          {pictures.map((image) => (
            <img key={image.name} src={image.thumbnailUrl || image.url} alt="" draggable={false} />
          ))}
        </span>
        <span className="dh-card__title" data-truncate-ok="a model name in a card of fixed width">
          {t('drafts.group', { n, model: g.params.modelName })}
        </span>
        <span className="dh-card__prompt">{g.params.positivePrompt}</span>
        <span className="dh-card__meta">
          <span>{timeLabel(g.createdAt)}</span>
          <span>
            {g.params.width}×{g.params.height}
          </span>
          <span>{tCount('drafts.history.drafts', g.candidates.length)}</span>
          {finished > 0 && <span>{tCount('drafts.history.finished', finished)}</span>}
        </span>
      </button>
      <div className="dh-card__actions">
        <Button size="xs" scheme="accent" onClick={onOpen} data-testid="drafts-history-open">
          {t('drafts.history.open')}
        </Button>
        <Button size="xs" variant="outline" leftIcon={<ArrowCounterClockwise size={12} />} onClick={reuse} data-testid="drafts-history-reuse">
          {t('drafts.history.reuse')}
        </Button>
        <span className="dh-card__spacer" />
        <IconButton size="xs" label={t('drafts.closeGroup')} icon={<X />} onClick={() => useDrafts.getState().closeGroup(g.id)} data-testid="drafts-history-close" />
      </div>
    </div>
  );
}
