// App-wide shortcuts: tab switching, panel toggles, invoke, cancel. Feature shortcuts live in features.
import { backend } from '@/backend';
import { invoke } from '@/state/invoke';
import { useQueue } from '@/state/queue';
import { NAV, NAV_HOTKEYS, useUi } from '@/state/ui';
import { useHotkey } from '@/ui';

const TAB_KEYS = NAV.map((tab) => NAV_HOTKEYS[tab]);

export function GlobalHotkeys() {
  const ui = useUi;
  useHotkey(TAB_KEYS, (e) => {
    const nav = NAV.find((name) => NAV_HOTKEYS[name] === e.key);
    // The Generate entry reopens the mode that was shown last (Generate or Comic).
    if (nav) ui.getState().setTab(nav === 'generate' ? ui.getState().generateMode : nav);
  });
  useHotkey('t', () => ui.getState().toggleLeft());
  useHotkey('g', () => ui.getState().toggleRight());
  useHotkey('f', () => ui.getState().togglePanels());
  useHotkey('mod+enter', () => void invoke(), { allowInInput: true });
  useHotkey('mod+shift+enter', () => void invoke({ prepend: true }), { allowInInput: true });
  useHotkey('shift+x', () => {
    const running = useQueue.getState().items.find((i) => i.status === 'in_progress');
    if (running) void backend.cancelQueueItem(running.id);
  });
  useHotkey('mod+shift+x', () => void backend.clearQueue());
  useHotkey('alt+a', () => ui.getState().focusPrompt());
  useHotkey('shift+?', () => ui.getState().openModal('hotkeys'));
  return null;
}
