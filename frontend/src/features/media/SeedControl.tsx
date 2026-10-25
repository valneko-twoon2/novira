// The seed row at the top of a generator screen's left panel: random / fixed switch, number box and a re-roll button.
// The Generate tab and the video, music and logo screens share it, so the row looks and works the same on each.
import { DiceFive, LockSimple, Shuffle } from '@phosphor-icons/react';
import { MAX_SEED } from '@/backend';
import { t } from '@/i18n';
import { cx, IconButton, NumberInput, Tooltip } from '@/ui';
import './seed.css';

export interface SeedControlProps {
  seed: number;
  /** True when a new seed is drawn for every generation. */
  random: boolean;
  onSeed: (seed: number) => void;
  onRandom: (random: boolean) => void;
  onShuffle: () => void;
}

export function SeedControl({ seed, random, onSeed, onRandom, onShuffle }: SeedControlProps) {
  return (
    <div className="pp-seed" title={t('params.seed.info')}>
      <span className="pp-seed__label">{t('params.seed.label')}</span>
      <span className="pp-seg" role="group" aria-label={t('params.seed.mode')}>
        <Tooltip content={t('params.seed.randomHint')}>
          <button
            type="button"
            className={cx('pp-seg__btn', random && 'is-active')}
            aria-pressed={random}
            aria-label={t('params.seed.random')}
            data-testid="seed-random"
            onClick={() => onRandom(true)}
          >
            <DiceFive size={15} />
          </button>
        </Tooltip>
        <Tooltip content={t('params.seed.fixedHint')}>
          <button
            type="button"
            className={cx('pp-seg__btn', !random && 'is-active')}
            aria-pressed={!random}
            aria-label={t('params.seed.fixed')}
            data-testid="seed-fixed"
            onClick={() => onRandom(false)}
          >
            <LockSimple size={15} />
          </button>
        </Tooltip>
      </span>
      <NumberInput
        className="pp-seed__input"
        value={seed}
        onChange={(v) => onSeed(Math.round(v))}
        min={0}
        max={MAX_SEED}
        step={1}
        disabled={random}
        aria-label={t('params.seed.label')}
      />
      <IconButton label={t('params.seed.shuffle')} icon={<Shuffle />} variant="outline" disabled={random} onClick={onShuffle} />
    </div>
  );
}
