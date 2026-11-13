// The "Drafts" button of the Candidates view and the form it opens: the model, how many, how far, and start.
import { Lightning } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { draftModels, modelsWithoutDrafts, POSITION_MAX, POSITION_MIN, useDrafts } from '@/state/drafts';
import { useDraftForm } from '@/state/draftForm';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { DRAFT_COUNT_RANGE, useSettings } from '@/state/settings';
import { toast } from '@/state/toasts';
import { Button, ModelPicker, NumberInput, Popover, PopoverContent, PopoverTrigger, SliderNumber } from '@/ui';

const PROBLEMS = { 'no-builder': 'drafts.notReady', 'edit-model': 'drafts.editModel' } as const;

export function DraftForm() {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" leftIcon={<Lightning />} data-testid="drafts-form-toggle">
          {t('drafts.form')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="dv-form">
        <FormBody onStarted={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function FormBody({ onStarted }: { onStarted: () => void }) {
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
      else onStarted();
    } catch (err) {
      toast({ status: 'error', title: t('drafts.failed'), description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="dv-new" data-testid="drafts-form">
      <div className="dv-field">
        <span>{t('drafts.model')}</span>
        <ModelPicker models={mains} value={shownModel} onPick={(m) => setPicked(m.key)} placeholder={mains.length ? t('params.model.select') : t('params.model.noModels')} aria-label={t('drafts.model')} testId="drafts-model" />
      </div>
      <label className="dv-field">
        <span>{t('drafts.count')}</span>
        <NumberInput value={count} onChange={setCount} min={DRAFT_COUNT_RANGE.min} max={DRAFT_COUNT_RANGE.max} aria-label={t('drafts.count')} data-testid="drafts-count" />
      </label>
      <div className="dv-field">
        <span>{t('drafts.position')}</span>
        <SliderNumber value={percent} onChange={setPercent} min={POSITION_MIN * 100} max={POSITION_MAX * 100} step={5} aria-label={t('drafts.position')} />
      </div>
      {leftOut.length > 0 && (
        <p className="dv-hint" data-testid="drafts-left-out">
          {t('drafts.leftOut', { names: leftOut.map((m) => m.name).join(', ') })}
        </p>
      )}
      <Button variant="solid" scheme="invoke" leftIcon={<Lightning weight="fill" />} isLoading={busy} onClick={() => void run()} data-testid="drafts-start">
        {t('drafts.start')}
      </Button>
    </div>
  );
}
