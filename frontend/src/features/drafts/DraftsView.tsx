// Candidates view: what Invoke made and the batches of drafts, in one scrolling flow, newest first. Each picture is put on
// the board (a draft: finished) with ✓ or thrown away with ×, alone, chosen together, or a whole batch at once; a double
// click shows it large to go through them one by one.
import { ArrowClockwise, CaretDown, Checks, ClockCounterClockwise, Lightning, SelectionSlash, Tray, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type Ref } from 'react';
import { t, tCount } from '@/i18n';
import { boardLabel } from '@/state/boardTree';
import { useDrafts, type DraftGroup } from '@/state/drafts';
import { THUMB_SIZE, useDraftForm } from '@/state/draftForm';
import { useGallery } from '@/state/gallery';
import { Button, EmptyState, IconButton, Select, Slider, Tooltip } from '@/ui';
import { Cell } from './Cell';
import { DraftForm } from './DraftForm';
import { DraftHistory } from './DraftHistory';
import { accept, FLOW_GROUPS, flowGroups, flowOrder, isAcceptable, isSelectable, rangeOf, whenLabel } from './flow';
import { LargeView } from './LargeView';
import './drafts.css';

/**
 * `onOpen` shows a candidate's picture large in another place than this view's large view (the phone layout's): with it,
 * each picture also gets a button for that, since a double tap is not a double click on every phone.
 */
export function DraftsView({ onOpen }: { onOpen?: (imageName: string) => void } = {}) {
  const groups = useDrafts((s) => s.groups);
  const currentId = useDrafts((s) => s.currentId);
  const images = useGallery((s) => s.images);
  const [limit, setLimit] = useState(FLOW_GROUPS);
  const viewing = useDrafts((s) => s.viewing);
  const setViewing = useDrafts((s) => s.setViewing);
  const { shown, total } = useMemo(() => flowGroups(groups, images, currentId, limit), [groups, images, currentId, limit]);
  const flow = useRef<HTMLDivElement>(null);
  const large = onOpen ? null : viewing;

  // A batch opened from the history (or just started) is brought into sight.
  useEffect(() => {
    if (currentId && large === null) flow.current?.querySelector(`[data-group-id="${CSS.escape(currentId)}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [currentId, large]);
  const closeLarge = useCallback(() => setViewing(null), [setViewing]);

  return (
    <div className="dv" data-testid="drafts-view">
      <TopBar count={groups.length} onOpened={closeLarge} />
      {large !== null ? (
        <LargeView groups={shown} id={large} onMove={setViewing} onClose={closeLarge} />
      ) : shown.length ? (
        <Flow flowRef={flow} groups={shown} more={total > shown.length} onMore={() => setLimit(limit + FLOW_GROUPS)} onLarge={setViewing} onOpen={onOpen} />
      ) : (
        <div className="dv-empty">
          <EmptyState icon={<Lightning size={28} />} title={t('drafts.empty.title')} />
        </div>
      )}
      {large === null && <SelectionBar groups={shown} />}
    </div>
  );
}

function TopBar({ count, onOpened }: { count: number; onOpened: () => void }) {
  const thumb = useDraftForm((s) => s.thumbSize);
  const [history, setHistory] = useState(false);
  return (
    <div className="dv-bar">
      <DraftForm />
      <BoardPicker />
      <span className="dv-spacer" />
      <Slider
        className="dv-size"
        value={thumb}
        min={THUMB_SIZE.min}
        max={THUMB_SIZE.max}
        step={8}
        onChange={(v) => useDraftForm.getState().set({ thumbSize: v })}
        aria-label={t('gallery.settings.thumbnailSize')}
      />
      {count > 0 && (
        <Tooltip content={t('drafts.history.title')}>
          <Button size="sm" variant="ghost" leftIcon={<ClockCounterClockwise />} aria-label={t('drafts.history.title')} onClick={() => setHistory(true)} data-testid="drafts-history-button">
            {count}
          </Button>
        </Tooltip>
      )}
      <DraftHistory open={history} onClose={() => setHistory(false)} onOpened={onOpened} />
    </div>
  );
}

/** Where ✓ puts the pictures: the board selected in the gallery, changed here as there. */
function BoardPicker() {
  const boards = useGallery((s) => s.boards);
  const selected = useGallery((s) => s.selectedBoardId);
  const value = selected !== 'none' && boards.some((b) => b.id === selected) ? selected : 'none';
  const options = [
    { value: 'none', label: t('gallery.boards.uncategorized') },
    ...boards.filter((b) => !b.archived || b.id === value).map((b) => ({ value: b.id, label: boardLabel(boards, b) })),
  ];
  return (
    <span className="dv-target">
      <Tray size={16} aria-hidden />
      <Select value={value} onChange={(id) => useGallery.getState().selectBoard(id)} options={options} aria-label={t('drafts.target')} data-testid="drafts-target" />
    </span>
  );
}

function Flow({
  flowRef,
  groups,
  more,
  onMore,
  onLarge,
  onOpen,
}: {
  flowRef: Ref<HTMLDivElement>;
  groups: DraftGroup[];
  more: boolean;
  onMore: () => void;
  onLarge: (id: string) => void;
  onOpen: ((imageName: string) => void) | undefined;
}) {
  const images = useGallery((s) => s.images);
  const selection = useDrafts((s) => s.selection);
  const thumb = useDraftForm((s) => s.thumbSize);
  // Where a Shift click starts from: the last picture clicked without Shift.
  const anchor = useRef<string | null>(null);
  const pick = (id: string, e: MouseEvent) => {
    const { setSelection, toggleSelect } = useDrafts.getState();
    if (e.shiftKey) {
      const selectable = new Set(groups.flatMap((g) => g.candidates.filter((c) => isSelectable(g, c, images)).map((c) => c.id)));
      setSelection(rangeOf(flowOrder(groups), anchor.current, id).filter((x) => selectable.has(x)));
      return;
    }
    anchor.current = id;
    if (e.ctrlKey || e.metaKey) toggleSelect(id);
    else setSelection(selection.length === 1 && selection[0] === id ? [] : [id]);
  };
  return (
    <div className="dv-flow" ref={flowRef} style={{ '--dv-thumb': `${thumb}px` } as CSSProperties} data-testid="drafts-grid">
      {groups.map((g) => (
        <section key={g.id} className="dv-group" data-group-id={g.id} data-testid="drafts-group">
          <GroupHead group={g} />
          <div className="dv-grid">
            {g.candidates.map((c) => (
              <Cell
                key={c.id}
                group={g}
                c={c}
                images={images}
                selected={selection.includes(c.id)}
                selectable={isSelectable(g, c, images)}
                onPick={(e) => pick(c.id, e)}
                onToggle={() => {
                  anchor.current = c.id;
                  useDrafts.getState().toggleSelect(c.id);
                }}
                onLarge={() => onLarge(c.id)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}
      {more && (
        <div className="dv-more">
          <IconButton label={t('drafts.more')} icon={<CaretDown />} variant="outline" onClick={onMore} data-testid="drafts-more" />
        </div>
      )}
    </div>
  );
}

function GroupHead({ group: g }: { group: DraftGroup }) {
  const images = useGallery((s) => s.images);
  const busy = useDrafts((s) => s.busy);
  const generation = g.kind === 'generation';
  const acceptable = g.candidates.filter((c) => isAcceptable(g, c, images));
  const failed = g.candidates.filter((c) => c.status === 'failed').length;
  const prompt = g.params.positivePrompt ?? '';
  return (
    <header className="dv-group__head">
      <span className="dv-group__when">{whenLabel(g.createdAt)}</span>
      <span className="dv-group__model" data-truncate-ok="a model name in one line of the batch's header">
        {g.params.modelName}
      </span>
      <span className="dv-group__prompt" title={prompt} data-truncate-ok="the start of the prompt in one line; the whole prompt is its tooltip">
        {prompt}
      </span>
      <span className="dv-group__count">{tCount(generation ? 'drafts.history.pictures' : 'drafts.history.drafts', g.candidates.length)}</span>
      {failed > 0 && !generation && (
        <IconButton size="xs" label={tCount('drafts.retry', failed)} icon={<ArrowClockwise />} disabled={busy} onClick={() => void useDrafts.getState().retryFailed(g.id)} data-testid="drafts-group-retry" />
      )}
      <IconButton
        size="xs"
        label={t(generation ? 'drafts.acceptAll.generation' : 'drafts.acceptAll.draft')}
        icon={<Checks />}
        disabled={busy || acceptable.length === 0}
        onClick={() => accept(g, acceptable.map((c) => c.id), images)}
        data-testid="drafts-group-accept"
      />
      <IconButton size="xs" label={t(generation ? 'drafts.closeGroupHeld' : 'drafts.closeGroup')} icon={<X />} onClick={() => useDrafts.getState().closeGroup(g.id)} data-testid="drafts-group-discard" />
    </header>
  );
}

/** With pictures chosen: how many, ✓ for them, × for them, and letting them go. Nothing while none is chosen. */
function SelectionBar({ groups }: { groups: DraftGroup[] }) {
  const selection = useDrafts((s) => s.selection);
  const busy = useDrafts((s) => s.busy);
  const images = useGallery((s) => s.images);
  const picked = groups.map((g) => ({ g, ids: g.candidates.filter((c) => selection.includes(c.id)).map((c) => c.id) })).filter((p) => p.ids.length > 0);
  const count = picked.reduce((n, p) => n + p.ids.length, 0);
  if (count === 0) return null;
  const kinds = new Set(picked.map((p) => p.g.kind === 'generation'));
  const label = kinds.size > 1 ? 'drafts.accept.mixed' : kinds.has(true) ? 'drafts.accept.generation' : 'drafts.accept.draft';
  const acceptable = picked.some((p) => p.g.candidates.some((c) => p.ids.includes(c.id) && isAcceptable(p.g, c, images)));
  const { clearSelection, discard } = useDrafts.getState();
  return (
    <div className="dv-foot" data-testid="drafts-selection-bar">
      <span className="dv-foot__count">{tCount('drafts.selected', count)}</span>
      <span className="dv-spacer" />
      <IconButton
        label={t(label)}
        icon={<Checks />}
        variant="solid"
        scheme="invoke"
        disabled={busy || !acceptable}
        onClick={() => picked.forEach((p) => accept(p.g, p.ids, images))}
        data-testid="drafts-selection-accept"
      />
      <IconButton label={t('drafts.discard')} icon={<X />} variant="outline" onClick={() => picked.forEach((p) => discard(p.g.id, p.ids))} data-testid="drafts-selection-discard" />
      <IconButton label={t('drafts.clearSelection')} icon={<SelectionSlash />} onClick={clearSelection} data-testid="drafts-selection-clear" />
    </div>
  );
}
