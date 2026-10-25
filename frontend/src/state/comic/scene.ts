// A panel written as a scene: who is in it, where each person stands and which way they face, what they do, how
// near the camera is, what must be seen and who says what. The assistant fills these few fields and the app turns them into
// the operations a panel is made of (its prompt, cast, place and note, its pose with who is who, its balloons by speaker),
// so a small model writes the panel a large one would: every person named and placed, the framing in the prompt agreeing
// with the pose, and every line in a balloon aimed at its speaker. A real run on 2026-10-16 with Claude Haiku left every
// panel without a pose or a cast, and the pictures lost the characters' looks and the story's key thing (the rainbow).
import { POSE_PRESETS } from '@/state/pose/posePresets';
import type { PoseSpec } from '@/state/pose/poseSpec';

export const SCENE_SHOTS = ['wide', 'full', 'knees', 'chest', 'face'] as const;
export type SceneShot = (typeof SCENE_SHOTS)[number];
export const SCENE_ANGLES = ['eye', 'above', 'below'] as const;
export type SceneAngle = (typeof SCENE_ANGLES)[number];
export const SCENE_FACINGS = ['viewer', 'left', 'right', 'away'] as const;
export type SceneFacing = (typeof SCENE_FACINGS)[number];
export const SCENE_SPOTS = ['left', 'middle', 'right'] as const;
export type SceneSpot = (typeof SCENE_SPOTS)[number];
export const SCENE_LINE_KINDS = ['speech', 'thought', 'shout', 'whisper', 'caption'] as const;
export type SceneLineKind = (typeof SCENE_LINE_KINDS)[number];

/** The most people a scene places (the pose operation takes four). */
export const SCENE_PEOPLE_MAX = 4;
/** The most lines a scene puts in balloons. */
export const SCENE_LINES_MAX = 8;
/** The longest words of one field (a person's action, the things to show, a line). */
export const SCENE_WORDS_MAX = 300;

export interface ScenePerson {
  /** The cast name, as the scene gave it. */
  who: string;
  /** The id of a single-person ready-made pose (see SCENE_POSES). */
  pose: string;
  facing?: SceneFacing;
  at?: SceneSpot;
  /** English tags of what this person does, and of their expression. */
  doing: string;
  face: string;
}

export interface SceneLine {
  /** The cast name of the speaker; null for narration. */
  who: string | null;
  text: string;
  kind: SceneLineKind;
}

export interface Scene {
  panel: number;
  shot: SceneShot;
  angle: SceneAngle;
  /** The place's name; null takes the place out; undefined leaves it as it is. */
  place?: string | null;
  people: ScenePerson[];
  /** Cast names in the panel without a pose (an animal, a monster). */
  also: string[];
  /** English tags of the things the panel must show besides the people. */
  things: string;
  /** The lines in balloons; undefined leaves the panel's balloons as they are. */
  lines?: SceneLine[];
  note?: string;
  negative?: string;
}

/** What the app knows of the comic when it turns a scene into operations. */
export interface SceneContext {
  cast: readonly { name: string; tags: string; nonHuman?: boolean }[];
  /** True when the page is read from the right (manga), where Japanese lines are set vertically. */
  rtl: boolean;
  /** The panel's balloons that hold words (not sound effects), which the scene's lines replace. */
  bubbleIds: readonly string[];
}

/** The single-person ready-made poses a scene may name, by id, with only the shape of the body. */
export const SCENE_POSES: ReadonlyMap<string, PoseSpec> = new Map(POSE_PRESETS.filter((p) => !p.composed && p.people[0]).map((p) => [p.id, p.people[0]!]));
const DEFAULT_POSE = 'standing';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const words = (v: unknown, max = SCENE_WORDS_MAX): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined => options.find((o) => o === v);
const key = (name: string) => name.trim().toLowerCase();

/** A scene from the assistant's operation, with every field checked; the notes say what was left out or replaced. */
export function readScene(op: Record<string, unknown>): { scene: Scene | null; notes: string[] } {
  const notes: string[] = [];
  const panel = typeof op.panel === 'number' && Number.isInteger(op.panel) ? op.panel : NaN;
  if (!(panel >= 1)) return { scene: null, notes: ['scene needs "panel": the panel number, from 1'] };
  const people: ScenePerson[] = [];
  for (const raw of Array.isArray(op.people) ? op.people.slice(0, SCENE_PEOPLE_MAX) : []) {
    if (!isObject(raw)) continue;
    let pose = typeof raw.pose === 'string' ? raw.pose.trim() : DEFAULT_POSE;
    if (!SCENE_POSES.has(pose)) {
      notes.push(`no pose is named "${pose}", so the person stands (poses: ${SCENE_POSE_HINT})`);
      pose = DEFAULT_POSE;
    }
    people.push({
      who: words(raw.who, 80),
      pose,
      facing: oneOf(raw.facing, SCENE_FACINGS),
      at: oneOf(raw.at, SCENE_SPOTS),
      doing: words(raw.doing),
      face: words(raw.face, 80),
    });
  }
  if (Array.isArray(op.people) && op.people.length > SCENE_PEOPLE_MAX) notes.push(`a scene places ${SCENE_PEOPLE_MAX} people at most; the others were left out`);
  const lines = Array.isArray(op.lines)
    ? op.lines.slice(0, SCENE_LINES_MAX).flatMap((raw): SceneLine[] => {
        if (!isObject(raw)) return [];
        const text = words(raw.text);
        if (!text) return [];
        const who = words(raw.who, 80) || null;
        return [{ who, text, kind: oneOf(raw.kind, SCENE_LINE_KINDS) ?? (who ? 'speech' : 'caption') }];
      })
    : undefined;
  const shot = oneOf(op.shot, SCENE_SHOTS);
  if (op.shot !== undefined && !shot) notes.push(`shot is one of ${SCENE_SHOTS.join(', ')}`);
  return {
    scene: {
      panel,
      shot: shot ?? (people.length ? 'full' : 'wide'),
      angle: oneOf(op.angle, SCENE_ANGLES) ?? 'eye',
      ...(op.place === null ? { place: null } : typeof op.place === 'string' ? { place: op.place.trim() || null } : {}),
      people,
      also: Array.isArray(op.also) ? op.also.flatMap((n) => (typeof n === 'string' && n.trim() ? [n.trim()] : [])).slice(0, 4) : [],
      things: words(op.things),
      ...(lines ? { lines } : {}),
      ...(typeof op.note === 'string' ? { note: op.note } : {}),
      ...(typeof op.negative === 'string' ? { negative: words(op.negative) } : {}),
    },
    notes,
  };
}

/** A few pose ids to name in a note; the tool's description lists the common ones. */
const SCENE_POSE_HINT = ['standing', 'walking', 'running', 'sittingOnChair', 'kneeling', 'pointing', 'wave', 'armsCrossed', 'thinking', 'bowing'].join(', ');

const SHOT_WORDS: Record<SceneShot, string> = { wide: 'wide shot', full: 'full body', knees: 'cowboy shot', chest: 'upper body', face: 'close-up, portrait' };
const ANGLE_WORDS: Record<SceneAngle, string> = { eye: '', above: 'from above', below: 'from below' };
/**
 * How strongly the things a panel must show are asked for. SDXL tag models drop a thing named once among many words: the
 * rainbow of the run on 2026-10-16 was in the prompt and in no picture.
 */
export const SCENE_THINGS_WEIGHT = 1.2;

/** Where a person's body stands for each shot: the middle of the body (`y`) or the neck (`neckY`), and its size. */
const SHOT_FRAME: Record<Exclude<SceneShot, 'face'>, { y?: number; neckY?: number; size: number }> = {
  wide: { y: 0.62, size: 0.42 },
  full: { y: 0.55, size: 0.85 },
  knees: { neckY: 0.2, size: 1.05 },
  chest: { neckY: 0.4, size: 1.55 },
};
const SPOT_X: Record<SceneSpot, number> = { left: 0.27, middle: 0.5, right: 0.73 };
/** Where people stand when the scene does not say, by how many there are. */
const SPREAD: readonly (readonly number[])[] = [[], [0.5], [0.3, 0.7], [0.2, 0.5, 0.8], [0.14, 0.38, 0.62, 0.86]];

/** The side each person faces: as given, else the viewer for one person and the others for several. */
function facings(people: readonly ScenePerson[], xs: readonly number[]): SceneFacing[] {
  return people.map((p, i) => {
    if (p.facing) return p.facing;
    if (people.length < 2) return 'viewer';
    const others = xs.filter((_, j) => j !== i);
    const mean = others.reduce((a, b) => a + b, 0) / others.length;
    const x = xs[i] ?? 0.5;
    return Math.abs(mean - x) < 0.05 ? 'viewer' : mean > x ? 'right' : 'left';
  });
}

/** The person as the pose operation takes them: the ready-made body, placed for the shot, turned the way they face. */
function personSpec(person: ScenePerson, x: number, shot: Exclude<SceneShot, 'face'>, facing: SceneFacing): PoseSpec {
  const base = SCENE_POSES.get(person.pose) ?? SCENE_POSES.get(DEFAULT_POSE) ?? {};
  const frame = SHOT_FRAME[shot];
  const placed: PoseSpec = { ...base, ...(frame.neckY !== undefined ? { neck: { x, y: frame.neckY } } : { x, y: frame.y }), size: frame.size };
  // The head's turn says the side in an OpenPose picture: it moves the nose and hides the far ear (see poseFromSpec).
  if (facing === 'away') return { ...placed, back: true };
  if (facing === 'viewer') return { ...placed, head: { ...base.head, turn: 0 } };
  return { ...placed, turn: Math.min(base.turn ?? 1, 0.7), head: { ...base.head, turn: facing === 'right' ? 0.8 : -0.8 } };
}

const COUNT = /^(\d+)\s*([a-z]+?)s?$/i;

/** The count tag of a character's tags ("1girl", "1dog"), or null when they hold none. */
export function countTagOf(tags: string): { n: number; noun: string } | null {
  const tag = tags.split(',').map((t) => t.trim()).find((t) => COUNT.test(t));
  const m = tag ? COUNT.exec(tag) : null;
  return m ? { n: Number(m[1]), noun: m[2]!.toLowerCase() } : null;
}

const FEMALE = /\b(girl|woman|female|lady)\b/i;
const MALE = /\b(boy|man|male|guy)\b/i;

/** What a character counts as: its count tag, else a girl or a boy read from its words, else one other (a person). */
function countOf(c: { tags: string; nonHuman?: boolean }): { n: number; noun: string } | null {
  const tagged = countTagOf(c.tags);
  if (tagged || c.nonHuman) return tagged;
  return { n: 1, noun: FEMALE.test(c.tags) ? 'girl' : MALE.test(c.tags) ? 'boy' : 'other' };
}

/** The count tags of the characters together ("1girl, 1boy", "2girls"), from each character's count. */
function countWords(characters: readonly { tags: string; nonHuman?: boolean }[]): string {
  const counts = new Map<string, number>();
  for (const c of characters) {
    const count = countOf(c);
    if (count) counts.set(count.noun, (counts.get(count.noun) ?? 0) + count.n);
  }
  return [...counts].map(([noun, n]) => `${n}${noun}${n > 1 ? 's' : ''}`).join(', ');
}

/** Each comma-separated thing asked for more strongly, so the model does not drop it. */
const stressed = (things: string) =>
  things
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `(${t}:${SCENE_THINGS_WEIGHT})`)
    .join(', ');

/** The panel's prompt from the scene: counts, framing and angle, how the people face, what they do, then the things to show. */
export function scenePrompt(scene: Scene, cast: SceneContext['cast']): string {
  const find = (name: string) => cast.find((c) => key(c.name) === key(name));
  const characters = [...scene.people.map((p) => find(p.who)), ...scene.also.map(find)].filter((c): c is NonNullable<typeof c> => !!c);
  const people = scene.people.length;
  // One character is drawn as a whole with its tags (and their count) in front of the prompt; several are drawn in regions,
  // where their tags go with their region, so the prompt itself has to say how many there are (see request.ts).
  const counts = characters.length > 1 ? countWords(characters) : '';
  const crowd = people === 0 && !scene.also.length ? 'no humans' : people === 1 && !scene.also.length ? 'solo' : '';
  // A tag model drifts towards drawing a woman; Danbooru tags a picture of men only "male focus", and with it a comparison of
  // 2026-10-17 (same seed, the looks as tags) drew the man the prompt without it drew as a woman.
  const humans = characters.filter((c) => !c.nonHuman);
  const focus = humans.length && humans.every((c) => countOf(c)?.noun === 'boy') ? 'male focus' : '';
  const xs = spotsOf(scene.people);
  const faced = facings(scene.people, xs);
  // Two people turned towards each other: one faces right and someone further right faces left.
  const meet = faced.some((f, i) => f === 'right' && faced.some((g, j) => g === 'left' && (xs[j] ?? 0) > (xs[i] ?? 0)));
  const single = faced[0] === 'away' ? 'from behind' : faced[0] === 'left' || faced[0] === 'right' ? 'from side' : '';
  const facingWords = people === 1 ? single : meet ? 'looking at another' : '';
  const acts = scene.people.flatMap((p) => [p.doing, p.face]);
  return [counts, crowd, focus, SHOT_WORDS[scene.shot], ANGLE_WORDS[scene.angle], facingWords, ...acts, stressed(scene.things)].filter(Boolean).join(', ');
}

/** Where each person stands across the panel (fractions of its width). */
function spotsOf(people: readonly ScenePerson[]): number[] {
  const spread = SPREAD[people.length] ?? [];
  return people.map((p, i) => (p.at ? SPOT_X[p.at] : (spread[i] ?? 0.5)));
}

// Kana and ideographs, written as escapes: words of a language live in the catalogs, never in source.
const CJK = /[\u3040-\u30ff\u3400-\u9fff]/;

/** The balloon of one line: its kind, whether it is set vertically, and the person it points at (from 1), if they are posed. */
function lineOp(panel: number, line: SceneLine, speaker: number | null, rtl: boolean): Record<string, unknown> {
  const kind = line.kind === 'whisper' ? 'speech' : line.kind;
  return {
    op: 'addBubble',
    panel,
    kind,
    text: line.text,
    vertical: rtl && CJK.test(line.text),
    ...(line.kind === 'whisper' ? { line: 'dashed' } : {}),
    ...(speaker !== null && kind !== 'caption' ? { speaker } : {}),
  };
}

/**
 * The operations that make the panel the scene describes, in the order they must run: the panel (prompt, cast, place,
 * note), the pose (each person with who they are and their own words), then the lines as balloons, which need the pose to
 * find their speakers. The notes say what the scene named that the comic does not have.
 */
export function sceneOps(scene: Scene, ctx: SceneContext): { ops: Record<string, unknown>[]; notes: string[] } {
  const notes: string[] = [];
  const known = (name: string) => ctx.cast.some((c) => key(c.name) === key(name));
  for (const name of [...scene.people.map((p) => p.who), ...scene.also]) {
    if (!name) notes.push('a person of the scene has no "who": name the character of the cast');
    else if (!known(name)) notes.push(`no character is named "${name}"; the cast is: ${ctx.cast.map((c) => c.name).join(', ') || 'empty (add it with op cast first)'}`);
  }
  const cast = [...new Set([...scene.people.map((p) => p.who), ...scene.also].filter((n) => n && known(n)))];
  const ops: Record<string, unknown>[] = [
    {
      op: 'panel',
      panel: scene.panel,
      prompt: scenePrompt(scene, ctx.cast),
      cast,
      ...(scene.place !== undefined ? { place: scene.place } : {}),
      ...(scene.note !== undefined ? { note: scene.note } : {}),
      ...(scene.negative !== undefined ? { negativePrompt: scene.negative } : {}),
    },
  ];
  // A face close-up gets no pose: the stick figure of a head alone is not read as a body (see the comic tool's advice).
  const posed = scene.shot === 'face' ? [] : scene.people;
  const xs = spotsOf(posed);
  const faced = facings(posed, xs);
  ops.push({
    op: 'pose',
    panel: scene.panel,
    people: posed.map((p, i) => ({
      ...personSpec(p, xs[i] ?? 0.5, scene.shot as Exclude<SceneShot, 'face'>, faced[i] ?? 'viewer'),
      who: p.who,
      words: [p.doing, p.face].filter(Boolean).join(', '),
    })),
  });
  if (scene.lines) {
    for (const id of ctx.bubbleIds) ops.push({ op: 'removeBubble', id });
    for (const line of scene.lines) {
      const at = line.who ? posed.findIndex((p) => key(p.who) === key(line.who!)) : -1;
      if (line.who && at < 0 && !scene.people.some((p) => key(p.who) === key(line.who!))) notes.push(`the line "${line.text.slice(0, 20)}" names ${line.who}, who is not a person of this scene`);
      ops.push(lineOp(scene.panel, line, at >= 0 ? at + 1 : null, ctx.rtl));
    }
  }
  return { ops, notes };
}
