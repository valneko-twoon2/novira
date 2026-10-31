// @vitest-environment jsdom
// One place of the comic, edited in boxes: name, words, and words kept out. Each edit is a patch, and the lengths are capped.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n';
import { PLACE_NAME_MAX, PLACE_NEGATIVE_MAX, PLACE_TAGS_MAX, type ComicPlace } from '@/state/comic/document';
import { TooltipProvider } from '@/ui';
import { PlaceFields } from './PlaceFields';

const place: ComicPlace = { id: 'p1', name: 'Cafe', tags: 'wooden table', negative: 'crowd' };

function show(p: ComicPlace = place) {
  const change = vi.fn();
  const remove = vi.fn();
  render(
    <TooltipProvider>
      <PlaceFields place={p} change={change} remove={remove} />
    </TooltipProvider>,
  );
  return { change, remove };
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  setLocale('ja');
});

describe('the fields of a place', () => {
  it('shows the name, the words and the words kept out', () => {
    show();
    expect((screen.getByTestId('comic-place-name') as HTMLInputElement).value).toBe('Cafe');
    expect((screen.getByTestId('comic-place-tags') as HTMLTextAreaElement).value).toBe('wooden table');
    expect((screen.getByTestId('comic-place-negative') as HTMLTextAreaElement).value).toBe('crowd');
  });

  it('shows an empty box for the words kept out when the place has none', () => {
    show({ id: 'p2', name: 'Park', tags: '' });
    expect((screen.getByTestId('comic-place-negative') as HTMLTextAreaElement).value).toBe('');
  });

  it('reports each edit as a patch of that one field', () => {
    const { change } = show();
    fireEvent.change(screen.getByTestId('comic-place-name'), { target: { value: 'Bar' } });
    fireEvent.change(screen.getByTestId('comic-place-tags'), { target: { value: 'neon' } });
    fireEvent.change(screen.getByTestId('comic-place-negative'), { target: { value: 'rain' } });
    expect(change.mock.calls).toEqual([[{ name: 'Bar' }], [{ tags: 'neon' }], [{ negative: 'rain' }]]);
  });

  it('caps the length of every box', () => {
    show();
    expect(screen.getByTestId('comic-place-name').getAttribute('maxlength')).toBe(String(PLACE_NAME_MAX));
    expect(screen.getByTestId('comic-place-tags').getAttribute('maxlength')).toBe(String(PLACE_TAGS_MAX));
    expect(screen.getByTestId('comic-place-negative').getAttribute('maxlength')).toBe(String(PLACE_NEGATIVE_MAX));
  });

  it('asks to remove the place from its button', () => {
    const { remove, change } = show();
    fireEvent.click(screen.getByTestId('comic-place-remove'));
    expect(remove).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
  });
});
