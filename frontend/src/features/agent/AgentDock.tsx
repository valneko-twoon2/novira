// The assistant's chat set into a screen's own column (the comic screen's side), without the floating window's frame.
import { t } from '@/i18n';
import { AgentChat } from './AgentWindow';
import './agent.css';

export function AgentDock() {
  return (
    <section className="agent-win agent-win--docked" aria-label={t('agent.title')} data-testid="agent-window">
      <AgentChat />
    </section>
  );
}
