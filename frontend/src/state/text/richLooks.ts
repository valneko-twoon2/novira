// The looks of "finish with AI": the words the model reads, and the colours of the lit base it starts from. Picked by eye on
// real runs (a gold, fire, ice, neon, stone, candy and chrome lettering of four test words, docs/design/02-generation/04-media-screens/05-text-rich.md).

export const RICH_LOOK_IDS = ['gold', 'fire', 'ice', 'neon', 'stone', 'candy', 'chrome'] as const;
export type RichLookId = (typeof RICH_LOOK_IDS)[number];

export interface RichLook {
  id: RichLookId;
  /** English tags for the prompt. */
  words: string;
  /** Colour of the letters in the base picture, and of the ground around them. */
  fg: string;
  bg: string;
}

export const RICH_LOOKS: Record<RichLookId, RichLook> = {
  gold: {
    id: 'gold',
    words: 'golden metal lettering, shiny gold letters, ornate engraved gold, metallic reflections, bevel, emblem, simple black background',
    fg: '#c9952b',
    bg: '#0e0e10',
  },
  fire: {
    id: 'fire',
    words: 'flaming letters, letters made of fire, burning, glowing embers, orange flames, sparks, simple black background',
    fg: '#f0601a',
    bg: '#0a0606',
  },
  ice: {
    id: 'ice',
    words: 'ice letters, letters made of frozen crystal, translucent blue ice, frost, sparkles, simple dark blue background',
    fg: '#8fd8ff',
    bg: '#0b1426',
  },
  neon: {
    id: 'neon',
    words: 'holographic neon letters, hot pink to cyan gradient, glowing edges, bright inner light, glass, shiny, simple dark background',
    fg: '#eb3cbe',
    bg: '#080614',
  },
  stone: {
    id: 'stone',
    words: 'carved stone letters, cracked rock, ancient ruins texture, moss, rough surface, simple dark background',
    fg: '#8c8278',
    bg: '#141416',
  },
  candy: {
    id: 'candy',
    words: 'candy letters, glossy jelly, shiny plastic, vivid pink and purple, sweet, cute, simple dark background',
    fg: '#ff6ea0',
    bg: '#281428',
  },
  chrome: {
    id: 'chrome',
    words: 'polished chrome letters, mirror metal, silver, sharp reflections, bevel, simple black background',
    fg: '#bec8d7',
    bg: '#0c0e14',
  },
};

/** The ground of the base picture when no look is chosen: dark and neutral, so nothing pushes the colour of the letters. */
export const RICH_NEUTRAL_BG = '#101014';
