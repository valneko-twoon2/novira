// "Show dynamic prompts preview": lists the prompts the {a|b} and __wildcard__ syntax of one prompt box (positive or
// negative) expands to, picks the mode (every combination or random) and opens the wildcard lists.
import { BracketsCurly, ListBullets } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { batchSeed } from '@/backend';
import { t, tCount } from '@/i18n';
import { useParams, type DynamicPromptMode } from '@/state/params';
import { usePhoneLayout } from '@/state/layout';
import { useWildcards, wildcardMap } from '@/state/prompts/wildcards';
import { Button, cx, IconButton, Popover, PopoverContent, PopoverTrigger } from '@/ui';
import { promptReadiness } from '../readiness';
import { expandPrompt, hasDynamicSyntax, MAX_DYNAMIC_PROMPTS, randomPrompt } from '@/state/prompts/dynamicPrompts';

const MODES: DynamicPromptMode[] = ['combinatorial', 'random'];

export function DynamicPromptsButton({ kind = 'positive' }: { kind?: 'positive' | 'negative' }) {
  const prompt = useParams((s) => (kind === 'positive' ? s.positivePrompt : s.negativePrompt));
  const mode = useParams((s) => s.dynamicPromptMode);
  const iterations = useParams((s) => s.iterations);
  const seed = useParams((s) => s.seed);
  const randomSeeds = useParams((s) => s.shouldRandomizeSeed);
  const set = useParams((s) => s.set);
  // Beside the button on a wide screen; below it on a phone, where there is no room at its side.
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(false);
  const lists = useWildcards((s) => s.lists);
  const openEditor = useWildcards((s) => s.openEditor);
  const dynamic = hasDynamicSyntax(prompt);
  const random = mode === 'random';
  const prompts = useMemo(() => {
    if (!dynamic) return [prompt];
    const map = wildcardMap(lists);
    // Random: the prompt each picture gets from its seed (seed + i; only examples when the seeds are random).
    if (random) return Array.from({ length: Math.max(1, iterations) }, (_, i) => randomPrompt(prompt, map, batchSeed(seed, i)));
    return expandPrompt(prompt, MAX_DYNAMIC_PROMPTS, map);
  }, [prompt, dynamic, random, lists, iterations, seed]);
  // Re-rendered whenever the prompt or the lists change (both are subscribed above).
  const problems = dynamic ? promptReadiness() : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          size="xs"
          label={t('params.prompt.dynamicPreview')}
          icon={<BracketsCurly />}
          isActive={dynamic}
          tooltipSide="right"
          data-testid={kind === 'positive' ? 'dynamic-prompts' : 'dynamic-prompts-negative'}
        />
      </PopoverTrigger>
      <PopoverContent side={phone ? 'bottom' : 'right'} align="start" className="pp-dyn">
        <div className="pp-dyn__title">
          {t('params.prompt.dynamicTitle')}
          <span className="pp-dyn__count">{random ? tCount('params.prompt.randomCount', prompts.length) : tCount('params.prompt.dynamicCount', prompts.length)}</span>
        </div>
        <div className="pp-segment" role="radiogroup" aria-label={t('params.prompt.dynamicMode')} title={t('params.prompt.modeInfo')}>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={cx('pp-segment__item', mode === m && 'is-active')}
              data-testid={`dynamic-mode-${m}`}
              onClick={() => set({ dynamicPromptMode: m })}
            >
              {m === 'random' ? t('params.prompt.modeRandom') : t('params.prompt.modeCombinatorial')}
            </button>
          ))}
        </div>
        {!dynamic && (
          <>
            <div className="pp-hint">{t('params.prompt.dynamicHelp')}</div>
            <div className="pp-hint">{t('params.prompt.wildcardHelp')}</div>
          </>
        )}
        {problems.map((p) => (
          <div key={p} className="pp-warn" role="alert">
            {p}
          </div>
        ))}
        {dynamic && (
          <ol className="pp-dyn__list" data-testid="dynamic-prompts-list">
            {prompts.map((p, i) => (
              <li key={i}>{p || <span className="pp-hint">{t('params.prompt.empty')}</span>}</li>
            ))}
          </ol>
        )}
        {dynamic && random && <div className="pp-hint">{randomSeeds ? t('params.prompt.randomExamples') : t('params.prompt.randomBySeed')}</div>}
        {!random && prompts.length >= MAX_DYNAMIC_PROMPTS && <div className="pp-warn">{t('params.prompt.dynamicCapped', { max: MAX_DYNAMIC_PROMPTS })}</div>}
        <Button size="xs" variant="ghost" leftIcon={<ListBullets />} data-testid="open-wildcards" onClick={() => {
            setOpen(false);
            openEditor();
          }}
        >
          {t('params.wildcards.open')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
