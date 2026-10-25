// The AI assistant's chat window. It is opened from the side bar (see app/SideNav.tsx).
import { useAgent } from '@/state/agent';
import { useUi } from '@/state/ui';
import { AgentWindow } from './AgentWindow';
import './agent.css';

export function AgentHost() {
  const open = useAgent((s) => s.open);
  // The comic screen has the assistant in its own column, so the floating window stays closed there.
  const onComic = useUi((s) => s.activeTab === 'comic');
  return open && !onComic ? <AgentWindow /> : null;
}
