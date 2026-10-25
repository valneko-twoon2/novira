// What a character looks like, part by part, and which parts a panel needs to say. A panel's picture only shows what its
// framing shows: a face close-up needs the hair and eyes but not the shoes, and a view from behind has no eyes. Naming only
// the visible parts keeps the prompt short and stops the model from drawing the parts that are out of frame.
import type { ComicCharacter } from './document';

export const CHARACTER_PARTS = ['hair', 'eyes', 'face', 'outfit', 'body', 'accessory'] as const;
export type CharacterPart = (typeof CHARACTER_PARTS)[number];
export type CharacterParts = Partial<Record<CharacterPart, string>>;

/** The longest words of one part. */
export const CHARACTER_PART_MAX = 120;

/** How a panel frames its people, read from its prompt. */
export type Framing = 'close' | 'bust' | 'full' | 'back';

const BACK = /from behind|back view|from the back|facing away|rear view/i;
const CLOSE = /close-?up|portrait|face focus|headshot|eye focus|extreme close/i;
const BUST = /upper body|bust|waist up|cowboy shot|medium shot/i;

/** The framing a prompt asks for; a prompt that says nothing is taken as showing the whole person. */
export function framingOf(prompt: string): Framing {
  if (BACK.test(prompt)) return 'back';
  if (CLOSE.test(prompt)) return 'close';
  if (BUST.test(prompt)) return 'bust';
  return 'full';
}

const SHOWN: Record<Framing, readonly CharacterPart[]> = {
  close: ['hair', 'eyes', 'face', 'accessory'],
  bust: ['hair', 'eyes', 'face', 'outfit', 'accessory'],
  full: CHARACTER_PARTS,
  back: ['hair', 'outfit', 'body', 'accessory'],
};

/**
 * The parts as stored: only known parts with words, each cut to its limit; undefined when none is left. A box being typed in
 * keeps its spaces at the ends (`keepEnds`), or the space between two words would vanish as it is typed; the words are trimmed where they are used.
 */
export function cleanParts(v: unknown, keepEnds = false): CharacterParts | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const given = v as Record<string, unknown>;
  const parts: CharacterParts = {};
  for (const part of CHARACTER_PARTS) {
    const words = typeof given[part] === 'string' ? (keepEnds ? given[part] : given[part].trim()).slice(0, CHARACTER_PART_MAX) : '';
    if (words.trim()) parts[part] = words;
  }
  return Object.keys(parts).length ? parts : undefined;
}

/** The character's words for a panel: the general tags, then the parts that the panel's framing shows. */
export function characterWords(character: Pick<ComicCharacter, 'tags' | 'parts' | 'nonHuman'>, prompt: string): string {
  // A monster or an animal has no hair or eyes to hide by framing: its parts are free slots, so all of them are told.
  const shown = character.nonHuman ? CHARACTER_PARTS : SHOWN[framingOf(prompt)];
  return [character.tags.trim(), ...shown.map((p) => character.parts?.[p]?.trim())].filter(Boolean).join(', ');
}

/** Every word of the character, for the picture that shows the character alone. */
export const allWords = (character: Pick<ComicCharacter, 'tags' | 'parts' | 'nonHuman'>): string => characterWords(character, '');
