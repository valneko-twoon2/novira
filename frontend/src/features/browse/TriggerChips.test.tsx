// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useToasts } from '@/state/toasts';
import { TriggerChips } from './TriggerChips';

const initialToasts = useToasts.getState();
const chips = () => screen.getAllByTitle(t('browse.detail.copyHint'));

beforeEach(() => useToasts.setState(initialToasts, true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TriggerChips', () => {
  it('shows every word, or only the first few with a limit', () => {
    const words = ['a', 'b', 'c', 'd'];
    const { rerender } = render(<TriggerChips words={words} />);
    expect(chips().map((c) => c.textContent)).toEqual(words);
    rerender(<TriggerChips words={words} max={3} />);
    expect(chips().map((c) => c.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('copies the word on a press, says so, and keeps the press from the card', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onCard = vi.fn();
    render(
      <div onClick={onCard}>
        <TriggerChips words={['sunny']} />
      </div>,
    );
    fireEvent.click(chips()[0]!);
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.status).toBe('success'));
    expect(writeText).toHaveBeenCalledWith('sunny');
    expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('browse.detail.triggerCopied', { word: 'sunny' }));
    expect(onCard).not.toHaveBeenCalled();
  });

  it('warns when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<TriggerChips words={['sunny']} />);
    fireEvent.click(chips()[0]!);
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)?.status).toBe('warning'));
    expect(useToasts.getState().toasts.at(-1)?.title).toBe(t('browse.detail.copyFailed'));
  });
});
