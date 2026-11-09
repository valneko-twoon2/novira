// Large editor for both prompts side by side.
import { t } from '@/i18n';
import { isPhoneLayout } from '@/state/layout';
import type { PromptSource } from '@/state/prompts/promptSource';
import { Modal, Textarea } from '@/ui';
import { imagePromptSource } from './promptActions';
import { TokenCounter } from './TokenCounter';

export function BigPromptEditor({ onClose, source = imagePromptSource }: { onClose: () => void; source?: PromptSource }) {
  const positive = source.useText('positive');
  const negative = source.useText('negative');
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t('params.prompt.bigTitle')} size="lg" closeLabel={t('common.close')}>
      <div className="pp-big">
        <label className="pp-big__col">
          <span className="pp-prompt__head">
            <span className="pp-prompt__label">{t('params.prompt.positive')}</span>
            <TokenCounter text={positive} />
          </span>
          <Textarea
            autoFocus={!isPhoneLayout()}
            className="pp-big__input"
            value={positive}
            spellCheck={false}
            data-testid="big-positive"
            onChange={(e) => source.set('positive', e.target.value)}
          />
        </label>
        <label className="pp-big__col">
          <span className="pp-prompt__head">
            <span className="pp-prompt__label">{t('params.prompt.negative')}</span>
            <TokenCounter text={negative} />
          </span>
          <Textarea className="pp-big__input" value={negative} spellCheck={false} data-testid="big-negative" onChange={(e) => source.set('negative', e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
