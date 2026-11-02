// The token limit and what the next message carries of the chat: an estimate of the conversation's tokens against the
// budget, and how many older messages are shortened to fit it (agentHistory.ts). The switch is always there; the estimate
// shows once the chat has messages.
import { t, tCount } from '@/i18n';
import { currentMessages, useAgent } from '@/state/agent';
import { CONTEXT_TOKENS, contextUsage } from '@/state/agentHistory';
import { Switch } from '@/ui';

const kilo = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function ContextMeter() {
  const messages = useAgent(currentMessages);
  const limit = useAgent((s) => s.tokenLimit);
  const setLimit = useAgent((s) => s.setTokenLimit);
  const { tokens, dropped } = contextUsage(messages, limit);
  return (
    <div className="agent-context" data-testid="agent-context" data-full={dropped > 0 || undefined}>
      {messages.length > 0 && (
        <p className="agent-context__usage">
          <span>{limit ? t('agent.context.usage', { used: kilo(tokens), max: kilo(CONTEXT_TOKENS) }) : t('agent.context.usageOff', { used: kilo(tokens) })}</span>
          {dropped > 0 && <span>{tCount('agent.context.compressed', dropped)}</span>}
        </p>
      )}
      <label className="agent-context__limit">
        <span>{t('agent.context.limit')}</span>
        <Switch checked={limit} onChange={setLimit} aria-label={t('agent.context.limit')} />
      </label>
    </div>
  );
}
