// The refinement loop (docs/design/03-assistant/01-core/03-assistant-refine.md): when the user asks to get closer to a picture over several
// tries, the assistant starts it with the refine tool and the app sends it back after each answer until it finishes or
// the rounds are used up, so the loop does not depend on the model choosing to go on.

/** Pictures a refinement draws when the assistant names no number. */
export const REFINE_DEFAULT_ROUNDS = 30;
/** The most pictures one refinement draws. */
export const REFINE_MAX_ROUNDS = 30;

export interface Refinement {
  goal: string;
  /** Gallery pictures to get close to (the user's attachment), named again in every round. */
  targets: string[];
  /** Pictures drawn so far. */
  round: number;
  /** Pictures at most. */
  max: number;
}

/** What the assistant asked of the app in one request: start a refinement or end it. */
export type RefineOutcome = { action: 'start'; goal: string; targets: string[]; max: number } | { action: 'finish' };

export const clampRounds = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(REFINE_MAX_ROUNDS, Math.max(2, Math.round(n))) : REFINE_DEFAULT_ROUNDS);

/** The state after a request, given what the assistant did with the refine tool in it (nothing: the loop goes on). */
export function afterRequest(current: Refinement | null, outcome: RefineOutcome | undefined): Refinement | null {
  if (outcome?.action === 'finish') return null;
  if (outcome?.action === 'start') return { goal: outcome.goal, targets: outcome.targets, round: 1, max: outcome.max };
  if (!current) return null;
  const next = { ...current, round: current.round + 1 };
  return next.round >= next.max ? { ...next, round: next.max } : next;
}

/** The message the app sends in place of the user for the next picture. Written in English: the model reads it. */
export function continuation(r: Refinement): { text: string; n: number } {
  const n = r.round + 1;
  const last = n >= r.max;
  const targets = r.targets.length ? ` Target pictures: ${r.targets.join(', ')} (look at them again with view_picture and their names).` : '';
  const text = [
    `[Automatic message of the app: refinement picture ${n} of ${r.max}. The user is not waiting to be asked anything.]`,
    `Goal: ${r.goal}.${targets}`,
    'Look at the target and at your latest trial picture with view_picture, say in one line what still differs, change only that in the prompt or settings, then draw one more trial picture (generate with trial true) and look at it.',
    last
      ? 'This is the last picture: after looking at it, call refine with action finish and sum up what you changed in each round.'
      : 'If it is close enough, or the last two pictures came no closer, call refine with action finish and a short summary instead of drawing again. Never end this turn without drawing a picture or calling finish.',
  ].join('\n');
  return { text, n };
}
