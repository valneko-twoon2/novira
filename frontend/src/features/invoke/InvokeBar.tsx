// Queue controls bar. The image tabs show them inside the left panel header, so only Workflows uses this bar.
import type { TabName } from '@/state/ui';
import { InvokeControls } from './InvokeControls';
import './invoke.css';

export function InvokeBar({ tab }: { tab: TabName }) {
  if (tab !== 'workflows') return null;
  return (
    <div className="ib-bar">
      <InvokeControls tab={tab} />
    </div>
  );
}
