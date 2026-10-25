// The server's address carries this start's token (`/?token=...`) only to hand it to the first request, which turns it into a
// cookie. Once the page is loaded the token is dropped from the address bar and the history entry, so a glance at the
// screen, a screenshot or a history sync does not show it. The cookie keeps a reload working.

/** The address without its `token` parameter, or `null` when it has none. */
export function withoutToken(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has('token')) return null;
  url.searchParams.delete('token');
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Replaces the current history entry with the address without its token (no reload). */
export function hideToken(): void {
  const clean = withoutToken(window.location.href);
  if (clean !== null) window.history.replaceState(window.history.state, '', clean);
}
