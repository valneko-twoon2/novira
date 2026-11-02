// Beside the Generate tab's preset card: tick the presets to take turns at random, set how many pictures, and queue them.
import { Lightning, Shuffle } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useImagePresets } from '@/state/presets/imagePresets';
import { MAX_RUN_COUNT, usePresetRun } from '@/state/presets/presetRun';
import { Button, Checkbox, ErrorBoundary, IconButton, NumberInput, Popover, PopoverContent, PopoverTrigger } from '@/ui';
import { chosenPresets, presetRunProblems, runPresets } from './presetRun';

function PresetRunForm() {
  const presets = useImagePresets((s) => s.presets);
  const { ids, count, toggle, setCount } = usePresetRun();
  const [busy, setBusy] = useState(false);
  const chosen = chosenPresets(ids, presets);
  // Shown while the popover is open; the form does not change under it.
  const problems = presetRunProblems(chosen);
  const run = async () => {
    setBusy(true);
    try {
      await runPresets();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="pp-run__title">{t('presets.run.title')}</div>
      {presets.length === 0 ? (
        <div className="pp-hint">{t('presets.empty')}</div>
      ) : (
        <ul className="pp-run__list" data-testid="preset-run-list">
          {presets.map((p) => (
            <li key={p.id}>
              <Checkbox checked={ids.includes(p.id)} onChange={() => toggle(p.id)} label={p.name} />
            </li>
          ))}
        </ul>
      )}
      {problems.map((p) => (
        <div key={p} className="pp-warn" role="alert">
          {p}
        </div>
      ))}
      <div className="pp-run__foot">
        <span className="pp-run__count">
          <span aria-hidden>×</span>
          <NumberInput value={count} onChange={setCount} min={1} max={MAX_RUN_COUNT} aria-label={t('presets.run.count')} />
        </span>
        <Button scheme="invoke" leftIcon={<Lightning weight="fill" />} disabled={!chosen.length || problems.length > 0} isLoading={busy} data-testid="preset-run-queue" onClick={() => void run()}>
          {t('presets.run.queue')}
        </Button>
      </div>
    </>
  );
}

export function PresetRunButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size="sm" variant="outline" label={t('presets.run.title')} icon={<Shuffle />} data-testid="preset-run-open" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="pp-run">
        <ErrorBoundary area="random preset run">
          <PresetRunForm />
        </ErrorBoundary>
      </PopoverContent>
    </Popover>
  );
}
