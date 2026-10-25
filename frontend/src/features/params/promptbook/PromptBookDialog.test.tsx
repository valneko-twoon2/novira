// @vitest-environment jsdom
// The prompt book: browsing by category and search, adding a tag to a prompt, registering, editing and deleting entries.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { usePromptBook, type PromptBookEntry } from '@/state/prompts/promptBook';
import { TooltipProvider } from '@/ui';
import { PromptBookDialog } from './PromptBookDialog';

const initial = { book: usePromptBook.getState(), params: useParams.getState() };
const entry = (id: string, tag: string, category: string, meaning = '', note = ''): PromptBookEntry => ({ id, tag, category, meaning, note });
const state = () => usePromptBook.getState();
const items = () => [...document.querySelectorAll('.pb-item__tag')].map((e) => e.textContent);
const input = (key: string) => screen.getByTestId(`pb-${key}`) as HTMLInputElement;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  usePromptBook.setState({ ...initial.book, entries: [entry('1', 'smile', 'face', 'happy look', 'works well'), entry('2', 'rain', 'weather'), entry('3', 'cloud', 'weather', 'grey sky')], open: true, target: 'positive' }, true);
  useParams.setState({ ...initial.params, positivePrompt: 'masterpiece', negativePrompt: '' }, true);
  render(
    <TooltipProvider>
      <PromptBookDialog />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('browsing', () => {
  it('lists the entries with their count, and narrows them by category and by search', () => {
    expect(items()).toEqual(['smile', 'rain', 'cloud']);
    expect(screen.getByText(t('params.promptBook.count', { count: 3 }))).toBeTruthy();
    const nav = within(screen.getByRole('navigation', { name: t('params.promptBook.category') }));
    fireEvent.click(nav.getByText('weather'));
    expect(items()).toEqual(['rain', 'cloud']);
    fireEvent.change(screen.getByTestId('pb-search'), { target: { value: 'grey' } });
    expect(items()).toEqual(['cloud']);
    fireEvent.change(screen.getByTestId('pb-search'), { target: { value: 'zzz' } });
    expect(screen.getByText(t('params.promptBook.noMatch'))).toBeTruthy();
    fireEvent.click(nav.getByText(t('params.promptBook.all')));
    fireEvent.change(screen.getByTestId('pb-search'), { target: { value: '' } });
    expect(items()).toHaveLength(3);
  });

  it('says when the book is empty', () => {
    act(() => usePromptBook.setState({ entries: [] }));
    expect(screen.getByText(t('params.promptBook.empty'))).toBeTruthy();
  });

  it('shows the meaning, note and category of an entry', () => {
    expect(screen.getByText('happy look')).toBeTruthy();
    expect(screen.getByText('works well')).toBeTruthy();
    expect(document.querySelectorAll('.pb-pill')).toHaveLength(3);
  });
});

describe('using a tag', () => {
  const target = (tag: string, kind: 'positive' | 'negative') => {
    const row = screen.getByText(tag).closest('.pb-item') as HTMLElement;
    return row.querySelector(`.pb-target--${kind}`) as HTMLElement;
  };

  it('adds the tag to the positive or negative prompt and takes it out again', () => {
    fireEvent.click(target('smile', 'positive'));
    expect(useParams.getState().positivePrompt).toContain('smile');
    expect(target('smile', 'positive').className).toContain('is-on');
    fireEvent.click(target('rain', 'negative'));
    expect(useParams.getState().negativePrompt).toContain('rain');
    fireEvent.click(target('smile', 'positive'));
    expect(useParams.getState().positivePrompt).not.toContain('smile');
    expect(target('smile', 'positive').className).not.toContain('is-on');
  });
});

describe('registering and editing', () => {
  it('registers a new tag at the top, with its details, and empties the form', () => {
    expect((screen.getByTestId('pb-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(input('tag').closest('form')!);
    expect(state().entries).toHaveLength(3);
    fireEvent.change(input('tag'), { target: { value: '  sunset ' } });
    fireEvent.change(input('meaning'), { target: { value: 'evening' } });
    fireEvent.change(input('category'), { target: { value: 'sky' } });
    fireEvent.change(input('note'), { target: { value: 'warm' } });
    fireEvent.click(screen.getByTestId('pb-submit'));
    expect(state().entries[0]).toMatchObject({ tag: 'sunset', meaning: 'evening', category: 'sky', note: 'warm' });
    expect(input('tag').value).toBe('');
  });

  it('edits an entry in the form and can stop editing', () => {
    const row = screen.getByText('smile').closest('.pb-item') as HTMLElement;
    fireEvent.click(within(row).getByLabelText(t('common.edit')));
    expect(input('tag').value).toBe('smile');
    expect(input('meaning').value).toBe('happy look');
    fireEvent.click(screen.getByTestId('pb-cancel-edit'));
    expect(input('tag').value).toBe('');
    fireEvent.click(within(row).getByLabelText(t('common.edit')));
    fireEvent.change(input('tag'), { target: { value: 'grin' } });
    fireEvent.click(screen.getByTestId('pb-submit'));
    expect(state().entries.find((e) => e.id === '1')!.tag).toBe('grin');
    expect(screen.queryByTestId('pb-cancel-edit')).toBeNull();
  });
});

describe('deleting', () => {
  it('removes the entry on the second press, and ends its editing', () => {
    const row = () => screen.getByText('smile').closest('.pb-item') as HTMLElement;
    fireEvent.click(within(row()).getByLabelText(t('common.edit')));
    fireEvent.click(within(row()).getByLabelText(t('common.delete')));
    expect(state().entries).toHaveLength(3);
    fireEvent.click(within(row()).getByLabelText(t('common.deleteAgain')));
    expect(state().entries.map((e) => e.id)).toEqual(['2', '3']);
    expect(input('tag').value).toBe('');
  });
});

describe('closing', () => {
  it('closes with the close button', () => {
    fireEvent.click(screen.getByLabelText(t('common.close')));
    expect(state().open).toBe(false);
  });
});
