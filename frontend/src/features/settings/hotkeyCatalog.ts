// Hotkeys listed in the Hotkeys modal. Holds message keys only; text is rendered with t() at render time.
import type { MessageKey } from '@/i18n';
import { TOOL_HOTKEYS, type Tool } from '@/state/canvas';
import { NAV, NAV_HOTKEYS } from '@/state/ui';
import { ZOOM_HOTKEYS } from '@/ui/zoomHotkeys';

export interface HotkeyDef {
  id: string;
  title: MessageKey;
  desc: MessageKey;
  /** Alternative chords (any of them triggers the action). */
  chords: string[];
  /** Render the chords as a range ("1 - 6") instead of alternatives. */
  range?: boolean;
}

export interface HotkeyCategory {
  id: 'app' | 'canvas' | 'comic' | 'gallery' | 'viewer' | 'workflows';
  title: MessageKey;
  hotkeys: HotkeyDef[];
}

type CategoryId = HotkeyCategory['id'];

function hk(cat: CategoryId, id: string, chords: string[], range?: boolean): HotkeyDef {
  return {
    id: `${cat}.${id}`,
    title: `settings.hotkeys.${cat}.${id}` as MessageKey,
    desc: `settings.hotkeys.${cat}.${id}Desc` as MessageKey,
    chords,
    range,
  };
}

export const HOTKEY_CATEGORIES: HotkeyCategory[] = [
  {
    id: 'app',
    title: 'settings.hotkeys.category.app',
    hotkeys: [
      hk('app', 'invoke', ['mod+enter']),
      hk('app', 'invokeFront', ['mod+shift+enter']),
      hk('app', 'cancelQueueItem', ['shift+x']),
      hk('app', 'clearQueue', ['mod+shift+x']),
      hk('app', 'focusPrompt', ['alt+a']),
      hk('app', 'toggleLeftPanel', ['t']),
      hk('app', 'toggleRightPanel', ['g']),
      hk('app', 'togglePanels', ['f']),
      hk('app', 'selectTab', [NAV_HOTKEYS[NAV[0]], NAV_HOTKEYS[NAV[NAV.length - 1]!]], true),
      hk('app', 'hotkeys', ['shift+?']),
      hk('app', 'zoomIn', ['mod+plus']),
      hk('app', 'zoomOut', ['mod+minus']),
    ],
  },
  {
    id: 'canvas',
    title: 'settings.hotkeys.category.canvas',
    hotkeys: [
      ...(Object.entries(TOOL_HOTKEYS) as [Tool, string][]).map(([tool, key]) => hk('canvas', tool, [key])),
      hk('canvas', 'randomPose', ['r']),
      hk('canvas', 'decBrush', ['[']),
      hk('canvas', 'incBrush', [']']),
      hk('canvas', 'undo', ['mod+z']),
      hk('canvas', 'redo', ['mod+shift+z', 'mod+y']),
      hk('canvas', 'quickSwitch', ['q']),
      hk('canvas', 'resetView', [ZOOM_HOTKEYS.fit, 'shift+r']),
      hk('canvas', 'fitBbox', ['shift+c']),
      hk('canvas', 'zoomActual', [ZOOM_HOTKEYS.actualSize]),
      hk('canvas', 'zoomIn', [ZOOM_HOTKEYS.zoomIn]),
      hk('canvas', 'zoomOut', [ZOOM_HOTKEYS.zoomOut]),
      hk('canvas', 'acceptStaged', ['enter']),
      hk('canvas', 'discardStaged', ['escape']),
      hk('canvas', 'prevNextStaged', ['arrowleft', 'arrowright']),
      hk('canvas', 'nudge', ['arrowleft', 'arrowright', 'arrowup', 'arrowdown']),
      hk('canvas', 'paste', ['mod+v']),
    ],
  },
  {
    id: 'comic',
    title: 'settings.hotkeys.category.comic',
    hotkeys: [
      hk('comic', 'undo', ['mod+z']),
      hk('comic', 'redo', ['mod+shift+z', 'mod+y']),
      hk('comic', 'delete', ['delete']),
      hk('comic', 'nudge', ['arrowleft', 'arrowright', 'arrowup', 'arrowdown']),
    ],
  },
  {
    id: 'gallery',
    title: 'settings.hotkeys.category.gallery',
    hotkeys: [
      hk('gallery', 'navigate', ['arrowleft', 'arrowright', 'arrowup', 'arrowdown']),
      hk('gallery', 'selectAll', ['mod+a']),
      hk('gallery', 'clearSelection', ['escape']),
      hk('gallery', 'star', ['.']),
    ],
  },
  {
    id: 'viewer',
    title: 'settings.hotkeys.category.viewer',
    hotkeys: [
      hk('viewer', 'toggleMetadata', ['i']),
      hk('viewer', 'remix', ['r']),
      hk('viewer', 'usePrompt', ['p']),
      hk('viewer', 'useSeed', ['s']),
      hk('viewer', 'useAll', ['a']),
      hk('viewer', 'loadWorkflow', ['w']),
      hk('viewer', 'upscale', ['shift+u']),
      hk('viewer', 'compare', ['c']),
      hk('viewer', 'delete', ['delete']),
      hk('viewer', 'zoomFit', [ZOOM_HOTKEYS.fit]),
      hk('viewer', 'zoomActual', [ZOOM_HOTKEYS.actualSize]),
      hk('viewer', 'zoomIn', [ZOOM_HOTKEYS.zoomIn]),
      hk('viewer', 'zoomOut', [ZOOM_HOTKEYS.zoomOut]),
    ],
  },
  {
    id: 'workflows',
    title: 'settings.hotkeys.category.workflows',
    hotkeys: [
      hk('workflows', 'addNode', ['shift+a', 'space']),
      hk('workflows', 'deleteNode', ['delete']),
      hk('workflows', 'copy', ['mod+c']),
      hk('workflows', 'paste', ['mod+v']),
      hk('workflows', 'save', ['mod+s']),
      hk('workflows', 'undo', ['mod+z']),
      hk('workflows', 'redo', ['mod+shift+z', 'mod+y']),
    ],
  },
];
