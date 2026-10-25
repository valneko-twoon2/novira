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
