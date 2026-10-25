// Desktop app: switches off what only makes sense in a browser, so the window behaves like an application. The page's
// context menu (Back, Reload, Save as, Print, Inspect), reload / print / save / find / view-source / caret-browsing
// shortcuts, and a file dropped outside a drop zone (which would navigate the window to the file) do nothing.
// The developer tools keys stay in a development build. Text fields keep their own menu (cut, copy, paste). A browser keeps all of it, so this does nothing there.
import { useEffect } from 'react';
import { backend } from '@/backend';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const field = target.closest('input, textarea');
  if (!field) return false;
  return !(field instanceof HTMLInputElement) || !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'submit', 'reset'].includes(field.type);
}

/** Whether a key press is a browser shortcut the app has no use for (the app's own shortcuts are not among them). */
export function isBrowserShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  const key = (e.key ?? '').toLowerCase();
  if (key === 'f5' || key === 'f7') return true;
  // The developer tools open only in a development build, like the developer log.
  if (!import.meta.env.DEV && (key === 'f12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key)))) return true;
  if (e.altKey && (key === 'arrowleft' || key === 'arrowright')) return true;
  if (!(e.ctrlKey || e.metaKey)) return false;
  // Reload, print, save, find, view source, open file, new window, history, downloads, "go to address".
  return ['r', 'p', 's', 'f', 'g', 'u', 'o', 'n', 'h', 'j', 'l', 'd'].includes(key) && !e.shiftKey && !e.altKey;
}

export function NativeFeel() {
  const desktop = backend.kind === 'tauri';
  useEffect(() => {
    if (!desktop) return;
    const onMenu = (e: MouseEvent) => {
      if (!e.defaultPrevented && !isEditable(e.target)) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (isBrowserShortcut(e)) e.preventDefault();
    };
    const stopDrop = (e: DragEvent) => {
      if (!e.defaultPrevented && e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    document.addEventListener('contextmenu', onMenu);
    window.addEventListener('keydown', onKey);
    window.addEventListener('dragover', stopDrop);
    window.addEventListener('drop', stopDrop);
    return () => {
      document.removeEventListener('contextmenu', onMenu);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('dragover', stopDrop);
      window.removeEventListener('drop', stopDrop);
    };
  }, [desktop]);
  return null;
}
