// Puts text on the clipboard. `navigator.clipboard` exists only on a secure page (https, or this computer); a page opened
// over plain http from another device of the home network copies through a hidden text field instead.
export async function writeClipboardText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  // Out of sight and out of the layout, so the page neither scrolls nor flashes.
  field.style.position = 'fixed';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  document.body.append(field);
  try {
    field.select();
    // The only copy a page that is not secure has. Deprecated, but no browser has dropped it, and there is no other.
    if (!document.execCommand('copy')) throw new Error('the clipboard is not available');
  } finally {
    field.remove();
  }
}

/** Whether this page can put a picture on the clipboard (needs a secure page and `ClipboardItem`). */
export function canWriteClipboardImage(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined';
}

/**
 * Puts a PNG on the clipboard. `clipboard.write` is called at once, in the same turn as the user's click or key press,
 * with the picture still being made: the browser lets the page write only while that press is fresh (about five seconds,
 * and only while the window has focus), so waiting for a large picture to be fetched or encoded before asking made the
 * copy fail. The clipboard is filled when `png` settles, and the call rejects when `png` does.
 */
export function writeClipboardImage(png: Promise<Blob> | Blob): Promise<void> {
  if (!canWriteClipboardImage()) return Promise.reject(new Error('the clipboard is not available'));
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
