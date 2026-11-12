// The user's calendar day for the harness tools that write a date a person reads (changelog.mjs --release, worktree.mjs add). It
// imports nothing, so any tool can use it.

/** The local calendar day of `d` as YYYY-MM-DD (the user's day: toISOString() would give the UTC one). */
export function localDay(d = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}
