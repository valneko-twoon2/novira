// Large editor for both prompts side by side.
import { t } from '@/i18n';
import { isPhoneLayout } from '@/state/layout';
import { useParams } from '@/state/params';
import { Modal, Textarea } from '@/ui';
import { setPrompt } from './promptActions';
import { TokenCounter } from './TokenCounter';

export function BigPromptEditor({ onClose }: { onClose: () => void }) {
  const positive = useParams((s) => s.positivePrompt);
  const negative = useParams((s) => s.negativePrompt);
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
            onChange={(e) => setPrompt('positive', e.target.value)}
          />
        </label>
        <label className="pp-big__col">
          <span className="pp-prompt__head">
            <span className="pp-prompt__label">{t('params.prompt.negative')}</span>
            <TokenCounter text={negative} />
          </span>
          <Textarea className="pp-big__input" value={negative} spellCheck={false} data-testid="big-negative" onChange={(e) => setPrompt('negative', e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
