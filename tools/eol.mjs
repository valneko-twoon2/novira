// The line-end rule of the repository in one place: text files are LF, Windows batch files (.bat, .cmd) are CRLF.
// Used by the fixer (tools/fix-eol.mjs) and the Claude Code hooks; tools/check-eol.mjs reads the same rule from
// .gitattributes. The other half of the rule is in .gitattributes (`* text=auto eol=lf`, `*.bat`/`*.cmd` `eol=crlf`).

/** The line end a file must have: CRLF for Windows batch files, LF for everything else. */
export function wantedEol(path) {
  return /\.(bat|cmd)$/i.test(path) ? 'crlf' : 'lf';
}

/** The text with every line end (LF, CRLF or mixed) changed to `eol` ('lf' or 'crlf'). */
export function withEol(text, eol) {
  return text.replace(/\r?\n/g, eol === 'crlf' ? '\r\n' : '\n');
}
