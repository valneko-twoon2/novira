// The keyword rules of the mock text assistant, one wording at a time (English replies, to cover both reply languages).
import { describe, expect, it } from 'vitest';
import { textEdit } from './agentText';
import type { AgentRequest } from '../types';

const layer = { id: 'l1', type: 'text', text: 'LOGO', x: 10, y: 20, rotation: 0, style: { fontSize: 100, vertical: false, shadow: null, stroke: null } };
const bubble = { ...layer, id: 'b1', type: 'bubble' };
const scene = (layers: unknown[]) => ({ width: 1000, height: 800, layers });

function ask(message: string, layers: unknown[] = [layer], selected: string | null = 'l1', locale = 'en') {
  return textEdit({ message, locale } as AgentRequest, { selectedLayerId: selected, scene: scene(layers) } as never);
}
const update = (message: string, layers?: unknown[]) => {
  const reply = ask(message, layers)!;
  return { reply, ops: reply.ops as { op: string; id?: string; set?: Record<string, unknown> & { style?: Record<string, unknown> } }[] };
};

describe('textEdit', () => {
  it('does not answer without a text scene', () => {
    expect(textEdit({ message: 'x', locale: 'en' }, undefined)).toBeNull();
    expect(textEdit({ message: 'x', locale: 'en' }, {})).toBeNull();
  });

  it.each([
    ['make it blue', '#2f6feb'],
    ['yellow please', '#ffd23f'],
    ['make it green', '#2fb344'],
    ['white', '#ffffff'],
    ['black', '#111111'],
    ['pink', '#ff5d8f'],
    ['orange', '#ff8a1f'],
    ['purple', '#8a4bd8'],
  ])('recolours the selected layer: %s', (message, color) => {
    expect(update(message).ops[0]!.set!.style!.fill).toEqual({ kind: 'solid', color });
  });

  it('resizes, switches the writing direction and says what it did in English', () => {
    expect(update('smaller').ops[0]!.set!.style!.fontSize).toBe(77);
    expect(update('bigger').ops[0]!.set!.style!.fontSize).toBe(130);
    expect(update('vertical').ops[0]!.set!.style!.vertical).toBe(true);
    expect(update('horizontal').ops[0]!.set!.style!.vertical).toBe(false);
    expect(update('bigger').reply.text).toBe('Done: made the text larger.');
  });

  it('adds and removes a shadow and an outline', () => {
    expect(update('add a shadow').ops[0]!.set!.style!.shadow).toMatchObject({ blur: 8 });
    expect(update('no shadow').ops[0]!.set!.style!.shadow).toBeNull();
    expect(update('add an outline').ops[0]!.set!.style!.stroke).toMatchObject({ width: 8 });
    expect(update('no outline').ops[0]!.set!.style!.stroke).toBeNull();
  });

  it('rotates, moves and rewrites', () => {
    expect(update('30度').ops[0]!.set!.rotation).toBe(30);
    expect(update('center').ops[0]!.set).toMatchObject({ x: 500, y: 400 });
    expect(update('move to the top').ops[0]!.set!.y).toBe(160);
    expect(update('move to the bottom').ops[0]!.set!.y).toBe(640);
    expect(update('change it to "Thanks"').ops[0]!.set!.text).toBe('Thanks');
  });

  it('applies a preset to text but not to a bubble, and removes a layer on request', () => {
    expect(update('gold style').ops[0]).toMatchObject({ op: 'preset', preset: 'gold' });
    expect(update('sticker').ops[0]).toMatchObject({ preset: 'sticker' });
    expect(update('soft').ops[0]).toMatchObject({ preset: 'soft' });
    expect(update('sfx').ops[0]).toMatchObject({ preset: 'sfx' });
    expect(update('remove it').ops[0]).toEqual({ op: 'remove', id: 'l1' });
    expect(ask('gold', [bubble], 'b1')!.ops).toHaveLength(0);
  });

  it('adds speech bubbles in the shape named, and text with a preset', () => {
    const shapes: [string, string][] = [
      ['add a speech bubble, thought', 'cloud'],
      ['add a whisper bubble', 'whisper'],
      ['add a square bubble', 'box'],
      ['add a narration bubble', 'narration'],
      ['make a bubble', 'round'],
    ];
    for (const [message, shape] of shapes) {
      const op = update(message).ops[0] as unknown as { layer: { shape: string; text: string } };
      expect(op.layer.shape).toBe(shape);
    }
    const added = update('add text "Boom" in gold').ops;
    expect(added[0]).toMatchObject({ op: 'add', layer: { text: 'Boom' } });
    expect(added[1]).toMatchObject({ op: 'preset', preset: 'gold' });
  });

  it('works on the last layer when nothing is selected, and explains itself in English when puzzled', () => {
    const reply = ask('red', [layer], null)!;
    expect(reply.ops).toHaveLength(1);
    const puzzled = ask('hmm', [layer], null)!;
    expect(puzzled.ops).toHaveLength(0);
    expect(puzzled.text).toContain('Tell me');
    expect(ask('add a bubble', [], null)!.ops).toHaveLength(1);
  });
});
