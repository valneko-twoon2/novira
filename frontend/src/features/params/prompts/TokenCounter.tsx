// Approximate token count of a prompt (CLIP limit 77); turns to a warning color beyond the limit.
import { t } from '@/i18n';
import { cx, Tooltip } from '@/ui';
import { CLIP_TOKEN_LIMIT, estimateTokens } from '@/state/prompts/promptTags';

export function TokenCounter({ text }: { text: string }) {
  const n = estimateTokens(text);
  return (
    <Tooltip content={t('params.prompt.tokensInfo', { limit: CLIP_TOKEN_LIMIT })}>
      <span className={cx('pp-tokens', n > CLIP_TOKEN_LIMIT && 'is-over')}>{t('params.prompt.tokens', { count: n, limit: CLIP_TOKEN_LIMIT })}</span>
    </Tooltip>
  );
}
