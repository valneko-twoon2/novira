// Which parts of a character a panel names: only what its framing shows.
import { describe, expect, it } from 'vitest';
import { allWords, characterWords, cleanParts, framingOf, CHARACTER_PART_MAX } from './characterLook';

const girl = { tags: '1girl, teen', parts: { hair: 'long black hair', eyes: 'green eyes', face: 'mole under left eye', outfit: 'navy blazer', body: 'slender', accessory: 'round glasses' } };

describe('framingOf', () => {
  it('reads the framing from the prompt, and takes a silent prompt as the whole person', () => {
    expect(framingOf('close-up of her face, rain')).toBe('close');
    expect(framingOf('Upper body, smiling')).toBe('bust');
    expect(framingOf('seen from behind on the stairs')).toBe('back');
    expect(framingOf('walking in the park')).toBe('full');
    expect(framingOf('')).toBe('full');
  });

  it('puts the view from behind before a close-up', () => {
    expect(framingOf('close-up from behind')).toBe('back');
  });
});

describe('characterWords', () => {
  it('names the head parts only in a close-up', () => {
    expect(characterWords(girl, 'close-up')).toBe('1girl, teen, long black hair, green eyes, mole under left eye, round glasses');
  });

  it('adds the clothes for an upper-body shot and everything for the whole person', () => {
    expect(characterWords(girl, 'upper body')).toContain('navy blazer');
    expect(characterWords(girl, 'upper body')).not.toContain('slender');
    expect(characterWords(girl, 'standing')).toContain('slender');
  });

  it('leaves out eyes and face from behind', () => {
    const words = characterWords(girl, 'from behind');
    expect(words).not.toContain('green eyes');
    expect(words).not.toContain('mole');
    expect(words).toContain('long black hair');
    expect(words).toContain('slender');
  });

  it('is just the tags for a character with no parts, and every word for the portrait', () => {
    expect(characterWords({ tags: '1dog, shiba inu' }, 'close-up')).toBe('1dog, shiba inu');
    expect(allWords(girl)).toContain('navy blazer');
    expect(allWords({ tags: ' ' })).toBe('');
  });
});

describe('a character that is not human', () => {
  it('is told with every part in every framing', () => {
    const beast = { tags: '1creature, giant', parts: { body: 'many thin arms', face: 'no face', hair: 'smoke' }, nonHuman: true };
    expect(characterWords(beast, 'from behind')).toBe('1creature, giant, smoke, no face, many thin arms');
    expect(characterWords({ ...beast, nonHuman: false }, 'close-up')).not.toContain('many thin arms');
  });
});

describe('cleanParts', () => {
  it('keeps known parts with words, cuts them, and gives nothing for an empty set', () => {
    expect(cleanParts({ hair: ' red ', nope: 'x', eyes: '', body: 3 })).toEqual({ hair: 'red' });
    expect(cleanParts({ hair: 'h'.repeat(500) })!.hair).toHaveLength(CHARACTER_PART_MAX);
    expect(cleanParts({})).toBeUndefined();
    expect(cleanParts('x')).toBeUndefined();
    expect(cleanParts([])).toBeUndefined();
  });
});
