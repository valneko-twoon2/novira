// Where a draft stops: clamp(round(f × N), ceil(0.2 × N), N − 2). Mirrors the backend so the badges match.
export function draftStep(steps: number, fraction: number): number {
  const lo = Math.ceil(0.2 * steps);
  const hi = Math.max(1, steps - 2);
  return Math.min(Math.max(Math.round(fraction * steps), lo), hi);
}
