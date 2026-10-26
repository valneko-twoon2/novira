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
    expect(chips.map((c) => c.textContent)).toEqual(['1girl', 'smile1.30']);
  });

  it('opens the strength popover on a tag and resets it to plain words', () => {
    render(<Harness initial="1girl, (smile:1.3)" />);
    fireEvent.click(screen.getAllByTestId('positive-tag')[1]!);
    fireEvent.click(screen.getByLabelText(t('params.prompt.tagReset')));
    expect(latest).toBe('1girl, smile');
  });

  it('renames a tag from the popover on Enter, keeping its strength, and keeps the popover open', () => {
    render(<Harness initial="1girl, (smile:1.3)" />);
    fireEvent.click(screen.getAllByTestId('positive-tag')[1]!);
    const name = screen.getByTestId('positive-tag-name') as HTMLInputElement;
    expect(name.value).toBe('smile');
    fireEvent.change(name, { target: { value: 'grin' } });
    expect(latest).toBe('1girl, (smile:1.3)');
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(latest).toBe('1girl, (grin:1.3)');
    expect(screen.getByTestId('positive-tag-name')).toBeTruthy();
  });

  it('saves a rename when the name field is left, and ignores a blank name', () => {
    render(<Harness initial="a, b" />);
    fireEvent.click(screen.getAllByTestId('positive-tag')[0]!);
    const name = screen.getByTestId('positive-tag-name');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);
    expect(latest).toBe('a, b');
    expect((screen.getByTestId('positive-tag-name') as HTMLInputElement).value).toBe('a');
    fireEvent.change(name, { target: { value: 'c' } });
    fireEvent.blur(name);
    expect(latest).toBe('c, b');
  });

  it('keeps the width of a chip while its strength is dragged through 1', () => {
    render(<Harness initial="a, (b:1.05)" />);
    fireEvent.click(screen.getAllByTestId('positive-tag')[0]!);
    // A plain tag shows its strength while its popover is open, so the chip does not grow at 1.
    expect(screen.getAllByTestId('positive-tag')[0]!.textContent).toBe('a1.00');
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
