// What the Browse tab says of a version that asks for payment: free, paid for good, or early access with an end date.
import { describe, expect, it } from 'vitest';
import { isPaid } from '@/backend/paid';
import { paidBadge, paidReason } from './paid';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 26);

describe('paid versions', () => {
  it('is not paid when the answer says nothing, and not on Hugging Face', () => {
    expect(isPaid(undefined, now)).toBe(false);
    expect(isPaid({}, now)).toBe(false);
    expect(paidBadge({}, now)).toBeNull();
    expect(paidReason({ paid: false, paidUntil: null }, now)).toBeNull();
  });

  it('is paid for good without an end date, and for ever after', () => {
    expect(isPaid({ paid: true, paidUntil: null }, now)).toBe(true);
    expect(isPaid({ paid: true }, now + 1000 * DAY)).toBe(true);
    expect(paidBadge({ paid: true }, now)).toBe('有料');
    expect(paidReason({ paid: true }, now)).toContain('購入');
  });

  it('is paid in early access until its end, free from that moment', () => {
    const until = now + 5 * DAY;
    expect(isPaid({ paid: true, paidUntil: until }, until - 1)).toBe(true);
    expect(isPaid({ paid: true, paidUntil: until }, until)).toBe(false);
    expect(paidBadge({ paid: true, paidUntil: until }, now)).toMatch(/^有料 〜.*2026/);
    expect(paidReason({ paid: true, paidUntil: until }, now)).toContain('アーリーアクセス');
    // After the end, nothing is said and the file can be installed.
    expect(paidBadge({ paid: true, paidUntil: until }, until + 1)).toBeNull();
  });
});
