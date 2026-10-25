import { newRough } from './rough';
import { describe, expect, it } from 'vitest';
import { COMIC_VERSION, DEFAULT_IMAGE_VIEW, emptyPanel, IMAGE_SCALE_RANGE, newBubble, parseComicProject, parseComicRecords, parseFigures, parsePoseCast, parsePoseWords, MAX_POSE_PEOPLE, POSE_WORDS_MAX, PLACE_TAGS_MAX, PLACES_MAX, POSE_JOINT_COUNT, serializeComicProject, WORLD_MAX, type ComicPoint } from './document';

const joints = (n = POSE_JOINT_COUNT): ComicPoint[] => Array.from({ length: n }, (_, i) => ({ x: i / 100, y: 0.5 }));

const saved = {
  version: COMIC_VERSION,
  id: 'comic-1',
  name: 'Trip',
  createdAt: 1,
  updatedAt: 5,
  pages: [
    {
      id: 'page-1',
      panels: [
        {
          id: 'panel-1',
          prompt: 'a cat',
          imageName: 'img-1.png',
          poses: [joints()],
          poseImageName: 'pose-1.png',
          bubbles: [
            {
              ...{ id: 'b1', kind: 'caption', text: 'Once', x: 0.1, y: 0.2, tail: null, scale: 1, font: 'Yu Mincho', vertical: false, rotation: 0 },
              ...{ line: 'dashed', dark: true, lineWidth: 2, rough: 0.2, width: 1.5, height: 0.8, spikes: 12, depth: 0.3, tailWidth: 1.4, tailCurve: -0.5 },
              outline: { points: [{ x: 0, y: 0 }, { x: 1, y: 0.1 }, { x: 0.5, y: 1 }], smooth: false },
            },
          ],
        },
      ],
    },
  ],
};

describe('reading a saved comic project', () => {
  it('reads what it wrote', () => {
    const project = parseComicProject(saved);
    expect(project).not.toBeNull();
    expect(project!.pages[0]!.panels[0]).toEqual({
      ...saved.pages[0]!.panels[0],
      negativePrompt: '',
      note: '',
      imageView: DEFAULT_IMAGE_VIEW,
      takes: [],
      cast: [],
      figures: [],
    });
  });

  it('reads the cast and who is in each panel, keeps what is in range, and reads a comic saved before casts as having none', () => {
    const withCast = {
      ...saved,
      cast: [{ id: 'c1', name: 'Grandpa', tags: '1boy, old man' }, { id: 'c2' }, { id: 'c3', name: 'x'.repeat(100), tags: 'y'.repeat(900) }, ...Array.from({ length: 12 }, (_, i) => ({ id: 'e' + i, name: 'E' + i, tags: '' }))],
      pages: [{ id: 'p', panels: [{ id: 'x', cast: ['c1', 3, 'c3'] }] }],
    };
    const project = parseComicProject(withCast)!;
    expect(project.cast).toHaveLength(8);
    expect(project.cast[0]).toEqual({ id: 'c1', name: 'Grandpa', tags: '1boy, old man', imageName: null });
    expect(project.cast[1]!.name).toHaveLength(40);
    expect(project.cast[1]!.tags).toHaveLength(600);
    expect(project.pages[0]!.panels[0]!.cast).toEqual(['c1', 'c3']);
    const again = parseComicProject(serializeComicProject(project))!;
    expect(again.cast).toEqual(project.cast);
    expect(parseComicProject(saved)!.cast).toEqual([]);
  });

  it('reads a panel saved before several people and tails: its pose is the one person, and balloons get the default tail', () => {
    const old = {
      ...saved,
      pages: [{ id: 'p', panels: [{ id: 'x', pose: joints(), bubbles: [{ id: 'b', kind: 'speech', text: 'Hi', x: 0, y: 0 }] }] }],
    };
    const panel = parseComicProject(old)!.pages[0]!.panels[0]!;
    expect(panel.poses).toEqual([joints()]);
    expect(panel.bubbles[0]).toMatchObject({ kind: 'speech', tail: { x: 0.08, y: 1.18 }, scale: 1, vertical: false });
  });

  it('reads a balloon saved before its look could be changed with the look its shape starts with, and keeps a look in range', () => {
    const old = {
      ...saved,
      pages: [
        {
          id: 'p',
          panels: [
            {
              id: 'x',
              bubbles: [
                { id: 'a', kind: 'shout', text: 'Hey' },
                { id: 'b', kind: 'flash', text: '!', lineWidth: 99, rough: -1, width: 0, spikes: 1000, depth: 7, outline: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } },
                { id: 'c', kind: 'balloon-of-the-future', line: 'wiggly', outline: { points: [{ x: 9, y: -9 }, { x: 1, y: 0 }, { x: 0, y: 1 }], smooth: true } },
              ],
            },
          ],
        },
      ],
    };
    const [shout, flash, unknown] = parseComicProject(old)!.pages[0]!.panels[0]!.bubbles;
    expect(shout).toMatchObject({ line: 'solid', dark: false, lineWidth: 1, rough: 0.4, width: 1, height: 1, spikes: 16, depth: 0.45, tailWidth: 1, tailCurve: 0, outline: null });
    // Out of range is brought into range; an outline of two points is no outline.
    expect(flash).toMatchObject({ line: 'none', lineWidth: 4, rough: 0, width: 0.6, spikes: 90, depth: 1, outline: null });
    // An unknown shape is read as speech, an unknown line as the shape's own, and a drawn point is kept near the box.
    expect(unknown).toMatchObject({ kind: 'speech', line: 'solid', outline: { points: [{ x: 2, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }], smooth: true } });
  });

  it('reads a sound effect with its slant kept in range, and a balloon saved before slants as upright', () => {
    const old = {
      ...saved,
      pages: [{ id: 'p', panels: [{ id: 'x', bubbles: [{ id: 'a', kind: 'sfx', text: 'Boom', rotation: 400, scale: 3 }, { id: 'b', kind: 'speech', text: 'Hi' }] }] }],
    };
    const bubbles = parseComicProject(old)!.pages[0]!.panels[0]!.bubbles;
    expect(bubbles[0]).toMatchObject({ kind: 'sfx', rotation: 90, scale: 3 });
    expect(bubbles[1]).toMatchObject({ rotation: 0 });
  });

  it('keeps a stamp balloon as it was saved, with the id of its picture as its text', () => {
    const bubble = newBubble('stamp', 0.2, 0.3);
    const again = parseComicProject({ ...saved, pages: [{ id: 'p', panels: [{ id: 'x', bubbles: [{ ...bubble, text: 'burst-doon', rotation: 12 }] }] }] })!.pages[0]!.panels[0]!.bubbles[0]!;
    expect(again).toMatchObject({ kind: 'stamp', text: 'burst-doon', rotation: 12, tail: null, line: 'none' });
  });

  it('reads a page saved before columns and reading direction: two columns, read from the right', () => {
    const page = parseComicProject(saved)!.pages[0]!;
    expect(page).toMatchObject({ columns: 2, direction: 'rtl' });
  });

  it('keeps a balloon font that is a plain name and a text size in range, and drops the rest', () => {
    const bubble = (b: Record<string, unknown>) =>
      parseComicProject({ ...saved, pages: [{ id: 'p', panels: [{ id: 'x', bubbles: [{ id: 'b', kind: 'speech', text: '', x: 0, y: 0, ...b }] }] }] })!.pages[0]!.panels[0]!.bubbles[0]!;
    expect(bubble({ font: ' 源ノ角ゴシック JP ', scale: 1.7 })).toMatchObject({ font: '源ノ角ゴシック JP', scale: 1.7 });
    expect(bubble({ font: 'Evil", serif', scale: 0.1 })).toMatchObject({ font: null, scale: 0.4 });
    expect(bubble({ font: 'a\\b', scale: 99 })).toMatchObject({ font: null, scale: 4 });
    expect(bubble({ font: 'x'.repeat(129), scale: 'big' })).toMatchObject({ font: null, scale: 1 });
    expect(bubble({ font: 3 })).toMatchObject({ font: null });
  });

  it('keeps a balloon with no tail as it was saved, and an unknown kind as speech', () => {
    const doc = { ...saved, pages: [{ id: 'p', panels: [{ id: 'x', bubbles: [{ id: 'b', kind: 'zigzag', text: '', x: 0, y: 0, tail: null }] }] }] };
    expect(parseComicProject(doc)!.pages[0]!.panels[0]!.bubbles[0]).toMatchObject({ kind: 'speech', tail: null });
  });

  it('refuses a document of another version, or one without an id', () => {
    expect(parseComicProject({ ...saved, version: COMIC_VERSION + 1 })).toBeNull();
    expect(parseComicProject({ ...saved, version: undefined })).toBeNull();
    expect(parseComicProject({ ...saved, id: 7 })).toBeNull();
    expect(parseComicProject(null)).toBeNull();
    expect(parseComicProject([saved])).toBeNull();
  });

  it('drops a pose that does not have all the joints', () => {
    const doc = { ...saved, pages: [{ id: 'p', panels: [{ id: 'x', poses: [joints(17)] }] }] };
    expect(parseComicProject(doc)!.pages[0]!.panels[0]!.poses).toEqual([]);
  });

  it('keeps the parts it can read and skips the rest', () => {
    const doc = {
      ...saved,
      pages: [
        { id: 'good', panels: [{ id: 'p1', bubbles: [{ id: 'b', text: 'hi', x: 2, y: -1 }, { text: 'no id' }] }, 'junk'] },
        'not a page',
      ],
    };
    const project = parseComicProject(doc)!;
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]!.panels).toHaveLength(1);
    const bubble = project.pages[0]!.panels[0]!.bubbles[0]!;
    expect(bubble).toMatchObject({ kind: 'speech', text: 'hi', x: 1, y: 0 });
  });

  it('fills the missing fields with the empty values', () => {
    const project = parseComicProject({ version: COMIC_VERSION, id: 'c' })!;
    expect(project).toEqual({ id: 'c', name: '', pages: [], effect: 'none', panelTemplates: [], pageTemplates: [], cast: [], places: [], createdAt: 0, updatedAt: 0 });
  });

  it('reads the picture view and the negative prompt, and keeps a view within its range', () => {
    const view = { cx: 5, cy: -3, scale: 99, rotation: 270, flipX: true, flipY: 'yes' };
    const doc = { ...saved, pages: [{ id: 'p', panels: [{ id: 'x', negativePrompt: 'blur', imageView: view }] }] };
    const panel = parseComicProject(doc)!.pages[0]!.panels[0]!;
    expect(panel).toMatchObject({ negativePrompt: 'blur', imageView: { cx: 2, cy: -1, scale: IMAGE_SCALE_RANGE.max, rotation: -90, flipX: true, flipY: false } });
  });

  it('reads the frame width and the inset of a page, keeps them within range, and gives a page saved without them the defaults', () => {
    const doc = (page: object) => ({ ...saved, pages: [{ id: 'p', panels: [], ...page }] });
    expect(parseComicProject(doc({ frameMm: 1.2, insetMm: 4 }))!.pages[0]).toMatchObject({ frameMm: 1.2, insetMm: 4 });
    expect(parseComicProject(doc({ frameMm: 50, insetMm: -1, marginMm: 99 }))!.pages[0]).toMatchObject({ frameMm: 3, insetMm: 0, marginMm: 10 });
    expect(parseComicProject(doc({}))!.pages[0]).toMatchObject({ frameMm: 0.6, insetMm: 0, marginMm: 0 });
  });

  it('keeps the placement of a picture saved when it could only be enlarged and slid inside its panel', () => {
    // Enlarged twice and slid to its left edge: the picture's centre was one panel width right of that edge.
    const doc = { ...saved, pages: [{ id: 'p', panels: [{ id: 'x', imageView: { x: 0, y: 1, scale: 2 } }] }] };
    expect(parseComicProject(doc)!.pages[0]!.panels[0]!.imageView).toEqual({ ...DEFAULT_IMAGE_VIEW, cx: 1, cy: 0, scale: 2 });
    // Out of range values of the old view are kept within it as they were then.
    const wild = { ...saved, pages: [{ id: 'p', panels: [{ id: 'x', imageView: { x: 2, y: -1, scale: 9 } }] }] };
    expect(parseComicProject(wild)!.pages[0]!.panels[0]!.imageView).toEqual({ ...DEFAULT_IMAGE_VIEW, cx: -1, cy: 2, scale: 4 });
  });

  it('reads the templates and skips the broken ones', () => {
    const doc = {
      ...saved,
      panelTemplates: [{ id: 't1', name: 'Hero', prompt: 'a hero', bubbles: [{ id: 'b', kind: 'shout', text: 'Go', x: 0, y: 0 }, 'junk'] }, { name: 'no id' }],
      pageTemplates: [{ id: 'g1', name: 'Four', panelCount: 4, columns: 2, direction: 'ltr', size: 'B5', shapes: null }, { id: 'g2', name: 'Bad', panelCount: 4, columns: 7, direction: 'up', size: 'Z9' }],
    };
    const project = parseComicProject(doc)!;
    expect(project.panelTemplates).toHaveLength(1);
    expect(project.panelTemplates[0]).toMatchObject({ id: 't1', name: 'Hero', prompt: 'a hero', negativePrompt: '', poses: [], bubbles: [{ kind: 'shout', text: 'Go' }] });
    expect(project.pageTemplates).toEqual([
      { id: 'g1', name: 'Four', panelCount: 4, columns: 2, direction: 'ltr', size: 'B5', shapes: null },
      { id: 'g2', name: 'Bad', panelCount: 4, columns: 2, direction: 'rtl', size: 'A4', shapes: null },
    ]);
  });

  it('lists the readable projects newest first and skips the rest', () => {
    const records = [
      { id: 'old', updatedAt: 1, document: { ...saved, id: 'old', updatedAt: 1 } },
      { id: 'broken', updatedAt: 9, document: { version: 99 } },
      { id: 'new', updatedAt: 3, document: { ...saved, id: 'new', updatedAt: 3 } },
    ];
    expect(parseComicRecords(records).map((p) => p.id)).toEqual(['new', 'old']);
  });
});

describe('a reference image saved by an older version', () => {
  it('is dropped: the panel, its template and the project no longer hold one', () => {
    const reference = { imageName: 'hero.png', modelKey: 'ipa-sdxl', clipVisionModel: 'ViT-H', method: 'full', weight: 1 };
    const doc = { ...saved, reference, pages: [{ id: 'p', panels: [{ id: 'x', reference }] }], panelTemplates: [{ id: 't1', name: 'Hero', reference }] };
    const project = parseComicProject(doc)!;
    expect(project).not.toHaveProperty('reference');
    expect(project.pages[0]!.panels[0]).not.toHaveProperty('reference');
    expect(project.panelTemplates[0]).not.toHaveProperty('reference');
  });
});

describe('the strength of the character references', () => {
  it('is kept in its range, and a comic without one, or with something else, does not use them', () => {
    expect(parseComicProject({ ...saved, castReference: 0.4 })!.castReference).toBe(0.4);
    expect(parseComicProject({ ...saved, castReference: 5 })!.castReference).toBe(1);
    expect(parseComicProject({ ...saved, castReference: 0 })!.castReference).toBe(0.1);
    for (const off of [undefined, null, 'on', Number.NaN]) expect(parseComicProject({ ...saved, castReference: off })).not.toHaveProperty('castReference');
  });
});

describe('the places of a comic and its world', () => {
  it('keeps each readable place once, cut to its limits, with its words and what it keeps out', () => {
    const long = 'x'.repeat(PLACE_TAGS_MAX + 50);
    const places = [
      { id: 'room', name: 'Mio’s room', tags: 'bedroom, desk lamp', negative: ' cars ' },
      { id: 'room', name: 'twice', tags: 'ignored' },
      { id: 'pier', name: 'Pier', tags: long, negative: '  ' },
      { name: 'no id', tags: 'street' },
      'a street',
      { id: '', name: 'empty id' },
    ];
    expect(parseComicProject({ ...saved, places })!.places).toEqual([
      { id: 'room', name: 'Mio’s room', tags: 'bedroom, desk lamp', negative: 'cars' },
      { id: 'pier', name: 'Pier', tags: long.slice(0, PLACE_TAGS_MAX) },
    ]);
    const many = Array.from({ length: PLACES_MAX + 3 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, tags: '' }));
    expect(parseComicProject({ ...saved, places: many })!.places).toHaveLength(PLACES_MAX);
    expect(parseComicProject({ ...saved, places: 'beach' })!.places).toEqual([]);
  });

  it('keeps the world line cut to its limit, and none when it holds no word', () => {
    expect(parseComicProject({ ...saved, world: 'summer, seaside town' })!.world).toBe('summer, seaside town');
    expect(parseComicProject({ ...saved, world: 'w'.repeat(WORLD_MAX + 9) })!.world).toHaveLength(WORLD_MAX);
    for (const none of [undefined, '', '  ', 7]) expect(parseComicProject({ ...saved, world: none })).not.toHaveProperty('world');
  });

  it('reads where a panel is set, and leaves it out when it names nothing', () => {
    const page = (place: unknown) => ({ ...saved, pages: [{ id: 'p', panels: [{ id: 'x', place }] }] });
    expect(parseComicProject(page('room'))!.pages[0]!.panels[0]!.place).toBe('room');
    for (const none of [undefined, '', 3, null]) expect(parseComicProject(page(none))!.pages[0]!.panels[0]).not.toHaveProperty('place');
  });
});

describe('the 3D rough of a panel', () => {
  const panelWith = (fields: Record<string, unknown>) => parseComicProject({ ...saved, pages: [{ id: 'p', panels: [{ id: 'x', ...fields }] }] })!.pages[0]!.panels[0]!;

  it('reads back a panel rough and its depth map', () => {
    const rough = newRough();
    const panel = panelWith({ rough: JSON.parse(JSON.stringify(rough)), depthImageName: 'depth.png' });
    expect(panel.rough).toEqual(rough);
    expect(panel.depthImageName).toBe('depth.png');
  });

  it('leaves out a rough that is not one and a depth map with no name', () => {
    for (const none of [undefined, 'rough', 4, []]) expect(panelWith({ rough: none })).not.toHaveProperty('rough');
    for (const none of [undefined, '', 7, null]) expect(panelWith({ depthImageName: none })).not.toHaveProperty('depthImageName');
  });
});

describe('writing a comic project', () => {
  it('writes the version with the project, and reads back the same project', () => {
    const project = parseComicProject(saved)!;
    const written = serializeComicProject(project) as Record<string, unknown>;
    expect(written.version).toBe(COMIC_VERSION);
    expect(parseComicProject(written)).toEqual(project);
  });

  it('keeps the known views of a character sheet and its library link, and drops what is wrong', () => {
    const project = parseComicProject(saved)!;
    const doc = serializeComicProject(project) as Record<string, unknown>;
    const read = (character: Record<string, unknown>) => parseComicProject({ ...doc, cast: [{ id: 'c', name: 'Mina', tags: '1girl', imageName: 'f.png', ...character }] })!.cast[0]!;
    expect(read({ sheet: { back: 'b.png', face: 'g.png', top: 'x.png', side: 3 }, libraryId: 'preset-1' })).toMatchObject({ sheet: { back: 'b.png', face: 'g.png' }, libraryId: 'preset-1' });
    for (const wrong of [{ sheet: {} }, { sheet: 'b.png' }, { sheet: { back: '' } }, { libraryId: 'x'.repeat(129) }, { libraryId: 7 }]) {
      const c = read(wrong);
      expect(c).not.toHaveProperty('sheet');
      expect(c).not.toHaveProperty('libraryId');
    }
  });

  it('makes panels with a prompt-less, pose-less, picture-less start', () => {
    expect(emptyPanel()).toMatchObject({ prompt: '', imageName: null, poses: [], poseImageName: null, bubbles: [] });
    expect(emptyPanel()).toMatchObject({ negativePrompt: '', imageView: DEFAULT_IMAGE_VIEW });
  });
});

describe('the figures of a panel', () => {
  it('keeps valid boxes inside the panel, drops the rest, and caps the count', () => {
    expect(parseFigures([{ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, { x: 0.8, y: 0.9, w: 0.5, h: 0.5 }])).toEqual([
      { x: 0.2, y: 0.2, w: 0.5, h: 0.5 },
      { x: 0.8, y: 0.9, w: expect.closeTo(0.2, 5), h: expect.closeTo(0.1, 5) },
    ]);
    expect(parseFigures([{ x: 0, y: 0, w: 0, h: 0.5 }, { x: NaN, y: 0, w: 1, h: 1 }, null, 'x'])).toEqual([]);
    expect(parseFigures(undefined)).toEqual([]);
    expect(parseFigures(Array.from({ length: 20 }, () => ({ x: 0, y: 0, w: 0.5, h: 0.5 })))).toHaveLength(8);
    expect(emptyPanel().figures).toEqual([]);
  });
});

describe('who each person of a pose is', () => {
  it('keeps ids and turns anything else into nobody, up to the limit', () => {
    expect(parsePoseCast(['a', '', 3, null, 'b'])).toEqual(['a', null, null, null, 'b']);
    expect(parsePoseCast(Array.from({ length: MAX_POSE_PEOPLE + 3 }, () => 'x'))).toHaveLength(MAX_POSE_PEOPLE);
  });

  it('survives a save and a read, and an older panel has none', () => {
    const project = parseComicProject(saved)!;
    expect(project.pages[0]!.panels[0]!.poseCast).toBeUndefined();
    project.pages[0]!.panels[0]!.poseCast = ['c1', null];
    expect(parseComicProject(serializeComicProject(project))!.pages[0]!.panels[0]!.poseCast).toEqual(['c1', null]);
  });
});

describe('what each person of a pose does', () => {
  it('keeps a text per person, cut to its limit, up to the people a pose keeps', () => {
    expect(parsePoseWords([' waving ', 3, null, 'x'.repeat(POSE_WORDS_MAX + 5)])).toEqual(['waving', '', '', 'x'.repeat(POSE_WORDS_MAX)]);
    expect(parsePoseWords(Array.from({ length: MAX_POSE_PEOPLE + 2 }, () => 'a'))).toHaveLength(MAX_POSE_PEOPLE);
  });

  it('survives a save and a read, and words that are all empty are not kept', () => {
    const project = parseComicProject(saved)!;
    expect(project.pages[0]!.panels[0]!.poseWords).toBeUndefined();
    project.pages[0]!.panels[0]!.poseWords = ['waving', ''];
    expect(parseComicProject(serializeComicProject(project))!.pages[0]!.panels[0]!.poseWords).toEqual(['waving', '']);
    project.pages[0]!.panels[0]!.poseWords = ['', ''];
    expect(parseComicProject(serializeComicProject(project))!.pages[0]!.panels[0]!.poseWords).toBeUndefined();
  });
});
