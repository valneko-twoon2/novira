// Hands a file to the browser's download (the browser chooses where it goes). Used where the desktop app writes into a
// folder from a native dialog: the browser server's export and the mock's export and backup.
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Downloads `url` as `fileName`. Only for a URL of the page's own origin (or a blob or data URL): the browser ignores
 * `download` for another origin and opens the file in place of the app.
 */
export function downloadUrl(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
