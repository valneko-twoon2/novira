// Keyboard shortcuts. Chords look like "mod+enter", "shift+x", "g", "[".
// "mod" is Ctrl on Windows/Linux and Cmd on macOS. Ignored while typing in inputs unless allowInInput.
// A copy or cut chord ("mod+c", "mod+x") is left to the browser while text is selected, so selected text is copied.
// "plus" / "minus" name the +/= and -/_ keys (and the numpad ones) whatever the Shift state, since "+" is the separator.
import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
  enabled?: boolean;
  allowInInput?: boolean;
  preventDefault?: boolean;
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

/** Keys that match regardless of Shift, because their character moves between layouts (e.g. "+" needs Shift on US keyboards). */
const SHIFT_FREE_KEYS: Record<string, { keys: string[]; code: string }> = {
  plus: { keys: ['+', '='], code: 'NumpadAdd' },
  minus: { keys: ['-', '_'], code: 'NumpadSubtract' },
};

function matches(e: KeyboardEvent, chord: string): boolean {
  const parts = chord.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mods.has('mod') !== mod) return false;
  if (mods.has('alt') !== e.altKey) return false;
  const k = (e.key ?? '').toLowerCase();
  const shiftFree = key ? SHIFT_FREE_KEYS[key] : undefined;
  if (shiftFree) return shiftFree.keys.includes(k) || e.code === shiftFree.code;
  if (mods.has('shift') !== e.shiftKey) return false;
  if (key === 'space') return k === ' ';
  if (key === 'delete') return k === 'delete' || k === 'backspace';
  return k === key;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Chords the browser itself answers with the selected text. */
const TEXT_CLIPBOARD_CHORDS = new Set(['mod+c', 'mod+x']);

/** Whether text is selected on the page or inside the focused text field (whose selection the page's does not show). */
function hasTextSelection(target: EventTarget | null = null): boolean {
  const field = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target : null;
  try {
    if (field && field.selectionStart !== null && field.selectionStart !== field.selectionEnd) return true;
  } catch {
    // An input type without a text selection (a checkbox, a number field in some browsers).
  }
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  return !!selection && !selection.isCollapsed && selection.toString().trim() !== '';
}

export function useHotkey(chords: string | string[], handler: (e: KeyboardEvent) => void, opts: HotkeyOptions = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  const { enabled = true, allowInInput = false, preventDefault = true } = opts;
  const list = Array.isArray(chords) ? chords.join('|') : chords;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!allowInInput && isTyping(e.target)) return;
      const hit = list.split('|').find((c) => matches(e, c));
      if (hit !== undefined) {
        if (TEXT_CLIPBOARD_CHORDS.has(hit.toLowerCase()) && hasTextSelection(e.target)) return;
        if (preventDefault) e.preventDefault();
        ref.current(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, enabled, allowInInput, preventDefault]);
}

/** Display form of a chord for menus and the hotkeys modal. */
export function chordLabel(chord: string): string {
  return chord
    .split('+')
    .map((p) => (p === 'mod' ? (isMac ? 'Cmd' : 'Ctrl') : p === 'plus' ? '+' : p === 'minus' ? '-' : p.length === 1 ? p.toUpperCase() : p[0]?.toUpperCase() + p.slice(1)))
    .join('+');
}
