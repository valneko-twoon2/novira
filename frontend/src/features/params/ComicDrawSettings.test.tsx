// @vitest-environment jsdom
// The comic's drawing settings in the Generate form: the scope bar (whole comic or the page on screen), the quality words
// and the shared negative prompt, and the strength of the character references.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { CAST_REFERENCE_DEFAULT, CAST_REFERENCE_MAX, CAST_REFERENCE_MIN, newProject } from '@/state/comic/document';
import { useDrawScope } from '@/state/comic/drawScope';
import { STYLE_MAX } from '@/state/comic/style';
import { activePage, useComic } from '@/state/comic/store';
import { TooltipProvider } from '@/ui';
import { ComicDrawExtras } from './ComicParams';

const initialScope = useDrawScope.getState();

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useDrawScope.setState(initialScope, true);
  useComic.getState().setProjects([newProject('Drawn')]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const comic = () => useComic.getState().projects[0]!;
const page = () => activePage(useComic.getState())!;
const mount = () =>
  render(
    <TooltipProvider>
      <ComicDrawExtras />
    </TooltipProvider>,
  );
const field = (kind: 'positive' | 'negative') => screen.getByTestId(`comic-draw-style-${kind}`) as HTMLTextAreaElement;

describe('the scope bar', () => {
  it('marks the scope in use and switches to the page and back', () => {
    mount();
    const comicBtn = screen.getByTestId('comic-draw-scope-comic');
    const pageBtn = screen.getByTestId('comic-draw-scope-page');
    expect(comicBtn.getAttribute('aria-pressed')).toBe('true');
    expect(pageBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pageBtn);
    expect(useDrawScope.getState().scope).toBe('page');
    expect(pageBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(comicBtn);
    expect(useDrawScope.getState().scope).toBe('comic');
  });

  it('offers the way back only while the page has changes of its own', () => {
    mount();
    expect(screen.queryByTestId('comic-draw-page-reset')).toBeNull();
    act(() => useComic.getState().setPageDraw(page().id, {}));
    expect(screen.queryByTestId('comic-draw-page-reset')).toBeNull();
    act(() => useComic.getState().setPageDraw(page().id, { steps: 12 } as never));
    expect(screen.getByTestId('comic-draw-page-reset')).toBeTruthy();
  });

  it('shows the way back for a page that has only its own quality words, and clears both on reset', () => {
    mount();
    act(() => {
      useComic.getState().setPageDraw(page().id, { steps: 12 } as never);
      useComic.getState().setPageStyle(page().id, { positive: 'page words' });
    });
    fireEvent.click(screen.getByTestId('comic-draw-page-reset'));
    expect(page().draw).toBeUndefined();
    expect(page().style).toBeUndefined();
    expect(screen.queryByTestId('comic-draw-page-reset')).toBeNull();

    act(() => useComic.getState().setPageStyle(page().id, { negative: 'x' }));
    expect(screen.getByTestId('comic-draw-page-reset')).toBeTruthy();
  });
});

describe('the quality words', () => {
  it('writes the comic words, and drops a word that was emptied', () => {
    mount();
    fireEvent.change(field('positive'), { target: { value: 'sharp lines' } });
    fireEvent.change(field('negative'), { target: { value: 'blurry' } });
    expect(comic().style).toEqual({ positive: 'sharp lines', negative: 'blurry' });
    fireEvent.change(field('positive'), { target: { value: '' } });
    expect(comic().style).toEqual({ negative: 'blurry' });
    fireEvent.change(field('negative'), { target: { value: '' } });
    expect(comic().style).toBeUndefined();
  });

  it('shows the default words as the hint while empty, and limits the length', () => {
    mount();
    expect(field('positive').value).toBe('');
    expect(field('positive').placeholder.length).toBeGreaterThan(0);
    expect(field('positive').maxLength).toBe(STYLE_MAX);
  });

  it('writes to the page, not the comic, in the page scope', () => {
    useDrawScope.setState({ scope: 'page' });
    mount();
    fireEvent.change(field('positive'), { target: { value: 'page only' } });
    expect(page().style).toEqual({ positive: 'page only' });
    expect(comic().style).toBeUndefined();
    expect(field('positive').value).toBe('page only');
  });

  it('shows the comic words in the comic scope and the page words in the page scope', () => {
    useComic.getState().setStyle(comic().id, { positive: 'comic words' });
    useComic.getState().setPageStyle(page().id, { positive: 'page words' });
    mount();
    expect(field('positive').value).toBe('comic words');
    fireEvent.click(screen.getByTestId('comic-draw-scope-page'));
    expect(field('positive').value).toBe('page words');
  });

  it('shows no quality words when there is no comic', () => {
    useComic.getState().setProjects([]);
    mount();
    expect(screen.queryByTestId('comic-draw-style')).toBeNull();
    expect(screen.queryByTestId('comic-cast-reference')).toBeNull();
  });
});

describe('the character references', () => {
  it('changes the strength with the slider box within its limits', () => {
    useComic.getState().setCastReference(comic().id, CAST_REFERENCE_DEFAULT);
    mount();
    const section = screen.getByTestId('comic-cast-reference');
    const box = within(section).getAllByLabelText(t('comic.draw.castReference.weight')).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
    fireEvent.change(box, { target: { value: '0.3' } });
    fireEvent.blur(box);
    expect(comic().castReference).toBeCloseTo(0.3);
    fireEvent.change(box, { target: { value: '99' } });
    fireEvent.blur(box);
    expect(comic().castReference).toBeLessThanOrEqual(CAST_REFERENCE_MAX);
    expect(comic().castReference).toBeGreaterThanOrEqual(CAST_REFERENCE_MIN);
  });
});
