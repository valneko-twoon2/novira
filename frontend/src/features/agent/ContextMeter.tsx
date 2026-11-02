// How much of the chat the next message carries along: an estimate of the conversation's tokens against the budget, and
// how many older messages no longer fit (agentHistory.ts). Nothing shows while the chat is empty.
import { t, tCount } from '@/i18n';
import { currentMessages, useAgent } from '@/state/agent';
import { CONTEXT_TOKENS, contextUsage } from '@/state/agentHistory';

const kilo = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function ContextMeter() {
  const messages = useAgent(currentMessages);
  if (!messages.length) return null;
  const { tokens, dropped } = contextUsage(messages);
  return (
    <p className="agent-context" data-testid="agent-context" data-full={dropped > 0 || undefined}>
      <span>{t('agent.context.usage', { used: kilo(tokens), max: kilo(CONTEXT_TOKENS) })}</span>
      {dropped > 0 && <span>{tCount('agent.context.dropped', dropped)}</span>}
    </p>
  );
}
