// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { CoverCarousel } from './CoverCarousel';

// The picture itself is not under test: the stand-in shows which index it was given.
vi.mock('./Cover', () => ({ Cover: ({ index }: { index: number }) => <div data-testid="cover">{index}</div> }));

afterEach(() => cleanup());
const model = (imageCount: number) => ({ id: 'm', imageCount }) as CivitaiModel;
const shown = () => screen.getByTestId('cover').textContent;
const dots = () => [...document.querySelectorAll('.browse-carousel__dots span')];

describe('CoverCarousel', () => {
  it('has no arrows or dots for one picture, or none', () => {
    const { rerender } = render(<CoverCarousel model={model(1)} />);
    expect(screen.queryByLabelText(t('browse.card.nextImage'))).toBeNull();
    rerender(<CoverCarousel model={model(0)} />);
    expect(screen.queryByLabelText(t('browse.card.prevImage'))).toBeNull();
    expect(dots().length).toBe(0);
  });

  it('steps forward and wraps from the last picture to the first', () => {
    render(<CoverCarousel model={model(3)} />);
    const next = screen.getByLabelText(t('browse.card.nextImage'));
    expect(dots().length).toBe(3);
    fireEvent.click(next);
    expect(shown()).toBe('1');
    expect(dots()[1]!.className).toBe('is-on');
    fireEvent.click(next);
    fireEvent.click(next);
    expect(shown()).toBe('0');
  });

  it('steps back and wraps from the first picture to the last, without reaching the card', () => {
    const onCard = vi.fn();
    render(
      <div onClick={onCard}>
        <CoverCarousel model={model(3)} />
      </div>,
    );
    fireEvent.click(screen.getByLabelText(t('browse.card.prevImage')));
    expect(shown()).toBe('2');
    expect(onCard).not.toHaveBeenCalled();
  });
});
