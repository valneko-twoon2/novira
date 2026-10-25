// A comic project as the screen edits it and as it is saved: one plain JSON object per project, which the backend keeps
// as it is. A document this version cannot read is skipped on restore, never guessed at. Fields added after the first
// save have a default when they are missing, so a saved project still opens as it was.
import type { ComicRecord } from '@/backend';
import { findImage } from '../gallery';
import { randomUuid } from '../randomUuid';
import { migrateLayers, type ImageSizeOf, type RotationBake } from './migrateLayers';
import { defaultPageCanvas, parsePageCanvas, serializePageCanvas, type PageCanvas } from './pageCanvasDoc';
import { DEFAULT_STAMP_ID } from './stamps';
import { cleanParts, type CharacterParts } from './characterLook';
import { parseDraw, type DrawSettings } from './drawSettings';
import { parseStyle, type ComicStyle } from './style';
import { parseRough, type ComicRough } from './rough';

/** The version a project is saved under. Version 1 (the comic's own layer stack) is still read and migrated. */
export const COMIC_VERSION = 2;
/** The versions this build reads; a document of any other version is skipped on restore and never written back. */
const READABLE_VERSIONS: readonly number[] = [1, 2];

/** The OpenPose body has 18 joints; a saved pose has all of them or none. */
export const POSE_JOINT_COUNT = 18;

/**
 * The shapes of balloon (see balloon.ts for how each is drawn). Speech is an ellipse with a tail; rounded and box are a
 * rounded and a square box with a tail; a thought is a cloud with a trail of dots; a shout has spikes all round, and an
 * explosion big uneven ones; wavy has a trembling edge (a weak or frightened voice); fuzzy is covered in short hairs (unease);
 * electric is a many-sided box with a lightning tail (a phone, a speaker, a machine); icicle has icicles hanging from it (a
 * cold voice); heart is a heart; a flash is a burst of ink lines round the words (a shock), a caption is a box of narration
 * with no tail, a sound effect is bold lettering with no balloon, plain is words with no balloon, and a stamp is a picture of lettering
 * (a sound effect drawn in a hand of its own, see stamps.ts) whose text is the picture's id.
 */
export const BUBBLE_KINDS = [
  'speech',
  'rounded',
  'box',
  'thought',
  'shout',
  'explosion',
  'wavy',
  'fuzzy',
  'electric',
  'icicle',
  'heart',
  'flash',
  'caption',
  'sfx',
  'plain',
  'stamp',
] as const;
export type BubbleKind = (typeof BUBBLE_KINDS)[number];

/** How a balloon's line is drawn: one line, dashes (a whisper), two lines (an echo, a broadcast), or none. */
export const BUBBLE_LINES = ['solid', 'dashed', 'double', 'none'] as const;
export type BubbleLine = (typeof BUBBLE_LINES)[number];

/**
 * What each shape starts with: how many spikes, bumps, waves, hairs, sides, icicles or rays it has (0: it has none of them),
 * how deep they are (0 to 1), its line, and whether it has a tail. A shape with a count lets it be changed.
 */
export const BUBBLE_KIND_DEFAULTS: Record<BubbleKind, { spikes: number; depth: number; line: BubbleLine; tail: boolean }> = {
  speech: { spikes: 0, depth: 0, line: 'solid', tail: true },
  rounded: { spikes: 0, depth: 0, line: 'solid', tail: true },
  box: { spikes: 0, depth: 0, line: 'solid', tail: true },
  thought: { spikes: 9, depth: 0.3, line: 'solid', tail: true },
  shout: { spikes: 16, depth: 0.45, line: 'solid', tail: true },
  explosion: { spikes: 11, depth: 0.75, line: 'solid', tail: true },
  wavy: { spikes: 14, depth: 0.12, line: 'solid', tail: true },
  fuzzy: { spikes: 46, depth: 0.16, line: 'solid', tail: true },
  electric: { spikes: 8, depth: 0, line: 'solid', tail: true },
  icicle: { spikes: 7, depth: 0.5, line: 'solid', tail: true },
  heart: { spikes: 0, depth: 0, line: 'solid', tail: true },
  flash: { spikes: 72, depth: 0.6, line: 'none', tail: false },
  caption: { spikes: 0, depth: 0, line: 'solid', tail: false },
  sfx: { spikes: 0, depth: 0, line: 'none', tail: false },
  plain: { spikes: 0, depth: 0, line: 'none', tail: false },
  stamp: { spikes: 0, depth: 0, line: 'none', tail: false },
};

/** Shapes with no balloon at all: only their lettering is drawn. */
export const LETTERING_KINDS: readonly BubbleKind[] = ['sfx', 'plain', 'stamp'];

/** The ranges of a balloon's look. */
export const BUBBLE_SPIKES_RANGE = { min: 3, max: 90, step: 1 } as const;
export const BUBBLE_DEPTH_RANGE = { min: 0, max: 1, step: 0.01 } as const;
/** The line's thickness, times the usual one. */
export const BUBBLE_LINE_WIDTH_RANGE = { min: 0.3, max: 4, step: 0.1, default: 1 } as const;
/** How much the line wavers, as a pen's does: 0 is drawn with a ruler. */
export const BUBBLE_ROUGH_RANGE = { min: 0, max: 1, step: 0.05, default: 0.4 } as const;
/** The balloon's width and height, times what its words need. */
/** The longest stage direction a panel keeps (see ComicPanel.note). */
export const PANEL_NOTE_MAX = 2000;

export const BUBBLE_STRETCH_RANGE = { min: 0.6, max: 3, step: 0.05, default: 1 } as const;
/** The tail's width at the balloon, times the usual one, and how far it bends (-1 to 1; 0 is straight). */
export const BUBBLE_TAIL_WIDTH_RANGE = { min: 0.2, max: 3, step: 0.05, default: 1 } as const;
export const BUBBLE_TAIL_CURVE_RANGE = { min: -1, max: 1, step: 0.05, default: 0 } as const;
/** The fewest and the most points of an outline drawn by hand. */
export const BUBBLE_OUTLINE_POINTS = { min: 3, max: 64 } as const;

/**
 * A balloon's outline drawn by hand: points of the balloon's box (0 to 1 is the box; they may lie a little outside it), joined
 * by a smooth curve or by straight lines. It replaces the shape's own outline; the shape's spikes, bumps or icicles still
 * follow it.
 */
export interface BubbleOutline {
  points: ComicPoint[];
  smooth: boolean;
}

/** The text size of a balloon, as a multiple of the default size. */
export const BUBBLE_SCALE_RANGE = { min: 0.4, max: 4, step: 0.05, default: 1 } as const;

/** The longest font family name a balloon keeps. */
const FONT_NAME_MAX = 128;

/** How far lettering may be turned, in degrees (a sound effect is set at a slant). */
export const BUBBLE_ROTATION_RANGE = { min: -90, max: 90, step: 1 } as const;

/** The size a new sound effect starts at: larger than speech. */
export const SFX_START_SCALE = 2.2;

/** Where the tail of a new balloon points: down and to the left, as the first balloons of the screen did. */
export const DEFAULT_TAIL: ComicPoint = { x: 0.08, y: 1.18 };

/** The columns a page can be laid out in (the panels fill the rows, reading across). */
export const PAGE_COLUMNS = [1, 2, 3] as const;

/** Manga are read from the right, other comics from the left. */
export const READING_DIRECTIONS = ['rtl', 'ltr'] as const;
export type ReadingDirection = (typeof READING_DIRECTIONS)[number];

/** The paper a page is drawn for. A page keeps the proportions of its paper, and its picture is drawn at 200 dpi. */
export const PAGE_SIZES = ['A4', 'A5', 'B4', 'B5'] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** The paper of each size in millimetres, standing (portrait). */
export const PAGE_SIZE_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  B4: { width: 257, height: 364 },
  B5: { width: 182, height: 257 },
};

/** Pixels per inch of a drawn page: the saved page, and the page's layers (one layer pixel is one page pixel). */
const PAGE_DPI = 200;

/** The size of a drawn page in pixels. */
export function pagePixels(page: Pick<ComicPage, 'size'>): { width: number; height: number } {
  const paper = PAGE_SIZE_MM[page.size];
  return { width: Math.round((paper.width * PAGE_DPI) / 25.4), height: Math.round((paper.height * PAGE_DPI) / 25.4) };
}

/** How far a picture in a panel may be shrunk or enlarged. At 1 the picture just covers the panel. */
export const IMAGE_SCALE_RANGE = { min: 0.1, max: 8 } as const;

/** How far a picture's centre may be moved from its panel, in panel widths and heights: it stays within reach to be dragged back. */
const IMAGE_CENTRE_RANGE = { min: -1, max: 2 } as const;

/**
 * The line of a panel's frame and the space between the frame and its picture, in millimetres of the paper. They are
 * settings of a page: every panel of the page has the same.
 */
export const FRAME_WIDTH_RANGE = { min: 0, max: 3, step: 0.1, default: 0.6 } as const;
export const PICTURE_INSET_RANGE = { min: 0, max: 10, step: 0.5, default: 0 } as const;
/** The white margin drawn outside a panel's frame line, in millimetres of the paper (none at first). */
export const FRAME_MARGIN_RANGE = { min: 0, max: 10, step: 0.5, default: 0 } as const;
/** The colour of the frame lines at first: black ink. */
export const DEFAULT_FRAME_COLOR = '#000000';

/**
 * A finishing effect over the whole drawn page, so the pictures need not be asked for in black and white or in the look of an
 * e-book: none, monochrome, the grey and slightly warm paper of an e-book reader, or sepia. It changes how the page is shown and
 * saved, never the panels' pictures.
 */
export const COMIC_EFFECTS = ['none', 'mono', 'ebook', 'sepia'] as const;
export type ComicEffect = (typeof COMIC_EFFECTS)[number];

export interface ComicPoint {
  x: number;
  y: number;
}

export interface ComicBubble {
  id: string;
  kind: BubbleKind;
  text: string;
  /** Top-left corner inside the panel, as fractions of the panel's width and height (0 to 1). */
  x: number;
  y: number;
  /**
   * Where the tail points, as fractions of the balloon's own box (0, 0 is its top-left corner, 1, 1 its bottom-right).
   * Null means no tail. Outside 0 to 1 is the tail reaching away from the balloon.
   */
  tail: ComicPoint | null;
  /** The size of the text (BUBBLE_SCALE_RANGE). */
  scale: number;
  /** The family the words are set in, or null for the default (the balloon font of the settings). */
  font: string | null;
  /** The text runs top to bottom in columns, from the right, as Japanese comics set speech. */
  vertical: boolean;
  /** The lettering is turned this many degrees clockwise (BUBBLE_ROTATION_RANGE); balloons with a tail keep 0. */
  rotation: number;
  /** How the line is drawn. */
  line: BubbleLine;
  /** A black balloon with white words (a dark or cold voice) instead of a white one. */
  dark: boolean;
  /** The line's thickness (BUBBLE_LINE_WIDTH_RANGE). */
  lineWidth: number;
  /** How much the hand-drawn line wavers (BUBBLE_ROUGH_RANGE). */
  rough: number;
  /** The balloon's width and height, times what its words need (BUBBLE_STRETCH_RANGE). */
  width: number;
  height: number;
  /** How many spikes, bumps, waves, hairs, sides, icicles or rays (BUBBLE_SPIKES_RANGE), for a shape that has them. */
  spikes: number;
  /** How deep they are (BUBBLE_DEPTH_RANGE). */
  depth: number;
  /** The tail's width (BUBBLE_TAIL_WIDTH_RANGE) and bend (BUBBLE_TAIL_CURVE_RANGE). */
  tailWidth: number;
  tailCurve: number;
  /** The outline drawn by hand, or null for the shape's own. */
  outline: BubbleOutline | null;
}

/**
 * How the picture sits in its panel, as on the canvas: where its centre is, how large it is, how it is turned and
 * mirrored. At scale 1 the picture is as large as it needs to be to cover the panel (it keeps its own shape); a smaller
 * scale leaves part of the panel empty. Only the part inside the panel is shown.
 */
export interface ComicImageView {
  /** The picture's centre, as fractions of the panel's width and height (0.5 is the panel's middle). */
  cx: number;
  cy: number;
  scale: number;
  /** Clockwise, in degrees (-180 to 180). */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export const DEFAULT_IMAGE_VIEW: ComicImageView = { cx: 0.5, cy: 0.5, scale: 1, rotation: 0, flipX: false, flipY: false };

/**
 * A person or animal of the comic with the words that make the engine draw them the same way in every panel: hair, eyes,
 * clothes, age, kind. A panel that lists the character gets these words in front of its prompt, as written.
 */
export interface ComicCharacter {
  id: string;
  name: string;
  tags: string;
  /** The look part by part (hair, eyes, ...): a panel names only the parts its framing shows (see characterLook.ts). */
  parts?: CharacterParts;
  /** A monster, spirit or animal: the portrait is drawn with no human in it, and every part is told in every framing. */
  nonHuman?: boolean;
  /** What to keep out of the panels the character is in (English tags), added to the panel's negative prompt. */
  negative?: string;
  /**
   * A picture of the character (a gallery name) that every panel with the character takes as a reference image
   * (IP-Adapter), so the face and the clothes carry over. Drawing a comic makes one when there is none (see generate.ts).
   */
  imageName: string | null;
  /**
   * The character from other sides (gallery names), each drawn from `imageName` (the front): a panel takes the one its
   * framing needs as the reference (see characterSheet.ts). Pictures, not edits: undo leaves them as they are.
   */
  sheet?: CharacterSheet;
  /** The character of the Characters library it was saved as, whose LoRA its panels use. */
  libraryId?: string;
}

/** The views of a character sheet besides the front, as a model sheet has them. */
export const SHEET_VIEWS = ['threeQuarter', 'side', 'back', 'face'] as const;
export type SheetView = (typeof SHEET_VIEWS)[number];
export type CharacterSheet = Partial<Record<SheetView, string>>;

/** How strongly the reference picture of a character is followed: 0.5 kept the look and stayed clean in a check on a real engine. */
export const CHARACTER_REF_WEIGHT = 0.6;

/**
 * The strength a comic's character references take when they are turned on, and its range. Off by default: on a
 * real engine the IP-Adapter made the panels dull and carried the reference's plain background and front stance into them.
 */
export const CAST_REFERENCE_DEFAULT = 0.4;
export const CAST_REFERENCE_MIN = 0.1;
export const CAST_REFERENCE_MAX = 1;
/** The share of the steps a character reference acts on: the model draws the rest in its own style. */
export const CAST_REFERENCE_END = 0.6;

/** The most characters a comic keeps, the longest name and the longest tag list. */
export const CAST_MAX = 8;
export const CHARACTER_NAME_MAX = 40;
export const CHARACTER_TAGS_MAX = 600;
export const CHARACTER_NEGATIVE_MAX = 300;

/**
 * A place of the comic (a room, a street, a shore) with the words that make the engine draw it the same way in every panel
 * set there: what it is, what is in it, its colours and its light. A panel that names the place gets these words after its
 * own prompt, as written, so the panels of one scene keep one background.
 */
export interface ComicPlace {
  id: string;
  name: string;
  tags: string;
  /** What to keep out of the panels set there (English tags), added to the panel's negative prompt. */
  negative?: string;
}

/** The most places a comic keeps, the longest name and word lists, and the longest world line (see ComicProject.world). */
export const PLACES_MAX = 16;
export const PLACE_NAME_MAX = 40;
export const PLACE_TAGS_MAX = 400;
export const PLACE_NEGATIVE_MAX = 300;
export const WORLD_MAX = 400;

/** A box in fractions of the panel. */
export interface ComicFigure {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The most figures a panel keeps. */
export const FIGURES_MAX = 8;

/** An earlier picture of a panel: its gallery name and how it sat in the panel, so it can be put back as it was. */
export interface ComicTake {
  imageName: string;
  view: ComicImageView;
}

/** The most earlier pictures a panel keeps; the oldest one leaves the list when a new one comes. */
export const TAKES_MAX = 12;

export interface ComicPanel {
  id: string;
  prompt: string;
  /** Things to leave out of this panel's picture. Added to the Generate tab's negative prompt, which applies to every panel. */
  negativePrompt: string;
  /** What happens in the panel, in the user's words: the scene, the place, who does what (a script's stage direction). Not sent to the engine. */
  note: string;
  /** The picture of this panel, by gallery name: made for it, or put in from the gallery or a file. Its address is looked up when it is shown. */
  imageName: string | null;
  imageView: ComicImageView;
  /**
   * The panel's earlier pictures, newest first: each picture that another one replaced (a redraw, a picture put in by hand)
   * or that was taken out, so it can be put back. They stay in the gallery either way.
   */
  takes: ComicTake[];
  /** The people of the pose, each as the 18 joints in fractions of the panel, so the pose editor can open it again. Empty when there is no pose. */
  poses: ComicPoint[][];
  /** The pose picture the ControlNet reads, by gallery name. */
  poseImageName: string | null;
  /**
   * The depth map a ControlNet reads, by gallery name: baked from the panel's 3D rough together with its pose picture, and
   * dropped when the pose is changed another way (the map would show the people where they were). Absent when there is none.
   */
  depthImageName?: string;
  /** The panel's 3D rough (people, props, a floor and a camera) its pose and depth pictures were baked from (rough.ts). */
  rough?: ComicRough;
  /** The characters in this panel (ids of the comic's cast): their tags are put in front of the prompt when it is drawn. */
  cast: string[];
  /**
   * Who each person of the pose is (a cast id, or null), in the order of `poses`, so a panel with several characters draws
   * each in its own region (castRegions.ts). Absent when nobody was named.
   */
  poseCast?: (string | null)[];
  /**
   * What each person of the pose does, in English tags, in the order of `poses` (from a scene): a panel drawn in
   * regions puts each person's words in that person's region, so the actions of two people do not swap. Absent when none.
   */
  poseWords?: string[];
  /** Where the panel is set (an id of the comic's places): the place's words go after its prompt. Absent when none is named. */
  place?: string;
  /** Where animals and other things without a pose stand, as boxes in fractions of the panel: balloons keep clear of them. */
  figures: ComicFigure[];
  bubbles: ComicBubble[];
}

/** A panel's settings saved to reuse in other panels: its prompts, pose and balloons, but not its picture. */
export interface ComicPanelTemplate {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  poses: ComicPoint[][];
  poseImageName: string | null;
  bubbles: ComicBubble[];
}

/** A page's layout saved to reuse: how many panels, in how many columns, read which way, and the panels' shapes if reshaped. */
export interface ComicPageTemplate {
  id: string;
  name: string;
  panelCount: number;
  columns: number;
  direction: ReadingDirection;
  size: PageSize;
  shapes: ComicPoint[][] | null;
}

/**
 * A picture laid over the whole page, behind the panels (a splash page, or a collage the panels are set on). It is placed,
 * sized, turned and mirrored with a view, as a panel's picture is, but against the page itself rather than a panel.
 */
export interface ComicBackdrop {
  /** The picture, by gallery name. */
  imageName: string;
  view: ComicImageView;
}

export interface ComicPage {
  id: string;
  panels: ComicPanel[];
  /** How many columns the panels are laid out in. */
  columns: number;
  direction: ReadingDirection;
  /** The paper of the page. */
  size: PageSize;
  /**
   * The shape of each panel, in reading order, as corners in fractions of the page (see shapes.ts). Null is the automatic
   * layout, which the panel count and the columns decide.
   */
  shapes: ComicPoint[][] | null;
  /**
   * The panels are placed freely: each shape is its own polygon, which may overlap another or leave a gap (see freeShapes.ts).
   * Only a page with shapes can be free.
   */
  free: boolean;
  /** The picture under the panels that fills the page, or null for the white page. */
  backdrop: ComicBackdrop | null;
  /** The effect of this page, or null to follow the comic's own. */
  effect: ComicEffect | null;
  /** How thick the panels' frame lines are, in millimetres (FRAME_WIDTH_RANGE). */
  frameMm: number;
  /** The empty band between a panel's frame line and its picture, in millimetres (PICTURE_INSET_RANGE). */
  insetMm: number;
  /** The white margin outside a panel's frame line, in millimetres (FRAME_MARGIN_RANGE). */
  marginMm: number;
  /** The colour of the frame lines, as #rrggbb. */
  frameColor: string;
  /** Drawing settings this page changes from the comic's (a model, steps, size ...); the rest follow the comic. */
  draw?: DrawSettings;
  /** The style words of this page, where they differ from the comic's. */
  style?: ComicStyle;
  /**
   * The page's layers as Canvas layers in page pixels (pageCanvasDoc.ts): rasters bottom first with the panels and
   * the balloons as slots among them, masks above, and the generation box. Pictures in it are kept by gallery name.
   */
  canvas: PageCanvas;
}

export interface ComicProject {
  id: string;
  name: string;
  pages: ComicPage[];
  /** The effect of every page that has none of its own. */
  effect: ComicEffect;
  panelTemplates: ComicPanelTemplate[];
  pageTemplates: ComicPageTemplate[];
  /** The people and animals of the comic, so each looks the same in every panel (see ComicCharacter). */
  cast: ComicCharacter[];
  /** The places the story returns to, so each looks the same in every panel set there (see ComicPlace). */
  places: ComicPlace[];
  /**
   * Words every panel is drawn with after its own and its place's: the era, the region, the season, the palette, so every
   * place belongs to one world. Absent when none is written.
   */
  world?: string;
  /** The drawing settings of this comic (model, LoRAs, size and so on); without them it starts from the Generate tab's. */
  draw?: DrawSettings;
  /** The quality words and the words kept out of every panel; without them the main model's family decides (see style.ts). */
  style?: ComicStyle;
  /**
   * How strongly a panel follows its characters' reference pictures through an IP-Adapter (CAST_REFERENCE_MIN to _MAX);
   * left out, it does not use them. A model that takes pictures in itself (FLUX.2) gets them either way.
   */
  castReference?: number;
  createdAt: number;
  updatedAt: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const finite = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
/** A corner coordinate: on the page or up to a page-length off it (see freeShapes.ts). */
const offPage = (v: unknown) => Math.min(2, Math.max(-1, finite(v)));
const fraction = (v: unknown, fallback = 0) => Math.min(1, Math.max(0, finite(v, fallback)));
const items = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The boxes of a panel's figures; one that is not four finite numbers, or has no size, is left out. */
export function parseFigures(v: unknown): ComicFigure[] {
  const unit = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null);
  return items(v)
    .flatMap((raw) => {
      const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const [x, y, w, h] = [unit(o.x), unit(o.y), unit(o.w), unit(o.h)];
      return x === null || y === null || w === null || h === null || w < 0.01 || h < 0.01 ? [] : [{ x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) }];
    })
    .slice(0, FIGURES_MAX);
}
const nameOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);
/** A saved strength of the character references, kept in its range; undefined (off) when it is not a number. */
export const parseCastReference = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(CAST_REFERENCE_MAX, Math.max(CAST_REFERENCE_MIN, v)) : undefined;
const oneOf = <T extends string | number>(v: unknown, options: readonly T[], fallback: T): T => (options.find((o) => o === v) ?? fallback);

/** A tail tip may reach past the balloon, but not absurdly far: it is kept within a few box widths. */
const tailCoordinate = (v: unknown) => Math.min(3, Math.max(-2, finite(v)));

function parsePoint(v: unknown): ComicPoint | null {
  return isObject(v) ? { x: tailCoordinate(v.x), y: tailCoordinate(v.y) } : null;
}

/** A hand-drawn outline with enough points, each kept near the balloon's box; anything else is no outline. */
function parseOutline(v: unknown): BubbleOutline | null {
  if (!isObject(v)) return null;
  const points = items(v.points).map((p) => (isObject(p) ? { x: Math.min(2, Math.max(-1, finite(p.x))), y: Math.min(2, Math.max(-1, finite(p.y))) } : null));
  if (points.length < BUBBLE_OUTLINE_POINTS.min || points.length > BUBBLE_OUTLINE_POINTS.max || points.some((p) => p === null)) return null;
  return { points: points as ComicPoint[], smooth: v.smooth !== false };
}

/**
 * A balloon read from a saved document, or a balloon after an edit, with every field in its range. A field saved before
 * it existed takes what its shape starts with, so an old balloon keeps its look (and gains the hand-drawn line).
 */
/** A font family name as a balloon keeps it: a short plain name, or null (none, or one that could break the CSS). */
function parseFont(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.trim();
  return name && name.length <= FONT_NAME_MAX && !/["\\;{}<>]/.test(name) && ![...name].some((c) => c < ' ') ? name : null;
}

export function parseBubble(v: unknown): ComicBubble | null {
  if (!isObject(v) || typeof v.id !== 'string') return null;
  // A balloon saved before tails could be set has the default tail; one saved with no tail has null.
  const tail = 'tail' in v ? (v.tail === null ? null : (parsePoint(v.tail) ?? DEFAULT_TAIL)) : DEFAULT_TAIL;
  const kind = oneOf(v.kind, BUBBLE_KINDS, 'speech');
  const start = BUBBLE_KIND_DEFAULTS[kind];
  return {
    id: v.id,
    kind,
    text: text(v.text),
    x: fraction(v.x),
    y: fraction(v.y),
    tail,
    scale: between(finite(v.scale, BUBBLE_SCALE_RANGE.default), BUBBLE_SCALE_RANGE),
    font: parseFont(v.font),
    vertical: v.vertical === true,
    rotation: clampRotation(v.rotation),
    line: oneOf(v.line, BUBBLE_LINES, start.line),
    dark: v.dark === true,
    lineWidth: between(finite(v.lineWidth, BUBBLE_LINE_WIDTH_RANGE.default), BUBBLE_LINE_WIDTH_RANGE),
    rough: between(finite(v.rough, BUBBLE_ROUGH_RANGE.default), BUBBLE_ROUGH_RANGE),
    width: between(finite(v.width, BUBBLE_STRETCH_RANGE.default), BUBBLE_STRETCH_RANGE),
    height: between(finite(v.height, BUBBLE_STRETCH_RANGE.default), BUBBLE_STRETCH_RANGE),
    spikes: Math.round(between(finite(v.spikes, start.spikes || BUBBLE_SPIKES_RANGE.min), BUBBLE_SPIKES_RANGE)),
    depth: between(finite(v.depth, start.depth), BUBBLE_DEPTH_RANGE),
    tailWidth: between(finite(v.tailWidth, BUBBLE_TAIL_WIDTH_RANGE.default), BUBBLE_TAIL_WIDTH_RANGE),
    tailCurve: between(finite(v.tailCurve, BUBBLE_TAIL_CURVE_RANGE.default), BUBBLE_TAIL_CURVE_RANGE),
    outline: parseOutline(v.outline),
  };
}

function parsePose(v: unknown): ComicPoint[] | null {
  const points = items(v).map((p) => (isObject(p) ? { x: fraction(p.x), y: fraction(p.y) } : null));
  return points.length === POSE_JOINT_COUNT && points.every((p) => p !== null) ? points : null;
}

/** The people of a panel's pose. A panel saved before there were several people keeps its one pose as the only person. */
function parsePoses(panel: Record<string, unknown>): ComicPoint[][] {
  if (!('poses' in panel)) {
    const legacy = parsePose(panel.pose);
    return legacy ? [legacy] : [];
  }
  return items(panel.poses)
    .map(parsePose)
    .filter((p): p is ComicPoint[] => p !== null);
}

const between = (v: number, range: { min: number; max: number }) => Math.min(range.max, Math.max(range.min, v));

/** An angle in degrees, turned into -180 to 180. */
export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const turned = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return turned === -180 ? 180 : turned;
}

/** A frame width in millimetres within its range (an unknown value takes the default). */
export const clampRotation = (degrees: unknown) => Math.round(between(finite(degrees), BUBBLE_ROTATION_RANGE));
export const clampFrameMm = (mm: number) => between(finite(mm, FRAME_WIDTH_RANGE.default), FRAME_WIDTH_RANGE);

/** A white margin in millimetres within its range (an unknown value takes the default). */
export const clampMarginMm = (mm: number) => between(finite(mm, FRAME_MARGIN_RANGE.default), FRAME_MARGIN_RANGE);

/** A frame colour as #rrggbb in small letters; anything else takes the default black. */
export const cleanFrameColor = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : DEFAULT_FRAME_COLOR);

/** A picture inset in millimetres within its range (an unknown value takes the default). */
export const clampInsetMm = (mm: number) => between(finite(mm, PICTURE_INSET_RANGE.default), PICTURE_INSET_RANGE);

/** A picture's view with every field in its range (an unknown value takes its default). */
export function clampImageView(v: ComicImageView): ComicImageView {
  return {
    cx: between(finite(v.cx, DEFAULT_IMAGE_VIEW.cx), IMAGE_CENTRE_RANGE),
    cy: between(finite(v.cy, DEFAULT_IMAGE_VIEW.cy), IMAGE_CENTRE_RANGE),
    scale: between(finite(v.scale, DEFAULT_IMAGE_VIEW.scale), IMAGE_SCALE_RANGE),
    rotation: normalizeRotation(finite(v.rotation)),
    flipX: v.flipX === true,
    flipY: v.flipY === true,
  };
}

/**
 * How a picture sits in its panel. A panel saved before pictures could be moved keeps the picture covering it. A panel
 * saved while a picture could only be enlarged (from 1 to 4) and slid within the panel (`x` and `y`: 0 keeps the picture's
 * left or top edge at the panel's, 1 its right or bottom edge) keeps the same placement: its centre is where that
 * enlarged picture's centre was.
 */
function parseImageView(v: unknown): ComicImageView {
  if (!isObject(v)) return { ...DEFAULT_IMAGE_VIEW };
  if (!('cx' in v) && ('x' in v || 'y' in v || 'scale' in v)) {
    const scale = Math.min(4, Math.max(1, finite(v.scale, 1)));
    const centre = (at: unknown) => (1 - scale) * fraction(at, 0.5) + scale / 2;
    return { ...DEFAULT_IMAGE_VIEW, cx: centre(v.x), cy: centre(v.y), scale };
  }
  return clampImageView({
    cx: finite(v.cx, DEFAULT_IMAGE_VIEW.cx),
    cy: finite(v.cy, DEFAULT_IMAGE_VIEW.cy),
    scale: finite(v.scale, DEFAULT_IMAGE_VIEW.scale),
    rotation: finite(v.rotation),
    flipX: v.flipX === true,
    flipY: v.flipY === true,
  });
}

function parseCharacter(v: unknown): ComicCharacter | null {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  const parts = cleanParts(v.parts);
  const sheet = parseSheet(v.sheet);
  const libraryId = typeof v.libraryId === 'string' && v.libraryId.length <= 128 ? v.libraryId : '';
  return { id: v.id, name: v.name.slice(0, CHARACTER_NAME_MAX), tags: text(v.tags).slice(0, CHARACTER_TAGS_MAX), ...(parts ? { parts } : {}), ...(v.nonHuman === true ? { nonHuman: true } : {}), ...(text(v.negative).trim() ? { negative: text(v.negative).trim().slice(0, CHARACTER_NEGATIVE_MAX) } : {}), imageName: nameOrNull(v.imageName), ...(sheet ? { sheet } : {}), ...(libraryId ? { libraryId } : {}) };
}

/** A place as stored: an id and a name, its words and what it keeps out cut to their limits; null when it is not one. */
export function parsePlace(v: unknown, keepEnds = false): ComicPlace | null {
  if (!isObject(v) || typeof v.id !== 'string' || !v.id || typeof v.name !== 'string') return null;
  // A box being typed in keeps its spaces at the ends (`keepEnds`); where the words are used they are trimmed.
  const typed = text(v.negative).slice(0, PLACE_NEGATIVE_MAX);
  const negative = keepEnds ? (typed.trim() ? typed : '') : typed.trim();
  return { id: v.id, name: v.name.slice(0, PLACE_NAME_MAX), tags: text(v.tags).slice(0, PLACE_TAGS_MAX), ...(negative ? { negative } : {}) };
}

/** The places as stored: readable ones, each id once, at most `PLACES_MAX`. */
export function parsePlaces(v: unknown, keepEnds = false): ComicPlace[] {
  const seen = new Set<string>();
  return items(v)
    .map((p) => parsePlace(p, keepEnds))
    .filter((p): p is ComicPlace => p !== null && !seen.has(p.id) && !!seen.add(p.id))
    .slice(0, PLACES_MAX);
}

/** The world line as stored: cut to its limit; undefined when it holds no word. */
export function parseWorld(v: unknown): string | undefined {
  const world = text(v).slice(0, WORLD_MAX);
  return world.trim() ? world : undefined;
}

/** The views of a sheet as stored: known views with a gallery name; undefined when none is left. */
export function parseSheet(v: unknown): CharacterSheet | undefined {
  if (!isObject(v)) return undefined;
  const sheet: CharacterSheet = {};
  for (const view of SHEET_VIEWS) {
    const name = nameOrNull(v[view]);
    if (name) sheet[view] = name;
  }
  return Object.keys(sheet).length ? sheet : undefined;
}

/** A panel's earlier pictures: a gallery name and a view each, newest first, without repeats or the panel's own picture. */
function parseTakes(v: unknown, current: string | null): ComicTake[] {
  const seen = new Set<string>(current ? [current] : []);
  const takes: ComicTake[] = [];
  for (const raw of items(v)) {
    if (takes.length === TAKES_MAX) break;
    if (!isObject(raw) || typeof raw.imageName !== 'string' || !raw.imageName || seen.has(raw.imageName)) continue;
    seen.add(raw.imageName);
    takes.push({ imageName: raw.imageName, view: parseImageView(raw.view) });
  }
  return takes;
}

/**
 * The earlier pictures of a panel once its picture `from` (with its view) gives way to `to`: the old picture goes in front,
 * the new one leaves the list, and the list keeps `TAKES_MAX`.
 */
export function nextTakes(takes: readonly ComicTake[], from: ComicTake | null, to: string | null): ComicTake[] {
  const rest = takes.filter((take) => take.imageName !== to && take.imageName !== from?.imageName);
  return (from && from.imageName !== to ? [from, ...rest] : rest).slice(0, TAKES_MAX);
}

function parsePanel(v: unknown): ComicPanel | null {
  if (!isObject(v) || typeof v.id !== 'string') return null;
  const bubbles = items(v.bubbles)
    .map(parseBubble)
    .filter((b): b is ComicBubble => b !== null);
  const imageName = nameOrNull(v.imageName);
  const rough = parseRough(v.rough);
  return {
    id: v.id,
    prompt: text(v.prompt),
    negativePrompt: text(v.negativePrompt),
    note: text(v.note).slice(0, PANEL_NOTE_MAX),
    imageName,
    imageView: parseImageView(v.imageView),
    takes: parseTakes(v.takes, imageName),
    poses: parsePoses(v),
    poseImageName: nameOrNull(v.poseImageName),
    ...(nameOrNull(v.depthImageName) ? { depthImageName: v.depthImageName as string } : {}),
    ...(rough ? { rough } : {}),
    cast: items(v.cast).filter((id): id is string => typeof id === 'string').slice(0, CAST_MAX),
    ...(Array.isArray(v.poseCast) ? { poseCast: parsePoseCast(v.poseCast) } : {}),
    ...(Array.isArray(v.poseWords) && parsePoseWords(v.poseWords).some(Boolean) ? { poseWords: parsePoseWords(v.poseWords) } : {}),
    ...(typeof v.place === 'string' && v.place ? { place: v.place } : {}),
    figures: parseFigures(v.figures),
    bubbles,
  };
}

/** The most people whose character a panel keeps (`poseCast`). */
export const MAX_POSE_PEOPLE = 8;

/** Who each person of a pose is: a cast id or null per person, at most `MAX_POSE_PEOPLE`. */
export function parsePoseCast(v: unknown[]): (string | null)[] {
  return v.slice(0, MAX_POSE_PEOPLE).map((id) => (typeof id === 'string' && id ? id : null));
}

/** The longest words of one person of a pose (`poseWords`). */
export const POSE_WORDS_MAX = 300;

/** What each person of a pose does: a text per person (empty for none), at most `MAX_POSE_PEOPLE`, each cut to its limit. */
export function parsePoseWords(v: unknown[]): string[] {
  return v.slice(0, MAX_POSE_PEOPLE).map((w) => (typeof w === 'string' ? w.trim().slice(0, POSE_WORDS_MAX) : ''));
}

function parsePanelTemplate(v: unknown): ComicPanelTemplate | null {
  if (!isObject(v) || typeof v.id !== 'string') return null;
  return {
    id: v.id,
    name: text(v.name),
    prompt: text(v.prompt),
    negativePrompt: text(v.negativePrompt),
    poses: items(v.poses)
      .map(parsePose)
      .filter((p): p is ComicPoint[] => p !== null),
    poseImageName: nameOrNull(v.poseImageName),
    bubbles: items(v.bubbles)
      .map(parseBubble)
      .filter((b): b is ComicBubble => b !== null),
  };
}

/** The corners of one panel's shape, or null when it is not a shape (too few or too many corners, or not points). */
function parseShape(v: unknown): ComicPoint[] | null {
  const corners: ComicPoint[] = [];
  for (const p of items(v)) {
    if (!isObject(p)) return null;
    // A free page's panel may run off the page, so the corners are not held to the page itself.
    corners.push({ x: offPage(p.x), y: offPage(p.y) });
  }
  return corners.length >= 3 && corners.length <= 12 ? corners : null;
}

/**
 * The shapes of a page's panels, one per panel. Shapes that do not fit the panels (not one for each, or one that is not a
 * shape) are dropped, and the page takes the automatic layout.
 */
function parseShapes(v: unknown, panelCount: number): ComicPoint[][] | null {
  if (!Array.isArray(v) || v.length !== panelCount) return null;
  const shapes = v.map(parseShape);
  return shapes.every((s): s is ComicPoint[] => s !== null) ? shapes : null;
}

function parsePageTemplate(v: unknown): ComicPageTemplate | null {
  if (!isObject(v) || typeof v.id !== 'string') return null;
  const panelCount = Math.max(1, Math.floor(finite(v.panelCount, 1)));
  return {
    id: v.id,
    name: text(v.name),
    panelCount,
    columns: oneOf(finite(v.columns, 2), PAGE_COLUMNS, 2),
    direction: oneOf(v.direction, READING_DIRECTIONS, 'rtl'),
    size: oneOf(v.size, PAGE_SIZES, 'A4'),
    shapes: parseShapes(v.shapes, panelCount),
  };
}

/** The page's backdrop: it needs a picture; its view is read like a panel picture's, and a missing one covers the page. */
function parseBackdrop(v: unknown): ComicBackdrop | null {
  if (!isObject(v) || typeof v.imageName !== 'string' || !v.imageName) return null;
  return { imageName: v.imageName, view: parseImageView(v.view) };
}

/** What reading a project's pages needs besides the page: its version, picture sizes for a migration, and where to note the pictures to turn. */
interface PageReading {
  version: number;
  sizeOf: ImageSizeOf;
  bakes: RotationBake[];
}

function parsePage(v: unknown, reading: PageReading): ComicPage | null {
  if (!isObject(v) || typeof v.id !== 'string') return null;
  const pageId = v.id;
  const size = oneOf(v.size, PAGE_SIZES, 'A4');
  let canvas: PageCanvas;
  if (reading.version === 1) {
    const migrated = migrateLayers(v.layers, size, reading.sizeOf);
    canvas = migrated.canvas;
    reading.bakes.push(...migrated.bakes.map((b) => ({ ...b, pageId })));
  } else canvas = parsePageCanvas(v.canvas, size);
  const panels = items(v.panels)
    .map(parsePanel)
    .filter((p): p is ComicPanel => p !== null);
  const shapes = parseShapes(v.shapes, panels.length);
  return {
    id: v.id,
    panels,
    columns: oneOf(finite(v.columns, 2), PAGE_COLUMNS, 2),
    direction: oneOf(v.direction, READING_DIRECTIONS, 'rtl'),
    size,
    shapes,
    free: shapes !== null && v.free === true,
    backdrop: parseBackdrop(v.backdrop),
    effect: v.effect === null || v.effect === undefined ? null : oneOf(v.effect, COMIC_EFFECTS, 'none'),
    frameMm: clampFrameMm(finite(v.frameMm, FRAME_WIDTH_RANGE.default)),
    insetMm: clampInsetMm(finite(v.insetMm, PICTURE_INSET_RANGE.default)),
    marginMm: clampMarginMm(finite(v.marginMm, FRAME_MARGIN_RANGE.default)),
    frameColor: cleanFrameColor(v.frameColor),
    canvas,
    ...(parseDraw(v.draw) ? { draw: parseDraw(v.draw) } : {}),
    ...(parseStyle(v.style) ? { style: parseStyle(v.style) } : {}),
  };
}

/** The size of a gallery picture by its name, looked up in the gallery (which is loaded before the projects are read). */
const gallerySize: ImageSizeOf = (name) => findImage(name);

/** A project read from a saved document, with the pictures of its version 1 layers that still need turning (see bakeRotation.ts). */
export interface ReadProject {
  project: ComicProject;
  bakes: RotationBake[];
}

/**
 * The project in a saved document and what its migration left to do, or null when it is not one this build can read (another
 * version, or no string id). `sizeOf` gives a gallery picture's size, which a version 1 picture layer needs to become a
 * picture object.
 */
export function readComicProject(document: unknown, sizeOf: ImageSizeOf = gallerySize): ReadProject | null {
  if (!isObject(document) || typeof document.version !== 'number' || !READABLE_VERSIONS.includes(document.version) || typeof document.id !== 'string') return null;
  const reading: PageReading = { version: document.version, sizeOf, bakes: [] };
  const pages = items(document.pages)
    .map((p) => parsePage(p, reading))
    .filter((p): p is ComicPage => p !== null);
  const project: ComicProject = {
    id: document.id,
    name: text(document.name),
    pages,
    effect: oneOf(document.effect, COMIC_EFFECTS, 'none'),
    panelTemplates: items(document.panelTemplates)
      .map(parsePanelTemplate)
      .filter((t): t is ComicPanelTemplate => t !== null),
    pageTemplates: items(document.pageTemplates)
      .map(parsePageTemplate)
      .filter((t): t is ComicPageTemplate => t !== null),
    cast: items(document.cast)
      .map(parseCharacter)
      .filter((c): c is ComicCharacter => c !== null)
      .slice(0, CAST_MAX),
    places: parsePlaces(document.places),
    ...(parseWorld(document.world) ? { world: parseWorld(document.world) } : {}),
    ...(parseDraw(document.draw) ? { draw: parseDraw(document.draw) } : {}),
    ...(parseStyle(document.style) ? { style: parseStyle(document.style) } : {}),
    ...(parseCastReference(document.castReference) !== undefined ? { castReference: parseCastReference(document.castReference) } : {}),
    createdAt: finite(document.createdAt, 0),
    updatedAt: finite(document.updatedAt, 0),
  };
  return { project, bakes: reading.bakes };
}

/** The project in a saved document, or null when it is not one this build can read. */
export function parseComicProject(document: unknown, sizeOf: ImageSizeOf = gallerySize): ComicProject | null {
  return readComicProject(document, sizeOf)?.project ?? null;
}

/**
 * The project as it is saved, under the current version: the same object, with each page's layers in their saved shape. A
 * picture that lives only in the page is left out, so its picture must be named first (see persistence.ts).
 */
export function serializeComicProject(project: ComicProject): ComicRecord['document'] {
  return { version: COMIC_VERSION, ...project, pages: project.pages.map((page) => ({ ...page, canvas: serializePageCanvas(page.canvas, page.size) })) };
}

/** A picture left to turn, with the project it belongs to. */
export type ProjectBake = RotationBake & { projectId: string };

/** The projects that can be read from what the backend holds, newest first, and the pictures their migration left to turn. */
export function readComicRecords(records: ComicRecord[], sizeOf: ImageSizeOf = gallerySize): { projects: ComicProject[]; bakes: ProjectBake[] } {
  const read = records.map((r) => readComicProject(r.document, sizeOf)).filter((r): r is ReadProject => r !== null);
  return {
    projects: read.map((r) => r.project).sort((a, b) => b.updatedAt - a.updatedAt),
    bakes: read.flatMap((r) => r.bakes.map((b) => ({ ...b, projectId: r.project.id }))),
  };
}

/** The projects that can be read from what the backend holds, newest first. */
export function parseComicRecords(records: ComicRecord[], sizeOf: ImageSizeOf = gallerySize): ComicProject[] {
  return readComicRecords(records, sizeOf).projects;
}

export function newComicId(prefix: string): string {
  return `${prefix}-${randomUuid()}`;
}

/** The look a balloon of this shape starts with (the shape's own count and depth, line and tail). */
export function kindLook(kind: BubbleKind): Pick<ComicBubble, 'spikes' | 'depth' | 'line'> {
  const start = BUBBLE_KIND_DEFAULTS[kind];
  return { spikes: start.spikes || BUBBLE_SPIKES_RANGE.min, depth: start.depth, line: start.line };
}

export function newBubble(kind: BubbleKind, x: number, y: number): ComicBubble {
  const scale = kind === 'sfx' || kind === 'stamp' ? SFX_START_SCALE : 1;
  return {
    id: newComicId('bubble'),
    kind,
    text: kind === 'stamp' ? DEFAULT_STAMP_ID : '',
    x,
    y,
    tail: BUBBLE_KIND_DEFAULTS[kind].tail ? { ...DEFAULT_TAIL } : null,
    scale,
    font: null,
    vertical: false,
    rotation: 0,
    ...kindLook(kind),
    dark: false,
    lineWidth: BUBBLE_LINE_WIDTH_RANGE.default,
    rough: BUBBLE_ROUGH_RANGE.default,
    width: BUBBLE_STRETCH_RANGE.default,
    height: BUBBLE_STRETCH_RANGE.default,
    tailWidth: BUBBLE_TAIL_WIDTH_RANGE.default,
    tailCurve: BUBBLE_TAIL_CURVE_RANGE.default,
    outline: null,
  };
}

export function emptyPanel(): ComicPanel {
  return {
    id: newComicId('panel'),
    prompt: '',
    negativePrompt: '',
    note: '',
    imageName: null,
    imageView: { ...DEFAULT_IMAGE_VIEW },
    takes: [],
    poses: [],
    poseImageName: null,
    cast: [],
    figures: [],
    bubbles: [],
  };
}

/** How a new page looks before anything is changed on it (Settings decide it for pages the user adds). */
export type PageLook = Partial<Pick<ComicPage, 'size' | 'direction' | 'frameMm' | 'marginMm'>>;

export function emptyPage(panelCount = 3, look: PageLook = {}): ComicPage {
  const size = look.size ?? 'A4';
  return { id: newComicId('page'), panels: Array.from({ length: panelCount }, emptyPanel), columns: 2,
    direction: 'rtl',
    size: 'A4',
    shapes: null,
    free: false,
    backdrop: null,
    effect: null,
    frameMm: FRAME_WIDTH_RANGE.default,
    insetMm: PICTURE_INSET_RANGE.default,
    marginMm: FRAME_MARGIN_RANGE.default,
    frameColor: DEFAULT_FRAME_COLOR,
    canvas: defaultPageCanvas(size),
    ...look,
  };
}

export function newProject(name: string, now = Date.now(), firstPage: ComicPage = emptyPage()): ComicProject {
  return { id: newComicId('comic'), name, pages: [firstPage], effect: 'none', panelTemplates: [], pageTemplates: [], cast: [], places: [], createdAt: now, updatedAt: now };
}
