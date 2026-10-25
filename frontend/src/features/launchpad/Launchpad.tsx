// Launchpad view of the center panel, one page per tab (InvokeAI v6).
import type { TabName } from '@/state/ui';
import { CanvasLaunchpad } from './CanvasLaunchpad';
import { GenerateLaunchpad } from './GenerateLaunchpad';
import './launchpad.css';
import { UpscalingLaunchpad } from './UpscalingLaunchpad';
import { WorkflowsLaunchpad } from './WorkflowsLaunchpad';

export function Launchpad({ tab }: { tab: TabName }) {
  switch (tab) {
    case 'canvas':
      return <CanvasLaunchpad />;
    case 'upscaling':
      return <UpscalingLaunchpad />;
    case 'workflows':
      return <WorkflowsLaunchpad />;
    // The Generate page; the tabs after it have no launchpad view (MAIN_VIEWS). A new tab must say which page it gets.
    case 'generate':
    case 'comic':
    case 'models':
    case 'browse':
    case 'queue':
    case 'extensions':
      return <GenerateLaunchpad />;
  }
}
