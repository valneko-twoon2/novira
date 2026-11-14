// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyOverlay } from './EmptyOverlay';

afterEach(cleanup);

describe('EmptyOverlay', () => {
  it('shows the title and the explanation in a card with the given test id', { tags: ['equivalence'] }, () => {
    render(<EmptyOverlay title="Nothing here" description="Add something to start." data-testid="empty" />);
    const card = screen.getByTestId('empty');
    expect(card.className).toBe('ui-empty-overlay');
    expect(card.querySelector('.ui-empty-overlay__title')?.textContent).toBe('Nothing here');
    expect(card.querySelector('.ui-empty-overlay__desc')?.textContent).toBe('Add something to start.');
  });
});
