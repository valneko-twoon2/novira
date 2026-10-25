// What the frontend scripts share about the languages and the manual's files. The scripts cannot import TypeScript, so
// PRIMARY_LOCALES repeats the one in src/i18n/catalog.ts; tests/script-locales.test.ts keeps the two equal.

/** The languages that always hold every message and every manual chapter. */
export const PRIMARY_LOCALES = ['ja', 'en'];

/** The file name of a manual chapter: two digits, a hyphen, a name (`02-generate.md`). */
export const CHAPTER_FILE = /^\d{2}-[\w-]+\.md$/;

/** CHAPTER_FILE without its anchors, to put inside a longer pattern (a path of docs/manual/<language>/). */
export const CHAPTER_NAME = CHAPTER_FILE.source.slice(1, -1);
