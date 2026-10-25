// The sound-effect pictures a comic can put on a panel as a balloon of the kind `stamp`: lettering drawn as pictures, in three
// hands (`block` angular, `burst` sharp brush, `drybrush` rough brush), black and white with a transparent ground, 38 words
// each (the words that repeat, such as the repeated gogogo, come in their own pictures). The pictures are in src/assets/onomatopoeia/.
// A stamp balloon keeps the picture's id as its text. Search by the word, its reading or what it is for (`uses`).
//
// The list is in stamps.json (one row per picture; its Japanese words stay out of the TypeScript). The pictures and the list come from a lettering set released under CC0 1.0 by its distributor, with no credit required;
// it is recorded in frontend/scripts/oss-included.json all the same.

import rows from './stamps.json';

export const STAMP_STYLES = ['block', 'burst', 'drybrush'] as const;
export type StampStyle = (typeof STAMP_STYLES)[number];

export interface Stamp {
  /** `<style>-<word>`, also the name of the picture file in src/assets/onomatopoeia/. */
  id: string;
  style: StampStyle;
  /** The word as lettered (katakana, with its marks). */
  text: string;
  /** Its reading in hiragana. */
  reading: string;
  /** 1 (quiet, weak) to 5 (large, strong). */
  intensity: number;
  /** The picture's size in pixels. */
  width: number;
  height: number;
  /** What the sound or motion is for, in Japanese words (for searching). */
  uses: string[];
}

/** One row of stamps.json: id, style, text, reading, intensity, width, height, uses. */
type Row = [string, StampStyle, string, string, number, number, number, string[]];

export const STAMPS: readonly Stamp[] = (rows as Row[]).map(([id, style, text, reading, intensity, width, height, uses]) => ({ id, style, text, reading, intensity, width, height, uses }));

const BY_ID = new Map(STAMPS.map((s) => [s.id, s]));

/** The stamp a new stamp balloon starts with. */
export const DEFAULT_STAMP_ID = 'block-doon';

/** A stamp is drawn this many times as tall as the text of a balloon at the same size (a share of the panel's width, see BUBBLE_TEXT_SHARE). */
export const STAMP_HEIGHT_EM = 1.2;

export const stampById = (id: string): Stamp | undefined => BY_ID.get(id);

/**
 * A word without its marks (full-width ! and ?, middle dot, ellipsis, comma, full stop), with a small vowel (small a, i,
 * u, e, o) or a run of long-vowel marks (the long mark, a full-width hyphen, a wave dash) read as one long mark, so "do-on",
 * "doon!" and "do-n" written in katakana read alike.
 */
const loose = (word: string) =>
  toKatakana(word)
    .replace(/[\s\uff01!\uff1f?\u30fb\u2026\u3001\u3002]/g, '')
    .replace(/[\u30a1\u30a3\u30a5\u30a7\u30a9\u30fc\uff0d\u301c~]+/g, '\u30fc');

/**
 * The stamp a word names: its id as it is; else the stamp whose lettering or reading is exactly the word (hiragana and
 * katakana match each other); else one whose lettering matches without marks and with long and small vowels alike; else, for one sound
 * repeated (gogogo), the picture of that sound repeated the nearest number of times. The first hand is taken when several
 * have it, `style` first when it is given.
 */
export function findStamp(word: string, style?: StampStyle): Stamp | undefined {
  const exact = BY_ID.get(word.trim());
  if (exact) return exact;
  const w = toKatakana(word.trim());
  if (!w) return undefined;
  const pick = (same: Stamp[]) => same.find((s) => s.style === style) ?? same[0];
  const same = STAMPS.filter((s) => toKatakana(s.text) === w || toKatakana(s.reading) === w);
  if (same.length) return pick(same);
  const l = loose(w);
  if (!l) return undefined;
  const near = STAMPS.filter((s) => loose(s.text) === l);
  if (near.length) return pick(near);
  // One sound said again and again: the picture with the same sound and the nearest count.
  const sound = [...l];
  if (sound.length < 2 || sound.some((c) => c !== sound[0])) return undefined;
  const repeats = STAMPS.filter((s) => {
    const t = [...loose(s.text)];
    return t.length > 1 && t.every((c) => c === sound[0]);
  });
  if (!repeats.length) return undefined;
  const best = Math.min(...repeats.map((s) => Math.abs([...loose(s.text)].length - sound.length)));
  return pick(repeats.filter((s) => Math.abs([...loose(s.text)].length - sound.length) === best));
}

/** Every word the stamps have, once each, as lettered (for telling the assistant what there is). */
export const stampWords = (): string[] => [...new Set(STAMPS.map((s) => s.text))];

/** The pictures are part of the build (src/assets, not public/, which the desktop build leaves out), so each id has its own hashed URL. */
const FILES = import.meta.glob<string>('../../assets/onomatopoeia/*.webp', { eager: true, query: '?url', import: 'default' });

/** Where the picture is served from. */
export const stampUrl = (id: string): string => FILES[`../../assets/onomatopoeia/${id}.webp`] ?? '';

/** The stamps whose word, reading or uses contain the query (hiragana and katakana match each other), in the list's order. */
export function searchStamps(query: string, style?: StampStyle): Stamp[] {
  const q = toKatakana(query.trim().toLowerCase());
  return STAMPS.filter((s) => (!style || s.style === style) && (q === '' || [s.id, s.text, s.reading, ...s.uses].some((v) => toKatakana(v.toLowerCase()).includes(q))));
}

/** Hiragana to katakana, so a reading typed either way finds the word. */
function toKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
