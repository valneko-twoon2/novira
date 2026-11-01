// The assistant's chat set into a screen's own column (the image screens' right column, the comic screen's side), without
// the floating window's frame: the column's tab names it, so its bar keeps only the AI in use and the button to change it.
import { t } from '@/i18n';
import { agentReady, useAgent } from '@/state/agent';
import { AgentChat, ProviderBar } from './AgentWindow';
import './agent.css';

export function AgentDock() {
  // Before an AI is chosen the chat shows the choice itself, and the bar would be empty.
  const ready = useAgent((s) => agentReady(s.status));
  return (
    <section className="agent-win agent-win--docked" aria-label={t('agent.title')} data-testid="agent-window">
      {ready && (
        <div className="agent-win__head agent-win__head--docked">
          <ProviderBar />
        </div>
      )}
      <AgentChat />
    </section>
  );
}
