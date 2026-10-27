// The theme of the saved settings, read straight from the storage before the app loads: the settings store must not exist
// yet then (its stores read the storage as they are made, after the backend's state is in it).
import type { ThemeName } from './settings';

export function savedTheme(storage: Storage | undefined = globalThis.localStorage): ThemeName {
  try {
    const saved: unknown = JSON.parse(storage?.getItem('novira.settings') ?? 'null');
    const state = typeof saved === 'object' && saved !== null ? (saved as { state?: { theme?: unknown } }).state : undefined;
    return state?.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
