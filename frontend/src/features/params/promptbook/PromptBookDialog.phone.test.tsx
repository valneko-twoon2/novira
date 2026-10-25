// @vitest-environment jsdom
// The prompt book on a phone: a screen of its own with a back control, not the desktop's dialog.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { PHONE_QUERY } from '@/state/layout';
import { useParams } from '@/state/params';
import { usePromptBook } from '@/state/prompts/promptBook';
import { TooltipProvider } from '@/ui';
import { PromptBookDialog } from './PromptBookDialog';

const initial = { book: usePromptBook.getState(), params: useParams.getState() };

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {} }));
  usePromptBook.setState({ ...initial.book, entries: [{ id: '1', tag: 'smile', category: 'face', meaning: '', note: '' }], open: true, target: 'positive' }, true);
  useParams.setState({ ...initial.params, positivePrompt: '', negativePrompt: '' }, true);
  render(
    <TooltipProvider>
      <PromptBookDialog />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the prompt book on a phone', () => {
  it('fills the screen with the list, and the back control closes it', () => {
    const screenEl = screen.getByTestId('prompt-book-screen');
    expect(screenEl.parentElement).toBe(document.body);
    expect(screenEl.querySelector('.pb-item__tag')?.textContent).toBe('smile');
    expect(screen.queryByRole('dialog', { name: t('params.promptBook.title') })?.getAttribute('data-testid')).toBe('prompt-book-screen');
    fireEvent.click(screen.getByTestId('prompt-book-back'));
    expect(usePromptBook.getState().open).toBe(false);
    expect(screen.queryByTestId('prompt-book-screen')).toBeNull();
  });

  it('closes with Escape', () => {
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(usePromptBook.getState().open).toBe(false);
  });
});
