// The AI assistant's floating window, for the screens without it in their right column (app/RightColumn.tsx). It shows
// only on the screen where something asked the assistant (the extension manager's questions, a permission question):
// the assistant left open in a right column does not follow onto the models, browse or queue screens.
import { useEffect, useState } from 'react';
import { useAgent } from '@/state/agent';
import { ASSISTANT_IN_COLUMN, useUi, type TabName } from '@/state/ui';
import { AgentWindow } from './AgentWindow';
import './agent.css';

export function AgentHost() {
  const open = useAgent((s) => s.open);
  const tab = useUi((s) => s.activeTab);
  const [askedOn, setAskedOn] = useState<TabName | null>(null);
  useEffect(
    () =>
      useAgent.subscribe((s, before) => {
        const asked = (s.open && !before.open) || (s.pendingAsk !== null && s.pendingAsk !== before.pendingAsk) || (s.permission !== null && s.permission !== before.permission);
        const here = useUi.getState().activeTab;
        if (asked && !ASSISTANT_IN_COLUMN[here]) setAskedOn(here);
      }),
    [],
  );
  return open && askedOn === tab ? <AgentWindow /> : null;
}
