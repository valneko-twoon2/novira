import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countTagOf, readScene, SCENE_PEOPLE_MAX, SCENE_POSES, SCENE_THINGS_WEIGHT, sceneOps, scenePrompt, type Scene, type SceneContext } from './scene';

const CAST: SceneContext['cast'] = [
  { name: 'Mio', tags: '1girl, teenage' },
  { name: 'Sota', tags: '1boy, young man' },
  { name: 'Goro', tags: '1dog, shiba inu', nonHuman: true },
];
const ctx = (over: Partial<SceneContext> = {}): SceneContext => ({ cast: CAST, rtl: true, bubbleIds: [], ...over });
const scene = (op: Record<string, unknown>): Scene => readScene({ panel: 1, ...op }).scene!;
type Person = { x?: number; y?: number; neck?: { x: number; y: number }; size?: number; back?: boolean; turn?: number; head?: { turn?: number }; who: string; words: string };
const people = (ops: Record<string, unknown>[]) => (ops.find((o) => o.op === 'pose')!.people as Person[]) ?? [];

describe('readScene', () => {
  it('needs a panel number from 1', () => {
    expect(readScene({}).scene).toBeNull();
    expect(readScene({ panel: 0 }).scene).toBeNull();
    expect(readScene({ panel: 1.5 }).notes[0]).toMatch(/panel/);
  });

  it('lets a person stand when the pose is unknown, and says so', () => {
    const { scene: read, notes } = readScene({ panel: 1, people: [{ who: 'Mio', pose: 'moonwalk' }] });
    expect(read!.people[0]!.pose).toBe('standing');
    expect(notes[0]).toMatch(/moonwalk/);
  });

  it(`places ${SCENE_PEOPLE_MAX} people at most and says the rest were left out`, () => {
    const { scene: read, notes } = readScene({ panel: 1, people: Array.from({ length: 6 }, () => ({ who: 'Mio' })) });
    expect(read!.people).toHaveLength(SCENE_PEOPLE_MAX);
    expect(notes.some((n) => /at most/.test(n))).toBe(true);
  });

  it('takes a line with a speaker as speech and one without as narration, and drops empty lines', () => {
    const read = scene({ lines: [{ who: 'Mio', text: 'Hi' }, { text: 'Later that day' }, { who: 'Sota', text: '  ' }] });
    expect(read.lines).toEqual([
      { who: 'Mio', text: 'Hi', kind: 'speech' },
      { who: null, text: 'Later that day', kind: 'caption' },
    ]);
  });

  it('frames people in full and an empty panel wide when the shot is not given; an unknown shot is told', () => {
    expect(scene({ people: [{ who: 'Mio' }] }).shot).toBe('full');
    expect(scene({}).shot).toBe('wide');
    expect(readScene({ panel: 1, shot: 'macro' }).notes[0]).toMatch(/shot is one of/);
  });

  it('keeps the place as it is when not given, takes it out with null, and sets it by name', () => {
    expect('place' in scene({})).toBe(false);
    expect(scene({ place: null }).place).toBeNull();
    expect(scene({ place: ' Cafe ' }).place).toBe('Cafe');
  });
});

describe('scenePrompt', () => {
  it('says solo for one person, the framing and what they do, and asks for the things more strongly', () => {
    const prompt = scenePrompt(scene({ shot: 'chest', people: [{ who: 'Mio', doing: 'holding a cup', face: 'smile' }], things: 'steaming tea, rainbow in the window' }), CAST);
    expect(prompt).toBe(`solo, upper body, holding a cup, smile, (steaming tea:${SCENE_THINGS_WEIGHT}), (rainbow in the window:${SCENE_THINGS_WEIGHT})`);
  });

  it('counts several characters by their own count tags, since they are drawn in regions without them in front', () => {
    const prompt = scenePrompt(scene({ people: [{ who: 'Mio' }, { who: 'Sota' }], also: ['Goro'] }), CAST);
    expect(prompt.startsWith('1girl, 1boy, 1dog, full body')).toBe(true);
    expect(prompt).toContain('looking at another');
  });

  it('counts a person whose tags hold no count tag by the words they hold, and leaves out an uncounted animal', () => {
    // A run with Claude Haiku on 2026-10-17 wrote cast tags such as "young adult female".
    const cast = [
      { name: 'A', tags: 'young adult female' },
      { name: 'B', tags: 'young adult male' },
      { name: 'C', tags: 'elderly shopkeeper' },
      { name: 'D', tags: 'fox spirit', nonHuman: true },
    ];
    expect(scenePrompt(scene({ people: [{ who: 'A' }, { who: 'B' }, { who: 'C' }], also: ['D'] }), cast).startsWith('1girl, 1boy, 1other, full body')).toBe(true);
    expect(countTagOf('young adult female')).toBeNull();
    expect(countTagOf('teen, 2girls')).toEqual({ n: 2, noun: 'girl' });
  });

  it('adds up characters of the same kind', () => {
    const cast = [...CAST, { name: 'Rin', tags: '1girl' }];
    expect(scenePrompt(scene({ people: [{ who: 'Mio' }, { who: 'Rin' }] }), cast).startsWith('2girls')).toBe(true);
  });

  it('says from behind or from side for one person facing away or sideways, and the angle', () => {
    expect(scenePrompt(scene({ people: [{ who: 'Mio', facing: 'away' }] }), CAST)).toContain('from behind');
    expect(scenePrompt(scene({ people: [{ who: 'Mio', facing: 'left' }], angle: 'above' }), CAST)).toBe('solo, full body, from above, from side');
  });

  it('says no humans for an empty panel and a face shot as a close-up', () => {
    expect(scenePrompt(scene({ things: 'rainbow' }), CAST)).toBe(`no humans, wide shot, (rainbow:${SCENE_THINGS_WEIGHT})`);
    expect(scenePrompt(scene({ shot: 'face', people: [{ who: 'Mio' }] }), CAST)).toBe('solo, close-up, portrait');
  });

  it('says male focus for a panel whose people are all men, with or without an animal, and not when a woman is there', () => {
    // A tag model drew the man of a Haiku run as a woman in every panel; male focus is how Danbooru tags such pictures.
    expect(scenePrompt(scene({ shot: 'face', people: [{ who: 'Sota' }] }), CAST)).toBe('solo, male focus, close-up, portrait');
    expect(scenePrompt(scene({ people: [{ who: 'Sota' }], also: ['Goro'] }), CAST).startsWith('1boy, 1dog, male focus, full body')).toBe(true);
    expect(scenePrompt(scene({ people: [{ who: 'Sota' }, { who: 'Mio' }] }), CAST)).not.toContain('male focus');
    expect(scenePrompt(scene({ also: ['Goro'] }), CAST)).not.toContain('male focus');
  });

  it('does not say they look at each other when both face the viewer', () => {
    const prompt = scenePrompt(scene({ people: [{ who: 'Mio', facing: 'viewer' }, { who: 'Sota', facing: 'viewer' }] }), CAST);
    expect(prompt).not.toContain('looking at another');
  });
});

describe('sceneOps', () => {
  it('makes the panel, then the pose, then the balloons, in the order they must run', () => {
    const { ops } = sceneOps(scene({ people: [{ who: 'Mio' }], lines: [{ who: 'Mio', text: 'Hi' }] }), ctx({ bubbleIds: ['old'] }));
    expect(ops.map((o) => o.op)).toEqual(['panel', 'pose', 'removeBubble', 'addBubble']);
    expect(ops[2]).toEqual({ op: 'removeBubble', id: 'old' });
  });

  it('leaves the balloons alone when the scene gives no lines', () => {
    const { ops } = sceneOps(scene({ people: [{ who: 'Mio' }] }), ctx({ bubbleIds: ['old'] }));
    expect(ops.map((o) => o.op)).toEqual(['panel', 'pose']);
  });

  it('puts the known characters in the cast and tells the unknown and the unnamed', () => {
    const { ops, notes } = sceneOps(scene({ people: [{ who: 'mio' }, { who: 'Nobody' }, {}], also: ['Goro'] }), ctx());
    expect(ops[0]!.cast).toEqual(['mio', 'Goro']);
    expect(notes.some((n) => /"Nobody"/.test(n))).toBe(true);
    expect(notes.some((n) => /no "who"/.test(n))).toBe(true);
  });

  it('spreads two people across the panel and turns them towards each other', () => {
    const [left, right] = people(sceneOps(scene({ people: [{ who: 'Mio' }, { who: 'Sota' }] }), ctx()).ops);
    expect([left!.x, right!.x]).toEqual([0.3, 0.7]);
    expect(left!.head!.turn).toBeGreaterThan(0);
    expect(right!.head!.turn).toBeLessThan(0);
    expect(left!.who).toBe('Mio');
  });

  it('frames a chest shot by the neck and a large size, and stands a person where at says', () => {
    const [p] = people(sceneOps(scene({ shot: 'chest', people: [{ who: 'Mio', at: 'right' }] }), ctx()).ops);
    expect(p!.neck).toEqual({ x: 0.73, y: 0.4 });
    expect(p!.size).toBe(1.55);
  });

  it('shows a person facing away from behind and keeps the ready-made body', () => {
    const [p] = people(sceneOps(scene({ people: [{ who: 'Mio', pose: 'sittingOnChair', facing: 'away' }] }), ctx()).ops);
    expect(p!.back).toBe(true);
    expect(p).toMatchObject(SCENE_POSES.get('sittingOnChair')!);
  });

  it('gives a face close-up no pose, so the stick figure of a head is not drawn as a body', () => {
    expect(people(sceneOps(scene({ shot: 'face', people: [{ who: 'Mio' }] }), ctx()).ops)).toEqual([]);
  });

  it('gives each person their own words for their region', () => {
    const [p] = people(sceneOps(scene({ people: [{ who: 'Mio', doing: 'pouring tea', face: 'smile' }] }), ctx()).ops);
    expect(p!.words).toBe('pouring tea, smile');
  });

  it('aims a line at its speaker, sets Japanese vertically on a page read from the right, and narrates without a speaker', () => {
    const lines = [
      { who: 'Sota', text: 'また来ます' },
      { who: 'Mio', text: 'shh', kind: 'whisper' },
      { text: 'その夜' },
    ];
    const { ops } = sceneOps(scene({ people: [{ who: 'Mio' }, { who: 'Sota' }], lines }), ctx());
    const balloons = ops.filter((o) => o.op === 'addBubble');
    expect(balloons[0]).toMatchObject({ kind: 'speech', speaker: 2, vertical: true, text: 'また来ます' });
    expect(balloons[1]).toMatchObject({ kind: 'speech', line: 'dashed', speaker: 1, vertical: false });
    expect(balloons[2]).toMatchObject({ kind: 'caption', vertical: true });
    expect(balloons[2]).not.toHaveProperty('speaker');
    expect(sceneOps(scene({ people: [{ who: 'Mio' }], lines: [{ who: 'Mio', text: 'はい' }] }), ctx({ rtl: false })).ops.at(-1)).toMatchObject({ vertical: false });
  });

  it('tells a line whose speaker is not a person of the scene', () => {
    const { notes } = sceneOps(scene({ people: [{ who: 'Mio' }], lines: [{ who: 'Sota', text: 'hello' }] }), ctx());
    expect(notes.some((n) => /Sota/.test(n))).toBe(true);
  });
});

describe('the comic tool and the poses', () => {
  it('names only poses a scene can take', () => {
    // The scene operation is described to the assistant on the Rust side; a pose named there must exist here.
    const tools = readFileSync(new URL('../../../../backend/crates/novira-core/src/agent/tools.rs', import.meta.url), 'utf8');
    const list = /pose is one of ([^.]+)\./.exec(tools)?.[1];
    expect(list).toBeTruthy();
    const ids = list!.split(',').map((s) => s.trim());
    expect(ids.length).toBeGreaterThan(10);
    expect(ids.filter((id) => !SCENE_POSES.has(id))).toEqual([]);
  });
});
