// The small "i" beside a label: the longer explanation of the control shows in a tooltip on hover and on keyboard focus.
import { Info } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { Tooltip } from './Tooltip';

export function InfoMark({ info }: { info: string }) {
  return (
    <Tooltip content={info} side="top">
      <button type="button" className="ui-info" aria-label={t('common.info')} data-testid="info-mark">
        <Info size={14} />
      </button>
    </Tooltip>
  );
}
