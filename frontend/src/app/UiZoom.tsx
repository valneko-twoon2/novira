// Desktop app: Ctrl++ / Ctrl+- zoom the whole UI and the level is kept between runs (100 % again from Settings; Ctrl+0
// is the canvas's and the viewer's "fit"). A browser zooms the page
// itself, so this does nothing there.
import { useEffect } from 'react';
import { backend } from '@/backend';
import { useSettings } from '@/state/settings';
import { sanitizeUiZoom, stepUiZoom } from '@/state/uiZoom';
import { useHotkey } from '@/ui';

export function UiZoom() {
  const desktop = backend.kind === 'tauri';
  const zoom = useSettings((s) => s.uiZoom);
  useEffect(() => {
    if (desktop) void backend.setUiZoom(sanitizeUiZoom(zoom)).catch(() => undefined);
  }, [desktop, zoom]);
  const step = (dir: 1 | -1) => useSettings.getState().set({ uiZoom: stepUiZoom(sanitizeUiZoom(useSettings.getState().uiZoom), dir) });
  // "plus" covers + and = with or without Shift and the keypad; ";" is the unshifted + key of Japanese keyboards.
  useHotkey(['mod+plus', 'mod+;', 'mod+shift+;'], () => step(1), { enabled: desktop, allowInInput: true });
  useHotkey('mod+minus', () => step(-1), { enabled: desktop, allowInInput: true });
  return null;
}
