// Drafts view: draw many seeds only part of the way, look at them side by side, and finish only the ones you like.
import { ArrowsOut, Check, Lightning, Star, X } from '@phosphor-icons/react';
import { useState } from 'react';
import type { ImageDTO } from '@/backend';
import { t, tCount } from '@/i18n';
import {
  canFinish,
  draftModels,
  draftStepOf,
  modelsWithoutDrafts,
  POSITION_MAX,
  POSITION_MIN,
  useDrafts,
  type DraftCandidate,
  type DraftGroup,
} from '@/state/drafts';
import { useDraftForm } from '@/state/draftForm';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { DRAFT_COUNT_RANGE, useSettings } from '@/state/settings';
import { toast } from '@/state/toasts';
import { showViewer } from '@/state/ui';
import { Button, cx, EmptyState, IconButton, ModelPicker, NumberInput, SliderNumber, Spinner } from '@/ui';
import { GroupTabs } from './GroupTabs';
import { pictureOf } from './pictures';
import './drafts.css';

const PER_PAGE = 24;

const PROBLEMS = { 'not-txt2img': 'drafts.onlyTxt2img', 'no-builder': 'drafts.notReady', 'edit-model': 'drafts.editModel' } as const;

/**
 * `onOpen` shows a candidate's picture large in another place than the desktop viewer (the phone layout's): with it, each
 * picture also gets a button for that, since a double tap is not a double click on every phone.
 */
export function DraftsView({ onOpen }: { onOpen?: (imageName: string) => void } = {}) {
  const groups = useDrafts((s) => s.groups);
  const currentId = useDrafts((s) => s.currentId);
  const group = groups.find((g) => g.id === currentId) ?? groups[groups.length - 1];
  return (
    <div className="dv" data-testid="drafts-view">
      <NewDrafts />
      <GroupTabs groups={groups} currentId={group?.id ?? null} />
      {group ? (
        <GroupGrid key={group.id} group={group} onOpen={onOpen} />
      ) : (
        <div className="dv-empty">
          <EmptyState icon={<Lightning size={28} />} title={t('drafts.empty.title')} description={t('drafts.empty.description')} />
        </div>
      )}
    </div>
  );
}

function NewDrafts() {
  const start = useDrafts((s) => s.start);
  const busy = useDrafts((s) => s.busy);
  // The count and the position start at what the settings give and stay as they are set, also when another screen is shown between.
  const settingsCount = useSettings((s) => s.draftCount);
  const settingsPercent = useSettings((s) => s.draftPosition);
  const count = useDraftForm((s) => s.count) ?? settingsCount;
  const percent = useDraftForm((s) => s.percent) ?? settingsPercent;
  const setCount = (n: number) => useDraftForm.getState().set({ count: n });
  const setPercent = (n: number) => useDraftForm.getState().set({ percent: n });
  // Another model for the drafts; until one is picked they follow the Generate tab's model.
  const models = useModels((s) => s.models);
  const generateModel = useParams((s) => s.modelKey);
  const [picked, setPicked] = useState<string | null>(null);
  // Every model the Generate tab draws with, diffusion models of the newer families included, less the edit models.
  const mains = draftModels(models);
  const leftOut = modelsWithoutDrafts(models);
  const shownModel = picked && mains.some((m) => m.key === picked) ? picked : generateModel;

  const run = async () => {
    try {
      const problem = await start(count, percent / 100, picked);
      if (problem) toast({ status: 'warning', title: t(PROBLEMS[problem.error]) });
    } catch (err) {
      toast({ status: 'error', title: t('drafts.failed'), description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="dv-new">
      <div className="dv-field dv-field--model">
        <span>{t('drafts.model')}</span>
        <ModelPicker models={mains} value={shownModel} onPick={(m) => setPicked(m.key)} placeholder={mains.length ? t('params.model.select') : t('params.model.noModels')} aria-label={t('drafts.model')} testId="drafts-model" />
      </div>
      <label className="dv-field">
        <span>{t('drafts.count')}</span>
        <NumberInput value={count} onChange={setCount} min={DRAFT_COUNT_RANGE.min} max={DRAFT_COUNT_RANGE.max} aria-label={t('drafts.count')} data-testid="drafts-count" />
      </label>
      <div className="dv-field dv-field--slider">
        <span>{t('drafts.position')}</span>
        <SliderNumber
          value={percent}
          onChange={setPercent}
          min={POSITION_MIN * 100}
          max={POSITION_MAX * 100}
          step={5}
          aria-label={t('drafts.position')}
        />
      </div>
      <Button variant="solid" scheme="invoke" leftIcon={<Lightning weight="fill" />} isLoading={busy} onClick={() => void run()} data-testid="drafts-start">
        {t('drafts.start')}
      </Button>
      {leftOut.length > 0 && (
        <p className="dv-hint" data-testid="drafts-left-out">
          {t('drafts.leftOut', { names: leftOut.map((m) => m.name).join(', ') })}
        </p>
      )}
    </div>
  );
}

function GroupGrid({ group, onOpen }: { group: DraftGroup; onOpen: ((imageName: string) => void) | undefined }) {
  const images = useGallery((s) => s.images);
  const selection = useDrafts((s) => s.selection);
  const busy = useDrafts((s) => s.busy);
  const toggle = useDrafts((s) => s.toggleSelect);
  const clear = useDrafts((s) => s.clearSelection);
  const finish = useDrafts((s) => s.finish);
  const retryFailed = useDrafts((s) => s.retryFailed);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(group.candidates.length / PER_PAGE));
  const shown = group.candidates.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const finishable = group.candidates.filter((c) => selection.includes(c.id) && canFinish(c, !!c.finalImageName && images.some((i) => i.name === c.finalImageName)));
  const failed = group.candidates.filter((c) => c.status === 'failed').length;
  const step = draftStepOf(group);

  return (
    <>
      <div className="dv-grid" data-testid="drafts-grid">
        {shown.map((c) => (
          <Cell key={c.id} group={group} c={c} step={step} images={images} selected={selection.includes(c.id)} onToggle={() => toggle(c.id)} onOpen={onOpen} />
        ))}
      </div>
      <div className="dv-foot">
        {pages > 1 && (
          <span className="dv-pages">
            <Button size="xs" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ‹
            </Button>
            {page + 1} / {pages}
            <Button size="xs" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              ›
            </Button>
          </span>
        )}
        <span className="dv-spacer" />
        {failed > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void retryFailed(group.id)}>
            {tCount('drafts.retry', failed)}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={selection.length === 0} onClick={clear}>
          {t('drafts.clearSelection')}
        </Button>
        <Button
          size="sm"
          variant="solid"
          scheme="invoke"
          disabled={busy || finishable.length === 0}
          onClick={() => void finish(group.id, finishable.map((c) => c.id))}
          data-testid="drafts-finish"
        >
          {tCount('drafts.finish', finishable.length)}
        </Button>
      </div>
    </>
  );
}

function Cell({
  group,
  c,
  step,
  images,
  selected,
  onToggle,
  onOpen,
}: {
  group: DraftGroup;
  c: DraftCandidate;
  step: number;
  images: ImageDTO[];
  selected: boolean;
  onToggle: () => void;
  onOpen: ((imageName: string) => void) | undefined;
}) {
  const mark = useDrafts((s) => s.mark);
  const { image, finished } = pictureOf(c, images);
  const working = c.status === 'queued' || c.status === 'running' || c.finalStatus === 'queued' || c.finalStatus === 'running';
  const failed = c.status === 'failed' || c.finalStatus === 'failed';
  const badge = failed
    ? t('drafts.badge.failed')
    : finished
      ? t('drafts.badge.finished')
      : c.finalStatus
        ? t('drafts.badge.finishing')
        : c.status === 'queued'
          ? t('drafts.badge.queued')
          : c.status === 'running'
            ? t('drafts.badge.drawing')
            : t('drafts.badge.draft', { percent: Math.round(group.position * 100), steps: group.params.steps, step });
  const openLarge = () => {
    if (!image) return;
    if (onOpen) {
      onOpen(image.name);
      return;
    }
    useGallery.getState().setSelection([image.name]);
    showViewer('generate');
  };
  return (
    <div className={cx('dv-cell', selected && 'is-selected', c.verdict === 'reject' && 'is-rejected', failed && 'is-failed')} data-testid="draft-cell">
      <div
        className="dv-img"
        style={{ aspectRatio: `${group.params.width} / ${group.params.height}` }}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`seed ${c.seed}`}
        onClick={() => c.status === 'ready' && onToggle()}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (c.status === 'ready') onToggle();
          }
        }}
        onDoubleClick={openLarge}
      >
        {image ? <img src={image.thumbnailUrl || image.url} alt="" draggable={false} /> : failed ? null : <Spinner size={18} />}
        {image && working && (
          <span className="dv-busy">
            <Spinner size={12} />
          </span>
        )}
        {selected && (
          <span className="dv-check">
            <Check size={12} weight="bold" />
          </span>
        )}
        {onOpen && image && (
          <button
            type="button"
            className="dv-open"
            aria-label={t('drafts.open')}
            data-testid="draft-open"
            onClick={(e) => {
              e.stopPropagation();
              openLarge();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <ArrowsOut size={14} />
          </button>
        )}
        <button
          type="button"
          className={cx('dv-star', c.verdict === 'keep' && 'is-on')}
          aria-label={t(c.verdict === 'keep' ? 'drafts.unkeep' : 'drafts.keep')}
          aria-pressed={c.verdict === 'keep'}
          onClick={(e) => {
            e.stopPropagation();
            mark(group.id, c.id, 'keep');
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Star size={14} weight={c.verdict === 'keep' ? 'fill' : 'regular'} />
        </button>
      </div>
      <div className="dv-meta">
        <span className="dv-badge" title={c.error ?? undefined}>
          {badge}
        </span>
        <span className="dv-seed">seed {c.seed}</span>
        <IconButton
          size="xs"
          label={t(c.verdict === 'reject' ? 'drafts.unreject' : 'drafts.reject')}
          icon={<X />}
          onClick={() => mark(group.id, c.id, 'reject')}
        />
      </div>
    </div>
  );
}
