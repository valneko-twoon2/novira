// Registers the comic screen's Invoke builder (the Invoke bar draws the selected panel) and ties the prompt boxes to the
// selected panel while the comic screen is open, and lets the assistant edit the page and look at a drawn one.
import { registerAgentEditor } from '@/state/agent';
import { comicAgentEditor } from '@/state/comic/agentEditor';
import { comicInvokeBuilder } from '@/state/comic/generate';
import { startComicDrawSync } from '@/state/comic/drawSync';
import { startComicPromptSync } from '@/state/comic/promptSync';
import { registerInvokeBuilder } from '@/state/invoke';
import { viewComicPage } from './agentView';

let started = false;

export function registerComicFeature() {
  registerInvokeBuilder('comic', comicInvokeBuilder);
  // The assistant reads the page on screen and changes its layout, panels, prompts, poses and balloons.
  registerAgentEditor('comic', { ...comicAgentEditor, view: viewComicPage });
  if (!started) {
    started = true;
    startComicPromptSync();
    startComicDrawSync();
  }
}
