// The refinement loop's rules (agentRefine.ts): how a request changes its state and what the app sends for the next picture.
import { describe, expect, it } from 'vitest';
import { afterRequest, clampRounds, continuation, REFINE_DEFAULT_ROUNDS, REFINE_MAX_ROUNDS, type Refinement } from './agentRefine';

const running = (round: number, max = 5): Refinement => ({ goal: 'like the picture', targets: ['t.png'], round, max });

describe('afterRequest', () => {
  it('starts at the first picture when the assistant starts it, replacing one that was running', () => {
    expect(afterRequest(null, { action: 'start', goal: 'g', targets: ['a.png'], max: 4 })).toEqual({ goal: 'g', targets: ['a.png'], round: 1, max: 4 });
    expect(afterRequest(running(3), { action: 'start', goal: 'g', targets: [], max: 4 })?.round).toBe(1);
  });

  it('counts a picture when the assistant said nothing, and ends when it finishes or there is nothing to go on', () => {
    expect(afterRequest(running(1), undefined)?.round).toBe(2);
    expect(afterRequest(running(1), { action: 'finish' })).toBeNull();
    expect(afterRequest(null, undefined)).toBeNull();
    expect(afterRequest(null, { action: 'finish' })).toBeNull();
  });

  it('never counts past the last picture', () => {
    expect(afterRequest(running(4), undefined)?.round).toBe(5);
    expect(afterRequest(running(5), undefined)?.round).toBe(5);
  });
});

describe('clampRounds', () => {
  it('takes 30 pictures when none is named and bounds a number to 2..30', () => {
    expect(REFINE_DEFAULT_ROUNDS).toBe(30);
    expect(REFINE_MAX_ROUNDS).toBe(30);
    expect([undefined, 'x', NaN].map(clampRounds)).toEqual([30, 30, 30]);
    expect([1, 2, 12.4, 30, 99].map(clampRounds)).toEqual([2, 2, 12, 30, 30]);
  });
});

describe('continuation', () => {
  it('names the next picture, the goal and the targets, and tells the assistant not to end without a picture or a finish', () => {
    const { text, n } = continuation(running(1));
    expect(n).toBe(2);
    expect(text).toContain('picture 2 of 5');
    expect(text).toContain('Goal: like the picture.');
    expect(text).toContain('Target pictures: t.png');
    expect(text).toContain('Never end this turn without drawing a picture or calling finish');
  });

  it('says the last picture is the last, and leaves out targets when there are none', () => {
    const { text, n } = continuation({ ...running(4), targets: [] });
    expect(n).toBe(5);
    expect(text).toContain('This is the last picture');
    expect(text).not.toContain('Target pictures');
  });
});
