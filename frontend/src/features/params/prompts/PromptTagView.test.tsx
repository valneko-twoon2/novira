// @vitest-environment jsdom
// The tag view of a prompt: chips with their strength, the strength popover, removing and adding tags.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { TooltipProvider } from '@/ui';
import { PromptTagView } from './PromptTagView';

let latest = '';
function Harness({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  latest = v;
  return (
    <TooltipProvider>
      <PromptTagView kind="positive" value={v} onChange={setV} />
    </TooltipProvider>
  );
}

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the prompt tag view', () => {
  it('shows each tag and the strength of a weighted one', () => {
    render(<Harness initial="1girl, (smile:1.3)" />);
    const chips = screen.getAllByTestId('positive-tag');
    expect(chips.map((c) => c.textContent)).toEqual(['1girl', 'smile1.3']);
  });

  it('opens the strength popover on a tag and resets it to plain words', () => {
    render(<Harness initial="1girl, (smile:1.3)" />);
    fireEvent.click(screen.getAllByTestId('positive-tag')[1]!);
    fireEvent.click(screen.getByText(t('params.prompt.tagReset')));
    expect(latest).toBe('1girl, smile');
  });

  it('removes a tag from the popover', () => {
    render(<Harness initial="a, b" />);
    fireEvent.click(screen.getAllByTestId('positive-tag')[0]!);
    fireEvent.click(screen.getByLabelText(t('params.prompt.tagRemove')));
    expect(latest).toBe('b');
  });

  it('adds a typed tag on Enter, ignores an empty one, and skips a duplicate', () => {
    render(<Harness initial="a" />);
    const input = screen.getByTestId('positive-tag-add');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(latest).toBe('a');
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(latest).toBe('a, b');
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(latest).toBe('a, b');
  });
});
