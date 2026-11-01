// The AI assistant's floating window, for the screens without it in their right column (app/RightColumn.tsx): opened
// there by what asks the assistant something (the extension manager's questions).
import { useAgent } from '@/state/agent';
import { ASSISTANT_IN_COLUMN, useUi } from '@/state/ui';
import { AgentWindow } from './AgentWindow';
import './agent.css';

export function AgentHost() {
  const open = useAgent((s) => s.open);
  const inColumn = useUi((s) => ASSISTANT_IN_COLUMN[s.activeTab]);
  return open && !inColumn ? <AgentWindow /> : null;
}
