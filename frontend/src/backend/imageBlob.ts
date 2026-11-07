// Reads a picture's bytes from its address (the app's image scheme, the browser server, or a blob). Screens may not call `fetch` themselves.

/** The bytes of the picture at `url`; rejects when the answer is not a success. */
export async function readImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`the picture could not be read (HTTP ${res.status})`);
  return res.blob();
}
