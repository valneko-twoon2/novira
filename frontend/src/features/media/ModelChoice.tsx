// A short list of models to pick from, with a "fits this PC" mark on each and a recommendation: the card that replaces
// "this feature needs a model" with a choice. Presentational; the callers decide what each row installs and selects.
import { useEffect, type ReactNode } from 'react';
import { t } from '@/i18n';
import { useHardware } from '@/state/hardware';
import { Badge } from '@/ui';
import { formatVram, type Fit } from './modelFit';
import './media.css';

export interface ChoiceItem {
  id: string;
  name: string;
  /** One line under the name: what the model is good at, and its size. */
  note?: string;
  /** How well it fits this PC; leave out when the memory does not matter (small models). */
  fit?: Fit;
  recommended?: boolean;
  /** Marks the row in use. */
  selected?: boolean;
  /** The right-hand control: a download button, a progress mark or "installed". */
  action: ReactNode;
  /** Picks the row (rows without it are not buttons). */
  onSelect?: () => void;
}

export const FIT_SCHEME = { comfortable: 'success', tight: 'warning', short: 'danger', unknown: 'base' } as const;

/** The line naming this PC's card, or saying it could not be read. */
export function GpuLine() {
  const info = useHardware((s) => s.info);
  useEffect(() => void useHardware.getState().load(), []);
  if (!info) return null;
  const text =
    info.vramBytes === null ? t('media.choice.gpuUnknown') : t('media.choice.gpu', { gpu: info.gpuName || 'GPU', size: formatVram(info.vramBytes) });
  return (
    <span className="mc__gpu" data-testid="choice-gpu">
      {text}
    </span>
  );
}

/** `showGpu: false` for small models, where this PC's memory does not decide anything. */
export function ModelChoice({ title, items, testId, showGpu = true }: { title: string; items: ChoiceItem[]; testId: string; showGpu?: boolean }) {
  return (
    <section className="mc" role={items.some((i) => i.onSelect) ? 'radiogroup' : undefined} aria-label={title} data-testid={testId}>
      <div className="mc__head">
        <strong>{title}</strong>
        {showGpu && <GpuLine />}
      </div>
      {items.map((item) => {
        const body = (
          <>
            <div className="mc__main">
              <span className="mc__name">
                {item.name}
                {item.recommended && (
                  <Badge scheme="accent">{t('media.choice.recommended')}</Badge>
                )}
                {item.fit && <Badge scheme={FIT_SCHEME[item.fit]}>{t(`media.choice.fit.${item.fit}`)}</Badge>}
              </span>
              {item.note && <span className="mc__note">{item.note}</span>}
            </div>
            {item.action}
          </>
        );
        const cls = `mc__row${item.selected ? ' is-selected' : ''}`;
        return item.onSelect ? (
          <div key={item.id} className={cls} role="radio" aria-checked={!!item.selected} tabIndex={0} data-testid={`${testId}-${item.id}`} onClick={item.onSelect} onKeyDown={(e) => e.key === 'Enter' && item.onSelect?.()}>
            {body}
          </div>
        ) : (
          <div key={item.id} className={cls} data-testid={`${testId}-${item.id}`}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
