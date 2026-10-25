// The one place the UI opens another window. Only addresses the app itself hands out are opened:
// the image scheme (desktop app), the server's picture route (browser on novira-server), blob: and data:image (mock), never javascript: or remote pages.
import { isTauri } from './tauri/TauriBackend';

const ALLOWED = [/^http:\/\/novira-image\.localhost\//, /^\/novira-image\/(full|thumb)\/[\w.-]+$/,/^novira-image:\/\//, /^blob:/, /^data:image\//];

/**
 * Whether a second window makes sense here: in a browser a picture opens in a new tab, but the desktop app has no
 * tabs, so features built on that are hidden there.
 */
export function canOpenNewWindow(): boolean {
  return !isTauri();
}

export function openInNewWindow(url: string): boolean {
  if (!canOpenNewWindow()) return false;
  if (!ALLOWED.some((re) => re.test(url))) return false;
  window.open(url, '_blank', 'noopener');
  return true;
}
