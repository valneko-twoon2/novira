// The sheet of a character: its picture (the front) and pictures of it from other sides, and which of them a panel takes as
// the character's reference. A reference carries the pose and the angle of its picture as well as the face and the clothes,
// so a panel drawn from behind follows a picture from behind, and a close-up a close-up of the face. Every view is drawn from
// the front picture, never from another view, so a fault in one view does not carry into the next.
import { framingOf } from './characterLook';
import { SHEET_VIEWS, type ComicCharacter, type SheetView } from './document';

/** Words of a prompt that turn the people sideways or half away. */
const SIDE = /from (the )?side|profile|side view/i;
const THREE_QUARTER = /three-quarter|3\/4 view|looking to the side|looking away|half-turned/i;

/** The view a panel's prompt asks for: from behind and close-ups by the framing, then a side or a three-quarter view. */
export function viewFor(prompt: string): SheetView | 'front' {
  const framing = framingOf(prompt);
  if (framing === 'back') return 'back';
  if (framing === 'close') return 'face';
  if (SIDE.test(prompt)) return 'side';
  if (THREE_QUARTER.test(prompt)) return 'threeQuarter';
  return 'front';
}

/** The picture a panel takes as the character's reference: the view its prompt needs when the sheet has it, else the front. */
export function referencePicture(character: Pick<ComicCharacter, 'imageName' | 'sheet'>, prompt: string): string | null {
  const view = viewFor(prompt);
  return (view === 'front' ? undefined : character.sheet?.[view]) ?? character.imageName;
}

/** The views the sheet does not have yet, in the sheet's order. */
export const missingViews = (character: Pick<ComicCharacter, 'sheet'>): SheetView[] => SHEET_VIEWS.filter((view) => !character.sheet?.[view]);

/** The pictures of the sheet, the front first. */
export const sheetPictures = (character: Pick<ComicCharacter, 'imageName' | 'sheet'>): string[] =>
  [character.imageName, ...SHEET_VIEWS.map((view) => character.sheet?.[view])].filter((name): name is string => !!name);
